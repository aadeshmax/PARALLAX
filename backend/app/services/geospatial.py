import os
import logging
from typing import Tuple, Dict, Any, Optional, List
import numpy as np
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling, transform_bounds
from rasterio.mask import mask
from shapely.geometry import box, mapping
import pyproj

logger = logging.getLogger("parallax.geospatial")

class GeospatialProcessor:
    """
    Handles scientific GeoTIFF ingestion, radar backscatter conversion,
    CRS validation, alignment, reprojection, and masking.
    """

    @staticmethod
    def read_geotiff(file_path: str) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Reads a GeoTIFF file and returns its first band data array and profile."""
        with rasterio.open(file_path) as src:
            data = src.read(1)
            profile = src.profile.copy()
            return data, profile

    @staticmethod
    def linear_to_db(linear_data: np.ndarray, floor_val: float = 1e-6) -> np.ndarray:
        """
        Converts linear radar backscatter gamma0 to decibels (dB).
        Preserves NaNs and negative/zero values safely.
        Formula: dB = 10 * log10(max(linear, 1e-6))
        """
        valid_mask = ~np.isnan(linear_data) & (linear_data > 0)
        db_array = np.full_like(linear_data, np.nan, dtype=np.float32)
        safe_linear = np.clip(linear_data[valid_mask], floor_val, None)
        db_array[valid_mask] = 10.0 * np.log10(safe_linear)
        return db_array

    @staticmethod
    def reproject_to_match(
        src_path: str,
        ref_profile: Dict[str, Any],
        output_path: str,
        resampling: Resampling = Resampling.bilinear,
        nodata_val: Optional[float] = None
    ) -> str:
        """
        Reprojects and resamples src_path raster to perfectly align with ref_profile's
        CRS, transform, width, and height.
        """
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with rasterio.open(src_path) as src:
            target_profile = ref_profile.copy()
            dst_dtype = target_profile.get("dtype", "float32")
            if nodata_val is not None:
                target_profile["nodata"] = nodata_val

            dst_data = np.full(
                (target_profile["height"], target_profile["width"]),
                target_profile.get("nodata", np.nan),
                dtype=dst_dtype
            )

            reproject(
                source=rasterio.band(src, 1),
                destination=dst_data,
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=target_profile["transform"],
                dst_crs=target_profile["crs"],
                resampling=resampling,
            )

            with rasterio.open(output_path, "w", **target_profile) as dst:
                dst.write(dst_data, 1)

        return output_path

    @staticmethod
    def clip_raster_bbox(
        src_path: str,
        bbox_wgs84: List[float],
        output_path: str
    ) -> str:
        """
        Clips raster to bounding box [min_lon, min_lat, max_lon, max_lat].
        """
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with rasterio.open(src_path) as src:
            src_crs = src.crs
            # Transform bbox from EPSG:4326 to raster CRS
            transformer = pyproj.Transformer.from_crs("EPSG:4326", src_crs, always_xy=True)
            min_x, min_y = transformer.transform(bbox_wgs84[0], bbox_wgs84[1])
            max_x, max_y = transformer.transform(bbox_wgs84[2], bbox_wgs84[3])
            
            geom = [box(min_x, min_y, max_x, max_y)]
            out_image, out_transform = mask(src, geom, crop=True)
            
            out_profile = src.profile.copy()
            out_profile.update({
                "height": out_image.shape[1],
                "width": out_image.shape[2],
                "transform": out_transform
            })

            with rasterio.open(output_path, "w", **out_profile) as dst:
                dst.write(out_image)

        return output_path

    @staticmethod
    def get_wgs84_bounds(profile: Dict[str, Any]) -> List[float]:
        """Returns [min_lon, min_lat, max_lon, max_lat] in WGS84 for the raster profile."""
        width = profile["width"]
        height = profile["height"]
        transform = profile["transform"]
        crs = profile["crs"]
        
        left = transform.c
        top = transform.f
        right = left + transform.a * width
        bottom = top + transform.e * height

        bounds_4326 = transform_bounds(crs, "EPSG:4326", left, bottom, right, top)
        return [round(c, 5) for c in bounds_4326]

geospatial_processor = GeospatialProcessor()
