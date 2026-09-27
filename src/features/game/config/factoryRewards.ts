export type BattleResult = 'WIN' | 'LOSS';

// Battle Factory singles, reference/pokeemerald-expansion/src/frontier_util.c.
export const FACTORY_SINGLES_BP = [3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15, 15, 15] as const;
export const MAX_FACTORY_BP = 9999;

export function getFactorySetBp(setNo: number): number {
  if (!Number.isSafeInteger(setNo) || setNo < 1) throw new Error('Invalid factory set.');
  return FACTORY_SINGLES_BP[Math.min(setNo - 1, FACTORY_SINGLES_BP.length - 1)];
}

export function getFactoryGroupBp(stage: number, result: BattleResult, isFrontierBrain: boolean): number {
  if (result !== 'WIN' || getBattleIndexInSet(stage) !== FACTORY_REWARD_CONFIG.battlesPerSet) return 0;
  return getFactorySetBp(getSetNoByStage(stage)) + (isFrontierBrain ? 10 : 0);
}

export interface FactoryRewardConfig {
  battlesPerSet: number;
  freeRewardChoiceCount: number;
  preBattleRewardBattlesInSet: number[];
}

export const FACTORY_REWARD_CONFIG: FactoryRewardConfig = {
  battlesPerSet: 7,
  freeRewardChoiceCount: 4,
  preBattleRewardBattlesInSet: [4, 7],
};

export function getSetNoByStage(stage: number, battlesPerSet = FACTORY_REWARD_CONFIG.battlesPerSet): number {
  return Math.floor((stage - 1) / battlesPerSet) + 1;
}

export function getBattleIndexInSet(stage: number, battlesPerSet = FACTORY_REWARD_CONFIG.battlesPerSet): number {
  return ((stage - 1) % battlesPerSet) + 1;
}

export function getFactoryRewardChoiceCount(config: FactoryRewardConfig = FACTORY_REWARD_CONFIG): number {
  return Math.max(1, Math.floor(config.freeRewardChoiceCount));
}

export function getPreBattleRewardBattlesInSet(config: FactoryRewardConfig = FACTORY_REWARD_CONFIG): number[] {
  const validBattles = config.preBattleRewardBattlesInSet
    .map((battleNo) => Math.floor(battleNo))
    .filter((battleNo) => battleNo >= 1 && battleNo <= config.battlesPerSet);

  return [...new Set(validBattles)].sort((a, b) => a - b);
}

export function shouldTriggerPreBattleRewardStage(stage: number, config: FactoryRewardConfig = FACTORY_REWARD_CONFIG): boolean {
  const battleInSet = getBattleIndexInSet(stage, config.battlesPerSet);
  return getPreBattleRewardBattlesInSet(config).includes(battleInSet);
}

/**
 * 奖励节点锚点（PRD §1）：该战是否为「奖励前的战前阶段」。
 * 玩家可见表述 = 进入组内第 4、7 战的战前阶段；`preBattleRewardBattlesInSet` 是唯一数值源。
 */
export function isFactoryRewardPreBattle(stage: number, config: FactoryRewardConfig = FACTORY_REWARD_CONFIG): boolean {
  if (!Number.isSafeInteger(stage) || stage < 1) return false;
  return shouldTriggerPreBattleRewardStage(stage, config);
}

/**
 * 换怪锚点：刚赢下的这一战（组内第 3、6 战）结束后是否需要进入奖励节点。
 * 等价于「下一战 stage + 1 是奖励前战」，与 `isFactoryRewardPreBattle` 共用同一数值源。
 */
export function shouldEnterRewardAfterWinning(stage: number, config: FactoryRewardConfig = FACTORY_REWARD_CONFIG): boolean {
  if (!Number.isSafeInteger(stage) || stage < 1) return false;
  return shouldTriggerPreBattleRewardStage(stage + 1, config);
}
