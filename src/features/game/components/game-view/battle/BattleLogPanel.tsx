import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import type { GameViewSectionProps } from '../shared';

export function BattleLogPanel({ viewModel }: GameViewSectionProps) {
  const { battleLog, turn, isMessageProcessing, t } = viewModel;
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      key="battle-log-box"
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pf-battle-log absolute inset-0 flex items-center p-4 sm:p-6"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#2563eb_0%,#0ea5e9_52%,#f97316_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1 bg-[linear-gradient(90deg,#ef4444_0%,#f97316_48%,#2563eb_100%)]" />

      <div className="relative z-10 w-full">
        <div className="mb-3 flex items-center justify-end gap-3">
          <motion.div
            animate={shouldReduceMotion ? undefined : { x: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="text-blue-300"
          >
            <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          {battleLog.length > 0 && (
            <motion.div
              key={battleLog.length}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              className="max-w-[760px]"
            >
              <p className="text-lg font-black leading-tight text-white sm:text-[28px]">
                {turn === 'ENEMY' && !isMessageProcessing ? t('thinking') : battleLog[battleLog.length - 1]}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
