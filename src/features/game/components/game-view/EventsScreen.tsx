import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Sparkles, Trash2, UserPlus, X } from 'lucide-react';
import type { GameViewSectionProps } from './shared';
import { EVENT_REGIONS } from '../../config/events';
import { TYPE_COLORS, TYPE_ICONS } from '../../../../uiAppConstants';
import { fetchDexSnapshots, type DexSnapshot } from '../../../../services/pokedexClient';
import { getPokemonSpriteUrl } from '../../../../services/pokeApiEndpoint';
import eventHpUpIcon from '../../../../assets/items/event-hp-up.png';
import eventBattleStatItemIcon from '../../../../assets/items/event-battle-stat-item.png';
import mapHoenn from '../../../../assets/maps/region-map-hoenn.png';
import mapKanto from '../../../../assets/maps/region-map-kanto.png';
import mapSevii123 from '../../../../assets/maps/region-map-sevii123.png';
import mapSevii45 from '../../../../assets/maps/region-map-sevii45.png';

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
    currentLanguage,
    collectionOwnedIds,
    eventDispatches,
    eventDispatchPokemonByRegion,
    eventDispatchPopup,
    getLocalized,
    setEventDispatchPokemon,
    dispatchEventRegion,
    mockEventDispatchResult,
    closeEventDispatchPopup,
    toggleDeveloperMode,
    enterBase,
  } = viewModel;

  const [now, setNow] = useState(() => Date.now());
  const [pokemonJoinLine, setPokemonJoinLine] = useState('');
  const [pickerRegionId, setPickerRegionId] = useState<string | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [snapshotById, setSnapshotById] = useState<Record<number, DexSnapshot>>({});

  const isZh = currentLanguage.startsWith('zh');

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

  useEffect(() => {
    if (!pickerRegionId) return;
    const missingIds = collectionOwnedIds.filter((pokemonId) => !snapshotById[pokemonId]);
    if (missingIds.length === 0) return;

    let cancelled = false;
    setPickerLoading(true);
    void fetchDexSnapshots(missingIds)
      .then((snapshots) => {
        if (cancelled) return;
        setSnapshotById((prev) => ({ ...prev, ...snapshots }));
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [collectionOwnedIds, pickerRegionId, snapshotById]);

  const openPicker = (regionId: string) => {
    setPickerSearch('');
    setPickerRegionId(regionId);
  };

  const closePicker = () => {
    setPickerRegionId(null);
    setPickerSearch('');
  };

  const getSnapshotDisplayName = (snapshot: DexSnapshot | undefined) => {
    if (!snapshot) return isZh ? '未知宝可梦' : 'Unknown Pokemon';
    const localized = getLocalized({
      name: snapshot.apiName,
      names: snapshot.names,
      zhName: snapshot.zhName,
    });
    return localized?.trim() || snapshot.apiName;
  };

  const pickRecommendedPokemon = (regionId: string) => {
    const region = EVENT_REGIONS.find((entry) => entry.id === regionId);
    if (!region) return;

    const candidates = collectionOwnedIds.filter((pokemonId) => {
      const snapshot = snapshotById[pokemonId];
      if (!snapshot) return false;
      return region.requiredTypes.some((requiredType) => snapshot.types.includes(requiredType));
    });

    if (candidates.length === 0) return;
    const recommendedId = candidates[Math.floor(Math.random() * candidates.length)];
    if (!recommendedId) return;
    setEventDispatchPokemon(regionId, recommendedId);
  };

  const getMatchedTypeCount = (regionId: string, pokemonId: number | null) => {
    if (!pokemonId) return 0;
    const region = EVENT_REGIONS.find((entry) => entry.id === regionId);
    const snapshot = snapshotById[pokemonId];
    if (!region || !snapshot) return 0;
    return region.requiredTypes.filter((requiredType) => snapshot.types.includes(requiredType)).length;
  };

  const pickerRegion = pickerRegionId
    ? EVENT_REGIONS.find((entry) => entry.id === pickerRegionId) ?? null
    : null;
  const pickerKeyword = pickerSearch.trim().toLowerCase();
  const pickerCandidates = pickerRegion
    ? collectionOwnedIds
      .map((pokemonId) => ({ pokemonId, snapshot: snapshotById[pokemonId] }))
      .filter(({ pokemonId, snapshot }) => {
        if (!snapshot) return false;
        if (pickerKeyword.length === 0) return true;
        const name = getSnapshotDisplayName(snapshot).toLowerCase();
        return name.includes(pickerKeyword) || String(pokemonId).includes(pickerKeyword);
      })
      .sort((a, b) => {
        const aMatches = pickerRegion.requiredTypes.some((type) => a.snapshot.types.includes(type)) ? 1 : 0;
        const bMatches = pickerRegion.requiredTypes.some((type) => b.snapshot.types.includes(type)) ? 1 : 0;
        if (aMatches !== bMatches) return bMatches - aMatches;
        return a.pokemonId - b.pokemonId;
      })
    : [];

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
              onClick={enterBase}
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

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {EVENT_REGIONS.map((region, index) => {
            const dispatch = eventDispatches[region.id];
            const readyAt = dispatch?.readyAt ?? null;
            const isRunning = dispatch?.status === 'RUNNING' && readyAt !== null && readyAt > now;
            const canResolve = dispatch?.status === 'READY' || (dispatch?.status === 'RUNNING' && readyAt !== null && readyAt <= now);
            const cardBackground = REGION_CARD_BACKGROUNDS[index % REGION_CARD_BACKGROUNDS.length];
            const selectedPokemonId = eventDispatchPokemonByRegion[region.id] ?? null;
            const selectedSnapshot = selectedPokemonId ? snapshotById[selectedPokemonId] : undefined;
            const selectedName = selectedSnapshot ? getSnapshotDisplayName(selectedSnapshot) : (isZh ? '未选择' : 'Not selected');
            const matchCount = getMatchedTypeCount(region.id, selectedPokemonId);
            const matches = selectedPokemonId !== null && selectedSnapshot ? matchCount > 0 : false;

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

                <div className="mt-2 rounded-lg border border-slate-200 bg-white/85 p-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={selectedPokemonId ? (selectedSnapshot?.sprite || getPokemonSpriteUrl(selectedPokemonId)) : getPokemonSpriteUrl(25)}
                      alt=""
                      aria-hidden="true"
                      className={`h-8 w-8 rounded border border-slate-200 bg-white object-contain ${selectedPokemonId ? '' : 'opacity-40'}`}
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-black text-slate-700">
                        {selectedPokemonId ? `${selectedName} #${selectedPokemonId}` : (isZh ? '未选择派遣宝可梦' : 'No dispatched Pokemon selected')}
                      </p>
                      <p className={`text-[10px] font-bold ${selectedPokemonId ? (matches ? 'text-emerald-700' : 'text-rose-600') : 'text-slate-400'}`}>
                        {selectedPokemonId
                          ? (matches
                            ? (isZh ? `已匹配地区属性（${matchCount}）` : `Region type matched (${matchCount})`)
                            : (isZh ? '属性不匹配该地区' : 'Type does not match region requirement'))
                          : (isZh ? '请选择一只图鉴已拥有的宝可梦' : 'Pick one owned Pokedex Pokemon')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => openPicker(region.id)}
                      className="rounded bg-slate-800 px-2 py-1 text-[10px] font-black text-white"
                    >
                      {isZh ? '选择' : 'Pick'}
                    </button>
                    <button
                      onClick={() => setEventDispatchPokemon(region.id, null)}
                      className="inline-flex items-center justify-center gap-1 rounded bg-slate-200 px-2 py-1 text-[10px] font-black text-slate-700"
                    >
                      <Trash2 size={11} />
                      {isZh ? '清除' : 'Clear'}
                    </button>
                    <button
                      onClick={() => pickRecommendedPokemon(region.id)}
                      disabled={pickerLoading || collectionOwnedIds.length === 0}
                      className="inline-flex items-center justify-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] font-black text-white disabled:opacity-50"
                    >
                      <Sparkles size={11} />
                      {isZh ? '推荐' : 'Auto'}
                    </button>
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

      <AnimatePresence>
        {pickerRegion && (
          <motion.div
            className="fixed inset-0 z-[145] flex items-end justify-center bg-slate-900/50 p-3 md:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePicker}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="w-full max-w-[760px] rounded-2xl border-2 border-slate-900 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {isZh ? `${pickerRegion.name} 派遣宝可梦` : `${pickerRegion.name} Dispatch Pokemon`}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    {isZh
                      ? `优先选择属性匹配：${pickerRegion.requiredTypes.join(' / ')}`
                      : `Type preferred: ${pickerRegion.requiredTypes.join(' / ')}`}
                  </p>
                </div>
                <button
                  onClick={closePicker}
                  className="rounded bg-slate-100 p-1.5 text-slate-700 hover:bg-slate-200"
                  aria-label={isZh ? '关闭选择器' : 'Close picker'}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="border-b border-slate-200 px-4 py-2.5">
                <input
                  value={pickerSearch}
                  onChange={(event) => setPickerSearch(event.target.value)}
                  placeholder={isZh ? '搜索名称 / 编号' : 'Search name / id'}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="max-h-[56vh] overflow-y-auto p-3">
                {pickerLoading && pickerCandidates.length === 0 && (
                  <div className="flex h-28 items-center justify-center text-sm font-semibold text-slate-500">
                    {isZh ? '加载图鉴数据中...' : 'Loading Pokedex snapshots...'}
                  </div>
                )}

                {!pickerLoading && pickerCandidates.length === 0 && (
                  <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                    {isZh ? '没有可选择的宝可梦。' : 'No available Pokemon.'}
                  </div>
                )}

                {pickerCandidates.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {pickerCandidates.map(({ pokemonId, snapshot }) => {
                      const match = pickerRegion.requiredTypes.some((type) => snapshot.types.includes(type));
                      const selectedPokemonId = eventDispatchPokemonByRegion[pickerRegion.id] ?? null;
                      const isSelected = selectedPokemonId === pokemonId;
                      return (
                        <button
                          key={`${pickerRegion.id}-${pokemonId}`}
                          onClick={() => {
                            setEventDispatchPokemon(pickerRegion.id, pokemonId);
                            closePicker();
                          }}
                          className={`rounded-lg border p-2 text-left transition-colors ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : match
                                ? 'border-emerald-200 bg-emerald-50/55 hover:border-emerald-400'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={snapshot.sprite || getPokemonSpriteUrl(pokemonId)}
                              alt=""
                              aria-hidden="true"
                              className="h-9 w-9 rounded border border-slate-200 bg-white object-contain"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-black text-slate-800">
                                {getSnapshotDisplayName(snapshot)} #{pokemonId}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1">
                                {snapshot.types.map((type) => {
                                  const TypeIcon = TYPE_ICONS[type];
                                  const color = TYPE_COLORS[type] ?? '#64748b';
                                  return TypeIcon ? (
                                    <span
                                      key={`${pokemonId}-${type}`}
                                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white"
                                      title={type}
                                    >
                                      <TypeIcon size={11} color={color} />
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                            <div className="shrink-0">
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white">
                                  <CheckCircle2 size={11} />
                                  {isZh ? '已选' : 'Selected'}
                                </span>
                              ) : match ? (
                                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
                                  {isZh ? '匹配' : 'Match'}
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">
                                  {isZh ? '可选' : 'Available'}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
