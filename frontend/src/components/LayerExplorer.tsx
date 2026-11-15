import React, { useState } from 'react';
import {
  Layers as LayersIcon,
  X,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Sliders,
  Info
} from 'lucide-react';
import { LayerGroupsState, LayerStateItem } from '../types';

interface LayerExplorerProps {
  layers: LayerGroupsState;
  onUpdateLayer: (group: keyof LayerGroupsState, key: string, updates: Partial<LayerStateItem>) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const LayerExplorer: React.FC<LayerExplorerProps> = ({
  layers,
  onUpdateLayer,
  isOpen,
  onClose
}) => {
  const [activeOpacitySlider, setActiveOpacitySlider] = useState<string | null>(null);

  if (!isOpen) return null;

  const renderLayerRow = (
    group: keyof LayerGroupsState,
    key: string,
    item: LayerStateItem
  ) => {
    const isSliderOpen = activeOpacitySlider === `${group}-${key}` || item.opacity !== undefined;

    return (
      <div key={key} className="flex flex-col py-1.5 border-b border-midnight-border/30 last:border-0">
        <div className="flex items-center justify-between gap-2 text-xs">
          {/* Checkbox & Dot & Label */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              type="checkbox"
              checked={item.visible}
              disabled={item.disabled}
              onChange={(e) => onUpdateLayer(group, key, { visible: e.target.checked })}
              className="w-3.5 h-3.5 rounded bg-midnight-elevated border-midnight-border text-midnight-accent focus:ring-0 cursor-pointer disabled:opacity-40"
            />
            {item.color && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
            )}
            <span
              className={`truncate font-medium ${
                item.visible ? 'text-midnight-primary' : 'text-midnight-secondary/60'
              } ${item.disabled ? 'line-through text-midnight-secondary/40' : ''}`}
            >
              {item.name}
            </span>
          </div>

          {/* Visibility Eye & Opacity Percentage */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono text-[10px] text-midnight-secondary w-7 text-right">
              {item.opacity}%
            </span>
            <button
              onClick={() => onUpdateLayer(group, key, { visible: !item.visible })}
              className={`p-1 rounded hover:bg-midnight-elevated transition ${
                item.visible ? 'text-midnight-secondary hover:text-midnight-primary' : 'text-midnight-secondary/30'
              }`}
              title={item.visible ? 'Hide layer' : 'Show layer'}
            >
              {item.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Inline Opacity Slider */}
        {item.visible && (
          <div className="flex items-center gap-2 mt-1 px-5">
            <input
              type="range"
              min="0"
              max="100"
              value={item.opacity}
              onChange={(e) => onUpdateLayer(group, key, { opacity: parseInt(e.target.value, 10) })}
              className="w-full h-1 bg-midnight-border rounded-lg appearance-none cursor-pointer accent-midnight-accent"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute top-16 left-3 z-20 w-80 max-h-[calc(100vh-14rem)] flex flex-col rounded-2xl bg-midnight-panel/95 backdrop-blur-md border border-midnight-border shadow-2xl overflow-hidden pointer-events-auto transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-midnight-border bg-midnight-elevated/40">
        <div className="flex items-center gap-2">
          <LayersIcon className="w-4 h-4 text-midnight-accent" />
          <h2 className="font-bold text-xs text-midnight-primary tracking-wide">
            Layers
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-midnight-secondary hover:text-midnight-primary hover:bg-midnight-elevated transition"
          title="Close Layers Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Groups */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* 1. EARTH OBSERVATION */}
        <div>
          <div className="text-[10px] font-bold text-midnight-secondary uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>EARTH OBSERVATION</span>
          </div>
          <div className="bg-midnight-elevated/30 rounded-xl p-2.5 border border-midnight-border/50">
            {Object.entries(layers.earthObservation).map(([k, item]) =>
              renderLayerRow('earthObservation', k, item)
            )}
          </div>
        </div>

        {/* 2. FLOOD INUNDATION LAYERS */}
        <div>
          <div className="text-[10px] font-bold text-midnight-secondary uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>FLOOD INUNDATION LAYERS</span>
          </div>
          <div className="bg-midnight-elevated/30 rounded-xl p-2.5 border border-midnight-border/50">
            {Object.entries(layers.floodInundation).map(([k, item]) =>
              renderLayerRow('floodInundation', k, item)
            )}
          </div>
        </div>

        {/* 3. SPATIAL CONTEXT */}
        <div>
          <div className="text-[10px] font-bold text-midnight-secondary uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>SPATIAL CONTEXT</span>
          </div>
          <div className="bg-midnight-elevated/30 rounded-xl p-2.5 border border-midnight-border/50">
            {Object.entries(layers.spatialContext).map(([k, item]) =>
              renderLayerRow('spatialContext', k, item)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
