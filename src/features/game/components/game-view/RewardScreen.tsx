import { AnimatePresence, motion } from 'motion/react';
import { EvolutionOverlay } from './reward/EvolutionOverlay';
import { LearnMoveOverlay } from './reward/LearnMoveOverlay';
import { ReplacePokemonModal } from './reward/ReplacePokemonModal';
import { RewardCardsGrid } from './reward/RewardCardsGrid';
import { RewardHeader } from './reward/RewardHeader';
import type { GameViewSectionProps } from './shared';

export function RewardScreen({ viewModel }: GameViewSectionProps) {
  const { pendingRewardAction, showReplaceUI } = viewModel;

  return (
    <motion.div
      key="reward"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col p-4 overflow-hidden relative"
    >
      <RewardHeader viewModel={viewModel} />
      <RewardCardsGrid viewModel={viewModel} />

      <AnimatePresence>
        {pendingRewardAction === 'MOVE' && <LearnMoveOverlay viewModel={viewModel} />}
        {pendingRewardAction === 'EVOLUTION' && <EvolutionOverlay viewModel={viewModel} />}
      </AnimatePresence>

      <AnimatePresence>
        {showReplaceUI && <ReplacePokemonModal viewModel={viewModel} />}
      </AnimatePresence>
    </motion.div>
  );
}
