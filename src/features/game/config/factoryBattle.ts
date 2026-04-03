export type FactoryAiTier = 'RANDOM' | 'BASIC' | 'ADVANCED' | 'BOSS';

export const FACTORY_BATTLE_CONFIG = {
  rentalsPerDraft: 6,
  teamSize: 3,
  movesPerMon: 4,
  // 历史租借次数阈值，越高代表初始租借池质量越好。
  rentalRankThresholds: [15, 22, 29, 36, 43],
  stageTierBonusCap: 5,
  // 用于“同道具去重”的工厂伪持有物池（当前项目未实现真实持有物效果）。
  heldItemPool: [
    'leftovers',
    'choice_band',
    'scope_lens',
    'white_herb',
    'quick_claw',
    'bright_powder',
    'focus_band',
    'mental_herb',
    'kings_rock',
  ],
  boss: {
    extraLevel: 3,
    minIv: 24,
  },
  specialUnlock: {
    unlockBossStage: 21,
    bossExtraLevel: 2,
    bossIvFloor: 28,
  },
} as const;

export function getRentalHistoryRank(totalRents: number): number {
  let rank = 0;
  for (const threshold of FACTORY_BATTLE_CONFIG.rentalRankThresholds) {
    if (totalRents >= threshold) rank += 1;
  }
  return rank;
}

export function getSetNoByStage(stage: number, battlesPerSet: number): number {
  return Math.floor((stage - 1) / battlesPerSet) + 1;
}

export function getAiTier(stage: number, battlesPerSet: number): FactoryAiTier {
  const battleInSet = ((stage - 1) % battlesPerSet) + 1;
  if (battleInSet === battlesPerSet) return 'BOSS';

  const setNo = getSetNoByStage(stage, battlesPerSet);
  if (setNo <= 1) return 'RANDOM';
  if (setNo <= 3) return 'BASIC';
  return 'ADVANCED';
}
