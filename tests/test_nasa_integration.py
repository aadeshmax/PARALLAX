import os
import rasterio
from starlette.testclient import TestClient
from app.main import app
from app.services.search_service import search_service

client = TestClient(app)

def test_chennai_opera_discovery():
    """
    Fulfills Phase E:
    Tests discovery for Chennai, Tamil Nadu [80.0, 12.7, 80.4, 13.3]
    between 2024-11-25 and 2024-12-10 for OPERA_L3_DSWX-S1_V1.
    """
    res = search_service.search_granules(
        dataset="OPERA_L3_DSWX-S1_V1",
        bbox=[80.0, 12.7, 80.4, 13.3],
        start_date="2024-11-25",
        end_date="2024-12-10",
        limit=5
    )
    assert res.granules_found > 0
    granule = res.granules[0]
    assert "OPERA_L3_DSWx" in granule.granule_ur
    assert len(granule.data_links) > 0
    assert granule.bounding_box is not None

def test_verified_geotiff_raster_validation():
    """Validates real downloaded NASA GeoTIFF assets using Rasterio."""
    rtc_file = os.path.abspath("data/cases/demo_flood_case/post_rtc_vv.tif")
    assert os.path.exists(rtc_file)

    with rasterio.open(rtc_file) as src:
        assert src.count == 1
        assert src.crs is not None
        assert src.bounds.left < src.bounds.right
        assert src.bounds.bottom < src.bounds.top
        data = src.read(1)
        assert data.size > 10000

def test_chennai_live_case_rasterio_validation():
    """Validates live Chennai NASA OPERA assets in EPSG:32644."""
    case_dir = os.path.abspath("data/cases/chennai_live_case")
    assert os.path.exists(case_dir)

    vv_file = os.path.join(case_dir, "post_rtc_vv.tif")
    vh_file = os.path.join(case_dir, "post_rtc_vh.tif")
    dswx_file = os.path.join(case_dir, "opera_dswx_aligned.tif")

    for fpath in [vv_file, vh_file, dswx_file]:
        assert os.path.exists(fpath)
        with rasterio.open(fpath) as src:
            assert str(src.crs) == "EPSG:32644"
            assert src.res == (30.0, 30.0)
            assert src.width in (300, 3301)
            assert src.height in (300, 1639)

def test_chennai_live_case_execution_and_persistence():
    """Executes live Chennai case through API and verifies database persistence."""
    res = client.post("/api/nasa/process", json={"case_id": "chennai_live_case"})
    assert res.status_code == 200
    data = res.json()
    assert data["analysis_id"] == "ana_chennai_live_case"
    assert data["case_id"] == "chennai_live_case"
    assert data["provenance"]["data_label"] == "live_nasa_earthdata"
    assert data["provenance"]["is_demonstration_scene"] is False
    assert "OPERA_L2_RTC-S1_T092-196459-IW1" in data["provenance"]["post_event_granule"]
    assert data["open_water_km2"] > 0
    assert data["total_aoi_km2"] > 50.0
    assert data["common_valid_aoi_km2"] >= data["total_aoi_km2"]
    assert data["opera_dswx_water_km2"] <= data["total_aoi_km2"]

    # Verify retrieval from /api/analysis/{id}/metrics
    m_res = client.get("/api/analysis/ana_chennai_live_case/metrics")
    assert m_res.status_code == 200
    assert m_res.json()["case_id"] == "chennai_live_case"

