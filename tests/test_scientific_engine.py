import os
import pytest
import numpy as np
from app.services.detection_engine import detection_engine

def test_scientific_detection_engine_execution():
    """
    Fulfills Phase G & Phase J:
    Validates scientific radar backscatter change detection,
    inundated vegetation double-bounce, specular open-water attenuation,
    and cross-sensor divergence metrics.
    """
    case_dir = os.path.abspath("data/cases/demo_flood_case")
    pre_vv = os.path.join(case_dir, "pre_rtc_vv.tif")
    post_vv = os.path.join(case_dir, "post_rtc_vv.tif")
    pre_vh = os.path.join(case_dir, "pre_rtc_vh.tif")
    post_vh = os.path.join(case_dir, "post_rtc_vh.tif")
    dswx = os.path.join(case_dir, "opera_dswx_aligned.tif")

    res = detection_engine.analyze_scene(
        pre_vv_path=pre_vv,
        post_vv_path=post_vv,
        pre_vh_path=pre_vh,
        post_vh_path=post_vh,
        dswx_path=dswx,
        darkening_thresh_db=-3.0,
        brightening_thresh_db=2.5,
        case_id="demo_flood_case"
    )

    # Scientific constraints validation (Phase J)
    assert res["total_aoi_km2"] > 0
    assert res["open_water_km2"] >= 0
    assert res["candidate_inundated_veg_km2"] >= 0
    assert res["opera_dswx_water_km2"] >= 0

    breakdown = res["cross_sensor_breakdown"]
    assert breakdown["agreement_open_water_km2"] >= 0
    assert breakdown["candidate_hidden_water_km2"] >= 0
    assert breakdown["opera_only_water_km2"] >= 0

    # Overlap cannot exceed either mask
    assert breakdown["agreement_open_water_km2"] <= res["open_water_km2"] + 0.1
    assert breakdown["agreement_open_water_km2"] <= res["opera_dswx_water_km2"] + 0.1

    # Confidence sum bounds
    conf = res["confidence_summary"]
    total_pct = conf["high_pct"] + conf["medium_pct"] + conf["low_pct"]
    assert 99.0 <= total_pct <= 101.0

    # Radar statistics
    stats = res["radar_statistics"]
    assert "mean_db_change_open_water" in stats
    assert "mean_db_change_vegetation" in stats
    # Water should show negative change or zero
    if res["open_water_km2"] > 0:
        assert stats["mean_db_change_open_water"] <= -3.0
    # Veg double bounce should show positive change
    if res["candidate_inundated_veg_km2"] > 0:
        assert stats["mean_db_change_vegetation"] >= 2.5

def test_chennai_scientific_invariants_and_integrity():
    """
    Validates Phase 4 & Phase 5 scientific invariants for real Chennai live data:
    1. OPERA water area cannot exceed common valid area.
    2. PARALLAX water area cannot exceed common valid area.
    3. Intersection cannot exceed either component.
    4. Union cannot exceed common valid area.
    5. PARALLAX-only area equals open_water - agreement.
    6. OPERA-only area equals opera_water - agreement.
    7. Union area equals open_water + opera_water - agreement.
    8. Candidate hidden gap cannot exceed total candidate inundated vegetation.
    """
    case_dir = os.path.abspath("data/cases/chennai_live_case")
    assert os.path.exists(case_dir)

    res = detection_engine.analyze_scene(
        pre_vv_path=os.path.join(case_dir, "pre_rtc_vv.tif"),
        post_vv_path=os.path.join(case_dir, "post_rtc_vv.tif"),
        pre_vh_path=os.path.join(case_dir, "pre_rtc_vh.tif"),
        post_vh_path=os.path.join(case_dir, "post_rtc_vh.tif"),
        dswx_path=os.path.join(case_dir, "opera_dswx_aligned.tif"),
        case_id="chennai_live_case"
    )

    aoi = res["total_aoi_km2"]
    cv_aoi = res["common_valid_aoi_km2"]
    ocean = res["ocean_masked_km2"]
    open_w = res["open_water_km2"]
    inund_v = res["candidate_inundated_veg_km2"]
    opera_w = res["opera_dswx_water_km2"]
    union_w = res["spatial_union_km2"]
    p_only = res["parallax_only_km2"]

    breakdown = res["cross_sensor_breakdown"]
    agree = breakdown["agreement_open_water_km2"]
    o_only = breakdown["opera_only_water_km2"]
    gap = breakdown["candidate_hidden_water_km2"]

    # Invariant 1: OPERA water cannot exceed analysis AOI
    assert opera_w <= aoi + 0.05, f"OPERA water {opera_w} exceeds AOI {aoi}"
    # Invariant 2: PARALLAX water cannot exceed analysis AOI
    assert open_w <= aoi + 0.05, f"PARALLAX water {open_w} exceeds AOI {aoi}"
    # Invariant 3: Intersection cannot exceed either component
    assert agree <= open_w + 0.05, f"Agreement {agree} exceeds PARALLAX water {open_w}"
    assert agree <= opera_w + 0.05, f"Agreement {agree} exceeds OPERA water {opera_w}"
    # Invariant 4: Union cannot exceed analysis AOI
    assert union_w <= aoi + 0.05, f"Union {union_w} exceeds AOI {aoi}"
    # Invariant 5: Set difference consistency
    assert abs(p_only - (open_w - agree)) <= 0.05
    assert abs(o_only - (opera_w - agree)) <= 0.05
    # Invariant 6: Union area consistency
    assert abs(union_w - (open_w + opera_w - agree)) <= 0.05
    # Invariant 7: Gap cannot exceed inundated vegetation
    assert gap <= inund_v + 0.05
    # Invariant 8: Common valid area decomposition
    assert abs(cv_aoi - (aoi + ocean)) <= 0.2

def test_classification_raster_and_common_mask_preservation():
    """
    Verifies that output rasters preserve documented categorical classes
    and NoData exclusions.
    """
    case_dir = os.path.abspath("data/processed/chennai_live_case")
    class_tif = os.path.join(case_dir, "classification.tif")
    cv_tif = os.path.join(case_dir, "common_valid_mask.tif")

    import rasterio
    assert os.path.exists(class_tif)
    with rasterio.open(class_tif) as src:
        d = src.read(1)
        # Unique classes must only be from documented set:
        # 0=Unflooded, 1=Agreement, 2=Inundated Veg, 3=OPERA Only, 4=PARALLAX Only,
        # 5=Permanent Inland Water, 6=Ocean Coastal Water, 255=NoData
        valid_classes = {0, 1, 2, 3, 4, 5, 6, 255}
        unique_classes = set(int(v) for v in np.unique(d))
        assert unique_classes.issubset(valid_classes)
        # Ensure NoData is defined
        assert src.nodata == 255

    assert os.path.exists(cv_tif)
    with rasterio.open(cv_tif) as src:
        d = src.read(1)
        assert set(int(v) for v in np.unique(d)).issubset({0, 1})

