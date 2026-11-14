"""
Modular OPERA DSWx-S1 baseline ingestion module.
Inspects product class definitions, masks invalid/cloud/shadow pixels,
and exposes clear baseline surface water categories.
"""
import os
import re
from datetime import datetime, timezone
from typing import Optional, Tuple
import numpy as np
import rasterio

from backend.schemas import DSWxClass


class DSWxIngestionValidationError(ValueError):
    """Raised when OPERA DSWx raster fails format or CRS validation."""
    pass


def parse_opera_dswx_timestamp(filename_or_text: str) -> Optional[datetime]:
    """
    Parses timestamp from OPERA DSWx filename convention:
    e.g. OPERA_L3_DSWx-S1_T15SXR_20230501T120000Z_v1.0_B01_WTR.tif
    """
    match = re.search(r'(\d{8}T\d{6})Z?', filename_or_text)
    if match:
        dt_str = match.group(1)
        try:
            return datetime.strptime(dt_str, "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


class DSWxRaster:
    def __init__(
        self,
        granule_id: str,
        acquisition_time: datetime,
        crs: str,
        transform: tuple,
        width: int,
        height: int,
        raw_classes: np.ndarray,
        valid_mask: np.ndarray,
        water_mask: np.ndarray,
        open_water_mask: np.ndarray,
        partial_water_mask: np.ndarray
    ):
        self.granule_id = granule_id
        self.acquisition_time = acquisition_time
        self.crs = crs
        self.transform = transform
        self.width = width
        self.height = height
        self.raw_classes = raw_classes
        self.valid_mask = valid_mask          # True where observation was valid (classes 0, 1, 2)
        self.water_mask = water_mask          # True where water is observed (classes 1 or 2)
        self.open_water_mask = open_water_mask  # Class 1
        self.partial_water_mask = partial_water_mask  # Class 2


def ingest_opera_dswx(filepath: str) -> DSWxRaster:
    """
    Ingests and parses an OPERA DSWx-S1 WTR GeoTIFF.
    Class interpretation:
      0: Not water
      1: Open water
      2: Partial surface water
      250: Snow/Ice (Masked)
      251: Cloud shadow (Masked)
      252: Cloud / Haze (Masked)
      255: NoData / Unobserved
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"OPERA DSWx GeoTIFF not found: {filepath}")

    with rasterio.open(filepath) as src:
        if not src.crs:
            raise DSWxIngestionValidationError(f"OPERA DSWx raster {filepath} has no CRS defined.")

        crs_str = src.crs.to_string()
        transform = tuple(src.transform)
        width = src.width
        height = src.height

        raw_classes = src.read(1).astype(np.uint8)
        granule_id = os.path.splitext(os.path.basename(filepath))[0]
        acq_time = parse_opera_dswx_timestamp(granule_id) or datetime.now(timezone.utc)

        # Quality & Validity: Valid observed pixels are 0 (Not water), 1 (Open water), 2 (Partial water)
        # Invalid / Unobserved pixels are >= 250 or nodata
        valid_mask = (raw_classes == DSWxClass.NOT_WATER) | (raw_classes == DSWxClass.OPEN_WATER) | (raw_classes == DSWxClass.PARTIAL_SURFACE_WATER)
        open_water_mask = (raw_classes == DSWxClass.OPEN_WATER)
        partial_water_mask = (raw_classes == DSWxClass.PARTIAL_SURFACE_WATER)
        water_mask = open_water_mask | partial_water_mask

        return DSWxRaster(
            granule_id=granule_id,
            acquisition_time=acq_time,
            crs=crs_str,
            transform=transform,
            width=width,
            height=height,
            raw_classes=raw_classes,
            valid_mask=valid_mask,
            water_mask=water_mask,
            open_water_mask=open_water_mask,
            partial_water_mask=partial_water_mask
        )
