# PARALLAX — Frontend Integration Baseline & Architecture Audit

**Date**: 2026-11-15  
**Branch**: `feat/parallax-frontend-redesign`  
**Base Commit**: `c721163` (Merge origin/main into test/backend-integration)  
**Status**: Pristine Baseline Established (36/36 Backend Tests Passing, Frontend Vite Build Passing)

---

## 1. Executive Summary

This document establishes the architecture audit and integration baseline for migrating the PARALLAX frontend from its initial layout to the approved production design system (Google Stitch reference design: OrbitTrack/UNOSAT midnight-navy scientific workspace).

All backend APIs, database persistence schemas, scientific detection algorithms, and Earthdata session services are preserved without regression or alteration.

---

## 2. Baseline Validation Status

| Subsystem | Metric / Target | Result | Status |
| :--- | :--- | :--- | :---: |
| **Backend Test Suite** | 36 test cases (`pytest tests/ -q`) | 36 passed in 23.52s | ✅ PASSED |
| **Frontend Production Build** | TypeScript 5.7 + Vite 6.1 (`npm run build`) | Built in 4.25s (0 errors) | ✅ PASSED |
| **Git Working Tree** | Uncommitted modifications | Clean (0 untracked/dirty files) | ✅ CLEAN |
| **Active Branch** | Dedicated integration branch | `feat/parallax-frontend-redesign` | ✅ VERIFIED |
| **Backend Health** | `GET /health` | Healthy, demo scenes ready | ✅ READY |
| **Kubernetes Readiness** | `GET /readiness` | DB connected, storage writable | ✅ READY |
| **NASA Authentication** | `GET /api/nasa/status` | Verified session / fallback | ✅ READY |

---

## 3. Integration Matrix

| Existing Feature | Existing Location | Current Functionality | Proposed Frontend Component | Required API Endpoint | Required Response Fields | Integration Risk | Implementation Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Top Command Bar** | `frontend/src/components/Header.tsx` | Fixed top header with brand and basic status pill | `HeaderCommandBar.tsx` | `GET /health`, `GET /api/nasa/status` | `status`, `authenticated`, `username_masked` | Low | Replaced with floating top bar |
| **Geospatial Map** | `frontend/src/components/MapViewer.tsx` | Leaflet 2D dark basemap with simple GeoJSON overlays | `MapViewer.tsx` (Enhanced MapLibre / Leaflet satellite engine) | `GET /api/analysis/{id}/layers`, `GET /api/analysis/cases` | `bounds_wgs84`, `layer_urls.geojson`, `center` | Medium | Fullscreen, satellite basemap, minimap, coordinates |
| **Swipe Comparison** | Embedded inside `MapViewer.tsx` | Basic range slider | `ComparisonSlider.tsx` | `GET /api/analysis/compare` | `metrics`, `comparison_summary` | Medium | Drag handle `< >`, 4 modes (Swipe, Side-by-Side, Temporal, Diff) |
| **Layer Explorer** | `frontend/src/components/Sidebar.tsx` | Fixed left column list | `LayerExplorer.tsx` (Floating collapsible panel) | Local layer state + `GET /api/analysis/cases` | Layer visibility, opacity (0-100%), styling | Low | Floating midnight panel, 3 grouped categories |
| **Analysis Inspector** | `frontend/src/components/MetricsPanel.tsx` | Fixed right column metrics | `AnalysisInspector.tsx` (Floating 4-tab panel) | `GET /api/analysis/{id}/metrics`, `GET /api/analysis/{id}/results` | `open_water_km2`, `candidate_inundated_veg_km2`, `radar_statistics`, `provenance` | Low | Overview, Evidence, Symbology, Provenance tabs |
| **Acquisition Timeline** | None (Static dates) | None | `AcquisitionTimeline.tsx` (Floating filmstrip) | `manifest.json` / `GET /api/analysis/cases` | `pre_event`, `post_event`, timestamps, granules | Low | Discrete 3-stage SAR scrubber with play/pause |
| **Scientific Analytics** | Basic KPI cards | Raw numbers | `AnalyticsDrawer.tsx` (Bottom expandable drawer) | `GET /api/analysis/{id}/results` | `radar_statistics`, `cross_sensor_breakdown` | Low | Dual extent bar chart, backscatter distribution curve, regional summary |
| **Export Centre** | None | Raw GeoJSON direct link | `ExportModal.tsx` | Static endpoints & downloads | `geojson`, `classification_tif`, CSV, PDF | Low | Multi-format download dropdown |

---

## 4. Protected Backend Boundary Checklist

- [x] `backend/app/main.py`: Preserved (No route modifications).
- [x] `backend/app/routers/`: Preserved (`/api/nasa`, `/api/analysis`, `/api/jobs`).
- [x] `backend/app/services/`: Preserved (`detection_engine.py`, `geospatial.py`, `search_service.py`).
- [x] `backend/app/auth/`: Preserved (`earthdata.py`).
- [x] `backend/app/database.py`: Preserved (SQLite schema & models intact).
- [x] `data/cases/`: Preserved (`chennai_live_case`, `demo_flood_case` GeoTIFFs intact).

---

## 5. Visual Source of Truth

The visual source of truth is the approved Google Stitch dashboard reference image:
- **Primary Canvas**: Fullscreen high-resolution satellite imagery (Esri World Imagery / Carto / OSM).
- **Theme**: OrbitTrack Midnight Navy (`#060D17` background, `#0B1522` panels, `#111E2E` elevated cards, `#203247` borders).
- **Inundation Palettes**:
  - OPERA Mapped Water: Royal Blue (`#328CFF`) with 70% opacity.
  - Candidate Inundation (Canopy Double-Bounce): Golden Amber (`#FFB020`) with 60% opacity.
  - Permanent Water: Restrained Teal (`#14B8A6`) with 100% opacity.
  - SAR Backscatter Changes: Muted Violet (`#A78BFA`) with 50% opacity.
  - Study Area Boundary: Thin Pink (`#E85A9E`) polygon stroke.
