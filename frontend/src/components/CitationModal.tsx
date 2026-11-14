import React from 'react';
import { X, ExternalLink, Database, Award } from 'lucide-react';
import { DatasetInfo } from '../types';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasets: DatasetInfo[];
}

export const CitationModal: React.FC<CitationModalProps> = ({
  isOpen,
  onClose,
  datasets
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-radar-card border border-radar-border rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl p-6 text-sm">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100">NASA Earthdata Sources & Citations</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dataset Cards */}
        <div className="space-y-4 font-mono text-xs">
          {datasets.map((ds) => (
            <div key={ds.id} className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-cyan-400 font-bold text-sm">{ds.short_name}</div>
                  <div className="text-slate-300 font-sans mt-0.5">{ds.title}</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700">
                  {ds.level} • {ds.spatial_resolution_m}m
                </span>
              </div>

              <p className="text-slate-400 font-sans text-xs leading-relaxed">
                {ds.description}
              </p>

              <div className="text-[11px] text-slate-400">
                <span className="text-slate-300 font-semibold">Provider / DAAC:</span> {ds.provider}
              </div>

              <div className="text-[11px] text-slate-400">
                <span className="text-slate-300 font-semibold">Bands / Polarizations:</span> {ds.bands_or_polarizations.join(', ')}
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Official Scientific Citation:</div>
                <div className="p-2 rounded bg-slate-950 text-slate-300 text-[11px] select-all border border-slate-800">
                  {ds.citation}
                </div>
              </div>

              <a
                href={ds.doi}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 text-xs mt-1"
              >
                <span>NASA Landing Page / DOI</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}

          {/* NASA Space Apps Challenge Reference */}
          <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/30 flex items-center space-x-3 text-cyan-300 text-xs">
            <Award className="w-6 h-6 text-cyan-400 shrink-0" />
            <div>
              <span className="font-bold">PARALLAX — NASA Space Apps Challenge Project.</span> Developed to detect flood-related radar backscatter changes beneath vegetation using NISAR L-band & Sentinel-1 C-band and cross-reference with OPERA surface water.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
