import { motion, useReducedMotion } from 'motion/react';
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
    currentLanguage,
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

  const shouldReduceMotion = useReducedMotion();
  const isZh = currentLanguage.startsWith('zh');

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pf-modal-backdrop"
    >
      <div className="pf-modal-sheet flex max-h-full flex-col p-5 sm:p-6">
        <div className="mb-4 flex-none">
          <h2 className="text-2xl font-black text-slate-950 sm:text-[30px]">{t('learnMove')}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            {pendingTmMove
              ? `${t('selectToLearn')} (${getLocalized(pendingTmMove)})`
              : t('selectToLearn')}
          </p>
        </div>

        {learningPokemonIdx === null ? (
          <>
            <div className="custom-scrollbar grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
              {playerTeam.map((pokemon, index) => {
                const tmBlocked = !!pendingTmMove && !pendingTmLearnerIndexes.includes(index);
                return (
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
                        <div className="mt-1 text-[11px] font-semibold text-slate-400">
                          {t('movesCount').replace('{count}', pokemon.selectedMoves.length.toString())}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => startLearningMove(index)}
                      disabled={tmBlocked}
                      className={`pf-action-button mt-4 w-full ${tmBlocked ? '' : ''}`}
                    >
                      <span>{tmBlocked ? (isZh ? '无法学习 TM' : 'Cannot Learn TM') : t('learnMoveBtn')}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setPendingRewardAction(null)}
              className="pf-action-button mt-4 w-full flex-none"
            >
              <span>{t('back')}</span>
            </button>
          </>
        ) : loading ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <RefreshCw className="mb-4 h-12 w-12 animate-spin text-blue-500" />
            <p className="text-sm font-black text-slate-500">{t('retrievingMoves')}</p>
          </div>
        ) : selectedNewMove ? (
          <>
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="rounded-[24px] border border-rose-200 bg-rose-50/60 p-5">
                <h3 className="text-xl font-black text-slate-950 sm:text-[26px]">{t('replaceWhichMove')}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  {t('selectOldToReplace').replace('{move}', getLocalized(selectedNewMove))}
                </p>

                <div className="mt-4 grid gap-2">
                  {playerTeam[learningPokemonIdx].selectedMoves.map((move, index) => (
                    <button
                      key={`${move.name}-${index}`}
                      type="button"
                      onClick={() => replaceMove(index)}
                      onMouseEnter={() => setHoveredMove(move)}
                      onMouseLeave={() => setHoveredMove(null)}
                      className="flex items-center justify-between gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-left transition-all hover:border-rose-300 hover:bg-rose-50/60"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <TypeBadge type={move.type} size="xs" />
                        <span className="truncate text-sm font-black text-slate-800">{getLocalized(move)}</span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        {move.damage_class === 'special' ? t('special') : t('physical')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedNewMove(null)}
              className="pf-action-button mt-4 w-full flex-none"
            >
              <span>{t('back')}</span>
            </button>
          </>
        ) : (
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {potentialMoves.map((move, index) => (
                <button
                  key={`${move.name}-${index}`}
                  type="button"
                  onClick={() => handleLearnMove(move)}
                  onMouseEnter={() => setHoveredMove(move)}
                  onMouseLeave={() => setHoveredMove(null)}
                  className="pf-reward-card min-h-[220px] p-4 text-left"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-blue-100 bg-blue-50 shadow-sm">
                    <Zap className="h-7 w-7 text-blue-500" />
                  </div>
                  <div className="text-lg font-black text-slate-950">{getLocalized(move)}</div>
                  <div className="mt-2">
                    <TypeBadge type={move.type} size="xs" />
                  </div>
                  <div className="mt-5 inline-flex min-h-[42px] w-full items-center justify-center rounded-[14px] border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-black uppercase tracking-[0.14em] text-white">
                    {t('learnThisMove')}
                  </div>
                </button>
              ))}

              {potentialMoves.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-12 text-center">
                  <p className="text-sm font-bold text-slate-400">{t('noMoreMoves')}</p>
                  <button
                    type="button"
                    onClick={() => setLearningPokemonIdx(null)}
                    className="pf-action-button mt-4 px-5"
                  >
                    <span>{t('reselectPokemon')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
