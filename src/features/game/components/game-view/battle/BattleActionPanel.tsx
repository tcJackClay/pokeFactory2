import { AnimatePresence, motion } from 'motion/react';
import { BattleBagPanel } from './BattleBagPanel';
import { BattleLogPanel } from './BattleLogPanel';
import { BattleMainMenu } from './BattleMainMenu';
import { BattleMovesPanel } from './BattleMovesPanel';
import { BattlePokemonPanel } from './BattlePokemonPanel';
import { BattleSpecialTriggersNearHp } from './BattleSpecialTriggersNearHp';
import type { GameViewSectionProps } from '../shared';

export function BattleActionPanel({ viewModel }: GameViewSectionProps) {
  const { isMessageProcessing, turn, battleMenuTab, activeBuffs, specialModeUnlocked, specialBossBattleActive, battleSpecialUsage, t } = viewModel;

  return (
    <div className="relative flex-[3] bg-white shadow-2xl border-4 sm:border-8 border-slate-900 overflow-hidden">
      <AnimatePresence mode="wait">
        {isMessageProcessing || turn === 'ENEMY' ? (
          <BattleLogPanel viewModel={viewModel} />
        ) : (
          <motion.div
            key="interaction-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white grid grid-cols-1 md:grid-cols-2 gap-0 overflow-y-auto custom-scrollbar"
          >
            <div className="p-3 sm:p-4 border-b-4 md:border-b-0 md:border-r-4 border-slate-900 bg-slate-50">
              <div className="h-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-3">
                <div className="flex flex-col justify-center">
                  <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{t('commandPhase')}</div>
                  <div className="text-lg sm:text-2xl font-black tracking-tight text-slate-900">{t('whatToDo')}</div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {activeBuffs.atk && (
                      <span className="bg-red-500 text-white text-[8px] sm:text-[9px] px-2 py-0.5 font-black border border-red-700">{t('atkUp')}</span>
                    )}
                    {activeBuffs.def && (
                      <span className="bg-blue-500 text-white text-[8px] sm:text-[9px] px-2 py-0.5 font-black border border-blue-700">{t('defUp')}</span>
                    )}
                    <span className={`text-[8px] sm:text-[9px] px-2 py-0.5 font-black border ${specialModeUnlocked ? 'bg-violet-600 text-white border-violet-800' : 'bg-slate-300 text-slate-600 border-slate-400'}`}>
                      {specialModeUnlocked ? t('specialModeReady') : t('specialModeLocked')}
                    </span>
                    {specialBossBattleActive && (
                      <span className="bg-orange-500 text-white text-[8px] sm:text-[9px] px-2 py-0.5 font-black border border-orange-700">{t('specialBossBattle')}</span>
                    )}
                    {(battleSpecialUsage.MEGA || battleSpecialUsage.DYNAMAX || battleSpecialUsage.TERA) && (
                      <span className="bg-violet-800 text-white text-[8px] sm:text-[9px] px-2 py-0.5 font-black border border-violet-950">{t('specialUsed')}</span>
                    )}
                  </div>
                </div>

                <BattleSpecialTriggersNearHp viewModel={viewModel} />
              </div>
            </div>

            <div className="p-2 sm:p-3 bg-white relative">
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
