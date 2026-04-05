import { RewardCard } from './RewardCard';
import type { GameViewSectionProps } from '../shared';

export function RewardCardsGrid({ viewModel }: GameViewSectionProps) {
  const { rewards } = viewModel;
  const visibleRewards = rewards.filter((reward) => {
    if (reward.type !== 'EVOLUTION') return true;
    return Array.isArray(reward.data?.eligibleIndexes) && reward.data.eligibleIndexes.length > 0;
  });

  return (
    <div className="custom-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto pr-1">
      <div className="grid grid-cols-1 gap-3 pb-2 md:grid-cols-2 xl:grid-cols-3">
        {visibleRewards.map((reward, index) => (
          <RewardCard
            key={`${reward.type}-${index}`}
            viewModel={viewModel}
            reward={reward}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
