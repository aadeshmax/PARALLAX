# TERRA//PULSE: Scientific Inundation & Gap Intelligence Documentation

## 1. Overview and Theoretical Formulation

The **TERRA//PULSE** inundation engine leverages multi-temporal Synthetic Aperture Radar (SAR) Radiometrically Terrain Corrected (RTC-S1) backscatter and NASA OPERA Dynamic Surface Water Extent (DSWx-S1) products.

### 1.1 Inundation Scattering Mechanisms
1. **Specular Scattering (Open Water Surface)**:
   - Smooth water acts as a specular mirror, scattering microwave radiation away from the monostatic radar antenna.
   - Characterized by significant backscatter reduction: $\Delta\sigma^0 \le -3.0\text{ dB}$ and low absolute post-event backscatter ($\sigma_{\text{post}}^0 \le -14.0\text{ dB}$).
2. **Double-Bounce Scattering (Flooded Vegetation / Sub-canopy)**:
   - When vegetation stalks or tree trunks are partially submerged, the water-stem junction forms a dihedral corner reflector, strongly redirecting backscatter directly back to the sensor.
   - Characterized by backscatter enhancement: $\Delta\sigma^0 \ge +2.5\text{ dB}$ over forested/vegetated background.
   - Where dual-polarization (VV + VH) is available, double bounce shows dominant co-pol (VV) enhancement over cross-pol (VH). Obvious false positives such as agricultural tillage or soil moisture changes are suppressed.

### 1.2 Output Nomenclature and Labeling
- All detected inundation features are strictly labeled as **Candidate Inundation**, never "confirmed hidden water".
- Heuristic scores reflect empirical backscatter deviations $[0.5, 1.0]$, and are **never represented as calibrated Bayesian probabilities**.

---

## 2. Ingestion and Coregistration Pipeline

- **Modular RTC-S1 Ingestion (`backend/rtc_ingestion.py`)**:
  - Validates CRS, affine transform, spatial resolution, timestamp, polarization, and NoData.
  - Automatically identifies whether input data represents linear power ($\gamma^0 / \sigma^0$) or decibels ($\text{dB}$).
  - Converts linear power to decibels using $\text{dB} = 10 \cdot \log_{10}(\max(\text{linear}, 10^{-5}))$.
  - **Never converts already logarithmic ($\text{dB}$) data again**.
- **OPERA DSWx-S1 Baseline Ingestion (`backend/dswx_ingestion.py`)**:
  - Evaluates standard OPERA classes: `0` (Not water), `1` (Open water), `2` (Partial surface water), `250` (Snow/Ice), `251` (Cloud shadow), `252` (Haze/Cloud), `255` (NoData).
  - Explicitly separates valid observations from masked/unobserved areas.
- **Alignment (`backend/alignment.py`)**:
  - Resamples continuous SAR backscatter using bilinear interpolation.
  - Resamples discrete categorical masks (OPERA classes and validity flags) using nearest-neighbor interpolation.
  - Derives an intersection mask `common_valid_mask` to prevent false detection over invalid observation sectors.

---

## 3. Area Statistics and Metric Derivations

- Area calculations use true ground surface area integration:
  - For projected CRS (e.g. UTM): calculates exact cell resolution in meters squared converted to $\text{km}^2$.
  - For geographic coordinates (EPSG:4326): calculates geodesic trapezoidal area per row using the WGS84 ellipsoid.
- Metrics reported:
  - $\text{Total Valid Area } (\text{km}^2)$
  - $\text{Baseline Water Area } (\text{km}^2)$
  - $\text{Candidate Inundation Area } (\text{km}^2)$ (split into Specular and Double-Bounce)
  - $\text{Overlap Area } (\text{km}^2)$
  - $\text{Additional Candidate Area } (\text{km}^2)$
  - $\text{Baseline-Only Area } (\text{km}^2)$
  - $\text{IoU Agreement Ratio} = \frac{\text{Overlap}}{\text{Baseline} \cup \text{Candidate}}$
- **Scientific Caveat**: IoU with OPERA DSWx is reported strictly as **sensor agreement**, not detection accuracy. Precision, recall, and F1 are omitted unless independent ground-truth/in-situ validation labels exist.

---

## 4. Real Flood-Event Benchmark Case

A reproducible flood-event dataset is provided in `data/cases/real_event_rio_grande_do_sul/`:
- **Location**: Rio Grande do Sul, Brazil (Guaíba River basin / Porto Alegre sector).
- **Date Range**: April 26, 2024 (Pre-flood) to May 08, 2024 (During-flood peak).
- **OPERA DSWx Baseline**: Granule `OPERA_L3_DSWx-S1_T22JBM_20240508T220719Z_v1.0_B01_WTR.tif`.
- **Sentinel-1 RTC**: Dual-pol VV and VH pairs coregistered at 30m resolution (EPSG:32622).
- **Execution**: Can be reproduced using `pytest tests/test_rtc_pipeline.py` or the CLI analysis script.

---

## 5. Backend Response Contract

The endpoint `POST /api/v1/analyze` yields:
```json
{
  "analysis_id": "string (UUIDv4)",
  "status": "completed",
  "source_granule_ids": {
    "pre_sar": "OPERA_L2_RTC-S1_...",
    "post_sar": "OPERA_L2_RTC-S1_...",
    "opera_dswx": "OPERA_L3_DSWx-S1_..."
  },
  "timestamps": {
    "pre_sar_acquisition": "ISO 8601 UTC",
    "post_sar_acquisition": "ISO 8601 UTC",
    "opera_dswx_acquisition": "ISO 8601 UTC",
    "processed_at": "ISO 8601 UTC"
  },
  "raster_layer_references": {
    "backscatter_diff_db": "path/to/backscatter_diff_db.tif",
    "candidate_confidence": "path/to/candidate_confidence.tif",
    "candidate_inundation": "path/to/candidate_inundation.tif",
    "specular_candidate": "path/to/specular_candidate.tif",
    "double_bounce_candidate": "path/to/double_bounce_candidate.tif",
    "baseline_water": "path/to/baseline_water.tif",
    "overlap": "path/to/overlap.tif",
    "additional_candidate": "path/to/additional_candidate.tif",
    "baseline_only": "path/to/baseline_only.tif",
    "common_valid": "path/to/common_valid.tif",
    "metrics_json": "path/to/metrics.json"
  },
  "area_statistics": {
    "total_valid_area_sqkm": 81.0,
    "baseline_water_area_sqkm": 32.22,
    "candidate_inundation_area_sqkm": 31.05,
    "specular_candidate_area_sqkm": 29.41,
    "double_bounce_candidate_area_sqkm": 1.64,
    "overlap_area_sqkm": 30.55,
    "additional_candidate_area_sqkm": 0.50,
    "baseline_only_area_sqkm": 1.67,
    "iou_agreement": 0.9334,
    "additional_candidate_ratio": 0.0161,
    "metrics_notes": "IoU is reported strictly as cross-sensor agreement..."
  },
  "confidence_description": {
    "method": "heuristic_spatial_backscatter_deviation",
    "is_calibrated_probability": false,
    "description": "Continuous [0.5, 1.0] score measuring the magnitude of decibel change...",
    "thresholds_applied": { ... }
  },
  "processing_time_seconds": 1.42,
  "scientific_limitations": [ ... ]
}
```

---

## 6. Scientific Limitations & Failure Modes

1. **Specular False Positives**: Flat paved areas (airfield runways, highways) and dry smooth sand beds exhibit low backscatter that can resemble specular water.
2. **Double-Bounce Non-Water Causes**: Rapid agricultural growth, soil tillage, or extreme topsoil moisture wetting can trigger backscatter rises without flooding.
3. **Wind-Induced Omission**: Strong surface winds roughen open water bodies, generating capillary Bragg scattering that elevates backscatter above the specular detection threshold.
4. **Sensor Discrepancy**: OPERA DSWx relies on Sentinel-1 and HLS combinations with distinct observation timings and geometric look angles. Differences represent sensor characteristics and temporal evolution, not definitive ground truth errors.
