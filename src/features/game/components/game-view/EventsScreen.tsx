import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Sparkles, Trash2, UserPlus, X } from 'lucide-react';
import type { GameViewSectionProps } from './shared';
import { EVENT_REGIONS } from '../../config/events';
import { TYPE_COLORS, TYPE_ICONS } from '../../../../uiAppConstants';
import type { DexSnapshot } from '../../../../services/pokedexClient';
import { TYPE_ZH } from '../../../../constants';
import { useEventDisplaySnapshots } from '../../hooks/useEventDisplaySnapshots';
import { createEventDisplayActionGuard, isEventDisplayPage } from '../../utils/eventDisplaySnapshots';
import { getBaseEventCopy, getEventRegionName } from './baseEventCopy';
import './baseEventUi.css';
import { getPokemonSpriteUrl } from '../../../../services/pokeApiEndpoint';
import eventHpUpIcon from '../../../../assets/items/event-hp-up.png';
import eventBattleStatItemIcon from '../../../../assets/items/event-battle-stat-item.png';
import mapHoenn from '../../../../assets/maps/region-map-hoenn.png';
import mapKanto from '../../../../assets/maps/region-map-kanto.png';
import mapSevii123 from '../../../../assets/maps/region-map-sevii123.png';
import mapSevii45 from '../../../../assets/maps/region-map-sevii45.png';

const REGION_CARD_BACKGROUNDS = [mapKanto, mapHoenn, mapSevii123, mapSevii45];

// These icons sit on white circles; normal's global color remains white for badges.
function getEventTypeIconColor(type: string): string {
  return type === 'normal' ? '#64748b' : TYPE_COLORS[type] ?? '#64748b';
}

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

export function EventsScreen({ viewModel }: GameViewSectionProps) {
  const {
    devToolsAvailable,
    developerMode,
    currentLanguage,
    collectionOwnedIds,
    eventDispatches,
    eventDispatchPokemonByRegion,
    eventDispatchPopup,
    hasFactoryRunToResume,
    gameState,
    currentBaseTab,
    getLocalized,
    setEventDispatchPokemon,
    dispatchEventRegion,
    mockEventDispatchResult,
    closeEventDispatchPopup,
    enterBase,
  } = viewModel;

  const [now, setNow] = useState(() => Date.now());
  const [pickerRegionId, setPickerRegionId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [recommendation, setRecommendation] = useState<{ token: number; regionId: string; status: 'loading' | 'error' | 'empty' } | null>(null);
  const actionGuard = useRef(createEventDisplayActionGuard());
  const mounted = useRef(true);
  const contextKey = JSON.stringify([gameState, currentBaseTab, collectionOwnedIds.slice().sort((a, b) => a - b), Object.entries(eventDispatchPokemonByRegion).sort()]);
  const latest = useRef({ contextKey, hasFactoryRunToResume, gameState, currentBaseTab });
  latest.current = { contextKey, hasFactoryRunToResume, gameState, currentBaseTab };
  const selectedIds = Object.values(eventDispatchPokemonByRegion).filter((id): id is number => id !== null);
  const { records, ensure } = useEventDisplaySnapshots(pickerRegionId ? [...selectedIds, ...collectionOwnedIds] : selectedIds);
  const snapshotById: Record<number, DexSnapshot> = {};
  Object.keys(records).forEach((key) => {
    const id = Number(key);
    const record = records[id];
    if (record.phase === 'ready') snapshotById[id] = record.snapshot;
  });
  const pickerLoading = collectionOwnedIds.some((id) => !records[id] || records[id].phase === 'loading');
  const pickerFailedIds = collectionOwnedIds.filter((id) => records[id]?.phase === 'error');

  const isZh = currentLanguage.startsWith('zh');
  const copy = getBaseEventCopy(currentLanguage);
  const typeLabel = (type: string) => isZh ? TYPE_ZH[type] ?? type : type;

  const cancelRecommendation = () => {
    actionGuard.current.cancel();
    setRecommendation(null);
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; actionGuard.current.cancel(); };
  }, []);

  useEffect(() => {
    if (hasFactoryRunToResume) setPickerRegionId(null);
    actionGuard.current.cancel();
    setRecommendation(null);
  }, [hasFactoryRunToResume, contextKey, gameState, currentBaseTab]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const openPicker = (regionId: string) => {
    if (hasFactoryRunToResume) return;
    setPickerSearch('');
    setPickerRegionId(regionId);
  };

  const closePicker = () => {
    setPickerRegionId(null);
    setPickerSearch('');
  };

  const getSnapshotDisplayName = (snapshot: DexSnapshot | undefined) => {
    if (!snapshot) return copy.loading;
    const localized = getLocalized({
      name: snapshot.apiName,
      names: snapshot.names,
      zhName: snapshot.zhName,
    });
    return localized?.trim() || snapshot.apiName;
  };

  const pickRecommendedPokemon = async (regionId: string) => {
    if (hasFactoryRunToResume || !isEventDisplayPage(latest.current)) return;
    const region = EVENT_REGIONS.find((entry) => entry.id === regionId);
    if (!region || collectionOwnedIds.length === 0) return;

    const token = actionGuard.current.begin();
    const initialContext = contextKey;
    setRecommendation({ token, regionId, status: 'loading' });
    const loaded = await ensure(collectionOwnedIds, true);
    if (!mounted.current || !actionGuard.current.isCurrent(token, initialContext, latest.current.contextKey,
      latest.current.hasFactoryRunToResume || !isEventDisplayPage(latest.current))) {
      // A stale continuation may clear only its own spinner, never a newer recommendation.
      if (mounted.current) setRecommendation((current) => current?.token === token ? null : current);
      return;
    }
    if (collectionOwnedIds.some((id) => loaded[id]?.phase !== 'ready')) {
      setRecommendation({ token, regionId, status: 'error' });
      return;
    }
    const candidates = collectionOwnedIds.filter((pokemonId) => {
      const record = loaded[pokemonId];
      const snapshot = record?.phase === 'ready' ? record.snapshot : undefined;
      if (!snapshot) return false;
      return region.requiredTypes.some((requiredType) => snapshot.types.includes(requiredType));
    });

    if (candidates.length === 0) { setRecommendation({ token, regionId, status: 'empty' }); return; }
    const recommendedId = candidates[Math.floor(Math.random() * candidates.length)];
    if (!recommendedId) return;
    setRecommendation(null);
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
      className="pf-base-event-events flex-1 min-h-0 overflow-y-auto px-2 py-2 md:px-4 md:py-3"
    >
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-md space-y-3">
        <div className="pf-event-header flex items-center justify-between">
          <h2 className="text-xl font-black tracking-wide">{copy.eventTitle}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { cancelRecommendation(); enterBase(); }}
              className="text-xs font-black px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200"
            >
              {copy.back}
            </button>
          </div>
        </div>

        {hasFactoryRunToResume && (
          <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
            {copy.resumeWarning}
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
            const loadState = selectedPokemonId === null ? 'unselected' : records[selectedPokemonId]?.phase ?? 'loading';
            const selectedSnapshot = selectedPokemonId ? snapshotById[selectedPokemonId] : undefined;
            const selectedName = selectedSnapshot ? getSnapshotDisplayName(selectedSnapshot) : loadState === 'error' ? copy.loadFailed : copy.loading;
            const matchCount = getMatchedTypeCount(region.id, selectedPokemonId);
            const matches = selectedPokemonId !== null && selectedSnapshot ? matchCount > 0 : false;

            const buttonLabel = isRunning
              ? `${copy.running} ${formatRemain((readyAt ?? now) - now)}`
              : canResolve
                ? copy.claim
                : copy.dispatch;

            return (
              <div
                key={region.id}
                data-region-id={region.id}
                className="relative overflow-hidden rounded-xl border border-slate-200 p-2"
                style={{
                  backgroundImage: `linear-gradient(rgba(248,250,252,0.94), rgba(248,250,252,0.9)), url(${cardBackground})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black">{getEventRegionName(region, currentLanguage)}</p>
                  <div className="flex items-center gap-1.5">
                    {region.requiredTypes.map((type) => {
                      const TypeIcon = TYPE_ICONS[type];
                      const color = getEventTypeIconColor(type);
                      return TypeIcon ? (
                        <span
                          key={`${region.id}-${type}`}
                          title={typeLabel(type)}
                          aria-label={typeLabel(type)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white"
                        >
                          <TypeIcon size={14} color={color} />
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>

                <p className="mt-1 text-[10px] font-semibold text-slate-600">{copy.duration}: {region.dispatchHours} {copy.hours}</p>
                <div data-selected-id={selectedPokemonId ?? ''} data-load-state={loadState} className="mt-2 rounded-lg border border-slate-200 bg-white/85 p-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={selectedPokemonId ? (selectedSnapshot?.sprite || getPokemonSpriteUrl(selectedPokemonId)) : getPokemonSpriteUrl(25)}
                      alt=""
                      aria-hidden="true"
                      className={`h-8 w-8 rounded border border-slate-200 bg-white object-contain ${selectedPokemonId ? '' : 'opacity-40'}`}
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="pf-event-selected-name text-[11px] font-black text-slate-700">
                        {selectedPokemonId ? `${selectedName} #${selectedPokemonId}` : copy.noSelection}
                      </p>
                      {selectedSnapshot && <p className="text-[10px] text-slate-600">{selectedSnapshot.types.map(typeLabel).join(' / ')}</p>}
                      <p role="status" className={`text-[10px] font-bold ${loadState === 'ready' ? (matches ? 'text-emerald-700' : 'text-rose-600') : 'text-slate-500'}`}>
                        {loadState === 'unselected' ? copy.chooseOwned
                          : loadState === 'loading' ? copy.loadingDetails
                          : loadState === 'error' ? copy.unknownEligibility
                          : matches ? `${copy.matched} (${matchCount})` : copy.mismatch}
                      </p>
                      {loadState === 'error' && selectedPokemonId !== null && (
                        <button type="button" onClick={() => void ensure([selectedPokemonId], true)} className="mt-1 rounded border border-slate-300 px-3 py-2 text-xs font-bold">{copy.retry}</button>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => openPicker(region.id)}
                      disabled={hasFactoryRunToResume}
                      className="rounded bg-slate-800 px-2 py-1 text-[10px] font-black text-white"
                    >
                      {copy.pick}
                    </button>
                    <button
                      onClick={() => { cancelRecommendation(); setEventDispatchPokemon(region.id, null); }}
                      disabled={hasFactoryRunToResume}
                      className="inline-flex items-center justify-center gap-1 rounded bg-slate-200 px-2 py-1 text-[10px] font-black text-slate-700"
                    >
                      <Trash2 size={11} />
                      {copy.clear}
                    </button>
                    <button
                      onClick={() => void pickRecommendedPokemon(region.id)}
                      disabled={hasFactoryRunToResume || collectionOwnedIds.length === 0 || recommendation?.status === 'loading'}
                      className="inline-flex items-center justify-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] font-black text-white disabled:opacity-50"
                    >
                      <Sparkles size={11} />
                      {recommendation?.regionId === region.id && recommendation.status === 'loading' ? copy.loading : copy.auto}
                    </button>
                  </div>
                  {recommendation?.regionId === region.id && recommendation.status !== 'loading' && (
                    <p role="status" className="mt-2 text-xs text-slate-700">{recommendation.status === 'error' ? copy.autoFailed : copy.noMatch}</p>
                  )}
                </div>

                <button
                  onClick={() => void dispatchEventRegion(region.id)}
                  disabled={hasFactoryRunToResume || isRunning}
                  className="mt-2 w-full px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-black disabled:opacity-50"
                >
                  {buttonLabel}
                </button>

                {dispatch?.lastResult && (
                  <p className="pf-event-result-text mt-1 text-[10px] font-semibold text-slate-600">
                    {dispatch.lastResult}
                  </p>
                )}

                {devToolsAvailable && developerMode && (
                  <div className="mt-1 grid grid-cols-3 gap-1">
                    <button
                      onClick={() => mockEventDispatchResult(region.id, 'item')}
                      disabled={hasFactoryRunToResume}
                      className="px-1.5 py-1 rounded bg-emerald-600 text-white text-[10px] font-black"
                    >
                      {copy.devItem}
                    </button>
                    <button
                      onClick={() => mockEventDispatchResult(region.id, 'join')}
                      disabled={hasFactoryRunToResume}
                      className="px-1.5 py-1 rounded bg-sky-600 text-white text-[10px] font-black"
                    >
                      {copy.devJoin}
                    </button>
                    <button
                      onClick={() => mockEventDispatchResult(region.id, 'battle_special')}
                      disabled={hasFactoryRunToResume}
                      className="px-1.5 py-1 rounded bg-amber-600 text-white text-[10px] font-black"
                    >
                      {copy.devSpecial}
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
              role="dialog"
              aria-modal="true"
              aria-label={eventDispatchPopup.title}
              className="pf-event-modal w-[min(86vw,320px)] rounded-2xl border-4 border-slate-900 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex justify-end p-2">
                <button type="button" onClick={closeEventDispatchPopup} aria-label={copy.closeResult} className="rounded bg-slate-100 p-2"><X size={18} /></button>
              </div>
              {eventDispatchPopup.kind === 'ITEM' ? (
                <>
                  <div className="flex aspect-square items-center justify-center">
                    <img
                      src={getEventItemIcon(eventDispatchPopup.itemId)}
                      alt={eventDispatchPopup.itemName}
                      className="h-24 w-24 object-contain drop-shadow-[0_8px_14px_rgba(5,150,105,0.22)] [image-rendering:pixelated]"
                    />
                  </div>
                  <div className="px-4 pb-4 text-center">
                    <p className="text-[13px] font-black leading-tight text-emerald-800">
                      {copy.receivedItem}: {eventDispatchPopup.itemName}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-snug text-slate-600">
                      {eventDispatchPopup.message}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex aspect-square items-center justify-center">
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
                  <div className="px-4 pb-4 text-center">
                    <p className="text-[13px] font-black leading-tight text-sky-800">
                      {eventDispatchPopup.message || `${eventDispatchPopup.pokemonName} — ${copy.joined}`}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      Lv.{eventDispatchPopup.pokemonLevel}
                    </p>
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
              role="dialog"
              aria-modal="true"
              aria-labelledby="event-picker-title"
              className="pf-event-modal w-full max-w-[760px] rounded-2xl border-2 border-slate-900 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <p id="event-picker-title" className="text-sm font-black text-slate-900">
                    {getEventRegionName(pickerRegion, currentLanguage)} — {copy.dispatchPokemon}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    {copy.requiredTypes}: {pickerRegion.requiredTypes.map(typeLabel).join(' / ')}
                  </p>
                </div>
                <button
                  onClick={closePicker}
                  className="rounded bg-slate-100 p-1.5 text-slate-700 hover:bg-slate-200"
                  aria-label={copy.closePicker}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="border-b border-slate-200 px-4 py-2.5">
                <input
                  value={pickerSearch}
                  onChange={(event) => setPickerSearch(event.target.value)}
                  placeholder={copy.search}
                  aria-label={copy.search}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="max-h-[56vh] overflow-y-auto p-3">
                {pickerLoading && (
                  <div role="status" className="flex min-h-16 items-center justify-center text-sm font-semibold text-slate-500">
                    {copy.loadingDex}
                  </div>
                )}

                {pickerFailedIds.length > 0 && (
                  <div role="status" className="mb-2 rounded-lg border border-amber-300 p-2 text-sm">
                    <p>{copy.missingDetails} ({pickerFailedIds.length})</p>
                    <button type="button" onClick={() => void ensure(pickerFailedIds, true)} className="mt-1 rounded border border-slate-300 px-3 py-2 font-bold">{copy.retry}</button>
                  </div>
                )}

                {!pickerLoading && pickerFailedIds.length === 0 && pickerCandidates.length === 0 && (
                  <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                    {collectionOwnedIds.length === 0 ? copy.noOwned : copy.noSearchResults}
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
                            if (hasFactoryRunToResume) return;
                            cancelRecommendation();
                            setEventDispatchPokemon(pickerRegion.id, pokemonId);
                            closePicker();
                          }}
                          disabled={hasFactoryRunToResume}
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
                              <p className="pf-event-selected-name text-xs font-black text-slate-800">
                                {getSnapshotDisplayName(snapshot)} #{pokemonId}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1">
                                {snapshot.types.map((type) => {
                                  const TypeIcon = TYPE_ICONS[type];
                                  const color = getEventTypeIconColor(type);
                                  return TypeIcon ? (
                                    <span
                                      key={`${pokemonId}-${type}`}
                                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white"
                                      title={typeLabel(type)}
                                      aria-label={typeLabel(type)}
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
                                  {copy.selected}
                                </span>
                              ) : match ? (
                                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
                                  {copy.match}
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">
                                  {copy.available}
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
