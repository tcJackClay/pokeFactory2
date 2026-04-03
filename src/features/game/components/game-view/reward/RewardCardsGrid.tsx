import { RewardCard } from './RewardCard';
import type { GameViewSectionProps } from '../shared';

export function RewardCardsGrid({ viewModel }: GameViewSectionProps) {
  const { rewards } = viewModel;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
        {rewards.map((reward, index) => (
          <div key={`${reward.type}-${index}`}>
            <RewardCard viewModel={viewModel} reward={reward} index={index} />
          </div>
        ))}
      </div>
    </div>
  );
}
