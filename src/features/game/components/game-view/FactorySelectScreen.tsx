import type { KeyboardEvent } from 'react';
import { Fragment, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Info, Shield, Swords } from 'lucide-react';
import TypeBadge from '../../../../components/TypeBadge';
import type { GamePokemon } from '../../../../types';
import { FACTORY_BATTLE_CONFIG } from '../../config/factoryBattle';
import type { GameViewSectionProps } from './shared';
import { TopRecordPanel } from './TopRecordPanel';

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
    <div className="pf-selection-slot min-w-[112px] flex-1">
      <div className="flex items-center gap-2">
        <PokeballIndicator active={Boolean(pokemon)} compact />
        <div className="truncate text-xs font-black text-slate-800">{label}</div>
      </div>
    </div>
  );
}

function RentalCard({
  pokemon,
  index,
  isSelected,
  selectionOrder,
  isZh,
  getLocalized,
  t,
  onToggle,
  onOpenInfo,
  onKeyDown,
}: {
  pokemon: GamePokemon;
  index: number;
  isSelected: boolean;
  selectionOrder: number | null;
  isZh: boolean;
  getLocalized: (value: unknown) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onToggle: () => void;
  onOpenInfo: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const stats = [
    { label: t('hp'), value: pokemon.maxHp },
    { label: t('attack'), value: pokemon.calculatedStats.attack },
    { label: t('defense'), value: pokemon.calculatedStats.defense },
    { label: t('spAtk'), value: pokemon.calculatedStats.spAtk },
    { label: t('spDef'), value: pokemon.calculatedStats.spDef },
    { label: t('speed'), value: pokemon.calculatedStats.speed },
  ];

  const abilityName = getLocalized(pokemon.abilities[0]?.ability) || t('none');

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${getLocalized(pokemon)} ${isSelected ? (isZh ? '已锁定' : 'Locked In') : t('selectThis')}`}
      data-selected={isSelected ? 'true' : 'false'}
      onClick={onToggle}
      onKeyDown={onKeyDown}
      className="pf-battle-card group relative cursor-pointer p-3 md:p-4"
    >
      <div className="pf-battle-ribbon">
        <span className="inline-block skew-x-[10deg]">
          {selectionOrder !== null ? `#${selectionOrder}` : `#${index + 1}`}
        </span>
      </div>

      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
        <PokeballIndicator active={isSelected} />
      </div>

      <div className="relative z-10 grid grid-cols-[88px,minmax(0,1fr)] gap-3 md:grid-cols-[96px,minmax(0,1fr)]">
        <div className="flex flex-col items-center pt-5">
          <div className="flex h-[88px] w-[88px] items-center justify-center rounded-[20px] border border-white/[0.80] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,245,249,0.94)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_12px_28px_rgba(15,23,42,0.10)] md:h-[96px] md:w-[96px]">
            <img
              src={pokemon.sprites.front_default}
              alt={pokemon.name}
              className="h-20 w-20 object-contain drop-shadow-[0_8px_12px_rgba(15,23,42,0.22)] transition-transform duration-200 group-hover:scale-105 md:h-24 md:w-24"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="mt-2 flex items-center gap-1 rounded-full border border-white/[0.80] bg-white/[0.88] px-2 py-1 shadow-sm">
            <Check className={`h-3.5 w-3.5 ${isSelected ? 'text-blue-600' : 'text-slate-300'}`} />
            <span className={`text-[10px] font-black uppercase tracking-[0.12em] ${isSelected ? 'text-blue-700' : 'text-slate-500'}`}>
              {isSelected ? (isZh ? '已选' : 'Picked') : t('selectThis')}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2 pr-7">
            <div className="min-w-0">
              <h3 className={`leading-tight text-slate-950 ${isZh ? 'text-[20px] font-black' : 'text-[18px] font-black uppercase tracking-[0.04em]'}`}>
                {getLocalized(pokemon)}
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pokemon.types.map((typeSlot) => (
                  <TypeBadge key={typeSlot.type.name} type={typeSlot.type.name} size="xs" />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenInfo();
              }}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-slate-200 bg-white/[0.88] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Info className="h-3.5 w-3.5" />
              {t('info')}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-200 bg-white/[0.88] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                <div className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{stat.label}</div>
                <div className="mt-1 text-sm font-black tabular-nums text-slate-900">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/[0.88] px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Shield className="h-3.5 w-3.5 text-slate-500" />
              <span className="truncate">{abilityName}</span>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {pokemon.selectedMoves.map((move, moveIndex) => (
              <div
                key={`${move.name}-${moveIndex}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/[0.84] px-2.5 py-1.5"
              >
                <span className="min-w-0 truncate text-[11px] font-black text-slate-800">
                  {getLocalized(move)}
                </span>
                <TypeBadge type={move.type} size="xs" className="shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FactorySelectScreen({ viewModel }: GameViewSectionProps) {
  const {
    factoryRentals,
    selectedRentalIndices,
    currentLanguage,
    coins,
    stage,
    streak,
    t,
    getLocalized,
    toggleRental,
    setInfoPokemonIdx,
    setPrevGameState,
    setGameState,
    confirmRentals,
  } = viewModel;

  const shouldReduceMotion = useReducedMotion();
  const isZh = currentLanguage.startsWith('zh');
  const selectedCount = selectedRentalIndices.length;
  const teamSize = FACTORY_BATTLE_CONFIG.teamSize;
  const canConfirm = selectedCount === teamSize;

  const copy = useMemo(
    () => ({
      selectedTeam: isZh ? '已选' : 'Picked',
      emptySlot: isZh ? '空位' : 'Empty',
      readyState: isZh ? '可出战' : 'Ready',
      pendingState: isZh ? '未满编' : 'Pending',
    }),
    [isZh],
  );

  const openPokemonInfo = (index: number) => {
    setInfoPokemonIdx(index);
    setPrevGameState('FACTORY_SELECT');
    setGameState('POKEMON_INFO');
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
      className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 md:px-4 md:py-4"
    >
      <div className="mb-2 px-1 md:mb-3 md:px-0">
        <TopRecordPanel
          currentLanguage={currentLanguage}
          coins={coins}
          stage={stage}
          streak={streak}
          battleIndexOverride={0}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="px-1 pb-3">
          <div className="pf-panel px-4 py-3 md:px-5 md:py-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className={`text-slate-950 ${isZh ? 'text-[24px] font-black' : 'text-[22px] font-black uppercase tracking-[0.05em]'}`}>
                {t('factorySelect')}
              </h2>

              <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-1 pb-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {factoryRentals.map((pokemon, index) => {
              const isSelected = selectedRentalIndices.includes(index);
              const selectionOrder = isSelected ? selectedRentalIndices.indexOf(index) + 1 : null;

              return (
                <Fragment key={`${pokemon.id}-${index}`}>
                  <RentalCard
                    pokemon={pokemon}
                    index={index}
                    isSelected={isSelected}
                    selectionOrder={selectionOrder}
                    isZh={isZh}
                    getLocalized={getLocalized}
                    t={t}
                    onToggle={() => toggleRental(index)}
                    onOpenInfo={() => openPokemonInfo(index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleRental(index);
                      }
                    }}
                  />
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-1 pt-3">
        <div className="pf-command-bar">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="mt-2 flex flex-wrap gap-2">
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

            <button
              type="button"
              disabled={!canConfirm}
              onClick={confirmRentals}
              className={`min-h-[52px] rounded-[18px] border px-6 py-3 text-sm font-black uppercase tracking-[0.14em] transition-all md:min-w-[260px] md:px-8 ${
                canConfirm
                  ? 'border-orange-300 bg-orange-500 text-white shadow-[0_18px_28px_rgba(249,115,22,0.26)] hover:bg-orange-600'
                  : 'border-slate-200 bg-slate-200 text-slate-400'
              }`}
            >
              {t('confirmSelection', { count: selectedCount })}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
