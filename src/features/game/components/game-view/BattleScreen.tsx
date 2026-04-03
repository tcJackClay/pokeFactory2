import { motion } from 'motion/react';
import { BattleActionPanel } from './battle/BattleActionPanel';
import { BattleFieldPanel } from './battle/BattleFieldPanel';
import type { GameViewSectionProps } from './shared';

export function BattleScreen({ viewModel }: GameViewSectionProps) {
  const { playerTeam, enemy } = viewModel;

  if (!playerTeam[0] || !enemy) return null;

  return (
    <motion.div key="battle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col gap-4 min-h-0">
      <BattleFieldPanel viewModel={viewModel} />
      <BattleActionPanel viewModel={viewModel} />
    </motion.div>
  );
}
