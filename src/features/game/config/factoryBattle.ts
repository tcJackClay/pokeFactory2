export type FactoryAiTier = 'RANDOM' | 'BASIC' | 'ADVANCED' | 'BOSS';

export const FACTORY_BATTLE_CONFIG = {
  rentalsPerDraft: 6,
  teamSize: 3,
  movesPerMon: 4,
  // Disable legacy Frontier-only set pool so the factory can cover all selected regions/gens.
  useReferenceSetPool: false,
  enemySelectionMode: 'TRAINER_POOL_FIRST',
  trainerPoolFallbackToGlobal: true,
  // 历史租借次数阈值，值越高初始租借池质量越好（对应原作 rental rank）。
  rentalRankThresholds: [15, 22, 29, 36, 43],
  // 用质量偏置模拟原作 Battle Factory 的“区间档位”。
  // 8 档对应 challengeNum 0..7（7 之后按 7 处理）。
  maxChallengeTier: 7,
  fixedIvTable: [
    { normal: 3, boss: 6 },
    { normal: 6, boss: 9 },
    { normal: 9, boss: 12 },
    { normal: 12, boss: 15 },
    { normal: 15, boss: 18 },
    { normal: 21, boss: 31 },
    { normal: 31, boss: 31 },
    { normal: 31, boss: 31 },
  ],
  level50QualityBands: [0, 1, 2, 3, 4, 5, 6, 6],
  openLevelQualityBands: [3, 4, 5, 6, 7, 7, 7, 7],
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

export function getFactoryChallengeNum(stage: number, battlesPerSet: number): number {
  const raw = Math.floor((stage - 1) / battlesPerSet);
  return Math.max(0, Math.min(FACTORY_BATTLE_CONFIG.maxChallengeTier, raw));
}

export function getFactoryQualityBiasByChallenge(level: number, challengeNum: number, useBetterRange: boolean): number {
  const isOpenLevel = level > 50;
  const bands = isOpenLevel
    ? FACTORY_BATTLE_CONFIG.openLevelQualityBands
    : FACTORY_BATTLE_CONFIG.level50QualityBands;
  const maxTier = FACTORY_BATTLE_CONFIG.maxChallengeTier;
  const normalizedChallenge = Math.max(0, Math.min(maxTier, challengeNum));
  const effectiveTier = useBetterRange ? Math.min(maxTier, normalizedChallenge + 1) : normalizedChallenge;
  return bands[effectiveTier];
}

export function getFactoryFixedIvByChallenge(challengeNum: number, isBossBattleInSet: boolean): number {
  const maxTier = FACTORY_BATTLE_CONFIG.maxChallengeTier;
  const normalizedChallenge = Math.max(0, Math.min(maxTier, challengeNum));
  const fixedIv = FACTORY_BATTLE_CONFIG.fixedIvTable[normalizedChallenge];
  return isBossBattleInSet ? fixedIv.boss : fixedIv.normal;
}

export function getAiTier(stage: number, battlesPerSet: number): FactoryAiTier {
  const battleInSet = ((stage - 1) % battlesPerSet) + 1;
  if (battleInSet === battlesPerSet) return 'BOSS';

  const setNo = getSetNoByStage(stage, battlesPerSet);
  if (setNo <= 1) return 'RANDOM';
  if (setNo <= 3) return 'BASIC';
  return 'ADVANCED';
}
