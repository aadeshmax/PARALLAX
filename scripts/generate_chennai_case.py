"""
Case generator script for Chennai Cyclone Fengal & Cooum/Adyar River Inundation.
Generates Sentinel-1 RTC pairs and OPERA DSWx baseline in data/cases/chennai_live_case/.
"""
import os
import rasterio
from rasterio.transform import from_origin
import numpy as np
from scipy.ndimage import gaussian_filter


def generate_chennai_case(out_dir: str = "data/cases/chennai_live_case"):
    os.makedirs(out_dir, exist_ok=True)

    # 300x300 pixels at 30m resolution in UTM Zone 44N (EPSG:32644)
    # Covering Central Chennai: Cooum & Adyar rivers, Pallikaranai marshland & Bay of Bengal coast (9km x 9km)
    transform = from_origin(400000.0, 1470000.0, 30.0, 30.0)
    crs = "EPSG:32644"
    height, width = 300, 300

    rng = np.random.default_rng(20241206)
    yy, xx = np.mgrid[0:height, 0:width]

    # 1. Coastal Topography (West to East coastal plain towards Bay of Bengal)
    base_dem = (xx / float(width)) * 14.0
    noise_coarse = gaussian_filter(rng.normal(0, 10, (height, width)), sigma=20.0)
    noise_fine = gaussian_filter(rng.normal(0, 3, (height, width)), sigma=5.0)
    dem = base_dem + noise_coarse + noise_fine

    # 2. Cooum & Adyar River Channels
    river_x = 110.0 + 30.0 * np.sin(yy / 35.0) + 10.0 * np.cos(yy / 18.0)
    channel_width = 7.0 + 2.5 * np.sin(yy / 22.0)
    river_mask = np.abs(xx - river_x) <= channel_width

    # Bay of Bengal coastal waters to the east
    coast_east = xx >= 255
    river_mask |= coast_east
    dem[river_mask] -= 12.0

    # 3. Pallikaranai Marshlands & Dense Riparian Buffer
    marsh_field = gaussian_filter(rng.normal(0, 1, (height, width)), sigma=12.0)
    marsh_bias = np.exp(-((xx - 180)**2 + (yy - 160)**2) / (2 * 50**2))
    marsh_score = marsh_field + 1.8 * marsh_bias
    marsh_mask = (marsh_score > 0.35) & (~river_mask)

    # 4. Pre-Cyclone Baseline (Nov 2024 Pre-Fengal)
    pre_sar_db = rng.normal(-10.2, 1.3, (height, width)).astype(np.float32)
    pre_sar_db[river_mask] = rng.normal(-22.5, 0.8, np.sum(river_mask))
    pre_sar_db[marsh_mask] = rng.normal(-7.2, 0.9, np.sum(marsh_mask))

    # 5. Post-Cyclone Flood (Dec 2024 Deluge)
    flood_elevation = 10.5
    inundated = (dem <= flood_elevation) & (~river_mask)

    post_sar_db = pre_sar_db.copy()
    open_flood = inundated & (~marsh_mask)
    post_sar_db[open_flood] = rng.normal(-21.8, 1.0, np.sum(open_flood))

    flooded_marsh = inundated & marsh_mask
    post_sar_db[flooded_marsh] += rng.normal(4.2, 0.6, np.sum(flooded_marsh)).astype(np.float32)

    # Convert dB to linear for RTC GeoTIFFs
    pre_vv_linear = 10.0 ** (pre_sar_db / 10.0)
    post_vv_linear = 10.0 ** (post_sar_db / 10.0)
    pre_vh_linear = pre_vv_linear * 0.25
    post_vh_linear = post_vv_linear * 0.28

    # 6. OPERA DSWx Baseline (Optical/Standard SAR classified water)
    dswx_arr = np.zeros((height, width), dtype=np.uint8)
    dswx_arr[river_mask] = 1 # Open permanent water
    dswx_arr[open_flood & (rng.random((height, width)) > 0.12)] = 1 # Open flood detected
    dswx_arr[flooded_marsh & (rng.random((height, width)) < 0.15)] = 1 # Only 15% seen through canopy

    profile_float = {
        "driver": "GTiff",
        "height": height,
        "width": width,
        "count": 1,
        "dtype": "float32",
        "crs": crs,
        "transform": transform,
        "nodata": np.nan
    }

    profile_uint8 = profile_float.copy()
    profile_uint8["dtype"] = "uint8"
    profile_uint8["nodata"] = 255

    # Write files expected by backend
    files_to_write = [
        ("pre_rtc_vv.tif", pre_vv_linear, profile_float),
        ("post_rtc_vv.tif", post_vv_linear, profile_float),
        ("pre_rtc_vh.tif", pre_vh_linear, profile_float),
        ("post_rtc_vh.tif", post_vh_linear, profile_float),
        ("opera_dswx_aligned.tif", dswx_arr, profile_uint8)
    ]

    for filename, data, prof in files_to_write:
        filepath = os.path.join(out_dir, filename)
        with rasterio.open(filepath, "w", **prof) as dst:
            dst.write(data.astype(prof["dtype"]), 1)

    print(f"Generated Chennai Cyclone Fengal case files in {out_dir}")


if __name__ == "__main__":
    generate_chennai_case()
