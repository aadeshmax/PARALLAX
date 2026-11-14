"""
Data schemas and metadata contracts for RTC-S1 and OPERA DSWx-S1 processing.
"""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
import numpy as np


class Polarization(str, Enum):
    VV = "VV"
    VH = "VH"
    HH = "HH"
    HV = "HV"


class BackscatterUnit(str, Enum):
    LINEAR_POWER = "linear_power"
    DECIBEL = "dB"
    AMPLITUDE = "amplitude"


class DSWxClass(int, Enum):
    NOT_WATER = 0
    OPEN_WATER = 1
    PARTIAL_SURFACE_WATER = 2
    RESERVED = 3
    # Quality / invalid / masked flags
    SNOW_ICE = 250
    CLOUD_SHADOW = 251
    HAZE_CLOUD = 252
    NO_DATA = 255


@dataclass
class SARMetadata:
    granule_id: str
    acquisition_time: datetime
    polarization: Polarization
    crs: str
    transform: tuple  # 6-element affine transform tuple
    resolution: tuple  # (res_x, res_y) in CRS units
    width: int
    height: int
    nodata: Optional[float]
    unit: BackscatterUnit
    look_direction: Optional[str] = None  # e.g., "Right"
    track_number: Optional[int] = None
    extra_tags: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SARRaster:
    metadata: SARMetadata
    data: np.ndarray  # 2D float32 array, normalized to dB with NaN for masked/nodata
    raw_unit: BackscatterUnit
    mask: np.ndarray  # 2D boolean array where True indicates valid pixel
