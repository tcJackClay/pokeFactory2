import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BattleBagPanel } from './BattleBagPanel';
import { BattleLogPanel } from './BattleLogPanel';
import { BattleMainMenu } from './BattleMainMenu';
import { BattleMovesPanel } from './BattleMovesPanel';
import { BattlePokemonPanel } from './BattlePokemonPanel';
import { BattleStatusPanel } from './BattleStatusPanel';
import type { GameViewSectionProps } from '../shared';

export function BattleActionPanel({ viewModel }: GameViewSectionProps) {
  const {
    isMessageProcessing,
    turn,
    battleMenuTab,
    activeBuffs,
    specialBossBattleActive,
    battleSpecialUsage,
    t,
  } = viewModel;
  const shouldReduceMotion = useReducedMotion();

  const stateBadges = [
    activeBuffs.atk ? { key: 'atk', label: t('atkUp'), tone: 'text-red-700 bg-red-50 border-red-200' } : null,
    activeBuffs.def ? { key: 'def', label: t('defUp'), tone: 'text-blue-700 bg-blue-50 border-blue-200' } : null,
    specialBossBattleActive ? { key: 'boss', label: t('specialBossBattle'), tone: 'text-orange-700 bg-orange-50 border-orange-200' } : null,
    Object.values(battleSpecialUsage).some(Boolean)
      ? { key: 'special', label: t('specialUsed'), tone: 'text-violet-700 bg-violet-50 border-violet-200' }
      : null,
  ].filter((badge): badge is { key: string; label: string; tone: string } => Boolean(badge));

  const showPlayerConsole = !isMessageProcessing
    && turn !== 'ENEMY'
    && !viewModel.isTransitioning
    && !viewModel.trainerIntroActive
    && !viewModel.trainerIntroAwaitingContinue;
  const activePanelKey = battleMenuTab === 'MOVES' ? 'MAIN' : battleMenuTab;

  return (
    <div className="pf-battle-console relative flex min-h-[244px] flex-[1.05] flex-col overflow-hidden sm:min-h-0 sm:flex-[3]">
      <AnimatePresence mode="wait">
        {showPlayerConsole ? (
          <motion.div
            key="interaction-panel"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col p-3 sm:p-4"
          >
            {stateBadges.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {stateBadges.map((badge) => (
                  <span
                    key={badge.key}
                    className={`inline-flex min-h-[30px] items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${badge.tone}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            )}

            <BattleMainMenu viewModel={viewModel} />

            <AnimatePresence mode="wait">
              <motion.div
                key={activePanelKey}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: shouldReduceMotion ? 0.01 : 0.18, ease: 'easeOut' }}
                className="pf-battle-console-panel mt-3 min-h-0 flex-1 overflow-hidden"
              >
                {(battleMenuTab === 'MAIN' || battleMenuTab === 'MOVES') && <BattleMovesPanel viewModel={viewModel} />}
                {battleMenuTab === 'STATUS' && <BattleStatusPanel viewModel={viewModel} />}
                {battleMenuTab === 'BAG' && <BattleBagPanel viewModel={viewModel} />}
                {battleMenuTab === 'POKEMON' && <BattlePokemonPanel viewModel={viewModel} />}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        ) : (
          <BattleLogPanel viewModel={viewModel} />
        )}
      </AnimatePresence>
    </div>
  );
}
