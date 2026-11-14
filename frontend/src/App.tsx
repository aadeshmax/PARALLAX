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
  const [selectedCaseId, setSelectedCaseId] = useState<string>('demo_flood_case');
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
          setSelectedCaseId(cs[0].case_id);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }
    init();
  }, []);

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

  return (
    <div className="flex flex-col h-screen w-screen bg-radar-bg text-slate-100 overflow-hidden font-sans">
      {/* 1. Header */}
      <Header
        status={status}
        onOpenCitations={() => setIsCitationOpen(true)}
        onRunAnalysis={() => executeAnalysis(selectedCaseId)}
        loading={loading}
      />

      {/* 2. Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Control Sidebar */}
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

        {/* Central Map Viewer */}
        <main className="flex-1 relative h-full">
          <MapViewer
            metrics={metrics}
            geojsonData={geojsonData}
            layers={layers}
            sliderPos={sliderPos}
          />

          {/* Floating Slider Control when Compare Mode is enabled */}
          {layers.showCompareSlider && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-700 shadow-xl flex items-center space-x-3 text-xs font-mono">
              <span className="text-cyan-400">Pre-Flood SAR</span>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderPos}
                onChange={(e) => setSliderPos(Number(e.target.value))}
                className="w-48 accent-amber-400 cursor-ew-resize"
              />
              <span className="text-emerald-400">Post-Flood SAR</span>
            </div>
          )}
        </main>

        {/* Right Scientific Metrics Panel */}
        <MetricsPanel metrics={metrics} />
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
