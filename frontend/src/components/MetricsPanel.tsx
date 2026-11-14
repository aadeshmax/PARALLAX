import React from 'react';
import { AnalysisMetrics } from '../types';
import { Activity, Droplets, TreePine, Eye, AlertTriangle, BarChart3 } from 'lucide-react';

interface MetricsPanelProps {
  metrics: AnalysisMetrics | null;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="w-[380px] min-w-[380px] max-w-[380px] border-l border-radar-border bg-radar-card p-4 flex flex-col justify-center items-center text-slate-500 font-mono text-xs shrink-0">
        <Activity className="w-8 h-8 animate-spin mb-2 text-cyan-500/40" />
        <span>Awaiting radar raster ingestion...</span>
      </div>
    );
  }

  const {
    total_aoi_km2,
    open_water_km2,
    candidate_inundated_veg_km2,
    opera_dswx_water_km2,
    cross_sensor_breakdown,
    radar_statistics,
    confidence_summary,
    provenance
  } = metrics;

  return (
    <div className="w-[380px] min-w-[380px] max-w-[380px] border-l border-radar-border bg-radar-card flex flex-col h-full overflow-y-auto p-4 space-y-4 text-xs font-mono shrink-0">
      
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <span className="font-semibold text-slate-200 tracking-wider uppercase flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Detection Intelligence</span>
        </span>
        <span className="text-[10px] text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
          PROCESSED
        </span>
      </div>

      {/* Primary KPI Grid (Identical heights and baseline alignment) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Candidate Inundated Vegetation */}
        <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/40 flex flex-col justify-between min-h-[92px]">
          <div className="text-[10px] text-emerald-400 uppercase flex items-center gap-1.5 font-semibold">
            <TreePine className="w-3.5 h-3.5 shrink-0" />
            <span>Inundated Veg</span>
          </div>
          <div className="text-xl font-bold text-emerald-200 my-1 leading-none">
            {candidate_inundated_veg_km2} <span className="text-xs font-normal text-emerald-400">km²</span>
          </div>
          <div className="text-[9px] text-slate-400 truncate">Canopy Double-Bounce</div>
        </div>

        {/* Open Water Specular */}
        <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/40 flex flex-col justify-between min-h-[92px]">
          <div className="text-[10px] text-blue-400 uppercase flex items-center gap-1.5 font-semibold">
            <Droplets className="w-3.5 h-3.5 shrink-0" />
            <span>Open Water</span>
          </div>
          <div className="text-xl font-bold text-blue-200 my-1 leading-none">
            {open_water_km2} <span className="text-xs font-normal text-blue-400">km²</span>
          </div>
          <div className="text-[9px] text-slate-400 truncate">Specular Darkening</div>
        </div>
      </div>

      {/* OPERA DSWx Observation */}
      <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/40">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-cyan-400 uppercase flex items-center gap-1.5 font-semibold">
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>NASA OPERA DSWx Extent</span>
          </span>
          <span className="text-xs font-bold text-cyan-200">{opera_dswx_water_km2} km²</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1">
          Observed Surface Water from Sentinel-1 L3 C-SAR
        </div>
      </div>

      {/* Cross-Sensor Gap Breakdown */}
      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
        <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between pb-1 border-b border-slate-800">
          <span>CROSS-SENSOR GAP ANALYSIS</span>
          <BarChart3 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        </div>

        <div className="space-y-1.5 text-[11px]">
          <div className="flex justify-between items-center py-0.5">
            <span className="text-slate-400">Surface Water Agreement:</span>
            <span className="text-cyan-300 font-semibold">{cross_sensor_breakdown.agreement_open_water_km2} km²</span>
          </div>

          <div className="flex justify-between items-center bg-emerald-950/30 px-2 py-1.5 rounded-md border border-emerald-500/30">
            <span className="text-emerald-300 font-medium">Candidate Hidden Water (Gap):</span>
            <span className="text-emerald-200 font-bold">{cross_sensor_breakdown.candidate_hidden_water_km2} km²</span>
          </div>

          <div className="flex justify-between items-center py-0.5">
            <span className="text-slate-400">OPERA-Only Observation:</span>
            <span className="text-slate-300">{cross_sensor_breakdown.opera_only_water_km2} km²</span>
          </div>

          <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1.5 border-t border-slate-800">
            <span>Total Investigated AOI:</span>
            <span>{total_aoi_km2} km²</span>
          </div>
        </div>
      </div>

      {/* Radar Backscatter Decibel Statistics */}
      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
        <div className="text-[11px] font-semibold text-slate-300 pb-1 border-b border-slate-800">
          RADAR BACKSCATTER DYNAMICS (γ⁰ dB)
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="p-2 rounded-md bg-slate-800/60 border border-slate-800">
            <div className="text-slate-400">Baseline VV Mean</div>
            <div className="text-slate-200 font-bold mt-0.5">{radar_statistics.baseline_vv_mean_db} dB</div>
          </div>
          <div className="p-2 rounded-md bg-slate-800/60 border border-slate-800">
            <div className="text-slate-400">Event VV Mean</div>
            <div className="text-slate-200 font-bold mt-0.5">{radar_statistics.event_vv_mean_db} dB</div>
          </div>
          <div className="p-2 rounded-md bg-slate-800/60 border border-slate-800">
            <div className="text-blue-400">Water ΔdB Drop</div>
            <div className="text-blue-200 font-bold mt-0.5">{radar_statistics.mean_db_change_open_water} dB</div>
          </div>
          <div className="p-2 rounded-md bg-slate-800/60 border border-slate-800">
            <div className="text-emerald-400">Veg ΔdB Rise</div>
            <div className="text-emerald-200 font-bold mt-0.5">+{radar_statistics.mean_db_change_vegetation} dB</div>
          </div>
        </div>
      </div>

      {/* Confidence Tier Distribution */}
      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
        <div className="text-[11px] font-semibold text-slate-300 flex justify-between">
          <span>CONFIDENCE ESTIMATION</span>
          <span className="text-cyan-400">{confidence_summary.high_pct}% High</span>
        </div>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
          <div style={{ width: `${confidence_summary.high_pct}%` }} className="bg-emerald-500 h-full" title="High"></div>
          <div style={{ width: `${confidence_summary.medium_pct}%` }} className="bg-amber-500 h-full" title="Medium"></div>
          <div style={{ width: `${confidence_summary.low_pct}%` }} className="bg-slate-600 h-full" title="Low"></div>
        </div>
        <div className="flex justify-between text-[9px] text-slate-400 pt-0.5">
          <span>High ({confidence_summary.high_pct}%)</span>
          <span>Medium ({confidence_summary.medium_pct}%)</span>
          <span>Low ({confidence_summary.low_pct}%)</span>
        </div>
      </div>

      {/* Scientific Protocol Caution */}
      <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-[10px] text-amber-300/90 leading-relaxed flex items-start space-x-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Scientific Validation Protocol:</span> Newly identified areas represent candidate inundation until independently validated. Divergence against OPERA DSWx highlights detection complementarity, not ground-truth superiority.
        </div>
      </div>

    </div>
  );
};
