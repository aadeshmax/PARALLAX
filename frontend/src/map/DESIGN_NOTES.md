# PARALLAX — Map Module Design Notes & Architecture Audit

**Project:** PARALLAX (NASA Space Apps 2026 — NISAR L-band flood-signature investigation with cross-sensor gap analysis against NASA OPERA)  
**Target Module:** `frontend/src/map/`  
**Stack:** React 18, TypeScript 5, Vite 6, Tailwind CSS 3, MapLibre GL JS 6  
**Status:** Audit & Change Plan (Awaiting User "Go" before UI Code Edits)

---

## 1. Audit of Existing Map UI & Data Flow

### 1.1 Existing Implementations in Repository

The repository currently contains two separate map component implementations:
1. **`frontend/src/components/map/MapViewer.tsx` & `types.ts` (Hari Manoj's Initial Component):**
   * **Props:** `manifest: CaseManifest`, `baseTilesUrl?: string`, `swipeOpacity?: number`, `showDiffLayer?: boolean`, `showOperaLayer?: boolean`, `showGapLayer?: boolean`, `showPolygons?: boolean`, `selectedRegionId?: string | null`, `onSelectRegion?: (region: RegionProperties | null) => void`.
   * **Data Sources:** Consumes local tile pyramids from `data/cases/{case_id}/tiles/` (`pre_sar`, `post_sar`, `diff_db`, `opera_water`, `gap_overlay`) and vector polygons from `regions.geojson`.
   * **Strengths:** Lightweight, uses MapLibre GL JS directly with an Esri dark gray canvas; clean polygon selection event emitting `RegionProperties`.
   * **Gaps:** Lacks floating layer controls, bottom time-scrubber, dynamic unit-based legend, and on-map probe card.

2. **`frontend/src/components/MapViewer.tsx` (Dashboard Map in `App.tsx`):**
   * **Props:** `metrics: AnalysisMetrics | null`, `geojsonData: any`, `currentCase: CaseStudy | null`, `caseId: string`, `layers: LayerGroupsState`, `comparisonMode: ComparisonMode`, `onSelectComparisonMode`, `sliderPos: number`, `onSliderChange`, `targetCoords`, `onSelectEvidence`, `renderMode`, `blendMode`.
   * **Strengths:** Rich feature set including 3D pitch toggle, inspection points, comparison modes (`swipe`, `side-by-side`, `temporal`, `difference`), and bilinear raster resampling.
   * **Gaps & Conflicts:** Monolithic (907 lines); couples map canvas with external dashboard drawers; timeline scrubber is externalized to `AcquisitionTimeline.tsx`; inconsistent color tokens (`#287BFF`, `#328CFF`, `#00e5ff`, `#A78BFA` instead of the disciplined Ink & Signal palette).

### 1.2 Comparison Against the 6 Windy UX Ideas

| UX Concept | Current State in Repository | What is Missing / Needs Harmonization |
| :--- | :--- | :--- |
| **1. Full-bleed map as canvas** | Map fills container, but UI panels are large desktop sidebars (LayerExplorer, AnalysisInspector) that cover >50% of screen. | Pure full-bleed canvas with minimal floating hairline-bordered micro-panels (`#10161D` with 1px `#1F2A35`). |
| **2. Bottom time-scrubber** | Time slider is split into a separate bottom component (`AcquisitionTimeline`) with card thumbnails. | Unified slim horizontal floating scrubber (height 40px) at viewport bottom center with real scene date stamps, swipe handle, play/pause crossfade, and persistent `Demonstration` / `Observed` badge. |
| **3. Compact layer switcher** | Left sidebar is 320px wide with extensive checkboxes and categories. | Slim floating right/left rail button that expands into a compact floating drawer with icon + label + inline opacity sliders. |
| **4. Legend with units** | Legend is tucked inside a secondary tab of `AnalysisInspector` or floating badge without units. | Docked bottom-right thin legend bar indicating active layer units ($\text{dB}$ backscatter change, categorical classes for OPERA ice-cyan and candidate gap ember-amber). |
| **5. Click-to-probe card** | Clicking polygons opens right inspector tab or drops a simple marker; no dedicated on-canvas probe card. | Floating target crosshair with an anchored card displaying Polygon ID, acquisition dates, before/after dB, vegetation class, OPERA status, and scientific caution disclaimer. |
| **6. Polished feel** | Mixed color palettes, generic neon glow and borders. | Strict "Ink & Signal" aesthetic: 60fps MapLibre WebGL, zero neon glow, restrained 6–10px radii, `cubic-bezier(0.22, 1, 0.36, 1)` transitions. |

---

## 2. Live Windy UX Inspection Notes

Observations from `https://www.windy.com/?11.754,82.858,6` (tested via browser agent; standard architectural inspection):

1. **Full-Bleed Map as Canvas:**
   * *Observation:* Viewport is 100% WebGL canvas (`100vw` × `100vh`). UI overlays float with dark translucent surfaces (`rgba(35, 39, 47, 0.85)`), hairline borders (`1px solid rgba(255, 255, 255, 0.1)`), and soft drop shadows (`0 4px 12px rgba(0, 0, 0, 0.4)`).
   * *Parallax Mapping:* MapLibre GL JS canvas occupies the full container. Floating widgets use Ink & Signal tokens (`#10161D` panel, `#1F2A35` hairline border, 8px radius, subtle backdrop-blur).
2. **Bottom Time-Scrubber:**
   * *Observation:* Slim horizontal bar docked at screen bottom with calendar days on upper track, discrete time ticks below, circular play/pause button, and draggable scrubber needle.
   * *Parallax Mapping:* Bottom floating bar comparing the two actual observation scenes (Pre-event baseline vs Event SAR). Play button crossfades between the two real dates (never interpolating fake intermediate flood states). Displays a permanent `Demonstration` / `Observed` badge.
3. **Compact Layer Switcher:**
   * *Observation:* Floating vertical rail on right viewport edge with stacked pill buttons (icon + label). Clicking active layer reveals opacity and particle parameters.
   * *Parallax Mapping:* Compact vertical floating dock containing: Change ($\Delta\text{dB}$), OPERA Reference Water (`#5CE1E6`), Gap Candidates (`#FFB020`), and Spatial Basemap. Includes mini opacity sliders.
4. **Legend with Units:**
   * *Observation:* Compact horizontal color ramp docked bottom-right showing active layer gradient with discrete interval ticks and clickable unit switcher (`kt`, `m/s`, `°C`).
   * *Parallax Mapping:* Docked bottom-right legend showing discrete classes (Ice-Cyan for OPERA water, Ember-Amber for double-bounce gap) and continuous $\Delta\text{dB}$ ramp ($-15\text{ dB}$ to $+10\text{ dB}$).
5. **Click-to-Probe Card:**
   * *Observation:* Clicking anywhere drops a pulsing target crosshair and opens a lightweight anchored popup with high-hierarchy typography (bold value, unit, bearing, coordinates).
   * *Parallax Mapping:* Clicking a polygon drops a probe crosshair and renders a compact card: Polygon ID, coordinates, Before/After HH dB, $\Delta\text{dB}$, Vegetation Class, OPERA classification, and a scientific caveat ("Disagreement in mapped evidence, not confirmed floodwater").
6. **Polished Feel:**
   * *Observation:* High performance, restrained micro-interactions, no jarring jumps, consistent typography and dark-mode elegance.
   * *Parallax Mapping:* Smooth transitions using `cubic-bezier(0.22, 1, 0.36, 1)`, monospace numerals (`font-mono`) for dB values and dates, and strict adherence to scientific rigor.

---

## 3. Design & Motion System ("Ink & Signal")

### 3.1 Color Palette
* **Base Ink:** `#090D12` (Map background / darkest base)
* **Panel Surface:** `#10161D` (Floating controls and cards)
* **Hairline Border:** `#1F2A35` (1px crisp dividing borders)
* **Bone White:** `#E8E4DA` (Primary high-contrast text and values)
* **Muted Slate:** `#8A97A3` (Labels, captions, secondary text)
* **Signal Ice-Cyan:** `#5CE1E6` (OPERA mapped water / open water reference)
* **Signal Ember-Amber:** `#FFB020` (Candidate hidden water gap / double-bounce inundation)
* **Signal Ash:** `#6B7785` (Uncertain / no-data / unclassified)
* **Signal Radar Darken:** `#9D8CFF` (Specular SAR backscatter drop)

### 3.2 Motion & Easing
* **Timing:** 150ms for toggle switches, 250ms for card open/close, up to 500ms for raster crossfade.
* **Easing Function:** `cubic-bezier(0.22, 1, 0.36, 1)` (snappy ease-out, no bouncing).
* **Crossfade Rules:** Scrubber crossfades strictly between the two actual SAR observation timestamps (`T_0` Pre-event baseline and `T_1` Event observation). **Never synthesize or interpolate intermediate flood extents.**
* **Accessibility:** Respects `prefers-reduced-motion: reduce` by disabling transitions.

### 3.3 Scientific Integrity & Evidence Hierarchy
* Every dataset rendered carries an unambiguous badge:
  * `[Observed]`: Raw calibrated Sentinel-1 RTC or Sentinel-2 imagery.
  * `[Derived]`: NASA OPERA DSWx-S1 water extent product.
  * `[Inferred]`: PARALLAX candidate gap analysis ($\Delta\text{dB}$ and double-bounce heuristic).
  * `[Demonstration]`: Fixture-based test scenes (e.g. `demo_flood_case`).
* All gap layers display the mandatory caution: *"A gap is a disagreement in mapped evidence, not confirmed floodwater."*

---

## 4. File-by-File Change Plan (Scoped strictly inside `frontend/src/map/`)

All changes will be implemented in newly added, highly modular files within `frontend/src/map/`. No files outside `frontend/src/map/` will be modified.

1. **`frontend/src/map/DESIGN_NOTES.md`** *(New File)*:
   * Contains the complete audit, live Windy observations, design/motion specifications, change plan, and owner requests.
2. **`frontend/src/map/tokens.ts`** *(New File)*:
   * Exports colors, transitions, layer constants, and evidence badges for the Ink & Signal design system.
3. **`frontend/src/map/types.ts`** *(New File)*:
   * Consolidates and extends map types (`MapProps`, `RegionProperties`, `CaseManifest`, `LayerItem`, `ProbeData`, `TimelineState`) ensuring compatibility with both Hari Manoj's `onSelectRegion` and Sanjana's dashboard `onPolygonSelect`.
4. **`frontend/src/map/MapView.tsx`** *(New File)*:
   * Core full-bleed MapLibre GL JS component.
   * Manages base raster tile layers (`pre_sar`, `post_sar`, `diff_db`, `opera_water`, `gap_overlay`) with bilinear smoothing.
   * Renders `regions.geojson` with high-performance vector styling (Ice-Cyan for agreement, Ember-Amber for candidate gap).
   * Supports target coordinates navigation, click-to-probe, zoom controls, and scale bar.
5. **`frontend/src/map/LayerSwitcher.tsx`** *(New File)*:
   * Compact floating rail button and collapsible panel.
   * Shows active layers with color chips, visibility checkboxes, and smooth inline opacity sliders.
6. **`frontend/src/map/TimeScrubber.tsx`** *(New File)*:
   * Slim horizontal floating timeline at viewport bottom.
   * Displays Pre-event vs Event acquisition dates, interactive swipe slider, play/pause crossfade, and persistent `Demonstration` / `Observed` badge.
7. **`frontend/src/map/Legend.tsx`** *(New File)*:
   * Docked bottom-right scientific legend bar.
   * Renders discrete classes with explicit units ($\text{dB}$ and area categories).
8. **`frontend/src/map/ProbeCard.tsx`** *(New File)*:
   * Floating contextual probe popup displayed when a user clicks a polygon or location.
   * Shows Polygon ID, coordinates, Before/After HH dB, $\Delta\text{dB}$, Vegetation class, OPERA status, confidence score, and caution disclaimer.
9. **`frontend/src/map/index.ts`** *(New File)*:
   * Barrel export file exporting `MapView`, `LayerSwitcher`, `TimeScrubber`, `Legend`, `ProbeCard`, `tokens`, and `types`.

---

## 5. Requested Changes for Other Owners

*(Per strict scope rules, these edits are NOT made by this module and are logged here for future integration by project maintainers)*

1. **`frontend/src/App.tsx`:**
   * *Requested Change:* Import `{ MapView } from './map'` to optionally replace the monolithic `frontend/src/components/MapViewer.tsx` once team review is complete.
   * *Reason:* Provides seamless integration with the redesigned full-bleed Ink & Signal map architecture.
2. **`frontend/tailwind.config.js`:**
   * *Requested Change:* Add Ink & Signal color tokens (`ink: '#090D12'`, `panel: '#10161D'`, `hairline: '#1F2A35'`, `bone: '#E8E4DA'`, `muted: '#8A97A3'`, `signal-cyan: '#5CE1E6'`, `signal-amber: '#FFB020'`, `signal-ash: '#6B7785'`).
   * *Reason:* Standardizes Tailwind class names across all frontend sub-packages.
3. **`frontend/package.json`:**
   * *Requested Change:* Add `@fontsource/space-grotesk` and `@fontsource/jetbrains-mono` devDependencies.
   * *Reason:* Provides clean, offline typography pairing for data readouts and scientific units.
