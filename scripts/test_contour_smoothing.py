import json
import os
import glob
import pyproj
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import transform as shapely_transform
from shapely.validation import make_valid

CASES_CRS = {
    "chennai_live_case": "EPSG:32644",
    "demo_flood_case": "EPSG:32630",
    "mumbai_monsoon_event": "EPSG:32643",
    "real_event_rio_grande_do_sul": "EPSG:32722"
}

def smooth_polygon(poly_utm, r=6.5):
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
            # For thin features, do outward rounding then return to original perimeter
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

def test_cases():
    for case_id, crs_str in CASES_CRS.items():
        geojson_path = f"data/cases/{case_id}/regions.geojson"
        if not os.path.exists(geojson_path):
            print(f"Skipping {case_id}: file not found")
            continue
            
        with open(geojson_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        tf_to_utm = pyproj.Transformer.from_crs("EPSG:4326", crs_str, always_xy=True).transform
        tf_to_wgs = pyproj.Transformer.from_crs(crs_str, "EPSG:4326", always_xy=True).transform
        
        orig_area = 0.0
        smooth_area = 0.0
        feature_count = len(data["features"])
        
        for feat in data["features"]:
            geom = shape(feat["geometry"])
            poly_utm = shapely_transform(tf_to_utm, geom)
            orig_area += poly_utm.area
            
            if isinstance(poly_utm, Polygon):
                s_utm = smooth_polygon(poly_utm)
            elif isinstance(poly_utm, MultiPolygon):
                parts = [smooth_polygon(p) for p in poly_utm.geoms if not p.is_empty]
                s_utm = MultiPolygon(parts) if parts else poly_utm
            else:
                s_utm = poly_utm
                
            smooth_area += s_utm.area
            
        ratio = (smooth_area / orig_area * 100.0) if orig_area > 0 else 100.0
        print(f"[{case_id}] Features: {feature_count} | Orig: {orig_area/1e6:.4f} km2 | Smooth: {smooth_area/1e6:.4f} km2 | Retention: {ratio:.2f}%")

if __name__ == "__main__":
    test_cases()
