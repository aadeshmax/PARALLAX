import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MapViewer } from './components/MapViewer';
import { MetricsPanel } from './components/MetricsPanel';
import { CitationModal } from './components/CitationModal';
import {
  fetchEarthdataStatus,
  fetchDatasets,
  fetchCases,
  runProcess
} from './api';
import { EarthdataStatus, DatasetInfo, CaseStudy, AnalysisMetrics, GranuleMetadata } from './types';

export const App: React.FC = () => {
  const [status, setStatus] = useState<EarthdataStatus | null>(null);
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [cases, setCases] = useState<CaseStudy[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('real_event_rio_grande_do_sul');
  const [metrics, setMetrics] = useState<AnalysisMetrics | null>(null);
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isCitationOpen, setIsCitationOpen] = useState<boolean>(false);
  const [sliderPos, setSliderPos] = useState<number>(50);

  const [layers, setLayers] = useState({
    showOperaWater: true,
    showInundatedVeg: true,
    showOpenWater: true,
    showCrossSensorGap: true,
    showCompareSlider: false
  });

  const [thresholds, setThresholds] = useState({
    darkening: -3.0,
    brightening: 2.5
  });

  // Initial Data Fetch
  useEffect(() => {
    async function init() {
      try {
        const [st, ds, cs] = await Promise.all([
          fetchEarthdataStatus().catch(() => null),
          fetchDatasets().catch(() => []),
          fetchCases().catch(() => [])
        ]);
        if (st) setStatus(st);
        if (ds) setDatasets(ds);
        if (cs && cs.length > 0) {
          setCases(cs);
          const initial = cs.find(c => c.case_id === 'real_event_rio_grande_do_sul') || cs[0];
          setSelectedCaseId(initial.case_id);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }
    init();
  }, []);

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isMetricsOpen, setIsMetricsOpen] = useState<boolean>(true);

  // Execute processing whenever selected case or threshold changes
  const executeAnalysis = async (caseId: string = selectedCaseId) => {
    setLoading(true);
    try {
      const res = await runProcess(caseId);
      setMetrics(res);

      // Fetch the generated GeoJSON
      if (res.layer_urls?.geojson) {
        const geoRes = await fetch(res.layer_urls.geojson);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          setGeojsonData(geoData);
        }
      }
    } catch (err) {
      console.error("Analysis execution error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeAnalysis(selectedCaseId);
  }, [selectedCaseId]);

  const handleToggleLayer = (key: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Section 06 / 08 Reproducible Scientific Case Export
  const handleExportCase = () => {
    const curCase = cases.find(c => c.case_id === selectedCaseId);
    const exportPackage = {
      project: "PARALLAX / TERRA//PULSE",
      challenge: "NASA Space Apps Challenge 2024",
      specification: "Section 06 / 08 Scientific Deliverables Contract",
      export_timestamp_utc: new Date().toISOString(),
      case_study: {
        id: selectedCaseId,
        title: curCase?.title || curCase?.event_name || selectedCaseId,
        location: curCase?.location || "Flood Study Basin",
        coordinate_reference_system: curCase?.analysis_crs || "UTM Projection",
        center_lon_lat: curCase?.center || [-51.3676, -29.8705],
        bounding_box_wgs84: curCase?.aoi_bbox || null
      },
      threshold_configuration: {
        specular_darkening_db: thresholds.darkening,
        canopy_brightening_db: thresholds.brightening,
        basis: "Dihedral double-bounce vs specular backscatter attenuation"
      },
      scientific_metrics: metrics,
      reproducibility: {
        methodology: "Dual-polarization Sentinel-1 L2 RTC-S1 backscatter change detection vs NASA OPERA L3 DSWx-S1",
        primary_repository: "https://github.com/aadeshmax/TERRA-PULSE",
        license: "MIT / Open Scientific Research"
      },
      features: geojsonData
    };

    const blob = new Blob([JSON.stringify(exportPackage, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PARALLAX_${selectedCaseId}_Scientific_Export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-radar-bg text-slate-100 overflow-hidden font-sans">
      {/* 1. Header */}
      <Header
        status={status}
        onOpenCitations={() => setIsCitationOpen(true)}
        onRunAnalysis={() => executeAnalysis(selectedCaseId)}
        onExportCase={handleExportCase}
        loading={loading}
      />

      {/* 2. Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Control Sidebar */}
        {isSidebarOpen && (
          <Sidebar
            cases={cases}
            selectedCaseId={selectedCaseId}
            onSelectCase={(id) => setSelectedCaseId(id)}
            granules={[]}
            layers={layers}
            onToggleLayer={handleToggleLayer}
            thresholds={thresholds}
            onChangeThresholds={setThresholds}
          />
        )}

        {/* Central Map Viewer */}
        <main className="flex-1 relative h-full min-w-0 overflow-hidden">
          {/* Left Sidebar Collapse Handle */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute top-1/2 -translate-y-1/2 left-0 z-30 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-y border-r border-slate-700 px-1 py-3 rounded-r-md text-[10px] font-mono shadow-xl transition"
            title={isSidebarOpen ? "Collapse Left Panel (Fullscreen Map)" : "Expand Left Panel"}
          >
            {isSidebarOpen ? '◀' : '▶'}
          </button>

          {/* Right Metrics Panel Collapse Handle */}
          <button
            onClick={() => setIsMetricsOpen(!isMetricsOpen)}
            className="absolute top-1/2 -translate-y-1/2 right-0 z-30 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-y border-l border-slate-700 px-1 py-3 rounded-l-md text-[10px] font-mono shadow-xl transition"
            title={isMetricsOpen ? "Collapse Right Panel (Fullscreen Map)" : "Expand Right Panel"}
          >
            {isMetricsOpen ? '▶' : '◀'}
          </button>

          <MapViewer
            metrics={metrics}
            geojsonData={geojsonData}
            caseId={selectedCaseId}
            currentCase={cases.find(c => c.case_id === selectedCaseId)}
            layers={layers}
            sliderPos={sliderPos}
            onSliderChange={(val) => setSliderPos(val)}
          />
        </main>

        {/* Right Scientific Metrics Panel */}
        {isMetricsOpen && <MetricsPanel metrics={metrics} />}
      </div>

      {/* Citations & Metadata Modal */}
      <CitationModal
        isOpen={isCitationOpen}
        onClose={() => setIsCitationOpen(false)}
        datasets={datasets}
      />
    </div>
  );
};
export default App;
