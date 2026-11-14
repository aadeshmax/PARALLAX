import time
import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.database import (
    Base,
    AnalysisRecord,
    JobRecord,
    init_db,
    save_analysis_record,
    load_analysis_record,
    save_job_record,
    load_job_record
)

def test_database_persistence_lifecycle():
    """
    Fulfills Phase C:
    1. Insert isolated test record
    2. Retrieve record
    3. Update its status
    4. Verify against DB
    5. Reconnect (server restart simulation)
    6. Retrieve and verify persistence
    7. Clean up test record
    """
    test_id = f"test_db_{uuid.uuid4().hex[:8]}"
    roi_name = "Phase C Test AOI (Chennai Basin)"

    # 1. Insert Record
    record_data = {
        "analysis_id": test_id,
        "case_id": "test_case_persistence",
        "roi_name": roi_name,
        "status": "queued",
        "total_aoi_km2": 450.5,
        "open_water_km2": 12.3,
        "candidate_inundated_veg_km2": 8.7,
        "opera_dswx_water_km2": 14.1,
        "cross_sensor_breakdown": {"agreement_km2": 10.0, "candidate_hidden_km2": 8.7},
        "radar_statistics": {"baseline_vv_mean_db": -12.4, "event_vv_mean_db": -14.2},
        "confidence_summary": {"high_pct": 85.0},
        "provenance": {"source": "Phase C Verification", "test": True},
        "layer_urls": {"geojson": f"/data/test/{test_id}.geojson"}
    }
    saved = save_analysis_record(record_data)
    assert saved is not None
    assert saved["analysis_id"] == test_id
    assert saved["status"] == "queued"

    # 2. Retrieve Record
    loaded = load_analysis_record(test_id)
    assert loaded is not None
    assert loaded["analysis_id"] == test_id
    assert loaded["roi_name"] == roi_name
    assert loaded["total_aoi_km2"] == 450.5

    # 3. Update processing status
    record_data["status"] = "completed"
    record_data["candidate_inundated_veg_km2"] = 9.2
    updated = save_analysis_record(record_data)
    assert updated["status"] == "completed"

    # 4. Verify updated data directly against database session
    direct_session = sessionmaker(bind=create_engine(settings.db_url))()
    try:
        direct_row = direct_session.query(AnalysisRecord).filter(AnalysisRecord.id == test_id).first()
        assert direct_row is not None
        assert direct_row.status == "completed"
        assert direct_row.candidate_inundated_veg_km2 == 9.2
    finally:
        direct_session.close()

    # 5. Simulate Server Restart: Disconnect engine, create fresh engine and new session
    new_engine = create_engine(settings.db_url)
    NewSession = sessionmaker(bind=new_engine)
    restart_session = NewSession()

    try:
        # 6. Retrieve after restart
        persisted_row = restart_session.query(AnalysisRecord).filter(AnalysisRecord.id == test_id).first()
        assert persisted_row is not None
        # 7. Verify persistence after restart
        assert persisted_row.id == test_id
        assert persisted_row.status == "completed"
        assert persisted_row.total_aoi_km2 == 450.5
        assert persisted_row.candidate_inundated_veg_km2 == 9.2

        # 8. Clean up isolated test record
        restart_session.delete(persisted_row)
        restart_session.commit()
    finally:
        restart_session.close()
        new_engine.dispose()

    # Verify deleted
    verify_deleted = load_analysis_record(test_id)
    assert verify_deleted is None
