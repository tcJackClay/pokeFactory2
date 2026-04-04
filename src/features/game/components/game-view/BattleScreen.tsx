import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { BattleActionPanel } from './battle/BattleActionPanel';
import { BattleFieldPanel } from './battle/BattleFieldPanel';
import type { GameViewSectionProps } from './shared';

export function BattleScreen({ viewModel }: GameViewSectionProps) {
  const { playerTeam, enemy } = viewModel;

  if (!playerTeam[0]) return null;

  if (!enemy) {
    const loadingText = viewModel.currentLanguage.startsWith('zh') ? '正在匹配对手…' : 'Matching opponent...';

    return (
      <motion.div key="battle-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex items-center justify-center">
        <div className="bg-white border-4 border-slate-900 px-8 py-6 flex items-center gap-3 shadow-xl">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
          <span className="font-black italic text-slate-700 uppercase">{loadingText}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div key="battle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col gap-4 min-h-0">
      <BattleFieldPanel viewModel={viewModel} />
      <BattleActionPanel viewModel={viewModel} />
    </motion.div>
  );
}
