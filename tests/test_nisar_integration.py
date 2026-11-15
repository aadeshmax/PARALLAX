import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_nisar_case_in_manifest():
    response = client.get("/api/analysis/cases")
    assert response.status_code == 200
    cases = response.json()
    assert isinstance(cases, list)
    case_ids = [c.get("case_id") or c.get("id") for c in cases]
    assert "mumbai_nisar_2026" in case_ids

    # Find the NISAR case
    nisar_case = next(c for c in cases if (c.get("case_id") or c.get("id")) == "mumbai_nisar_2026")
    assert "NISAR" in nisar_case.get("title", "")
    assert "sensor" in nisar_case
    assert "NISAR" in nisar_case["sensor"]["platform"]
    assert "LSAR" in nisar_case["sensor"]["instrument"]
    assert "GCOV" in nisar_case["sensor"]["product_type"]
    assert nisar_case["sensor"]["product_maturity"] == "PROVISIONAL"

def test_nisar_case_process():
    response = client.post("/api/nasa/process", json={"case_id": "mumbai_nisar_2026"})
    assert response.status_code == 200
    metrics = response.json()
    assert "provenance" in metrics
    provenance = metrics["provenance"]
    assert provenance["data_label"] == "live_nisar_flight_observation"
    assert any("NISAR" in citation for citation in provenance["citations"])
    assert metrics["total_aoi_km2"] > 2000.0
    assert metrics["candidate_inundated_veg_km2"] > 0.0
