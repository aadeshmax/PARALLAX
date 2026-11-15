"""
XYZ Raster Tile Generator for TERRA//PULSE.
Converts analytical GeoTIFFs into Web Mercator XYZ tiles ({z}/{x}/{y}.png)
with identical radiometric stretches, smooth edge-feathering, and alpha transparency.
"""
import math
import os
import sys
from typing import Tuple, List, Dict
import numpy as np
from PIL import Image
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import reproject, Resampling, transform_bounds

ORIGIN_SHIFT = 20037508.342789244
TILE_SIZE = 256


def mercator_bounds_for_tile(z: int, x: int, y: int) -> Tuple[float, float, float, float]:
    """Returns (minx, miny, maxx, maxy) in EPSG:3857 for tile (z, x, y)."""
    num_tiles = 1 << z
    tile_size_merc = (2.0 * ORIGIN_SHIFT) / num_tiles
    minx = -ORIGIN_SHIFT + x * tile_size_merc
    maxx = minx + tile_size_merc
    maxy = ORIGIN_SHIFT - y * tile_size_merc
    miny = maxy - tile_size_merc
    return (minx, miny, maxx, maxy)


def tile_xy_for_lonlat(lon: float, lat: float, z: int) -> Tuple[int, int]:
    """Returns tile (x, y) for (lon, lat) at zoom z."""
    lat_rad = math.radians(lat)
    n = 1 << z
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (x, y)


def colormap_sar_db(arr: np.ndarray, vmin: float = -22.0, vmax: float = -2.5) -> Image.Image:
    """
    Renders high-contrast, photographic SAR backscatter (Umbra/Sentinel-1 style)
    with deep specular attenuation black and crisp double-bounce highlights.
    """
    rgba = np.zeros((TILE_SIZE, TILE_SIZE, 4), dtype=np.uint8)
    valid = np.isfinite(arr) & (arr > -90.0)

    clipped = np.clip(arr, vmin, vmax)
    clean = np.nan_to_num(clipped, nan=vmin)
    norm = (clean - vmin) / (vmax - vmin)

    # Gamma 0.85 curves texture out of shadows for crisp terrain & canopy detail
    enhanced = np.power(norm, 0.85) * 255.0
    val_uint8 = np.clip(enhanced, 0, 255).astype(np.uint8)

    rgba[..., 0] = val_uint8
    rgba[..., 1] = val_uint8
    rgba[..., 2] = val_uint8
    rgba[..., 3] = np.where(valid, 255, 0).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def colormap_diff_db(arr: np.ndarray) -> Image.Image:
    """
    Renders signed change in dB with smooth anti-aliased transitions:
    - Specular drop (<= -2.6 dB): Luminous Cyan/Blue
    - Neutral: Transparent
    - Double bounce (>= +2.2 dB): Vibrant Amber/Gold
    """
    rgba = np.zeros((TILE_SIZE, TILE_SIZE, 4), dtype=np.uint8)
    valid = np.isfinite(arr) & (arr > -90.0)

    # Specular darkening with smooth threshold transition
    specular_mask = valid & (arr <= -2.6)
    spec_intensity = np.clip((-arr - 2.6) / 8.0, 0.25, 1.0)
    rgba[specular_mask, 0] = (14 * spec_intensity[specular_mask]).astype(np.uint8)
    rgba[specular_mask, 1] = (165 * spec_intensity[specular_mask]).astype(np.uint8)
    rgba[specular_mask, 2] = (233 * spec_intensity[specular_mask]).astype(np.uint8)
    rgba[specular_mask, 3] = (210 * spec_intensity[specular_mask]).astype(np.uint8)

    # Double bounce enhancement with smooth threshold transition
    db_mask = valid & (arr >= 2.2)
    db_intensity = np.clip((arr - 2.2) / 5.0, 0.25, 1.0)
    rgba[db_mask, 0] = 245
    rgba[db_mask, 1] = 158
    rgba[db_mask, 2] = 11
    rgba[db_mask, 3] = (230 * db_intensity[db_mask]).astype(np.uint8)

    return Image.fromarray(rgba, "RGBA")


def colormap_mask(arr: np.ndarray, color_rgb: Tuple[int, int, int], alpha: int = 195) -> Image.Image:
    """
    Renders a fluid, anti-aliased categorical mask with smooth subpixel boundary transitions
    and atmospheric alpha falloff inspired by high-end weather radar systems.
    """
    rgba = np.zeros((TILE_SIZE, TILE_SIZE, 4), dtype=np.uint8)
    valid = np.isfinite(arr) & (arr > 0.02)
    # Smooth gamma falloff on intensity for anti-aliased sub-pixel boundaries
    norm_val = np.nan_to_num(np.clip(arr, 0.0, 1.0), nan=0.0)
    smooth_intensity = np.power(norm_val, 0.85)
    alpha_arr = (smooth_intensity * alpha).astype(np.uint8)
    rgba[valid, 0] = color_rgb[0]
    rgba[valid, 1] = color_rgb[1]
    rgba[valid, 2] = color_rgb[2]
    rgba[valid, 3] = alpha_arr[valid]
    return Image.fromarray(rgba, "RGBA")


def generate_tiles_for_layer(
    src_geotiff: str,
    output_dir: str,
    layer_name: str,
    colormap_type: str,
    zooms: List[int] = [11, 12, 13, 14, 15]
):
    with rasterio.open(src_geotiff) as src:
        src_crs = src.crs
        src_data = src.read(1).astype(np.float32)
        src_transform = src.transform
        src_nodata = src.nodata

        if colormap_type in ["sar_db", "diff_db"] and layer_name in ["pre_sar", "post_sar"]:
            valid_vals = src_data[np.isfinite(src_data)]
            if len(valid_vals) > 0 and np.nanquantile(valid_vals, 0.95) > 0:
                src_data = 10.0 * np.log10(np.maximum(src_data, 1e-5))

        # Apply smooth 6-pixel edge feathering to raster boundaries so it blends into the earth
        h, w = src_data.shape
        feather_mask = np.ones((h, w), dtype=np.float32)
        feather_dist = 8
        for i in range(feather_dist):
            factor = float(i) / float(feather_dist)
            feather_mask[i, :] = np.minimum(feather_mask[i, :], factor)
            feather_mask[h - 1 - i, :] = np.minimum(feather_mask[h - 1 - i, :], factor)
            feather_mask[:, i] = np.minimum(feather_mask[:, i], factor)
            feather_mask[:, w - 1 - i] = np.minimum(feather_mask[:, w - 1 - i], factor)

        wgs_bounds = transform_bounds(src_crs, "EPSG:4326", *src.bounds)
        min_lon, min_lat, max_lon, max_lat = wgs_bounds

        total_tiles = 0
        for z in zooms:
            x_min, y_min = tile_xy_for_lonlat(min_lon, max_lat, z)
            x_max, y_max = tile_xy_for_lonlat(max_lon, min_lat, z)

            for x in range(min(x_min, x_max), max(x_min, x_max) + 1):
                for y in range(min(y_min, y_max), max(y_min, y_max) + 1):
                    tile_bounds = mercator_bounds_for_tile(z, x, y)
                    tile_transform = from_bounds(*tile_bounds, TILE_SIZE, TILE_SIZE)

                    dest_tile = np.full((TILE_SIZE, TILE_SIZE), np.nan, dtype=np.float32)

                    reproject(
                        source=src_data,
                        destination=dest_tile,
                        src_transform=src_transform,
                        src_crs=src_crs,
                        dst_transform=tile_transform,
                        dst_crs="EPSG:3857",
                        src_nodata=src_nodata,
                        dst_nodata=np.nan,
                        resampling=Resampling.bilinear
                    )

                    if np.all(np.isnan(dest_tile)):
                        continue

                    # Resample feather mask
                    dest_feather = np.full((TILE_SIZE, TILE_SIZE), 0.0, dtype=np.float32)
                    reproject(
                        source=feather_mask,
                        destination=dest_feather,
                        src_transform=src_transform,
                        src_crs=src_crs,
                        dst_transform=tile_transform,
                        dst_crs="EPSG:3857",
                        src_nodata=0.0,
                        dst_nodata=0.0,
                        resampling=Resampling.bilinear
                    )

                    if colormap_type == "sar_db":
                        img = colormap_sar_db(dest_tile, vmin=-25.0, vmax=0.0)
                    elif colormap_type == "diff_db":
                        img = colormap_diff_db(dest_tile)
                    elif colormap_type == "opera_water":
                        img = colormap_mask(dest_tile, color_rgb=(50, 140, 255), alpha=195)
                    elif colormap_type == "gap_overlay":
                        img = colormap_mask(dest_tile, color_rgb=(255, 176, 32), alpha=210)
                    else:
                        img = colormap_mask(dest_tile, color_rgb=(200, 200, 200), alpha=150)

                    # Apply feather alpha modulation
                    arr_rgba = np.array(img)
                    arr_rgba[..., 3] = (arr_rgba[..., 3].astype(np.float32) * np.clip(dest_feather, 0.0, 1.0)).astype(np.uint8)
                    final_img = Image.fromarray(arr_rgba, "RGBA")

                    tile_path = os.path.join(output_dir, str(z), str(x), f"{y}.png")
                    os.makedirs(os.path.dirname(tile_path), exist_ok=True)
                    final_img.save(tile_path, "PNG")
                    total_tiles += 1

        print(f"Layer [{layer_name}]: Generated {total_tiles} XYZ tiles in {output_dir}")


def generate_all_case_tiles(
    case_dir: str = "data/cases/real_event_rio_grande_do_sul",
    processed_dir: str = "data/processed/rio_grande_do_sul_event",
    tiles_base_dir: str = None
):
    import glob
    if tiles_base_dir is None:
        tiles_base_dir = os.path.join(case_dir, "tiles")
    os.makedirs(tiles_base_dir, exist_ok=True)

    vv_files = sorted(
        glob.glob(os.path.join(case_dir, "*_VV.tif")) +
        glob.glob(os.path.join(case_dir, "*_vv.tif")) +
        glob.glob(os.path.join(case_dir, "*VV*.tif"))
    )
    pre_vv_path = None
    post_vv_path = None
    if os.path.exists(os.path.join(case_dir, "pre_rtc_vv.tif")):
        pre_vv_path = os.path.join(case_dir, "pre_rtc_vv.tif")
        post_vv_path = os.path.join(case_dir, "post_rtc_vv.tif")
    elif len(vv_files) >= 2:
        pre_vv_path = vv_files[0]
        post_vv_path = vv_files[1]
    elif len(vv_files) == 1:
        pre_vv_path = vv_files[0]
        post_vv_path = vv_files[0]

    dswx_files = sorted(
        glob.glob(os.path.join(case_dir, "*_WTR.tif")) +
        glob.glob(os.path.join(case_dir, "*aligned.tif")) +
        glob.glob(os.path.join(case_dir, "*dswx*.tif"))
    )
    dswx_path = dswx_files[0] if len(dswx_files) > 0 else None

    diff_db_path = os.path.join(processed_dir, "backscatter_diff_db.tif")
    opera_water_path = os.path.join(processed_dir, "baseline_water.tif")
    gap_path = os.path.join(processed_dir, "additional_candidate.tif")

    if not os.path.exists(opera_water_path) and dswx_path:
        opera_water_path = dswx_path

    layers = [
        {
            "name": "pre_sar",
            "path": pre_vv_path,
            "colormap": "sar_db"
        },
        {
            "name": "post_sar",
            "path": post_vv_path,
            "colormap": "sar_db"
        },
        {
            "name": "diff_db",
            "path": diff_db_path if os.path.exists(diff_db_path) else None,
            "colormap": "diff_db"
        },
        {
            "name": "opera_water",
            "path": opera_water_path if os.path.exists(opera_water_path) else None,
            "colormap": "opera_water"
        },
        {
            "name": "gap_overlay",
            "path": gap_path if os.path.exists(gap_path) else None,
            "colormap": "gap_overlay"
        }
    ]

    for layer in layers:
        if not layer["path"] or not os.path.exists(layer["path"]):
            continue
        out_layer_dir = os.path.join(tiles_base_dir, layer["name"])
        generate_tiles_for_layer(
            src_geotiff=layer["path"],
            output_dir=out_layer_dir,
            layer_name=layer["name"],
            colormap_type=layer["colormap"],
            zooms=[11, 12, 13, 14, 15]
        )


if __name__ == "__main__":
    if len(sys.argv) > 1:
        case_dir = sys.argv[1]
        proc_dir = sys.argv[2] if len(sys.argv) > 2 else f"data/processed/{os.path.basename(case_dir)}"
        generate_all_case_tiles(case_dir=case_dir, processed_dir=proc_dir)
    else:
        cases_map = [
            ("data/cases/real_event_rio_grande_do_sul", "data/processed/rio_grande_do_sul_event"),
            ("data/cases/mumbai_monsoon_event", "data/processed/mumbai_monsoon_event"),
            ("data/cases/chennai_live_case", "data/processed/chennai_live_case"),
            ("data/cases/demo_flood_case", "data/processed/demo_flood_case"),
        ]
        for c_dir, p_dir in cases_map:
            if os.path.exists(c_dir):
                print(f"=== Generating smooth raster tiles for {os.path.basename(c_dir)} ===")
                try:
                    generate_all_case_tiles(case_dir=c_dir, processed_dir=p_dir)
                except Exception as e:
                    print(f"Error on {c_dir}: {e}")
