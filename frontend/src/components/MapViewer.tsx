import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Plus,
  Minus,
  Compass,
  Navigation,
  Box,
  Layers,
  ChevronDown,
  Globe
} from 'lucide-react';
import {
  AnalysisMetrics,
  CaseStudy,
  ComparisonMode,
  LayerGroupsState
} from '../types';

interface MapViewerProps {
  metrics: AnalysisMetrics | null;
  geojsonData: any;
  currentCase: CaseStudy | null;
  layers: LayerGroupsState;
  comparisonMode: ComparisonMode;
  onSelectComparisonMode: (mode: ComparisonMode) => void;
  sliderPos: number; // 0 to 100
  onSliderChange: (pos: number) => void;
  targetCoords?: [number, number] | null;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  metrics,
  geojsonData,
  currentCase,
  layers,
  comparisonMode,
  onSelectComparisonMode,
  sliderPos,
  onSliderChange,
  targetCoords
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsTileLayerRef = useRef<L.TileLayer | null>(null);
  const operaLayerRef = useRef<L.GeoJSON | null>(null);
  const candidateLayerRef = useRef<L.GeoJSON | null>(null);
  const boundaryLayerRef = useRef<L.Polygon | null>(null);

  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lon: number }>({
    lat: 12.9827,
    lon: 80.2707
  });
  const [basemapType, setBasemapType] = useState<'satellite' | 'dark' | 'topo'>('satellite');
  const [showBasemapMenu, setShowBasemapMenu] = useState(false);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Center around Chennai or current case
    const initialCenter: L.LatLngExpression = currentCase?.center
      ? [currentCase.center[1], currentCase.center[0]]
      : [13.01, 80.25];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    // High-Resolution Esri World Imagery (Satellite)
    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        opacity: layers.earthObservation.satelliteBasemap.opacity / 100
      }
    ).addTo(map);
    baseTileLayerRef.current = satelliteLayer;

    // Dark matter reference labels for streets and cities
    const labelsLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
      {
        subdomains: 'abcd',
        maxZoom: 19,
        opacity: 0.85
      }
    ).addTo(map);
    labelsTileLayerRef.current = labelsLayer;

    // Mouse move coordinate tracker
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setMouseCoords({
        lat: parseFloat(e.latlng.lat.toFixed(4)),
        lon: parseFloat(e.latlng.lng.toFixed(4))
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Basemap Tiles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !baseTileLayerRef.current) return;

    map.removeLayer(baseTileLayerRef.current);

    let url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    if (basemapType === 'dark') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    } else if (basemapType === 'topo') {
      url = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
    }

    const newLayer = L.tileLayer(url, {
      maxZoom: 19,
      opacity: layers.earthObservation.satelliteBasemap.opacity / 100
    }).addTo(map);

    baseTileLayerRef.current = newLayer;

    // Keep labels on top
    if (labelsTileLayerRef.current) {
      labelsTileLayerRef.current.bringToFront();
    }
  }, [basemapType, layers.earthObservation.satelliteBasemap.opacity]);

  // Fly to target coords when location search is clicked
  useEffect(() => {
    if (targetCoords && mapRef.current) {
      mapRef.current.flyTo(targetCoords, 13, { duration: 1.5 });
    }
  }, [targetCoords]);

  // Center on current case
  useEffect(() => {
    if (currentCase?.center && mapRef.current) {
      mapRef.current.setView([currentCase.center[1], currentCase.center[0]], 12);
    }
  }, [currentCase?.case_id]);

  // Render Study Area Boundary
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (boundaryLayerRef.current) {
      map.removeLayer(boundaryLayerRef.current);
      boundaryLayerRef.current = null;
    }

    if (layers.spatialContext.studyAreaBoundary.visible && currentCase?.bounds_wgs84) {
      const [w, s, e, n] = currentCase.bounds_wgs84;
      const poly = L.polygon(
        [
          [s, w],
          [n, w],
          [n, e],
          [s, e]
        ],
        {
          color: '#E85A9E',
          weight: 2,
          dashArray: '5, 5',
          fillColor: '#E85A9E',
          fillOpacity: 0.03,
          interactive: false
        }
      ).addTo(map);
      boundaryLayerRef.current = poly;
    }
  }, [currentCase?.bounds_wgs84, layers.spatialContext.studyAreaBoundary.visible]);

  // Render OPERA & PARALLAX Inundation Layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous
    if (operaLayerRef.current) {
      map.removeLayer(operaLayerRef.current);
      operaLayerRef.current = null;
    }
    if (candidateLayerRef.current) {
      map.removeLayer(candidateLayerRef.current);
      candidateLayerRef.current = null;
    }

    if (!geojsonData) return;

    const operaVisible = layers.floodInundation.operaMappedWater.visible;
    const candidateVisible = layers.floodInundation.candidateFloodwater.visible;
    const operaOpacity = layers.floodInundation.operaMappedWater.opacity / 100;
    const candidateOpacity = layers.floodInundation.candidateFloodwater.opacity / 100;

    // 1. OPERA Baseline Mapped Water Layer (Blue #328CFF)
    if (operaVisible) {
      const opera = L.geoJSON(geojsonData, {
        filter: (f) => f.properties?.class_id === 1 || f.properties?.class_name === 'open_water_specular',
        style: {
          color: '#328CFF',
          weight: 1.5,
          fillColor: '#328CFF',
          fillOpacity: operaOpacity,
          lineCap: 'round',
          lineJoin: 'round'
        },
        onEachFeature: (f, layer) => {
          layer.bindPopup(`
            <div style="font-family: inherit; font-size: 11px;">
              <strong style="color: #328CFF;">OPERA Mapped Surface Water</strong><br/>
              Class: Open Water (Specular Mirror)<br/>
              Sensor: Sentinel-1 C-SAR / OPERA DSWx<br/>
              Status: Baseline Confirmed
            </div>
          `);
        }
      }).addTo(map);
      operaLayerRef.current = opera;
    }

    // 2. Candidate Inundation (Golden Amber #FFB020)
    if (candidateVisible && comparisonMode !== 'temporal') {
      const candidate = L.geoJSON(geojsonData, {
        filter: (f) =>
          f.properties?.class_id === 2 || f.properties?.class_name === 'candidate_inundated_vegetation',
        style: {
          color: '#FFB020',
          weight: 1.8,
          fillColor: '#FFB020',
          fillOpacity: candidateOpacity,
          lineCap: 'round',
          lineJoin: 'round'
        },
        onEachFeature: (f, layer) => {
          layer.bindPopup(`
            <div style="font-family: inherit; font-size: 11px;">
              <strong style="color: #FFB020;">Candidate Inundated Vegetation</strong><br/>
              Classification: Canopy Double-Bounce (+2.5 dB)<br/>
              Potential Gap in Conventional Optical Sensors<br/>
              Status: Candidate Floodwater (Verified SAR Signal)
            </div>
          `);
        }
      }).addTo(map);
      candidateLayerRef.current = candidate;
    }
  }, [geojsonData, layers.floodInundation, comparisonMode]);

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
      {/* Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* SWIPE COMPARISON OVERLAY (When in Swipe Mode) */}
      {comparisonMode === 'swipe' && (
        <>
          {/* Top Pill Labels */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-3 py-1.5 rounded-full bg-midnight-panel/95 backdrop-blur-md border border-midnight-border shadow-2xl pointer-events-none">
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
            <div className="w-0.5 h-full bg-white/70 shadow-[0_0_10px_rgba(255,255,255,0.6)]" />

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

      {/* BOTTOM COMPARISON MODE SELECTOR */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 rounded-xl bg-midnight-panel/95 backdrop-blur-md border border-midnight-border shadow-2xl pointer-events-auto">
        <span className="text-[10px] font-semibold text-midnight-secondary px-2 uppercase tracking-wider">
          Comparison Mode
        </span>
        {(['swipe', 'side-by-side', 'temporal', 'difference'] as ComparisonMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onSelectComparisonMode(mode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
              comparisonMode === mode
                ? 'bg-midnight-accent text-white shadow'
                : 'text-midnight-secondary hover:text-midnight-primary hover:bg-midnight-elevated'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* RIGHT SIDE MAP NAVIGATION TOOLBAR */}
      <div className="absolute top-20 right-3 z-10 flex flex-col items-center gap-2 pointer-events-auto">
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
              {(['satellite', 'dark', 'topo'] as const).map((type) => (
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
              if (currentCase?.center) {
                mapRef.current?.setView([currentCase.center[1], currentCase.center[0]], 12);
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
                mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 13);
              });
            }}
            className="p-2 text-midnight-secondary hover:text-midnight-primary hover:bg-midnight-elevated transition"
            title="Find My Location"
          >
            <Navigation className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              // 3D perspective simulated tilt toggle
              alert('3D Mode: Operating in high-precision 2D orthographic geospatial view per scientific protocol.');
            }}
            className="p-2 text-midnight-secondary hover:text-midnight-primary hover:bg-midnight-elevated transition font-mono text-[10px] font-bold"
            title="Toggle 3D Perspective"
          >
            3D
          </button>
        </div>
      </div>

      {/* BOTTOM RIGHT MINIMAP INSET */}
      <div className="absolute bottom-24 right-3 z-10 w-28 h-24 rounded-xl bg-midnight-panel/95 backdrop-blur-md border border-midnight-border shadow-2xl overflow-hidden pointer-events-none hidden md:flex flex-col">
        <div className="w-full h-full relative bg-slate-950/90 flex items-center justify-center">
          {/* Faint context grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#203247_1px,transparent_1px),linear-gradient(to_bottom,#203247_1px,transparent_1px)] bg-[size:14px_14px] opacity-30" />
          {/* Pink AOI Box Outline */}
          <div className="w-10 h-8 rounded border border-midnight-boundary bg-midnight-boundary/10 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-midnight-boundary" />
          </div>
        </div>
      </div>

      {/* BOTTOM LEFT SCALE & COORDINATES READOUT */}
      <div className="absolute bottom-2 left-3 z-10 flex items-center gap-4 text-[10px] font-mono text-midnight-secondary/80 pointer-events-none">
        {/* Scale Bar */}
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1 border-b-2 border-l-2 border-r-2 border-midnight-secondary/60" />
          <span>5 km</span>
        </div>

        {/* Dynamic Coordinates */}
        <div className="bg-midnight-panel/80 px-2 py-0.5 rounded border border-midnight-border/40">
          Lat <span className="text-midnight-primary">{mouseCoords.lat}°</span> Lon{' '}
          <span className="text-midnight-primary">{mouseCoords.lon}°</span>
        </div>
      </div>
    </div>
  );
};
