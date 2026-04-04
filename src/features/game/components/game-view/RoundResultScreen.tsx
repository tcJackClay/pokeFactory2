import { motion } from 'motion/react';
import { ChevronRight, Coins, RefreshCw, Trophy } from 'lucide-react';
import { FACTORY_REWARD_CONFIG } from '../../config/factoryRewards';
import type { GameViewSectionProps } from './shared';

export function RoundResultScreen({ viewModel }: GameViewSectionProps) {
  const { stage, streak, swapCount, enemyAiTier, roundResult, lastTokenGain, currentEnemyTrainer, t, continueAfterRoundResult } = viewModel;

  const battlesPerSet = FACTORY_REWARD_CONFIG.battlesPerSet;
  const battleInSet = ((stage - 1) % battlesPerSet) + 1;
  const isSetCompleted = roundResult === 'WIN' && battleInSet === battlesPerSet;
  const title = roundResult === 'WIN' ? t('battleResultWin') : t('battleResultLoss');
  const actionLabel = roundResult === 'WIN' ? t('continueToSwap') : t('restartFactory');

  return (
    <motion.div
      key="round-result"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 flex flex-col items-center justify-center p-4 text-center"
    >
      <div className="bg-slate-900 px-8 py-3 skew-x-[-12deg] shadow-xl mb-4">
        <h2 className="text-3xl font-black italic tracking-tight skew-x-[12deg] text-white uppercase">{title}</h2>
      </div>

      <div className="bg-white border-l-4 border-yellow-500 shadow-lg px-8 py-6 mb-5">
        <div className="flex items-center justify-center gap-2 text-xl font-black italic">
          <Coins className="w-5 h-5 text-yellow-500" />
          {t('tokensEarned', { coins: lastTokenGain })}
        </div>
        <p className="text-slate-600 font-bold mt-2">{t('streak', { count: streak })}</p>
        <p className="text-slate-600 font-bold mt-1">{t('swapCount', { count: swapCount })}</p>
        <p className="text-slate-500 text-sm mt-1">{t('setProgress', { current: battleInSet, total: battlesPerSet })}</p>
        <p className="text-slate-500 text-sm mt-1">{t('enemyAiTier', { tier: enemyAiTier })}</p>
        {currentEnemyTrainer && (
          <p className="text-slate-500 text-sm mt-1">
            {currentEnemyTrainer.trainerName} · {currentEnemyTrainer.facilityClass.replace('FACILITY_CLASS_', '')}
          </p>
        )}
      </div>

      {isSetCompleted && (
        <div className="bg-emerald-600 text-white px-6 py-3 skew-x-[-10deg] mb-6 shadow-lg">
          <p className="font-black italic skew-x-[10deg] flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            {t('setCompleted')}
          </p>
        </div>
      )}

      <button
        onClick={continueAfterRoundResult}
        className="px-10 py-4 bg-blue-600 text-white font-black italic text-xl skew-x-[-12deg] hover:bg-blue-700 transition-all shadow-xl"
      >
        <span className="skew-x-[12deg] inline-flex items-center gap-2">
          {roundResult === 'WIN' ? <ChevronRight className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
          {actionLabel}
        </span>
      </button>
    </motion.div>
  );
}
