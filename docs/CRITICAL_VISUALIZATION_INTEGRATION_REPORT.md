# PARALLAX — Critical Visualization Integration & MapLibre Migration Report

**Date**: November 15, 2026  
**Repository**: https://github.com/aadeshmax/PARALLAX  
**Integration Branch**: `feat/parallax-visualization-integration`  
**Checkpoint Branch**: `checkpoint/frontend-redesign-pre-merge`  
**Target Branch**: `main`  
**Authors/Contributors**: Frontend Integration Team, Hari Manoj (MapLibre & Tile Pipeline), Aadesh (SAR Engine & Backend)

---

## 1. Executive Summary

During the visual redesign of the PARALLAX dashboard, an approved midnight-navy UI/UX system was created. However, the initial integration encountered critical visualization defects:
1. **Missing Flood Overlays**: The UI displayed an underlying satellite basemap but failed to render the scientific flood extent overlays, change detection layers, and cross-sensor gap analyses.
2. **Basemap Watermarks**: Repeated `"CARTO API KEY REQUIRED"` watermarks appeared across the basemap caused by recent upstream authentication policies on Carto Dark Matter label tiles.
3. **Mismatched Slippy Tile Pyramids**: Stale XYZ tile directories in the repository contained coordinate slices from Rio Grande do Sul, Brazil (`z=11, x=731/732`), causing coordinate failure over Chennai, India (`z=11, x=1479/1480`).
4. **Placeholder Filmstrip Thumbnails & Hardcoded Statistics**: The timeline filmstrip and metrics panels displayed synthetic CSS noise and hardcoded design mockups (`42.8 km²`, `18.4 km²`, `94.2%`) instead of real backend telemetry.

### Resolution
- Integrated Hari Manoj's working MapLibre GL engine from `origin/main` without disturbing the approved single-dashboard midnight-navy interface.
- Switched basemaps and labels to official Esri tile servers (`ArcGIS/rest/services/World_Imagery` and `Reference/World_Boundaries_and_Places`), completely eliminating all Carto watermarks.
- Generated full, genuine, 5-layer Web Mercator tile pyramids (`pre_sar`, `post_sar`, `diff_db`, `opera_water`, `gap_overlay`) across zooms 11–15 for Chennai and all case studies.
- Rendered vector candidate inundation features from `regions.geojson` using high-performance MapLibre GL GeoJSON vector layers with sub-pixel topological smoothing and class-based symbology.
- Removed all hardcoded design values; wired all metrics, analytics, and timeline cards directly to `currentCase.statistics` and real backend API responses.
- Maintained 100% backend integrity: **36 / 36 backend tests pass** and **frontend Vite build succeeds cleanly in 4.71s**.

---

## 2. MapLibre GL Migration & Configuration

The initial frontend redesign attempted to use Leaflet with standard raster overlays, which struggled with high-density tile rendering, layer blending, and responsive vector styling. Hari Manoj had already implemented a MapLibre GL architecture on `origin/main`.

### Architecture & Worker Setup
- **Map Engine**: Migrated `frontend/src/components/MapViewer.tsx` to `maplibre-gl` (^6.18.0).
- **Web Worker Configuration**: Vite bundlers require explicit worker resolution for MapLibre. In `MapViewer.tsx`:
  ```typescript
  import maplibregl from 'maplibre-gl';
  import maplibreglWorkerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';
  maplibregl.workerUrl = maplibreglWorkerUrl;
  ```
- **Vite Optimization**: Configured `frontend/vite.config.ts` with `optimizeDeps.exclude: ['maplibre-gl']` and proxy routing for `/api` and `/data` to `http://127.0.0.1:8000`.
- **Canvas Lifecycle**: Created a single canvas container with automatic resize handling (`ResizeObserver`), preserveDrawingBuffer for export captures, and clean unmounting logic.

---

## 3. Basemap Watermark Elimination

### Issue Diagnosed
Carto recently deprecated open anonymous access to their Dark Matter and Voyager raster tiles, returning HTTP 403 / 401 with visual watermark stamps (`CARTO API KEY REQUIRED`) baked into tile imagery.

### Solution Implemented
Switched the basemap architecture in `MapViewer.tsx` to high-resolution, watermark-free Esri tile services:
- **Satellite Imagery**: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` (Max zoom: 19, zero watermarks)
- **Dark Canvas Option**: `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`
- **Cartographic Labels & Borders**: `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`

The reference boundaries and place labels layer is dynamically rendered above raster flood overlays but below vector outlines, ensuring readability of highways, water bodies, and city districts without obscuring satellite imagery.

---

## 4. Raster Satellite Layer Pyramids

### Directory Structure & Endpoints
Raster layers are structured as Web Mercator XYZ slippy tile pyramids under `/data/cases/{case_id}/tiles/{layer}/{z}/{x}/{y}.png`.

For `chennai_live_case`, genuine pyramids were computed directly from Sentinel-1 RTC and OPERA DSWx rasters:
```
data/cases/chennai_live_case/tiles/
├── pre_sar/      (1,857 tiles, zooms 11–15, normalized photographic SAR backscatter)
├── post_sar/     (1,865 tiles, zooms 11–15, during-cyclone Sentinel-1 radar)
├── diff_db/      (1,857 tiles, zooms 11–15, signed ΔdB difference: cyan specular, amber double-bounce)
├── opera_water/  (3,754 tiles, zooms 11–15, NASA OPERA DSWx-S1 classified water baseline)
└── gap_overlay/  (1,657 tiles, zooms 11–15, PARALLAX-only candidate inundation & hidden water)
```

### HTTP Verification
All 5 layers were verified through FastAPI's mounted `/data` endpoint with live HTTP requests:
- `GET /data/cases/chennai_live_case/tiles/pre_sar/12/2959/1895.png` -> **HTTP 200 OK** (image/png)
- `GET /data/cases/chennai_live_case/tiles/post_sar/12/2959/1895.png` -> **HTTP 200 OK** (image/png)
- `GET /data/cases/chennai_live_case/tiles/diff_db/12/2959/1895.png` -> **HTTP 200 OK** (image/png)
- `GET /data/cases/chennai_live_case/tiles/opera_water/12/2959/1895.png` -> **HTTP 200 OK** (image/png)
- `GET /data/cases/chennai_live_case/tiles/gap_overlay/12/2959/1895.png` -> **HTTP 200 OK** (image/png)

### Tile Pipeline Bug Fix
Identified and purged legacy Brazilian coordinate folders (`731`, `732`, `1463`, `1464`... `5856`) that had been inadvertently committed into `chennai_live_case/tiles/diff_db` and `gap_overlay`. Re-ran `scripts/generate_tiles.py` with genuine Chennai analytical rasters (`data/processed/chennai_live_case/backscatter_diff_db.tif` and `additional_candidate.tif`), ensuring 100% geographic alignment with Chennai's UTM Zone 44N footprint.

---

## 5. Vector Inundation Layers & Candidate Classification

### Vector Source
Candidate flood polygons are loaded dynamically from `/data/cases/{case_id}/regions.geojson`. The backend transforms geometries from local UTM projections to WGS84 (`EPSG:4326`) and applies topological polygon smoothing.

### Scientific Class Symbology
Polygons are categorized into distinct scientific tiers with color-coded fills and strokes:
| Class ID | Classification Label | Hex Fill | Stroke Color | Detection Mechanism |
| :---: | :--- | :---: | :---: | :--- |
| **1** | Confirmed Open Water (Agreement) | `#328CFF` (Electric Blue) | `#1E60C8` | Surface specular reflection attenuation verified by OPERA DSWx |
| **2** | Inundated Vegetation (Candidate) | `#FFB020` (Bright Amber) | `#C88000` | Dihedral double-bounce radar enhancement in vegetated canopy |
| **3** | Baseline-Only Water (OPERA) | `#14B8A6` (Cyan/Teal) | `#0D9488` | Standard classified optical/SAR water not meeting ΔdB threshold |
| **4** | PARALLAX-Only Candidate Water | `#FFB020` (Amber Gold) | `#E69500` | Radar backscatter drop without corresponding OPERA classification |

### Swath Boundary & Validation Sites
- **Sentinel-1 Burst Swath (`aoi_bbox`)**: Rendered as a distinct magenta perimeter bounding box (`#ec4899`, 2px dashed outline).
- **Field Staging Markers**: Staged field inspection sites (Adyar Estuary, Pallikaranai North, Velachery Lake) rendered with interactive pulse rings and inspection popups.

---

## 6. Swipe & Comparison Slider

### Dynamic Opacity Modulation
MapLibre GL allows real-time raster layer opacity adjustments without map re-renders. The central swipe slider (`sliderPos` 0%–100%) dynamically modulates:
- **Left Wing (0% to `sliderPos`)**: Baseline observation layers (`pre_sar`, `opera_water`) are rendered with high contrast.
- **Right Wing (`sliderPos` to 100%)**: Event observation layers (`post_sar`, `gap_overlay`, `diff_db`) are rendered.
- **Opacity Falloff**: In `swipe` mode, `sliderPos` controls split clipping; in `side-by-side` mode, split viewports sync camera center and pitch.

---

## 7. Scientific Integrity & Metrics Grounding

### De-Hardcoding of UI Mockups
All hardcoded placeholder statistics from the Stitch mockup were removed and replaced with genuine case manifest telemetry:
- **Baseline Water Footprint**: Formerly hardcoded `42.8 km²` -> Now dynamically displays `currentCase.statistics.baseline_water_area_sqkm` (`30.2 km²` for Chennai).
- **Additional Candidate Water**: Formerly hardcoded `18.4 km²` -> Now dynamically displays `currentCase.statistics.additional_candidate_area_sqkm` (`11.5 km²` for Chennai).
- **Total Valid AOI**: Formerly hardcoded `412.8 km²` -> Now dynamically displays `currentCase.statistics.total_valid_area_sqkm` (`78.9 km²`).
- **Sensor Agreement (IoU)**: Formerly hardcoded `94.2%` -> Now displays `currentCase.statistics.iou_agreement` (`58.1%`).

### Scientific Caveats & Ground Truth Disclaimers
The UI strictly enforces scientific integrity:
- Replaced misleading claims of *"Classification Accuracy: 94.2%"* with:
  > *"IoU is reported strictly as cross-sensor agreement between SAR candidate inundation and OPERA DSWx baseline, NOT ground-truth classification accuracy. Independent in-situ validation labels are required for precision/recall/F1 metrics."*
- Added explicit disclaimers:
  > *"Candidate inundation inferred from SAR backscatter anomalies; unverified ground truth."*
  > *"Mangrove and coastal vegetation double-bounce can be modulated by tidal stages and salinity."*

---

## 8. Pre-Event & Post-Event Timeline Integration

### Real Scene Metadata
The acquisition timeline filmstrip at the bottom-left connects directly to `currentCase.scenes`:
- **Pre-event Scene**: `OPERA_L2_RTC-S1_CHENNAI_20241124T003215Z_VV` (Acquired: Nov 24, 2024, 00:32 UTC)
- **During-event Scene**: `OPERA_L2_RTC-S1_CHENNAI_20241206T003214Z_VV` (Acquired: Dec 06, 2024, 00:32 UTC)
- **Reference Product**: `OPERA_L3_DSWx-S1_T44PMV_20241206T003214Z_v1.0` (Acquired: Dec 06, 2024, 00:32 UTC)

### Dynamic Thumbnail Generation
Replaced static CSS noise with dynamic center-tile slippy coordinates computed from `currentCase.center`:
```typescript
const getCenterTile = (layer: string) => {
  const [lon, lat] = currentCase.center;
  const z = 12;
  const n = 1 << z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  return `/data/cases/${selectedCaseId}/tiles/${layer}/${z}/${x}/${y}.png`;
};
```
For Chennai, this dynamically resolves to `/data/cases/chennai_live_case/tiles/pre_sar/12/2959/1895.png`, displaying genuine radar backscatter filmstrip thumbnails.

---

## 9. Multi-Case Demonstration & Persistence

The unified frontend and backend support four distinct demonstration and live cases:
1. **`chennai_live_case`**: Chennai Cyclone Fengal & Cooum/Adyar River Inundation (Tamil Nadu, India; UTM 44N). Real live Sentinel-1 RTC and OPERA DSWx data.
2. **`real_event_rio_grande_do_sul`**: Brazil 2024 Deluge (Porto Alegre & Guaíba Basin; UTM 22S).
3. **`mumbai_monsoon_event`**: Mumbai Monsoon Severe Urban Inundation (Maharashtra, India; UTM 43N).
4. **`demo_flood_case`**: Rapid offline test scene.

Switching cases in the top command bar instantly updates the map camera center, zoom level, layer pyramids, GeoJSON vector geometries, and analytical metrics.

---

## 10. Automated Test Results

### Backend Test Suite
Executed the complete automated test suite (`python -m pytest tests -q`):
```
....................................                                     [100%]
============================== 36 passed in 18.94s ==============================
```
- Total tests: **36 passed, 0 failed, 0 skipped**.
- Key verified test suites:
  - `test_chennai_live_case_execution_and_persistence`: PASSED
  - `test_analysis.py`: PASSED (10 tests)
  - `test_authentication.py`: PASSED
  - `test_cached_mode.py`: PASSED
  - `test_database.py`: PASSED
  - `test_datasets.py`: PASSED
  - `test_end_to_end.py`: PASSED
  - `test_nasa_integration.py`: PASSED
  - `test_scientific_engine.py`: PASSED
  - `test_security.py`: PASSED

### Frontend Production Build
Executed `npm --prefix frontend run build`:
```
> parallax-frontend@1.0.0 build
> tsc && vite build

vite v6.4.6 building for production...
transforming...
✓ 1600 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                  1.04 kB │ gzip:   0.64 kB
dist/assets/maplibre-gl-worker-Boc9pDRP.mjs    519.55 kB
dist/assets/index-D1f5c-h0.css                 103.70 kB │ gzip:  16.37 kB
dist/assets/index-CTp6NLNH.js                1,300.71 kB │ gzip: 361.16 kB
✓ built in 4.71s
```
- TypeScript check (`tsc`): **0 errors**.
- Vite production build: **Passed in 4.71s**.

---

## 11. Git Branch Integrity & Clean Merge

- **Current Working Branch**: `feat/parallax-visualization-integration`
- **Checkpoint Established**: `checkpoint/frontend-redesign-pre-merge` preserves the exact pre-merge redesign state.
- **Upstream Sync**: Merged `origin/main` containing Hari Manoj's commits (`bc4c1ad`, `795120d`, `5420763`), resolving all merge conflicts cleanly.
- **Merge Commit**: `f30ffb1` ("feat(integration): unify MapLibre XYZ satellite visualization with approved midnight-navy frontend").
- **Working Tree**: Completely clean, zero uncommitted or untracked changes. No `.env`, API credentials, tokens, or temporary files committed.

---

## 12. Verification & Live Dashboard Visual Inspection Checklist

| Checkpoint | Requirement | Result | Verification Detail |
| :---: | :--- | :---: | :--- |
| **1** | MapLibre GL Integration | **PASSED** | MapLibre GL v6.18 mounts canvas cleanly with web-worker configured. |
| **2** | Carto Watermark Removal | **PASSED** | Switched to Esri Satellite and Reference Boundaries; zero watermarks. |
| **3** | Pre-Event SAR Tile Layer | **PASSED** | HTTP 200 on `/data/cases/chennai_live_case/tiles/pre_sar/{z}/{x}/{y}.png`. |
| **4** | During-Event SAR Tile Layer | **PASSED** | HTTP 200 on `/data/cases/chennai_live_case/tiles/post_sar/{z}/{x}/{y}.png`. |
| **5** | Signed ΔdB Tile Layer | **PASSED** | HTTP 200 on `/data/cases/chennai_live_case/tiles/diff_db/{z}/{x}/{y}.png`. |
| **6** | OPERA Water Baseline Layer | **PASSED** | HTTP 200 on `/data/cases/chennai_live_case/tiles/opera_water/{z}/{x}/{y}.png`. |
| **7** | Cross-Sensor Gap Overlay | **PASSED** | HTTP 200 on `/data/cases/chennai_live_case/tiles/gap_overlay/{z}/{x}/{y}.png`. |
| **8** | Vector Candidate Polygons | **PASSED** | `regions.geojson` served and styled by scientific `class_id` 1–4. |
| **9** | Swipe Comparison Slider | **PASSED** | Dynamic opacity modulation updates seamlessly between pre/post SAR. |
| **10** | De-Hardcoded Statistics | **PASSED** | Connected to `currentCase.statistics` (30.2 km², 11.5 km², 78.9 km², 58.1% IoU). |
| **11** | Timeline Filmstrip | **PASSED** | Real scene IDs, timestamps, and dynamic center SAR thumbnails. |
| **12** | Multi-Case Switching | **PASSED** | Seamless switching between Chennai, Rio Grande do Sul, and Mumbai cases. |
| **13** | Backend Automated Tests | **PASSED** | 36 / 36 pytest tests pass in 18.94s. |
| **14** | Frontend Build Quality | **PASSED** | `tsc && vite build` completes in 4.71s with zero errors. |
| **15** | Git History Protection | **PASSED** | Clean branch, recoverable checkpoint, zero uncommitted files, zero leaked secrets. |
