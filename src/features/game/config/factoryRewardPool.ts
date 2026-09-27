import type { GamePokemon } from '../../../types';
import { getItemBattleData, getMoveBattleData, hasAbilityBattleEffect } from '../data/battle';
import { getFactoryShelfSize, getFactoryShopRarityPrice, type FactoryShopRarityTier } from './factoryRewards';

/**
 * 「奖励商店」货架候选池：单一真值源。
 *
 * 口径来源（PRD docs/tasks/奖励商店/prd.md §2.1–§2.4、§F2/F5）：
 * - H = 持有道具候选九件（decisions.md 第 1 条两轮扩池：5 → 7 → 9，白色香草 / 心灵香草本轮纳入）；
 * - E = 三名队员「本局返还基准」（`factoryEquippedHeldItemId`）去重集合，**不得**读本场当前持有物；
 * - 候选 = H \ E，不放回等权抽 `shelfSize`(6) 件；因 9 − 3 = 6，持有道具这一类自己就够摆满货架；
 * - 候选不足 shelfSize 是**缺陷**（正常路径不可达）：抛出 / 断言，不得用重复商品、未验收技能机、
 *   旧奖池或空货位顶替，也不得悄悄少给（`INSUFFICIENT` 防御性语义保留）。
 *
 * 本模块只依赖 `data/battle` 与 `config/factoryRewards`，不 import `rewardPools.ts`，
 * 也不 import `services/saveManager`（避免与存档层互相依赖）。
 */

/** 持有道具候选九件（PRD §2.4，顺序即最终名单）。 */
export const FACTORY_REWARD_HELD_ITEM_IDS = [
  'scope_lens',
  'quick_claw',
  'kings_rock',
  'choice_band',
  'focus_band',
  'heavy_duty_boots',
  'loaded_dice',
  'white_herb',
  'mental_herb',
] as const;

export type FactoryRewardHeldItemId = typeof FACTORY_REWARD_HELD_ITEM_IDS[number];

export function isFactoryRewardHeldItemId(value: unknown): value is FactoryRewardHeldItemId {
  return typeof value === 'string' && FACTORY_REWARD_HELD_ITEM_IDS.some((itemId) => itemId === value);
}

/**
 * 逐件商品的稀有度档位（PRD §2.3 定稿表 / decisions.md 第 12 条，唯一数值源）：
 * 稀有度 3：讲究头带；稀有度 2：焦点镜、王者之证、气势头带、机变骰子、心灵香草；
 * 稀有度 1：先制之爪、厚底靴、白色香草。价格 = 档位数字（见 `getFactoryHeldItemShopPrice`）。
 */
export const FACTORY_HELD_ITEM_SHOP_RARITY: Record<FactoryRewardHeldItemId, FactoryShopRarityTier> = {
  scope_lens: 2,
  quick_claw: 1,
  kings_rock: 2,
  choice_band: 3,
  focus_band: 2,
  heavy_duty_boots: 1,
  loaded_dice: 2,
  white_herb: 1,
  mental_herb: 2,
};

/** 持有道具的兑换价（券）。未知道具返回 `null`（调用方必须如实禁用，不得默认免费）。 */
export function getFactoryHeldItemShopPrice(itemId: string): number | null {
  if (!isFactoryRewardHeldItemId(itemId)) return null;
  return getFactoryShopRarityPrice(FACTORY_HELD_ITEM_SHOP_RARITY[itemId]);
}

/**
 * 商店商品种类（PRD §2.2 / 本阶段 S1）：本阶段只产出持有道具一种，
 * 但类型上**不写死**——后续阶段（进化道具、技能机）在此联合上扩展，
 * 存档货架按 `kind` 区分，不假设所有商品都是持有道具。
 */
export type FactoryShopProductKind = 'HELD_ITEM';

export interface FactoryShopHeldItemProduct {
  kind: 'HELD_ITEM';
  itemId: FactoryRewardHeldItemId;
}

export type FactoryShopProduct = FactoryShopHeldItemProduct;

/** 商品是否为合法持有道具商品（含名单校验）。 */
export function isFactoryShopProduct(value: unknown): value is FactoryShopHeldItemProduct {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.kind === 'HELD_ITEM' && isFactoryRewardHeldItemId(record.itemId);
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
 * PRD 要求「每件候选至少存在一个合法装备对象」由**代码断言**而非默认假设：
 * 只要出现一件无合法对象的候选，即为本任务的缺陷，直接抛出而不是静默补位。
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
 * `INSUFFICIENT` = 候选数少于货架件数（PRD F2.3：9 − 3 = 6 恒可摆满，正常路径不可达），
 * **禁止**重复商品 / 空货位 / 未验收技能机 / 旧奖池 / 进化道具顶替。
 */
export type FactoryRewardDrawResult =
  | { ok: true; shelf: FactoryShopProduct[] }
  | { ok: false; reason: 'INSUFFICIENT'; candidateCount: number };

/**
 * 货架配货：从持有道具候选 `H \ E` 里不放回等权抽 `shelfSize` 件。
 * 候选不足是缺陷（防御性 `INSUFFICIENT`），不得补位或悄悄少给。
 */
export function drawFactoryShopShelf(
  equippedItemIds: readonly (string | null | undefined)[],
  shelfSize: number = getFactoryShelfSize(),
  random: () => number = Math.random,
): FactoryRewardDrawResult {
  const targetCount = Math.max(1, Math.floor(shelfSize));
  const candidates = enumerateFactoryRewardCandidates(equippedItemIds);
  if (candidates.length < targetCount) {
    return { ok: false, reason: 'INSUFFICIENT', candidateCount: candidates.length };
  }
  const itemIds = sampleWithoutReplacement(candidates, targetCount, random);
  return {
    ok: true,
    shelf: itemIds.map((itemId) => ({ kind: 'HELD_ITEM' as const, itemId })),
  };
}

/** 卡面适用性（PRD §3.6 / 奖励商店 F5）：三态，**不得**为凑满货架谎称当局有效。 */
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

/**
 * 卡面诚实判定的唯一真值源（plan §1 命名）。UI 文案必须由本函数驱动。
 * 白色香草 / 心灵香草（PRD F5）：均为「有条件才有用」，按 `CONDITIONAL` 处理，
 * **不得**标成无条件有效（APPLICABLE）。
 */
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
  if (normalizedItemId === 'white_herb') {
    // 只有对手降低过持有者的能力等级才有收益（复原并消耗）；对手不降就是白装。
    return 'CONDITIONAL';
  }
  if (normalizedItemId === 'mental_herb') {
    // 只有对手造成过妨碍状态（挑衅、再来一次等）才有收益；对手不放就是白装。
    return 'CONDITIONAL';
  }
  return 'APPLICABLE';
}
