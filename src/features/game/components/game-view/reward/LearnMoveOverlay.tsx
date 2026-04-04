import { motion } from 'motion/react';
import { RefreshCw, Zap } from 'lucide-react';
import TypeBadge from '../../../../../components/TypeBadge';
import type { GameViewSectionProps } from '../shared';

export function LearnMoveOverlay({ viewModel }: GameViewSectionProps) {
  const {
    learningPokemonIdx,
    potentialMoves,
    selectedNewMove,
    pendingTmMove,
    pendingTmLearnerIndexes,
    playerTeam,
    loading,
    t,
    getLocalized,
    startLearningMove,
    handleLearnMove,
    replaceMove,
    setPendingRewardAction,
    setSelectedNewMove,
    setHoveredMove,
    setLearningPokemonIdx,
  } = viewModel;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex flex-col p-8 overflow-y-auto custom-scrollbar"
    >
      <div className="text-center mb-8 flex-none">
        <div className="inline-block bg-blue-600 px-12 py-3 skew-x-[-12deg] shadow-xl mb-4">
          <h2 className="text-3xl font-black italic tracking-tighter skew-x-[12deg] text-white">{t('learnMove')}</h2>
        </div>
        <p className="text-slate-300 font-bold italic text-sm">
          {pendingTmMove
            ? `${t('selectToLearn')} (${getLocalized(pendingTmMove)})`
            : t('selectToLearn')}
        </p>
      </div>

      {learningPokemonIdx === null ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pb-4 overflow-y-auto custom-scrollbar pr-2 flex-1">
            {playerTeam.map((pokemon, index) => {
              const tmBlocked = !!pendingTmMove && !pendingTmLearnerIndexes.includes(index);
              return (
                <div
                  key={`${pokemon.id}-${index}`}
                  className="bg-white p-4 md:p-6 shadow-xl hover:shadow-2xl transition-all border-b-4 border-slate-100 hover:border-blue-500 group flex items-center md:flex-col gap-4 md:gap-0"
                >
                  <img
                    src={pokemon.sprites.front_default}
                    className="w-16 h-16 md:w-24 md:h-24 group-hover:scale-110 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 md:flex-none text-left md:text-center">
                    <div className="font-black italic text-base md:text-xl uppercase truncate">{getLocalized(pokemon)}</div>
                    <div className="text-[8px] md:text-[10px] font-bold text-slate-400 mt-1 mb-2 md:mb-4">
                      {t('movesCount').replace('{count}', pokemon.selectedMoves.length.toString())}
                    </div>
                    <button
                      onClick={() => startLearningMove(index)}
                      disabled={tmBlocked}
                      className={`w-full py-2 font-black italic text-[10px] md:text-sm transition-colors skew-x-[-10deg] ${
                        tmBlocked
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      <span className="skew-x-[10deg] inline-block">
                        {tmBlocked ? 'Cannot Learn TM' : t('learnMoveBtn')}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-auto pt-4 flex-none">
            <button
              onClick={() => setPendingRewardAction(null)}
              className="w-full py-3 bg-slate-800 text-white font-black italic skew-x-[-12deg] hover:bg-slate-700 transition-colors"
            >
              <span className="skew-x-[12deg] inline-block">{t('back')}</span>
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <RefreshCw className="animate-spin w-12 h-12 text-blue-500 mb-4" />
          <p className="font-black italic text-slate-400">{t('retrievingMoves')}</p>
        </div>
      ) : selectedNewMove ? (
        <div className="max-w-2xl mx-auto w-full">
          <div className="bg-white p-8 shadow-2xl skew-x-[-2deg] border-l-8 border-red-500">
            <div className="skew-x-[2deg]">
              <h3 className="text-3xl font-black italic mb-2 tracking-tighter">{t('replaceWhichMove')}</h3>
              <p className="text-slate-500 mb-8 font-bold italic">
                {t('selectOldToReplace').replace('{move}', getLocalized(selectedNewMove))}
              </p>

              <div className="grid grid-cols-1 gap-3">
                {playerTeam[learningPokemonIdx].selectedMoves.map((move, index) => (
                  <button
                    key={`${move.name}-${index}`}
                    onClick={() => replaceMove(index)}
                    onMouseEnter={() => setHoveredMove(move)}
                    onMouseLeave={() => setHoveredMove(null)}
                    className="p-4 bg-slate-50 hover:bg-red-50 border-2 border-slate-100 hover:border-red-500 transition-all flex justify-between items-center group"
                  >
                    <div className="flex items-center gap-3">
                      <TypeBadge type={move.type} size="xs" />
                      <span className="font-black italic uppercase group-hover:text-red-600">{getLocalized(move)}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-400 uppercase">
                      {move.damage_class === 'special' ? t('special') : t('physical')}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setSelectedNewMove(null)}
                className="mt-6 w-full py-3 bg-slate-100 text-slate-500 font-black italic hover:bg-slate-200 transition-all"
              >
                {t('back')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pr-2 pb-8">
            {potentialMoves.map((move, index) => (
              <button
                key={`${move.name}-${index}`}
                onClick={() => handleLearnMove(move)}
                onMouseEnter={() => setHoveredMove(move)}
                onMouseLeave={() => setHoveredMove(null)}
                className="bg-white p-5 shadow-lg hover:shadow-2xl transition-all border-b-4 border-slate-100 hover:border-blue-500 flex flex-col items-center text-center group"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6 text-blue-500" />
                </div>
                <div className="font-black italic text-lg uppercase mb-1">{getLocalized(move)}</div>
                <TypeBadge type={move.type} size="xs" />
                <div className="mt-3 w-full py-1.5 bg-slate-900 text-white font-black italic text-[10px] skew-x-[-10deg]">
                  <span className="skew-x-[10deg] inline-block uppercase">{t('learnThisMove')}</span>
                </div>
              </button>
            ))}
            {potentialMoves.length === 0 && (
              <div className="col-span-full text-center py-12">
                <p className="text-slate-400 font-bold italic">{t('noMoreMoves')}</p>
                <button
                  onClick={() => setLearningPokemonIdx(null)}
                  className="mt-4 px-6 py-2 bg-slate-800 text-white font-black italic skew-x-[-10deg]"
                >
                  <span className="skew-x-[10deg] inline-block">{t('reselectPokemon')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
