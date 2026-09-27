import type { GamePokemon } from '../../../types';
import { getItemBattleData, getMoveBattleData, hasAbilityBattleEffect } from '../data/battle';
import { getFactoryRewardChoiceCount } from './factoryRewards';

/**
 * 「四卡生成」奖励池：单一真值源。
 *
 * 口径来源（PRD docs/tasks/四卡生成/prd.md §3.1–§3.3、§3.6）：
 * - H = 基础保底七件（design.md §1.1 + decisions.md 第 1 条裁决）；
 * - E = 三名队员「本局返还基准」（`factoryEquippedHeldItemId`）去重集合，**不得**读本场当前持有物；
 * - 候选 = H \ E，不放回等权抽 min(4, |候选|)，不设权重、不固定 ITEM/TM 配比；
 * - TM 候选恒为空（allowlist 0/50），本模块不引入 TM 来源。
 *
 * 本模块只依赖 `data/battle` 与 `config/factoryRewards`，不 import `rewardPools.ts`，
 * 也不 import `services/saveManager`（避免与存档层互相依赖）。
 */

/** 基础保底七件（PRD §3.1）。 */
export const FACTORY_REWARD_HELD_ITEM_IDS = [
  'scope_lens',
  'quick_claw',
  'kings_rock',
  'choice_band',
  'focus_band',
  'heavy_duty_boots',
  'loaded_dice',
] as const;

export type FactoryRewardHeldItemId = typeof FACTORY_REWARD_HELD_ITEM_IDS[number];

export function isFactoryRewardHeldItemId(value: unknown): value is FactoryRewardHeldItemId {
  return typeof value === 'string' && FACTORY_REWARD_HELD_ITEM_IDS.some((itemId) => itemId === value);
}

/**
 * 装备位 ID 归一：与 `getItemBattleData().id` 同一口径（连字符/下划线/大小写等价）。
 * 空串与 `undefined` 归一为 `null`（表示空装备位）。
 */
export function normalizeFactoryHeldItemId(itemId?: string | null): string | null {
  if (typeof itemId !== 'string') return null;
  return getItemBattleData(itemId)?.id ?? null;
}

/** E：三名队员「本局返还基准」去重集合（`null`/空串剔除）。 */
export function getFactoryRewardEquippedItemIds(
  equippedItemIds: readonly (string | null | undefined)[],
): string[] {
  const normalized = new Set<string>();
  for (const rawItemId of equippedItemIds) {
    const itemId = normalizeFactoryHeldItemId(rawItemId);
    if (itemId) normalized.add(itemId);
  }
  return [...normalized];
}

/**
 * 合法装备对象判定：存在队员 `targetIndex`，装备 `itemId` 后三人返还基准仍互不重复。
 * 纯函数版本，`saveManager.canEquipRewardItem` 委托本函数（单一真值源）。
 */
export function canEquipFactoryRewardItem(
  equippedItemIds: readonly (string | null | undefined)[],
  itemId: FactoryRewardHeldItemId,
  targetIndex: number,
): boolean {
  if (!Number.isSafeInteger(targetIndex) || targetIndex < 0 || targetIndex >= equippedItemIds.length) return false;
  if (normalizeFactoryHeldItemId(equippedItemIds[targetIndex]) === itemId) return false;
  const nextIds = equippedItemIds
    .map((rawItemId, index) => (index === targetIndex ? itemId : normalizeFactoryHeldItemId(rawItemId)))
    .filter((normalized): normalized is string => Boolean(normalized));
  return new Set(nextIds).size === nextIds.length;
}

/**
 * 候选枚举：`H \ E`。
 *
 * PRD §3.2 要求「每张候选至少存在一个合法装备对象」由**代码断言**而非默认假设：
 * 只要出现一张无合法对象的候选，即为本任务的缺陷，直接抛出而不是静默补位。
 */
export function enumerateFactoryRewardCandidates(
  equippedItemIds: readonly (string | null | undefined)[],
): FactoryRewardHeldItemId[] {
  const equipped = new Set(getFactoryRewardEquippedItemIds(equippedItemIds));
  const candidates = FACTORY_REWARD_HELD_ITEM_IDS.filter((itemId) => !equipped.has(itemId));
  const withoutLegalTarget = candidates.filter((itemId) => (
    !equippedItemIds.some((_, targetIndex) => canEquipFactoryRewardItem(equippedItemIds, itemId, targetIndex))
  ));
  if (withoutLegalTarget.length > 0) {
    throw new Error(`Factory reward candidates have no legal teammate: ${withoutLegalTarget.join(', ')}`);
  }
  return [...candidates];
}

/** 不放回等权抽样（局部 Fisher–Yates，`random` 注入以便确定性夹具）。 */
function sampleWithoutReplacement<T>(values: readonly T[], count: number, random: () => number): T[] {
  const pool = [...values];
  const sampled: T[] = [];
  for (let index = 0; index < count; index += 1) {
    const roll = Math.max(0, Math.min(0.999999999, random()));
    const pickIndex = index + Math.floor(roll * (pool.length - index));
    const picked = pool[pickIndex];
    pool[pickIndex] = pool[index];
    pool[index] = picked;
    sampled.push(picked);
  }
  return sampled;
}

/**
 * 抽样结果。
 * `INSUFFICIENT` = 候选数少于目标张数（PRD 边界 B），**禁止**重复卡 / 空卡 / 旧奖池 / 未验收 TM 补位。
 */
export type FactoryRewardDrawResult =
  | { ok: true; cards: FactoryRewardHeldItemId[] }
  | { ok: false; reason: 'INSUFFICIENT'; candidateCount: number };

export function drawFactoryRewardCards(
  equippedItemIds: readonly (string | null | undefined)[],
  count: number = getFactoryRewardChoiceCount(),
  random: () => number = Math.random,
): FactoryRewardDrawResult {
  const targetCount = Math.max(1, Math.floor(count));
  const candidates = enumerateFactoryRewardCandidates(equippedItemIds);
  if (candidates.length < targetCount) {
    return { ok: false, reason: 'INSUFFICIENT', candidateCount: candidates.length };
  }
  return { ok: true, cards: sampleWithoutReplacement(candidates, targetCount, random) };
}

/** 卡面适用性（PRD §3.6）：三态，**不得**为凑满四张谎称当局有效。 */
export type FactoryRewardApplicability = 'APPLICABLE' | 'CONDITIONAL' | 'NO_TRIGGER';

/**
 * 机变骰子触发场景：该队员是否持有合格连续攻击招式，且骰子确实会改变命中次数。
 *
 * 与引擎 `resolveMoveStrikes.ts` 的 `LOADED_DICE` 分支**同构**：
 * `hasItemBattleEffect(item,'LOADED_DICE') && minHits === 2 && maxHits === 5`，
 * 其中 `minHits = max(1, battleData.minHits)`、`maxHits = max(guaranteedHits, battleData.maxHits)`、
 * `guaranteedHits = battleData.guaranteedHits ?? max(1, battleData.minHits)`。
 * 另外引擎里 `SKILL_LINK` 分支**优先于** `LOADED_DICE`（持有连续攻击特性时骰子不改变命中次数），
 * 因此这类队员**不计入**受影响名单 —— 宁可少报，不可错报。
 */
export function hasLoadedDiceTrigger(pokemon: GamePokemon): boolean {
  const primaryAbility = pokemon.abilities?.[0]?.ability?.name;
  if (hasAbilityBattleEffect(primaryAbility, 'SKILL_LINK')) return false;
  return (pokemon.selectedMoves ?? []).some((move) => {
    const battleData = getMoveBattleData(move);
    if (!battleData || battleData.strikeMode === 'single') return false;
    const guaranteedHits = battleData.guaranteedHits ?? Math.max(1, battleData.minHits);
    const maxHits = Math.max(guaranteedHits, battleData.maxHits);
    const minHits = Math.max(1, battleData.minHits);
    return minHits === 2 && maxHits === 5;
  });
}

/** 卡面诚实判定的唯一真值源（plan §1 命名）。UI 文案必须由本函数驱动。 */
export function getRewardApplicability(
  pokemon: GamePokemon,
  itemId: string | null | undefined,
): FactoryRewardApplicability {
  const normalizedItemId = normalizeFactoryHeldItemId(itemId);
  if (normalizedItemId === 'loaded_dice') return hasLoadedDiceTrigger(pokemon) ? 'APPLICABLE' : 'NO_TRIGGER';
  if (normalizedItemId === 'heavy_duty_boots') {
    // 陷阱由对手在战斗中铺设，奖励时刻不可判定 ⇒ 恒为条件性说明。
    return 'CONDITIONAL';
  }
  return 'APPLICABLE';
}
