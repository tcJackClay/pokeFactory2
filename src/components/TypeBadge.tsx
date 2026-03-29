import React from 'react';
import { Sparkles } from 'lucide-react';
import { TYPE_ZH } from '../constants';
import { TYPE_COLORS, TYPE_ICONS } from '../uiAppConstants';

const TypeBadge: React.FC<{ type: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }> = ({ type, size = 'sm', className = '' }) => {
  const Icon = TYPE_ICONS[type] || Sparkles;
  const color = TYPE_COLORS[type] || '#ccc';

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
      className={`flex items-center text-white font-black italic uppercase shadow-md ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: color }}
    >
      <Icon className={`${iconSizes[size]} drop-shadow-sm`} />
      <span>{TYPE_ZH[type] || type}</span>
    </div>
  );
};

export default TypeBadge;
