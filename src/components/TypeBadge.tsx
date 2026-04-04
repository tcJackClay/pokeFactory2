import React from 'react';
import { Sparkles } from 'lucide-react';
import { TYPE_ZH } from '../constants';
import { TYPE_COLORS, TYPE_ICONS } from '../uiAppConstants';

const LIGHT_TYPES = new Set(['normal', 'electric', 'ground', 'flying', 'ice', 'steel', 'rock']);

const TypeBadge: React.FC<{ type: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }> = ({ type, size = 'sm', className = '' }) => {
  const Icon = TYPE_ICONS[type] || Sparkles;
  const color = TYPE_COLORS[type] || '#ccc';
  const isLight = LIGHT_TYPES.has(type);

  const sizeClasses = {
    xs: 'text-[8px] px-1.5 py-0.5 gap-1',
    sm: 'text-[10px] px-2 py-1 gap-1.5',
    md: 'text-xs px-3 py-1 gap-2',
    lg: 'text-sm px-5 py-1.5 gap-2.5',
  };

  const iconSizes = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <div
      className={`relative flex items-center overflow-hidden border-[2px] font-black italic uppercase ${isLight ? 'border-slate-950/20 text-slate-950' : 'border-slate-950/30 text-white'} ${sizeClasses[size]} ${className}`}
      style={{
        background: `linear-gradient(180deg, color-mix(in srgb, ${color} 76%, black 24%) 0%, color-mix(in srgb, ${color} 56%, black 44%) 100%)`,
      }}
    >
      <div
        className="absolute inset-[1px] flex items-center"
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${color} 96%, white 4%) 0%, color-mix(in srgb, ${color} 84%, black 16%) 100%)`,
        }}
      />
      <div className="absolute inset-x-[1px] top-[1px] h-[1px] bg-white/45" />
      <div className="absolute inset-x-[1px] bottom-[1px] h-[2px] bg-slate-950/16" />
      <div className="relative z-10 flex items-center gap-inherit">
        <Icon className={`${iconSizes[size]} drop-shadow-sm`} />
        <span>{TYPE_ZH[type] || type}</span>
      </div>
    </div>
  );
};

export default TypeBadge;
