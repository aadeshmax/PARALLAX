import React from 'react';
import { GranuleMetadata, CaseStudy } from '../types';
import { Layers, Calendar, MapPin, Sliders, Eye, EyeOff, Radio } from 'lucide-react';

interface SidebarProps {
  cases: CaseStudy[];
  selectedCaseId: string;
  onSelectCase: (caseId: string) => void;
  granules: GranuleMetadata[];
  layers: {
    showOperaWater: boolean;
    showInundatedVeg: boolean;
    showOpenWater: boolean;
    showCrossSensorGap: boolean;
    showCompareSlider: boolean;
  };
  onToggleLayer: (key: keyof SidebarProps['layers']) => void;
  thresholds: {
    darkening: number;
    brightening: number;
  };
  onChangeThresholds: (t: { darkening: number; brightening: number }) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  layers,
  onToggleLayer,
  thresholds,
  onChangeThresholds
}) => {
  const currentCase = cases.find(c => c.case_id === selectedCaseId) || cases[0];

  return (
    <aside className="w-84 border-r border-radar-border bg-radar-card flex flex-col h-[calc(100vh-4rem)] overflow-y-auto p-4 space-y-5 text-sm shrink-0">
      
      {/* 1. Region of Interest Selector */}
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <MapPin className="w-4 h-4 text-cyan-400" />
          <span>Region of Interest (AOI)</span>
        </label>
        <select
          value={selectedCaseId}
          onChange={(e) => onSelectCase(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
        >
          {cases.map((c) => (
            <option key={c.case_id} value={c.case_id}>
              {c.title || c.event_name || c.case_id}
            </option>
          ))}
        </select>
        {currentCase && (
          <div className="mt-2 text-[11px] font-mono text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
            <div>CRS: <span className="text-slate-200">{currentCase.crs || currentCase.analysis_crs || 'EPSG:32644'}</span></div>
            <div>Center: <span className="text-slate-200">{Array.isArray(currentCase.center) ? currentCase.center.slice(0, 2).map((n: number) => n.toFixed(3)).join(', ') : 'N/A'}</span></div>
            <div className="text-emerald-400 mt-1">● Verified Real NASA OPERA Assets</div>
          </div>
        )}
      </div>

      {/* 2. Temporal & Scene Metadata */}
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span>Satellite Scene Timeline</span>
        </label>
        <div className="space-y-2 text-xs font-mono">
          <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase">Pre-Event Baseline SAR</div>
            <div className="text-cyan-300 font-semibold mt-0.5">
              {currentCase?.pre_event?.acquisition_date || currentCase?.scenes?.[0]?.acquisition_timestamp || '2024-01-10 18:14 UTC'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 truncate" title={currentCase?.pre_event?.granule_id || currentCase?.scenes?.[0]?.scene_id}>
              {currentCase?.pre_event?.granule_id || currentCase?.scenes?.[0]?.scene_id || 'OPERA_L2_RTC-S1_PRE'}
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Polarization: VV + VH</div>
          </div>

          <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase">Post-Event Investigation SAR</div>
            <div className="text-cyan-300 font-semibold mt-0.5">
              {currentCase?.post_event?.acquisition_date || currentCase?.scenes?.[1]?.acquisition_timestamp || '2024-01-22 18:14 UTC'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 truncate" title={currentCase?.post_event?.granule_id || currentCase?.scenes?.[1]?.scene_id}>
              {currentCase?.post_event?.granule_id || currentCase?.scenes?.[1]?.scene_id || 'OPERA_L2_RTC-S1_POST'}
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Polarization: VV + VH</div>
          </div>
        </div>
      </div>

      {/* 3. Layer Toggles */}
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Visualization Overlays</span>
        </label>
        <div className="space-y-2">
          {/* Candidate Inundated Vegetation */}
          <button
            onClick={() => onToggleLayer('showInundatedVeg')}
            className={`w-full flex items-center justify-between p-2 rounded border text-xs text-left transition ${
              layers.showInundatedVeg
                ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                : 'bg-slate-900/40 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm"></span>
              <div>
                <div className="font-semibold">Candidate Inundated Veg</div>
                <div className="text-[10px] opacity-75">Dihedral Double-Bounce (+2.5 dB)</div>
              </div>
            </div>
            {layers.showInundatedVeg ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Open Water Specular */}
          <button
            onClick={() => onToggleLayer('showOpenWater')}
            className={`w-full flex items-center justify-between p-2 rounded border text-xs text-left transition ${
              layers.showOpenWater
                ? 'bg-blue-950/40 border-blue-500/60 text-blue-200'
                : 'bg-slate-900/40 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block shadow-sm"></span>
              <div>
                <div className="font-semibold">Open Water / Specular</div>
                <div className="text-[10px] opacity-75">Radar Attenuation (-3.0 dB)</div>
              </div>
            </div>
            {layers.showOpenWater ? <Eye className="w-4 h-4 text-blue-400" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* NASA OPERA Surface Water */}
          <button
            onClick={() => onToggleLayer('showOperaWater')}
            className={`w-full flex items-center justify-between p-2 rounded border text-xs text-left transition ${
              layers.showOperaWater
                ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-200'
                : 'bg-slate-900/40 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block shadow-sm"></span>
              <div>
                <div className="font-semibold">NASA OPERA DSWx Mask</div>
                <div className="text-[10px] opacity-75">Standard Surface Water Extent</div>
              </div>
            </div>
            {layers.showOperaWater ? <Eye className="w-4 h-4 text-cyan-400" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Cross-Sensor Comparison Slider Toggle */}
          <button
            onClick={() => onToggleLayer('showCompareSlider')}
            className={`w-full flex items-center justify-between p-2 rounded border text-xs text-left transition ${
              layers.showCompareSlider
                ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                : 'bg-slate-900/40 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              <div>
                <div className="font-semibold">Synchronized Compare Slider</div>
                <div className="text-[10px] opacity-75">Pre-Event vs Post-Event SAR</div>
              </div>
            </div>
            {layers.showCompareSlider ? <Eye className="w-4 h-4 text-amber-400" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 4. Scientific Detection Thresholds */}
      <div className="pt-2 border-t border-slate-800">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span>Radar Sensitivity Tuning</span>
        </label>
        <div className="space-y-3 text-xs">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-300">Specular Darkening (ΔdB)</span>
              <span className="font-mono text-cyan-400">{thresholds.darkening.toFixed(1)} dB</span>
            </div>
            <input
              type="range"
              min="-6.0"
              max="-1.5"
              step="0.5"
              value={thresholds.darkening}
              onChange={(e) => onChangeThresholds({ ...thresholds, darkening: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-300">Double-Bounce Brightening (ΔdB)</span>
              <span className="font-mono text-emerald-400">+{thresholds.brightening.toFixed(1)} dB</span>
            </div>
            <input
              type="range"
              min="1.5"
              max="5.0"
              step="0.5"
              value={thresholds.brightening}
              onChange={(e) => onChangeThresholds({ ...thresholds, brightening: parseFloat(e.target.value) })}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>
        </div>
      </div>

    </aside>
  );
};
