# PARALLAX — Scientific Methodology & Mathematical Formulations

## NASA International Space Apps Challenge 2026: *Dancing with the SARs*

---

## 1. Physical Foundations of Microwave SAR Inundation Mapping

Synthetic Aperture Radar (SAR) is an active microwave remote sensing technique that transmits coherent electromagnetic pulses and measures the backscattered power ($\sigma^0$) and phase. Unlike passive optical sensors, SAR is independent of solar illumination and penetrates clouds, haze, and precipitation.

```
       Radar Pulse 🛰️                             Radar Pulse 🛰️
          \                                          \        ▲
           \                                          \      / (Enhanced Double-Bounce)
            \                                          \    /
    ┌────────▼────────┐                         ┌───────▼──/──────┐
    │  Open Water     │                         │  Flooded Canopy │
    │  Specular Mirror│                         │  Dihedral Bounce│
    │  ΔdB ≤ -3.0 dB  │                         │  ΔdB ≥ +2.5 dB  │
    └────────┬────────┘                         └───────┬─────────┘
             ▼                                          ▼
     Radar energy scatters                     Water-trunk corner reflector
     away from sensor                          redirects intense pulse back
     (Signal Attenuation)                      (Signal Enhancement)
```

### Two Physical Regimes:
1. **Specular Reflection (Open Water):** A flat water surface acts as a specular reflector. Incident microwave pulses bounce away from the radar antenna, resulting in a dramatic drop in backscattered energy (radar darkening or attenuation).
2. **Dihedral Double-Bounce (Inundated Vegetation):** When floodwaters submerge the ground beneath trees, shrubs, or tall emergent reeds, the smooth water surface and vertical tree trunks form natural 90° dihedral corner reflectors. Radar pulses bounce off the water onto the trunk (or vice-versa) and are redirected back toward the antenna, creating a pronounced increase in backscattered energy (radar brightening or enhancement).

---

## 2. Mathematical Formulations

### A. Radiometric Calibration & Decibel Transformation
Raw Level-2 SAR products are distributed in linear power digital numbers ($\text{DN}$). To enable physically meaningful comparisons and normal statistical distributions, linear power is converted to the logarithmic radar backscatter coefficient $\sigma^0$ in decibels ($\text{dB}$):

$$\sigma^0 (\text{dB}) = 10 \cdot \log_{10}(\text{DN})$$

To prevent numerical singularities ($-\infty$) over zero or negative digital numbers:

$$\sigma^0 (\text{dB}) = 10 \cdot \log_{10}\left(\max(\text{DN}, 10^{-5})\right)$$

### B. Temporal Change Detection
Given coregistered pre-event baseline SAR backscatter $\sigma^0_{\text{pre}}$ and post-event SAR backscatter $\sigma^0_{\text{post}}$ acquired under identical orbital geometry (same track, look angle, and pass):

$$\Delta \sigma^0 (\text{dB}) = \sigma^0_{\text{post}} (\text{dB}) - \sigma^0_{\text{pre}} (\text{dB})$$

In linear ratio form:

$$\Delta \sigma^0 (\text{dB}) = 10 \cdot \log_{10}\left(\frac{\text{DN}_{\text{post}}}{\text{DN}_{\text{pre}}}\right)$$

### C. Physical Classification Thresholds

#### 1. Backscatter Attenuation (Candidate Open Water):
A pixel is classified as a candidate open surface water expansion if and only if:

$$\Delta \sigma^0 \le -3.0\text{ dB} \quad \land \quad \sigma^0_{\text{post}} \le -15.0\text{ dB}$$

The absolute threshold $\sigma^0_{\text{post}} \le -15.0\text{ dB}$ ensures that high-backscatter urban or vegetative areas that merely experience slight drying are not falsely flagged as standing water.

#### 2. Backscatter Enhancement (Candidate Inundated Canopy):
A pixel is classified as a candidate sub-canopy inundation if and only if:

$$\Delta \sigma^0 \ge +2.5\text{ dB}$$

In dual-polarization mode (when cross-polarized VH or HV is available), volume scattering false positives are suppressed using the co-pol to cross-pol power ratio:

$$\gamma_{\text{ratio}} = \sigma^0_{\text{co-pol}} - \sigma^0_{\text{cross-pol}} \ge 4.5\text{ dB}$$

---

## 3. Vectorization & Geodesic Area Measurement

### A. Sub-Pixel Morphological Smoothing
To eliminate harsh 90° raster staircase artifacts without altering genuine geographical boundaries, vector candidate masks undergo topological buffer-deflate operations:

$$\mathcal{P}_{\text{smooth}} = \text{simplify}\left( \text{buffer}\left( \text{buffer}(\mathcal{P}_{\text{raw}}, +d), -d \right), \epsilon \right)$$

Where $d = 8\text{ meters}$ and simplification tolerance $\epsilon = 6\text{ meters}$.

### B. Geodesic Polygon Area Integration
Polygon areas are not computed using distorted planar projected metrics. Instead, vertices are projected onto the WGS 84 reference ellipsoid (`EPSG:4326`) and integrated geodesically:

$$A = \oint_{\mathcal{C}} R^2 \cdot \cos(\phi) \, d\lambda \, d\phi$$

Reported metrics are rounded to two decimal places ($0.01\text{ km²} = 1\text{ ha}$).

---

## 4. Cross-Sensor Gap Analysis (OPERA DSWx vs SAR)

PARALLAX cross-references SAR inundation candidates directly against the NASA OPERA L3 Dynamic Surface Water Extent (DSWx-S1) product.

Let $S_{\text{SAR}}$ be the set of valid SAR candidate pixels and $S_{\text{DSWx}}$ be the set of validated DSWx water pixels within the common valid observation mask $\mathcal{M}_{\text{valid}}$:

### A. Sensor Agreement (Intersection over Union):
$$\text{IoU} = \frac{|S_{\text{SAR}} \cap S_{\text{DSWx}}|}{|S_{\text{SAR}} \cup S_{\text{DSWx}}|}$$

### B. Detection Gap (Unmapped Inundation):
$$\text{Gap}_{\text{canopy}} = |S_{\text{SAR}} \setminus S_{\text{DSWx}}| = |S_{\text{SAR}}| - |S_{\text{SAR}} \cap S_{\text{DSWx}}|$$

This metric isolates areas where microwave penetration exposed surface water that was completely unmapped by optical surface water products.

---

## 5. Windy-Inspired Weather Radar Rendering

To transform raw satellite rasters into an intuitive, weather-radar-style interface:

1. **Hardware Texture Linear Resampling:** Rasters are served as pre-rendered XYZ tile pyramids resampled with bilinear GPU interpolation (`raster-resampling: linear`), completely eliminating pixel blockiness up to zoom level 18.
2. **Cubic Color Progression:** Color transitions are interpolated across a non-linear continuous spectrum:
   - Zero change ($0.0\text{ dB}$): Completely transparent (`rgba(0,0,0,0)`)
   - Moderate change ($+2.5\text{ dB}$): Cyan translucency (`#06b6d4`, $\alpha = 0.45$)
   - Peak double-bounce ($+6.0\text{ dB}$): Electric blue / emerald (`#3b82f6` to `#10b981`, $\alpha = 0.85$)
3. **Pulsing Wavefront Animation:** An animated concentric opacity pulse simulates live radar scanning across active candidate zones.
