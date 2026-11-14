import React, { useEffect, useRef } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CaseManifest, RegionProperties } from "./types";

interface MapViewerProps {
  manifest: CaseManifest;
  baseTilesUrl?: string; // e.g. "/data/cases/real_event_rio_grande_do_sul/"
  swipeOpacity?: number; // 0.0 (Pre-SAR) to 1.0 (Post-SAR)
  showDiffLayer?: boolean;
  showOperaLayer?: boolean;
  showGapLayer?: boolean;
  showPolygons?: boolean;
  selectedRegionId?: string | null;
  onSelectRegion?: (region: RegionProperties | null) => void;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  manifest,
  baseTilesUrl = "",
  swipeOpacity = 0.5,
  showDiffLayer = true,
  showOperaLayer = true,
  showGapLayer = true,
  showPolygons = true,
  selectedRegionId = null,
  onSelectRegion
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  // Initialize MapLibre Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "esri-dark": {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            ],
            tileSize: 256,
            attribution: "Esri, HERE, Garmin, © OpenStreetMap"
          }
        },
        layers: [
          {
            id: "esri-dark-layer",
            type: "raster",
            source: "esri-dark",
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [manifest.center[0], manifest.center[1]],
      zoom: manifest.center[2]
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    map.on("load", () => {
      // 1. Add Pre-SAR layer
      map.addSource("pre-sar", {
        type: "raster",
        tiles: [`${baseTilesUrl}tiles/pre_sar/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 11,
        maxzoom: 14
      });
      map.addLayer({
        id: "pre-sar-layer",
        type: "raster",
        source: "pre-sar",
        paint: { "raster-opacity": 1.0 }
      });

      // 2. Add Post-SAR layer
      map.addSource("post-sar", {
        type: "raster",
        tiles: [`${baseTilesUrl}tiles/post_sar/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 11,
        maxzoom: 14
      });
      map.addLayer({
        id: "post-sar-layer",
        type: "raster",
        source: "post-sar",
        paint: { "raster-opacity": swipeOpacity }
      });

      // 3. Add Signed Change (diff_db)
      map.addSource("diff-db", {
        type: "raster",
        tiles: [`${baseTilesUrl}tiles/diff_db/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 11,
        maxzoom: 14
      });
      map.addLayer({
        id: "diff-db-layer",
        type: "raster",
        source: "diff-db",
        paint: { "raster-opacity": 0.85 }
      });

      // 4. Add OPERA Water
      map.addSource("opera-water", {
        type: "raster",
        tiles: [`${baseTilesUrl}tiles/opera_water/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 11,
        maxzoom: 14
      });
      map.addLayer({
        id: "opera-water-layer",
        type: "raster",
        source: "opera-water",
        paint: { "raster-opacity": 0.75 }
      });

      // 5. Add Gap Overlay
      map.addSource("gap-overlay", {
        type: "raster",
        tiles: [`${baseTilesUrl}tiles/gap_overlay/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 11,
        maxzoom: 14
      });
      map.addLayer({
        id: "gap-overlay-layer",
        type: "raster",
        source: "gap-overlay",
        paint: { "raster-opacity": 0.9 }
      });

      // 6. Add Regions GeoJSON
      map.addSource("regions", {
        type: "geojson",
        data: `${baseTilesUrl}${manifest.regions_url}`
      });

      map.addLayer({
        id: "regions-fill",
        type: "fill",
        source: "regions",
        paint: {
          "fill-color": [
            "match",
            ["get", "candidate_type"],
            "double_bounce", "#ffb300",
            "#00e5ff"
          ],
          "fill-opacity": 0.25
        }
      });

      map.addLayer({
        id: "regions-line",
        type: "line",
        source: "regions",
        paint: {
          "line-color": [
            "match",
            ["get", "candidate_type"],
            "double_bounce", "#ffb300",
            "#00e5ff"
          ],
          "line-width": 2
        }
      });

      // Interactivity
      map.on("mouseenter", "regions-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "regions-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "regions-fill", (e) => {
        if (e.features && e.features.length > 0 && onSelectRegion) {
          const props = e.features[0].properties as RegionProperties;
          onSelectRegion(props);
        }
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, [manifest, baseTilesUrl]);

  // Handle Swipe Opacity changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (map.getLayer("post-sar-layer")) {
      map.setPaintProperty("post-sar-layer", "raster-opacity", swipeOpacity);
    }
  }, [swipeOpacity]);

  // Handle layer toggles
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (map.getLayer("diff-db-layer")) {
      map.setLayoutProperty("diff-db-layer", "visibility", showDiffLayer ? "visible" : "none");
    }
    if (map.getLayer("opera-water-layer")) {
      map.setLayoutProperty("opera-water-layer", "visibility", showOperaLayer ? "visible" : "none");
    }
    if (map.getLayer("gap-overlay-layer")) {
      map.setLayoutProperty("gap-overlay-layer", "visibility", showGapLayer ? "visible" : "none");
    }
    if (map.getLayer("regions-fill") && map.getLayer("regions-line")) {
      const vis = showPolygons ? "visible" : "none";
      map.setLayoutProperty("regions-fill", "visibility", vis);
      map.setLayoutProperty("regions-line", "visibility", vis);
    }
  }, [showDiffLayer, showOperaLayer, showGapLayer, showPolygons]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};
export default MapViewer;
