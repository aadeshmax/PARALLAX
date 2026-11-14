"""
Raster export module. Writes georeferenced GeoTIFFs (single band byte or float32)
with proper compression, tiling, and spatial references.
"""
import os
from typing import Dict, Optional
import numpy as np
import rasterio
from rasterio.transform import Affine


def export_geotiff(
    data: np.ndarray,
    out_path: str,
    crs_str: str,
    transform: tuple,
    nodata: Optional[float] = 0,
    dtype: Optional[str] = None
) -> str:
    """
    Exports a 2D numpy array to a GeoTIFF with LZW compression and tiling.
    """
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    height, width = data.shape
    aff = Affine(*transform[:6])

    target_dtype = dtype or str(data.dtype)

    profile = {
        "driver": "GTiff",
        "height": height,
        "width": width,
        "count": 1,
        "dtype": target_dtype,
        "crs": crs_str,
        "transform": aff,
        "compress": "lzw",
        "tiled": True,
        "blockxsize": min(256, width),
        "blockysize": min(256, height)
    }
    if nodata is not None:
        profile["nodata"] = nodata

    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(data.astype(target_dtype), 1)

    return out_path


def export_analysis_layers(
    layers: Dict[str, np.ndarray],
    diff_db: np.ndarray,
    confidence: np.ndarray,
    out_dir: str,
    crs_str: str,
    transform: tuple
) -> Dict[str, str]:
    """
    Exports all candidate inundation, baseline, disagreement, and continuous layers.
    Returns dictionary mapping layer name to output file path.
    """
    os.makedirs(out_dir, exist_ok=True)
    exported = {}

    # 1. Continuous change (dB)
    diff_path = os.path.join(out_dir, "backscatter_diff_db.tif")
    export_geotiff(diff_db, diff_path, crs_str, transform, nodata=np.nan, dtype="float32")
    exported["backscatter_diff_db"] = diff_path

    # 2. Heuristic confidence
    conf_path = os.path.join(out_dir, "candidate_confidence.tif")
    export_geotiff(confidence, conf_path, crs_str, transform, nodata=0.0, dtype="float32")
    exported["candidate_confidence"] = conf_path

    # 3. Categorical mask layers
    for layer_name, mask_arr in layers.items():
        layer_path = os.path.join(out_dir, f"{layer_name}.tif")
        export_geotiff(mask_arr, layer_path, crs_str, transform, nodata=255, dtype="uint8")
        exported[layer_name] = layer_path

    return exported
