import os
import json
from starlette.testclient import TestClient
from app.main import app
from app.database import load_analysis_record, save_analysis_record

client = TestClient(app)

def test_full_analysis_lifecycle_e2e():
    """
    Fulfills Phase H:
    Complete end-to-end analysis test with identifier PARALLAX_E2E_001.
    """
    test_id = "PARALLAX_E2E_001"

    # 1. Submit analysis request
    payload = {
        "case_id": "demo_flood_case",
        "darkening_threshold_db": -3.0,
        "brightening_threshold_db": 2.5
    }
    response = client.post("/api/nasa/process", json=payload)
    assert response.status_code == 200
    metrics = response.json()

    # 2. Assign E2E identifier and persist
    metrics["analysis_id"] = test_id
    metrics["roi_name"] = "Brittany Coastal Estuary (Sentinel-1 Burst Track 001)"
    saved = save_analysis_record(metrics)
    assert saved is not None
    assert saved["analysis_id"] == test_id

    # 3. Retrieve results through the API
    retrieved = client.get(f"/api/analysis/{test_id}/metrics")
    assert retrieved.status_code == 200
    data = retrieved.json()
    assert data["analysis_id"] == test_id
    assert data["total_aoi_km2"] > 1000.0

    # 4. Verify cross-sensor breakdown calculations
    breakdown = data["cross_sensor_breakdown"]
    assert "agreement_open_water_km2" in breakdown
    assert "candidate_hidden_water_km2" in breakdown
    assert "opera_only_water_km2" in breakdown
    assert "unflooded_land_km2" in breakdown

    # 5. Verify generated GeoJSON artifacts exist on disk
    geojson_url = data["layer_urls"]["geojson"] # e.g. /data/processed/demo_flood_case/candidates.geojson
    disk_path = os.path.join(".", geojson_url.lstrip("/"))
    assert os.path.exists(disk_path)
    with open(disk_path, "r") as f:
        geojson_obj = json.load(f)
        assert geojson_obj["type"] == "FeatureCollection"
        assert len(geojson_obj["features"]) > 0

    # 6. Verify results endpoint
    res_resp = client.get(f"/api/analysis/{test_id}/results")
    assert res_resp.status_code == 200
    assert "cross_sensor_breakdown" in res_resp.json()

    # 7. Verify layers endpoint
    lay_resp = client.get(f"/api/analysis/{test_id}/layers")
    assert lay_resp.status_code == 200
    assert "geojson" in lay_resp.json()["layer_urls"]
