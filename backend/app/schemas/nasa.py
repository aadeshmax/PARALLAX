from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator

class EarthdataStatusResponse(BaseModel):
    authenticated: bool
    configured: bool
    username_masked: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    demo_fallback_active: bool
    daac_status: Dict[str, str]

class GranuleMetadata(BaseModel):
    granule_ur: str
    title: str
    dataset: str
    acquisition_time: str
    cloud_cover: Optional[float] = None
    size_mb: float
    data_links: List[str]
    bounding_box: List[float] = Field(description="[min_lon, min_lat, max_lon, max_lat]")
    polarizations: List[str] = []
    day_night_flag: Optional[str] = None

class SearchRequest(BaseModel):
    dataset: str = Field(..., description="e.g. OPERA_L3_DSWX-S1_V1 or OPERA_L2_RTC-S1_V1")
    bbox: List[float] = Field(..., description="[min_lon, min_lat, max_lon, max_lat]")
    start_date: str = Field(..., description="YYYY-MM-DD")
    end_date: str = Field(..., description="YYYY-MM-DD")
    polarization: Optional[str] = Field(None, description="e.g. VV, VH, or VV+VH")
    limit: int = Field(10, ge=1, le=50)

    @field_validator("bbox")
    @classmethod
    def validate_bbox(cls, v: List[float]):
        if len(v) != 4:
            raise ValueError("Bounding box must contain exactly 4 coordinates: [west, south, east, north]")
        west, south, east, north = v
        if not (-180.0 <= west <= 180.0 and -180.0 <= east <= 180.0):
            raise ValueError("Longitude must be between -180.0 and 180.0 degrees")
        if not (-90.0 <= south <= 90.0 and -90.0 <= north <= 90.0):
            raise ValueError("Latitude must be between -90.0 and 90.0 degrees")
        if west >= east:
            raise ValueError("Inverted bounding box: west longitude must be less than east longitude")
        if south >= north:
            raise ValueError("Inverted bounding box: south latitude must be less than north latitude")
        return v

    @model_validator(mode="after")
    def validate_date_order(self):
        if self.start_date > self.end_date:
            raise ValueError("Start date must be earlier than or equal to end date")
        return self

class SearchResponse(BaseModel):
    dataset: str
    granules_found: int
    granules: List[GranuleMetadata]
    provenance: str = "NASA Earthdata CMR (Live Search)"

class DownloadRequest(BaseModel):
    dataset: str
    granule_urs: List[str]
    assets: List[str] = Field(default=["VV", "VH", "WTR"], description="Assets to extract")

class DownloadResponse(BaseModel):
    job_id: str
    status: str
    message: str
    granule_count: int

class DatasetInfo(BaseModel):
    id: str
    short_name: str
    title: str
    level: str
    sensor: str
    spatial_resolution_m: int
    provider: str
    doi: str
    description: str
    bands_or_polarizations: List[str]
    citation: str
