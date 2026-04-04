import { ALL_ITEMS } from '../../../uiAppConstants';
import type { Item } from '../../../types';

type FreeRewardType = 'ITEM' | 'POKEMON' | 'TM' | 'EVOLUTION';

export const FREE_REWARD_TYPE_WEIGHTS: Record<FreeRewardType, number> = {
  ITEM: 3,
  POKEMON: 2,
  TM: 1,
  EVOLUTION: 1,
};

const FREE_REWARD_ITEM_IDS = [
  'potion',
  'heal',
  'battle_atk',
  'battle_def',
  'special_mega_stone',
  'special_dmax_band',
  'special_tera_orb',
  'special_z_crystal',
] as const;

const SHOP_REWARD_ITEM_IDS = [
  ...FREE_REWARD_ITEM_IDS,
  'team_capacity_permit',
] as const;

function mapIdsToItems(ids: readonly string[]): Item[] {
  const idSet = new Set(ids);
  return ALL_ITEMS.filter((item) => idSet.has(item.id));
}

export function getFreeRewardItemPool(canGainTeamCapacity: boolean): Item[] {
  const pool = mapIdsToItems(FREE_REWARD_ITEM_IDS);
  if (canGainTeamCapacity) {
    const capacityPermit = ALL_ITEMS.find((item) => item.id === 'team_capacity_permit');
    if (capacityPermit) pool.push(capacityPermit);
  }
  return pool;
}

export function getShopRewardItemPool(canGainTeamCapacity: boolean): Item[] {
  const pool = mapIdsToItems(SHOP_REWARD_ITEM_IDS);
  if (!canGainTeamCapacity) {
    return pool.filter((item) => item.id !== 'team_capacity_permit');
  }
  return pool;
}

export function pickWeightedRewardType(
  weights: Record<FreeRewardType, number>,
  allowedTypes: FreeRewardType[],
): FreeRewardType {
  const filtered = allowedTypes.filter((type) => (weights[type] ?? 0) > 0);
  if (filtered.length === 0) return 'POKEMON';

  const totalWeight = filtered.reduce((sum, type) => sum + (weights[type] ?? 0), 0);
  let roll = Math.random() * totalWeight;
  for (const type of filtered) {
    roll -= (weights[type] ?? 0);
    if (roll <= 0) return type;
  }
  return filtered[filtered.length - 1];
}
