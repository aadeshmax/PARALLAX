export interface EarthdataStatus {
  authenticated: boolean;
  configured: boolean;
  username_masked: string | null;
  status: string;
  error_message: string | null;
  demo_fallback_active: boolean;
  daac_status: {
    asf: string;
    podaac: string;
    cmr: string;
  };
}

export interface DatasetInfo {
  id: string;
  short_name: string;
  title: string;
  level: string;
  sensor: string;
  spatial_resolution_m: number;
  provider: string;
  doi: string;
  description: string;
  bands_or_polarizations: string[];
  citation: string;
}

export interface GranuleMetadata {
  granule_ur: string;
  title: string;
  dataset: string;
  acquisition_time: string;
  cloud_cover: number | null;
  size_mb: number;
  data_links: string[];
  bounding_box: number[];
  polarizations: string[];
}

export interface AnalysisMetrics {
  analysis_id: string;
  case_id: string;
  total_aoi_km2: number;
  open_water_km2: number;
  candidate_inundated_veg_km2: number;
  opera_dswx_water_km2: number;
  cross_sensor_breakdown: {
    agreement_open_water_km2: number;
    candidate_hidden_water_km2: number;
    opera_only_water_km2: number;
    unflooded_land_km2: number;
  };
  radar_statistics: {
    baseline_vv_mean_db: number;
    event_vv_mean_db: number;
    mean_db_change_open_water: number;
    mean_db_change_vegetation: number;
  };
  confidence_summary: {
    high_pct: number;
    medium_pct: number;
    low_pct: number;
  };
  provenance: {
    pre_event_granule: string;
    post_event_granule: string;
    dswx_granule: string;
    acquisition_date_pre: string;
    acquisition_date_post: string;
    is_demonstration_scene: boolean;
    data_label: string;
    disclaimer: string;
    citations: string[];
  };
  layer_urls: {
    geojson: string;
    classification_tif: string;
  };
  created_at: string;
}

export interface CaseStudy {
  case_id: string;
  title: string;
  location: string;
  crs: string;
  bounds_utm: number[];
  bounds_wgs84: number[];
  center: [number, number];
  pre_event: {
    granule_id: string;
    acquisition_date: string;
    sensor: string;
  };
  post_event: {
    granule_id: string;
    acquisition_date: string;
    sensor: string;
  };
}
