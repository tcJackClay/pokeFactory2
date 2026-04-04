import { motion, useReducedMotion } from 'motion/react';
import { ChevronRight, Coins, RefreshCw, ShieldCheck, Trophy } from 'lucide-react';
import { FACTORY_REWARD_CONFIG } from '../../config/factoryRewards';
import type { GameViewSectionProps } from './shared';

export function RoundResultScreen({ viewModel }: GameViewSectionProps) {
  const {
    stage,
    streak,
    swapCount,
    enemyAiTier,
    roundResult,
    lastTokenGain,
    currentEnemyTrainer,
    currentLanguage,
    t,
    continueAfterRoundResult,
  } = viewModel;

  const shouldReduceMotion = useReducedMotion();
  const isZh = currentLanguage.startsWith('zh');
  const battlesPerSet = FACTORY_REWARD_CONFIG.battlesPerSet;
  const battleInSet = ((stage - 1) % battlesPerSet) + 1;
  const isSetCompleted = roundResult === 'WIN' && battleInSet === battlesPerSet;
  const title = roundResult === 'WIN' ? t('battleResultWin') : t('battleResultLoss');
  const actionLabel = roundResult === 'WIN' ? t('continueToSwap') : t('restartFactory');

  return (
    <motion.div
      key="round-result"
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
      className="flex flex-1 items-center justify-center p-4"
    >
      <div className="pf-result-shell relative w-full max-w-[860px] p-6 sm:p-8" data-tone="victory">
        <div className="relative z-10 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="pf-result-badge border-amber-200 bg-amber-50 text-amber-700">
              <Trophy className="h-4 w-4" />
              {title}
            </div>
            <div className="pf-result-badge text-slate-600">
              <Coins className="h-4 w-4 text-amber-500" />
              {t('tokensEarned', { coins: lastTokenGain })}
            </div>
          </div>

          <h2 className={`mt-5 text-slate-950 ${isZh ? 'text-[34px] font-black' : 'text-[32px] font-black uppercase tracking-[0.05em]'}`}>
            {title}
          </h2>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="pf-result-metric-card text-left">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {isZh ? '当前进度' : 'Current Progress'}
              </div>
              <div className="mt-2 text-lg font-black text-slate-900">{t('setProgress', { current: battleInSet, total: battlesPerSet })}</div>
              <div className="mt-2 text-sm font-semibold text-slate-500">{t('streak', { count: streak })}</div>
              <div className="mt-1 text-sm font-semibold text-slate-500">{t('swapCount', { count: swapCount })}</div>
            </div>

            <div className="pf-result-metric-card text-left">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {isZh ? '对手信息' : 'Opponent Data'}
              </div>
              <div className="mt-2 text-lg font-black text-slate-900">{t('enemyAiTier', { tier: enemyAiTier })}</div>
              {currentEnemyTrainer && (
                <div className="mt-2 text-sm font-semibold text-slate-500">
                  {currentEnemyTrainer.trainerName} / {currentEnemyTrainer.facilityClass.replace('FACILITY_CLASS_', '')}
                </div>
              )}
            </div>
          </div>

          {isSetCompleted && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              {t('setCompleted')}
            </div>
          )}

          <button
            type="button"
            data-tone="primary"
            onClick={continueAfterRoundResult}
            className="pf-action-button mt-7 min-w-[280px] px-6"
          >
            {roundResult === 'WIN' ? <ChevronRight className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            <span>{actionLabel}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
