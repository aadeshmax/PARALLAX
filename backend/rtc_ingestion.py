"""
Modular RTC-S1 GeoTIFF ingestion module.
Validates CRS, transform, resolution, acquisition time, polarization, NoData, and backscatter units.
Converts linear power to decibels safely while preserving already logarithmic data.
"""
import os
import re
from datetime import datetime, timezone
from typing import Optional, Tuple
import numpy as np
import rasterio
from rasterio.crs import CRS

from backend.schemas import SARMetadata, SARRaster, Polarization, BackscatterUnit


class IngestionValidationError(ValueError):
    """Raised when an RTC-S1 product violates required geospatial or metadata integrity."""
    pass


def parse_sentinel1_timestamp(filename_or_text: str) -> Optional[datetime]:
    """
    Extract UTC datetime from Sentinel-1 or RTC-S1 filenames.
    Supports OPERA RTC convention: OPERA_L2_RTC-S1_..._YYYYMMDDTHHMMSSZ_...
    and ASF RTC convention: S1A_..._YYYYMMDDTHHMMSS_...
    """
    # Pattern 1: ISO compact YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
    match = re.search(r'(\d{8}T\d{6})Z?', filename_or_text)
    if match:
        dt_str = match.group(1)
        try:
            return datetime.strptime(dt_str, "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


def detect_polarization(filename_or_tags: str) -> Polarization:
    """
    Detect polarization (VV, VH, HH, HV) from filename, band description, or tags.
    """
    upper = filename_or_tags.upper()
    for pol in (Polarization.VV, Polarization.VH, Polarization.HH, Polarization.HV):
        # Look for _VV_, _VV., _VV_norm, etc.
        if re.search(rf'(_|/|-){pol.value}(_|\.|$)', upper):
            return pol
    # Fallback search
    if "VV" in upper:
        return Polarization.VV
    if "VH" in upper:
        return Polarization.VH
    if "HH" in upper:
        return Polarization.HH
    if "HV" in upper:
        return Polarization.HV
    raise IngestionValidationError(f"Could not reliably detect polarization from '{filename_or_tags}'.")


def detect_backscatter_unit(data_sample: np.ndarray, tags: dict, nodata_val: Optional[float] = None) -> BackscatterUnit:
    """
    Determines whether the raster values represent linear power (gamma0 / sigma0)
    or decibels (dB), checking metadata tags first and numerical distribution second.
    """
    # 1. Inspect metadata tags
    tags_lower = {k.lower(): str(v).lower() for k, v in tags.items()}
    tag_str = " ".join([f"{k}:{v}" for k, v in tags_lower.items()])
    if "db" in tag_str or "decibel" in tag_str or "logarithmic" in tag_str:
        return BackscatterUnit.DECIBEL
    if "linear" in tag_str or "power" in tag_str or "intensity" in tag_str:
        return BackscatterUnit.LINEAR_POWER

    # 2. Inspect numerical distribution of valid pixels
    valid_mask = np.isfinite(data_sample)
    if nodata_val is not None:
        valid_mask &= (data_sample != nodata_val)

    valid_vals = data_sample[valid_mask]
    if len(valid_vals) == 0:
        return BackscatterUnit.LINEAR_POWER

    # Check for negative values: decibel values are typically negative (e.g. -35 dB to 0 dB),
    # whereas linear power backscatter is strictly non-negative (>= 0.0).
    neg_fraction = np.sum(valid_vals < -0.001) / len(valid_vals)
    if neg_fraction > 0.05:
        # Significant negative values indicate decibels
        return BackscatterUnit.DECIBEL

    # Max value check: standard land surface linear gamma0 is usually < 5.0 (except bright trihedrals < 50.0).
    # If 95% of positive values are < 1.0 and minimum >= 0, it's linear power.
    p99 = np.percentile(valid_vals, 99) if len(valid_vals) > 100 else np.max(valid_vals)
    min_val = np.min(valid_vals)

    if min_val >= 0.0 and p99 <= 10.0:
        return BackscatterUnit.LINEAR_POWER

    # If all values are between -50 and +15, it's decibels
    if np.all(valid_vals >= -60.0) and np.all(valid_vals <= 30.0) and np.any(valid_vals < 0):
        return BackscatterUnit.DECIBEL

    return BackscatterUnit.LINEAR_POWER


def linear_to_db(data: np.ndarray, floor_linear: float = 1e-5) -> np.ndarray:
    """
    Safely converts linear power backscatter to decibels: 10 * log10(max(val, floor)).
    Leaves NaNs untouched.
    """
    result = np.full_like(data, np.nan, dtype=np.float32)
    valid_mask = np.isfinite(data) & (data > 0)
    clamped = np.maximum(data[valid_mask], floor_linear)
    result[valid_mask] = 10.0 * np.log10(clamped)
    return result


def ingest_rtc_geotiff(
    filepath: str,
    target_crs: Optional[str] = None,
    polarization: Optional[Polarization] = None,
    acquisition_time: Optional[datetime] = None
) -> SARRaster:
    """
    Ingests and validates an RTC-S1 GeoTIFF.
    - Validates CRS, affine transform, spatial resolution, nodata, unit.
    - If linear power, converts to decibels.
    - If already decibels, preserves values without re-converting.
    - Masks invalid / nodata pixels with NaN.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"RTC-S1 GeoTIFF not found at: {filepath}")

    with rasterio.open(filepath) as src:
        # 1. Validate CRS
        if not src.crs:
            raise IngestionValidationError(f"RTC GeoTIFF {filepath} has no defined CRS.")
        crs_str = src.crs.to_string()
        if target_crs and CRS.from_string(crs_str) != CRS.from_string(target_crs):
            pass  # Allowed; alignment step will reproject

        # 2. Validate Transform and Resolution
        transform = src.transform
        res_x = abs(transform.a)
        res_y = abs(transform.e)
        if res_x == 0 or res_y == 0:
            raise IngestionValidationError(f"Invalid spatial resolution ({res_x}, {res_y}) in {filepath}.")

        # 3. Polarization
        granule_name = os.path.basename(filepath)
        pol = polarization or detect_polarization(granule_name)

        # 4. Acquisition Time
        acq_time = acquisition_time or parse_sentinel1_timestamp(granule_name)
        if not acq_time:
            # Fallback to file creation / tag time or placeholder
            time_tag = src.tags().get("ACQUISITION_DATETIME") or src.tags().get("TIFFTAG_DATETIME")
            if time_tag:
                try:
                    acq_time = datetime.fromisoformat(time_tag)
                except ValueError:
                    pass
            if not acq_time:
                acq_time = datetime.now(timezone.utc)

        # 5. Read data and identify NoData
        raw_data = src.read(1).astype(np.float32)
        nodata_val = src.nodata

        # 6. Detect Unit
        unit = detect_backscatter_unit(raw_data, src.tags(), nodata_val)

        # 7. Masking invalid pixels
        valid_mask = np.isfinite(raw_data)
        if nodata_val is not None:
            valid_mask &= (raw_data != nodata_val)

        # 8. Convert to decibels only if linear
        db_data = np.full_like(raw_data, np.nan, dtype=np.float32)
        if unit == BackscatterUnit.LINEAR_POWER:
            db_data[valid_mask] = linear_to_db(raw_data[valid_mask])
        elif unit == BackscatterUnit.DECIBEL:
            db_data[valid_mask] = raw_data[valid_mask]
        else:
            # Amplitude -> power = amp^2 -> dB = 20 * log10(amp)
            clamped = np.maximum(raw_data[valid_mask], 1e-4)
            db_data[valid_mask] = 20.0 * np.log10(clamped)

        # Build metadata
        meta = SARMetadata(
            granule_id=os.path.splitext(granule_name)[0],
            acquisition_time=acq_time,
            polarization=pol,
            crs=crs_str,
            transform=tuple(transform),
            resolution=(res_x, res_y),
            width=src.width,
            height=src.height,
            nodata=nodata_val,
            unit=unit,
            extra_tags=src.tags()
        )

        return SARRaster(
            metadata=meta,
            data=db_data,
            raw_unit=unit,
            mask=valid_mask
        )
