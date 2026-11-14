"""
Geospatial area metrics and cross-sensor agreement module.
Calculates area metrics using equal-area projections or geodesic corrections.
Evaluates agreement (IoU, overlap, differences) against baseline products (e.g. OPERA DSWx)
without misrepresenting agreement as detection accuracy.
"""
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any, Tuple
import numpy as np
import pyproj
from pyproj import CRS, Transformer
from rasterio.transform import Affine


@dataclass
class ComparisonMetrics:
    total_valid_area_sqkm: float
    baseline_water_area_sqkm: float
    candidate_inundation_area_sqkm: float
    specular_candidate_area_sqkm: float
    double_bounce_candidate_area_sqkm: float
    overlap_area_sqkm: float
    additional_candidate_area_sqkm: float
    baseline_only_area_sqkm: float
    # Sensor agreement ratio: Overlap / (Baseline | Candidate)
    iou_agreement: float
    # Additional candidate proportion: Additional / Candidate
    additional_candidate_ratio: float
    # Explanatory scientific notes
    metrics_notes: str


def compute_pixel_areas_sqkm(
    transform: tuple,
    crs_str: str,
    shape: Tuple[int, int]
) -> np.ndarray:
    """
    Computes true ground surface area (in square kilometers) for each pixel.
    - If CRS is projected in meters (e.g., UTM, Web Mercator, Equal Area), calculates direct area.
    - If CRS is geographic (degrees lon/lat), calculates geodesic trapezoidal area per row.
    """
    height, width = shape
    aff = Affine(*transform[:6])
    crs = CRS.from_user_input(crs_str)

    if crs.is_projected:
        # Get pixel resolution in projected units (usually meters)
        res_x = abs(aff.a)
        res_y = abs(aff.e)
        pixel_area_m2 = res_x * res_y
        pixel_area_sqkm = pixel_area_m2 / 1e6
        return np.full(shape, pixel_area_sqkm, dtype=np.float64)
    else:
        # Geographic CRS (WGS84 EPSG:4326, etc.): compute geodesic area row by row
        geod = pyproj.Geod(ellps="WGS84")
        areas = np.zeros(shape, dtype=np.float64)
        
        # Latitude for each row
        rows = np.arange(height)
        # Pixel coordinates to lat/lon
        # top and bottom bounds of each row
        for r in range(height):
            lon0, lat0 = aff * (0, r)
            lon1, lat1 = aff * (1, r + 1)
            # Area of single cell (lon0, lat0) to (lon1, lat1)
            # using Geod.geometry_area_perimeter
            lons = [lon0, lon1, lon1, lon0, lon0]
            lats = [lat0, lat0, lat1, lat1, lat0]
            area_m2, _ = geod.polygon_area_perimeter(lons, lats)
            row_area_sqkm = abs(area_m2) / 1e6
            areas[r, :] = row_area_sqkm
        return areas


def calculate_water_comparison_metrics(
    candidate_mask: np.ndarray,
    specular_mask: np.ndarray,
    double_bounce_mask: np.ndarray,
    baseline_water_mask: np.ndarray,
    common_valid_mask: np.ndarray,
    transform: tuple,
    crs_str: str
) -> Tuple[ComparisonMetrics, Dict[str, np.ndarray]]:
    """
    Computes rigorous pixel-based area statistics and cross-sensor agreement.
    All calculations strictly constrained to common_valid_mask.
    
    Returns (metrics, spatial_masks_dict):
      - overlap_mask: pixels identified by both baseline and candidate
      - additional_candidate_mask: pixels flagged as candidate inundation but NOT in baseline
      - baseline_only_mask: pixels flagged in baseline but NOT in candidate
    """
    pixel_areas_sqkm = compute_pixel_areas_sqkm(transform, crs_str, candidate_mask.shape)

    # Restrict to common valid observation region
    cand_valid = candidate_mask & common_valid_mask
    spec_valid = specular_mask & common_valid_mask
    db_valid = double_bounce_mask & common_valid_mask
    base_valid = baseline_water_mask & common_valid_mask

    overlap_mask = cand_valid & base_valid
    additional_cand_mask = cand_valid & (~base_valid)
    baseline_only_mask = base_valid & (~cand_valid)
    union_mask = cand_valid | base_valid

    # Area integration
    valid_area = float(np.sum(pixel_areas_sqkm[common_valid_mask]))
    cand_area = float(np.sum(pixel_areas_sqkm[cand_valid]))
    spec_area = float(np.sum(pixel_areas_sqkm[spec_valid]))
    db_area = float(np.sum(pixel_areas_sqkm[db_valid]))
    base_area = float(np.sum(pixel_areas_sqkm[base_valid]))
    overlap_area = float(np.sum(pixel_areas_sqkm[overlap_mask]))
    add_cand_area = float(np.sum(pixel_areas_sqkm[additional_cand_mask]))
    base_only_area = float(np.sum(pixel_areas_sqkm[baseline_only_mask]))
    union_area = float(np.sum(pixel_areas_sqkm[union_mask]))

    iou_agreement = (overlap_area / union_area) if union_area > 0 else 0.0
    add_cand_ratio = (add_cand_area / cand_area) if cand_area > 0 else 0.0

    notes = (
        "IoU is reported strictly as cross-sensor agreement between SAR candidate inundation "
        "and OPERA DSWx baseline, NOT detection accuracy or ground truth. "
        "Independent in-situ validation labels are required for precision/recall/F1 metrics."
    )

    metrics = ComparisonMetrics(
        total_valid_area_sqkm=round(valid_area, 4),
        baseline_water_area_sqkm=round(base_area, 4),
        candidate_inundation_area_sqkm=round(cand_area, 4),
        specular_candidate_area_sqkm=round(spec_area, 4),
        double_bounce_candidate_area_sqkm=round(db_area, 4),
        overlap_area_sqkm=round(overlap_area, 4),
        additional_candidate_area_sqkm=round(add_cand_area, 4),
        baseline_only_area_sqkm=round(base_only_area, 4),
        iou_agreement=round(iou_agreement, 4),
        additional_candidate_ratio=round(add_cand_ratio, 4),
        metrics_notes=notes
    )

    layers = {
        "candidate_inundation": cand_valid.astype(np.uint8),
        "specular_candidate": spec_valid.astype(np.uint8),
        "double_bounce_candidate": db_valid.astype(np.uint8),
        "baseline_water": base_valid.astype(np.uint8),
        "overlap": overlap_mask.astype(np.uint8),
        "additional_candidate": additional_cand_mask.astype(np.uint8),
        "baseline_only": baseline_only_mask.astype(np.uint8),
        "common_valid": common_valid_mask.astype(np.uint8)
    }

    return metrics, layers
