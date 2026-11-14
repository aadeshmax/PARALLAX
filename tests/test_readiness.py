import time
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_readiness_endpoint():
    start = time.perf_counter()
    response = client.get("/readiness")
    duration = time.perf_counter() - start
    assert response.status_code in [200, 503]
    data = response.json()
    assert "status" in data
    assert "dependencies" in data
    deps = data["dependencies"]
    assert "database" in deps
    assert "storage" in deps
    assert "earthdata" in deps
    assert deps["database"] == "connected"
    assert deps["storage"] == "writable"
    assert duration < 0.3
