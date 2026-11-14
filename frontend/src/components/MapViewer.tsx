import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { AnalysisMetrics } from '../types';

interface MapViewerProps {
  metrics: AnalysisMetrics | null;
  geojsonData: any;
  layers: {
    showOperaWater: boolean;
    showInundatedVeg: boolean;
    showOpenWater: boolean;
    showCrossSensorGap: boolean;
    showCompareSlider: boolean;
  };
  sliderPos: number;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  metrics,
  geojsonData,
  layers,
  sliderPos
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const bboxLayerRef = useRef<L.Rectangle | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter: L.LatLngExpression = [49.042, -4.624];
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 10,
      zoomControl: false,
    });

    // ESRI Dark Gray Canvas Basemap (Free, no API key watermark)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, HERE, Garmin, OpenStreetMap contributors',
      maxZoom: 16,
    }).addTo(map);

    // Cartographic place names, cities, and boundaries overlay
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      attribution: '',
      maxZoom: 16,
      opacity: 0.85
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update GeoJSON overlays & Bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove previous GeoJSON layer
    if (geojsonLayerRef.current) {
      map.removeLayer(geojsonLayerRef.current);
      geojsonLayerRef.current = null;
    }

    if (bboxLayerRef.current) {
      map.removeLayer(bboxLayerRef.current);
      bboxLayerRef.current = null;
    }

    // Add AOI Bounding Box
    if (metrics?.provenance) {
      const bounds: L.LatLngBoundsExpression = [
        [48.839, -5.263],
        [49.246, -3.985]
      ];
      const rect = L.rectangle(bounds, {
        color: '#38bdf8',
        weight: 1.5,
        dashArray: '4, 4',
        fill: false
      }).addTo(map);
      bboxLayerRef.current = rect;
    }

    // Add Candidate Polygons
    if (geojsonData) {
      const layer = L.geoJSON(geojsonData, {
        filter: (feature) => {
          const classId = feature.properties?.class_id;
          if (classId === 1 && !layers.showOpenWater) return false;
          if (classId === 2 && !layers.showInundatedVeg) return false;
          return true;
        },
        style: (feature) => {
          const classId = feature?.properties?.class_id;
          if (classId === 2) {
            // Inundated Vegetation Double-Bounce
            return {
              color: '#10b981',
              weight: 1.5,
              fillColor: '#10b981',
              fillOpacity: 0.55
            };
          }
          // Open water specular
          return {
            color: '#3b82f6',
            weight: 1.5,
            fillColor: '#2563eb',
            fillOpacity: 0.65
          };
        },
        onEachFeature: (feature, l) => {
          const p = feature.properties;
          const content = `
            <div style="font-family: monospace; font-size: 11px; padding: 4px;">
              <div style="color: ${p.class_id === 2 ? '#10b981' : '#38bdf8'}; font-weight: bold; margin-bottom: 4px;">
                ${p.class_name}
              </div>
              <div><b>Area:</b> ${p.area_ha} hectares</div>
              <div><b>Confidence:</b> ${p.confidence_tier}</div>
              <div><b>Mechanism:</b> ${p.detection_mechanism}</div>
              <div style="color: #f59e0b; margin-top: 6px; font-size: 9px; border-top: 1px solid #334155; padding-top: 4px;">
                ⚠️ ${p.scientific_label}
              </div>
            </div>
          `;
          l.bindPopup(content);
        }
      }).addTo(map);

      geojsonLayerRef.current = layer;

      // Fit map to layer bounds
      if (layer.getBounds().isValid()) {
        map.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 12 });
      }
    }
  }, [geojsonData, layers.showOpenWater, layers.showInundatedVeg, metrics]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Synchronized Swipe Slider Indicator Overlay */}
      {layers.showCompareSlider && (
        <div 
          className="absolute top-0 bottom-0 pointer-events-none z-10 border-r-2 border-amber-400 shadow-2xl flex flex-col justify-center items-center"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg font-mono">
            SWIPE: {sliderPos}%
          </div>
          <div className="absolute top-4 -left-36 bg-slate-900/90 text-cyan-300 border border-slate-700 px-2 py-1 rounded text-[10px] font-mono">
            ◄ Pre-Event (Jan 10)
          </div>
          <div className="absolute top-4 left-4 bg-slate-900/90 text-emerald-300 border border-slate-700 px-2 py-1 rounded text-[10px] font-mono">
            Post-Event (Jan 22) ►
          </div>
        </div>
      )}

      {/* Floating Scientific Map Legend */}
      <div className="absolute bottom-6 left-6 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-lg shadow-xl text-xs font-mono max-w-xs">
        <div className="font-semibold text-slate-200 mb-2 flex items-center justify-between border-b border-slate-800 pb-1">
          <span>CLASSIFICATION OVERLAY</span>
          <span className="text-[10px] text-cyan-400">30m GRID</span>
        </div>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded bg-emerald-500 border border-emerald-400 shadow-sm shrink-0"></span>
            <span className="text-slate-300">Candidate Inundated Veg (Double-Bounce)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded bg-blue-600 border border-blue-400 shadow-sm shrink-0"></span>
            <span className="text-slate-300">Open Water (Specular Darkening)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded bg-cyan-400 border border-cyan-300 shadow-sm shrink-0"></span>
            <span className="text-slate-300">NASA OPERA DSWx Observation</span>
          </div>
          <div className="flex items-center space-x-2 pt-1 border-t border-slate-800/80">
            <span className="w-3 h-0 border-t border-dashed border-cyan-400 shrink-0"></span>
            <span className="text-slate-400 text-[10px]">Sentinel-1 Burst AOI Footprint</span>
          </div>
        </div>
      </div>
    </div>
  );
};
