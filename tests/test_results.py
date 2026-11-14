from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_analysis_results_endpoint():
    response = client.get("/api/analysis/ana_demo_flood_case/results")
    assert response.status_code == 200
    data = response.json()
    assert "cross_sensor_breakdown" in data
    assert "radar_statistics" in data
    assert "confidence_summary" in data

def test_analysis_layers_endpoint():
    response = client.get("/api/analysis/ana_demo_flood_case/layers")
    assert response.status_code == 200
    data = response.json()
    assert "layer_urls" in data
    assert "geojson" in data["layer_urls"]
