import { BattleFieldPanel } from './BattleFieldPanel';
import type { GameViewSectionProps } from '../shared';

interface BattleViewportRegionProps extends GameViewSectionProps {
  loading: boolean;
}

export function BattleViewportRegion({ viewModel, loading }: BattleViewportRegionProps) {
  const isZh = viewModel.currentLanguage.startsWith('zh');

  return (
    <section className="pf-battle-viewport-region" data-battle-region="viewport" aria-label="Battle viewport">
      <BattleFieldPanel viewModel={viewModel} />
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="rounded-xl border border-white/70 bg-white/88 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600 shadow-lg backdrop-blur">
            {isZh ? '正在同步对战数据...' : 'Syncing battle data...'}
          </div>
        </div>
      )}
    </section>
  );
}
