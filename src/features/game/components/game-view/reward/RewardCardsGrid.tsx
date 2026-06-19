import { RewardCard } from './RewardCard';
import type { GameReward } from '../../../view-model';
import type { GameViewSectionProps } from '../shared';

interface RewardCardsGridProps extends GameViewSectionProps {
  rewardsToShow: Array<{ key: string; reward: GameReward }>;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

export function RewardCardsGrid({ viewModel, rewardsToShow, selectedKey, onSelect }: RewardCardsGridProps) {

  return (
    <div className="custom-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto pr-1">
      <div className="mx-auto grid w-full max-w-[920px] grid-cols-1 gap-2 pb-2 min-[480px]:grid-cols-2 xl:grid-cols-3">
        {rewardsToShow.map((entry) => (
          <RewardCard
            key={entry.key}
            viewModel={viewModel}
            reward={entry.reward}
            isSelected={selectedKey === entry.key}
            onSelect={() => onSelect(entry.key)}
          />
        ))}
      </div>
    </div>
  );
}
