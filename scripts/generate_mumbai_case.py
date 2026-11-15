"""
Case generator script for the Mumbai Monsoon Flood & Mangrove Inundation Benchmark.
Generates Sentinel-1 RTC pairs and OPERA DSWx baseline in data/cases/mumbai_monsoon_event/.
Simulates the Mithi River overflow and Thane Creek flooded mangrove canopies.
"""
import os
import rasterio
from rasterio.transform import from_origin
import numpy as np
from scipy.ndimage import gaussian_filter


def generate_mumbai_case(out_dir: str = "data/cases/mumbai_monsoon_event"):
    os.makedirs(out_dir, exist_ok=True)

    # 300x300 pixels at 30m resolution in UTM Zone 43N (EPSG:32643)
    # Covering Central Mumbai: Mithi River, Mahim Bay & Thane Creek Mangrove sector (9km x 9km)
    transform = from_origin(275000.0, 2120000.0, 30.0, 30.0)
    crs = "EPSG:32643"
    height, width = 300, 300

    rng = np.random.default_rng(20230726)
    yy, xx = np.mgrid[0:height, 0:width]

    # 1. Coastal Mumbai Topography (East to West coastal gradient)
    base_dem = (xx / float(width)) * 18.0
    noise_coarse = gaussian_filter(rng.normal(0, 12, (height, width)), sigma=24.0)
    noise_fine = gaussian_filter(rng.normal(0, 4, (height, width)), sigma=6.0)
    dem = base_dem + noise_coarse + noise_fine

    # 2. Mithi River & Mahim Creek Channel
    # Winding urban channel through the center/west
    river_x = 90.0 + 35.0 * np.sin(yy / 32.0) + 12.0 * np.cos(yy / 15.0)
    channel_width = 8.0 + 3.0 * np.sin(yy / 20.0)
    river_mask = np.abs(xx - river_x) <= channel_width

    # Thane Creek coastal mudflats in the east
    creek_east = (xx >= 235) & (yy >= 40)
    river_mask |= creek_east
    dem[river_mask] -= 15.0

    # 3. Dense Mangrove & Wetland Canopy Corridors
    # Along Thane Creek banks and Mahim Nature Park
    mangrove_field = gaussian_filter(rng.normal(0, 1, (height, width)), sigma=14.0)
    mangrove_bias = np.exp(-((xx - 210)**2 + (yy - 140)**2) / (2 * 55**2))
    mangrove_score = mangrove_field + 1.8 * mangrove_bias
    mangrove_mask = (mangrove_score > 0.40) & (~river_mask)

    # 4. Pre-Monsoon Baseline (May 2023 Dry Season)
    # Urban built-up / dry soil: ~ -9.5 dB
    pre_sar_db = rng.normal(-9.8, 1.4, (height, width)).astype(np.float32)
    # Permanent creek/bay water: -22.0 dB
    pre_sar_db[river_mask] = rng.normal(-22.0, 0.9, np.sum(river_mask))
    # Mangrove canopy: dense volume scattering (-6.8 dB)
    pre_sar_db[mangrove_mask] = rng.normal(-6.8, 0.8, np.sum(mangrove_mask))

    # 5. Monsoon Flood Event (July 2023 Deluge)
    # Extreme monsoon rainfall inundates coastal plains & low-lying airport perimeter
    flood_elevation = 11.5
    inundated = (dem <= flood_elevation) & (~river_mask)
    inundated = gaussian_filter(inundated.astype(float), sigma=2.2) > 0.4
    inundated &= (~river_mask)

    open_flood = inundated & (~mangrove_mask)
    flooded_mangroves = inundated & mangrove_mask

    post_sar_db = pre_sar_db.copy()
    # Specular drop on flooded urban lowlands & tarmac (drops to -20.2 dB)
    post_sar_db[open_flood] = rng.normal(-20.2, 1.0, np.sum(open_flood))
    # Major double-bounce surge in flooded mangroves (+4.6 dB increase -> -2.2 dB)
    post_sar_db[flooded_mangroves] = rng.normal(-2.2, 0.7, np.sum(flooded_mangroves))

    # Add realistic SAR speckle
    pre_sar_db += rng.normal(0, 0.4, (height, width)).astype(np.float32)
    post_sar_db += rng.normal(0, 0.4, (height, width)).astype(np.float32)

    pre_vv_linear = (10.0 ** (pre_sar_db / 10.0)).astype(np.float32)
    post_vv_linear = (10.0 ** (post_sar_db / 10.0)).astype(np.float32)

    pre_vh_db = pre_sar_db - rng.normal(7.5, 0.6, (height, width)).astype(np.float32)
    post_vh_db = post_sar_db - rng.normal(7.5, 0.6, (height, width)).astype(np.float32)
    post_vh_db[flooded_mangroves] = pre_vh_db[flooded_mangroves] + 0.6
    pre_vh_linear = (10.0 ** (pre_vh_db / 10.0)).astype(np.float32)
    post_vh_linear = (10.0 ** (post_vh_db / 10.0)).astype(np.float32)

    # 6. NASA OPERA DSWx Baseline
    # OPERA detects open floodwater & creeks, but misses water concealed beneath dense mangrove foliage
    dswx_classes = np.zeros((height, width), dtype=np.uint8)
    dswx_classes[river_mask] = 1
    detected_open = open_flood & (rng.uniform(0, 1, (height, width)) > 0.06)
    dswx_classes[detected_open] = 1
    dswx_classes[0:2, :] = 255
    dswx_classes[-2:, :] = 255
    dswx_classes[:, 0:2] = 255
    dswx_classes[:, -2:] = 255

    paths = {
        "pre_vv": os.path.join(out_dir, "OPERA_L2_RTC-S1_MUMBAI_20230514T124500Z_VV.tif"),
        "pre_vh": os.path.join(out_dir, "OPERA_L2_RTC-S1_MUMBAI_20230514T124500Z_VH.tif"),
        "post_vv": os.path.join(out_dir, "OPERA_L2_RTC-S1_MUMBAI_20230726T124500Z_VV.tif"),
        "post_vh": os.path.join(out_dir, "OPERA_L2_RTC-S1_MUMBAI_20230726T124500Z_VH.tif"),
        "dswx": os.path.join(out_dir, "OPERA_L3_DSWx-S1_MUMBAI_20230726T124500Z_v1.0_B01_WTR.tif"),
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

    print("Generated Mumbai Monsoon Flood case in:", out_dir)
    return paths


if __name__ == "__main__":
    generate_mumbai_case()
