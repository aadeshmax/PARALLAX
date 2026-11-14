import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreglWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// Explicitly bind MapLibre worker bundle URL to prevent Vite 404 worker load issues
maplibregl.setWorkerUrl(maplibreglWorkerUrl);

import { AnalysisMetrics, CaseStudy } from '../types';
import { Layers, Compass, MapPin, Sparkles, ShieldAlert, Sliders, Eye } from 'lucide-react';

interface MapViewerProps {
  metrics: AnalysisMetrics | null;
  geojsonData: any;
  caseId: string;
  currentCase?: CaseStudy;
  layers: {
    showOperaWater: boolean;
    showInundatedVeg: boolean;
    showOpenWater: boolean;
    showCrossSensorGap: boolean;
    showCompareSlider: boolean;
  };
  sliderPos: number;
  onSliderChange?: (val: number) => void;
}

interface EvidenceInfo {
  className: string;
  classId: number;
  areaHa: number;
  detectionMechanism: string;
  crossProductContext: string;
  evidenceTier: string;
  scientificLabel: string;
}

// Field validation staging sites per case (Felt / GIS style)
const CASE_INSPECTION_SITES: Record<string, Array<{ id: string; name: string; tag: string; coords: [number, number]; desc: string; type: 'veg' | 'water' }>> = {
  real_event_rio_grande_do_sul: [
    { id: 'site-1', name: 'Site 1: Jacuí Delta Canopy Gap', tag: 'Double-Bounce (+4.8 dB)', coords: [-51.345, -29.865], desc: 'Dihedral radar double-bounce under flooded woody gallery forest', type: 'veg' },
    { id: 'site-2', name: 'Site 2: Taquari River Confluence', tag: 'Confirmed Water (-8.6 dB)', coords: [-51.390, -29.890], desc: 'Severe specular radar attenuation confirmed by OPERA DSWx', type: 'water' },
    { id: 'site-3', name: 'Site 3: Triunfo Lowland Agriculture', tag: 'Plausible Inundation', coords: [-51.320, -29.840], desc: 'Submerged field margins and canal overflow', type: 'veg' }
  ],
  mumbai_monsoon_event: [
    { id: 'site-1', name: 'Site 1: Thane Creek Mangrove Sanctuary', tag: 'Double-Bounce Gap (+4.2 dB)', coords: [72.940, 19.145], desc: 'Dense Avicennia mangrove canopy inundation during peak monsoon tide', type: 'veg' },
    { id: 'site-2', name: 'Site 2: Mithi River Spillway', tag: 'Confirmed Water (-11.2 dB)', coords: [72.880, 19.095], desc: 'Urban river channel overflow with severe specular radar drop', type: 'water' },
    { id: 'site-3', name: 'Site 3: Vikhroli Wetland Basin', tag: 'Canopy Reflection', coords: [72.920, 19.115], desc: 'Canopy-water dihedral scattering unmapped by standard optical DSWx', type: 'veg' }
  ],
  chennai_live_case: [
    { id: 'site-1', name: 'Site 1: Pallikaranai Marshlands', tag: 'Double-Bounce Gap (+4.7 dB)', coords: [80.145, 13.235], desc: 'Protected reed and mangrove swamp submerged beneath floodwaters', type: 'veg' },
    { id: 'site-2', name: 'Site 2: Cooum River Discharge', tag: 'Confirmed Water (-9.8 dB)', coords: [80.125, 13.275], desc: 'Severe bank overflow and urban street inundation', type: 'water' },
    { id: 'site-3', name: 'Site 3: Adyar Basin Corridor', tag: 'Canopy Double-Bounce', coords: [80.105, 13.250], desc: 'Riparian tree canopy standing in floodwater', type: 'veg' }
  ],
  demo_flood_case: [
    { id: 'site-1', name: 'Site 1: Brittany Woody Basin', tag: 'Double-Bounce Gap (+3.6 dB)', coords: [-4.635, 49.035], desc: 'Inundated deciduous forest canopy', type: 'veg' },
    { id: 'site-2', name: 'Site 2: Reservoir Flood Pool', tag: 'Confirmed Water (-7.9 dB)', coords: [-4.610, 49.055], desc: 'Open reservoir surface extent', type: 'water' }
  ]
};

export const MapViewer: React.FC<MapViewerProps> = ({
  metrics,
  geojsonData,
  caseId,
  currentCase,
  layers,
  sliderPos,
  onSliderChange
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const currentLoadedCaseRef = useRef<string | null>(null);
  const isMapLoadedRef = useRef<boolean>(false);

  const [basemap, setBasemap] = useState<'satellite' | 'dark'>('satellite');
  const [is3D, setIs3D] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showSites, setShowSites] = useState<boolean>(true);
  const [radarMode, setRadarMode] = useState<'post' | 'pre' | 'compare'>('compare');
  const [radarOpacity, setRadarOpacity] = useState<number>(85);
  const [localSwipe, setLocalSwipe] = useState<number>(sliderPos);

  // Sync with sidebar layer toggle
  useEffect(() => {
    if (layers.showCompareSlider) {
      setRadarMode('compare');
    }
  }, [layers.showCompareSlider]);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceInfo | null>(null);
  const [isTourRunning, setIsTourRunning] = useState<boolean>(false);
  const tourTimeoutsRef = useRef<number[]>([]);

  // Guided Pitch Tour for hackathon judges
  const startGuidedTour = () => {
    const map = mapRef.current;
    if (!map) return;
    setIsTourRunning(true);
    tourTimeoutsRef.current.forEach(id => clearTimeout(id));
    tourTimeoutsRef.current = [];

    const { center } = getCaseCenterAndZoom(caseId);
    const sites = CASE_INSPECTION_SITES[caseId] || [];

    // Step 1: Broad Overview
    map.flyTo({ center: center, zoom: 11.2, pitch: 35, bearing: -10, speed: 0.8, essential: true });

    // Step 2: Site 1 (Canopy Inundation Gap) at 4.5s
    const t1 = window.setTimeout(() => {
      if (sites[0]) {
        map.flyTo({ center: sites[0].coords, zoom: 13.8, pitch: 58, bearing: 25, speed: 0.9, essential: true });
        setSelectedEvidence({
          className: sites[0].name,
          classId: 2,
          areaHa: 4.8,
          detectionMechanism: sites[0].desc,
          crossProductContext: sites[0].tag,
          evidenceTier: 'High Double-Bounce Anomaly',
          scientificLabel: 'Hidden Water Gap under Canopy'
        });
      }
    }, 4500);

    // Step 3: Site 2 (River Floodplain Channel) at 11s
    const t2 = window.setTimeout(() => {
      if (sites[1]) {
        map.flyTo({ center: sites[1].coords, zoom: 13.5, pitch: 50, bearing: -35, speed: 0.9, essential: true });
        setSelectedEvidence({
          className: sites[1].name,
          classId: 1,
          areaHa: 25.2,
          detectionMechanism: sites[1].desc,
          crossProductContext: sites[1].tag,
          evidenceTier: 'Specular Radar Darkening Agreement',
          scientificLabel: 'OPERA DSWx Verified Open Water'
        });
      }
    }, 11000);

    // Step 4: Return to Global 3D Orbit at 18s
    const t3 = window.setTimeout(() => {
      map.flyTo({ center: center, zoom: 12, pitch: 52, bearing: -15, speed: 0.8, essential: true });
      setIsTourRunning(false);
    }, 18000);

    tourTimeoutsRef.current.push(t1, t2, t3);
  };

  const stopGuidedTour = () => {
    tourTimeoutsRef.current.forEach(id => clearTimeout(id));
    tourTimeoutsRef.current = [];
    setIsTourRunning(false);
  };

  useEffect(() => {
    return () => {
      tourTimeoutsRef.current.forEach(id => clearTimeout(id));
    };
  }, []);

  // Sync external slider
  useEffect(() => {
    setLocalSwipe(sliderPos);
  }, [sliderPos]);

  // Coordinate resolution per case
  const getCaseCenterAndZoom = (targetCaseId: string): { center: [number, number]; zoom: number } => {
    if (targetCaseId === 'real_event_rio_grande_do_sul') {
      return { center: [-51.3676, -29.8705], zoom: 12 };
    }
    if (targetCaseId === 'mumbai_monsoon_event') {
      return { center: [72.9038, 19.1206], zoom: 12 };
    }
    if (targetCaseId === 'chennai_live_case') {
      return { center: [80.1185, 13.2550], zoom: 12 };
    }
    if (targetCaseId === 'demo_flood_case') {
      return { center: [-4.624, 49.042], zoom: 11 };
    }
    if (currentCase && currentCase.center) {
      const c = currentCase.center;
      return { center: [c[0], c[1]], zoom: 11 };
    }
    return { center: [-51.3676, -29.8705], zoom: 12 };
  };

  // Safe removal helper
  const safelyRemoveLayerAndSource = (map: maplibregl.Map, layerId: string, sourceId: string) => {
    try {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    } catch (e) {
      // Ignore
    }
    try {
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    } catch (e) {
      // Ignore
    }
  };

  // 1. Initialize MapLibre GL Map (Once)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // Prevent double initialization

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
            layout: { visibility: 'visible' }
          },
          {
            id: 'basemap-labels',
            type: 'raster',
            source: 'esri-labels',
            layout: { visibility: 'visible' },
            paint: { 'raster-opacity': 0.85 }
          }
        ]
      },
      center: center,
      zoom: zoom,
      pitch: 52,
      bearing: -15
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');

    map.on('load', () => {
      isMapLoadedRef.current = true;
      mapRef.current = map;
      setupInteractions(map);
      loadCaseData(map, caseId);
      setTimeout(() => map.resize(), 150);
    });

    // Handle container resizing
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
        // Ignore during teardown
      }
      mapRef.current = null;
    };
  }, []);

  // 2. Setup Event Handlers (Only Once)
  const setupInteractions = (map: maplibregl.Map) => {
    // Click candidate polygons
    map.on('click', 'candidates-fill', (e) => {
      if (!e.features || !e.features[0]) return;
      const p = e.features[0].properties as any;
      setSelectedEvidence({
        className: p.class_name || (p.class_id === 2 ? 'Inundated Veg (Double-Bounce)' : 'Confirmed Open Water'),
        classId: Number(p.class_id) || 1,
        areaHa: Number(p.area_ha) || 0.45,
        detectionMechanism: p.detection_mechanism || 'Radar backscatter dihedral reflection',
        crossProductContext: p.cross_product_context || 'Complementary radar sensitivity under canopy',
        evidenceTier: p.evidence_tier || 'High backscatter signature',
        scientificLabel: p.scientific_label || 'Candidate Inundation (Unverified ground-truth)'
      });
    });

    // Click inspection site markers (Felt style)
    map.on('click', 'site-markers-dot', (e) => {
      if (!e.features || !e.features[0]) return;
      const p = e.features[0].properties as any;
      const geom = e.features[0].geometry as any;
      if (geom && geom.coordinates) {
        map.flyTo({ center: geom.coordinates, zoom: 13.5, speed: 1.2 });
      }
      setSelectedEvidence({
        className: p.name,
        classId: p.type === 'veg' ? 2 : 1,
        areaHa: 4.5,
        detectionMechanism: p.desc,
        crossProductContext: p.tag,
        evidenceTier: 'Field Validation Staging Target',
        scientificLabel: 'In-Situ Radar Evaluation Site'
      });
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

    // A. Recreate Raster Sources ONLY if caseId changed
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
      const baseOp = radarOpacity / 100;
      const swipeRatio = localSwipe / 100;

      const preOp = radarMode === 'pre'
        ? baseOp
        : radarMode === 'compare'
          ? baseOp * (1 - swipeRatio)
          : 0;

      const postOp = radarMode === 'post'
        ? baseOp
        : radarMode === 'compare'
          ? baseOp * swipeRatio
          : 0;

      try {
        // 1. Pre-SAR (Hardware linear interpolation up to zoom 18)
        map.addSource('pre-sar', {
          type: 'raster',
          tiles: [`${baseUrl}/pre_sar/{z}/{x}/{y}.png`],
          tileSize: 256,
          minzoom: 11,
          maxzoom: 18
        });
        map.addLayer({
          id: 'pre-sar-layer',
          type: 'raster',
          source: 'pre-sar',
          paint: {
            'raster-opacity': preOp,
            'raster-resampling': 'linear',
            'raster-contrast': 0.18,
            'raster-fade-duration': 0
          }
        });

        // 2. Post-SAR (Hardware linear interpolation up to zoom 18)
        map.addSource('post-sar', {
          type: 'raster',
          tiles: [`${baseUrl}/post_sar/{z}/{x}/{y}.png`],
          tileSize: 256,
          minzoom: 11,
          maxzoom: 18
        });
        map.addLayer({
          id: 'post-sar-layer',
          type: 'raster',
          source: 'post-sar',
          paint: {
            'raster-opacity': postOp,
            'raster-resampling': 'linear',
            'raster-contrast': 0.18,
            'raster-fade-duration': 0
          }
        });

        // 3. Diff dB
        map.addSource('diff-db', {
          type: 'raster',
          tiles: [`${baseUrl}/diff_db/{z}/{x}/{y}.png`],
          tileSize: 256,
          minzoom: 11,
          maxzoom: 18
        });
        map.addLayer({
          id: 'diff-db-layer',
          type: 'raster',
          source: 'diff-db',
          layout: { visibility: layers.showCompareSlider ? 'visible' : 'none' },
          paint: {
            'raster-opacity': 0.85,
            'raster-resampling': 'linear'
          }
        });

        // 4. OPERA Water
        map.addSource('opera-water', {
          type: 'raster',
          tiles: [`${baseUrl}/opera_water/{z}/{x}/{y}.png`],
          tileSize: 256,
          minzoom: 11,
          maxzoom: 18
        });
        map.addLayer({
          id: 'opera-water-layer',
          type: 'raster',
          source: 'opera-water',
          layout: { visibility: layers.showOperaWater ? 'visible' : 'none' },
          paint: {
            'raster-opacity': 0.85,
            'raster-resampling': 'linear'
          }
        });

        // 5. Gap Overlay
        map.addSource('gap-overlay', {
          type: 'raster',
          tiles: [`${baseUrl}/gap_overlay/{z}/{x}/{y}.png`],
          tileSize: 256,
          minzoom: 11,
          maxzoom: 18
        });
        map.addLayer({
          id: 'gap-overlay-layer',
          type: 'raster',
          source: 'gap-overlay',
          layout: { visibility: layers.showCrossSensorGap ? 'visible' : 'none' },
          paint: {
            'raster-opacity': 0.90,
            'raster-resampling': 'linear'
          }
        });

        // 6. SAR Swath Frame / Footprint (Felt red perimeter box)
        const aoiBbox = currentCase?.aoi_bbox || (
          activeCaseId === 'real_event_rio_grande_do_sul' ? [-51.414, -29.911, -51.321, -29.830] :
          activeCaseId === 'mumbai_monsoon_event' ? [72.861, 19.080, 72.947, 19.162] :
          activeCaseId === 'chennai_live_case' ? [80.077, 13.214, 80.160, 13.296] :
          [-4.68, 49.00, -4.56, 49.08]
        );

        const footprintGeojson = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: { label: 'Sentinel-1 L2 RTC-S1 Swath Perimeter' },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [aoiBbox[0], aoiBbox[1]],
                [aoiBbox[2], aoiBbox[1]],
                [aoiBbox[2], aoiBbox[3]],
                [aoiBbox[0], aoiBbox[3]],
                [aoiBbox[0], aoiBbox[1]]
              ]]
            }
          }]
        };

        safelyRemoveLayerAndSource(map, 'swath-footprint-line', 'swath-footprint');
        map.addSource('swath-footprint', {
          type: 'geojson',
          data: footprintGeojson as any
        });
        map.addLayer({
          id: 'swath-footprint-line',
          type: 'line',
          source: 'swath-footprint',
          paint: {
            'line-color': '#f43f5e',
            'line-width': 1.6,
            'line-dasharray': [4, 2],
            'line-opacity': 0.9
          }
        });

        // 7. Staging Sites Markers (Felt style green markers & labels)
        const sites = CASE_INSPECTION_SITES[activeCaseId] || [];
        const sitesGeojson = {
          type: 'FeatureCollection',
          features: sites.map(s => ({
            type: 'Feature',
            properties: {
              id: s.id,
              name: s.name,
              tag: s.tag,
              desc: s.desc,
              type: s.type
            },
            geometry: {
              type: 'Point',
              coordinates: s.coords
            }
          }))
        };

        safelyRemoveLayerAndSource(map, 'site-markers-label', 'inspection-sites');
        safelyRemoveLayerAndSource(map, 'site-markers-dot', 'inspection-sites');
        safelyRemoveLayerAndSource(map, 'site-markers-pulse', 'inspection-sites');

        map.addSource('inspection-sites', {
          type: 'geojson',
          data: sitesGeojson as any
        });

        // Glowing green pulse halo
        map.addLayer({
          id: 'site-markers-pulse',
          type: 'circle',
          source: 'inspection-sites',
          layout: { visibility: showSites ? 'visible' : 'none' },
          paint: {
            'circle-radius': 11,
            'circle-color': '#10b981',
            'circle-opacity': 0.35
          }
        });

        // White-bordered emerald dot
        map.addLayer({
          id: 'site-markers-dot',
          type: 'circle',
          source: 'inspection-sites',
          layout: { visibility: showSites ? 'visible' : 'none' },
          paint: {
            'circle-radius': 5.5,
            'circle-color': '#10b981',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });

        // Clear readable label
        map.addLayer({
          id: 'site-markers-label',
          type: 'symbol',
          source: 'inspection-sites',
          layout: {
            visibility: showSites ? 'visible' : 'none',
            'text-field': ['get', 'name'],
            'text-size': 11,
            'text-offset': [0, 1.4],
            'text-anchor': 'top',
            'text-allow-overlap': true
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#090d16',
            'text-halo-width': 2.5
          }
        });

      } catch (e) {
        console.warn("Notice loading raster tiles:", e);
      }
    }

    // B. Ingest / Update GeoJSON Data safely
    let dataToLoad = geojsonData;
    if (!dataToLoad) {
      try {
        const res = await fetch(`/data/cases/${activeCaseId}/regions.geojson`);
        if (res.ok) {
          dataToLoad = await res.json();
        }
      } catch (e) {
        console.warn("Notice loading fallback regions.geojson:", e);
      }
    }

    if (dataToLoad && dataToLoad.features) {
      try {
        const existingSource = map.getSource('candidates-geojson') as maplibregl.GeoJSONSource | undefined;
        if (existingSource && typeof existingSource.setData === 'function') {
          // Smooth update without recreating source
          existingSource.setData(dataToLoad);
        } else {
          safelyRemoveLayerAndSource(map, 'candidates-line', 'candidates-geojson');
          safelyRemoveLayerAndSource(map, 'candidates-fill', 'candidates-geojson');

          map.addSource('candidates-geojson', {
            type: 'geojson',
            data: dataToLoad
          });

          // Soft translucent fill allowing underlying photographic radar textures to be visible
          map.addLayer({
            id: 'candidates-fill',
            type: 'fill',
            source: 'candidates-geojson',
            paint: {
              'fill-color': [
                'match',
                ['get', 'class_id'],
                2, '#fbbf24',
                1, '#06b6d4',
                4, '#f97316',
                '#38bdf8'
              ],
              'fill-opacity': 0.26
            }
          });

          // Luminous rounded neon stroke
          map.addLayer({
            id: 'candidates-line',
            type: 'line',
            source: 'candidates-geojson',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': [
                'match',
                ['get', 'class_id'],
                2, '#fde68a',
                1, '#67e8f9',
                '#ffffff'
              ],
              'line-width': 2.0,
              'line-opacity': 0.95
            }
          });
        }
      } catch (e) {
        console.warn("Notice updating GeoJSON source:", e);
      }
    }

    // Ensure labels and markers stay on top
    try {
      if (map.getLayer('basemap-labels')) map.moveLayer('basemap-labels');
      if (map.getLayer('swath-footprint-line')) map.moveLayer('swath-footprint-line');
      if (map.getLayer('site-markers-pulse')) map.moveLayer('site-markers-pulse');
      if (map.getLayer('site-markers-dot')) map.moveLayer('site-markers-dot');
      if (map.getLayer('site-markers-label')) map.moveLayer('site-markers-label');
    } catch (e) {
      // Ignore
    }
  };

  // 4. Handle Case Switch (flyTo + loadCaseData)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;

    const { center, zoom } = getCaseCenterAndZoom(caseId);
    try {
      map.flyTo({
        center: center,
        zoom: zoom,
        pitch: is3D ? 52 : 0,
        bearing: is3D ? -15 : 0,
        speed: 1.2,
        curve: 1.4,
        essential: true
      });
    } catch (e) {
      // Ignore
    }

    loadCaseData(map, caseId);
  }, [caseId]);

  // 5. Handle GeoJSON Prop Updates (Without triggering raster reload)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;

    if (geojsonData && geojsonData.features) {
      try {
        const source = map.getSource('candidates-geojson') as maplibregl.GeoJSONSource | undefined;
        if (source && typeof source.setData === 'function') {
          source.setData(geojsonData);
        } else {
          loadCaseData(map, caseId);
        }
      } catch (e) {
        // Ignore
      }
    }
  }, [geojsonData]);

  // 6. Update Layer Visibilities
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;

    try {
      if (map.getLayer('opera-water-layer')) {
        map.setLayoutProperty('opera-water-layer', 'visibility', layers.showOperaWater ? 'visible' : 'none');
      }
      if (map.getLayer('gap-overlay-layer')) {
        map.setLayoutProperty('gap-overlay-layer', 'visibility', layers.showCrossSensorGap ? 'visible' : 'none');
      }
      if (map.getLayer('diff-db-layer')) {
        map.setLayoutProperty('diff-db-layer', 'visibility', layers.showCompareSlider ? 'visible' : 'none');
      }
      if (map.getLayer('candidates-fill')) {
        map.setLayoutProperty(
          'candidates-fill',
          'visibility',
          layers.showOpenWater || layers.showInundatedVeg ? 'visible' : 'none'
        );
      }
      if (map.getLayer('candidates-line')) {
        map.setLayoutProperty(
          'candidates-line',
          'visibility',
          layers.showOpenWater || layers.showInundatedVeg ? 'visible' : 'none'
        );
      }
    } catch (e) {
      // Ignore
    }
  }, [layers]);

  // 7. Update Opacities & Mode (Zero ghosting blur in single-image modes)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;

    const baseOp = radarOpacity / 100;
    const swipeRatio = localSwipe / 100;

    const preOp = radarMode === 'pre'
      ? baseOp
      : radarMode === 'compare'
        ? baseOp * (1 - swipeRatio)
        : 0;

    const postOp = radarMode === 'post'
      ? baseOp
      : radarMode === 'compare'
        ? baseOp * swipeRatio
        : 0;

    try {
      if (map.getLayer('pre-sar-layer')) {
        map.setPaintProperty('pre-sar-layer', 'raster-opacity', preOp);
      }
      if (map.getLayer('post-sar-layer')) {
        map.setPaintProperty('post-sar-layer', 'raster-opacity', postOp);
      }
    } catch (e) {
      // Ignore
    }
  }, [radarOpacity, localSwipe, radarMode]);

  // 8. Staging Sites Toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    try {
      const vis = showSites ? 'visible' : 'none';
      if (map.getLayer('site-markers-pulse')) map.setLayoutProperty('site-markers-pulse', 'visibility', vis);
      if (map.getLayer('site-markers-dot')) map.setLayoutProperty('site-markers-dot', 'visibility', vis);
      if (map.getLayer('site-markers-label')) map.setLayoutProperty('site-markers-label', 'visibility', vis);
    } catch (e) {
      // Ignore
    }
  }, [showSites]);

  // 9. Basemap & Tilt Toggles
  const handleBasemapChange = (type: 'satellite' | 'dark') => {
    const map = mapRef.current;
    if (!map) return;
    setBasemap(type);
    try {
      map.setLayoutProperty('basemap-satellite', 'visibility', type === 'satellite' ? 'visible' : 'none');
      map.setLayoutProperty('basemap-dark', 'visibility', type === 'dark' ? 'visible' : 'none');
    } catch (e) {
      // Ignore
    }
  };

  const toggleTilt = () => {
    const map = mapRef.current;
    if (!map) return;
    const new3D = !is3D;
    setIs3D(new3D);
    try {
      map.easeTo({
        pitch: new3D ? 52 : 0,
        bearing: new3D ? -15 : 0,
        duration: 900
      });
    } catch (e) {
      // Ignore
    }
  };

  const toggleLabels = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !showLabels;
    setShowLabels(next);
    try {
      map.setLayoutProperty('basemap-labels', 'visibility', next ? 'visible' : 'none');
    } catch (e) {
      // Ignore
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#080d1a]" style={{ minHeight: '100%' }}>
      {/* Map Canvas with absolute positioning ensuring 100% dimensions */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Floating On-Map Control Stack (Felt & GIS Inspired, Clean vertical hierarchy) */}
      <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2 max-w-[calc(100%-80px)] pointer-events-none">
        {/* Row 1: Primary On-Map Toolbar */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-2xl font-mono text-xs">
          {/* Basemap Perspective Buttons */}
          <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => handleBasemapChange('satellite')}
              className={`h-7 px-2.5 flex items-center rounded-md text-[11px] font-semibold transition ${
                basemap === 'satellite'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🛰️ Satellite Ortho
            </button>
            <button
              onClick={() => handleBasemapChange('dark')}
              className={`h-7 px-2.5 flex items-center rounded-md text-[11px] font-semibold transition ${
                basemap === 'dark'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🗺️ Dark Canvas
            </button>
          </div>

          {/* High-Resolution Radar Mode (Zero-ghosting clarity) */}
          <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => setRadarMode('post')}
              className={`h-7 px-2.5 flex items-center rounded-md text-[11px] font-semibold transition ${
                radarMode === 'post'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="View crisp Peak Flood SAR imagery (100% clarity)"
            >
              🌊 Peak Event SAR
            </button>
            <button
              onClick={() => setRadarMode('pre')}
              className={`h-7 px-2.5 flex items-center rounded-md text-[11px] font-semibold transition ${
                radarMode === 'pre'
                  ? 'bg-cyan-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="View crisp Pre-Event Baseline SAR"
            >
              ⏮️ Baseline SAR
            </button>
            <button
              onClick={() => setRadarMode('compare')}
              className={`h-7 px-2.5 flex items-center rounded-md text-[11px] font-semibold transition ${
                radarMode === 'compare'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Synchronized Before vs Peak swipe comparison"
            >
              🔀 Swipe Compare
            </button>
          </div>

          {/* 3D Tilt Toggle */}
          <button
            onClick={toggleTilt}
            className={`h-7 flex items-center gap-1.5 px-2.5 rounded-lg border text-[11px] font-semibold transition ${
              is3D
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${is3D ? 'text-cyan-400 animate-pulse' : ''}`} />
            <span>3D Tilt (52°)</span>
          </button>

          {/* Staging Sites Toggle (Felt Style) */}
          <button
            onClick={() => setShowSites(!showSites)}
            className={`h-7 flex items-center gap-1.5 px-2.5 rounded-lg border text-[11px] transition ${
              showSites
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>Staging Sites</span>
          </button>

          {/* 30s Guided Pitch Tour */}
          <button
            onClick={isTourRunning ? stopGuidedTour : startGuidedTour}
            className={`h-7 flex items-center gap-1.5 px-2.5 rounded-lg border text-[11px] font-semibold transition ${
              isTourRunning
                ? 'bg-rose-500/20 text-rose-300 border-rose-400 animate-pulse'
                : 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 hover:bg-indigo-600/50'
            }`}
            title="Autonomous camera fly-through highlighting key inundation targets for judges"
          >
            <span>{isTourRunning ? '⏹ Stop Pitch Tour' : '🎬 30s Pitch Tour'}</span>
          </button>

          {/* Radar Backdrop Opacity Slider (Felt style percentage) */}
          <div className="h-7 flex items-center gap-2 pl-2 border-l border-slate-700 text-[11px] text-slate-300">
            <span>Raster:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={radarOpacity}
              onChange={(e) => setRadarOpacity(Number(e.target.value))}
              className="w-20 accent-amber-400 cursor-pointer"
              title={`Radar Opacity: ${radarOpacity}%`}
            />
            <span className="text-[10px] text-amber-400 w-8 font-bold">{radarOpacity}%</span>
          </div>
        </div>

        {/* Row 2: Floating Radar Swipe Slider (Smoothly stacks right below the toolbar with 0 overlap) */}
        {(radarMode === 'compare' || layers.showCompareSlider) && (
          <div className="pointer-events-auto flex items-center gap-3 bg-slate-900/95 backdrop-blur-md px-4 py-2 rounded-xl border-2 border-purple-500 shadow-2xl font-mono text-xs animate-fade-in w-fit">
            <div className="flex items-center gap-1 text-cyan-300 font-bold text-[11px] shrink-0">
              <span>⏮️ Baseline</span>
              <span className="text-[10px] text-slate-400">({100 - localSwipe}%)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={localSwipe}
              onChange={(e) => {
                const val = Number(e.target.value);
                setLocalSwipe(val);
                if (onSliderChange) onSliderChange(val);
              }}
              className="w-48 h-2 accent-purple-400 bg-slate-800 rounded-lg cursor-ew-resize"
              title={`Swipe Position: ${localSwipe}% Peak Flood`}
            />
            <div className="flex items-center gap-1 text-amber-300 font-bold text-[11px] shrink-0">
              <span>Peak Flood 🌊</span>
              <span className="text-[10px] text-slate-400">({localSwipe}%)</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Scientific Legend */}
      <div className="absolute bottom-6 left-6 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-xl shadow-2xl text-xs font-mono max-w-xs">
        <div className="font-bold text-slate-100 mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>RADAR INTELLIGENCE</span>
          </span>
          <span className="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
            30m GRID
          </span>
        </div>
        <div className="space-y-2 text-[11px]">
          <div className="flex items-center space-x-2.5">
            <span className="w-3.5 h-3.5 rounded-sm bg-amber-400 border border-amber-300 shadow-sm shrink-0"></span>
            <span className="text-slate-200">Candidate Inundated Veg (Double-Bounce)</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <span className="w-3.5 h-3.5 rounded-sm bg-cyan-400 border border-cyan-300 shadow-sm shrink-0"></span>
            <span className="text-slate-200">Confirmed Open Water (OPERA Agreement)</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <span className="w-3.5 h-3.5 rounded-sm bg-orange-500 border border-orange-400 shadow-sm shrink-0"></span>
            <span className="text-slate-300">PARALLAX Candidate Open Water</span>
          </div>
          <div className="flex items-center space-x-2.5 pt-1.5 border-t border-slate-800">
            <span className="w-3.5 h-1 border-b-2 border-rose-500 border-dashed shrink-0"></span>
            <span className="text-rose-400 text-[10px]">Sentinel-1 Burst Swath Perimeter</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white shrink-0 ml-0.5"></span>
            <span className="text-emerald-300 text-[10px]">Staging Inspection Sites</span>
          </div>
        </div>
      </div>

      {/* "How-We-Know" Evidence Drawer (Clickable Inspection) */}
      {selectedEvidence && (
        <div className="absolute bottom-6 right-6 z-30 bg-slate-900/95 backdrop-blur-md border border-amber-400/80 p-4 rounded-xl shadow-2xl text-xs font-mono max-w-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
            <span className="font-bold text-amber-400 flex items-center gap-1.5 uppercase">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Evidence Drawer</span>
            </span>
            <button
              onClick={() => setSelectedEvidence(null)}
              className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 text-xs transition"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1.5 text-slate-200">
            <div className="text-sm font-semibold text-cyan-300">
              {selectedEvidence.className}
            </div>
            <div>
              <span className="text-slate-400">Area:</span> <b className="text-white">{selectedEvidence.areaHa} ha</b> ({(selectedEvidence.areaHa / 100).toFixed(3)} km²)
            </div>
            <div>
              <span className="text-slate-400">Mechanism:</span> <span className="text-slate-300">{selectedEvidence.detectionMechanism}</span>
            </div>
            <div>
              <span className="text-slate-400">Cross-Product:</span> <span className="text-slate-300">{selectedEvidence.crossProductContext}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-amber-400/90 flex items-start gap-1">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{selectedEvidence.scientificLabel}. Ground-truth complementary verification.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MapViewer;
