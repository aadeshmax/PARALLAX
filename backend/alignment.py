"""
Spatial alignment and coregistration module for multi-temporal SAR and OPERA DSWx rasters.
Handles continuous SAR data using bilinear/cubic resampling, and categorical masks using nearest-neighbor.
Computes common valid coverage and masks terrain/geometry artifacts.
"""
from typing import Tuple, Optional
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject, calculate_default_transform, transform_bounds
from rasterio.transform import Affine

from backend.schemas import SARRaster
from backend.dswx_ingestion import DSWxRaster


def align_raster_to_reference(
    src_data: np.ndarray,
    src_crs: str,
    src_transform: tuple,
    ref_crs: str,
    ref_transform: tuple,
    ref_shape: Tuple[int, int],
    is_categorical: bool = False,
    src_nodata: Optional[float] = np.nan,
    dst_nodata: Optional[float] = np.nan
) -> np.ndarray:
    """
    Reprojects and resamples src_data into the reference grid (ref_crs, ref_transform, ref_shape).
    Continuous data uses bilinear interpolation.
    Categorical masks use nearest neighbor interpolation.
    """
    src_aff = Affine(*src_transform[:6])
    dst_aff = Affine(*ref_transform[:6])
    dst_height, dst_width = ref_shape

    dst_dtype = src_data.dtype
    if is_categorical:
        resample_method = Resampling.nearest
        fill_val = 0 if np.isnan(dst_nodata) else dst_nodata
        dst_data = np.full((dst_height, dst_width), fill_val, dtype=dst_dtype)
    else:
        resample_method = Resampling.bilinear
        dst_data = np.full((dst_height, dst_width), np.nan if np.isnan(dst_nodata) else dst_nodata, dtype=np.float32)

    reproject(
        source=src_data,
        destination=dst_data,
        src_transform=src_aff,
        src_crs=src_crs,
        dst_transform=dst_aff,
        dst_crs=ref_crs,
        src_nodata=src_nodata,
        dst_nodata=dst_nodata,
        resampling=resample_method
    )

    return dst_data


def align_sar_pair(
    pre_sar: SARRaster,
    post_sar: SARRaster
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, tuple, str]:
    """
    Aligns pre-event SAR to post-event SAR grid (or vice versa).
    Returns (pre_aligned_db, post_aligned_db, common_valid_mask, transform, crs).
    """
    ref_crs = post_sar.metadata.crs
    ref_transform = post_sar.metadata.transform
    ref_shape = (post_sar.metadata.height, post_sar.metadata.width)

    # If CRS and transform match exactly
    if (pre_sar.metadata.crs == ref_crs and 
        pre_sar.metadata.transform == ref_transform and 
        (pre_sar.metadata.height, pre_sar.metadata.width) == ref_shape):
        pre_aligned = pre_sar.data.copy()
        pre_mask = pre_sar.mask.copy()
    else:
        pre_aligned = align_raster_to_reference(
            src_data=pre_sar.data,
            src_crs=pre_sar.metadata.crs,
            src_transform=pre_sar.metadata.transform,
            ref_crs=ref_crs,
            ref_transform=ref_transform,
            ref_shape=ref_shape,
            is_categorical=False,
            src_nodata=np.nan,
            dst_nodata=np.nan
        )
        pre_mask = align_raster_to_reference(
            src_data=pre_sar.mask.astype(np.uint8),
            src_crs=pre_sar.metadata.crs,
            src_transform=pre_sar.metadata.transform,
            ref_crs=ref_crs,
            ref_transform=ref_transform,
            ref_shape=ref_shape,
            is_categorical=True,
            src_nodata=0,
            dst_nodata=0
        ) > 0

    post_aligned = post_sar.data.copy()
    post_mask = post_sar.mask.copy()

    common_valid_mask = pre_mask & post_mask & np.isfinite(pre_aligned) & np.isfinite(post_aligned)

    return pre_aligned, post_aligned, common_valid_mask, ref_transform, ref_crs


def align_dswx_to_sar(
    dswx: DSWxRaster,
    target_crs: str,
    target_transform: tuple,
    target_shape: Tuple[int, int]
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Aligns OPERA DSWx categorical classification and validity masks to the target SAR grid
    using nearest-neighbor resampling.
    Returns (aligned_raw_classes, aligned_valid_mask).
    """
    aligned_classes = align_raster_to_reference(
        src_data=dswx.raw_classes,
        src_crs=dswx.crs,
        src_transform=dswx.transform,
        ref_crs=target_crs,
        ref_transform=target_transform,
        ref_shape=target_shape,
        is_categorical=True,
        src_nodata=255,
        dst_nodata=255
    )

    aligned_valid = align_raster_to_reference(
        src_data=dswx.valid_mask.astype(np.uint8),
        src_crs=dswx.crs,
        src_transform=dswx.transform,
        ref_crs=target_crs,
        ref_transform=target_transform,
        ref_shape=target_shape,
        is_categorical=True,
        src_nodata=0,
        dst_nodata=0
    ) > 0

    return aligned_classes, aligned_valid
