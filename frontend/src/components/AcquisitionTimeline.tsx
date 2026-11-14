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
    <div className="absolute bottom-4 left-3 z-20 flex flex-col pointer-events-auto">
      {/* Collapsible Bar Container */}
      <div className="flex flex-col rounded-2xl bg-midnight-panel/95 backdrop-blur-md border border-midnight-border shadow-2xl overflow-hidden transition-all duration-300">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-midnight-border/50 bg-midnight-elevated/40 text-xs">
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
                className="p-1 rounded bg-midnight-accent/20 hover:bg-midnight-accent text-midnight-accent hover:text-white transition"
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
          <div className="flex items-center gap-2.5 p-3">
            {observations.map((obs, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={obs.id}
                  onClick={() => onSelectIndex(idx)}
                  className={`flex flex-col w-48 rounded-xl border text-left p-2.5 transition relative overflow-hidden ${
                    isSelected
                      ? 'bg-midnight-elevated border-midnight-accent ring-1 ring-midnight-accent shadow-lg shadow-midnight-accent/15'
                      : 'bg-midnight-panel/80 border-midnight-border/60 hover:bg-midnight-elevated/60 hover:border-midnight-border'
                  }`}
                >
                  {/* Thumbnail / Radar preview banner */}
                  <div className="w-full h-16 rounded-lg bg-slate-900 border border-midnight-border/50 relative overflow-hidden mb-2 flex items-center justify-center">
                    {/* Stylized Synthetic Radar Backscatter Noise Pattern */}
                    <div
                      className="absolute inset-0 opacity-40 mix-blend-screen"
                      style={{
                        backgroundImage: `radial-gradient(circle at ${idx * 40}px 30px, #287BFF 0%, transparent 60%), radial-gradient(circle at 100px 20px, #FFB020 0%, transparent 50%)`,
                        backgroundSize: 'cover'
                      }}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,#060D17_25%,transparent_25%),linear-gradient(-45deg,#060D17_25%,transparent_25%)] bg-[size:6px_6px] opacity-30" />
                    <Cloud className="w-5 h-5 text-midnight-secondary/40 relative z-10" />
                    {isSelected && (
                      <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-midnight-accent text-[9px] font-bold text-white uppercase">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Metadata */}
                  <span className="font-bold text-xs text-midnight-primary leading-tight">
                    {obs.label}
                  </span>
                  <span className="text-[10px] text-midnight-secondary font-mono mt-0.5">
                    {obs.timestamp}
                  </span>
                  <span className="text-[10px] text-midnight-accent font-medium mt-1">
                    {obs.sensor}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
