import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AnalysisMetrics, CaseStudy } from '../types';
import { Layers, Compass, Eye, ShieldAlert, Sparkles, MapPin, Sliders } from 'lucide-react';

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

  const [basemap, setBasemap] = useState<'satellite' | 'dark'>('satellite');
  const [is3D, setIs3D] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [radarOpacity, setRadarOpacity] = useState<number>(45);
  const [localSwipe, setLocalSwipe] = useState<number>(sliderPos);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceInfo | null>(null);

  // Sync external sliderPos
  useEffect(() => {
    setLocalSwipe(sliderPos);
  }, [sliderPos]);

  // Determine initial coordinates based on case
  const getCaseCenterAndZoom = (): { center: [number, number]; zoom: number } => {
    if (caseId === 'real_event_rio_grande_do_sul') {
      return { center: [-51.3676, -29.8705], zoom: 12 };
    }
    if (caseId === 'mumbai_monsoon_event') {
      return { center: [72.9038, 19.1206], zoom: 12 };
    }
    if (caseId === 'chennai_live_case') {
      return { center: [80.12, 13.08], zoom: 12 };
    }
    if (currentCase && currentCase.center) {
      const c = currentCase.center;
      return { center: [c[0], c[1]], zoom: 11 };
    }
    return { center: [-51.3676, -29.8705], zoom: 12 };
  };

  // 1. Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const { center, zoom } = getCaseCenterAndZoom();

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
      mapRef.current = map;
      loadCaseData(map, caseId);
    });

    // Handle container resizing
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Load / Update Case Tiles & GeoJSON
  const loadCaseData = async (map: maplibregl.Map, activeCaseId: string) => {
    // Clean existing case sources and layers
    const layerIds = [
      'pre-sar-layer',
      'post-sar-layer',
      'diff-db-layer',
      'opera-water-layer',
      'gap-overlay-layer',
      'candidates-fill',
      'candidates-line'
    ];
    layerIds.forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });

    const sourceIds = [
      'pre-sar',
      'post-sar',
      'diff-db',
      'opera-water',
      'gap-overlay',
      'candidates-geojson'
    ];
    sourceIds.forEach(id => {
      if (map.getSource(id)) map.removeSource(id);
    });

    // A. Add Raster Tile Layers from /data/cases/{caseId}/tiles/
    const baseUrl = `/data/cases/${activeCaseId}/tiles`;

    try {
      // 1. Pre-SAR
      map.addSource('pre-sar', {
        type: 'raster',
        tiles: [`${baseUrl}/pre_sar/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 11,
        maxzoom: 14
      });
      map.addLayer({
        id: 'pre-sar-layer',
        type: 'raster',
        source: 'pre-sar',
        paint: {
          'raster-opacity': (radarOpacity / 100) * (1 - localSwipe / 100)
        }
      });

      // 2. Post-SAR
      map.addSource('post-sar', {
        type: 'raster',
        tiles: [`${baseUrl}/post_sar/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 11,
        maxzoom: 14
      });
      map.addLayer({
        id: 'post-sar-layer',
        type: 'raster',
        source: 'post-sar',
        paint: {
          'raster-opacity': (radarOpacity / 100) * (localSwipe / 100)
        }
      });

      // 3. Diff dB
      map.addSource('diff-db', {
        type: 'raster',
        tiles: [`${baseUrl}/diff_db/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 11,
        maxzoom: 14
      });
      map.addLayer({
        id: 'diff-db-layer',
        type: 'raster',
        source: 'diff-db',
        layout: { visibility: layers.showCompareSlider ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.75 }
      });

      // 4. OPERA Water
      map.addSource('opera-water', {
        type: 'raster',
        tiles: [`${baseUrl}/opera_water/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 11,
        maxzoom: 14
      });
      map.addLayer({
        id: 'opera-water-layer',
        type: 'raster',
        source: 'opera-water',
        layout: { visibility: layers.showOperaWater ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.85 }
      });

      // 5. Gap Overlay
      map.addSource('gap-overlay', {
        type: 'raster',
        tiles: [`${baseUrl}/gap_overlay/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 11,
        maxzoom: 14
      });
      map.addLayer({
        id: 'gap-overlay-layer',
        type: 'raster',
        source: 'gap-overlay',
        layout: { visibility: layers.showCrossSensorGap ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.90 }
      });
    } catch (e) {
      console.warn("Tile layer ingestion notice:", e);
    }

    // B. Ingest Candidate Vector Polygons (GeoJSON)
    let geojsonToUse = geojsonData;
    if (!geojsonToUse) {
      try {
        const directRes = await fetch(`/data/cases/${activeCaseId}/regions.geojson`);
        if (directRes.ok) {
          geojsonToUse = await directRes.json();
        }
      } catch (e) {
        console.warn("Direct regions.geojson load notice:", e);
      }
    }

    if (geojsonToUse && geojsonToUse.features && geojsonToUse.features.length > 0) {
      map.addSource('candidates-geojson', {
        type: 'geojson',
        data: geojsonToUse
      });

      map.addLayer({
        id: 'candidates-fill',
        type: 'fill',
        source: 'candidates-geojson',
        paint: {
          'fill-color': [
            'match',
            ['get', 'class_id'],
            2, '#fbbf24', // Amber for Inundated Veg / Canopy Gap
            1, '#06b6d4', // Cyan for Confirmed Open Water
            4, '#f97316', // Orange for Candidate Open Water
            '#a855f7'
          ],
          'fill-opacity': 0.55
        }
      });

      map.addLayer({
        id: 'candidates-line',
        type: 'line',
        source: 'candidates-geojson',
        paint: {
          'line-color': [
            'match',
            ['get', 'class_id'],
            2, '#fde68a',
            1, '#67e8f9',
            '#ffffff'
          ],
          'line-width': 1.5,
          'line-opacity': 0.9
        }
      });

      // Interactive Click on Polygons
      map.on('click', 'candidates-fill', (e) => {
        if (!e.features || !e.features[0]) return;
        const p = e.features[0].properties as any;
        setSelectedEvidence({
          className: p.class_name || (p.class_id === 2 ? 'Inundated Veg (Double-Bounce)' : 'Confirmed Open Water'),
          classId: Number(p.class_id) || 1,
          areaHa: Number(p.area_ha) || 0.45,
          detectionMechanism: p.detection_mechanism || 'Radar backscatter dihedral dihedral reflection',
          crossProductContext: p.cross_product_context || 'Complementary radar sensitivity under canopy',
          evidenceTier: p.evidence_tier || 'High backscatter signature',
          scientificLabel: p.scientific_label || 'Candidate Inundation (Unverified ground-truth)'
        });
      });

      map.on('mouseenter', 'candidates-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'candidates-fill', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // Ensure labels stay above rasters
    if (map.getLayer('basemap-labels')) {
      map.moveLayer('basemap-labels');
    }
  };

  // 3. React to Case Switch
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const { center, zoom } = getCaseCenterAndZoom();
    map.flyTo({
      center: center,
      zoom: zoom,
      pitch: is3D ? 52 : 0,
      bearing: is3D ? -15 : 0,
      essential: true
    });

    loadCaseData(map, caseId);
  }, [caseId, geojsonData]);

  // 4. Update Layer Visibilities
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
  }, [layers]);

  // 5. Update Opacities & Swipe
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const baseOp = radarOpacity / 100;
    const swipeRatio = localSwipe / 100;

    if (map.getLayer('pre-sar-layer')) {
      map.setPaintProperty('pre-sar-layer', 'raster-opacity', baseOp * (1 - swipeRatio));
    }
    if (map.getLayer('post-sar-layer')) {
      map.setPaintProperty('post-sar-layer', 'raster-opacity', baseOp * swipeRatio);
    }
  }, [radarOpacity, localSwipe]);

  // 6. Basemap & Tilt Toggles
  const handleBasemapChange = (type: 'satellite' | 'dark') => {
    const map = mapRef.current;
    if (!map) return;
    setBasemap(type);
    map.setLayoutProperty('basemap-satellite', 'visibility', type === 'satellite' ? 'visible' : 'none');
    map.setLayoutProperty('basemap-dark', 'visibility', type === 'dark' ? 'visible' : 'none');
  };

  const toggleTilt = () => {
    const map = mapRef.current;
    if (!map) return;
    const new3D = !is3D;
    setIs3D(new3D);
    map.easeTo({
      pitch: new3D ? 52 : 0,
      bearing: new3D ? -15 : 0,
      duration: 1000
    });
  };

  const toggleLabels = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !showLabels;
    setShowLabels(next);
    map.setLayoutProperty('basemap-labels', 'visibility', next ? 'visible' : 'none');
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#080d1a]">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating On-Map Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/80 shadow-2xl font-mono text-xs">
        {/* Basemap Perspective Buttons */}
        <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
          <button
            onClick={() => handleBasemapChange('satellite')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
              basemap === 'satellite'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            🛰️ Satellite Ortho
          </button>
          <button
            onClick={() => handleBasemapChange('dark')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
              basemap === 'dark'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            🗺️ Dark Canvas
          </button>
        </div>

        {/* 3D Tilt Toggle */}
        <button
          onClick={toggleTilt}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
            is3D
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
          }`}
        >
          <Compass className={`w-3.5 h-3.5 ${is3D ? 'text-cyan-400 animate-pulse' : ''}`} />
          <span>3D Tilt (52°)</span>
        </button>

        {/* Place Names & Labels Toggle */}
        <button
          onClick={toggleLabels}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition ${
            showLabels
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span>City / River Labels</span>
        </button>

        {/* Radar Backdrop Opacity Slider */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-700 text-[11px] text-slate-300">
          <span>Radar:</span>
          <input
            type="range"
            min="0"
            max="100"
            value={radarOpacity}
            onChange={(e) => setRadarOpacity(Number(e.target.value))}
            className="w-20 accent-cyan-400 cursor-pointer"
            title={`Radar Opacity: ${radarOpacity}%`}
          />
          <span className="text-[10px] text-cyan-400 w-7">{radarOpacity}%</span>
        </div>
      </div>

      {/* Floating Radar Swipe Slider (Pre vs Post SAR) */}
      <div className="absolute top-16 left-4 z-20 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-2xl font-mono text-xs">
        <span className="text-cyan-400 text-[11px] font-semibold">Pre-Event Baseline</span>
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
          className="w-44 accent-amber-400 cursor-ew-resize"
        />
        <span className="text-amber-400 text-[11px] font-semibold">Peak Flood Event</span>
      </div>

      {/* Floating Scientific Legend */}
      <div className="absolute bottom-6 left-6 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-xl shadow-2xl text-xs font-mono max-w-xs">
        <div className="font-bold text-slate-100 mb-2.5 flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>RADAR INTELLIGENCE</span>
          </span>
          <span className="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/30">
            30m GRID
          </span>
        </div>
        <div className="space-y-2 text-[11px]">
          <div className="flex items-center space-x-2.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-300 shadow-sm shrink-0"></span>
            <span className="text-slate-200">Candidate Inundated Veg (Double-Bounce)</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <span className="w-3.5 h-3.5 rounded bg-cyan-400 border border-cyan-300 shadow-sm shrink-0"></span>
            <span className="text-slate-200">Confirmed Open Water (OPERA Agreement)</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <span className="w-3.5 h-3.5 rounded bg-orange-500 border border-orange-400 shadow-sm shrink-0"></span>
            <span className="text-slate-300">PARALLAX Candidate Open Water</span>
          </div>
          <div className="flex items-center space-x-2 pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
            <span>💡 Click any polygon to inspect radar evidence</span>
          </div>
        </div>
      </div>

      {/* "How-We-Know" Evidence Drawer (Clickable Inspection) */}
      {selectedEvidence && (
        <div className="absolute bottom-6 right-6 z-30 bg-slate-900/95 backdrop-blur-md border-2 border-amber-400/80 p-4 rounded-xl shadow-2xl text-xs font-mono max-w-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
            <span className="font-bold text-amber-400 flex items-center gap-1.5 uppercase">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Evidence Drawer</span>
            </span>
            <button
              onClick={() => setSelectedEvidence(null)}
              className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800"
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
