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
  title?: string;
  event_name?: string;
  location?: string;
  crs?: string;
  analysis_crs?: string;
  bounds_utm?: number[];
  bounds_wgs84?: number[];
  aoi_bbox?: number[];
  center: [number, number] | [number, number, number];
  statistics?: any;
  layers?: any[];
  regions_url?: string;
  pre_event?: {
    granule_id?: string;
    acquisition_date?: string;
    sensor?: string;
  };
  post_event?: {
    granule_id?: string;
    acquisition_date?: string;
    sensor?: string;
  };
  scenes?: Array<{
    scene_id: string;
    acquisition_timestamp?: string;
    polarization?: string;
  }>;
  reference_product?: any;
}

export type ComparisonMode = 'swipe' | 'side-by-side' | 'temporal' | 'difference';
export type InspectorTab = 'overview' | 'evidence' | 'symbology' | 'provenance';
export type TopTool = 'area' | 'measure' | 'layers' | 'compare' | null;

export interface LayerStateItem {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0 to 100
  color?: string;
  disabled?: boolean;
  badge?: string;
}

export interface LayerGroupsState {
  earthObservation: {
    satelliteBasemap: LayerStateItem;
    preEventSar: LayerStateItem;
    postEventSar: LayerStateItem;
  };
  floodInundation: {
    operaMappedWater: LayerStateItem;
    candidateFloodwater: LayerStateItem;
    permanentWater: LayerStateItem;
    sarBackscatterChanges: LayerStateItem;
    uncertaintyNoData: LayerStateItem;
  };
  spatialContext: {
    studyAreaBoundary: LayerStateItem;
    roads: LayerStateItem;
    waterBodies: LayerStateItem;
    administrativeBoundaries: LayerStateItem;
  };
}

export interface TimelineObservation {
  id: string;
  label: string;
  timestamp: string;
  sensor: string;
  thumbnailUrl?: string;
  granuleId?: string;
}
