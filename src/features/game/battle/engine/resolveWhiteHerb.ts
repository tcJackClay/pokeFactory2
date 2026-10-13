import type { StatStages } from '../../../../types';
import { hasItemBattleEffect, itemHasHook } from '../../data/battle';

/**
 * 白色香草（PRD 奖励商店 F6）。
 *
 * 口径对齐参考实现 `reference/pokeemerald-expansion/src/battle_hold_effects.c`：
 * `RestoreWhiteHerbStats()` 从 `STAT_HP` 起遍历 **全部** 能力等级，凡低于默认值（0）
 * 的一律**复原为 0**（不是「还原到本次事件之前的值」），且只有真的复原过才消耗道具。
 * 命中 / 闪避同样在 `NUM_BATTLE_STATS` 之内，因此一并复原。
 *
 * 触发条件由 `data/battle/itemEffects.ts` 的声明驱动（`effectId: 'WHITE_HERB'` +
 * `hooks: ['restore-lowered-stats']`），本模块是这份声明的唯一消费者——
 * 改声明即改行为，逻辑里不出现道具 ID 字面量。
 */
export const RESTORABLE_STAT_STAGE_KEYS = [
  'attack',
  'defense',
  'spAtk',
  'spDef',
  'speed',
  'accuracy',
  'evasion',
] as const;

export type RestorableStatStageKey = typeof RESTORABLE_STAT_STAGE_KEYS[number];

export interface WhiteHerbActivationPlan {
  /** 是否触发（= 持有者身上确实有低于 0 的能力等级）。 */
  shouldActivate: boolean;
  /** 触发后的能力等级；未触发时原样返回。 */
  statStages: StatStages;
  /** 被复原为 0 的能力等级键（可观测，供测试与日志消费）。 */
  restoredStatKeys: RestorableStatStageKey[];
}

/**
 * 判定白色香草是否响应、以及复原后的能力等级。
 * 纯函数：不读道具持有者之外的任何状态，注入 `itemId` 与 `statStages` 即可确定性复现。
 */
export function planWhiteHerbActivation(
  itemId: string | null | undefined,
  statStages: StatStages,
): WhiteHerbActivationPlan {
  if (!itemHasHook(itemId, 'restore-lowered-stats') || !hasItemBattleEffect(itemId, 'WHITE_HERB')) {
    return { shouldActivate: false, statStages, restoredStatKeys: [] };
  }

  const restoredStatKeys = RESTORABLE_STAT_STAGE_KEYS.filter((key) => statStages[key] < 0);
  if (restoredStatKeys.length === 0) {
    return { shouldActivate: false, statStages, restoredStatKeys: [] };
  }

  const restoredStages: StatStages = { ...statStages };
  for (const key of restoredStatKeys) restoredStages[key] = 0;
  return { shouldActivate: true, statStages: restoredStages, restoredStatKeys };
}
