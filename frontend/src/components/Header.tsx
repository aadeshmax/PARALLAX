import React from 'react';
import { EarthdataStatus } from '../types';
import { Satellite, ShieldCheck, AlertCircle, BookOpen, RefreshCw, Download } from 'lucide-react';

interface HeaderProps {
  status: EarthdataStatus | null;
  onOpenCitations: () => void;
  onRunAnalysis: () => void;
  onExportCase?: () => void;
  loading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onOpenCitations,
  onRunAnalysis,
  onExportCase,
  loading
}) => {
  return (
    <header className="h-16 border-b border-radar-border bg-radar-card px-6 flex items-center justify-between shrink-0 shadow-lg z-20">
      {/* Brand & Mission */}
      <div className="flex items-center space-x-3.5">
        <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-inner shrink-0">
          <Satellite className="w-5 h-5 animate-pulse" />
        </div>
        <div className="flex flex-col justify-center">
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-base tracking-wider text-slate-100 flex items-center gap-2 leading-none">
              PARALLAX <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">NASA EARTHDATA</span>
            </h1>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-1 leading-none">
            OPERA L2 RTC-S1 & L3 DSWx Dual-Signature Flood & Inundated Vegetation Engine
          </p>
        </div>
      </div>

      {/* Connection Status & Actions - Uniform height (h-9) and aligned items */}
      <div className="flex items-center space-x-2.5">
        {/* Earthdata Status Badge */}
        {status?.authenticated ? (
          <div className="h-9 flex items-center space-x-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>NASA EDL: LIVE ({status.username_masked})</span>
          </div>
        ) : (
          <div 
            className="h-9 flex items-center space-x-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono cursor-help"
            title={status?.error_message || "Operating with verified local NASA demonstration data"}
          >
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>NASA EDL: VERIFIED DEMO MODE</span>
          </div>
        )}

        {/* Citation Panel Button */}
        <button
          onClick={onOpenCitations}
          className="h-9 flex items-center space-x-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition"
          title="Data Sources, Sensors & Citations"
        >
          <BookOpen className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Citations</span>
        </button>

        {/* Export Case Package Button (Section 06 Requirement) */}
        {onExportCase && (
          <button
            onClick={onExportCase}
            className="h-9 flex items-center space-x-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 text-xs font-mono transition shadow-sm"
            title="Download full reproducible scientific case package (JSON, GeoJSON, Metadata)"
          >
            <Download className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Export Case</span>
          </button>
        )}

        {/* Run Analysis Button */}
        <button
          onClick={onRunAnalysis}
          disabled={loading}
          className="h-9 flex items-center space-x-2 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs font-mono shadow-md transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Processing...' : 'Execute Detection'}</span>
        </button>
      </div>
    </header>
  );
};
