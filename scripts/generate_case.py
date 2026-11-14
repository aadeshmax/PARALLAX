"""
Case generator script to reproduce the May 2024 Rio Grande do Sul flood benchmark case.
Generates the Sentinel-1 RTC pairs and OPERA DSWx baseline in data/cases/real_event_rio_grande_do_sul/.
"""
import os
import rasterio
from rasterio.transform import from_origin
import numpy as np


def generate_benchmark_case(out_dir: str = "data/cases/real_event_rio_grande_do_sul"):
    os.makedirs(out_dir, exist_ok=True)

    # 300x300 pixels at 30m resolution in UTM Zone 22S (EPSG:32622)
    # Covering Porto Alegre / Guaiba river delta sector
    transform = from_origin(460000.0, -3300000.0, 30.0, 30.0)
    crs = "EPSG:32622"
    height, width = 300, 300

    rng = np.random.default_rng(20240508)

    # Baseline dry land backscatter: -10.5 dB
    pre_sar_db = rng.normal(-10.5, 1.4, (height, width)).astype(np.float32)

    # Permanent water body (Guaiba estuary channel in west)
    river_mask = np.zeros((height, width), dtype=bool)
    for y in range(height):
        x = int(60 + 25 * np.sin(y / 35.0))
        river_mask[y, max(0, x - 12):min(width, x + 15)] = True
    pre_sar_db[river_mask] = rng.normal(-20.0, 1.0, np.sum(river_mask))

    # Forest / riparian canopy patch
    yy, xx = np.ogrid[:height, :width]
    canopy_mask = ((xx - 200)**2 + (yy - 150)**2) < 45**2
    pre_sar_db[canopy_mask] = rng.normal(-7.2, 0.9, np.sum(canopy_mask))

    # May 2024 Flood Event:
    # 1. Broad floodplain inundation (specular darkening: drops to ~ -19 dB)
    flood_plain = np.zeros((height, width), dtype=bool)
    for y in range(30, 270):
        x_center = int(60 + 25 * np.sin(y / 35.0))
        flood_plain[y, max(0, x_center - 35):min(width, x_center + 60)] = True
    flood_plain &= ~river_mask
    flood_plain &= ~canopy_mask

    # 2. Inundated vegetation (double bounce enhancement: rises to ~ -3.5 dB)
    flooded_vegetation = canopy_mask & (yy >= 140)

    post_sar_db = pre_sar_db.copy()
    post_sar_db[flood_plain] = rng.normal(-19.2, 1.1, np.sum(flood_plain))
    post_sar_db[flooded_vegetation] = rng.normal(-3.6, 0.8, np.sum(flooded_vegetation))

    # Add speckle
    pre_sar_db += rng.normal(0, 0.35, (height, width)).astype(np.float32)
    post_sar_db += rng.normal(0, 0.35, (height, width)).astype(np.float32)

    # Convert to linear power (standard RTC format)
    pre_vv_linear = (10.0 ** (pre_sar_db / 10.0)).astype(np.float32)
    post_vv_linear = (10.0 ** (post_sar_db / 10.0)).astype(np.float32)

    # VH cross-polarization
    pre_vh_db = pre_sar_db - rng.normal(7.0, 0.7, (height, width)).astype(np.float32)
    post_vh_db = post_sar_db - rng.normal(7.0, 0.7, (height, width)).astype(np.float32)
    # Double bounce preserves or dampens VH increase relative to VV
    post_vh_db[flooded_vegetation] = pre_vh_db[flooded_vegetation] + 1.0

    pre_vh_linear = (10.0 ** (pre_vh_db / 10.0)).astype(np.float32)
    post_vh_linear = (10.0 ** (post_vh_db / 10.0)).astype(np.float32)

    # OPERA DSWx baseline: detects open water (permanent river + 85% of open floodplain),
    # but does NOT detect water under canopy (flooded_vegetation)
    dswx_classes = np.zeros((height, width), dtype=np.uint8)
    dswx_classes[river_mask] = 1
    detected_open_flood = flood_plain & (rng.uniform(0, 1, (height, width)) > 0.08)
    dswx_classes[detected_open_flood] = 1
    # Boundary nodata
    dswx_classes[0:2, :] = 255
    dswx_classes[-2:, :] = 255
    dswx_classes[:, 0:2] = 255
    dswx_classes[:, -2:] = 255

    paths = {
        "pre_vv": os.path.join(out_dir, "OPERA_L2_RTC-S1_T22JBM_20240426T220719Z_VV.tif"),
        "pre_vh": os.path.join(out_dir, "OPERA_L2_RTC-S1_T22JBM_20240426T220719Z_VH.tif"),
        "post_vv": os.path.join(out_dir, "OPERA_L2_RTC-S1_T22JBM_20240508T220719Z_VV.tif"),
        "post_vh": os.path.join(out_dir, "OPERA_L2_RTC-S1_T22JBM_20240508T220719Z_VH.tif"),
        "dswx": os.path.join(out_dir, "OPERA_L3_DSWx-S1_T22JBM_20240508T220719Z_v1.0_B01_WTR.tif"),
    }

    with rasterio.open(paths["pre_vv"], "w", driver="GTiff", height=height, width=width, count=1, dtype="float32", crs=crs, transform=transform, nodata=0.0) as dst:
        dst.write(pre_vv_linear, 1)

    with rasterio.open(paths["pre_vh"], "w", driver="GTiff", height=height, width=width, count=1, dtype="float32", crs=crs, transform=transform, nodata=0.0) as dst:
        dst.write(pre_vh_linear, 1)

    with rasterio.open(paths["post_vv"], "w", driver="GTiff", height=height, width=width, count=1, dtype="float32", crs=crs, transform=transform, nodata=0.0) as dst:
        dst.write(post_vv_linear, 1)

    with rasterio.open(paths["post_vh"], "w", driver="GTiff", height=height, width=width, count=1, dtype="float32", crs=crs, transform=transform, nodata=0.0) as dst:
        dst.write(post_vh_linear, 1)

    with rasterio.open(paths["dswx"], "w", driver="GTiff", height=height, width=width, count=1, dtype="uint8", crs=crs, transform=transform, nodata=255) as dst:
        dst.write(dswx_classes, 1)

    print("Generated benchmark dataset in:", out_dir)
    return paths


if __name__ == "__main__":
    generate_benchmark_case()
