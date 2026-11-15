import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreglWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// Explicitly bind MapLibre worker bundle URL to prevent Vite 404 worker load issues
maplibregl.setWorkerUrl(maplibreglWorkerUrl);

import {
  Plus,
  Minus,
  Compass,
  Navigation,
  Globe,
  ChevronDown,
  Activity,
  Layers
} from 'lucide-react';
import {
  AnalysisMetrics,
  CaseStudy,
  ComparisonMode,
  LayerGroupsState,
  VisualizationMode
} from '../types';

interface MapViewerProps {
  metrics: AnalysisMetrics | null;
  geojsonData: any;
  currentCase: CaseStudy | null;
  caseId: string;
  layers: LayerGroupsState;
  comparisonMode: ComparisonMode;
  onSelectComparisonMode: (mode: ComparisonMode) => void;
  sliderPos: number; // 0 to 100
  onSliderChange: (pos: number) => void;
  targetCoords?: [number, number] | null;
  onSelectEvidence?: (evidence: any) => void;
  renderMode?: VisualizationMode;
  onToggleRenderMode?: (mode: VisualizationMode) => void;
  blendMode?: string;
  isInspectorOpen?: boolean;
  isTimelineOpen?: boolean;
}

// Field validation staging sites per case
const CASE_INSPECTION_SITES: Record<string, Array<{ id: string; name: string; tag: string; coords: [number, number]; desc: string; type: 'veg' | 'water' }>> = {
  chennai_live_case: [
    { id: 'site-1', name: 'Site 1: Pallikaranai Marshlands', tag: 'Double-Bounce Gap (+4.7 dB)', coords: [80.145, 13.235], desc: 'Protected reed and mangrove swamp submerged beneath floodwaters', type: 'veg' },
    { id: 'site-2', name: 'Site 2: Cooum River Discharge', tag: 'Confirmed Water (-9.8 dB)', coords: [80.125, 13.275], desc: 'Severe bank overflow and urban street inundation', type: 'water' },
    { id: 'site-3', name: 'Site 3: Adyar Basin Corridor', tag: 'Canopy Double-Bounce', coords: [80.105, 13.250], desc: 'Riparian tree canopy standing in floodwater', type: 'veg' }
  ],
  mumbai_monsoon_event: [
    { id: 'site-1', name: 'Site 1: Thane Creek Mangrove Sanctuary', tag: 'Double-Bounce Gap (+4.2 dB)', coords: [72.940, 19.145], desc: 'Dense Avicennia mangrove canopy inundation during peak monsoon tide', type: 'veg' },
    { id: 'site-2', name: 'Site 2: Mithi River Spillway', tag: 'Confirmed Water (-11.2 dB)', coords: [72.880, 19.095], desc: 'Urban river channel overflow with severe specular radar drop', type: 'water' },
    { id: 'site-3', name: 'Site 3: Vikhroli Wetland Basin', tag: 'Canopy Reflection', coords: [72.920, 19.115], desc: 'Canopy-water dihedral scattering unmapped by standard optical DSWx', type: 'veg' }
  ],
  mumbai_nisar_2026: [
    { id: 'site-1', name: 'Site 1: Thane Creek Flamingo Sanctuary', tag: 'L-band Double-Bounce (+3.8 dB)', coords: [72.965, 19.085], desc: 'Extensive Avicennia mangrove canopy inundation and tidal channels', type: 'veg' },
    { id: 'site-2', name: 'Site 2: Ulhas River Estuarine Corridor', tag: 'Specular Water (-8.4 dB)', coords: [73.010, 19.250], desc: 'Broad open estuarine channel with deep specular radar darkening', type: 'water' },
    { id: 'site-3', name: 'Site 3: Elephanta Island Marine Margin', tag: 'Canopy Reflection', coords: [72.935, 18.960], desc: 'Coastal vegetation and rocky tidal margin double-bounce', type: 'veg' }
  ],
  real_event_rio_grande_do_sul: [
    { id: 'site-1', name: 'Site 1: Jacuí Delta Canopy Gap', tag: 'Double-Bounce (+4.8 dB)', coords: [-51.345, -29.865], desc: 'Dihedral radar double-bounce under flooded woody gallery forest', type: 'veg' },
    { id: 'site-2', name: 'Site 2: Taquari River Confluence', tag: 'Confirmed Water (-8.6 dB)', coords: [-51.390, -29.890], desc: 'Severe specular radar attenuation confirmed by OPERA DSWx', type: 'water' },
    { id: 'site-3', name: 'Site 3: Triunfo Lowland Agriculture', tag: 'Plausible Inundation', coords: [-51.320, -29.840], desc: 'Submerged field margins and canal overflow', type: 'veg' }
  ],
  demo_flood_case: [
    { id: 'site-1', name: 'Site 1: Brittany Woody Basin', tag: 'Double-Bounce Gap (+3.6 dB)', coords: [-4.635, 49.035], desc: 'Inundated deciduous forest canopy', type: 'veg' },
    { id: 'site-2', name: 'Site 2: Reservoir Flood Pool', tag: 'Confirmed Water (-7.9 dB)', coords: [-4.610, 49.055], desc: 'Open reservoir surface extent', type: 'water' }
  ]
};

export const MapViewer: React.FC<MapViewerProps> = ({
  metrics,
  geojsonData,
  currentCase,
  caseId,
  layers,
  comparisonMode,
  onSelectComparisonMode,
  sliderPos,
  onSliderChange,
  targetCoords,
  onSelectEvidence,
  renderMode = 'radar',
  onToggleRenderMode,
  blendMode = 'multiply',
  isInspectorOpen = false,
  isTimelineOpen = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const currentLoadedCaseRef = useRef<string | null>(null);
  const isMapLoadedRef = useRef<boolean>(false);

  const [basemapType, setBasemapType] = useState<'satellite' | 'dark'>('satellite');
  const [showBasemapMenu, setShowBasemapMenu] = useState<boolean>(false);
  const [is3D, setIs3D] = useState<boolean>(true);
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lon: number }>({
    lat: 13.2550,
    lon: 80.1185
  });
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);

  // Coordinate resolution per case
  const getCaseCenterAndZoom = (targetCaseId: string): { center: [number, number]; zoom: number } => {
    if (targetCaseId === 'chennai_live_case') {
      return { center: [80.118456, 13.254961], zoom: 12 };
    }
    if (targetCaseId === 'mumbai_monsoon_event') {
      return { center: [72.9038, 19.1206], zoom: 12 };
    }
    if (targetCaseId === 'mumbai_nisar_2026') {
      return { center: [72.950005, 19.100047], zoom: 11 };
    }
    if (targetCaseId === 'real_event_rio_grande_do_sul') {
      return { center: [-51.367617, -29.870559], zoom: 12 };
    }
    if (targetCaseId === 'demo_flood_case') {
      return { center: [-4.624, 49.042], zoom: 11 };
    }
    if (currentCase?.center) {
      return { center: [currentCase.center[0], currentCase.center[1]], zoom: 12 };
    }
    return { center: [80.118456, 13.254961], zoom: 12 };
  };

  // Safe layer and source removal
  const safelyRemoveLayerAndSource = (map: maplibregl.Map, layerId: string, sourceId: string) => {
    try {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    } catch (e) {
      // ignore
    }
    try {
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    } catch (e) {
      // ignore
    }
  };

  // 1. Initialize MapLibre GL Map (Once)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const { center, zoom } = getCaseCenterAndZoom(caseId);

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'esri-satellite': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'Esri, Maxar, Earthstar Geographics'
          },
          'esri-dark': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'Esri, HERE, Garmin, OpenStreetMap'
          },
          'esri-labels': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: ''
          }
        },
        layers: [
          {
            id: 'basemap-dark',
            type: 'raster',
            source: 'esri-dark',
            layout: { visibility: 'none' }
          },
          {
            id: 'basemap-satellite',
            type: 'raster',
            source: 'esri-satellite',
            layout: { visibility: 'visible' },
            paint: { 'raster-opacity': layers.earthObservation.satelliteBasemap.opacity / 100 }
          },
          {
            id: 'basemap-labels',
            type: 'raster',
            source: 'esri-labels',
            layout: { visibility: layers.spatialContext.roads.visible ? 'visible' : 'none' },
            paint: { 'raster-opacity': 0.85 }
          }
        ]
      },
      center: center,
      zoom: zoom,
      pitch: 45,
      bearing: -10,
      attributionControl: false
    });

    map.on('mousemove', (e) => {
      setMouseCoords({
        lat: parseFloat(e.lngLat.lat.toFixed(4)),
        lon: parseFloat(e.lngLat.lng.toFixed(4))
      });
    });

    map.on('load', () => {
      isMapLoadedRef.current = true;
      mapRef.current = map;
      (window as any)._map = map;
      setupInteractions(map);
      loadCaseData(map, caseId);
      setTimeout(() => map.resize(), 150);
    });

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      isMapLoadedRef.current = false;
      try {
        map.remove();
      } catch (e) {
        // ignore
      }
      mapRef.current = null;
      delete (window as any)._map;
    };
  }, []);

  // 2. Setup Event Handlers for Candidate Regions & Staging Sites
  const setupInteractions = (map: maplibregl.Map) => {
    map.on('click', 'candidates-fill', (e) => {
      if (!e.features || !e.features[0]) return;
      const p = e.features[0].properties as any;
      if (onSelectEvidence) {
        onSelectEvidence({
          className: p.class_name || (p.class_id === 2 ? 'Inundated Veg (Double-Bounce)' : 'Confirmed Open Water'),
          classId: Number(p.class_id) || 1,
          areaHa: Number(p.area_ha) || 0.45,
          detectionMechanism: p.detection_mechanism || 'Radar backscatter dihedral reflection',
          crossProductContext: p.cross_product_context || 'Complementary radar sensitivity under canopy',
          evidenceTier: p.evidence_tier || 'High backscatter signature',
          scientificLabel: p.scientific_label || 'Candidate Inundation (Unverified ground-truth)'
        });
      }
    });

    map.on('click', 'site-markers-dot', (e) => {
      if (!e.features || !e.features[0]) return;
      const p = e.features[0].properties as any;
      const geom = e.features[0].geometry as any;
      if (geom?.coordinates) {
        map.flyTo({ center: geom.coordinates, zoom: 13.5, speed: 1.2 });
      }
      if (onSelectEvidence) {
        onSelectEvidence({
          className: p.name,
          classId: p.type === 'veg' ? 2 : 1,
          areaHa: 4.5,
          detectionMechanism: p.desc,
          crossProductContext: p.tag,
          evidenceTier: 'Field Validation Staging Target',
          scientificLabel: 'In-Situ Radar Evaluation Site'
        });
      }
    });

    map.on('mouseenter', 'candidates-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'candidates-fill', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('mouseenter', 'site-markers-dot', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'site-markers-dot', () => {
      map.getCanvas().style.cursor = '';
    });
  };

  // 3. Load / Update Case Tiles & GeoJSON
  const loadCaseData = async (map: maplibregl.Map, activeCaseId: string) => {
    if (!map || !map.isStyleLoaded()) return;

    if (currentLoadedCaseRef.current !== activeCaseId) {
      currentLoadedCaseRef.current = activeCaseId;

      const rasterLayers = [
        ['gap-overlay-layer', 'gap-overlay'],
        ['opera-water-layer', 'opera-water'],
        ['diff-db-layer', 'diff-db'],
        ['post-sar-layer', 'post-sar'],
        ['pre-sar-layer', 'pre-sar']
      ];
      rasterLayers.forEach(([layerId, sourceId]) => {
        safelyRemoveLayerAndSource(map, layerId, sourceId);
      });

      const baseUrl = `/data/cases/${activeCaseId}/tiles`;

      // Pre-SAR (Continuous SAR backscatter with linear filtering and maxzoom 15)
      map.addSource('pre-sar', {
        type: 'raster',
        tiles: [`${baseUrl}/pre_sar/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 10,
        maxzoom: 15
      });
      map.addLayer({
        id: 'pre-sar-layer',
        type: 'raster',
        source: 'pre-sar',
        paint: {
          'raster-opacity': (layers.earthObservation.preEventSar.opacity / 100) * (comparisonMode === 'swipe' ? (1 - sliderPos / 100) : 1),
          'raster-resampling': 'linear',
          'raster-fade-duration': 300,
          'raster-contrast': renderMode === 'radar' ? 0.12 : 0
        },
        layout: { visibility: layers.earthObservation.preEventSar.visible ? 'visible' : 'none' }
      }, 'basemap-labels');

      // Post-SAR (During-Deluge SAR backscatter with linear filtering and maxzoom 15)
      map.addSource('post-sar', {
        type: 'raster',
        tiles: [`${baseUrl}/post_sar/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 10,
        maxzoom: 15
      });
      map.addLayer({
        id: 'post-sar-layer',
        type: 'raster',
        source: 'post-sar',
        paint: {
          'raster-opacity': (layers.earthObservation.postEventSar.opacity / 100) * (comparisonMode === 'swipe' ? (sliderPos / 100) : 1),
          'raster-resampling': 'linear',
          'raster-fade-duration': 300,
          'raster-contrast': renderMode === 'radar' ? 0.12 : 0
        },
        layout: { visibility: layers.earthObservation.postEventSar.visible ? 'visible' : 'none' }
      }, 'basemap-labels');

      // Diff-dB (Signed backscatter change with smooth bi-polar color ramp)
      map.addSource('diff-db', {
        type: 'raster',
        tiles: [`${baseUrl}/diff_db/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 10,
        maxzoom: 15
      });
      map.addLayer({
        id: 'diff-db-layer',
        type: 'raster',
        source: 'diff-db',
        paint: {
          'raster-opacity': layers.floodInundation.sarBackscatterChanges.opacity / 100,
          'raster-resampling': 'linear',
          'raster-fade-duration': 300,
          'raster-contrast': renderMode === 'radar' ? 0.15 : 0
        },
        layout: { visibility: layers.floodInundation.sarBackscatterChanges.visible ? 'visible' : 'none' }
      }, 'basemap-labels');

      // OPERA Water (Standard optical/SAR surface water baseline)
      map.addSource('opera-water', {
        type: 'raster',
        tiles: [`${baseUrl}/opera_water/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 10,
        maxzoom: 15
      });
      map.addLayer({
        id: 'opera-water-layer',
        type: 'raster',
        source: 'opera-water',
        paint: {
          'raster-opacity': (layers.floodInundation.operaMappedWater.opacity / 100) * (comparisonMode === 'swipe' ? Math.max(0.2, (1 - sliderPos / 100)) : 1),
          'raster-resampling': renderMode === 'radar' ? 'linear' : 'nearest',
          'raster-fade-duration': 300
        },
        layout: { visibility: layers.floodInundation.operaMappedWater.visible ? 'visible' : 'none' }
      }, 'basemap-labels');

      // Gap Overlay (Candidate Inundation & Hidden Water)
      map.addSource('gap-overlay', {
        type: 'raster',
        tiles: [`${baseUrl}/gap_overlay/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 10,
        maxzoom: 15
      });
      map.addLayer({
        id: 'gap-overlay-layer',
        type: 'raster',
        source: 'gap-overlay',
        paint: {
          'raster-opacity': (layers.floodInundation.candidateFloodwater.opacity / 100) * (comparisonMode === 'swipe' ? (sliderPos / 100) : 1),
          'raster-resampling': renderMode === 'radar' ? 'linear' : 'nearest',
          'raster-fade-duration': 300
        },
        layout: { visibility: layers.floodInundation.candidateFloodwater.visible ? 'visible' : 'none' }
      }, 'basemap-labels');

      // Vector Regions GeoJSON
      const vectorLayers = ['candidates-line', 'candidates-glow', 'candidates-fill', 'burst-boundary-line'];
      vectorLayers.forEach((l) => {
        if (map.getLayer(l)) map.removeLayer(l);
      });
      if (map.getSource('regions-geojson')) map.removeSource('regions-geojson');

      const geojsonUrl = `/data/cases/${activeCaseId}/regions.geojson`;
      map.addSource('regions-geojson', {
        type: 'geojson',
        data: geojsonUrl
      });

      // Atmospheric Weather Radar Halo/Diffusion Line (Refined Radar Mode)
      map.addLayer({
        id: 'candidates-glow',
        type: 'line',
        source: 'regions-geojson',
        paint: {
          'line-color': [
            'match',
            ['get', 'class_id'],
            1, '#328CFF',
            2, '#FFB020',
            3, '#14B8A6',
            4, '#FFB020',
            '#FFB020'
          ],
          'line-width': renderMode === 'radar' ? 5.0 : 0.1,
          'line-blur': renderMode === 'radar' ? 3.5 : 0,
          'line-opacity': renderMode === 'radar'
            ? [
                'match',
                ['get', 'class_id'],
                1, (layers.floodInundation.operaMappedWater.opacity / 100) * (comparisonMode === 'swipe' ? Math.max(0.15, (1 - sliderPos / 100)) * 0.40 : 0.40),
                2, (layers.floodInundation.candidateFloodwater.opacity / 100) * (comparisonMode === 'swipe' ? (sliderPos / 100) * 0.45 : 0.45),
                3, (layers.floodInundation.permanentWater.opacity / 100) * 0.35,
                4, (layers.floodInundation.candidateFloodwater.opacity / 100) * (comparisonMode === 'swipe' ? (sliderPos / 100) * 0.45 : 0.45),
                0.35
              ]
            : 0
        },
        layout: {
          visibility: (layers.floodInundation.candidateFloodwater.visible || layers.floodInundation.operaMappedWater.visible) && renderMode === 'radar' ? 'visible' : 'none'
        }
      }, 'basemap-labels');

      // Polygons Fill (Fluid atmospheric translucency & class-distinct symbology)
      map.addLayer({
        id: 'candidates-fill',
        type: 'fill',
        source: 'regions-geojson',
        paint: {
          'fill-color': [
            'match',
            ['get', 'class_id'],
            1, '#328CFF', // OPERA Mapped Water: Rich translucent blue
            2, '#FFB020', // Inundated Veg: Warm golden amber
            3, '#14B8A6', // Permanent Water: Restrained teal
            4, '#FFB020', // PARALLAX-Only Candidate: Warm golden amber
            '#FFB020'
          ],
          'fill-opacity': [
            'match',
            ['get', 'class_id'],
            1, (layers.floodInundation.operaMappedWater.opacity / 100) * (comparisonMode === 'swipe' ? Math.max(0.15, (1 - sliderPos / 100)) * 0.70 : 0.70),
            2, (layers.floodInundation.candidateFloodwater.opacity / 100) * (comparisonMode === 'swipe' ? (sliderPos / 100) * 0.72 : 0.72),
            3, (layers.floodInundation.permanentWater.opacity / 100) * 0.65,
            4, (layers.floodInundation.candidateFloodwater.opacity / 100) * (comparisonMode === 'swipe' ? (sliderPos / 100) * 0.72 : 0.72),
            0.50
          ],
          'fill-antialias': true
        },
        layout: {
          visibility: (layers.floodInundation.candidateFloodwater.visible || layers.floodInundation.operaMappedWater.visible) ? 'visible' : 'none'
        }
      }, 'basemap-labels');

      // Polygons Structural Contour Line
      map.addLayer({
        id: 'candidates-line',
        type: 'line',
        source: 'regions-geojson',
        paint: {
          'line-color': [
            'match',
            ['get', 'class_id'],
            1, renderMode === 'radar' ? '#328CFF' : '#1E60C8',
            2, renderMode === 'radar' ? '#FFB020' : '#D97706',
            3, renderMode === 'radar' ? '#14B8A6' : '#0D9488',
            4, renderMode === 'radar' ? '#FFB020' : '#D97706',
            '#FFB020'
          ],
          'line-width': renderMode === 'radar' ? 1.2 : 1.0,
          'line-opacity': [
            'match',
            ['get', 'class_id'],
            1, (layers.floodInundation.operaMappedWater.opacity / 100) * (comparisonMode === 'swipe' ? Math.max(0.15, (1 - sliderPos / 100)) * 0.80 : 0.80),
            2, (layers.floodInundation.candidateFloodwater.opacity / 100) * (comparisonMode === 'swipe' ? (sliderPos / 100) * 0.85 : 0.85),
            3, (layers.floodInundation.permanentWater.opacity / 100) * 0.80,
            4, (layers.floodInundation.candidateFloodwater.opacity / 100) * (comparisonMode === 'swipe' ? (sliderPos / 100) * 0.85 : 0.85),
            0.80
          ]
        },
        layout: {
          visibility: (layers.floodInundation.candidateFloodwater.visible || layers.floodInundation.operaMappedWater.visible) ? 'visible' : 'none'
        }
      }, 'basemap-labels');

      // Burst Swath Perimeter Boundary
      if (currentCase?.aoi_bbox) {
        const [w, s, e, n] = currentCase.aoi_bbox;
        const boundaryGeojson: any = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]]
          }
        };
        if (map.getSource('aoi-boundary')) {
          (map.getSource('aoi-boundary') as maplibregl.GeoJSONSource).setData(boundaryGeojson);
        } else {
          map.addSource('aoi-boundary', { type: 'geojson', data: boundaryGeojson });
          map.addLayer({
            id: 'burst-boundary-line',
            type: 'line',
            source: 'aoi-boundary',
            paint: {
              'line-color': '#E85A9E',
              'line-width': 2.0,
              'line-dasharray': [4, 3]
            },
            layout: {
              visibility: layers.spatialContext.studyAreaBoundary.visible ? 'visible' : 'none'
            }
          });
        }
      }

      // Inspection Site Markers
      const sites = CASE_INSPECTION_SITES[activeCaseId] || [];
      const sitesGeojson: any = {
        type: 'FeatureCollection',
        features: sites.map((s) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: s.coords },
          properties: s
        }))
      };
      if (map.getSource('site-markers')) {
        (map.getSource('site-markers') as maplibregl.GeoJSONSource).setData(sitesGeojson);
      } else {
        map.addSource('site-markers', { type: 'geojson', data: sitesGeojson });
        map.addLayer({
          id: 'site-markers-pulse',
          type: 'circle',
          source: 'site-markers',
          paint: {
            'circle-radius': 14,
            'circle-color': '#2DD4A0',
            'circle-opacity': 0.25
          }
        });
        map.addLayer({
          id: 'site-markers-dot',
          type: 'circle',
          source: 'site-markers',
          paint: {
            'circle-radius': 5,
            'circle-color': '#2DD4A0',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF'
          }
        });
      }
    }
  };

  // Fly to target coords
  useEffect(() => {
    if (targetCoords && mapRef.current) {
      mapRef.current.flyTo({ center: [targetCoords[1], targetCoords[0]], zoom: 13.5, speed: 1.5 });
    }
  }, [targetCoords]);

  // Center on current case and fit genuine bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    if (currentCase?.aoi_bbox && currentCase.aoi_bbox.length === 4) {
      const [w, s, e, n] = currentCase.aoi_bbox;
      map.fitBounds([[w, s], [e, n]], {
        padding: { top: 90, bottom: 90, left: 340, right: 380 },
        maxZoom: 13.5,
        speed: 1.2
      });
    } else {
      const { center, zoom } = getCaseCenterAndZoom(caseId);
      map.flyTo({ center, zoom, speed: 1.2 });
    }
    loadCaseData(map, caseId);
  }, [caseId, currentCase]);

  // Handle Layer Opacity, Visibility and Weather-Radar Mode Changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;

    // Basemap satellite opacity
    if (map.getLayer('basemap-satellite')) {
      map.setPaintProperty('basemap-satellite', 'raster-opacity', layers.earthObservation.satelliteBasemap.opacity / 100);
    }
    // Basemap labels visibility
    if (map.getLayer('basemap-labels')) {
      map.setLayoutProperty('basemap-labels', 'visibility', layers.spatialContext.roads.visible ? 'visible' : 'none');
    }
    // Pre-SAR
    if (map.getLayer('pre-sar-layer')) {
      map.setLayoutProperty('pre-sar-layer', 'visibility', layers.earthObservation.preEventSar.visible ? 'visible' : 'none');
      const op = (layers.earthObservation.preEventSar.opacity / 100) * (comparisonMode === 'swipe' ? (1 - sliderPos / 100) : 1);
      map.setPaintProperty('pre-sar-layer', 'raster-opacity', op);
      map.setPaintProperty('pre-sar-layer', 'raster-contrast', renderMode === 'radar' ? 0.12 : 0);
    }
    // Post-SAR
    if (map.getLayer('post-sar-layer')) {
      map.setLayoutProperty('post-sar-layer', 'visibility', layers.earthObservation.postEventSar.visible ? 'visible' : 'none');
      const op = (layers.earthObservation.postEventSar.opacity / 100) * (comparisonMode === 'swipe' ? (sliderPos / 100) : 1);
      map.setPaintProperty('post-sar-layer', 'raster-opacity', op);
      map.setPaintProperty('post-sar-layer', 'raster-contrast', renderMode === 'radar' ? 0.12 : 0);
    }
    // Diff dB
    if (map.getLayer('diff-db-layer')) {
      map.setLayoutProperty('diff-db-layer', 'visibility', layers.floodInundation.sarBackscatterChanges.visible ? 'visible' : 'none');
      map.setPaintProperty('diff-db-layer', 'raster-opacity', layers.floodInundation.sarBackscatterChanges.opacity / 100);
      map.setPaintProperty('diff-db-layer', 'raster-contrast', renderMode === 'radar' ? 0.15 : 0);
    }
    // OPERA Water
    if (map.getLayer('opera-water-layer')) {
      map.setLayoutProperty('opera-water-layer', 'visibility', layers.floodInundation.operaMappedWater.visible ? 'visible' : 'none');
      const op = (layers.floodInundation.operaMappedWater.opacity / 100) * (comparisonMode === 'swipe' ? Math.max(0.15, (1 - sliderPos / 100)) : 1);
      map.setPaintProperty('opera-water-layer', 'raster-opacity', op);
      map.setPaintProperty('opera-water-layer', 'raster-resampling', renderMode === 'radar' ? 'linear' : 'nearest');
    }
    // Gap Overlay (Candidate Floodwater)
    if (map.getLayer('gap-overlay-layer')) {
      map.setLayoutProperty('gap-overlay-layer', 'visibility', layers.floodInundation.candidateFloodwater.visible ? 'visible' : 'none');
      const op = (layers.floodInundation.candidateFloodwater.opacity / 100) * (comparisonMode === 'swipe' ? (sliderPos / 100) : 1);
      map.setPaintProperty('gap-overlay-layer', 'raster-opacity', op);
      map.setPaintProperty('gap-overlay-layer', 'raster-resampling', renderMode === 'radar' ? 'linear' : 'nearest');
    }
    // Atmospheric Weather Radar Halo/Diffusion Line
    if (map.getLayer('candidates-glow')) {
      const vis = (layers.floodInundation.candidateFloodwater.visible || layers.floodInundation.operaMappedWater.visible) && renderMode === 'radar';
      map.setLayoutProperty('candidates-glow', 'visibility', vis ? 'visible' : 'none');
      const operaOp = layers.floodInundation.operaMappedWater.opacity / 100;
      const candOp = layers.floodInundation.candidateFloodwater.opacity / 100;
      const permOp = layers.floodInundation.permanentWater.opacity / 100;
      const swipeCandFactor = comparisonMode === 'swipe' ? (sliderPos / 100) : 1;
      const swipeOperaFactor = comparisonMode === 'swipe' ? Math.max(0.15, (1 - sliderPos / 100)) : 1;
      map.setPaintProperty('candidates-glow', 'line-opacity', renderMode === 'radar' ? [
        'match',
        ['get', 'class_id'],
        1, operaOp * 0.40 * swipeOperaFactor,
        2, candOp * 0.45 * swipeCandFactor,
        3, permOp * 0.35,
        4, candOp * 0.45 * swipeCandFactor,
        0.35
      ] : 0);
      map.setPaintProperty('candidates-glow', 'line-width', renderMode === 'radar' ? 5.0 : 0.1);
      map.setPaintProperty('candidates-glow', 'line-blur', renderMode === 'radar' ? 3.5 : 0);
    }
    // Vector Regions Fill
    if (map.getLayer('candidates-fill')) {
      const vis = (layers.floodInundation.candidateFloodwater.visible || layers.floodInundation.operaMappedWater.visible) ? 'visible' : 'none';
      map.setLayoutProperty('candidates-fill', 'visibility', vis);
      const operaOp = layers.floodInundation.operaMappedWater.opacity / 100;
      const candOp = layers.floodInundation.candidateFloodwater.opacity / 100;
      const permOp = layers.floodInundation.permanentWater.opacity / 100;
      const swipeCandFactor = comparisonMode === 'swipe' ? (sliderPos / 100) : 1;
      const swipeOperaFactor = comparisonMode === 'swipe' ? Math.max(0.15, (1 - sliderPos / 100)) : 1;

      map.setPaintProperty('candidates-fill', 'fill-opacity', [
        'match',
        ['get', 'class_id'],
        1, operaOp * 0.70 * swipeOperaFactor,
        2, candOp * 0.72 * swipeCandFactor,
        3, permOp * 0.65,
        4, candOp * 0.72 * swipeCandFactor,
        0.50
      ]);
    }
    // Vector Regions Structural Contour Line
    if (map.getLayer('candidates-line')) {
      const vis = (layers.floodInundation.candidateFloodwater.visible || layers.floodInundation.operaMappedWater.visible) ? 'visible' : 'none';
      map.setLayoutProperty('candidates-line', 'visibility', vis);
      const operaOp = layers.floodInundation.operaMappedWater.opacity / 100;
      const candOp = layers.floodInundation.candidateFloodwater.opacity / 100;
      const permOp = layers.floodInundation.permanentWater.opacity / 100;
      const swipeCandFactor = comparisonMode === 'swipe' ? (sliderPos / 100) : 1;
      const swipeOperaFactor = comparisonMode === 'swipe' ? Math.max(0.15, (1 - sliderPos / 100)) : 1;

      map.setPaintProperty('candidates-line', 'line-width', renderMode === 'radar' ? 1.2 : 1.0);
      map.setPaintProperty('candidates-line', 'line-color', [
        'match',
        ['get', 'class_id'],
        1, renderMode === 'radar' ? '#328CFF' : '#1E60C8',
        2, renderMode === 'radar' ? '#FFB020' : '#D97706',
        3, renderMode === 'radar' ? '#14B8A6' : '#0D9488',
        4, renderMode === 'radar' ? '#FFB020' : '#D97706',
        '#FFB020'
      ]);
      map.setPaintProperty('candidates-line', 'line-opacity', [
        'match',
        ['get', 'class_id'],
        1, operaOp * 0.80 * swipeOperaFactor,
        2, candOp * 0.85 * swipeCandFactor,
        3, permOp * 0.80,
        4, candOp * 0.85 * swipeCandFactor,
        0.80
      ]);
    }
    // Boundary line
    if (map.getLayer('burst-boundary-line')) {
      map.setLayoutProperty('burst-boundary-line', 'visibility', layers.spatialContext.studyAreaBoundary.visible ? 'visible' : 'none');
    }
  }, [layers, comparisonMode, sliderPos, renderMode]);

  // Dynamically swap GeoJSON between Refined Radar Mode (smooth contours) and Scientific GIS Mode (raw 30m pixels)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    const source = map.getSource('regions-geojson') as maplibregl.GeoJSONSource;
    if (!source) return;

    const activeId = caseId || currentCase?.case_id || 'chennai_live_case';
    const targetUrl = renderMode === 'radar'
      ? `/data/cases/${activeId}/regions.geojson`
      : `/data/cases/${activeId}/regions_raw.geojson`;

    fetch(targetUrl)
      .then((res) => {
        if (res.ok) return res.json();
        return fetch(`/data/cases/${activeId}/regions.geojson`).then((r) => r.json());
      })
      .then((data) => {
        if (source && data) source.setData(data);
      })
      .catch((err) => console.warn('Could not switch geojson mode:', err));
  }, [renderMode, caseId, currentCase]);

  // Basemap switcher
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    if (basemapType === 'satellite') {
      if (map.getLayer('basemap-satellite')) map.setLayoutProperty('basemap-satellite', 'visibility', 'visible');
      if (map.getLayer('basemap-dark')) map.setLayoutProperty('basemap-dark', 'visibility', 'none');
    } else {
      if (map.getLayer('basemap-satellite')) map.setLayoutProperty('basemap-satellite', 'visibility', 'none');
      if (map.getLayer('basemap-dark')) map.setLayoutProperty('basemap-dark', 'visibility', 'visible');
    }
  }, [basemapType]);

  // Handle Swipe Divider Dragging
  const handleMouseDown = () => setIsDraggingSlider(true);
  const handleMouseUp = () => setIsDraggingSlider(false);
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingSlider || !mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = Math.round((x / rect.width) * 100);
    onSliderChange(pct);
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* MapLibre Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* SWIPE COMPARISON OVERLAY (When in Swipe Mode) */}
      {comparisonMode === 'swipe' && (
        <>
          {/* Top Pill Labels */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-midnight-panel/95 backdrop-blur-md border border-midnight-border shadow-2xl pointer-events-none">
            <span className="text-xs font-semibold text-midnight-opera px-2 py-0.5 rounded">
              OPERA Baseline
            </span>
            <span className="text-midnight-secondary text-xs">|</span>
            <span className="text-xs font-semibold text-midnight-candidate px-2 py-0.5 rounded">
              PARALLAX Analysis
            </span>
          </div>

          {/* Vertical Swipe Divider Line & Circular Handle */}
          <div
            className="absolute top-0 bottom-0 z-20 pointer-events-auto"
            style={{ left: `${sliderPos}%` }}
          >
            {/* Vertical Line */}
            <div className="w-0.5 h-full bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.7)]" />

            {/* Drag Handle */}
            <div
              onMouseDown={handleMouseDown}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-midnight-panel border-2 border-white shadow-2xl flex items-center justify-center text-white cursor-ew-resize hover:scale-110 active:scale-95 transition"
              title="Drag comparison slider"
            >
              <div className="flex items-center gap-0.5 text-[10px] font-bold">
                <span>‹</span>
                <span>›</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* RIGHT SIDE MAP NAVIGATION TOOLBAR (Dynamic offset when Inspector is open) */}
      <div className={`absolute top-16 z-10 flex flex-col items-center gap-2 pointer-events-auto transition-all duration-300 ${
        isInspectorOpen ? 'right-3 lg:right-[396px]' : 'right-3'
      }`}>
        {/* Basemap Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowBasemapMenu(!showBasemapMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-midnight-panel/95 backdrop-blur-md border border-midnight-border text-xs text-midnight-primary hover:border-midnight-accent shadow-2xl transition"
            title="Switch Basemap Style"
          >
            <Globe className="w-3.5 h-3.5 text-midnight-accent" />
            <span className="capitalize text-xs font-medium">{basemapType}</span>
            <ChevronDown className="w-3 h-3 text-midnight-secondary" />
          </button>

          {showBasemapMenu && (
            <div className="absolute right-0 top-full mt-1 w-28 bg-midnight-panel/95 backdrop-blur-md border border-midnight-border rounded-xl shadow-2xl py-1 z-30 text-xs">
              {(['satellite', 'dark'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setBasemapType(type);
                    setShowBasemapMenu(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left capitalize hover:bg-midnight-elevated transition ${
                    basemapType === type ? 'text-midnight-accent font-semibold' : 'text-midnight-primary'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Controls Pill */}
        <div className="flex flex-col rounded-xl bg-midnight-panel/95 backdrop-blur-md border border-midnight-border shadow-2xl overflow-hidden divide-y divide-midnight-border">
          <button
            onClick={() => mapRef.current?.zoomIn()}
            className="p-2 text-midnight-secondary hover:text-midnight-primary hover:bg-midnight-elevated transition"
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            className="p-2 text-midnight-secondary hover:text-midnight-primary hover:bg-midnight-elevated transition"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const map = mapRef.current;
              if (map) {
                const { center, zoom } = getCaseCenterAndZoom(caseId);
                map.flyTo({ center, zoom, pitch: 0, bearing: 0 });
              }
            }}
            className="p-2 text-midnight-secondary hover:text-midnight-primary hover:bg-midnight-elevated transition"
            title="Reset North & View"
          >
            <Compass className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              navigator.geolocation?.getCurrentPosition((pos) => {
                mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13 });
              });
            }}
            className="p-2 text-midnight-secondary hover:text-midnight-primary hover:bg-midnight-elevated transition"
            title="Find My Location"
          >
            <Navigation className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const map = mapRef.current;
              if (map) {
                const newPitch = is3D ? 0 : 55;
                map.easeTo({ pitch: newPitch, duration: 600 });
                setIs3D(!is3D);
              }
            }}
            className={`p-2 transition font-mono text-[10px] font-bold ${
              is3D ? 'text-midnight-accent bg-midnight-elevated' : 'text-midnight-secondary hover:text-midnight-primary'
            }`}
            title="Toggle 3D Perspective"
          >
            3D
          </button>
          <button
            onClick={() => onToggleRenderMode && onToggleRenderMode(renderMode === 'radar' ? 'scientific' : 'radar')}
            className={`p-2 transition font-mono text-[10px] font-bold ${
              renderMode === 'radar' ? 'text-midnight-accent bg-midnight-elevated' : 'text-midnight-secondary hover:text-midnight-primary'
            }`}
            title={renderMode === 'radar' ? 'Active: Refined Radar Mode (Click for Scientific GIS Mode)' : 'Active: Scientific GIS Mode (Click for Refined Radar Mode)'}
          >
            {renderMode === 'radar' ? 'RADAR' : 'GIS'}
          </button>
        </div>
      </div>

      {/* BOTTOM RIGHT MINIMAP INSET (Auto-hides cleanly when Analysis Inspector or Timeline is open) */}
      <div className={`absolute z-10 w-28 h-24 rounded-xl bg-midnight-panel/95 backdrop-blur-md border border-midnight-border shadow-2xl overflow-hidden pointer-events-none transition-all duration-300 ${
        isInspectorOpen || isTimelineOpen ? 'hidden' : 'bottom-24 right-3 hidden md:flex flex-col'
      }`}>
        <div className="w-full h-full relative bg-slate-950/90 flex items-center justify-center">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#203247_1px,transparent_1px),linear-gradient(to_bottom,#203247_1px,transparent_1px)] bg-[size:14px_14px] opacity-30" />
          <div className="w-10 h-8 rounded border border-midnight-boundary bg-midnight-boundary/10 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-midnight-boundary" />
          </div>
        </div>
      </div>

      {/* BOTTOM LEFT SCALE & COORDINATES READOUT (Hidden when timeline dock is active to prevent occlusion) */}
      {!isTimelineOpen && (
        <div className="absolute bottom-2 left-3 z-10 flex items-center gap-3 text-[10px] font-mono text-midnight-secondary/80 pointer-events-none transition-all duration-300">
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-1 border-b-2 border-l-2 border-r-2 border-midnight-secondary/60" />
            <span>5 km</span>
          </div>

          <div className="bg-midnight-panel/80 px-2 py-0.5 rounded border border-midnight-border/40">
            Lat <span className="text-midnight-primary">{mouseCoords.lat}°</span> Lon{' '}
            <span className="text-midnight-primary">{mouseCoords.lon}°</span>
          </div>

          <button
            onClick={() => onToggleRenderMode && onToggleRenderMode(renderMode === 'radar' ? 'scientific' : 'radar')}
            className="bg-midnight-panel/80 hover:bg-midnight-elevated px-2 py-0.5 rounded border border-midnight-border/40 flex items-center gap-1.5 transition pointer-events-auto cursor-pointer"
            title="Toggle Rendering Mode: Refined Weather Radar vs Scientific GIS"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${renderMode === 'radar' ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="uppercase text-[9px] font-semibold text-midnight-secondary">
              {renderMode === 'radar' ? 'Mode: Refined Radar' : 'Mode: Scientific GIS'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default MapViewer;
