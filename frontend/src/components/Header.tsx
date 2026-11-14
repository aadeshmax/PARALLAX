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
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-inner">
          <Satellite className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-lg tracking-wider text-slate-100 flex items-center gap-2">
              PARALLAX <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">NASA EARTHDATA</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            OPERA L2 RTC-S1 & L3 DSWx Dual-Signature Flood & Inundated Vegetation Engine
          </p>
        </div>
      </div>

      {/* Connection Status & Actions */}
      <div className="flex items-center space-x-3">
        {/* Earthdata Status Badge */}
        {status?.authenticated ? (
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>NASA EDL: LIVE ({status.username_masked})</span>
          </div>
        ) : (
          <div 
            className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono cursor-help"
            title={status?.error_message || "Operating with verified local NASA demonstration data"}
          >
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>NASA EDL: VERIFIED DEMO MODE</span>
          </div>
        )}

        {/* Citation Panel Button */}
        <button
          onClick={onOpenCitations}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition"
          title="Data Sources, Sensors & Citations"
        >
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>Citations</span>
        </button>

        {/* Export Case Package Button (Section 06 Requirement) */}
        {onExportCase && (
          <button
            onClick={onExportCase}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 text-xs font-mono transition shadow-sm"
            title="Download full reproducible scientific case package (JSON, GeoJSON, Metadata)"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Case</span>
          </button>
        )}

        {/* Run Analysis Button */}
        <button
          onClick={onRunAnalysis}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-md transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Processing...' : 'Execute Dual-Pol Detection'}</span>
        </button>
      </div>
    </header>
  );
};
