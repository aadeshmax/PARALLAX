import React, { useState } from 'react';
import {
  Satellite,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Cloud
} from 'lucide-react';
import { TimelineObservation } from '../types';

interface AcquisitionTimelineProps {
  observations: TimelineObservation[];
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const AcquisitionTimeline: React.FC<AcquisitionTimelineProps> = ({
  observations,
  selectedIndex,
  onSelectIndex,
  isOpen,
  onToggleOpen
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Playback loop
  React.useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      onSelectIndex((selectedIndex + 1) % observations.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [isPlaying, selectedIndex, observations.length, onSelectIndex]);

  return (
    <div className="flex flex-col shrink-0">
      {/* Collapsible Bar Container */}
      <div className="flex flex-col h-full rounded-2xl glass-panel shadow-glass overflow-hidden transition-all duration-300">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-midnight-border/70 bg-midnight-elevated/30 text-xs">
          <button
            onClick={onToggleOpen}
            className="flex items-center gap-2 text-midnight-primary hover:text-midnight-accent transition font-semibold"
          >
            <Satellite className="w-3.5 h-3.5 text-midnight-accent" />
            <span>Satellite Acquisition Timeline</span>
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          <div className="flex items-center gap-3 text-[11px] text-midnight-secondary font-mono">
            <span>
              {selectedIndex + 1} / {observations.length} images
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onSelectIndex((selectedIndex - 1 + observations.length) % observations.length)}
                className="p-1 rounded hover:bg-midnight-elevated text-midnight-secondary hover:text-midnight-primary transition"
                title="Previous observation"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1 rounded bg-midnight-accent text-white shadow transition"
                title={isPlaying ? 'Pause timeline playback' : 'Play timeline sequence'}
              >
                {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
              </button>

              <button
                onClick={() => onSelectIndex((selectedIndex + 1) % observations.length)}
                className="p-1 rounded hover:bg-midnight-elevated text-midnight-secondary hover:text-midnight-primary transition"
                title="Next observation"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filmstrip Cards Body */}
        {isOpen && (
          <div className="flex items-center gap-2.5 p-3 flex-1">
            {observations.map((obs, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={obs.id}
                  onClick={() => onSelectIndex(idx)}
                  className={`flex flex-col w-[150px] shrink-0 rounded-xl border text-left p-2 transition relative overflow-hidden h-full justify-between ${
                    isSelected
                      ? 'bg-midnight-elevated border-midnight-accent ring-1 ring-midnight-accent shadow-lg shadow-midnight-accent/15'
                      : 'bg-midnight-panel/80 border-midnight-border/60 hover:bg-midnight-elevated/60 hover:border-midnight-border'
                  }`}
                >
                  {/* Real SAR Thumbnail Preview */}
                  <div className="w-full h-14 rounded-lg bg-slate-900 border border-midnight-border/50 relative overflow-hidden mb-1.5 flex items-center justify-center">
                    {obs.thumbnailUrl ? (
                      <img
                        src={obs.thumbnailUrl}
                        alt={obs.label}
                        className="w-full h-full object-cover contrast-125"
                        onError={(e) => {
                          // Hide broken image and fallback to radar noise
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Cloud className="w-5 h-5 text-midnight-secondary/40 relative z-10" />
                    )}
                    {/* ACTI Badge on Detection Gap or Selected */}
                    {(obs.id === 'gap_overlay' || isSelected) && (
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-blue-600 text-[9px] font-bold text-white uppercase shadow tracking-wider">
                        ACTI
                      </span>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-midnight-primary leading-tight">
                      {obs.label}
                    </span>
                    <span className="text-[10px] text-midnight-secondary font-mono mt-0.5 truncate">
                      {obs.timestamp}
                    </span>
                    <span className={`text-[10px] font-medium mt-1 ${obs.id === 'gap_overlay' ? 'text-blue-400' : 'text-midnight-secondary'}`}>
                      {obs.sensor}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
