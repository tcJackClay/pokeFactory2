import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { GameViewSectionProps } from './shared';
import { EVENT_REGIONS } from '../../config/events';
import { TYPE_COLORS, TYPE_ICONS } from '../../../../uiAppConstants';
import mapHoenn from '../../../../../reference/pokeemerald-expansion/graphics/pokedex/region_map.png';
import mapKanto from '../../../../../reference/pokeemerald-expansion/graphics/pokedex/region_map_kanto.png';
import mapSevii123 from '../../../../../reference/pokeemerald-expansion/graphics/pokedex/region_map_sevii123.png';
import mapSevii45 from '../../../../../reference/pokeemerald-expansion/graphics/pokedex/region_map_sevii45.png';

const REGION_CARD_BACKGROUNDS = [mapKanto, mapHoenn, mapSevii123, mapSevii45];

function formatRemain(ms: number) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function EventsScreen({ viewModel }: GameViewSectionProps) {
  const {
    developerMode,
    eventDispatches,
    dispatchEventRegion,
    mockEventDispatchResult,
    setGameState,
  } = viewModel;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <motion.div
      key="events"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex-1 min-h-0 overflow-y-auto px-2 py-2 md:px-4 md:py-3"
    >
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-wide">事件派遣</h2>
          <button
            onClick={() => setGameState('START')}
            className="text-xs font-black px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200"
          >
            返回主页
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {EVENT_REGIONS.map((region, index) => {
            const dispatch = eventDispatches[region.id];
            const readyAt = dispatch?.readyAt ?? null;
            const isRunning = dispatch?.status === 'RUNNING' && readyAt !== null && readyAt > now;
            const canResolve = dispatch?.status === 'READY' || (dispatch?.status === 'RUNNING' && readyAt !== null && readyAt <= now);
            const cardBackground = REGION_CARD_BACKGROUNDS[index % REGION_CARD_BACKGROUNDS.length];

            const buttonLabel = isRunning
              ? `派遣中 ${formatRemain((readyAt ?? now) - now)}`
              : canResolve
                ? '领取结果'
                : '派遣';

            return (
              <div
                key={region.id}
                className="relative overflow-hidden rounded-xl border border-slate-200 p-2"
                style={{
                  backgroundImage: `linear-gradient(rgba(248,250,252,0.94), rgba(248,250,252,0.9)), url(${cardBackground})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black">{region.name}</p>
                  <div className="flex items-center gap-1.5">
                    {region.requiredTypes.map((type) => {
                      const TypeIcon = TYPE_ICONS[type];
                      const color = TYPE_COLORS[type] ?? '#64748b';
                      return TypeIcon ? (
                        <span
                          key={`${region.id}-${type}`}
                          title={type}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white"
                        >
                          <TypeIcon size={14} color={color} />
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>

                <button
                  onClick={() => void dispatchEventRegion(region.id)}
                  disabled={isRunning}
                  className="mt-2 w-full px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-black disabled:opacity-50"
                >
                  {buttonLabel}
                </button>

                {developerMode && (
                  <div className="mt-1 grid grid-cols-3 gap-1">
                    <button
                      onClick={() => mockEventDispatchResult(region.id, 'item')}
                      className="px-1.5 py-1 rounded bg-emerald-600 text-white text-[10px] font-black"
                    >
                      Mock道具
                    </button>
                    <button
                      onClick={() => mockEventDispatchResult(region.id, 'join')}
                      className="px-1.5 py-1 rounded bg-sky-600 text-white text-[10px] font-black"
                    >
                      Mock加入
                    </button>
                    <button
                      onClick={() => mockEventDispatchResult(region.id, 'battle_special')}
                      className="px-1.5 py-1 rounded bg-amber-600 text-white text-[10px] font-black"
                    >
                      Mock特殊
                    </button>
                  </div>
                )}

                {dispatch?.lastResult && (
                  <p className="mt-2 text-xs text-slate-700">{dispatch.lastResult}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
