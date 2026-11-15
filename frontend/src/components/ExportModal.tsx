import React, { useState } from 'react';
import {
  Download,
  X,
  FileText,
  FileSpreadsheet,
  Layers,
  FileJson,
  Check,
  ExternalLink
} from 'lucide-react';
import { AnalysisMetrics, CaseStudy } from '../types';

interface ExportModalProps {
  metrics: AnalysisMetrics | null;
  currentCase?: CaseStudy | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  metrics,
  currentCase,
  isOpen,
  onClose
}) => {
  const [downloading, setDownloading] = useState<string | null>(null);

  if (!isOpen) return null;

  const downloadFile = (url: string, filename: string) => {
    setDownloading(filename);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(null), 1200);
  };

  const exportCSV = () => {
    if (!metrics) return;
    const rows = [
      ['Metric', 'Value', 'Unit'],
      ['Analysis ID', metrics.analysis_id, ''],
      ['Case ID', metrics.case_id, ''],
      ['Total Valid AOI', metrics.total_aoi_km2, 'km²'],
      ['OPERA Mapped Water', metrics.opera_dswx_water_km2, 'km²'],
      ['Candidate Inundated Veg (Double-Bounce)', metrics.candidate_inundated_veg_km2, 'km²'],
      ['Confirmed Open Water Agreement', metrics.cross_sensor_breakdown?.agreement_open_water_km2 ?? 0, 'km²'],
      ['Candidate Hidden Water Gap', metrics.cross_sensor_breakdown?.candidate_hidden_water_km2 ?? 0, 'km²'],
      ['OPERA Only Water', metrics.cross_sensor_breakdown?.opera_only_water_km2 ?? 0, 'km²'],
      ['Baseline VV Mean dB', metrics.radar_statistics?.baseline_vv_mean_db ?? 0, 'dB'],
      ['Event VV Mean dB', metrics.radar_statistics?.event_vv_mean_db ?? 0, 'dB'],
      ['Mean dB Change (Open Water)', metrics.radar_statistics?.mean_db_change_open_water ?? 0, 'dB'],
      ['Mean dB Change (Vegetation)', metrics.radar_statistics?.mean_db_change_vegetation ?? 0, 'dB'],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    downloadFile(encodedUri, `PARALLAX_analysis_${metrics.analysis_id || 'export'}.csv`);
  };

  const exportJSON = () => {
    if (!metrics) return;
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(metrics, null, 2));
    downloadFile(jsonStr, `PARALLAX_analysis_${metrics.analysis_id || 'export'}.json`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pointer-events-auto">
      <div className="w-full max-w-lg rounded-2xl bg-midnight-panel border border-midnight-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-midnight-border bg-midnight-elevated/40">
          <div className="flex items-center gap-2.5">
            <Download className="w-5 h-5 text-midnight-accent" />
            <h3 className="font-bold text-sm text-midnight-primary">
              Export Geospatial Products & Analysis
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-midnight-secondary hover:text-midnight-primary hover:bg-midnight-elevated transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Export Options Grid */}
        <div className="p-6 space-y-3 text-xs">
          {/* GeoJSON */}
          <div className="p-3.5 rounded-xl bg-midnight-elevated/40 border border-midnight-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-midnight-accent shrink-0" />
              <div className="flex flex-col">
                <span className="font-semibold text-midnight-primary">GeoJSON Candidate Polygons</span>
                <span className="text-[11px] text-midnight-secondary">
                  Delineated vector polygons of candidate inundated vegetation & water
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                if (metrics?.layer_urls?.geojson) {
                  downloadFile(metrics.layer_urls.geojson, 'parallax_candidates.geojson');
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-midnight-accent hover:bg-blue-600 text-white font-medium transition"
            >
              Export
            </button>
          </div>

          {/* GeoTIFF */}
          <div className="p-3.5 rounded-xl bg-midnight-elevated/40 border border-midnight-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-midnight-opera shrink-0" />
              <div className="flex flex-col">
                <span className="font-semibold text-midnight-primary">Classification GeoTIFF</span>
                <span className="text-[11px] text-midnight-secondary">
                  30m aligned raster with common valid mask & class labels
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                if (metrics?.layer_urls?.classification_tif) {
                  downloadFile(metrics.layer_urls.classification_tif, 'classification.tif');
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-midnight-accent hover:bg-blue-600 text-white font-medium transition"
            >
              Export
            </button>
          </div>

          {/* CSV */}
          <div className="p-3.5 rounded-xl bg-midnight-elevated/40 border border-midnight-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-midnight-candidate shrink-0" />
              <div className="flex flex-col">
                <span className="font-semibold text-midnight-primary">Analysis Statistics CSV</span>
                <span className="text-[11px] text-midnight-secondary">
                  Full numerical area, dB change, and sensor agreement table
                </span>
              </div>
            </div>
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 rounded-lg bg-midnight-accent hover:bg-blue-600 text-white font-medium transition"
            >
              Export
            </button>
          </div>

          {/* JSON */}
          <div className="p-3.5 rounded-xl bg-midnight-elevated/40 border border-midnight-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileJson className="w-5 h-5 text-midnight-success shrink-0" />
              <div className="flex flex-col">
                <span className="font-semibold text-midnight-primary">Full JSON Contract</span>
                <span className="text-[11px] text-midnight-secondary">
                  Complete metadata, provenance DOIs, and radar parameters
                </span>
              </div>
            </div>
            <button
              onClick={exportJSON}
              className="px-3 py-1.5 rounded-lg bg-midnight-accent hover:bg-blue-600 text-white font-medium transition"
            >
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
