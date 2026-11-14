import time
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_analysis_cases_list():
    response = client.get("/api/analysis/cases")
    assert response.status_code == 200
    cases = response.json()
    assert len(cases) > 0
    assert "case_id" in cases[0]

def test_analysis_compare_endpoint():
    start = time.perf_counter()
    response = client.post("/api/analysis/compare", json={"case_id": "demo_flood_case"})
    duration = time.perf_counter() - start
    assert response.status_code == 200
    data = response.json()
    assert "comparison_summary" in data
    assert "scientific_interpretation" in data
    assert "metrics" in data
    assert duration < 3.0

def test_analysis_metrics_retrieval():
    response = client.get("/api/analysis/ana_demo_flood_case/metrics")
    assert response.status_code == 200
    metrics = response.json()
    assert metrics["case_id"] == "demo_flood_case"
    assert "cross_sensor_breakdown" in metrics
    assert "provenance" in metrics
    assert metrics["provenance"]["disclaimer"] is not None
