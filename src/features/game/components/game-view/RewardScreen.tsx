import { FactoryItemRewardScreen } from './reward/FactoryItemRewardScreen';
import type { GameViewSectionProps } from './shared';

/**
 * `gameState === 'REWARD'` 路由的唯一入口：渲染「四卡持有物奖励」屏。
 * 旧六卡奖池屏（ITEM/POKEMON/TM/EVOLUTION + 重抽）已不再被本路由使用
 * （PRD：旧奖池路径只需不再使用，不要求清理）。
 */
export function RewardScreen({ viewModel }: GameViewSectionProps) {
  return <FactoryItemRewardScreen viewModel={viewModel} />;
}
