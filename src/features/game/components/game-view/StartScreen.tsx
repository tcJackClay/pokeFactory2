import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Dna, Languages, Lock, Settings2, Store, Swords } from 'lucide-react';
import type { BaseTab } from '../../view-model';
import { EVENT_REGIONS } from '../../config/events';
import type { GameViewSectionProps } from './shared';
import companionAnimSprite from '../../../../assets/menu/pikachu-anim-front.png';
import pokedexMenuIcon from '../../../../assets/menu/pokedex.png';
import eventsMenuIcon from '../../../../assets/menu/clipboard.png';
import { APP_PALETTE } from '../../../../theme/palette';
import { getCompanionCandidate } from '../../config/companionCandidates';
import { getPokemonOfficialArtworkUrl, getPokemonSpriteUrl } from '../../../../services/pokeApiEndpoint';

type StartMenu = BaseTab | 'SETTINGS';
type DockState = 'locked' | 'soon' | 'ready';

interface StartNavItem {
  menu: StartMenu;
  label: string;
  badge?: string;
  locked?: boolean;
  implemented?: boolean;
}

export function StartScreen({ viewModel }: GameViewSectionProps) {
  const {
    loading,
    rentalLoadError,
    availableEggCount,
    eventDispatches,
    shopUnlocked,
    breedingUnlocked,
    collectionUnlocked,
    eventsUnlocked,
    pendingRunSummary,
    closeRunSummary,
    hasFactoryRunToResume,
    startOrResumeFactoryFromBase,
    endPausedFactoryRun,
    openBaseTab,
    setGameState,
    currentLanguage,
    companionSpeciesId,
  } = viewModel;

  const shouldReduceMotion = useReducedMotion();
  const [companionFrame, setCompanionFrame] = useState(0);
  const [companionImageFallback, setCompanionImageFallback] = useState(false);
  const [confirmEndRun, setConfirmEndRun] = useState(false);
  const [endRunError, setEndRunError] = useState(false);
  const isZh = currentLanguage.startsWith('zh');
  const companion = companionSpeciesId === null ? null : getCompanionCandidate(companionSpeciesId);
  const companionName = companion ? (isZh ? companion.zhName : companion.enName) : '';

  const readyEventCount = EVENT_REGIONS.reduce((total, region) => {
    const dispatch = eventDispatches[region.id];
    if (!dispatch) return total;
    const isReady = (dispatch.status === 'READY' || dispatch.status === 'RUNNING') && dispatch.readyAt !== null && dispatch.readyAt <= Date.now();
    return total + (isReady ? 1 : 0);
  }, 0);

  const copy = useMemo(
    () => ({
      factoryTitle: isZh ? '对战工厂' : 'Battle Factory',
      factoryState: hasFactoryRunToResume
        ? (isZh ? '继续当前挑战' : 'Resume current run')
        : (isZh ? '开始下一轮挑战' : 'Start next run'),
      primaryAction: loading
        ? (isZh ? '载入中' : 'Loading')
        : rentalLoadError
          ? (isZh ? '重试载入' : 'Retry loading')
        : hasFactoryRunToResume
          ? (isZh ? '继续挑战' : 'Resume Run')
          : (isZh ? '开始挑战' : 'Start Run'),
      hide: isZh ? '收起' : 'Hide',
      setCleared: isZh ? '组别通关' : 'Set Cleared',
      runEnded: isZh ? '挑战结束' : 'Run Ended',
      tokens: 'BP',
      standby: hasFactoryRunToResume ? (isZh ? '继续中' : 'Resume') : (isZh ? '待命' : 'Standby'),
      events: isZh ? '事件' : 'Events',
      shop: isZh ? '商店' : 'Shop',
      breeding: isZh ? '培育' : 'Breed',
      collection: isZh ? '图鉴' : 'Collection',
      settings: isZh ? '设置' : 'Settings',
    }),
    [hasFactoryRunToResume, isZh, loading, rentalLoadError],
  );
  useEffect(() => {
    if (shouldReduceMotion || companionSpeciesId !== 25) {
      setCompanionFrame(0);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCompanionFrame((prev) => (prev + 1) % 2);
    }, 420);

    return () => window.clearInterval(timer);
  }, [companionSpeciesId, shouldReduceMotion]);

  useEffect(() => { setCompanionImageFallback(false); }, [companionSpeciesId]);

  const navItems: StartNavItem[] = [
    { menu: 'SHOP', label: copy.shop, locked: !shopUnlocked, implemented: false },
    {
      menu: 'BREEDING',
      label: copy.breeding,
      badge: availableEggCount > 0 ? `${availableEggCount}` : undefined,
      locked: !breedingUnlocked,
      implemented: false,
    },
    { menu: 'COLLECTION', label: copy.collection, locked: !collectionUnlocked, implemented: true },
    {
      menu: 'EVENTS',
      label: copy.events,
      badge: readyEventCount > 0 ? `${readyEventCount}` : undefined,
      locked: !eventsUnlocked,
      implemented: true,
    },
    { menu: 'SETTINGS', label: copy.settings, implemented: true },
  ];

  const screenInitial = shouldReduceMotion ? false : { opacity: 0, y: 12 };
  const screenExit = shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 };
  const companionAnimate = shouldReduceMotion ? undefined : { y: [0, -5, 0], rotate: [0, -2, 0, 2, 0] };

  return (
    <motion.div
      key="start"
      initial={screenInitial}
      animate={{ opacity: 1, y: 0 }}
      exit={screenExit}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.24, ease: 'easeOut' }}
      className="pf-start-screen pf-scroll-y flex min-h-0 flex-1 flex-col md:overflow-hidden"
    >
      <section className="pf-start-layout flex min-h-0 flex-1 flex-col gap-2 md:gap-3">
        {pendingRunSummary?.visible && (
          <div className="px-3">
            <div className="pf-panel border-emerald-200 bg-emerald-50/90 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-emerald-200 bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                    {pendingRunSummary.result === 'WIN' ? copy.setCleared : copy.runEnded}
                  </span>
                  <p className="text-sm font-black text-emerald-900">
                    +{pendingRunSummary.tokenGain} {copy.tokens}
                  </p>
                </div>

                <button
                  onClick={closeRunSummary}
                  className="rounded-full border border-emerald-200 bg-white/[0.80] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-white"
                >
                  {copy.hide}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="pf-start-hero-region min-h-0 flex-1 px-3">
          <div className="pf-home-hero relative flex h-full min-h-0 flex-col px-4 py-4 md:px-6 md:py-5">
            <div className="pointer-events-none absolute right-4 top-4 z-10">
              <span className="pf-status-pill text-[11px] font-black">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: hasFactoryRunToResume ? APP_PALETTE.accent.cta : APP_PALETTE.accent.primary }}
                />
                {copy.standby}
              </span>
            </div>

            <div className="relative z-10 flex h-full min-h-0 flex-col">
              <div className="pf-start-hero-content flex flex-1 flex-col items-center justify-center text-center">
                <div className="pf-start-copy">
                  <h1 className={`font-black text-slate-950 ${isZh ? 'text-[34px]' : 'text-[32px] uppercase tracking-[0.06em]'}`}>
                    {copy.factoryTitle}
                  </h1>
                  <p className="mt-2 text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                    {copy.factoryState}
                  </p>
                </div>

                <motion.button
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                  onClick={() => void startOrResumeFactoryFromBase()}
                  disabled={loading}
                  className="pf-start-primary-orb pf-primary-orb relative mt-6 flex h-44 w-44 items-center justify-center rounded-full disabled:opacity-70 md:h-52 md:w-52"
                  aria-label={copy.primaryAction}
                >
                  <span className="absolute inset-0 rounded-full bg-white/40" />
                  <span className="relative z-10 flex flex-col items-center gap-3">
                    <Swords className="h-16 w-16 text-blue-600 md:h-20 md:w-20" />
                    <span className="rounded-full border border-white/[0.80] bg-white/[0.74] px-3 py-1 text-[10px] font-black text-slate-700 shadow-sm">
                      {copy.primaryAction}
                    </span>
                  </span>
                  </motion.button>
                  {rentalLoadError && (
                    <p role="alert" className="mt-3 max-w-xs rounded-lg border border-rose-300 bg-white/95 px-3 py-2 text-xs font-bold text-rose-900">
                      {isZh ? rentalLoadError : 'Rental data could not load in time. Check your connection and tap Start to retry.'}
                    </p>
                  )}
                  {hasFactoryRunToResume && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => { setEndRunError(false); setConfirmEndRun(true); }}
                      className="mt-3 rounded-lg border border-rose-300 bg-white/90 px-4 py-2 text-xs font-black text-rose-800 disabled:opacity-50"
                    >
                      {isZh ? '结束当前连胜' : 'End current streak'}
                    </button>
                  )}
                  {endRunError && (
                    <p role="alert" className="mt-2 text-xs font-bold text-rose-800">
                      {isZh ? '保存失败，连胜仍可继续。请重试。' : 'Save failed. Your streak can still be resumed. Please retry.'}
                    </p>
                  )}
                </div>

              <div className="pf-start-companion pointer-events-none absolute bottom-5 left-4 z-10 md:bottom-6 md:left-6">
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, x: -10, y: 10 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0.01 : 0.32 }}
                  className="relative"
                >
                  <motion.div
                    animate={companionAnimate}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative"
                  >
                    <div className="h-[80px] w-[80px] overflow-hidden md:h-[88px] md:w-[88px]">
                      {companionSpeciesId === 25 ? (
                        <img
                          src={companionAnimSprite}
                          alt=""
                          aria-hidden="true"
                          className="h-auto w-[80px] drop-shadow-[0_10px_14px_rgba(0,0,0,0.18)] md:w-[88px]"
                          style={{
                            transform: `translateY(-${companionFrame * 50}%)`,
                            transition: shouldReduceMotion ? undefined : 'transform 120ms steps(1)',
                          }}
                        />
                      ) : companionSpeciesId !== null ? (
                        <img
                          src={companionImageFallback ? getPokemonSpriteUrl(companionSpeciesId) : getPokemonOfficialArtworkUrl(companionSpeciesId)}
                          onError={() => setCompanionImageFallback(true)}
                          alt=""
                          aria-hidden="true"
                          className="h-full w-full object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.18)]"
                        />
                      ) : null}
                    </div>
                  </motion.div>
                  <span className="mt-1 block rounded-full bg-white/90 px-2 py-0.5 text-center text-xs font-black text-slate-800 shadow-sm">
                    {isZh ? '伙伴：' : 'Companion: '}{companionName}
                  </span>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {confirmEndRun && hasFactoryRunToResume && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4" role="presentation">
            <div role="alertdialog" aria-modal="true" aria-labelledby="end-factory-run-title" className="w-full max-w-sm rounded-2xl border border-slate-300 bg-white p-5 shadow-2xl">
              <h2 id="end-factory-run-title" className="text-lg font-black text-slate-950">
                {isZh ? '结束当前连胜？' : 'End current streak?'}
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                {isZh ? '当前挑战将无法继续。已获得的 BP 会保留；下一组尚未开始，不会额外结算。' : 'You cannot resume this run. Earned BP stays; no new set is settled.'}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmEndRun(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold">
                  {isZh ? '取消' : 'Cancel'}
                </button>
                <button type="button" onClick={() => {
                  if (endPausedFactoryRun()) setConfirmEndRun(false);
                  else { setEndRunError(true); setConfirmEndRun(false); }
                }} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-bold text-white">
                  {isZh ? '确认结束' : 'Confirm end'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="pf-start-dock-region px-3 pb-2">
          <div className="pf-dock px-2 py-2">
            <div className="grid grid-cols-3 gap-1.5 min-[520px]:grid-cols-5 md:gap-2">
              {navItems.map((item) => {
                const isLocked = Boolean(item.locked);
                const state: DockState = isLocked ? 'locked' : item.implemented ? 'ready' : 'soon';
                const isInteractive = state === 'ready';
                const Icon =
                  item.menu === 'SHOP'
                    ? Store
                    : item.menu === 'BREEDING'
                      ? Dna
                      : item.menu === 'SETTINGS'
                        ? Settings2
                        : Languages;

                return (
                  <button
                    key={item.menu}
                    type="button"
                    data-state={state}
                    disabled={!isInteractive}
                    title={state === 'soon' ? copy.menuDeveloping : undefined}
                    onClick={() => {
                      if (item.menu === 'SETTINGS') {
                        setGameState('SETTINGS');
                        return;
                      }

                      if (item.menu === 'COLLECTION') {
                        openBaseTab('COLLECTION');
                        return;
                      }

                      if (item.menu === 'EVENTS') {
                        openBaseTab('EVENTS');
                        return;
                      }
                    }}
                    className="pf-dock-button relative flex min-h-[74px] flex-col items-center justify-center gap-1 px-1.5 py-2 text-center"
                  >
                    <span className="absolute right-1.5 top-1.5 flex items-center gap-1">
                      {isLocked && <Lock className="h-3.5 w-3.5 text-slate-400" />}
                      {item.badge && !isLocked && (
                        <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm">
                          {item.badge}
                        </span>
                      )}
                    </span>

                    {item.menu === 'COLLECTION' ? (
                      <img
                        src={pokedexMenuIcon}
                        alt=""
                        aria-hidden="true"
                        className="h-8 w-8 object-contain [image-rendering:pixelated]"
                      />
                    ) : item.menu === 'EVENTS' ? (
                      <img
                        src={eventsMenuIcon}
                        alt=""
                        aria-hidden="true"
                        className="h-8 w-8 object-contain [image-rendering:pixelated]"
                      />
                    ) : (
                      <Icon className="h-[18px] w-[18px] text-slate-700" />
                    )}

                    <span className="text-[10px] font-black text-slate-700">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
