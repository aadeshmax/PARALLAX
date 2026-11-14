"""
FastAPI Backend Router & Service.
Exposes flood-event analysis runs adhering to the standard response contract:
- analysis_id
- source_granule_ids
- timestamps
- raster_layer_references
- area_statistics
- confidence_description
- processing_time_seconds
- limitations_and_assumptions
"""
import os
import time
import uuid
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException

from backend.schemas import Polarization
from backend.rtc_ingestion import ingest_rtc_geotiff
from backend.dswx_ingestion import ingest_opera_dswx
from backend.alignment import align_sar_pair, align_dswx_to_sar
from backend.sar_engine import detect_candidate_inundation
from backend.metrics import calculate_water_comparison_metrics
from backend.exporter import export_analysis_layers


app = FastAPI(
    title="TERRA//PULSE SAR Inundation & Gap Intelligence Engine",
    description="Cross-sensor flood signature detection, vegetation double-bounce analysis, and OPERA DSWx gap intelligence",
    version="1.0.0"
)


class AnalysisRequest(BaseModel):
    pre_sar_path: str = Field(..., description="Path to pre-event RTC-S1 GeoTIFF")
    post_sar_path: str = Field(..., description="Path to post-event RTC-S1 GeoTIFF")
    opera_dswx_path: str = Field(..., description="Path to OPERA DSWx-S1 GeoTIFF baseline")
    pre_vh_sar_path: Optional[str] = Field(None, description="Optional pre-event VH SAR GeoTIFF")
    post_vh_sar_path: Optional[str] = Field(None, description="Optional post-event VH SAR GeoTIFF")
    output_dir: Optional[str] = Field(None, description="Directory to export output GeoTIFFs and JSON metrics")
    filter_speckle: bool = True
    specular_decrease_thresh_db: float = -3.0
    double_bounce_increase_thresh_db: float = 2.5


class AreaStatisticsResponse(BaseModel):
    total_valid_area_sqkm: float
    baseline_water_area_sqkm: float
    candidate_inundation_area_sqkm: float
    specular_candidate_area_sqkm: float
    double_bounce_candidate_area_sqkm: float
    overlap_area_sqkm: float
    additional_candidate_area_sqkm: float
    baseline_only_area_sqkm: float
    iou_agreement: float
    additional_candidate_ratio: float
    metrics_notes: str


class ConfidenceDescription(BaseModel):
    method: str
    is_calibrated_probability: bool
    description: str
    thresholds_applied: Dict[str, float]


class AnalysisResponse(BaseModel):
    analysis_id: str
    status: str
    source_granule_ids: Dict[str, str]
    timestamps: Dict[str, str]
    raster_layer_references: Dict[str, str]
    area_statistics: AreaStatisticsResponse
    confidence_description: ConfidenceDescription
    processing_time_seconds: float
    scientific_limitations: List[str]


def run_pipeline(request: AnalysisRequest) -> AnalysisResponse:
    start_time = time.time()
    analysis_id = str(uuid.uuid4())

    out_dir = request.output_dir or os.path.join("data", "processed", analysis_id)
    os.makedirs(out_dir, exist_ok=True)

    # 1. Ingest RTC-S1 Pre & Post
    pre_sar = ingest_rtc_geotiff(request.pre_sar_path)
    post_sar = ingest_rtc_geotiff(request.post_sar_path)

    # Optional VH bands
    pre_vh = ingest_rtc_geotiff(request.pre_vh_sar_path) if request.pre_vh_sar_path else None
    post_vh = ingest_rtc_geotiff(request.post_vh_sar_path) if request.post_vh_sar_path else None

    # 2. Align Pre & Post SAR
    pre_db_aligned, post_db_aligned, sar_valid_mask, ref_transform, ref_crs = align_sar_pair(
        pre_sar, post_sar
    )

    pre_vh_aligned = None
    post_vh_aligned = None
    if pre_vh and post_vh:
        pre_vh_aligned, post_vh_aligned, vh_valid_mask, _, _ = align_sar_pair(pre_vh, post_vh)
        sar_valid_mask &= vh_valid_mask

    # 3. Ingest and Align OPERA DSWx
    dswx = ingest_opera_dswx(request.opera_dswx_path)
    ref_shape = (post_sar.metadata.height, post_sar.metadata.width)
    dswx_classes_aligned, dswx_valid_aligned = align_dswx_to_sar(
        dswx, ref_crs, ref_transform, ref_shape
    )
    dswx_water_aligned = (dswx_classes_aligned == 1) | (dswx_classes_aligned == 2)

    # 4. Common Valid Mask (Valid SAR in both dates AND valid DSWx observation)
    common_valid_mask = sar_valid_mask & dswx_valid_aligned

    # 5. Detect Candidate Inundation
    cand_result = detect_candidate_inundation(
        pre_db=pre_db_aligned,
        post_db=post_db_aligned,
        valid_mask=common_valid_mask,
        pre_vh_db=pre_vh_aligned,
        post_vh_db=post_vh_aligned,
        filter_speckle=request.filter_speckle,
        specular_decrease_thresh_db=request.specular_decrease_thresh_db,
        double_bounce_increase_thresh_db=request.double_bounce_increase_thresh_db
    )

    # 6. Calculate Area Metrics & Comparison Layers
    metrics, layers = calculate_water_comparison_metrics(
        candidate_mask=cand_result.candidate_inundation_mask,
        specular_mask=cand_result.specular_candidate_mask,
        double_bounce_mask=cand_result.double_bounce_candidate_mask,
        baseline_water_mask=dswx_water_aligned,
        common_valid_mask=common_valid_mask,
        transform=ref_transform,
        crs_str=ref_crs
    )

    # 7. Export GeoTIFFs
    exported_layers = export_analysis_layers(
        layers=layers,
        diff_db=cand_result.diff_db,
        confidence=cand_result.heuristic_confidence,
        out_dir=out_dir,
        crs_str=ref_crs,
        transform=ref_transform
    )

    # 8. Export JSON Metrics
    metrics_json_path = os.path.join(out_dir, "metrics.json")
    exported_layers["metrics_json"] = metrics_json_path

    limitations = [
        "Outputs represent candidate inundation, not verified ground-truth water.",
        "Smooth surfaces (e.g. runways, calm sand, asphalt) may exhibit specular backscatter drops similar to open water.",
        "Double-bounce increases can occur due to agricultural vegetation growth, soil tillage, or extreme moisture increases, not solely sub-canopy flooding.",
        "OPERA DSWx baseline is an independent satellite product with its own latency and sensor limitations; IoU measures sensor agreement, not absolute classification accuracy.",
        "Wind-roughened open water surfaces can increase radar backscatter, leading to omission in pure specular thresholding."
    ]

    conf_desc = ConfidenceDescription(
        method="heuristic_spatial_backscatter_deviation",
        is_calibrated_probability=False,
        description="Continuous [0.5, 1.0] score measuring the magnitude of decibel change exceeding empirical physical thresholds; NOT a Bayesian or calibrated probability.",
        thresholds_applied=cand_result.thresholds_used
    )

    proc_time = round(time.time() - start_time, 3)

    resp = AnalysisResponse(
        analysis_id=analysis_id,
        status="completed",
        source_granule_ids={
            "pre_sar": pre_sar.metadata.granule_id,
            "post_sar": post_sar.metadata.granule_id,
            "opera_dswx": dswx.granule_id
        },
        timestamps={
            "pre_sar_acquisition": pre_sar.metadata.acquisition_time.isoformat(),
            "post_sar_acquisition": post_sar.metadata.acquisition_time.isoformat(),
            "opera_dswx_acquisition": dswx.acquisition_time.isoformat(),
            "processed_at": datetime.now(timezone.utc).isoformat()
        },
        raster_layer_references=exported_layers,
        area_statistics=AreaStatisticsResponse(**metrics.__dict__),
        confidence_description=conf_desc,
        processing_time_seconds=proc_time,
        scientific_limitations=limitations
    )

    with open(metrics_json_path, "w") as f:
        json.dump(resp.model_dump(), f, indent=2)

    return resp


@app.post("/api/v1/analyze", response_model=AnalysisResponse)
def analyze_flood_event(request: AnalysisRequest):
    try:
        return run_pipeline(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
