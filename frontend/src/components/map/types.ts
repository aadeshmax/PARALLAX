export interface RegionProperties {
  region_id: string;
  area_km2: number;
  candidate_type: "specular" | "double_bounce";
  opera_status: "agreement" | "additional_candidate";
  vegetation_class: string;
  before_scene_ids: string[];
  after_scene_id: string;
  vv_baseline_db: number;
  vv_after_db: number;
  vv_delta_db: number;
  hv_reference_db?: number | null;
  confidence_score: number;
  valid_fraction: number;
  quality_flags: string[];
  threshold_id: string;
  sensitivity_summary: string;
  validation_status: string;
  interpretation: string;
  caution: string;
}

export interface CaseLayer {
  id: string;
  name: string;
  type: "raster";
  tile_url_template: string;
  minzoom: number;
  maxzoom: number;
  description: string;
}

export interface CaseManifest {
  schema_version: string;
  case_id: string;
  event_name: string;
  aoi_bbox: [number, number, number, number];
  center: [number, number, number];
  analysis_crs: string;
  grid_resolution: number;
  layers: CaseLayer[];
  regions_url: string;
  statistics: Record<string, number>;
  limitations: string[];
  generated_at: string;
  evidence_mode: string;
}
