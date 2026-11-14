import json
import time
import logging
from typing import Optional, Dict, Any, List
from sqlalchemy import create_engine, Column, String, Float, Text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

logger = logging.getLogger("parallax.database")

Base = declarative_base()

class JobRecord(Base):
    __tablename__ = "jobs"

    id = Column(String(64), primary_key=True, index=True)
    job_type = Column(String(32), nullable=False)
    status = Column(String(32), nullable=False, default="pending")
    progress = Column(Float, default=0.0)
    message = Column(Text, default="")
    metadata_json = Column(Text, default="{}")
    result_json = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(Float, default=time.time)
    updated_at = Column(Float, default=time.time, onupdate=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.job_type,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "metadata": json.loads(self.metadata_json or "{}"),
            "result": json.loads(self.result_json) if self.result_json else None,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }

class AnalysisRecord(Base):
    __tablename__ = "analyses"

    id = Column(String(64), primary_key=True, index=True)
    case_id = Column(String(64), index=True, nullable=False)
    roi_name = Column(String(128), default="Custom AOI")
    status = Column(String(32), nullable=False, default="completed")
    total_aoi_km2 = Column(Float, default=0.0)
    common_valid_aoi_km2 = Column(Float, nullable=True)
    ocean_masked_km2 = Column(Float, nullable=True)
    permanent_water_km2 = Column(Float, nullable=True)
    open_water_km2 = Column(Float, default=0.0)
    candidate_inundated_veg_km2 = Column(Float, default=0.0)
    opera_dswx_water_km2 = Column(Float, default=0.0)
    spatial_union_km2 = Column(Float, nullable=True)
    parallax_only_km2 = Column(Float, nullable=True)
    processing_version = Column(String(64), default="v2.0-scientific-integrity")
    cross_sensor_breakdown_json = Column(Text, default="{}")
    radar_stats_json = Column(Text, default="{}")
    confidence_summary_json = Column(Text, default="{}")
    provenance_json = Column(Text, default="{}")
    layer_urls_json = Column(Text, default="{}")
    created_at = Column(String(64), default=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    updated_at = Column(String(64), default=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "analysis_id": self.id,
            "case_id": self.case_id,
            "roi_name": self.roi_name,
            "status": self.status,
            "processing_version": self.processing_version or "v2.0-scientific-integrity",
            "total_aoi_km2": self.total_aoi_km2,
            "common_valid_aoi_km2": self.common_valid_aoi_km2,
            "ocean_masked_km2": self.ocean_masked_km2,
            "permanent_water_km2": self.permanent_water_km2,
            "open_water_km2": self.open_water_km2,
            "candidate_inundated_veg_km2": self.candidate_inundated_veg_km2,
            "opera_dswx_water_km2": self.opera_dswx_water_km2,
            "spatial_union_km2": self.spatial_union_km2,
            "parallax_only_km2": self.parallax_only_km2,
            "cross_sensor_breakdown": json.loads(self.cross_sensor_breakdown_json or "{}"),
            "radar_statistics": json.loads(self.radar_stats_json or "{}"),
            "confidence_summary": json.loads(self.confidence_summary_json or "{}"),
            "provenance": json.loads(self.provenance_json or "{}"),
            "layer_urls": json.loads(self.layer_urls_json or "{}"),
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }

engine = create_engine(
    settings.db_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.db_url else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db(custom_engine=None):
    """Initializes tables in database."""
    target_engine = custom_engine or engine
    Base.metadata.create_all(bind=target_engine)
    logger.info("Database initialized successfully.")

# Ensure tables are created immediately upon module load
try:
    init_db()
except Exception as _e:
    logger.warning(f"Initial DB create_all deferred: {_e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def save_job_record(job_dict: Dict[str, Any], session: Optional[Session] = None):
    close_session = False
    if session is None:
        session = SessionLocal()
        close_session = True
    try:
        rec = session.query(JobRecord).filter(JobRecord.id == job_dict["id"]).first()
        if not rec:
            rec = JobRecord(id=job_dict["id"], job_type=job_dict.get("type", "unknown"))
            session.add(rec)
        rec.status = job_dict.get("status", rec.status)
        rec.progress = job_dict.get("progress", rec.progress)
        rec.message = job_dict.get("message", rec.message)
        rec.metadata_json = json.dumps(job_dict.get("metadata", {}))
        if job_dict.get("result") is not None:
            rec.result_json = json.dumps(job_dict["result"])
        if job_dict.get("error") is not None:
            rec.error = job_dict["error"]
        rec.updated_at = time.time()
        session.commit()
    except Exception as e:
        session.rollback()
        logger.warning(f"Error saving job to DB: {e}")
    finally:
        if close_session:
            session.close()

def load_job_record(job_id: str, session: Optional[Session] = None) -> Optional[Dict[str, Any]]:
    close_session = False
    if session is None:
        session = SessionLocal()
        close_session = True
    try:
        rec = session.query(JobRecord).filter(JobRecord.id == job_id).first()
        if rec:
            return rec.to_dict()
        return None
    finally:
        if close_session:
            session.close()

def save_analysis_record(analysis_data: Dict[str, Any], session: Optional[Session] = None):
    close_session = False
    if session is None:
        session = SessionLocal()
        close_session = True
    try:
        ana_id = analysis_data["analysis_id"]
        rec = session.query(AnalysisRecord).filter(AnalysisRecord.id == ana_id).first()
        if not rec:
            rec = AnalysisRecord(id=ana_id, case_id=analysis_data.get("case_id", "custom"))
            session.add(rec)
        rec.case_id = analysis_data.get("case_id", rec.case_id)
        rec.roi_name = analysis_data.get("roi_name", rec.roi_name)
        rec.status = analysis_data.get("status", "completed")
        rec.processing_version = analysis_data.get("processing_version", "v2.0-scientific-integrity")
        rec.total_aoi_km2 = analysis_data.get("total_aoi_km2", 0.0)
        rec.common_valid_aoi_km2 = analysis_data.get("common_valid_aoi_km2")
        rec.ocean_masked_km2 = analysis_data.get("ocean_masked_km2")
        rec.permanent_water_km2 = analysis_data.get("permanent_water_km2")
        rec.open_water_km2 = analysis_data.get("open_water_km2", 0.0)
        rec.candidate_inundated_veg_km2 = analysis_data.get("candidate_inundated_veg_km2", 0.0)
        rec.opera_dswx_water_km2 = analysis_data.get("opera_dswx_water_km2", 0.0)
        rec.spatial_union_km2 = analysis_data.get("spatial_union_km2")
        rec.parallax_only_km2 = analysis_data.get("parallax_only_km2")
        rec.cross_sensor_breakdown_json = json.dumps(analysis_data.get("cross_sensor_breakdown", {}))
        rec.radar_stats_json = json.dumps(analysis_data.get("radar_statistics", {}))
        rec.confidence_summary_json = json.dumps(analysis_data.get("confidence_summary", {}))
        rec.provenance_json = json.dumps(analysis_data.get("provenance", {}))
        rec.layer_urls_json = json.dumps(analysis_data.get("layer_urls", {}))
        rec.updated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        session.commit()
        return rec.to_dict()
    except Exception as e:
        session.rollback()
        logger.warning(f"Error saving analysis record to DB: {e}")
        return None
    finally:
        if close_session:
            session.close()

def load_analysis_record(analysis_id: str, session: Optional[Session] = None) -> Optional[Dict[str, Any]]:
    close_session = False
    if session is None:
        session = SessionLocal()
        close_session = True
    try:
        rec = session.query(AnalysisRecord).filter(AnalysisRecord.id == analysis_id).first()
        if rec:
            return rec.to_dict()
        return None
    finally:
        if close_session:
            session.close()
