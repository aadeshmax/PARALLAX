from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ProcessRequest(BaseModel):
    case_id: Optional[str] = Field("demo_flood_case", description="ID of case to process")
    pre_rtc_granule: Optional[str] = None
    post_rtc_granule: Optional[str] = None
    dswx_granule: Optional[str] = None
    roi_bbox: Optional[List[float]] = Field(None, description="[min_lon, min_lat, max_lon, max_lat]")
    darkening_threshold_db: float = Field(-3.0, description="dB drop threshold for specular open water")
    brightening_threshold_db: float = Field(2.5, description="dB increase threshold for canopy double-bounce")

class CompareRequest(BaseModel):
    analysis_id: Optional[str] = None
    case_id: Optional[str] = "demo_flood_case"

class CrossSensorBreakdown(BaseModel):
    agreement_open_water_km2: float
    candidate_hidden_water_km2: float
    opera_only_water_km2: float
    unflooded_land_km2: float

class RadarStatistics(BaseModel):
    baseline_vv_mean_db: float
    event_vv_mean_db: float
    mean_db_change_open_water: float
    mean_db_change_vegetation: float

class ConfidenceSummary(BaseModel):
    high_pct: float
    medium_pct: float
    low_pct: float

class DataProvenance(BaseModel):
    pre_event_granule: str
    post_event_granule: str
    dswx_granule: str
    acquisition_date_pre: str
    acquisition_date_post: str
    is_demonstration_scene: bool
    data_label: str = Field(description="live | cached | demonstration")
    disclaimer: str
    citations: List[str]
    comparison_type: str = Field(
        "cross-product",
        description="Sentinel-1 RTC-S1 vs Sentinel-1 DSWx-S1 cross-product comparison"
    )
    confidence_metric_basis: str = Field(
        "Heuristic radar backscatter change amplitude, not calibrated flood probability",
        description="Explicit basis for evidence tier quantification"
    )

class AnalysisMetrics(BaseModel):
    analysis_id: str
    case_id: str
    total_aoi_km2: float
    open_water_km2: float
    candidate_inundated_veg_km2: float
    opera_dswx_water_km2: float
    cross_sensor_breakdown: CrossSensorBreakdown
    radar_statistics: RadarStatistics
    confidence_summary: ConfidenceSummary
    provenance: DataProvenance
    layer_urls: Dict[str, str]
    created_at: str
    common_valid_aoi_km2: Optional[float] = None
    ocean_masked_km2: Optional[float] = None
    permanent_water_km2: Optional[float] = None
    spatial_union_km2: Optional[float] = None
    parallax_only_km2: Optional[float] = None
    processing_version: Optional[str] = "v2.0-scientific-integrity"

class CompareResponse(BaseModel):
    analysis_id: str
    case_id: str
    metrics: AnalysisMetrics
    comparison_summary: str
    scientific_interpretation: str
