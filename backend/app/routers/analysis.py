import os
import json
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from app.config import settings
from app.schemas.analysis import (
    CompareRequest,
    CompareResponse,
    AnalysisMetrics,
    ProcessRequest,
)
from app.routers.nasa import process_satellite_imagery
from app.database import load_analysis_record

logger = logging.getLogger("parallax.api.analysis")
router = APIRouter(prefix="/api/analysis", tags=["PARALLAX Analysis"])

@router.get("/cases")
def list_available_cases():
    """Lists locally available verified demonstration cases."""
    priority = {
        "real_event_rio_grande_do_sul": 1,
        "mumbai_monsoon_event": 2,
        "chennai_live_case": 3,
        "demo_flood_case": 4
    }
    cases = []
    for case_dir in sorted(settings.CASES_DIR.iterdir(), key=lambda p: priority.get(p.name, 99)):
        if case_dir.is_dir():
            manifest_file = case_dir / "manifest.json"
            if manifest_file.exists():
                try:
                    with open(manifest_file, "r") as f:
                        data = json.load(f)
                        cases.append(data)
                except Exception as e:
                    logger.warning("Error reading manifest for %s: %s", case_dir.name, e)
    return cases

@router.post("/compare", response_model=CompareResponse)
def compare_cross_sensor(payload: CompareRequest):
    """
    Executes cross-product comparison between Sentinel-1 L2 RTC-derived inundation
    and NASA OPERA Level-3 DSWx water extent strictly within a common valid observation mask.
    """
    case_id = payload.case_id or "demo_flood_case"
    # Run or retrieve processing
    metrics = process_satellite_imagery(ProcessRequest(case_id=case_id))

    breakdown = metrics.cross_sensor_breakdown
    summary = (
        f"Cross-product evaluation strictly within the common valid analysis mask identified "
        f"{breakdown.agreement_open_water_km2} km² of confirmed open-water agreement, "
        f"{breakdown.candidate_hidden_water_km2} km² of candidate inundated vegetation obscured in "
        f"standard surface water products, and {breakdown.opera_only_water_km2} km² classified by OPERA "
        f"without significant radar backscatter change."
    )

    interpretation = (
        "Sentinel-1 radar change detection identifies backscatter enhancement (+2.5 dB) "
        "indicative of dihedral double-bounce reflections between standing water and woody plant stalks. "
        "These regions constitute candidate hidden water gaps. "
        "Per scientific protocol: Disagreement with OPERA DSWx highlights detection complementarity, "
        "not definitive superiority. Both RTC-S1 and DSWx-S1 are derived from Sentinel-1 observations."
    )

    return CompareResponse(
        analysis_id=metrics.analysis_id,
        case_id=case_id,
        metrics=metrics,
        comparison_summary=summary,
        scientific_interpretation=interpretation
    )

@router.get("/{analysis_id}/metrics", response_model=AnalysisMetrics)
def get_analysis_metrics(analysis_id: str):
    """Retrieves full scientific metrics and layer metadata for an analysis session."""
    cached = load_analysis_record(analysis_id)
    if cached:
        return AnalysisMetrics(**cached)
    case_id = analysis_id.replace("ana_", "") if analysis_id.startswith("ana_") else "demo_flood_case"
    return process_satellite_imagery(ProcessRequest(case_id=case_id))

@router.get("/{analysis_id}/results")
def get_analysis_results(analysis_id: str):
    """Returns scientific results and cross-sensor breakdown for an analysis."""
    metrics = get_analysis_metrics(analysis_id)
    return {
        "analysis_id": metrics.analysis_id,
        "case_id": metrics.case_id,
        "cross_sensor_breakdown": metrics.cross_sensor_breakdown,
        "radar_statistics": metrics.radar_statistics,
        "confidence_summary": metrics.confidence_summary,
        "provenance": metrics.provenance
    }

@router.get("/{analysis_id}/layers")
def get_analysis_layers(analysis_id: str):
    """Returns geospatial layer artifact URLs for frontend map integration."""
    metrics = get_analysis_metrics(analysis_id)
    return {
        "analysis_id": metrics.analysis_id,
        "case_id": metrics.case_id,
        "layer_urls": metrics.layer_urls
    }
