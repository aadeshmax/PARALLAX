import React, { useState, useEffect } from 'react';
import { HeaderCommandBar } from './components/HeaderCommandBar';
import { MapViewer } from './components/MapViewer';
import { LayerExplorer } from './components/LayerExplorer';
import { AnalysisInspector } from './components/AnalysisInspector';
import { AcquisitionTimeline } from './components/AcquisitionTimeline';
import { ScientificAnalytics } from './components/ScientificAnalytics';
import { ExportModal } from './components/ExportModal';
import { EvidenceModal } from './components/EvidenceModal';
import {
  fetchEarthdataStatus,
  fetchDatasets,
  fetchCases,
  runProcess
} from './api';
import {
  EarthdataStatus,
  DatasetInfo,
  CaseStudy,
  AnalysisMetrics,
  ComparisonMode,
  InspectorTab,
  TopTool,
  LayerGroupsState,
  LayerStateItem,
  TimelineObservation
} from './types';

export const App: React.FC = () => {
  // Backend & Metadata State
  const [status, setStatus] = useState<EarthdataStatus | null>(null);
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [cases, setCases] = useState<CaseStudy[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('chennai_live_case');
  const [metrics, setMetrics] = useState<AnalysisMetrics | null>(null);
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // UI Interactive States
  const [activeTool, setActiveTool] = useState<TopTool>(null);
  const [isLayerExplorerOpen, setIsLayerExplorerOpen] = useState<boolean>(true);
  const [isAnalysisInspectorOpen, setIsAnalysisInspectorOpen] = useState<boolean>(true);
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(true);
  const [selectedTimelineIndex, setSelectedTimelineIndex] = useState<number>(0);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('swipe');
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [blendMode, setBlendMode] = useState<string>('multiply');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [targetCoords, setTargetCoords] = useState<[number, number] | null>(null);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [evidenceModalSection, setEvidenceModalSection] = useState<string | null>(null);

  // Layer Groups State matching the approved design
  const [layerGroups, setLayerGroups] = useState<LayerGroupsState>({
    earthObservation: {
      satelliteBasemap: { id: 'sat_basemap', name: 'Satellite basemap', visible: true, opacity: 80 },
      preEventSar: { id: 'pre_sar', name: 'Pre-event SAR (28 Apr)', visible: true, opacity: 70 },
      postEventSar: { id: 'post_sar', name: 'Post-event SAR (02 May)', visible: true, opacity: 70 }
    },
    floodInundation: {
      operaMappedWater: { id: 'opera_water', name: 'OPERA mapped water', visible: true, opacity: 70, color: '#328CFF' },
      candidateFloodwater: { id: 'candidate_water', name: 'Candidate floodwater', visible: true, opacity: 60, color: '#FFB020' },
      permanentWater: { id: 'permanent_water', name: 'Permanent water', visible: false, opacity: 100, color: '#14B8A6' },
      sarBackscatterChanges: { id: 'sar_changes', name: 'SAR backscatter changes', visible: false, opacity: 50, color: '#A78BFA' },
      uncertaintyNoData: { id: 'uncertainty', name: 'Uncertain / No data', visible: false, opacity: 40, color: '#64748B' }
    },
    spatialContext: {
      studyAreaBoundary: { id: 'boundary', name: 'Study area boundary', visible: true, opacity: 100, color: '#E85A9E' },
      roads: { id: 'roads', name: 'Roads', visible: true, opacity: 60 },
      waterBodies: { id: 'water_bodies', name: 'Water bodies', visible: true, opacity: 80, color: '#38BDF8' },
      administrativeBoundaries: { id: 'admin_bounds', name: 'Administrative boundaries', visible: false, opacity: 40 }
    }
  });

  // Timeline Observations
  const timelineObservations: TimelineObservation[] = [
    {
      id: 'pre_event',
      label: 'Pre-event',
      timestamp: selectedCaseId === 'chennai_live_case' ? 'Nov 24, 2024 00:32 UTC' : 'Apr 25, 2025 08:42 UTC',
      sensor: 'Sentinel-1 (SAR)'
    },
    {
      id: 'event',
      label: 'Event',
      timestamp: selectedCaseId === 'chennai_live_case' ? 'Nov 30, 2024 18:00 UTC' : 'Apr 30, 2025 08:41 UTC',
      sensor: 'Sentinel-1 (SAR)'
    },
    {
      id: 'post_event',
      label: 'Post-event',
      timestamp: selectedCaseId === 'chennai_live_case' ? 'Dec 06, 2024 00:32 UTC' : 'May 02, 2025 08:37 UTC',
      sensor: 'Sentinel-1 (SAR)'
    }
  ];

  // Initial Fetch
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
          // Prefer chennai_live_case if available
          const hasChennai = cs.some((c) => c.case_id === 'chennai_live_case');
          setSelectedCaseId(hasChennai ? 'chennai_live_case' : cs[0].case_id);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }
    init();
  }, []);

  // Execute processing whenever selected case changes
  const executeAnalysis = async (caseId: string = selectedCaseId) => {
    setLoading(true);
    try {
      const res = await runProcess(caseId);
      setMetrics(res);

      if (res.layer_urls?.geojson) {
        const geoRes = await fetch(res.layer_urls.geojson);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          setGeojsonData(geoData);
        }
      }
    } catch (err) {
      console.error('Analysis execution error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCaseId) {
      executeAnalysis(selectedCaseId);
    }
  }, [selectedCaseId]);

  // Handle Layer Updates
  const handleUpdateLayer = (
    group: keyof LayerGroupsState,
    key: string,
    updates: Partial<LayerStateItem>
  ) => {
    setLayerGroups((prev) => {
      const groupObj = { ...prev[group] } as Record<string, LayerStateItem>;
      if (groupObj[key]) {
        groupObj[key] = { ...groupObj[key], ...updates };
      }
      return {
        ...prev,
        [group]: groupObj as any
      };
    });
  };

  // Synchronize Top Tools with Panels
  const handleToggleTopTool = (tool: TopTool) => {
    setActiveTool(tool);
    if (tool === 'layers') {
      setIsLayerExplorerOpen(!isLayerExplorerOpen);
    } else if (tool === 'compare') {
      setComparisonMode(comparisonMode === 'swipe' ? 'side-by-side' : 'swipe');
    }
  };

  const currentCase = cases.find((c) => c.case_id === selectedCaseId) || cases[0] || null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-midnight-bg text-midnight-primary font-sans select-none">
      {/* 1. TOP COMMAND BAR */}
      <HeaderCommandBar
        status={status}
        cases={cases}
        selectedCaseId={selectedCaseId}
        onSelectCase={setSelectedCaseId}
        activeTool={activeTool}
        onToggleTool={handleToggleTopTool}
        onRunAnalysis={() => executeAnalysis(selectedCaseId)}
        loading={loading}
        onOpenExport={() => setIsExportOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onLocationSelect={(lat, lon) => setTargetCoords([lat, lon])}
      />

      {/* 2. CENTRAL INTERACTIVE GEOSPATIAL MAP */}
      <main className="absolute inset-0 z-0">
        <MapViewer
          metrics={metrics}
          geojsonData={geojsonData}
          currentCase={currentCase}
          layers={layerGroups}
          comparisonMode={comparisonMode}
          onSelectComparisonMode={setComparisonMode}
          sliderPos={sliderPos}
          onSliderChange={setSliderPos}
          targetCoords={targetCoords}
        />
      </main>

      {/* 3. LEFT FLOATING LAYER EXPLORER */}
      <LayerExplorer
        layers={layerGroups}
        onUpdateLayer={handleUpdateLayer}
        isOpen={isLayerExplorerOpen}
        onClose={() => setIsLayerExplorerOpen(false)}
      />

      {/* 4. RIGHT FLOATING ANALYSIS INSPECTOR */}
      <AnalysisInspector
        metrics={metrics}
        currentCase={currentCase}
        isOpen={isAnalysisInspectorOpen}
        onClose={() => setIsAnalysisInspectorOpen(false)}
        activeTab={inspectorTab}
        onSelectTab={setInspectorTab}
        operaOpacity={layerGroups.floodInundation.operaMappedWater.opacity}
        candidateOpacity={layerGroups.floodInundation.candidateFloodwater.opacity}
        onUpdateOperaOpacity={(val) =>
          handleUpdateLayer('floodInundation', 'operaMappedWater', { opacity: val })
        }
        onUpdateCandidateOpacity={(val) =>
          handleUpdateLayer('floodInundation', 'candidateFloodwater', { opacity: val })
        }
        blendMode={blendMode}
        onUpdateBlendMode={setBlendMode}
        onOpenEvidenceModal={(sec) => setEvidenceModalSection(sec)}
      />

      {/* 5. SATELLITE ACQUISITION TIMELINE */}
      <AcquisitionTimeline
        observations={timelineObservations}
        selectedIndex={selectedTimelineIndex}
        onSelectIndex={setSelectedTimelineIndex}
        isOpen={isTimelineOpen}
        onToggleOpen={() => setIsTimelineOpen(!isTimelineOpen)}
      />

      {/* 6. SCIENTIFIC ANALYTICS DRAWER & REGIONAL STATS */}
      <ScientificAnalytics
        metrics={metrics}
        isOpen={true}
        onToggleOpen={() => {}}
      />

      {/* 7. EXPORT MODAL */}
      <ExportModal
        metrics={metrics}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

      {/* 8. SCIENTIFIC EVIDENCE DRILLDOWN MODAL */}
      <EvidenceModal
        sectionId={evidenceModalSection}
        metrics={metrics}
        onClose={() => setEvidenceModalSection(null)}
      />
    </div>
  );
};

export default App;
