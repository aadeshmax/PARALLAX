from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_list_datasets():
    response = client.get("/api/nasa/datasets")
    assert response.status_code == 200
    datasets = response.json()
    assert len(datasets) == 2

    rtc = next((d for d in datasets if d["id"] == "OPERA_L2_RTC-S1_V1"), None)
    assert rtc is not None
    assert rtc["spatial_resolution_m"] == 30
    assert "doi" in rtc
    assert "citation" in rtc

    dswx = next((d for d in datasets if d["id"] == "OPERA_L3_DSWX-S1_V1"), None)
    assert dswx is not None
    assert dswx["spatial_resolution_m"] == 30
    assert "doi" in dswx
