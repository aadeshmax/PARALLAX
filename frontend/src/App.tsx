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
  TimelineObservation,
  VisualizationMode
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
  const [renderMode, setRenderMode] = useState<VisualizationMode>('radar');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [targetCoords, setTargetCoords] = useState<[number, number] | null>(null);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [evidenceModalSection, setEvidenceModalSection] = useState<string | null>(null);

  // Layer Groups State matching the approved design
  const [layerGroups, setLayerGroups] = useState<LayerGroupsState>({
    earthObservation: {
      satelliteBasemap: { id: 'sat_basemap', name: 'Satellite basemap', visible: true, opacity: 85 },
      preEventSar: { id: 'pre_sar', name: 'Pre-event SAR (24 Nov)', visible: true, opacity: 80 },
      postEventSar: { id: 'post_sar', name: 'During-event SAR (06 Dec)', visible: true, opacity: 80 }
    },
    floodInundation: {
      operaMappedWater: { id: 'opera_water', name: 'OPERA mapped water', visible: true, opacity: 75, color: '#328CFF' },
      candidateFloodwater: { id: 'candidate_water', name: 'Candidate floodwater', visible: true, opacity: 75, color: '#FFB020' },
      permanentWater: { id: 'permanent_water', name: 'Permanent water', visible: false, opacity: 100, color: '#14B8A6' },
      sarBackscatterChanges: { id: 'sar_changes', name: 'SAR backscatter changes (ΔdB)', visible: false, opacity: 70, color: '#A78BFA' },
      uncertaintyNoData: { id: 'uncertainty', name: 'Uncertain / No data', visible: false, opacity: 40, color: '#64748B' }
    },
    spatialContext: {
      studyAreaBoundary: { id: 'boundary', name: 'Study area boundary', visible: true, opacity: 100, color: '#E85A9E' },
      roads: { id: 'roads', name: 'Roads & Place Labels', visible: true, opacity: 85 },
      waterBodies: { id: 'water_bodies', name: 'Water bodies', visible: true, opacity: 80, color: '#38BDF8' },
      administrativeBoundaries: { id: 'admin_bounds', name: 'Administrative boundaries', visible: false, opacity: 40 }
    }
  });

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
      const isNisar = selectedCaseId === 'mumbai_nisar_2026';
      setLayerGroups((prev) => ({
        ...prev,
        earthObservation: {
          ...prev.earthObservation,
          preEventSar: {
            ...prev.earthObservation.preEventSar,
            name: isNisar ? 'Observation A (22 Jun 2026)' : 'Pre-event SAR (24 Nov)'
          },
          postEventSar: {
            ...prev.earthObservation.postEventSar,
            name: isNisar ? 'Observation B (04 Jul 2026)' : 'During-event SAR (06 Dec)'
          }
        },
        floodInundation: {
          ...prev.floodInundation,
          operaMappedWater: {
            ...prev.floodInundation.operaMappedWater,
            name: isNisar ? 'Backscatter Attenuation Zones (≤ -3 dB)' : 'OPERA mapped water'
          },
          candidateFloodwater: {
            ...prev.floodInundation.candidateFloodwater,
            name: isNisar ? 'Backscatter Enhancement Zones (≥ +2.5 dB)' : 'Candidate floodwater'
          }
        }
      }));
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

  // Compute dynamic center tile URL for timeline thumbnails
  const getCenterTile = (layer: string) => {
    if (!currentCase?.center || currentCase.center.length < 2) {
      return `/data/cases/${selectedCaseId}/tiles/${layer}/12/2959/1895.png`;
    }
    const [lon, lat] = currentCase.center;
    const z = 12;
    const n = 1 << z;
    const x = Math.floor(((lon + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
    return `/data/cases/${selectedCaseId}/tiles/${layer}/${z}/${x}/${y}.png`;
  };

  // Real Timeline Observations from case manifest scenes
  const scenes = currentCase?.scenes || [];
  const isNisar = selectedCaseId === 'mumbai_nisar_2026' || Boolean(currentCase?.sensor?.platform?.includes('NISAR'));
  const timelineObservations: TimelineObservation[] = [
    {
      id: 'pre_event',
      label: isNisar ? 'Observation A' : 'Pre-event',
      timestamp: scenes[0]?.acquisition_timestamp
        ? new Date(scenes[0].acquisition_timestamp).toUTCString().replace('GMT', 'UTC')
        : selectedCaseId === 'chennai_live_case'
          ? 'Nov 24, 2024 00:32 UTC'
          : isNisar
            ? 'Jun 22, 2026 00:34 UTC'
            : 'Apr 26, 2024 22:07 UTC',
      sensor: isNisar ? `NISAR (${scenes[0]?.polarization || 'HH'})` : (scenes[0]?.polarization ? `Sentinel-1 (${scenes[0].polarization})` : 'Sentinel-1 (SAR)'),
      thumbnailUrl: getCenterTile('pre_sar')
    },
    {
      id: 'event',
      label: isNisar ? 'Observation B' : 'During-Event',
      timestamp: scenes[1]?.acquisition_timestamp
        ? new Date(scenes[1].acquisition_timestamp).toUTCString().replace('GMT', 'UTC')
        : selectedCaseId === 'chennai_live_case'
          ? 'Dec 06, 2024 00:32 UTC'
          : isNisar
            ? 'Jul 04, 2026 00:34 UTC'
            : 'May 08, 2024 22:07 UTC',
      sensor: isNisar ? `NISAR (${scenes[1]?.polarization || 'HH'})` : (scenes[1]?.polarization ? `Sentinel-1 (${scenes[1].polarization})` : 'Sentinel-1 (SAR)'),
      thumbnailUrl: getCenterTile('post_sar')
    },
    {
      id: 'gap_overlay',
      label: isNisar ? 'Radar Change (ΔHH)' : 'Detection Gap',
      timestamp: isNisar ? '12-day NISAR Temporal Difference' : (currentCase?.reference_product?.product_name || 'OPERA DSWx vs SAR Gap'),
      sensor: isNisar ? 'NISAR L-band Analysis' : 'PARALLAX Analysis',
      thumbnailUrl: getCenterTile(isNisar ? 'diff_db' : 'gap_overlay')
    }
  ];

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

      {/* 2. CENTRAL INTERACTIVE GEOSPATIAL MAP (MapLibre GL with Real XYZ Raster Tiles) */}
      <main className="absolute inset-0 z-0">
        <MapViewer
          metrics={metrics}
          geojsonData={geojsonData}
          currentCase={currentCase}
          caseId={selectedCaseId}
          layers={layerGroups}
          comparisonMode={comparisonMode}
          onSelectComparisonMode={setComparisonMode}
          sliderPos={sliderPos}
          onSliderChange={setSliderPos}
          targetCoords={targetCoords}
          renderMode={renderMode}
          onToggleRenderMode={setRenderMode}
          blendMode={blendMode}
          isInspectorOpen={isAnalysisInspectorOpen}
          isTimelineOpen={isTimelineOpen}
          onSelectEvidence={(ev) => {
            setIsAnalysisInspectorOpen(true);
            setInspectorTab('evidence');
          }}
        />
      </main>

      {/* 3. LEFT FLOATING LAYER EXPLORER */}
      <LayerExplorer
        layers={layerGroups}
        onUpdateLayer={handleUpdateLayer}
        isOpen={isLayerExplorerOpen}
        onClose={() => setIsLayerExplorerOpen(false)}
      />

      {/* 4. RIGHT FLOATING ANALYSIS INSPECTOR (Genuine Statistics from Case Manifest & Backend) */}
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
        renderMode={renderMode}
        onUpdateRenderMode={setRenderMode}
        targetCoords={targetCoords}
        onOpenEvidenceModal={(sec) => setEvidenceModalSection(sec)}
      />

      {/* 5. SATELLITE ACQUISITION TIMELINE (Real SAR Previews & Timestamps) */}
      <AcquisitionTimeline
        observations={timelineObservations}
        selectedIndex={selectedTimelineIndex}
        onSelectIndex={(idx) => {
          setSelectedTimelineIndex(idx);
          if (idx === 0) {
            handleUpdateLayer('earthObservation', 'preEventSar', { visible: true });
            handleUpdateLayer('earthObservation', 'postEventSar', { visible: false });
          } else if (idx === 1) {
            handleUpdateLayer('earthObservation', 'preEventSar', { visible: false });
            handleUpdateLayer('earthObservation', 'postEventSar', { visible: true });
          } else {
            handleUpdateLayer('floodInundation', 'candidateFloodwater', { visible: true });
          }
        }}
        isOpen={isTimelineOpen}
        onToggleOpen={() => setIsTimelineOpen(!isTimelineOpen)}
      />

      {/* 6. SCIENTIFIC ANALYTICS DRAWER & REGIONAL STATS */}
      <ScientificAnalytics
        metrics={metrics}
        currentCase={currentCase}
        isOpen={true}
        onToggleOpen={() => {}}
        isInspectorOpen={isAnalysisInspectorOpen}
      />

      {/* 7. EXPORT MODAL */}
      <ExportModal
        metrics={metrics}
        currentCase={currentCase}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

      {/* 8. SCIENTIFIC EVIDENCE DRILLDOWN MODAL */}
      <EvidenceModal
        sectionId={evidenceModalSection}
        metrics={metrics}
        currentCase={currentCase}
        onClose={() => setEvidenceModalSection(null)}
      />
    </div>
  );
};

export default App;
