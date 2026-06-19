import { Coins, Sparkles, Trophy } from 'lucide-react';
import type { GameViewSectionProps } from '../shared';

interface RewardHeaderProps extends GameViewSectionProps {
  rewardCount: number;
}

export function RewardHeader({
  viewModel,
  rewardCount,
}: RewardHeaderProps) {
  const { coins, currentLanguage, t } = viewModel;
  const isZh = currentLanguage.startsWith('zh');
  const rewardLabel = isZh ? `${rewardCount}\u9009\u0031\u5956\u52b1` : `Choose 1 of ${rewardCount} Rewards`;

  return (
    <div className="relative z-10 mb-3">
      <div className="pf-command-bar">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 shadow-sm">
              <Trophy className="h-3.5 w-3.5" />
              {t('victory')}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm">
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              {coins}
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-[16px] border border-slate-200 bg-white/92 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            {rewardLabel}
            <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">
              {rewardCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
