import os
import json
import logging
from typing import Dict, Any, Tuple, Optional, List
import numpy as np
from scipy import ndimage
import rasterio
from rasterio.features import shapes
from shapely.geometry import shape, mapping
from shapely.ops import transform as shapely_transform
import pyproj
from pyproj import Transformer
from app.config import settings
from app.services.geospatial import geospatial_processor

logger = logging.getLogger("parallax.detection")

class DetectionEngine:
    """
    PARALLAX Dual-Signature Radar Flood & Inundated Vegetation Engine (v2.0).
    Implements common valid analysis masking, official NASA OPERA DSWx-S1 classification
    verification, coastal water exclusion, permanent water isolation, and strict mathematical
    invariants for cross-product comparison.
    """

    def analyze_scene(
        self,
        pre_vv_path: str,
        post_vv_path: str,
        pre_vh_path: Optional[str] = None,
        post_vh_path: Optional[str] = None,
        dswx_path: Optional[str] = None,
        darkening_thresh_db: float = -3.0,
        brightening_thresh_db: float = 2.5,
        min_cluster_pixels: int = 5,
        case_id: str = "custom_analysis"
    ) -> Dict[str, Any]:
        """
        Executes scientific radar backscatter change analysis and cross-product comparison
        strictly within a common valid observation mask.
        """
        logger.info(f"Starting PARALLAX scientific detection on case {case_id}")

        # 1. Ingest reference post-VV and pre-VV rasters
        post_vv_raw, profile = geospatial_processor.read_geotiff(post_vv_path)
        pre_vv_raw, _ = geospatial_processor.read_geotiff(pre_vv_path)

        # 2. Derive pixel geometry from affine transform
        trans = profile["transform"]
        pixel_size_x = abs(trans.a)
        pixel_size_y = abs(trans.e)
        pixel_area_m2 = pixel_size_x * pixel_size_y
        pixel_area_km2 = pixel_area_m2 / 1e6

        # 3. Convert linear radar backscatter to decibels (dB)
        post_vv_db = geospatial_processor.linear_to_db(post_vv_raw)
        pre_vv_db = geospatial_processor.linear_to_db(pre_vv_raw)

        # Ingest VH polarization if available
        post_vh_db = None
        pre_vh_db = None
        delta_vh = None
        has_vh = bool(
            post_vh_path and pre_vh_path and
            os.path.exists(post_vh_path) and os.path.exists(pre_vh_path)
        )
        if has_vh:
            post_vh_raw, _ = geospatial_processor.read_geotiff(post_vh_path)
            pre_vh_raw, _ = geospatial_processor.read_geotiff(pre_vh_path)
            post_vh_db = geospatial_processor.linear_to_db(post_vh_raw)
            pre_vh_db = geospatial_processor.linear_to_db(pre_vh_raw)
            vh_valid = ~np.isnan(post_vh_db) & ~np.isnan(pre_vh_db) & (post_vh_raw > 0) & (pre_vh_raw > 0)
            delta_vh = np.full_like(post_vh_db, np.nan)
            delta_vh[vh_valid] = post_vh_db[vh_valid] - pre_vh_db[vh_valid]

        # 4. Ingest OPERA DSWx categorical classification if available
        dswx_raw = None
        has_dswx = bool(dswx_path and os.path.exists(dswx_path))
        if has_dswx:
            dswx_raw, _ = geospatial_processor.read_geotiff(dswx_path)

        # =====================================================================
        # PHASE 1: COMMON VALID ANALYSIS MASK
        # =====================================================================
        # A pixel is in common_valid_mask ONLY if pre-RTC, post-RTC, and DSWx are
        # all valid, non-NoData, non-masked observations.
        pre_valid = ~np.isnan(pre_vv_db) & (pre_vv_raw > 0)
        post_valid = ~np.isnan(post_vv_db) & (post_vv_raw > 0)
        radar_valid = pre_valid & post_valid
        if has_vh and delta_vh is not None:
            radar_valid = radar_valid & ~np.isnan(delta_vh)

        if has_dswx and dswx_raw is not None:
            # OPERA DSWx-S1: 255 = Fill/NoData, 251 = Layover/shadow mask, 250 = HAND mask
            dswx_valid = (dswx_raw != 255) & (dswx_raw != 251) & (dswx_raw != 250)
            common_valid_mask = radar_valid & dswx_valid
        else:
            common_valid_mask = radar_valid

        # Compute Delta dB (Change detection) strictly within common_valid_mask
        delta_vv = np.full_like(post_vv_db, np.nan)
        delta_vv[common_valid_mask] = post_vv_db[common_valid_mask] - pre_vv_db[common_valid_mask]

        # =====================================================================
        # PHASE 2 & 3: COASTAL WATER & PERMANENT WATER EXCLUSION
        # =====================================================================
        # Detect ocean domain: contiguous open water touching marine scene boundaries
        ocean_mask = np.zeros_like(common_valid_mask, dtype=bool)
        if has_dswx and dswx_raw is not None:
            ocean_mask = self._extract_ocean_mask(dswx_raw, trans, profile["crs"])

        ocean_common_valid = common_valid_mask & ocean_mask
        inland_mask = common_valid_mask & (~ocean_mask)

        # Permanent water identification on inland domain:
        # Areas exhibiting water backscatter both pre-event and post-event (pre < -16 dB & post < -16 dB)
        permanent_water_mask = inland_mask & (pre_vv_db < -16.0) & (post_vv_db < -16.0)

        # =====================================================================
        # PHASE 4: DETECTION CLASSIFICATION ON INLAND ANALYSIS DOMAIN
        # =====================================================================
        # Class 1: Event-related Open Water (Specular Darkening on previously dry land)
        open_water_raw = (
            inland_mask &
            (pre_vv_db >= -16.0) &
            (delta_vv <= darkening_thresh_db) &
            (post_vv_db < -16.0)
        )

        # Class 2: Inundated Vegetation (Dihedral Double-Bounce Brightening)
        inundated_veg_raw = inland_mask & (delta_vv >= brightening_thresh_db)
        if delta_vh is not None:
            inundated_veg_raw = inundated_veg_raw & (delta_vh > 1.5)

        # Spatial Filtering (remove isolated speckle clusters < min_cluster_pixels)
        open_water_clean = self._filter_min_size(open_water_raw, min_cluster_pixels)
        inundated_veg_clean = self._filter_min_size(inundated_veg_raw, min_cluster_pixels)

        # OPERA DSWx classes within inland domain
        opera_inland_open = np.zeros_like(open_water_clean, dtype=bool)
        opera_inland_veg = np.zeros_like(open_water_clean, dtype=bool)
        if has_dswx and dswx_raw is not None:
            # OPERA DSWx: Class 1 = Open water, Class 2 = High-backscatter/partial water
            opera_inland_open = inland_mask & ((dswx_raw == 1) | (dswx_raw == 2))
            # OPERA DSWx: Class 3 = Inundated vegetation
            opera_inland_veg = inland_mask & (dswx_raw == 3)

        # Set-Theoretic Cross-Product Metrics
        agreement_mask = open_water_clean & opera_inland_open
        union_mask = open_water_clean | opera_inland_open
        parallax_only_mask = open_water_clean & (~opera_inland_open)
        opera_only_mask = opera_inland_open & (~open_water_clean)
        candidate_hidden_water_mask = inundated_veg_clean & (~opera_inland_open)
        unflooded_land_mask = (
            inland_mask &
            (~open_water_clean) &
            (~inundated_veg_clean) &
            (~opera_inland_open) &
            (~permanent_water_mask)
        )

        # =====================================================================
        # PHASE 5: QUANTITATIVE METRICS & SCIENTIFIC INVARIANTS
        # =====================================================================
        def to_km2(mask: np.ndarray) -> float:
            return round(int(np.count_nonzero(mask)) * pixel_area_km2, 2)

        total_common_valid_km2 = to_km2(common_valid_mask)
        ocean_km2 = to_km2(ocean_common_valid)
        inland_aoi_km2 = to_km2(inland_mask)
        permanent_water_km2 = to_km2(permanent_water_mask)
        open_water_km2 = to_km2(open_water_clean)
        inundated_veg_km2 = to_km2(inundated_veg_clean)
        opera_water_km2 = to_km2(opera_inland_open)
        opera_veg_km2 = to_km2(opera_inland_veg)
        agreement_km2 = to_km2(agreement_mask)
        union_km2 = to_km2(union_mask)
        parallax_only_km2 = to_km2(parallax_only_mask)
        opera_only_km2 = to_km2(opera_only_mask)
        candidate_hidden_km2 = to_km2(candidate_hidden_water_mask)
        unflooded_km2 = to_km2(unflooded_land_mask)

        # Strictly enforce scientific mathematical invariants
        if opera_water_km2 > inland_aoi_km2 + 0.05:
            raise ValueError(f"Scientific Invariant Violation: OPERA water ({opera_water_km2} km2) exceeds inland AOI ({inland_aoi_km2} km2)")
        if open_water_km2 > inland_aoi_km2 + 0.05:
            raise ValueError(f"Scientific Invariant Violation: PARALLAX open water ({open_water_km2} km2) exceeds inland AOI ({inland_aoi_km2} km2)")
        if agreement_km2 > open_water_km2 + 0.05 or agreement_km2 > opera_water_km2 + 0.05:
            raise ValueError(f"Scientific Invariant Violation: Intersection ({agreement_km2} km2) exceeds components ({open_water_km2}, {opera_water_km2})")
        if union_km2 > inland_aoi_km2 + 0.05:
            raise ValueError(f"Scientific Invariant Violation: Union ({union_km2} km2) exceeds inland AOI ({inland_aoi_km2} km2)")
        if abs(parallax_only_km2 - (open_water_km2 - agreement_km2)) > 0.05:
            raise ValueError(f"Scientific Invariant Violation: PARALLAX-only set difference mismatch")
        if abs(opera_only_km2 - (opera_water_km2 - agreement_km2)) > 0.05:
            raise ValueError(f"Scientific Invariant Violation: OPERA-only set difference mismatch")
        if abs(union_km2 - (open_water_km2 + opera_water_km2 - agreement_km2)) > 0.05:
            raise ValueError(f"Scientific Invariant Violation: Union area set theory mismatch")

        # Radar backscatter statistics on inland domain
        mean_delta_water = round(float(np.nanmean(delta_vv[open_water_clean])) if np.any(open_water_clean) else 0.0, 2)
        mean_delta_veg = round(float(np.nanmean(delta_vv[inundated_veg_clean])) if np.any(inundated_veg_clean) else 0.0, 2)
        baseline_mean_vv = round(float(np.nanmean(pre_vv_db[inland_mask])), 2)
        event_mean_vv = round(float(np.nanmean(post_vv_db[inland_mask])), 2)

        # =====================================================================
        # PHASE 6: EVIDENCE AMPLITUDE TIERS (DOCUMENTED DENOMINATORS)
        # =====================================================================
        # Heuristic radar change amplitude tiers on detected inland candidate pixels
        detected_candidates_mask = open_water_clean | inundated_veg_clean
        total_detected_pixels = int(np.count_nonzero(detected_candidates_mask)) or 1
        abs_delta_detected = np.abs(delta_vv[detected_candidates_mask])

        high_amp = int(np.count_nonzero(abs_delta_detected >= 6.0))
        med_amp = int(np.count_nonzero((abs_delta_detected >= 4.0) & (abs_delta_detected < 6.0)))
        low_amp = int(np.count_nonzero(abs_delta_detected < 4.0))

        confidence_summary = {
            "high_pct": round((high_amp / total_detected_pixels) * 100, 1),
            "medium_pct": round((med_amp / total_detected_pixels) * 100, 1),
            "low_pct": round((low_amp / total_detected_pixels) * 100, 1)
        }

        # =====================================================================
        # PHASE 7: EXPORT PRODUCTS (RASTERS, POLYGONS, COMMON MASKS)
        # =====================================================================
        output_dir = settings.PROCESSED_DIR / case_id
        output_dir.mkdir(parents=True, exist_ok=True)

        # 1. Product Classification Raster:
        # 0=Unflooded Matrix, 1=Confirmed Water Agreement, 2=Inundated Veg,
        # 3=OPERA Only Water, 4=PARALLAX Only Water, 5=Permanent Inland Water,
        # 6=Ocean Coastal Water, 255=NoData/Out of swath
        class_arr = np.full(post_vv_db.shape, 255, dtype=np.uint8)
        class_arr[common_valid_mask] = 0
        if np.any(ocean_common_valid):
            class_arr[ocean_common_valid] = 6
        if np.any(permanent_water_mask):
            class_arr[permanent_water_mask] = 5
        if np.any(opera_only_mask):
            class_arr[opera_only_mask] = 3
        if np.any(parallax_only_mask):
            class_arr[parallax_only_mask] = 4
        if np.any(agreement_mask):
            class_arr[agreement_mask] = 1
        if np.any(inundated_veg_clean):
            class_arr[inundated_veg_clean] = 2

        class_raster_path = str(output_dir / "classification.tif")
        class_profile = profile.copy()
        class_profile.update(dtype=rasterio.uint8, count=1, nodata=255)
        with rasterio.open(class_raster_path, "w", **class_profile) as dst:
            dst.write(class_arr, 1)

        # 2. Common Valid Observation Mask Raster (1=Valid, 0=NoData)
        cv_raster_path = str(output_dir / "common_valid_mask.tif")
        cv_arr = np.zeros(post_vv_db.shape, dtype=np.uint8)
        cv_arr[common_valid_mask] = 1
        cv_profile = profile.copy()
        cv_profile.update(dtype=rasterio.uint8, count=1, nodata=0)
        with rasterio.open(cv_raster_path, "w", **cv_profile) as dst:
            dst.write(cv_arr, 1)

        # 3. Export Candidate Polygons GeoJSON
        geojson_features = self._vectorize_candidates(
            class_arr, delta_vv, profile, pixel_area_km2
        )
        geojson_path = str(output_dir / "candidates.geojson")
        with open(geojson_path, "w") as f:
            json.dump({
                "type": "FeatureCollection",
                "features": geojson_features
            }, f)

        bounds_wgs84 = geospatial_processor.get_wgs84_bounds(profile)

        return {
            "analysis_id": f"ana_{case_id}",
            "case_id": case_id,
            "processing_version": "v2.0-scientific-integrity",
            "bounds_wgs84": bounds_wgs84,
            "center": [(bounds_wgs84[0] + bounds_wgs84[2])/2, (bounds_wgs84[1] + bounds_wgs84[3])/2],
            "total_aoi_km2": inland_aoi_km2,
            "common_valid_aoi_km2": total_common_valid_km2,
            "ocean_masked_km2": ocean_km2,
            "permanent_water_km2": permanent_water_km2,
            "open_water_km2": open_water_km2,
            "candidate_inundated_veg_km2": inundated_veg_km2,
            "opera_dswx_water_km2": opera_water_km2,
            "spatial_union_km2": union_km2,
            "parallax_only_km2": parallax_only_km2,
            "cross_sensor_breakdown": {
                "agreement_open_water_km2": agreement_km2,
                "candidate_hidden_water_km2": candidate_hidden_km2,
                "opera_only_water_km2": opera_only_km2,
                "unflooded_land_km2": max(0.0, unflooded_km2)
            },
            "radar_statistics": {
                "baseline_vv_mean_db": baseline_mean_vv,
                "event_vv_mean_db": event_mean_vv,
                "mean_db_change_open_water": mean_delta_water,
                "mean_db_change_vegetation": mean_delta_veg
            },
            "confidence_summary": confidence_summary,
            "layer_urls": {
                "geojson": f"/data/processed/{case_id}/candidates.geojson",
                "classification_tif": f"/data/processed/{case_id}/classification.tif",
                "common_valid_mask_tif": f"/data/processed/{case_id}/common_valid_mask.tif"
            }
        }

    def _extract_ocean_mask(
        self,
        dswx_raw: np.ndarray,
        transform: Any,
        crs: Any
    ) -> np.ndarray:
        """
        Delineates continuous coastal ocean water from inland water bodies.
        Extracts largest connected water component touching the marine scene border.
        """
        water = (dswx_raw == 1)
        labeled, num_features = ndimage.label(water)
        if num_features == 0:
            return np.zeros_like(dswx_raw, dtype=bool)

        counts = np.bincount(labeled.ravel())
        if len(counts) <= 1:
            return np.zeros_like(dswx_raw, dtype=bool)

        counts[0] = 0
        largest_label = np.argmax(counts)
        largest_count = counts[largest_label]
        px_km2 = (abs(transform.a) * abs(transform.e)) / 1e6
        largest_area_km2 = largest_count * px_km2

        # Verify touch with raster boundaries
        rows, cols = np.where(labeled == largest_label)
        touches_edge = (
            cols.min() == 0 or cols.max() == dswx_raw.shape[1] - 1 or
            rows.min() == 0 or rows.max() == dswx_raw.shape[0] - 1
        )

        # Marine open ocean criterion: touches border and exceeds 50 km2
        if touches_edge and largest_area_km2 > 50.0:
            return (labeled == largest_label)
        return np.zeros_like(dswx_raw, dtype=bool)

    def _filter_min_size(self, binary_mask: np.ndarray, min_size: int) -> np.ndarray:
        """Removes isolated speckle clusters smaller than min_size pixels."""
        labeled, num_features = ndimage.label(binary_mask)
        if num_features == 0:
            return binary_mask
        counts = np.bincount(labeled.ravel())
        remove_mask = counts < min_size
        remove_mask[0] = False
        remove_pixels = remove_mask[labeled]
        filtered = binary_mask.copy()
        filtered[remove_pixels] = False
        return filtered

    def _vectorize_candidates(
        self,
        class_arr: np.ndarray,
        delta_vv: np.ndarray,
        profile: Dict[str, Any],
        pixel_area_km2: float
    ) -> list:
        """Converts flood and inundated vegetation candidate clusters into GeoJSON polygons."""
        candidate_mask = (class_arr == 1) | (class_arr == 2) | (class_arr == 4)
        if not np.any(candidate_mask):
            return []

        src_crs = profile.get("crs")
        transformer = None
        if src_crs:
            try:
                dst_crs = pyproj.CRS("EPSG:4326")
                if pyproj.CRS(src_crs) != dst_crs:
                    transformer = Transformer.from_crs(src_crs, dst_crs, always_xy=True)
            except Exception as e:
                logger.warning(f"Could not build CRS transformer from {src_crs} to EPSG:4326: {e}")

        features = []
        for geom_dict, val in shapes(class_arr.astype(np.int32), mask=candidate_mask, transform=profile["transform"]):
            poly = shape(geom_dict)
            area_m2 = poly.area
            if area_m2 < (pixel_area_km2 * 1e6 * 4): # Filter isolated 1-2 pixel speckle noise
                continue

            # Sub-pixel topological contour smoothing (eliminates 30m grid stair-stepping)
            try:
                poly_smoothed = poly.buffer(8.0, resolution=4).buffer(-8.0, resolution=4).simplify(6.0, preserve_topology=True)
                if poly_smoothed.is_empty or not poly_smoothed.is_valid:
                    poly_smoothed = poly.simplify(10.0, preserve_topology=True)
                if poly_smoothed.is_empty or not poly_smoothed.is_valid:
                    poly_smoothed = poly
            except Exception:
                poly_smoothed = poly

            if transformer:
                try:
                    poly_wgs84 = shapely_transform(transformer.transform, poly_smoothed)
                except Exception:
                    poly_wgs84 = poly_smoothed
            else:
                poly_wgs84 = poly_smoothed

            if val == 1:
                cls_name = "Confirmed Open Water (Cross-Product Agreement)"
                mechanism = "Surface specular reflection attenuation confirmed by OPERA"
                context = "Agreement with NASA OPERA DSWx surface water"
            elif val == 2:
                cls_name = "Candidate Inundated Vegetation (Double-Bounce)"
                mechanism = "Canopy-water dihedral double-bounce backscatter enhancement"
                context = "Complementary radar detection (potential optical/DSWx canopy penetration)"
            else:
                cls_name = "PARALLAX-Only Candidate Open Water"
                mechanism = "Surface specular reflection attenuation"
                context = "Radar backscatter drop without corresponding OPERA water classification"

            features.append({
                "type": "Feature",
                "geometry": mapping(poly_wgs84),
                "properties": {
                    "class_id": int(val),
                    "class_name": cls_name,
                    "evidence_tier": "High backscatter amplitude" if val in (1, 2) else "Moderate backscatter amplitude",
                    "detection_mechanism": mechanism,
                    "cross_product_context": context,
                    "area_ha": round((area_m2 / 10000), 2),
                    "scientific_label": "Candidate Inundation (Unverified ground-truth)"
                }
            })

            if len(features) >= 150: # Cap for map rendering performance
                break

        return features

detection_engine = DetectionEngine()
