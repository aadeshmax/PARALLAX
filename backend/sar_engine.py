"""
Temporal SAR change analysis and inundation candidate extraction engine.
Implements specular water darkening detection, vegetation double-bounce brightening detection,
and cross-polarization ratio features.
Explicitly labels outputs as 'candidate inundation', suppressing obvious noise and false positives.
"""
from dataclasses import dataclass
from typing import Optional, Dict, Tuple
import numpy as np
from scipy.ndimage import uniform_filter


@dataclass
class CandidateInundationResult:
    # Continuous difference map: post_db - pre_db
    diff_db: np.ndarray
    # Boolean mask: candidate open water (specular drop in backscatter)
    specular_candidate_mask: np.ndarray
    # Boolean mask: candidate flooded vegetation (double bounce increase)
    double_bounce_candidate_mask: np.ndarray
    # Combined candidate inundation mask
    candidate_inundation_mask: np.ndarray
    # Spatial heuristic confidence score [0.0 to 1.0] representing spatial coherence and magnitude
    heuristic_confidence: np.ndarray
    # Processing parameters used
    thresholds_used: Dict[str, float]


def compute_lee_filtered_or_boxcar(data: np.ndarray, size: int = 3) -> np.ndarray:
    """
    Applies spatial window averaging (boxcar) to reduce SAR speckle noise.
    Preserves NaNs.
    """
    nan_mask = ~np.isfinite(data)
    filled = np.where(nan_mask, 0.0, data)
    weights = np.where(nan_mask, 0.0, 1.0)
    
    smoothed_sum = uniform_filter(filled, size=size, mode='reflect')
    weight_sum = uniform_filter(weights, size=size, mode='reflect')
    
    result = np.full_like(data, np.nan)
    valid = weight_sum > 0.05
    result[valid] = smoothed_sum[valid] / np.maximum(weight_sum[valid], 1e-6)
    result[nan_mask] = np.nan
    return result


def detect_candidate_inundation(
    pre_db: np.ndarray,
    post_db: np.ndarray,
    valid_mask: np.ndarray,
    pre_vh_db: Optional[np.ndarray] = None,
    post_vh_db: Optional[np.ndarray] = None,
    filter_speckle: bool = True,
    speckle_window: int = 3,
    specular_decrease_thresh_db: float = -3.0,
    max_specular_post_db: float = -14.0,
    double_bounce_increase_thresh_db: float = 2.5,
    min_double_bounce_post_db: float = -12.0
) -> CandidateInundationResult:
    """
    Detects candidate inundation from co-registered pre- and post-event SAR backscatter (in dB).
    
    1. Specular Inundation (Open water):
       - Backscatter drops significantly: post_db - pre_db <= specular_decrease_thresh_db (e.g. <= -3.0 dB)
       - Post backscatter is low (calm water specular reflection away from radar): post_db <= max_specular_post_db (e.g. <= -14.0 dB)
       
    2. Double-Bounce Inundation (Vegetated / Canopy flooding):
       - Backscatter increases significantly: post_db - pre_db >= double_bounce_increase_thresh_db (e.g. >= +2.5 dB)
       - Post backscatter exceeds canopy background: post_db >= min_double_bounce_post_db
       - Cross-pol (VH) check: if VH is available, vegetation volume scattering usually has VH/VV ratio or VH levels.
         Obvious false positives like dry soil roughness changes without volume scattering are suppressed.
    """
    if filter_speckle:
        pre_proc = compute_lee_filtered_or_boxcar(pre_db, size=speckle_window)
        post_proc = compute_lee_filtered_or_boxcar(post_db, size=speckle_window)
    else:
        pre_proc = pre_db.copy()
        post_proc = post_db.copy()

    diff_db = post_proc - pre_proc
    # Mask invalid
    diff_db[~valid_mask] = np.nan

    # 1. Specular Candidate Detection
    specular_mask = (
        valid_mask &
        (diff_db <= specular_decrease_thresh_db) &
        (post_proc <= max_specular_post_db)
    )

    # 2. Double-Bounce Candidate Detection
    double_bounce_mask = (
        valid_mask &
        (diff_db >= double_bounce_increase_thresh_db) &
        (post_proc >= min_double_bounce_post_db)
    )

    # If cross-polarization (VH) is available, refine double-bounce candidates
    if pre_vh_db is not None and post_vh_db is not None:
        if filter_speckle:
            pre_vh_proc = compute_lee_filtered_or_boxcar(pre_vh_db, size=speckle_window)
            post_vh_proc = compute_lee_filtered_or_boxcar(post_vh_db, size=speckle_window)
        else:
            pre_vh_proc = pre_vh_db
            post_vh_proc = post_vh_db

        vh_diff_db = post_vh_proc - pre_vh_proc
        # In double-bounce, VV enhancement is typically stronger than VH enhancement (dihedral reflection).
        # False positives from severe moisture wetting or radar artifacts where VH explodes excessively can be filtered:
        unrealistic_vh_mask = vh_diff_db > (diff_db + 4.0)
        double_bounce_mask &= ~unrealistic_vh_mask

    # Combined candidate inundation
    combined_mask = specular_mask | double_bounce_mask

    # Calculate heuristic confidence score [0.0 - 1.0]
    # Based on the strength of the dB deviation relative to threshold
    heuristic_score = np.zeros_like(diff_db, dtype=np.float32)

    # For specular: normalize drop beyond threshold
    spec_excess = np.clip((specular_decrease_thresh_db - diff_db) / 6.0, 0.0, 1.0)
    heuristic_score[specular_mask] = 0.5 + 0.5 * spec_excess[specular_mask]

    # For double bounce: normalize increase beyond threshold
    db_excess = np.clip((diff_db - double_bounce_increase_thresh_db) / 5.0, 0.0, 1.0)
    heuristic_score[double_bounce_mask] = 0.5 + 0.5 * db_excess[double_bounce_mask]

    thresholds_used = {
        "specular_decrease_thresh_db": specular_decrease_thresh_db,
        "max_specular_post_db": max_specular_post_db,
        "double_bounce_increase_thresh_db": double_bounce_increase_thresh_db,
        "min_double_bounce_post_db": min_double_bounce_post_db,
        "speckle_filter_window": speckle_window if filter_speckle else 0
    }

    return CandidateInundationResult(
        diff_db=diff_db,
        specular_candidate_mask=specular_mask,
        double_bounce_candidate_mask=double_bounce_mask,
        candidate_inundation_mask=combined_mask,
        heuristic_confidence=heuristic_score,
        thresholds_used=thresholds_used
    )
