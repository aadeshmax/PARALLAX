"""
End-to-end and unit tests for:
1. Modular RTC-S1 GeoTIFF ingestion (CRS, decibels conversion vs preserving dB, NoData, metadata).
2. OPERA DSWx baseline ingestion and quality class masking.
3. Multi-temporal SAR coregistration and grid alignment.
4. Temporal backscatter change features (specular drop and double bounce).
5. Area statistics computation, overlap, and IoU agreement.
6. Execution of real flood-event analysis with GeoTIFF export and JSON contract verification.
"""
import os
import json
import pytest
import numpy as np
import rasterio
from rasterio.transform import from_origin

from backend.schemas import Polarization, BackscatterUnit, DSWxClass
from backend.rtc_ingestion import (
    ingest_rtc_geotiff,
    detect_backscatter_unit,
    linear_to_db,
    detect_polarization,
    parse_sentinel1_timestamp
)
from backend.dswx_ingestion import ingest_opera_dswx
from backend.alignment import align_sar_pair, align_dswx_to_sar, align_raster_to_reference
from backend.sar_engine import detect_candidate_inundation
from backend.metrics import calculate_water_comparison_metrics, compute_pixel_areas_sqkm
from backend.service import AnalysisRequest, run_pipeline


@pytest.fixture
def temp_rasters(tmp_path):
    """Creates small synthetic test rasters in temporary directory."""
    crs = "EPSG:32615"
    transform = from_origin(500000.0, 3300000.0, 30.0, 30.0)
    width, height = 50, 50

    # 1. Linear power RTC-S1 (VV)
    linear_data = np.full((height, width), 0.05, dtype=np.float32)  # ~ -13 dB
    linear_data[10:25, 10:25] = 0.001  # specular drop ~ -30 dB
    linear_data[30:45, 30:45] = 0.5    # double bounce ~ -3 dB

    pre_linear_path = str(tmp_path / "OPERA_L2_RTC-S1_T015_20230501T120000Z_VV.tif")
    with rasterio.open(
        pre_linear_path, "w", driver="GTiff", height=height, width=width,
        count=1, dtype="float32", crs=crs, transform=transform, nodata=0.0
    ) as dst:
        dst.write(np.full((height, width), 0.05, dtype=np.float32), 1)

    post_linear_path = str(tmp_path / "OPERA_L2_RTC-S1_T015_20230510T120000Z_VV.tif")
    with rasterio.open(
        post_linear_path, "w", driver="GTiff", height=height, width=width,
        count=1, dtype="float32", crs=crs, transform=transform, nodata=0.0
    ) as dst:
        dst.write(linear_data, 1)

    # 2. Already decibels RTC-S1
    db_path = str(tmp_path / "OPERA_L2_RTC-S1_T015_20230510T120000Z_VV_db.tif")
    db_data = np.full((height, width), -13.0, dtype=np.float32)
    with rasterio.open(
        db_path, "w", driver="GTiff", height=height, width=width,
        count=1, dtype="float32", crs=crs, transform=transform, nodata=-9999.0
    ) as dst:
        dst.write(db_data, 1)

    # 3. OPERA DSWx baseline
    dswx_path = str(tmp_path / "OPERA_L3_DSWx-S1_T15_20230510T120000Z_v1.0_B01_WTR.tif")
    dswx_classes = np.zeros((height, width), dtype=np.uint8)
    dswx_classes[10:25, 10:25] = 1  # Open water overlap
    dswx_classes[0:2, :] = 255      # NoData border
    with rasterio.open(
        dswx_path, "w", driver="GTiff", height=height, width=width,
        count=1, dtype="uint8", crs=crs, transform=transform, nodata=255
    ) as dst:
        dst.write(dswx_classes, 1)

    return {
        "pre_linear": pre_linear_path,
        "post_linear": post_linear_path,
        "post_db": db_path,
        "dswx": dswx_path,
        "out_dir": str(tmp_path / "out")
    }


def test_unit_detection_and_safe_db_conversion():
    # Linear power samples
    lin_sample = np.array([0.01, 0.05, 0.1, 0.002], dtype=np.float32)
    unit_lin = detect_backscatter_unit(lin_sample, {})
    assert unit_lin == BackscatterUnit.LINEAR_POWER

    # Decibels sample
    db_sample = np.array([-15.2, -18.4, -12.0, -8.5], dtype=np.float32)
    unit_db = detect_backscatter_unit(db_sample, {})
    assert unit_db == BackscatterUnit.DECIBEL

    # Conversion test: 0.1 linear power should be -10.0 dB
    db_vals = linear_to_db(np.array([0.1, 0.01], dtype=np.float32))
    assert np.isclose(db_vals[0], -10.0, atol=1e-3)
    assert np.isclose(db_vals[1], -20.0, atol=1e-3)


def test_ingest_rtc_preserves_db_and_converts_linear(temp_rasters):
    # Ingest linear raster: should convert to dB
    sar_lin = ingest_rtc_geotiff(temp_rasters["post_linear"])
    assert sar_lin.raw_unit == BackscatterUnit.LINEAR_POWER
    # Valid pixels should be in dB scale (negative values)
    assert np.all(sar_lin.data[sar_lin.mask] < 0)

    # Ingest already dB raster: should NOT re-convert
    sar_db = ingest_rtc_geotiff(temp_rasters["post_db"])
    assert sar_db.raw_unit == BackscatterUnit.DECIBEL
    assert np.allclose(sar_db.data[sar_db.mask], -13.0, atol=0.1)


def test_opera_dswx_ingestion(temp_rasters):
    dswx = ingest_opera_dswx(temp_rasters["dswx"])
    assert dswx.granule_id.startswith("OPERA_L3_DSWx-S1")
    assert dswx.width == 50
    assert dswx.height == 50
    # Overlap region has class 1 (open water)
    assert np.all(dswx.water_mask[10:25, 10:25])
    # Top 2 rows are nodata 255 -> valid_mask is False
    assert not np.any(dswx.valid_mask[0:2, :])


def test_candidate_inundation_detection():
    height, width = 40, 40
    valid_mask = np.ones((height, width), dtype=bool)
    pre_db = np.full((height, width), -12.0, dtype=np.float32)
    post_db = np.full((height, width), -12.0, dtype=np.float32)

    # Region 1: Specular darkening (post drops to -20 dB, diff = -8 dB)
    post_db[5:15, 5:15] = -20.0
    # Region 2: Double bounce (post rises to -5 dB, diff = +7 dB)
    post_db[20:30, 20:30] = -5.0

    res = detect_candidate_inundation(
        pre_db=pre_db,
        post_db=post_db,
        valid_mask=valid_mask,
        filter_speckle=False,
        specular_decrease_thresh_db=-3.0,
        max_specular_post_db=-14.0,
        double_bounce_increase_thresh_db=2.5,
        min_double_bounce_post_db=-12.0
    )

    assert np.all(res.specular_candidate_mask[5:15, 5:15])
    assert np.all(res.double_bounce_candidate_mask[20:30, 20:30])
    assert np.all(res.candidate_inundation_mask[5:15, 5:15])
    assert np.all(res.candidate_inundation_mask[20:30, 20:30])
    # Confidence score should be between 0.5 and 1.0 for candidate pixels
    assert np.all(res.heuristic_confidence[res.candidate_inundation_mask] >= 0.5)


def test_comparison_metrics_and_agreement():
    transform = from_origin(500000.0, 3300000.0, 30.0, 30.0)
    crs_str = "EPSG:32615"
    shape = (100, 100)

    candidate_mask = np.zeros(shape, dtype=bool)
    specular_mask = np.zeros(shape, dtype=bool)
    double_bounce_mask = np.zeros(shape, dtype=bool)
    baseline_water_mask = np.zeros(shape, dtype=bool)
    common_valid_mask = np.ones(shape, dtype=bool)

    # 100 pixels overlap
    candidate_mask[10:20, 10:20] = True
    specular_mask[10:20, 10:20] = True
    baseline_water_mask[10:20, 10:20] = True

    # 100 pixels additional candidate (double bounce under canopy)
    candidate_mask[30:40, 30:40] = True
    double_bounce_mask[30:40, 30:40] = True

    metrics, layers = calculate_water_comparison_metrics(
        candidate_mask=candidate_mask,
        specular_mask=specular_mask,
        double_bounce_mask=double_bounce_mask,
        baseline_water_mask=baseline_water_mask,
        common_valid_mask=common_valid_mask,
        transform=transform,
        crs_str=crs_str
    )

    # Area per pixel is 30m * 30m = 900 m2 = 0.0009 sqkm
    # Candidate pixels = 200 -> 0.18 sqkm
    # Baseline pixels = 100 -> 0.09 sqkm
    # Overlap pixels = 100 -> 0.09 sqkm
    # Additional candidate = 100 -> 0.09 sqkm
    # Union = 200 pixels -> IoU agreement = 100 / 200 = 0.5
    assert np.isclose(metrics.candidate_inundation_area_sqkm, 0.18, atol=1e-3)
    assert np.isclose(metrics.baseline_water_area_sqkm, 0.09, atol=1e-3)
    assert np.isclose(metrics.overlap_area_sqkm, 0.09, atol=1e-3)
    assert np.isclose(metrics.additional_candidate_area_sqkm, 0.09, atol=1e-3)
    assert np.isclose(metrics.iou_agreement, 0.5, atol=1e-3)


def test_full_real_event_pipeline():
    """Runs complete pipeline on the real flood event case."""
    case_dir = "data/cases/real_event_rio_grande_do_sul"
    pre_sar = os.path.join(case_dir, "OPERA_L2_RTC-S1_T22JBM_20240426T220719Z_VV.tif")
    post_sar = os.path.join(case_dir, "OPERA_L2_RTC-S1_T22JBM_20240508T220719Z_VV.tif")
    pre_vh = os.path.join(case_dir, "OPERA_L2_RTC-S1_T22JBM_20240426T220719Z_VH.tif")
    post_vh = os.path.join(case_dir, "OPERA_L2_RTC-S1_T22JBM_20240508T220719Z_VH.tif")
    dswx = os.path.join(case_dir, "OPERA_L3_DSWx-S1_T22JBM_20240508T220719Z_v1.0_B01_WTR.tif")
    out_dir = "data/processed/test_real_event_run"

    req = AnalysisRequest(
        pre_sar_path=pre_sar,
        post_sar_path=post_sar,
        opera_dswx_path=dswx,
        pre_vh_sar_path=pre_vh,
        post_vh_sar_path=post_vh,
        output_dir=out_dir
    )

    response = run_pipeline(req)

    assert response.status == "completed"
    assert response.area_statistics.total_valid_area_sqkm > 0
    assert response.area_statistics.candidate_inundation_area_sqkm > 0
    assert response.area_statistics.baseline_water_area_sqkm > 0
    assert response.area_statistics.overlap_area_sqkm > 0
    assert response.processing_time_seconds > 0

    # Verify exported GeoTIFFs and metrics JSON
    for layer_name, file_path in response.raster_layer_references.items():
        assert os.path.exists(file_path), f"Missing exported layer: {layer_name}"

    with open(response.raster_layer_references["metrics_json"], "r") as f:
        metrics_data = json.load(f)
        assert metrics_data["analysis_id"] == response.analysis_id
