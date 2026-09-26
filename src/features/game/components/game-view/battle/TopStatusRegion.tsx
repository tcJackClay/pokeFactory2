import { TopRecordPanel } from '../TopRecordPanel';
import type { GameViewSectionProps } from '../shared';

export function TopStatusRegion({ viewModel }: GameViewSectionProps) {
  const { currentLanguage, coins, stage, streak } = viewModel;

  return (
    <section className="pf-battle-top-region" data-battle-region="top-status" aria-label="Battle status">
      <TopRecordPanel
        currentLanguage={currentLanguage}
        coins={coins}
        stage={stage}
        streak={streak}
      />
    </section>
  );
}
