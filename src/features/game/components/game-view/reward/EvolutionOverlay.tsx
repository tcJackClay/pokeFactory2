import { motion } from 'motion/react';
import TypeBadge from '../../../../../components/TypeBadge';
import type { GameViewSectionProps } from '../shared';

export function EvolutionOverlay({ viewModel }: GameViewSectionProps) {
  const {
    pendingEvolutionEligibleIndexes,
    selectedPokemonForEvolution,
    evolutionChoices,
    playerTeam,
    t,
    getLocalized,
    startEvolution,
    performEvolution,
    setPendingRewardAction,
    setPendingEvolutionEligibleIndexes,
    setSelectedPokemonForEvolution,
    setEvolutionChoices,
  } = viewModel;

  const evolvableTeamEntries = playerTeam
    .map((pokemon, index) => ({ pokemon, index }))
    .filter((entry) => pendingEvolutionEligibleIndexes.includes(entry.index));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex flex-col p-8 overflow-y-auto custom-scrollbar"
    >
      <div className="text-center mb-8 flex-none">
        <div className="inline-block bg-purple-600 px-12 py-3 skew-x-[-12deg] shadow-xl mb-4">
          <h2 className="text-3xl font-black italic tracking-tighter skew-x-[12deg] text-white">{t('evolution')}</h2>
        </div>
        <p className="text-slate-300 font-bold italic text-sm">
          {selectedPokemonForEvolution ? t('chooseEvolution') : t('selectToEvolve')}
        </p>
      </div>

      {!selectedPokemonForEvolution ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pb-8 overflow-y-auto custom-scrollbar pr-2">
            {evolvableTeamEntries.map(({ pokemon, index }) => (
              <div
                key={`${pokemon.id}-${index}`}
                className="bg-white p-6 shadow-xl hover:shadow-2xl transition-all border-b-4 border-slate-100 hover:border-purple-500 group flex flex-col items-center"
              >
                <img
                  src={pokemon.sprites.front_default}
                  className="w-24 h-24 mx-auto mb-4 group-hover:scale-110 transition-transform"
                  referrerPolicy="no-referrer"
                />
                <div className="font-black italic text-xl uppercase">{getLocalized(pokemon)}</div>
                <button
                  onClick={() => startEvolution(pokemon, index)}
                  className="w-full mt-4 py-2 bg-purple-500 text-white font-black italic text-sm hover:bg-purple-600 transition-colors skew-x-[-10deg]"
                >
                  <span className="skew-x-[10deg] inline-block">{t('evolve')}</span>
                </button>
              </div>
            ))}
            {evolvableTeamEntries.length === 0 && (
              <div className="col-span-full text-center py-8">
                <p className="text-slate-300 font-bold italic">{t('cannotEvolve')}</p>
              </div>
            )}
          </div>
          <div className="mt-auto pt-4 flex-none">
            <button
              onClick={() => {
                setPendingRewardAction(null);
                setPendingEvolutionEligibleIndexes([]);
              }}
              className="w-full py-3 bg-slate-800 text-white font-black italic skew-x-[-12deg] hover:bg-slate-700 transition-colors"
            >
              <span className="skew-x-[12deg] inline-block">{t('back')}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pr-2 custom-scrollbar flex-1 mb-4">
            {evolutionChoices.map((choice) => (
              <motion.button
                key={choice.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => performEvolution(choice.id)}
                className="bg-white p-4 md:p-8 rounded-2xl shadow-xl border-2 md:border-4 border-purple-100 hover:border-purple-500 transition-all flex items-center md:flex-col gap-4 md:gap-0 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-12 h-12 md:w-16 md:h-16 bg-purple-500 skew-x-[45deg] translate-x-6 md:translate-x-8 -translate-y-6 md:-translate-y-8 group-hover:translate-x-4 md:group-hover:translate-x-6 group-hover:-translate-y-4 md:group-hover:-translate-y-6 transition-transform" />
                <img
                  src={choice.sprites.front_default}
                  className="w-16 h-16 md:w-32 md:h-32 group-hover:scale-110 transition-transform z-10"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 md:flex-none text-left md:text-center z-10">
                  <div className="font-black italic text-lg md:text-2xl uppercase text-slate-900">{getLocalized(choice)}</div>
                  <div className="mt-1 md:mt-4 flex gap-1 md:gap-2">
                    {choice.types.map((typeSlot) => (
                      <TypeBadge key={typeSlot.type.name} type={typeSlot.type.name} size="xs" />
                    ))}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
          <div className="flex-none">
            <button
              onClick={() => {
                setSelectedPokemonForEvolution(null);
                setEvolutionChoices([]);
              }}
              className="w-full py-3 bg-slate-800 text-white font-black italic skew-x-[-12deg] hover:bg-slate-700 transition-colors"
            >
              <span className="skew-x-[12deg] inline-block">{t('back')}</span>
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
