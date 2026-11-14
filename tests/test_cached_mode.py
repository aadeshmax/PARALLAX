from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_cached_mode_execution():
    """
    Fulfills Phase L:
    Validates that PARALLAX operates cleanly in cached demonstration mode,
    labeling data provenance and ensuring 100% offline hackathon reliability.
    """
    response = client.post("/api/nasa/process", json={"case_id": "demo_flood_case"})
    assert response.status_code == 200
    metrics = response.json()

    provenance = metrics["provenance"]
    assert provenance["is_demonstration_scene"] is True
    assert provenance["data_label"] == "verified_cached_demonstration"
    assert "citations" in provenance
    assert len(provenance["citations"]) >= 2
    assert "OPERA" in provenance["citations"][0]
