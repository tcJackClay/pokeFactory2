import { AnimatePresence, motion } from 'motion/react';
import { BattleBagPanel } from './BattleBagPanel';
import { BattleLogPanel } from './BattleLogPanel';
import { BattleMainMenu } from './BattleMainMenu';
import { BattleMovesPanel } from './BattleMovesPanel';
import { BattlePokemonPanel } from './BattlePokemonPanel';
import type { GameViewSectionProps } from '../shared';

export function BattleActionPanel({ viewModel }: GameViewSectionProps) {
  const { isMessageProcessing, turn, battleMenuTab, activeBuffs, specialModeUnlocked, specialBossBattleActive, battleSpecialUsage, t } = viewModel;

  return (
    <div className="relative flex-[4] bg-white shadow-2xl border-4 sm:border-8 border-slate-900 overflow-hidden">
      <AnimatePresence mode="wait">
        {isMessageProcessing || turn === 'ENEMY' ? (
          <BattleLogPanel viewModel={viewModel} />
        ) : (
          <motion.div
            key="interaction-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white grid grid-cols-1 md:grid-cols-4 gap-0 overflow-y-auto custom-scrollbar"
          >
            <div className="md:col-span-2 p-4 sm:p-6 border-b-4 md:border-b-0 md:border-r-4 border-slate-900 flex flex-col justify-center bg-slate-50">
              <div className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{t('commandPhase')}</div>
              <div className="text-xl sm:text-3xl font-black italic tracking-tighter text-slate-900">{t('whatToDo')}</div>
              <div className="mt-2 sm:mt-4 flex flex-wrap gap-2">
                {activeBuffs.atk && (
                  <span className="bg-red-500 text-white text-[6px] sm:text-[8px] px-2 py-0.5 font-black skew-x-[-10deg]">
                    <span className="skew-x-[10deg] inline-block">{t('atkUp')}</span>
                  </span>
                )}
                {activeBuffs.def && (
                  <span className="bg-blue-500 text-white text-[6px] sm:text-[8px] px-2 py-0.5 font-black skew-x-[-10deg]">
                    <span className="skew-x-[10deg] inline-block">{t('defUp')}</span>
                  </span>
                )}
                <span className={`text-[6px] sm:text-[8px] px-2 py-0.5 font-black skew-x-[-10deg] ${specialModeUnlocked ? 'bg-violet-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                  <span className="skew-x-[10deg] inline-block">{specialModeUnlocked ? t('specialModeReady') : t('specialModeLocked')}</span>
                </span>
                {specialBossBattleActive && (
                  <span className="bg-orange-500 text-white text-[6px] sm:text-[8px] px-2 py-0.5 font-black skew-x-[-10deg]">
                    <span className="skew-x-[10deg] inline-block">{t('specialBossBattle')}</span>
                  </span>
                )}
                {(battleSpecialUsage.MEGA || battleSpecialUsage.DYNAMAX || battleSpecialUsage.TERA) && (
                  <span className="bg-violet-800 text-white text-[6px] sm:text-[8px] px-2 py-0.5 font-black skew-x-[-10deg]">
                    <span className="skew-x-[10deg] inline-block">{t('specialUsed')}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="md:col-span-2 p-2 sm:p-3 bg-white relative">
              <AnimatePresence mode="wait">
                {turn === 'PLAYER' && battleMenuTab === 'MAIN' && <BattleMainMenu viewModel={viewModel} />}
                {turn === 'PLAYER' && battleMenuTab === 'BAG' && <BattleBagPanel viewModel={viewModel} />}
                {turn === 'PLAYER' && battleMenuTab === 'POKEMON' && <BattlePokemonPanel viewModel={viewModel} />}
                {turn === 'PLAYER' && battleMenuTab === 'MOVES' && <BattleMovesPanel viewModel={viewModel} />}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
