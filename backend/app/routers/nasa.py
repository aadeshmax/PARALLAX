import os
import json
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.config import settings
from app.auth.earthdata import auth_manager
from app.schemas.nasa import (
    EarthdataStatusResponse,
    SearchRequest,
    SearchResponse,
    DownloadRequest,
    DownloadResponse,
    DatasetInfo,
)
from app.schemas.analysis import ProcessRequest, AnalysisMetrics, DataProvenance
from app.services.search_service import search_service
from app.services.download_service import download_service
from app.services.detection_engine import detection_engine
from app.services.job_manager import job_manager
from app.database import save_analysis_record

logger = logging.getLogger("parallax.api.nasa")
router = APIRouter(prefix="/api/nasa", tags=["NASA Earthdata"])

DATASETS_METADATA = [
    DatasetInfo(
        id="OPERA_L3_DSWX-S1_V1",
        short_name="OPERA_L3_DSWX-S1_V1",
        title="OPERA Level-3 Dynamic Surface Water Extent from Sentinel-1",
        level="Level-3",
        sensor="Sentinel-1 C-SAR",
        spatial_resolution_m=30,
        provider="NASA PO.DAAC / JPL",
        doi="https://doi.org/10.5067/SN1OP-DSW30",
        description=(
            "Provides 30-meter pixel-level surface water classifications (open water, "
            "partial water) generated from Sentinel-1 radar backscatter imagery."
        ),
        bands_or_polarizations=["B01_WTR (Water Mask)", "B02_BWTR (Binary Water)", "B03_CONF (Confidence)", "B04_DIAG (Diagnostic)"],
        citation="OPERA Project. (2024). OPERA Level-3 Dynamic Surface Water Extent from Sentinel-1 (OPERA_L3_DSWX-S1_V1). NASA PO.DAAC."
    ),
    DatasetInfo(
        id="OPERA_L2_RTC-S1_V1",
        short_name="OPERA_L2_RTC-S1_V1",
        title="OPERA Level-2 Radiometric Terrain Corrected SAR from Sentinel-1",
        level="Level-2",
        sensor="Sentinel-1 C-SAR",
        spatial_resolution_m=30,
        provider="NASA Alaska Satellite Facility (ASF) DAAC / JPL",
        doi="https://doi.org/10.5067/SN1OP-RTC20",
        description=(
            "Radiometrically terrain-corrected radar backscatter (gamma0) normalized for topography. "
            "Enables sensitive pre-to-post change detection across copolarized (VV) and crosspolarized (VH) channels."
        ),
        bands_or_polarizations=["VV (Co-polarization)", "VH (Cross-polarization)", "mask (Valid Data Mask)"],
        citation="OPERA Project. (2024). OPERA Level-2 Radiometric Terrain Corrected SAR from Sentinel-1 (OPERA_L2_RTC-S1_V1). NASA ASF DAAC."
    )
]

@router.get("/status", response_model=EarthdataStatusResponse)
def get_earthdata_status():
    """Returns NASA Earthdata authentication verification and DAAC service status."""
    return auth_manager.authenticate()

@router.get("/datasets", response_model=List[DatasetInfo])
def list_supported_datasets():
    """Lists integrated NASA Earthdata satellite datasets with scientific citations and bands."""
    return DATASETS_METADATA

@router.post("/search", response_model=SearchResponse)
def search_earthdata(payload: SearchRequest):
    """
    Discovers available satellite granules within geographic bounding box, date range,
    and dataset collection identifier using NASA CMR.
    """
    return search_service.search_granules(
        dataset=payload.dataset,
        bbox=payload.bbox,
        start_date=payload.start_date,
        end_date=payload.end_date,
        polarization=payload.polarization,
        limit=payload.limit
    )

@router.post("/download", response_model=DownloadResponse)
def initiate_download(payload: DownloadRequest):
    """
    Initiates asynchronous download of requested satellite granules and GeoTIFF assets.
    Tracks progress and checks local cache.
    """
    job_id = job_manager.create_job("download", {"dataset": payload.dataset, "granules": payload.granule_urs})
    job_manager.submit(
        job_id,
        download_service.download_assets,
        granule_urs=payload.granule_urs,
        dataset=payload.dataset
    )
    return DownloadResponse(
        job_id=job_id,
        status="pending",
        message="Satellite data download initiated as background job.",
        granule_count=len(payload.granule_urs)
    )

@router.post("/process", response_model=AnalysisMetrics)
def process_satellite_imagery(payload: ProcessRequest):
    """
    Ingests pre/post RTC-S1 radar rasters and OPERA DSWx, executes backscatter change
    detection, classifies specular and double-bounce inundated vegetation, and cross-compares.
    """
    case_dir = settings.CASES_DIR / (payload.case_id or "demo_flood_case")
    if not case_dir.exists():
        raise HTTPException(status_code=404, detail=f"Case directory '{payload.case_id}' not found.")

    pre_vv = str(case_dir / "pre_rtc_vv.tif")
    post_vv = str(case_dir / "post_rtc_vv.tif")
    pre_vh = str(case_dir / "pre_rtc_vh.tif")
    post_vh = str(case_dir / "post_rtc_vh.tif")
    dswx = str(case_dir / "opera_dswx_aligned.tif")

    if not os.path.exists(post_vv) or not os.path.exists(pre_vv):
        vv_files = sorted(list(case_dir.glob("*VV*.tif")))
        vh_files = sorted(list(case_dir.glob("*VH*.tif")))
        wtr_files = sorted(list(case_dir.glob("*WTR*.tif")) + list(case_dir.glob("*DSWx*.tif")))
        if len(vv_files) >= 2:
            pre_vv = str(vv_files[0])
            post_vv = str(vv_files[1])
        if len(vh_files) >= 2:
            pre_vh = str(vh_files[0])
            post_vh = str(vh_files[1])
        if wtr_files:
            dswx = str(wtr_files[0])

    if not os.path.exists(post_vv) or not os.path.exists(pre_vv):
        raise HTTPException(
            status_code=400,
            detail=f"Missing required pre or post RTC-S1 GeoTIFF rasters in case directory '{payload.case_id}'."
        )

    # Execute analysis engine
    result = detection_engine.analyze_scene(
        pre_vv_path=pre_vv,
        post_vv_path=post_vv,
        pre_vh_path=pre_vh if os.path.exists(pre_vh) else None,
        post_vh_path=post_vh if os.path.exists(post_vh) else None,
        dswx_path=dswx if os.path.exists(dswx) else None,
        darkening_thresh_db=payload.darkening_threshold_db,
        brightening_thresh_db=payload.brightening_threshold_db,
        case_id=payload.case_id or "demo_flood_case"
    )

    # Read manifest if present in case directory for real provenance
    manifest = {}
    manifest_file = case_dir / "manifest.json"
    if manifest_file.exists():
        try:
            with open(manifest_file, "r") as f:
                manifest = json.load(f)
        except Exception as e:
            logger.warning("Error reading manifest for %s: %s", case_dir.name, e)

    is_demo = manifest.get("provenance", {}).get(
        "demonstration_mode", (payload.case_id or "") == "demo_flood_case"
    )
    data_label = "verified_cached_demonstration" if is_demo else "live_nasa_earthdata"

    provenance = DataProvenance(
        pre_event_granule=manifest.get("pre_event", {}).get(
            "granule_id", "OPERA_L2_RTC-S1_T001-000288-IW3_20240110T181405Z_v1.0"
        ),
        post_event_granule=manifest.get("post_event", {}).get(
            "granule_id", "OPERA_L2_RTC-S1_T001-000288-IW3_20240122T181405Z_v1.0"
        ),
        dswx_granule=manifest.get("dswx", {}).get(
            "granule_id", "OPERA_L3_DSWx-S1_T001-000288-IW3_20240122_v1.0"
        ),
        acquisition_date_pre=manifest.get("pre_event", {}).get(
            "acquisition_date", "2024-01-10T18:14:05Z"
        ),
        acquisition_date_post=manifest.get("post_event", {}).get(
            "acquisition_date", "2024-01-22T18:14:05Z"
        ),
        is_demonstration_scene=is_demo,
        data_label=data_label,
        disclaimer=(
            "Treat newly identified areas as candidate inundation until independently validated. "
            "Cross-product comparison between Sentinel-1 Level-2 RTC and Level-3 DSWx highlights "
            "complementary radar sensitivity under vegetated canopies without claiming unverified ground-truth superiority."
        ),
        citations=[d.citation for d in DATASETS_METADATA],
        comparison_type="cross-product",
        confidence_metric_basis="Heuristic radar backscatter change amplitude, not calibrated flood probability"
    )

    created_at = manifest.get("post_event", {}).get("acquisition_date", "2024-01-22T18:14:05Z")

    metrics = AnalysisMetrics(
        analysis_id=result["analysis_id"],
        case_id=result["case_id"],
        total_aoi_km2=result["total_aoi_km2"],
        open_water_km2=result["open_water_km2"],
        candidate_inundated_veg_km2=result["candidate_inundated_veg_km2"],
        opera_dswx_water_km2=result["opera_dswx_water_km2"],
        cross_sensor_breakdown=result["cross_sensor_breakdown"],
        radar_statistics=result["radar_statistics"],
        confidence_summary=result["confidence_summary"],
        provenance=provenance,
        layer_urls=result["layer_urls"],
        created_at=created_at,
        common_valid_aoi_km2=result.get("common_valid_aoi_km2"),
        ocean_masked_km2=result.get("ocean_masked_km2"),
        permanent_water_km2=result.get("permanent_water_km2"),
        spatial_union_km2=result.get("spatial_union_km2"),
        parallax_only_km2=result.get("parallax_only_km2"),
        processing_version=result.get("processing_version", "v2.0-scientific-integrity")
    )
    save_analysis_record(metrics.model_dump())
    return metrics
