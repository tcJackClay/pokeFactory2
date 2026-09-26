import { BattleActionPanel } from './BattleActionPanel';
import type { GameViewSectionProps } from '../shared';

interface BattleCommandRegionProps extends GameViewSectionProps {
  active: boolean;
}

export function BattleCommandRegion({ viewModel, active }: BattleCommandRegionProps) {
  return (
    <section className="pf-battle-command-region" data-battle-region="commands" aria-label="Battle commands">
      {active ? <BattleActionPanel viewModel={viewModel} /> : <div className="pf-battle-action-shell" />}
    </section>
  );
}
