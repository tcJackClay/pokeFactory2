import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Fragment, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Info, Swords } from 'lucide-react';
import TypeBadge from '../../../../components/TypeBadge';
import type { GamePokemon } from '../../../../types';
import { FACTORY_BATTLE_CONFIG } from '../../config/factoryBattle';
import type { GameViewSectionProps } from './shared';
import { FactoryRentalDetailDialog } from './FactoryRentalDetailDialog';

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

function SelectionSlot({
  pokemon,
  label,
}: {
  pokemon: GamePokemon | null;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 rounded-[16px] border border-slate-200 bg-white/[0.92] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
        <PokeballIndicator active={Boolean(pokemon)} compact />
        <div className="truncate text-[13px] font-black text-slate-800">{label}</div>
      </div>
    </div>
  );
}

function RentalCard({
  pokemon,
  isSelected,
  selectionOrder,
  disabled = false,
  isZh,
  getLocalized,
  t,
  onToggle,
  onOpenDetails,
  onKeyDown,
  detailButtonRef,
}: {
  pokemon: GamePokemon;
  isSelected: boolean;
  selectionOrder: number | null;
  disabled?: boolean;
  isZh: boolean;
  getLocalized: (value: unknown) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onToggle: () => void;
  onOpenDetails: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  detailButtonRef: (node: HTMLButtonElement | null) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={isSelected}
      aria-disabled={disabled}
      aria-label={`${getLocalized(pokemon)} ${isSelected ? (isZh ? '\u5df2\u9009' : 'Picked') : t('selectThis')}`}
      data-selected={isSelected ? 'true' : 'false'}
      onClick={() => {
        if (disabled) return;
        onToggle();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        onKeyDown(event);
      }}
      className={`pf-battle-card group relative aspect-[1.18] p-1.5 ${disabled ? 'cursor-default opacity-70' : 'cursor-pointer'}`}
    >
      {selectionOrder !== null && (
        <div className="pf-battle-ribbon">
          <span className="inline-block skew-x-[10deg]">
            #{selectionOrder}
          </span>
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
          ref={detailButtonRef}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (disabled) return;
            onOpenDetails();
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-label={isZh ? '\u67e5\u770b\u8be6\u60c5' : t('viewDetails')}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white/[0.96] text-slate-700 shadow-[0_8px_14px_rgba(15,23,42,0.10)] transition-colors hover:bg-slate-50"
        >
          <Info className="h-3 w-3" />
        </button>
      </div>

      <div className="relative z-10 flex h-full flex-col items-center justify-between gap-1 px-2 pb-1 pt-4">
        <div className="flex min-h-[26px] w-full items-start justify-center px-8 text-center">
          <h3 className={`line-clamp-2 leading-tight text-slate-950 ${isZh ? 'text-[13px] font-black' : 'text-[11px] font-black uppercase tracking-[0.04em]'}`}>
            {getLocalized(pokemon)}
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

        <div className="min-h-[22px]" />
      </div>
    </div>
  );
}

export function FactorySelectScreen({ viewModel }: GameViewSectionProps) {
  const {
    factoryRentals,
    selectedRentalIndices,
    loading,
    isTransitioning,
    currentLanguage,
    t,
    getLocalized,
    getLocalizedDesc,
    getLocalizedNature,
    getStatName,
    toggleRental,
    confirmRentals,
  } = viewModel;

  const shouldReduceMotion = useReducedMotion();
  const isZh = currentLanguage.startsWith('zh');
  const selectedCount = selectedRentalIndices.length;
  const teamSize = FACTORY_BATTLE_CONFIG.teamSize;
  const canConfirm = selectedCount === teamSize;
  const interactionLocked = loading || isTransitioning;
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const detailButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const detailPokemon = detailIndex !== null ? factoryRentals[detailIndex] ?? null : null;

  const copy = useMemo(
    () => ({
      emptySlot: isZh ? '\u7a7a\u4f4d' : 'Empty',
      readyState: isZh ? '\u53ef\u51fa\u6218' : 'Ready',
      pendingState: isZh ? '\u5f85\u8865\u5168' : 'Pending',
      chooseRental: isZh ? '\u9009\u62e9\u79df\u8d41' : 'Choose Rentals',
    }),
    [isZh],
  );

  const openRentalDetails = (index: number) => {
    if (interactionLocked) return;
    setDetailIndex(index);
  };

  const closeRentalDetails = () => {
    if (detailIndex === null) return;
    const activeIndex = detailIndex;
    setDetailIndex(null);
    window.setTimeout(() => {
      detailButtonRefs.current[activeIndex]?.focus();
    }, 0);
  };

  const screenInitial = shouldReduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 };
  const screenExit = shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 };

  return (
    <motion.div
      key="factory-select"
      initial={screenInitial}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={screenExit}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.24, ease: 'easeOut' }}
      className="pf-scroll-y relative flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2 md:overflow-hidden md:px-3 md:py-3"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-1 py-1">
          <div className="mx-auto grid w-full max-w-[430px] grid-cols-2 gap-2">
            {factoryRentals.map((pokemon, index) => {
              const isSelected = selectedRentalIndices.includes(index);
              const selectionOrder = isSelected ? selectedRentalIndices.indexOf(index) + 1 : null;

              return (
                <Fragment key={`${pokemon.id}-${index}`}>
                  <RentalCard
                    pokemon={pokemon}
                    isSelected={isSelected}
                    selectionOrder={selectionOrder}
                    disabled={interactionLocked}
                    isZh={isZh}
                    getLocalized={getLocalized}
                    t={t}
                    onToggle={() => {
                      if (interactionLocked) return;
                      toggleRental(index);
                    }}
                    onOpenDetails={() => openRentalDetails(index)}
                    onKeyDown={(event) => {
                      if (interactionLocked) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleRental(index);
                      }
                    }}
                    detailButtonRef={(node) => {
                      detailButtonRefs.current[index] = node;
                    }}
                  />
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-1 pt-2">
        <div className="pf-command-bar">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {copy.chooseRental}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="pf-status-pill text-[11px] font-black">
                    <Swords className="h-3.5 w-3.5 text-blue-600" />
                    {selectedCount}/{teamSize}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${
                      canConfirm
                        ? 'border-orange-200 bg-orange-50 text-orange-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                  >
                    {canConfirm ? copy.readyState : copy.pendingState}
                  </span>
                </div>
              </div>

              <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(128px,1fr))]">
                {Array.from({ length: teamSize }, (_, slotIndex) => {
                  const selectedIndex = selectedRentalIndices[slotIndex];
                  const pokemon = selectedIndex !== undefined ? factoryRentals[selectedIndex] ?? null : null;
                  const label = pokemon ? getLocalized(pokemon) : copy.emptySlot;

                  return (
                    <Fragment key={`slot-${slotIndex}`}>
                      <SelectionSlot pokemon={pokemon} label={label} />
                    </Fragment>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={!canConfirm || interactionLocked}
              onClick={() => {
                if (interactionLocked) return;
                void confirmRentals();
              }}
              className={`min-h-[46px] rounded-[16px] border px-5 py-2.5 text-sm font-black uppercase tracking-[0.14em] transition-all md:min-w-[220px] md:px-6 ${
                canConfirm && !interactionLocked
                  ? 'border-orange-300 bg-orange-500 text-white shadow-[0_18px_28px_rgba(249,115,22,0.26)] hover:bg-orange-600'
                  : 'border-slate-200 bg-slate-200 text-slate-400'
              }`}
            >
              {t('confirmSelection', { count: selectedCount })}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {detailPokemon && (
          <FactoryRentalDetailDialog
            pokemon={detailPokemon}
            isZh={isZh}
            t={t}
            getLocalized={getLocalized}
            getLocalizedDesc={getLocalizedDesc}
            getLocalizedNature={getLocalizedNature}
            getStatName={getStatName}
            onClose={closeRentalDetails}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
