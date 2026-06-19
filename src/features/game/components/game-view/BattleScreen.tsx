import { motion, useReducedMotion } from 'motion/react';
import { BattleActionPanel } from './battle/BattleActionPanel';
import { BattleFieldPanel } from './battle/BattleFieldPanel';
import type { GameViewSectionProps } from './shared';

export function BattleScreen({ viewModel }: GameViewSectionProps) {
  const { playerTeam, enemy, isTransitioning, trainerIntroActive, trainerIntroAwaitingContinue, currentEnemyTrainer, currentLanguage } = viewModel;
  const shouldReduceMotion = useReducedMotion();

  if (!playerTeam[0]) return null;

  if (!enemy) {
    if (isTransitioning || trainerIntroActive || trainerIntroAwaitingContinue || currentEnemyTrainer) {
      return (
        <motion.div
          key="battle-intro"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pf-battle-screen flex min-h-0 flex-1 flex-col gap-3 overflow-hidden sm:gap-4"
        >
          <BattleFieldPanel viewModel={viewModel} />
          <BattleActionPanel viewModel={viewModel} />
        </motion.div>
      );
    }

    return (
      <motion.div
        key="battle-loading"
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pf-battle-screen flex min-h-0 flex-1 flex-col gap-3 overflow-hidden sm:gap-4"
      >
        <div className="pf-battle-stage-shell pf-arena-stage relative min-h-[240px] flex-1 overflow-hidden sm:min-h-[320px] sm:flex-[7]">
          <div className="pf-arena-floor" aria-hidden="true" />
          <div className="absolute inset-x-6 top-6 h-10 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.66)_0%,transparent_72%)] blur-xl" aria-hidden="true" />
          {!isTransitioning && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-2xl border border-white/70 bg-white/85 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-slate-600 shadow-lg backdrop-blur">
                {currentLanguage.startsWith('zh') ? '正在同步对战数据...' : 'Syncing battle data...'}
              </div>
            </div>
          )}
        </div>
        <div className="pf-battle-action-shell flex-none" />
      </motion.div>
    );
  }

  return (
    <motion.div
      key="battle"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="pf-battle-screen flex min-h-0 flex-1 flex-col gap-3 overflow-hidden sm:gap-4"
    >
      <BattleFieldPanel viewModel={viewModel} />
      <BattleActionPanel viewModel={viewModel} />
    </motion.div>
  );
}
