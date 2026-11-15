import React, { useState } from 'react';
import {
  Search,
  Maximize2,
  Ruler,
  Layers as LayersIcon,
  Columns,
  Calendar,
  Download,
  Play,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  MapPin,
  Loader2
} from 'lucide-react';
import { EarthdataStatus, CaseStudy, TopTool } from '../types';

interface HeaderCommandBarProps {
  status: EarthdataStatus | null;
  cases: CaseStudy[];
  selectedCaseId: string;
  onSelectCase: (caseId: string) => void;
  activeTool: TopTool;
  onToggleTool: (tool: TopTool) => void;
  onRunAnalysis: () => void;
  loading: boolean;
  onOpenExport: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onLocationSelect: (lat: number, lon: number, name: string) => void;
}

export const HeaderCommandBar: React.FC<HeaderCommandBarProps> = ({
  status,
  cases,
  selectedCaseId,
  onSelectCase,
  activeTool,
  onToggleTool,
  onRunAnalysis,
  loading,
  onOpenExport,
  searchQuery,
  onSearchChange,
  onLocationSelect
}) => {
  const [showCaseDropdown, setShowCaseDropdown] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  const currentCase = cases.find((c) => c.case_id === selectedCaseId) || cases[0];

  const PRESET_LOCATIONS = [
    { name: 'Chennai City, Tamil Nadu, India', lat: 13.0827, lon: 80.2707, caseId: 'chennai_live_case' },
    { name: 'Northern Chennai Study Area (OPERA 2024)', lat: 13.254961, lon: 80.118456, caseId: 'chennai_live_case' },
    { name: 'Mumbai City, Maharashtra, India', lat: 19.0760, lon: 72.8777, caseId: 'mumbai_nisar_2026' },
    { name: 'Mumbai & Thane Creek (NISAR L-band 2026)', lat: 19.1000, lon: 72.9500, caseId: 'mumbai_nisar_2026' },
    { name: 'Adyar River Basin, Chennai', lat: 13.0012, lon: 80.2565, caseId: 'chennai_live_case' },
    { name: 'Pallikaranai Marshlands, Chennai', lat: 12.9350, lon: 80.2180, caseId: 'chennai_live_case' },
    { name: 'Thane Creek Flamingo Sanctuary, Mumbai', lat: 19.0850, lon: 72.9650, caseId: 'mumbai_nisar_2026' },
    { name: 'Rio Grande do Sul, Brazil (Benchmark)', lat: -29.8705, lon: -51.3676, caseId: 'real_event_rio_grande_do_sul' }
  ];

  const filteredLocations = PRESET_LOCATIONS.filter((loc) =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 lg:gap-3 pointer-events-none">
      {/* Left: Brand & Search Pill */}
      <div className="flex items-center gap-2 lg:gap-3 pointer-events-auto shrink min-w-0">
        {/* Brand Logo & Wordmark */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl glass-pill shadow-pill shrink-0">
          {/* Custom Cyclone/Vortex Logo Icon */}
          <div className="w-8 h-8 rounded-lg bg-midnight-accent/20 border border-midnight-accent/60 flex items-center justify-center text-midnight-accent shrink-0 shadow-glow-accent">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-2">
              <path strokeLinecap="round" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
              <path strokeLinecap="round" d="M12 6a6 6 0 0 1 6 6 6 6 0 0 1-6 6" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-wider text-midnight-primary leading-tight">
              PARALLAX
            </span>
            <span className="text-[10px] text-midnight-secondary font-medium tracking-wide hidden sm:inline">
              NISAR-Powered Surface Change Intelligence
            </span>
          </div>
        </div>

        {/* Location Search Bar */}
        <div className="relative shrink min-w-0">
          <div className="flex items-center gap-2 px-3.5 py-2 w-48 sm:w-60 lg:w-72 rounded-xl glass-pill shadow-pill text-xs text-midnight-secondary focus-within:border-midnight-accent focus-within:ring-1 focus-within:ring-midnight-accent/50 transition">
            <Search className="w-4 h-4 text-midnight-secondary shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setShowSearchSuggestions(true);
              }}
              onFocus={() => setShowSearchSuggestions(true)}
              placeholder="Search city, river basin, or landmark..."
              className="bg-transparent text-midnight-primary placeholder:text-midnight-secondary/60 focus:outline-none w-full text-xs"
            />
          </div>

          {/* Search Suggestions Dropdown */}
          {showSearchSuggestions && searchQuery.length > 0 && (
            <div className="absolute top-full mt-1.5 left-0 w-full glass-panel rounded-xl shadow-glass py-1 z-40 text-xs">
              {filteredLocations.length > 0 ? (
                filteredLocations.map((loc, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onLocationSelect(loc.lat, loc.lon, loc.name);
                      onSearchChange(loc.name);
                      setShowSearchSuggestions(false);
                      if (loc.caseId && loc.caseId !== selectedCaseId) {
                        onSelectCase(loc.caseId);
                      }
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-midnight-elevated flex items-center gap-2 text-midnight-primary transition"
                  >
                    <MapPin className="w-3.5 h-3.5 text-midnight-accent shrink-0" />
                    <span>{loc.name}</span>
                  </button>
                ))
              ) : (
                <div className="p-3 text-midnight-secondary text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                    <span>⚠️ Outside Active Study Areas</span>
                  </div>
                  <p className="text-[11px] text-midnight-secondary/80">
                    "{searchQuery}" is outside current radar swaths. Validated coverage is available for Chennai (OPERA C-band) and Mumbai (NISAR L-band).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Tools Buttons */}
        <div className="flex items-center gap-1 p-1 rounded-xl glass-pill shadow-pill">
          <button
            onClick={() => onToggleTool(activeTool === 'area' ? null : 'area')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTool === 'area'
                ? 'bg-midnight-accent text-white shadow-glow-accent'
                : 'text-midnight-secondary hover:text-midnight-primary hover:bg-midnight-elevated'
            }`}
            title="Area of Interest (AOI) selection"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Area</span>
          </button>

          <button
            onClick={() => onToggleTool(activeTool === 'measure' ? null : 'measure')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTool === 'measure'
                ? 'bg-midnight-accent text-white shadow-glow-accent'
                : 'text-midnight-secondary hover:text-midnight-primary hover:bg-midnight-elevated'
            }`}
            title="Distance & Area Measurement tool"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Measure</span>
          </button>

          <button
            onClick={() => onToggleTool(activeTool === 'layers' ? null : 'layers')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTool === 'layers'
                ? 'bg-midnight-accent text-white shadow-glow-accent'
                : 'text-midnight-secondary hover:text-midnight-primary hover:bg-midnight-elevated'
            }`}
            title="Toggle Layer Explorer"
          >
            <LayersIcon className="w-3.5 h-3.5" />
            <span>Layers</span>
          </button>

          <button
            onClick={() => onToggleTool(activeTool === 'compare' ? null : 'compare')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTool === 'compare'
                ? 'bg-midnight-accent text-white shadow-glow-accent'
                : 'text-midnight-secondary hover:text-midnight-primary hover:bg-midnight-elevated'
            }`}
            title="Toggle Comparison Mode"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Compare</span>
          </button>
        </div>
      </div>

      {/* Right: Date, System Status, Export & Run Action */}
      <div className="flex items-center gap-2 pointer-events-auto shrink-0">
        {/* Event Date Selector */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowCaseDropdown(!showCaseDropdown)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-pill shadow-pill text-xs text-midnight-primary hover:border-midnight-accent transition"
          >
            <Calendar className="w-3.5 h-3.5 text-midnight-accent" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-midnight-secondary leading-tight">Event Date</span>
              <span className="font-mono text-xs font-medium">
                {currentCase?.case_id === 'chennai_live_case'
                  ? 'Nov 24 - Dec 06, 2024'
                  : currentCase?.case_id === 'mumbai_nisar_2026'
                  ? 'Jun 22 - Jul 04, 2026'
                  : 'Apr 25 - May 02, 2025'}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-midnight-secondary ml-1" />
          </button>

          {/* Case Dropdown */}
          {showCaseDropdown && (
            <div className="absolute right-0 top-full mt-1.5 w-72 glass-panel rounded-xl shadow-glass py-1.5 z-40 text-xs">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-midnight-secondary uppercase tracking-wider border-b border-midnight-border/60">
                Satellite Study Cases
              </div>
              {cases.map((c) => (
                <button
                  key={c.case_id}
                  onClick={() => {
                    onSelectCase(c.case_id);
                    setShowCaseDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-midnight-elevated flex flex-col transition ${
                    c.case_id === selectedCaseId ? 'bg-midnight-accent/15 border-l-2 border-midnight-accent' : ''
                  }`}
                >
                  <span className="font-medium text-midnight-primary">{c.title}</span>
                  <span className="text-[10px] text-midnight-secondary font-mono mt-0.5">
                    {c.location} ({c.crs})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* System Online / Datasets Status Badge */}
        <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-2 rounded-xl glass-pill shadow-pill text-xs shrink-0">
          <div className="relative flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-midnight-success animate-ping absolute opacity-75" />
            <span className="w-2 h-2 rounded-full bg-midnight-success relative shadow-glow-accent" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-midnight-primary text-xs leading-tight">
              {status?.authenticated ? 'System Online' : 'System Ready'}
            </span>
            <span className="text-[10px] text-midnight-secondary font-mono">
              {status?.authenticated
                ? `NASA ROL (${status.username_masked})`
                : 'NASA ROL (ma***y)'}
            </span>
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-pill shadow-pill text-xs font-medium text-midnight-primary hover:bg-midnight-elevated hover:border-midnight-accent transition shrink-0"
          title="Export GeoJSON, CSV, GeoTIFF or Report"
        >
          <Download className="w-3.5 h-3.5 text-midnight-secondary" />
          <span>Export</span>
        </button>

        {/* Primary Run Analysis Button */}
        <button
          onClick={onRunAnalysis}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-midnight-accent hover:bg-blue-600 text-white font-semibold text-xs transition shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{loading ? 'Processing...' : 'Run Analysis'}</span>
        </button>
      </div>
    </header>
  );
};
