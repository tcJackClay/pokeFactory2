import { motion, useReducedMotion } from 'motion/react';
import { Dna } from 'lucide-react';
import TypeBadge from '../../../../../components/TypeBadge';
import type { GameViewSectionProps } from '../shared';

export function EvolutionOverlay({ viewModel }: GameViewSectionProps) {
  const {
    pendingEvolutionEligibleIndexes,
    selectedPokemonForEvolution,
    evolutionChoices,
    playerTeam,
    currentLanguage,
    t,
    getLocalized,
    startEvolution,
    performEvolution,
    setPendingRewardAction,
    setPendingEvolutionEligibleIndexes,
    setSelectedPokemonForEvolution,
    setEvolutionChoices,
  } = viewModel;

  const shouldReduceMotion = useReducedMotion();
  const isZh = currentLanguage.startsWith('zh');
  const evolvableTeamEntries = playerTeam
    .map((pokemon, index) => ({ pokemon, index }))
    .filter((entry) => pendingEvolutionEligibleIndexes.includes(entry.index));

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pf-modal-backdrop"
    >
      <div className="pf-modal-sheet flex max-h-full flex-col p-5 sm:p-6">
        <div className="mb-4 flex-none">
          <h2 className="text-2xl font-black text-slate-950 sm:text-[30px]">{t('evolution')}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            {selectedPokemonForEvolution ? t('chooseEvolution') : t('selectToEvolve')}
          </p>
        </div>

        {!selectedPokemonForEvolution ? (
          <>
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {evolvableTeamEntries.map(({ pokemon, index }) => (
                  <div
                    key={`${pokemon.id}-${index}`}
                    className="rounded-[22px] border border-slate-200 bg-white/92 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-[18px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,246,250,0.96)_100%)]">
                        <img
                          src={pokemon.sprites.front_default}
                          className="h-14 w-14 object-contain"
                          referrerPolicy="no-referrer"
                          alt={pokemon.name}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-lg font-black text-slate-900">{getLocalized(pokemon)}</div>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.10em] text-slate-400">Lv.{pokemon.level}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => startEvolution(pokemon, index)}
                      className="pf-action-button mt-4 w-full"
                    >
                      <span>{t('evolve')}</span>
                    </button>
                  </div>
                ))}

                {evolvableTeamEntries.length === 0 && (
                  <div className="col-span-full flex items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-12 text-center text-sm font-bold text-slate-400">
                    {t('cannotEvolve')}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setPendingRewardAction(null);
                setPendingEvolutionEligibleIndexes([]);
              }}
              className="pf-action-button mt-4 w-full flex-none"
            >
              <span>{t('back')}</span>
            </button>
          </>
        ) : (
          <>
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {evolutionChoices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => performEvolution(choice.id)}
                    className="pf-reward-card min-h-[240px] p-5 text-left"
                  >
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-violet-100 bg-violet-50 shadow-sm">
                      <Dna className="h-8 w-8 text-violet-500" />
                    </div>
                    <div className="flex justify-center rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] px-3 py-4">
                      <img
                        src={choice.sprites.front_default}
                        className="h-24 w-24 object-contain drop-shadow-[0_12px_18px_rgba(15,23,42,0.18)]"
                        referrerPolicy="no-referrer"
                        alt={choice.name}
                      />
                    </div>
                    <div className="mt-4 text-lg font-black text-slate-950">{getLocalized(choice)}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {choice.types.map((typeSlot) => (
                        <TypeBadge key={typeSlot.type.name} type={typeSlot.type.name} size="xs" />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedPokemonForEvolution(null);
                setEvolutionChoices([]);
              }}
              className="pf-action-button mt-4 w-full flex-none"
            >
              <span>{t('back')}</span>
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
