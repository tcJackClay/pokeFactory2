import type { GameViewSectionProps } from '../shared';
import { BattleMoveEffect } from './BattleMoveEffect';
import { CatchEffectOverlay } from './CatchEffectOverlay';
import { EnemyBattleCard } from './EnemyBattleCard';
import { PlayerBattleCard } from './PlayerBattleCard';
import { motion, useReducedMotion } from 'motion/react';
import { getFactoryTrainerPresentation } from '../../../config/factoryTrainerPresentation';

export function BattleFieldPanel({ viewModel }: GameViewSectionProps) {
  const {
    playerTeam,
    enemy,
    currentEnemyTrainer,
    playerAnim,
    enemyAnim,
    activeMoveType,
    isCatching,
    catchSuccess,
    getLocalized,
    trainerIntroActive,
    trainerIntroAwaitingContinue,
  } = viewModel;
  const shouldReduceMotion = useReducedMotion();

  const player = playerTeam[0];
  const trainerPresentation = currentEnemyTrainer ? getFactoryTrainerPresentation(currentEnemyTrainer) : null;
  if (!player) return null;

  return (
    <div className="pf-arena-stage relative min-h-[320px] flex-[1.12] sm:min-h-0 sm:flex-[7]">
      <div className="pf-arena-floor" aria-hidden="true" />
      <div className="absolute inset-x-6 top-6 h-10 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.66)_0%,transparent_72%)] blur-xl" aria-hidden="true" />

      {(trainerIntroActive || trainerIntroAwaitingContinue) && trainerPresentation ? (
        <>
          <div className="absolute right-[18%] bottom-[13%] h-16 w-64 rounded-full bg-black/30 blur-2xl" />
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 84 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.12 : 0.42, ease: 'easeOut' }}
            className="absolute right-2 top-[10%] z-10 w-[220px] sm:right-8 sm:top-[11%] sm:w-[280px] md:right-12 md:top-[12%] md:w-[320px] lg:right-14 lg:top-[13%] lg:w-[360px]"
          >
            <div className="relative">
              <div className="absolute bottom-4 left-1/2 h-9 w-[72%] -translate-x-1/2 rounded-full bg-black/28 blur-xl" />
              <motion.img
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: shouldReduceMotion ? 0.12 : 0.34, delay: shouldReduceMotion ? 0.02 : 0.08, ease: 'easeOut' }}
                src={trainerPresentation.portraitPath}
                alt={trainerPresentation.displayName}
                className="relative z-10 h-auto w-full object-contain drop-shadow-[0_26px_42px_rgba(15,23,42,0.5)]"
              />
            </div>
          </motion.div>
        </>
      ) : (
        <>
          {enemy && (
            <EnemyBattleCard
              enemy={enemy}
              trainer={currentEnemyTrainer}
              enemyAnim={enemyAnim}
              isCatching={isCatching}
              getLocalized={getLocalized}
            />
          )}
          <PlayerBattleCard player={player} playerAnim={playerAnim} getLocalized={getLocalized} viewModel={viewModel} />
          {enemy && <BattleMoveEffect playerAnim={playerAnim} enemyAnim={enemyAnim} activeMoveType={activeMoveType} />}
          <CatchEffectOverlay isCatching={isCatching} catchSuccess={catchSuccess} />
        </>
      )}
    </div>
  );
}
