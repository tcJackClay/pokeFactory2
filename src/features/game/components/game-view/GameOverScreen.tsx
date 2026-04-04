import { motion, useReducedMotion } from 'motion/react';
import { RefreshCw, Skull, TriangleAlert } from 'lucide-react';
import type { GameViewSectionProps } from './shared';

export function GameOverScreen({ viewModel }: GameViewSectionProps) {
  const { stage, currentLanguage, t, enterBase } = viewModel;
  const shouldReduceMotion = useReducedMotion();
  const isZh = currentLanguage.startsWith('zh');

  return (
    <motion.div
      key="gameover"
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
      className="flex flex-1 items-center justify-center p-4"
    >
      <div className="pf-result-shell relative w-full max-w-[820px] p-6 sm:p-8" data-tone="danger">
        <div className="relative z-10 text-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full border border-rose-200 bg-rose-50 shadow-sm sm:h-24 sm:w-24">
            <Skull className="h-10 w-10 text-rose-500 sm:h-12 sm:w-12" />
          </div>

          <h2 className={`mt-5 text-slate-950 ${isZh ? 'text-[34px] font-black' : 'text-[32px] font-black uppercase tracking-[0.05em]'}`}>
            {t('gameOver')}
          </h2>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="pf-result-metric-card text-left">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {isZh ? '倒下位置' : 'End Point'}
              </div>
              <div className="mt-2 text-lg font-black text-slate-900">{t('reachedFloor', { stage })}</div>
            </div>

            <div className="pf-result-metric-card text-left">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {isZh ? '状态' : 'Status'}
              </div>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-black text-rose-700">
                <TriangleAlert className="h-4 w-4" />
                {isZh ? '挑战失败' : 'Run Failed'}
              </div>
            </div>
          </div>

          <button
            type="button"
            data-tone="primary"
            onClick={enterBase}
            className="pf-action-button mt-7 min-w-[280px] px-6"
          >
            <RefreshCw className="h-4 w-4" />
            <span>{t('restart')}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
