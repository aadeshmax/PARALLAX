import pytest
from starlette.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)

def test_inverted_bounding_box():
    """Validates that west > east or south > north triggers 422 with descriptive error."""
    payload = {
        "dataset": "OPERA_L2_RTC-S1_V1",
        "bbox": [80.4, 12.7, 80.0, 13.3], # west > east (inverted!)
        "start_date": "2024-11-25",
        "end_date": "2024-12-10"
    }
    response = client.post("/api/nasa/search", json=payload)
    assert response.status_code == 422
    assert "inverted" in str(response.json()).lower()

def test_invalid_geographic_coordinates():
    """Validates that coordinates outside [-180, 180] or [-90, 90] trigger 422."""
    payload = {
        "dataset": "OPERA_L2_RTC-S1_V1",
        "bbox": [-195.0, 12.7, 80.0, 13.3], # -195 is invalid longitude
        "start_date": "2024-11-25",
        "end_date": "2024-12-10"
    }
    response = client.post("/api/nasa/search", json=payload)
    assert response.status_code == 422
    assert "longitude" in str(response.json()).lower()

def test_start_date_later_than_end_date():
    """Validates that start_date > end_date triggers 422."""
    payload = {
        "dataset": "OPERA_L2_RTC-S1_V1",
        "bbox": [80.0, 12.7, 80.4, 13.3],
        "start_date": "2024-12-10",
        "end_date": "2024-11-25" # end_date before start_date
    }
    response = client.post("/api/nasa/search", json=payload)
    assert response.status_code == 422
    assert "start date" in str(response.json()).lower()

def test_missing_required_search_fields():
    """Validates that missing dataset triggers 422."""
    response = client.post("/api/nasa/search", json={"bbox": [80.0, 12.7, 80.4, 13.3]})
    assert response.status_code == 422

def test_nonexistent_case_processing():
    """Validates that processing nonexistent case returns 404."""
    response = client.post("/api/nasa/process", json={"case_id": "nonexistent_ghost_case_999"})
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

def test_credential_leak_prevention():
    """Verifies that error messages and status endpoints never expose passwords."""
    r1 = client.get("/api/nasa/status")
    status_text = r1.text
    if settings.EARTHDATA_PASSWORD:
        assert settings.EARTHDATA_PASSWORD not in status_text
    assert "Tarunbanu2007@" not in status_text
