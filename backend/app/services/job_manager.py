import uuid
import time
import logging
from typing import Dict, Any, Optional, Callable
from concurrent.futures import ThreadPoolExecutor
from app.database import save_job_record, load_job_record

logger = logging.getLogger("parallax.jobs")

class JobManager:
    def __init__(self, max_workers: int = 4):
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.jobs: Dict[str, Dict[str, Any]] = {}

    def create_job(self, job_type: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        job_id = f"job_{uuid.uuid4().hex[:10]}"
        job = {
            "id": job_id,
            "type": job_type,
            "status": "pending",
            "progress": 0.0,
            "message": "Job queued",
            "metadata": metadata or {},
            "created_at": time.time(),
            "updated_at": time.time(),
            "result": None,
            "error": None
        }
        self.jobs[job_id] = job
        save_job_record(job)
        return job_id

    def update_job(
        self,
        job_id: str,
        status: Optional[str] = None,
        progress: Optional[float] = None,
        message: Optional[str] = None,
        result: Optional[Any] = None,
        error: Optional[str] = None
    ):
        job = self.jobs.get(job_id)
        if not job:
            db_job = load_job_record(job_id)
            if db_job:
                self.jobs[job_id] = db_job
                job = db_job
            else:
                return

        if status:
            job["status"] = status
        if progress is not None:
            job["progress"] = progress
        if message:
            job["message"] = message
        if result is not None:
            job["result"] = result
        if error is not None:
            job["error"] = error
        job["updated_at"] = time.time()
        save_job_record(job)

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        if job_id in self.jobs:
            return self.jobs[job_id]
        db_job = load_job_record(job_id)
        if db_job:
            self.jobs[job_id] = db_job
            return db_job
        return None

    def submit(self, job_id: str, func: Callable, *args, **kwargs):
        def wrapper():
            self.update_job(job_id, status="running", progress=5.0, message="Processing started")
            try:
                res = func(
                    *args,
                    progress_callback=lambda p, m: self.update_job(job_id, progress=p, message=m),
                    **kwargs
                )
                self.update_job(job_id, status="completed", progress=100.0, message="Completed successfully", result=res)
            except Exception as exc:
                logger.exception("Job %s failed: %s", job_id, str(exc))
                self.update_job(job_id, status="failed", progress=0.0, message="Job encountered an error", error=str(exc))

        self.executor.submit(wrapper)

job_manager = JobManager()
