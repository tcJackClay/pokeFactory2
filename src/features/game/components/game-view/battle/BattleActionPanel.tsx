import { AnimatePresence, motion } from 'motion/react';
import { BattleBagPanel } from './BattleBagPanel';
import { BattleLogPanel } from './BattleLogPanel';
import { BattleMainMenu } from './BattleMainMenu';
import { BattlePokemonPanel } from './BattlePokemonPanel';
import { BattleStatusPanel } from './BattleStatusPanel';
import type { GameViewSectionProps } from '../shared';

export function BattleActionPanel({ viewModel }: GameViewSectionProps) {
  const { isMessageProcessing, turn, battleMenuTab, activeBuffs, specialBossBattleActive, battleSpecialUsage, t } = viewModel;
  const stateBadges = [
    activeBuffs.atk ? { key: 'atk', label: t('atkUp'), className: 'bg-red-500 text-white border-red-700' } : null,
    activeBuffs.def ? { key: 'def', label: t('defUp'), className: 'bg-blue-500 text-white border-blue-700' } : null,
    specialBossBattleActive ? { key: 'boss', label: t('specialBossBattle'), className: 'bg-orange-500 text-white border-orange-700' } : null,
    Object.values(battleSpecialUsage).some(Boolean)
      ? { key: 'special-used', label: t('specialUsed'), className: 'bg-violet-800 text-white border-violet-950' }
      : null,
  ].filter((badge): badge is { key: string; label: string; className: string } => Boolean(badge));

  return (
    <div className="relative flex-[1.05] sm:flex-[3] bg-white shadow-2xl border-4 sm:border-8 border-slate-900 overflow-hidden min-h-[208px] sm:min-h-0">
      <AnimatePresence mode="wait">
        {isMessageProcessing || turn === 'ENEMY' ? (
          <BattleLogPanel viewModel={viewModel} />
        ) : (
          <motion.div
            key="interaction-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white overflow-y-auto custom-scrollbar p-2 sm:p-3"
          >
            <div className="flex min-h-full flex-col justify-start gap-2 sm:gap-3">
              {stateBadges.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
                  {stateBadges.map((badge) => (
                    <span
                      key={badge.key}
                      className={`text-[8px] sm:text-[9px] px-2 py-0.5 font-black border ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              )}

              <BattleMainMenu viewModel={viewModel} />

              <AnimatePresence mode="wait">
                {turn === 'PLAYER' && (battleMenuTab === 'STATUS' || battleMenuTab === 'BAG' || battleMenuTab === 'POKEMON') && (
                  <motion.div
                    key={battleMenuTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="min-h-0 flex-1 overflow-hidden rounded-md border border-slate-200 bg-slate-50/70"
                  >
                    {battleMenuTab === 'STATUS' && <BattleStatusPanel viewModel={viewModel} />}
                    {battleMenuTab === 'BAG' && <BattleBagPanel viewModel={viewModel} />}
                    {battleMenuTab === 'POKEMON' && <BattlePokemonPanel viewModel={viewModel} />}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
