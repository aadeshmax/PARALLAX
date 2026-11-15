# PARALLAX — Submission Package
## NASA International Space Apps Challenge 2026
### Challenge: *Dancing with the SARs*

---

<div align="center">

![PARALLAX Banner](screenshots/screenshot_swipe_comparison.png)

### **PARALLAX: NISAR-Powered Surface Change Intelligence & Cross-Sensor Gap Analysis**

**An Open-Source Multi-Frequency SAR Intelligence Engine for Sub-Canopy Inundation Detection and Surface Water Discrepancy Analysis**

[![NASA Space Apps 2026](https://img.shields.io/badge/NASA%20Space%20Apps-Challenge%202026-0b3d91.svg?style=for-the-badge&logo=nasa&logoColor=white)](https://www.spaceappschallenge.org/)
[![NISAR L-Band](https://img.shields.io/badge/NASA--ISRO-NISAR%20L--Band%20GCOV-dc2626.svg?style=for-the-badge&logo=satellite&logoColor=white)](https://nisar.jpl.nasa.gov/)
[![NASA OPERA](https://img.shields.io/badge/NASA%20OPERA-RTC--S1%20%26%20DSWx-f59e0b.svg?style=for-the-badge&logo=satellite&logoColor=white)](https://www.jpl.nasa.gov/missions/opera)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.13-009688.svg?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/Frontend-React%2018%20%7C%20TypeScript%20%7C%20Vite-61dafb.svg?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre%20GL-3D%20WebGL%20%7C%20Weather%20Radar%20Styling-38bdf8.svg?style=for-the-badge&logo=maplibre&logoColor=white)](https://maplibre.org/)

</div>

---

## 1. Executive Summary & Problem Statement

### The Critical Gap in Optical and High-Frequency Surface Water Mapping
Traditional flood mapping relies heavily on optical sensors (e.g. Landsat-8/9, Sentinel-2) and high-frequency radar (e.g. C-band Sentinel-1). While these instruments map unobstructed open-water bodies with high precision, they suffer from two fatal limitations during extreme hydrometeorological events:
1. **Cloud & Rain Attenuation:** Optical sensors cannot penetrate cloud cover, monsoonal storms, or heavy precipitation.
2. **Canopy Blindness:** Short-wavelength radiation (optical ~0.5–2.2 µm, C-band ~5.6 cm) scatters off upper forest foliage and mangrove canopies, leaving floodwaters concealed beneath woody vegetation completely unmapped.

### The NISAR L-Band Revolution
The **NASA-ISRO SAR (NISAR)** mission operates a 24 cm L-band radar (1.2575 GHz). Because L-band wavelengths are comparable to or larger than tree leaves and branches, the radar pulse penetrates dense forest crowns, reflects off standing water beneath the trees, and bounces off tree trunks back to the sensor antenna—producing a dramatic **dihedral double-bounce backscatter enhancement**.

**PARALLAX** is a complete, production-grade geospatial intelligence platform designed specifically to harness NISAR L-band flight observations and cross-reference them with NASA OPERA products to expose hidden inundation and quantify multi-sensor detection gaps.

---

## 2. Platform Architecture & Data Flow

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        NASA EARTHDATA ECOSYSTEM                        │
│   • ASF DAAC: NISAR L2 GCOV (Provisional 24cm L-Band SAR)              │
│   • ASF DAAC: OPERA L2 RTC-S1 (C-Band Radiometric Terrain Corrected)   │
│   • PO.DAAC:  OPERA L3 DSWx-S1 (Dynamic Surface Water Extent)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ NASA Harmony & CMR APIs (HTTPS / S3)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      PARALLAX BACKEND (FastAPI)                        │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ NASA EDL Authenticator│  │ Scientific Detection & Change Engine  │  │
│  │ Token management &    │  │ • Linear-to-Decibel conversion:       │  │
│  │ Harmony job polling   │  │   σ°(dB) = 10 * log10(DN)             │  │
│  └───────────────────────┘  │ • Radiometric change: ΔdB = post - pre│  │
│  ┌───────────────────────┐  │ • Sub-canopy double-bounce candidate: │  │
│  │ Resilient Data Server │  │   ΔdB ≥ +2.5 dB                       │  │
│  │ Dynamic GeoTIFF       │  │ • Open water specular attenuation:    │  │
│  │ reader with chunked   │  │   ΔdB ≤ -3.0 dB & σ°_post ≤ -15.0 dB  │  │
│  │ block fallback        │  │ • Geodesic area calculation (WGS84)   │  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST API / XYZ Raster Tiles / GeoJSON
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PARALLAX INTERFACE (React + Vite)                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ MapLibre GL JS Dual-Mode Rendering Engine                        │  │
│  │ • Weather Radar Mode: Windy-style non-linear cubic interpolation │  │
│  │   with radial gaussian falloff and pulsing live wavefronts       │  │
│  │ • Scientific GIS Mode: Exact categorical GIS boundaries & vector │  │
│  │ • Synchronized Swipe Comparison: Baseline SAR vs Flood Analysis  │  │
│  │ • Hardware Bilinear Resampling: Zero pixelation at high zoom     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ Layer Command Center  │  │ Analysis Inspector & Analytics        │  │
│  │ AOI switcher, opacity │  │ Sensor parameters, physical evidence, │  │
│  │ sliders, radar modes  │  │ backscatter curves, area partitions   │  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Scientific Findings & Case Studies

### A. Mumbai & Thane Creek — NISAR L-Band Temporal Change (June–July 2026)
- **Sensor:** NASA-ISRO SAR (NISAR) L-band (1.2575 GHz, 23.84 cm wavelength)
- **Granules:** `NISAR_L2_PR_GCOV_023_113_A_011_4005_DHDH_A_20260622T003449...` (`G4245290530-ASF`) and `NISAR_L2_PR_GCOV_024_113_A_011_4005_DHDH_A_20260704T003449...` (`G4248106091-ASF`) (Track 113, Frame 011, 12-day orbital repeat cycle)
- **Analyzed AOI:** 2,330.44 km² across the Mumbai Metropolitan Region and Thane Creek Mangrove Sanctuary
- **Backscatter Enhancement Zones — Potential Inundation Indicators:** **571.13 km²** exhibiting $\Delta HH \ge +2.5\text{ dB}$. Sub-canopy double-bounce mechanism concentrated across mangrove clusters and wetland fringes.
- **Potential Surface Water Changes (Backscatter Attenuation):** **2.85 km²** exhibiting $\Delta HH \le -3.0\text{ dB}$ and $\sigma^0_{\text{post}} \le -15.0\text{ dB}$. Specular reflection from newly opened ponding surfaces and tidal flats.
- **Backscatter Dynamics:** Valid pixels partitioned into 5,745 enhancement clusters vs 4,185 attenuation clusters.

### B. Chennai & Pallikaranai Marshlands — NASA OPERA Multi-Sensor Analysis (Nov–Dec 2024)
- **Sensor:** Copernicus Sentinel-1 C-band via NASA OPERA L2 RTC-S1 and L3 DSWx-S1
- **Analyzed AOI:** 412.80 km²
- **OPERA Baseline Mapped Water:** 42.8 km²
- **PARALLAX Candidate Floodwater:** 18.4 km² (+43.0% expansion)
- **Cross-Sensor Detection Gap:** Demonstrates significant flood inundation along the Adyar river basin and Pallikaranai wetlands that were omitted from standard optical surface water classifications.

---

## 4. UI/UX Innovation: Windy-Inspired Weather Radar Rendering

One of the central user experience challenges in satellite radar remote sensing is that raw radar rasters look blocky and uninviting to emergency managers and civilian responders.

PARALLAX bridges the gap between scientific precision and public clarity through our **Dual-Mode Rendering Engine**:
1. **Weather Radar Mode:** Inspired by Windy.com, applies GPU bilinear texture filtering, non-linear cubic color ramps (`#3b82f6` deep water, `#06b6d4` transition, `#10b981` edge), radial distance falloffs, and a dynamic 2.4-second pulsing wavefront animation.
2. **Scientific GIS Mode:** Crisp, exact categorical boundaries with standard geospatial symbology for GIS professionals and scientific auditors.
3. **Synchronized Swipe Comparison:** Hardware-accelerated split-screen view allowing instantaneous verification of raw satellite baselines against processed flood intelligence.

---

## 5. Verification Baseline & Quality Assurance

| Metric | Target | Verified Value | Status |
| :--- | :---: | :---: | :---: |
| Backend Pytest Suite | 100% Pass | **38 passed, 0 failed in 23.85s** | ✅ Passed |
| Frontend Production Build | 0 Errors | **Built cleanly in 4.99s** (`tsc && vite build`) | ✅ Passed |
| Security Credential Audit | 0 Leaks | **0 secrets, 0 absolute paths, 0 tokens** | ✅ Passed |
| Resilient Data Fallback | 100% Availability | Pre-computed cache serves instantly if `.tif` omitted | ✅ Passed |
| End-to-End API Smoke Tests | HTTP 200 | All 6 primary endpoints tested and responsive | ✅ Passed |

---

## 6. Submission Deliverables Index

- [Problem Statement & Methodology](METHODOLOGY.md)
- [System Architecture](ARCHITECTURE.md)
- [Scientific Provenance & Physical Limitations](PROVENANCE_AND_LIMITATIONS.md)
- [Judge Walkthrough & Live Demo Guide](WALKTHROUGH.md)
- [Scientific Validation Results](RESULTS.md)
- [Official NASA Citations & References](CITATIONS.md)
- [High-Resolution Visual Assets](screenshots/)

---

## 7. Quickstart (How to Run)

### Single-Command Production Mode (FastAPI + Embedded SPA)
```bash
# 1. Install dependencies
pip install -r backend/requirements.txt
cd frontend && npm install && npm run build && cd ..

# 2. Launch FastAPI backend (automatically serves the built frontend at /app/)
uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```
Open **`http://127.0.0.1:8000/app/`** in your browser.

### Development Mode (with Live Hot-Reloading)
```bash
# Terminal 1: Backend
uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload

# Terminal 2: Frontend
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```
Open **`http://127.0.0.1:5173`** in your browser.
