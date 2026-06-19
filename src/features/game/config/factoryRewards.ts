export type BattleResult = 'WIN' | 'LOSS';

export interface FactoryRewardConfig {
  battlesPerSet: number;
  freeRewardChoiceCount: number;
  preBattleRewardBattlesInSet: number[];
  winBaseReward: number;
  winSetFinalBattleBonus: number;
  setIndexBonusBySetNo: number[];
  lossBaseReward: number;
  lossMinReward: number;
}

export const FACTORY_REWARD_CONFIG: FactoryRewardConfig = {
  battlesPerSet: 7,
  freeRewardChoiceCount: 4,
  preBattleRewardBattlesInSet: [4, 7],
  winBaseReward: 4,
  winSetFinalBattleBonus: 4,
  setIndexBonusBySetNo: [0, 1, 2, 3, 4, 5],
  lossBaseReward: 1,
  lossMinReward: 1,
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

export function getFactoryTokenReward(stage: number, result: BattleResult, config: FactoryRewardConfig = FACTORY_REWARD_CONFIG): number {
  const setNo = getSetNoByStage(stage, config.battlesPerSet);
  const battleInSet = getBattleIndexInSet(stage, config.battlesPerSet);
  const setBonusIdx = Math.min(Math.max(setNo - 1, 0), config.setIndexBonusBySetNo.length - 1);
  const setBonus = config.setIndexBonusBySetNo[setBonusIdx] ?? 0;

  if (result === 'LOSS') {
    return Math.max(config.lossMinReward, config.lossBaseReward + setBonus);
  }

  const finalBattleBonus = battleInSet === config.battlesPerSet ? config.winSetFinalBattleBonus : 0;
  return config.winBaseReward + setBonus + finalBattleBonus;
}
