import { motion, useReducedMotion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { BattleActionPanel } from './battle/BattleActionPanel';
import { BattleFieldPanel } from './battle/BattleFieldPanel';
import type { GameViewSectionProps } from './shared';

export function BattleScreen({ viewModel }: GameViewSectionProps) {
  const { playerTeam, enemy } = viewModel;
  const shouldReduceMotion = useReducedMotion();

  if (!playerTeam[0]) return null;

  if (!enemy) {
    const loadingText = viewModel.currentLanguage.startsWith('zh') ? '正在匹配对手...' : 'Matching opponent...';

    return (
      <motion.div
        key="battle-loading"
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-1 items-center justify-center"
      >
        <div className="pf-panel flex items-center gap-3 px-6 py-5">
          <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{loadingText}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="battle"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4"
    >
      <BattleFieldPanel viewModel={viewModel} />
      <BattleActionPanel viewModel={viewModel} />
    </motion.div>
  );
}
