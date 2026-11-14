import time
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root_endpoint():
    start = time.perf_counter()
    response = client.get("/")
    duration = time.perf_counter() - start
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "supported_datasets" in data
    assert duration < 0.2

def test_health_endpoint():
    start = time.perf_counter()
    response = client.get("/health")
    duration = time.perf_counter() - start
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "demo_scenes_ready" in data
    assert duration < 0.2
