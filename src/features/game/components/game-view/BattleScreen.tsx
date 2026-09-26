import { motion, useReducedMotion } from 'motion/react';
import { BattleCommandRegion } from './battle/BattleCommandRegion';
import { BattleViewportRegion } from './battle/BattleViewportRegion';
import { TopStatusRegion } from './battle/TopStatusRegion';
import type { GameViewSectionProps } from './shared';

export function BattleScreen({ viewModel }: GameViewSectionProps) {
  const {
    playerTeam,
    enemy,
    isTransitioning,
    trainerIntroActive,
    trainerIntroAwaitingContinue,
    currentEnemyTrainer,
    currentLanguage,
    settlementError,
    retrySettlement,
  } = viewModel;
  const shouldReduceMotion = useReducedMotion();

  if (!playerTeam[0]) return null;

  const battlePresentationActive = Boolean(
    enemy
    || isTransitioning
    || trainerIntroActive
    || trainerIntroAwaitingContinue
    || currentEnemyTrainer,
  );
  const loading = !enemy && !battlePresentationActive;

  return (
    <motion.div
      key={loading ? 'battle-loading' : 'battle'}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="pf-battle-screen min-h-0 flex-1 overflow-hidden"
      data-layout="three-region"
    >
      <TopStatusRegion viewModel={viewModel} />
      <BattleViewportRegion viewModel={viewModel} loading={loading} />
      {settlementError ? (
        <div role="alert" className="mx-2 mb-2 rounded-2xl border border-rose-300 bg-white p-3 text-center text-sm font-bold text-rose-800 shadow-lg">
          <p>{currentLanguage.startsWith('zh') ? '本组结算未能保存，BP 尚未到账。请重试。' : 'The group settlement could not be saved. BP has not been credited yet.'}</p>
          <button type="button" onClick={() => void retrySettlement()} className="pf-action-button mt-2 min-h-11 px-4">
            {currentLanguage.startsWith('zh') ? '重试结算' : 'Retry settlement'}
          </button>
        </div>
      ) : (
        <BattleCommandRegion viewModel={viewModel} active={!loading} />
      )}
    </motion.div>
  );
}
