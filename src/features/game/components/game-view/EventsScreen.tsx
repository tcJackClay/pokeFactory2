import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { UserPlus } from 'lucide-react';
import type { GameViewSectionProps } from './shared';
import { EVENT_REGIONS } from '../../config/events';
import { TYPE_COLORS, TYPE_ICONS } from '../../../../uiAppConstants';
import eventHpUpIcon from '../../../../assets/items/event-hp-up.png';
import eventBattleStatItemIcon from '../../../../assets/items/event-battle-stat-item.png';
import mapHoenn from '../../../../../reference/pokeemerald-expansion/graphics/pokedex/region_map.png';
import mapKanto from '../../../../../reference/pokeemerald-expansion/graphics/pokedex/region_map_kanto.png';
import mapSevii123 from '../../../../../reference/pokeemerald-expansion/graphics/pokedex/region_map_sevii123.png';
import mapSevii45 from '../../../../../reference/pokeemerald-expansion/graphics/pokedex/region_map_sevii45.png';

const REGION_CARD_BACKGROUNDS = [mapKanto, mapHoenn, mapSevii123, mapSevii45];
const POKEMON_JOIN_LINES = [
  (pokemonName: string) => `「${pokemonName}」眼神发亮，已经把你的队伍当成长期饭票了。`,
  (pokemonName: string) => `「${pokemonName}」看起来很想加入，连站位都替自己挑好了。`,
  (pokemonName: string) => `「${pokemonName}」嘴上还在矜持，脚已经诚实地迈进了队伍。`,
  (pokemonName: string) => `「${pokemonName}」认真思考三秒后，决定先跟你混一阵子。`,
  (pokemonName: string) => `「${pokemonName}」似乎误以为这里包吃包住，火速加入了队伍。`,
  (pokemonName: string) => `「${pokemonName}」本来还想装高手，结果还是被你顺手拐回来了。`,
  (pokemonName: string) => `命运、派遣单和一点点嘴硬，把「${pokemonName}」一起塞进了你的队伍。`,
  (pokemonName: string) => `「${pokemonName}」还没完全想明白，但入队这件事已经木已成舟。`,
];

function getEventItemIcon(itemId?: string): string {
  if (itemId === 'hp_up') return eventHpUpIcon;
  return eventBattleStatItemIcon;
}

function formatRemain(ms: number) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function getRandomPokemonJoinLine(pokemonName: string) {
  const randomIndex = Math.floor(Math.random() * POKEMON_JOIN_LINES.length);
  return POKEMON_JOIN_LINES[randomIndex](pokemonName);
}

export function EventsScreen({ viewModel }: GameViewSectionProps) {
  const {
    devToolsAvailable,
    developerMode,
    eventDispatches,
    eventDispatchPopup,
    dispatchEventRegion,
    mockEventDispatchResult,
    closeEventDispatchPopup,
    toggleDeveloperMode,
    setGameState,
  } = viewModel;

  const [now, setNow] = useState(() => Date.now());
  const [pokemonJoinLine, setPokemonJoinLine] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!eventDispatchPopup || eventDispatchPopup.kind === 'ITEM') {
      setPokemonJoinLine('');
      return;
    }

    setPokemonJoinLine(getRandomPokemonJoinLine(eventDispatchPopup.pokemonName));
  }, [eventDispatchPopup]);

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
          <div className="flex items-center gap-2">
            {devToolsAvailable && (
              <button
                onClick={toggleDeveloperMode}
                className={`text-xs font-black px-3 py-1.5 rounded-lg border transition-colors ${
                  developerMode
                    ? 'bg-cyan-500 text-slate-950 border-cyan-500'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
                title="Toggle event mock mode"
              >
                {developerMode ? 'Mock模式: 开' : 'Mock模式: 关'}
              </button>
            )}
            <button
              onClick={() => setGameState('START')}
              className="text-xs font-black px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200"
            >
              返回主页
            </button>
          </div>
        </div>

        {devToolsAvailable && !developerMode && (
          <p className="text-[11px] text-slate-500">
            开启上方 Mock 模式后，可使用每个地区下方的 Mock 道具/加入/特殊按钮。
          </p>
        )}

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

              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {eventDispatchPopup && (
          <motion.div
            className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/45 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeEventDispatchPopup}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="w-[min(62vw,220px)] aspect-square rounded-2xl border-4 border-slate-900 bg-white shadow-2xl flex flex-col"
              onClick={(event) => event.stopPropagation()}
            >
              {eventDispatchPopup.kind === 'ITEM' ? (
                <>
                  <div className="flex-1 flex items-center justify-center">
                    <img
                      src={getEventItemIcon(eventDispatchPopup.itemId)}
                      alt={eventDispatchPopup.itemName}
                      className="h-24 w-24 object-contain drop-shadow-[0_8px_14px_rgba(5,150,105,0.22)] [image-rendering:pixelated]"
                    />
                  </div>
                  <div className="px-4 pb-4 text-center text-[13px] font-black leading-tight text-emerald-800">
                    获得道具「{eventDispatchPopup.itemName}」
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 flex items-center justify-center">
                    {eventDispatchPopup.pokemonSprite ? (
                      <img
                        src={eventDispatchPopup.pokemonSprite}
                        alt={eventDispatchPopup.pokemonName}
                        className="h-32 w-32 object-contain drop-shadow-[0_10px_18px_rgba(14,165,233,0.24)]"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-32 w-32 items-center justify-center text-sky-500">
                        <UserPlus size={58} />
                      </div>
                    )}
                  </div>
                  <div className="px-4 pb-4 text-center text-[13px] font-black leading-tight text-sky-800">
                    {pokemonJoinLine || `「${eventDispatchPopup.pokemonName}」加入队伍`}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
