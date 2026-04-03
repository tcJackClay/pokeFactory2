export type BattleResult = 'WIN' | 'LOSS';

export interface FactoryRewardConfig {
  battlesPerSet: number;
  winBaseReward: number;
  winSetFinalBattleBonus: number;
  setIndexBonusBySetNo: number[];
  lossBaseReward: number;
  lossMinReward: number;
}

// 代币平衡入口：后续只需要调整这一份配置。
export const FACTORY_REWARD_CONFIG: FactoryRewardConfig = {
  battlesPerSet: 7,
  winBaseReward: 4,
  winSetFinalBattleBonus: 4,
  // setNo 从 1 开始；超过表长度时复用最后一档。
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
