import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { EvolutionOverlay } from './reward/EvolutionOverlay';
import { LearnMoveOverlay } from './reward/LearnMoveOverlay';
import { ReplacePokemonModal } from './reward/ReplacePokemonModal';
import { RewardCardsGrid } from './reward/RewardCardsGrid';
import { RewardHeader } from './reward/RewardHeader';
import type { GameViewSectionProps } from './shared';

export function RewardScreen({ viewModel }: GameViewSectionProps) {
  const { pendingRewardAction, showReplaceUI } = viewModel;
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      key="reward"
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="flex flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4 sm:py-4"
    >
      <div className="pf-celebration-shell relative flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
        <RewardHeader viewModel={viewModel} />
        <RewardCardsGrid viewModel={viewModel} />
      </div>

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
