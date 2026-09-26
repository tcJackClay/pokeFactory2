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
      <BattleCommandRegion viewModel={viewModel} active={!loading} />
    </motion.div>
  );
}
