from fastapi import APIRouter, HTTPException
from app.services.job_manager import job_manager

router = APIRouter(prefix="/api/jobs", tags=["Background Jobs"])

@router.get("/{job_id}")
def get_job_status(job_id: str):
    """Retrieves asynchronous download or processing job status and progress."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job
