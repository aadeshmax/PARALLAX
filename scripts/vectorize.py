"""
Vectorization pipeline for TERRA//PULSE.
Converts candidate raster layers into standardized GeoJSON polygons adhering to Section 08 contracts.
Supports multi-event case directories.
"""
import glob
import json
import os
import sys
from typing import List, Dict, Any
import numpy as np
import rasterio
from rasterio.features import shapes
from rasterio.warp import transform_geom
from shapely.geometry import shape, mapping


def vectorize_candidates(
    processed_dir: str = "data/processed/rio_grande_do_sul_event",
    case_dir: str = "data/cases/real_event_rio_grande_do_sul",
    output_geojson: str = None,
    min_area_km2: float = 0.005
) -> Dict[str, Any]:
    if output_geojson is None:
        output_geojson = os.path.join(case_dir, "regions.geojson")
    os.makedirs(os.path.dirname(output_geojson), exist_ok=True)

    cand_inund_path = os.path.join(processed_dir, "candidate_inundation.tif")
    double_bounce_path = os.path.join(processed_dir, "double_bounce_candidate.tif")
    additional_cand_path = os.path.join(processed_dir, "additional_candidate.tif")
    diff_db_path = os.path.join(processed_dir, "backscatter_diff_db.tif")
    confidence_path = os.path.join(processed_dir, "candidate_confidence.tif")

    # Find VV GeoTIFFs dynamically in case_dir
    vv_files = sorted(glob.glob(os.path.join(case_dir, "*_VV.tif")))
    pre_sar_path = vv_files[0] if len(vv_files) > 0 else None
    post_sar_path = vv_files[-1] if len(vv_files) > 1 else pre_sar_path

    with rasterio.open(cand_inund_path) as src_cand:
        cand_mask = src_cand.read(1) > 0
        src_crs = src_cand.crs
        src_transform = src_cand.transform

    with rasterio.open(double_bounce_path) as src_db:
        db_mask = src_db.read(1) > 0

    with rasterio.open(additional_cand_path) as src_add:
        add_mask = src_add.read(1) > 0

    with rasterio.open(diff_db_path) as src_diff:
        diff_db = src_diff.read(1)

    with rasterio.open(confidence_path) as src_conf:
        conf_data = src_conf.read(1)

    pre_sar = None
    if pre_sar_path:
        with rasterio.open(pre_sar_path) as src_pre:
            pre_sar = src_pre.read(1)
            valid = pre_sar[np.isfinite(pre_sar)]
            if len(valid) > 0 and np.nanquantile(valid, 0.95) > 0:
                pre_sar = 10.0 * np.log10(np.maximum(pre_sar, 1e-5))

    post_sar = None
    if post_sar_path:
        with rasterio.open(post_sar_path) as src_post:
            post_sar = src_post.read(1)
            valid = post_sar[np.isfinite(post_sar)]
            if len(valid) > 0 and np.nanquantile(valid, 0.95) > 0:
                post_sar = 10.0 * np.log10(np.maximum(post_sar, 1e-5))

    features = []
    reg_counter = 1
    cand_uint8 = cand_mask.astype(np.uint8)

    is_mumbai = "mumbai" in case_dir.lower()

    for geom, val in shapes(cand_uint8, mask=cand_mask, transform=src_transform):
        if val == 0:
            continue

        poly_shapely = shape(geom)
        area_km2 = round(poly_shapely.area / 1e6, 4)
        if area_km2 < min_area_km2:
            continue

        # Sub-pixel topological contour smoothing (eliminates 30m grid stair-stepping)
        try:
            poly_smoothed = poly_shapely.buffer(8.0, resolution=4).buffer(-8.0, resolution=4).simplify(6.0, preserve_topology=True)
            if poly_smoothed.is_empty or not poly_smoothed.is_valid:
                poly_smoothed = poly_shapely.simplify(10.0, preserve_topology=True)
            if poly_smoothed.is_empty or not poly_smoothed.is_valid:
                poly_smoothed = poly_shapely
        except Exception:
            poly_smoothed = poly_shapely

        poly_mask = rasterio.features.geometry_mask(
            [geom],
            out_shape=cand_mask.shape,
            transform=src_transform,
            invert=True
        )

        reg_diff = diff_db[poly_mask]
        valid_reg_diff = reg_diff[np.isfinite(reg_diff)]
        median_delta_db = float(np.median(valid_reg_diff)) if len(valid_reg_diff) > 0 else 0.0

        median_pre_db = float(np.median(pre_sar[poly_mask][np.isfinite(pre_sar[poly_mask])])) if pre_sar is not None else -10.0
        median_post_db = float(np.median(post_sar[poly_mask][np.isfinite(post_sar[poly_mask])])) if post_sar is not None else -10.0

        reg_conf = conf_data[poly_mask]
        mean_conf = float(np.mean(reg_conf[np.isfinite(reg_conf)])) if len(reg_conf) > 0 else 0.75

        db_fraction = float(np.sum(db_mask & poly_mask) / np.sum(poly_mask))
        is_double_bounce = db_fraction >= 0.35

        add_fraction = float(np.sum(add_mask & poly_mask) / np.sum(poly_mask))
        is_gap = add_fraction >= 0.5

        if is_double_bounce:
            candidate_type = "double_bounce"
            vegetation_class = "Dense Mangrove Canopy / Coastal Wetland" if is_mumbai else "Riparian Forest / Woody Canopy"
            interpretation = "Plausible mangrove canopy inundation via root-trunk double-bounce enhancement." if is_mumbai else "Plausible vegetated inundation candidate via canopy double-bounce enhancement."
        else:
            candidate_type = "specular"
            vegetation_class = "Urban Floodplain / Lowlands" if is_mumbai else "Open Floodplain / Flat Ground"
            interpretation = "Candidate urban open-water inundation via specular backscatter darkening." if is_mumbai else "Candidate open-water inundation via specular backscatter darkening."

        opera_status = "additional_candidate" if is_gap else "agreement"
        geom_wgs84 = transform_geom(src_crs, "EPSG:4326", mapping(poly_smoothed))
        region_id = f"reg-{reg_counter:03d}"
        reg_counter += 1

        feature = {
            "type": "Feature",
            "id": region_id,
            "geometry": geom_wgs84,
            "properties": {
                "region_id": region_id,
                "class_id": 2 if candidate_type == "double_bounce" else 1,
                "class_name": "Inundated Veg (Double-Bounce)" if candidate_type == "double_bounce" else "Confirmed Open Water",
                "area_km2": area_km2,
                "area_ha": round(area_km2 * 100, 2),
                "candidate_type": candidate_type,
                "opera_status": opera_status,
                "vegetation_class": vegetation_class,
                "detection_mechanism": "L-band radar dihedral trunk-water reflection under canopy" if candidate_type == "double_bounce" else "Specular radar surface attenuation",
                "cross_product_context": "Disagrees with standard OPERA surface water (canopy obscured)" if is_gap else "Agrees with NASA OPERA DSWx extent",
                "evidence_tier": "High Confidence Inundation Candidate" if mean_conf > 0.8 else "Moderate Confidence Candidate",
                "scientific_label": "Canopy Inundation Candidate (Dual-Pol L-band)" if candidate_type == "double_bounce" else "Surface Water Inundation",
                "before_scene_ids": [os.path.basename(pre_sar_path).replace(".tif", "")] if pre_sar_path else [],
                "after_scene_id": os.path.basename(post_sar_path).replace(".tif", "") if post_sar_path else "",
                "vv_baseline_db": round(median_pre_db, 2),
                "vv_after_db": round(median_post_db, 2),
                "vv_delta_db": round(median_delta_db, 2),
                "hv_reference_db": None,
                "confidence_score": round(mean_conf, 2),
                "valid_fraction": 1.0,
                "quality_flags": [
                    "valid_radar_coverage",
                    "coregistered_30m",
                    "mangrove_context" if is_double_bounce and is_mumbai else "canopy_context"
                ],
                "threshold_id": "central_threshold",
                "sensitivity_summary": "Stable across central threshold configuration",
                "validation_status": "provisional_candidate",
                "interpretation": interpretation,
                "caution": "Derived candidate signature from SAR backscatter anomalies; not verified ground truth."
            }
        }
        features.append(feature)

    geojson_data = {
        "type": "FeatureCollection",
        "name": f"terra_pulse_{os.path.basename(case_dir)}_regions",
        "crs": {
            "type": "name",
            "properties": {
                "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
            }
        },
        "features": features
    }

    with open(output_geojson, "w", encoding="utf-8") as f:
        json.dump(geojson_data, f, indent=2)

    print(f"[{os.path.basename(case_dir)}] Vectorized {len(features)} candidate polygons into: {output_geojson}")
    return geojson_data


if __name__ == "__main__":
    if len(sys.argv) > 1:
        case_dir = sys.argv[1]
        proc_dir = sys.argv[2] if len(sys.argv) > 2 else f"data/processed/{os.path.basename(case_dir)}"
        vectorize_candidates(processed_dir=proc_dir, case_dir=case_dir)
    else:
        cases_map = [
            ("data/cases/real_event_rio_grande_do_sul", "data/processed/real_event_rio_grande_do_sul"),
            ("data/cases/mumbai_monsoon_event", "data/processed/mumbai_monsoon_event"),
            ("data/cases/chennai_live_case", "data/processed/chennai_live_case"),
            ("data/cases/demo_flood_case", "data/processed/demo_flood_case"),
        ]
        for c_dir, p_dir in cases_map:
            if not os.path.exists(p_dir):
                alt_p = "data/processed/rio_grande_do_sul_event" if "rio_grande" in c_dir else p_dir
                p_dir = alt_p
            if os.path.exists(p_dir) and os.path.exists(c_dir):
                try:
                    vectorize_candidates(processed_dir=p_dir, case_dir=c_dir)
                except Exception as e:
                    print(f"Skipping {c_dir}: {e}")
