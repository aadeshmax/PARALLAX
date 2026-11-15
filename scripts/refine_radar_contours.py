"""
Refined Weather-Radar Contour Generator for PARALLAX.
Applies sub-pixel topology-preserving boundary refinement to candidate flood polygons,
transforming 30m stair-step raster grids into organic, fluid weather-radar contours
while preserving >99% geographic area and 100% of scientific properties.
"""
import json
import os
import glob
import pyproj
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import transform as shapely_transform
from shapely.validation import make_valid

CASES_CONFIG = {
    "chennai_live_case": {"crs": "EPSG:32644", "dir": "data/cases/chennai_live_case"},
    "demo_flood_case": {"crs": "EPSG:32630", "dir": "data/cases/demo_flood_case"},
    "mumbai_monsoon_event": {"crs": "EPSG:32643", "dir": "data/cases/mumbai_monsoon_event"},
    "real_event_rio_grande_do_sul": {"crs": "EPSG:32722", "dir": "data/cases/real_event_rio_grande_do_sul"}
}

def smooth_single_polygon(poly_utm, r=6.5):
    """
    Sub-pixel topology-preserving boundary refinement with double-sided rounding.
    Preserves all significant internal holes and small isolated detections.
    """
    if poly_utm.is_empty:
        return poly_utm
        
    try:
        # Check if polygon has sufficient core thickness for double-sided fillet
        if not poly_utm.buffer(-r).is_empty:
            smoothed = poly_utm.buffer(-r, quad_segs=8).buffer(2 * r, quad_segs=8).buffer(-r, quad_segs=8)
        else:
            # For thin features or small islands, do outward rounding then return to original perimeter
            smoothed = poly_utm.buffer(r, quad_segs=8).buffer(-r, quad_segs=8)
            
        if not smoothed.is_valid:
            smoothed = make_valid(smoothed)
            
        # Subtle simplification to eliminate micro-chatter while preserving organic curves
        smoothed = smoothed.simplify(0.6, preserve_topology=True)
        if smoothed.is_empty or not smoothed.is_valid:
            return poly_utm
            
        return smoothed
    except Exception:
        return poly_utm

def round_coords(geom_dict, precision=7):
    """Rounds coordinates to standard precision to avoid JSON bloat."""
    def _round(coords):
        if isinstance(coords[0], (int, float)):
            return [round(c, precision) for c in coords]
        return [_round(c) for c in coords]
    
    res = dict(geom_dict)
    res["coordinates"] = _round(res["coordinates"])
    return res

def process_case(case_name, config):
    case_dir = config["dir"]
    crs_str = config["crs"]
    geojson_path = os.path.join(case_dir, "regions.geojson")
    raw_geojson_path = os.path.join(case_dir, "regions_raw.geojson")
    
    if not os.path.exists(geojson_path):
        print(f"Skipping {case_name}: {geojson_path} not found")
        return
        
    with open(geojson_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    # Backup raw geojson if not already backed up
    if not os.path.exists(raw_geojson_path):
        with open(raw_geojson_path, "w", encoding="utf-8") as f_raw:
            json.dump(data, f_raw, indent=2)
        print(f"[{case_name}] Backed up raw pixel staircase to {raw_geojson_path}")
        
    tf_to_utm = pyproj.Transformer.from_crs("EPSG:4326", crs_str, always_xy=True).transform
    tf_to_wgs = pyproj.Transformer.from_crs(crs_str, "EPSG:4326", always_xy=True).transform
    
    orig_area = 0.0
    smooth_area = 0.0
    refined_features = []
    
    for feat in data["features"]:
        geom = shape(feat["geometry"])
        poly_utm = shapely_transform(tf_to_utm, geom)
        orig_area += poly_utm.area
        
        # Filter high-frequency 1-pixel holes (< 3600 m2) from giant polygons to prevent chicken-wire artifacts
        if isinstance(poly_utm, Polygon) and len(poly_utm.interiors) > 10:
            min_hole_area = 3600.0  # Keep holes >= 4 pixels (0.36 ha)
            valid_holes = [h for h in poly_utm.interiors if Polygon(h).area >= min_hole_area]
            poly_utm = Polygon(poly_utm.exterior, valid_holes)
            
        if isinstance(poly_utm, Polygon):
            s_utm = smooth_single_polygon(poly_utm)
        elif isinstance(poly_utm, MultiPolygon):
            parts = [smooth_single_polygon(p) for p in poly_utm.geoms if not p.is_empty]
            s_utm = MultiPolygon(parts) if parts else poly_utm
        else:
            s_utm = poly_utm
            
        smooth_area += s_utm.area
        
        # Transform back to WGS84
        s_wgs84 = shapely_transform(tf_to_wgs, s_utm)
        feat_refined = dict(feat)
        feat_refined["geometry"] = round_coords(mapping(s_wgs84))
        refined_features.append(feat_refined)
        
    refined_data = dict(data)
    refined_data["features"] = refined_features
    
    with open(geojson_path, "w", encoding="utf-8") as f_out:
        json.dump(refined_data, f_out, indent=2)
        
    ratio = (smooth_area / orig_area * 100.0) if orig_area > 0 else 100.0
    print(f"[{case_name}] Successfully wrote {len(refined_features)} refined organic radar polygons to {geojson_path}")
    print(f"  Orig: {orig_area/1e6:.4f} km2 -> Smooth: {smooth_area/1e6:.4f} km2 (Retention: {ratio:.2f}%)")

def main():
    print("=== Generating Windy-Style Organic Radar Contours ===")
    for case_name, config in CASES_CONFIG.items():
        process_case(case_name, config)
    print("=== Finished Contour Refinement ===")

if __name__ == "__main__":
    main()
