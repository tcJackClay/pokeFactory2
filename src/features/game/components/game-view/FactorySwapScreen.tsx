import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Dna, Info, Swords } from 'lucide-react';
import TypeBadge from '../../../../components/TypeBadge';
import type { GameViewSectionProps } from './shared';
import type { GamePokemon } from '../../../../types';

function PokeballIndicator({ active, compact = false }: { active: boolean; compact?: boolean }) {
  const shellSize = compact ? 'h-4 w-4' : 'h-5 w-5';
  const centerSize = compact ? 'h-1.5 w-1.5' : 'h-2 w-2';

  return (
    <span
      className={`relative block overflow-hidden rounded-full border border-slate-500 ${shellSize} ${
        active ? 'shadow-[0_0_0_2px_rgba(37,99,235,0.16)]' : 'opacity-[0.65]'
      }`}
      aria-hidden="true"
    >
      <span className={`${active ? 'bg-red-500' : 'bg-slate-300'} absolute left-0 top-0 h-1/2 w-full`} />
      <span className="absolute bottom-0 left-0 h-1/2 w-full bg-white" />
      <span className="absolute left-0 top-1/2 h-[1px] w-full -translate-y-1/2 bg-slate-700" />
      <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-700 bg-white ${centerSize}`} />
    </span>
  );
}

function SwapSelectionCard({
  localizedName,
  pokemon,
  isSelected,
  accent,
  badgeLabel,
  onClick,
  onOpenDetails,
}: {
  key?: string;
  localizedName: string;
  pokemon: GamePokemon;
  isSelected: boolean;
  accent: 'player' | 'enemy';
  badgeLabel: string;
  onClick: () => void;
  onOpenDetails: () => void;
}) {
  const isPlayer = accent === 'player';
  const accentRing = isPlayer ? 'rgba(37,99,235,0.16)' : 'rgba(239,68,68,0.16)';
  const accentRibbon = isPlayer
    ? 'bg-[linear-gradient(180deg,#3b82f6_0%,#2563eb_100%)]'
    : 'bg-[linear-gradient(180deg,#ef4444_0%,#dc2626_100%)]';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      data-selected={isSelected ? 'true' : 'false'}
      onClick={onClick}
      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className="pf-battle-card group relative aspect-[1.18] p-1.5 cursor-pointer"
      style={isSelected ? { boxShadow: `0 0 0 2px ${accentRing}, var(--pf-shadow-raised)` } : undefined}
    >
      {isSelected && (
        <div className={`pf-battle-ribbon ${accentRibbon}`}>
          <span className="inline-block skew-x-[10deg]">{badgeLabel}</span>
        </div>
      )}

      <div className="absolute right-1.5 top-1.5 z-20">
        <PokeballIndicator active={isSelected} />
      </div>

      <div className="absolute left-1.5 top-1/2 z-20 -translate-y-1/2">
        <div className="flex flex-col items-start gap-1">
          {pokemon.types.map((typeSlot) => (
            <TypeBadge key={`${pokemon.id}-${typeSlot.type.name}`} type={typeSlot.type.name} size="xs" />
          ))}
        </div>
      </div>

      <div className="absolute right-1.5 top-1/2 z-20 -translate-y-1/2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenDetails();
          }}
          aria-label="View details"
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white/[0.96] text-slate-700 shadow-[0_8px_14px_rgba(15,23,42,0.10)] transition-colors hover:bg-slate-50"
        >
          <Info className="h-3 w-3" />
        </button>
      </div>

      <div className="relative z-10 flex h-full flex-col items-center justify-between gap-1 px-2 pb-1 pt-4">
        <div className="flex min-h-[26px] w-full items-start justify-center px-8 text-center">
          <h3 className={`line-clamp-2 leading-tight text-slate-950 ${localizedName.length > 12 ? 'text-[12px] font-black' : 'text-[13px] font-black'}`}>
            {localizedName}
          </h3>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <img
            src={pokemon.sprites.front_default}
            alt={pokemon.name}
            className="h-[112px] w-[112px] object-contain drop-shadow-[0_14px_16px_rgba(15,23,42,0.18)] transition-transform duration-200 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="flex min-h-[22px] items-center justify-center px-3 text-center">
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
              isPlayer
                ? isSelected
                  ? 'border-blue-200 bg-blue-100 text-blue-700'
                  : 'border-blue-100 bg-blue-50 text-blue-500'
                : isSelected
                  ? 'border-red-200 bg-red-100 text-red-700'
                  : 'border-red-100 bg-red-50 text-red-500'
            }`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

export function FactorySwapScreen({ viewModel }: GameViewSectionProps) {
  const {
    playerTeam,
    enemyTeam,
    currentLanguage,
    gameState,
    loading,
    isTransitioning,
    t,
    getLocalized,
    performSwap,
    nextFactoryStage,
    setInfoPokemonIdx,
    setInfoPokemonSource,
    setPrevGameState,
    setGameState,
  } = viewModel;
  const shouldReduceMotion = useReducedMotion();
  const isZh = currentLanguage.startsWith('zh');
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState<number | null>(0);
  const [selectedEnemyIndex, setSelectedEnemyIndex] = useState<number | null>(null);

  const selectedPlayer = selectedPlayerIndex !== null ? playerTeam[selectedPlayerIndex] ?? null : null;
  const selectedEnemy = selectedEnemyIndex !== null ? enemyTeam[selectedEnemyIndex] ?? null : null;
  const canConfirmSwap = selectedPlayerIndex !== null && selectedEnemyIndex !== null && !loading && !isTransitioning;

  const copy = {
    titleHint: isZh ? '\u5148\u9009\u62e9\u6211\u65b9\u5b9d\u53ef\u68a6\uff0c\u518d\u9009\u62e9\u4e00\u53ea\u5bf9\u624b\u5b9d\u53ef\u68a6\u5b8c\u6210\u4ea4\u6362\u3002' : 'Choose one of your Pokemon, then choose one opponent Pokemon to swap.',
    myTeam: isZh ? '\u6211\u7684\u961f\u4f0d' : 'My Team',
    enemyTeam: isZh ? '\u5bf9\u624b\u961f\u4f0d' : 'Opponent Team',
    currentPick: isZh ? '\u5f53\u524d\u9009\u62e9' : 'Current Pick',
    targetPick: isZh ? '\u4ea4\u6362\u76ee\u6807' : 'Swap Target',
    pending: isZh ? '\u672a\u9009\u62e9' : 'Not Selected',
    ready: isZh ? '\u53ef\u4ea4\u6362' : 'Ready',
    waiting: isZh ? '\u5f85\u9009\u62e9' : 'Waiting',
    confirm: isZh ? '\u786e\u8ba4\u4ea4\u6362' : 'Confirm Swap',
    chooseMine: isZh ? '\u9009\u6211\u65b9' : 'Pick Yours',
    chooseTarget: isZh ? '\u9009\u5bf9\u624b' : 'Pick Target',
    chosenMine: isZh ? '\u6211\u7684\u5df2\u9009' : 'Your Pick',
    chosenTarget: isZh ? '\u76ee\u6807\u5df2\u9009' : 'Target Pick',
    viewDetails: isZh ? '\u67e5\u770b\u8be6\u60c5' : 'View Details',
  };

  const openPokemonDetails = (index: number, source: 'PLAYER' | 'ENEMY') => {
    setInfoPokemonIdx(index);
    setInfoPokemonSource(source);
    setPrevGameState(gameState);
    setGameState('POKEMON_INFO');
  };

  return (
    <motion.div
      key="factory-swap"
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.24, ease: 'easeOut' }}
      className="pf-scroll-y relative flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2 md:overflow-hidden md:px-3 md:py-3"
    >
      <div className="mb-2 px-1 md:mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-slate-200 bg-white/80 px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-black italic tracking-tight text-slate-950 md:text-xl">{t('factorySwap')}</h2>
          <p className="text-[11px] font-bold text-slate-500 md:text-xs">{copy.titleHint}</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-1 py-1">
          <div className="grid min-h-full gap-3 md:grid-cols-2">
            <section className="pf-panel flex min-h-0 flex-col overflow-hidden px-3 py-3 md:px-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-xl font-black italic">
                  <Dna className="h-6 w-6 text-blue-500" /> {copy.myTeam}
                </h3>
                <span className="pf-status-pill text-[11px] font-black">
                  <span className="text-blue-600">{selectedPlayer ? copy.ready : copy.waiting}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                {playerTeam.map((pokemon, index) => (
                  <SwapSelectionCard
                    key={`${pokemon.id}-${index}`}
                    localizedName={getLocalized(pokemon)}
                    pokemon={pokemon}
                    isSelected={selectedPlayerIndex === index}
                    accent="player"
                    badgeLabel={selectedPlayerIndex === index ? copy.chosenMine : copy.chooseMine}
                    onClick={() => {
                      setSelectedPlayerIndex((prev) => (prev === index ? null : index));
                    }}
                    onOpenDetails={() => {
                      openPokemonDetails(index, 'PLAYER');
                    }}
                  />
                ))}
              </div>
            </section>

            <section className="pf-panel flex min-h-0 flex-col overflow-hidden px-3 py-3 md:px-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-xl font-black italic">
                  <Swords className="h-6 w-6 text-red-500" /> {copy.enemyTeam}
                </h3>
                <span className="pf-status-pill text-[11px] font-black">
                  <span className="text-red-600">{selectedEnemy ? copy.ready : copy.waiting}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                {enemyTeam.map((pokemon, index) => (
                  <SwapSelectionCard
                    key={`${pokemon.id}-${index}`}
                    localizedName={getLocalized(pokemon)}
                    pokemon={pokemon}
                    isSelected={selectedEnemyIndex === index}
                    accent="enemy"
                    badgeLabel={selectedEnemyIndex === index ? copy.chosenTarget : copy.chooseTarget}
                    onClick={() => {
                      setSelectedEnemyIndex((prev) => (prev === index ? null : index));
                    }}
                    onOpenDetails={() => {
                      openPokemonDetails(index, 'ENEMY');
                    }}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="px-1 pt-2">
        <div className="pf-command-bar">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <div className="min-w-0 flex-1 rounded-[14px] border border-slate-200 bg-white/[0.92] px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{copy.currentPick}</div>
                  <div className="mt-1 truncate text-[13px] font-black text-slate-900">
                    {selectedPlayer ? getLocalized(selectedPlayer) : copy.pending}
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>

                <div className="min-w-0 flex-1 rounded-[14px] border border-slate-200 bg-white/[0.92] px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{copy.targetPick}</div>
                  <div className="mt-1 truncate text-[13px] font-black text-slate-900">
                    {selectedEnemy ? getLocalized(selectedEnemy) : copy.pending}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 min-[420px]:flex-row md:min-w-[240px]">
              <button
                type="button"
                disabled={loading || isTransitioning}
                onClick={nextFactoryStage}
                className="min-h-[46px] flex-1 rounded-[16px] border border-slate-200 bg-slate-200 px-4 py-2.5 text-sm font-black uppercase tracking-[0.14em] text-slate-600 transition-all enabled:hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60 md:px-5"
              >
                {t('skipSwap')}
              </button>

              <button
                type="button"
                disabled={!canConfirmSwap}
                onClick={() => {
                  if (!canConfirmSwap) return;
                  performSwap(selectedPlayerIndex, selectedEnemyIndex);
                }}
                className={`min-h-[46px] flex-1 rounded-[16px] border px-4 py-2.5 text-sm font-black uppercase tracking-[0.14em] transition-all md:px-5 ${
                  canConfirmSwap
                    ? 'border-orange-300 bg-orange-500 text-white shadow-[0_18px_28px_rgba(249,115,22,0.26)] hover:bg-orange-600'
                    : 'border-slate-200 bg-slate-200 text-slate-400'
                }`}
              >
                {copy.confirm}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
