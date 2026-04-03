import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import type { GameViewSectionProps } from '../shared';

export function BattleLogPanel({ viewModel }: GameViewSectionProps) {
  const { battleLog, turn, isMessageProcessing, t } = viewModel;

  return (
    <motion.div
      key="battle-log-box"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-slate-900 text-white p-4 sm:p-6 flex items-center relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 sm:h-2 bg-blue-500" />
      <div className="absolute bottom-0 left-0 w-full h-1 sm:h-2 bg-red-500" />
      <AnimatePresence mode="wait">
        {battleLog.length > 0 && (
          <motion.div
            key={battleLog.length}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full"
          >
            <p className="text-lg sm:text-2xl font-black italic tracking-tight leading-tight">
              {turn === 'ENEMY' && !isMessageProcessing ? t('thinking') : battleLog[battleLog.length - 1]}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        animate={{ x: [0, 5, 0] }}
        transition={{ repeat: Infinity, duration: 0.8 }}
        className="absolute bottom-2 sm:bottom-4 right-4 sm:right-8"
      >
        <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
      </motion.div>
    </motion.div>
  );
}
