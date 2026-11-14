import time
from starlette.testclient import TestClient
from app.main import app
from app.services.job_manager import job_manager

client = TestClient(app)

def test_nonexistent_job():
    response = client.get("/api/jobs/job_nonexistent_123")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

def test_job_lifecycle():
    job_id = job_manager.create_job("test_task", {"test_key": "test_val"})
    assert job_id.startswith("job_")

    # Initial state
    r1 = client.get(f"/api/jobs/{job_id}")
    assert r1.status_code == 200
    assert r1.json()["status"] == "pending"

    # Update state
    job_manager.update_job(job_id, status="running", progress=50.0, message="In progress")
    r2 = client.get(f"/api/jobs/{job_id}")
    assert r2.status_code == 200
    assert r2.json()["status"] == "running"
    assert r2.json()["progress"] == 50.0

    # Complete state
    job_manager.update_job(job_id, status="completed", progress=100.0, result={"output": 42})
    r3 = client.get(f"/api/jobs/{job_id}")
    assert r3.status_code == 200
    assert r3.json()["status"] == "completed"
    assert r3.json()["result"]["output"] == 42
