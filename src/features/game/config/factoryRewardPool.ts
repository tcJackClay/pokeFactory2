import type { GamePokemon } from '../../../types';
import { getItemBattleData, getMoveBattleData, hasAbilityBattleEffect } from '../data/battle';
import { getFactoryShelfSize, getFactoryShopRarityPrice, type FactoryShopRarityTier } from './factoryRewards';
import {
  FACTORY_EVOLUTION_ITEM_EXCLUDED_IDS,
  getFactoryEvolutionItemPrice,
  isFactoryEvolutionItemId,
  type FactoryEvolutionItemId,
} from './factoryEvolutionItems';

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
 * 商店商品种类（PRD §2.2）：持有道具与进化道具两类。
 * 存档货架按 `kind` 区分，不假设所有商品都是持有道具。
 */
export type FactoryShopProductKind = 'HELD_ITEM' | 'EVOLUTION_ITEM';

export interface FactoryShopHeldItemProduct {
  kind: 'HELD_ITEM';
  itemId: FactoryRewardHeldItemId;
}

/**
 * 进化道具商品的可用对象（冻结在货架上）：
 * 兑换时无需再取数，UI 说明也能由数据驱动地写出「把谁进化成谁」（PRD F4.2 / F5.3）。
 * 同一名队员可能有多个进化目标（数据给出多个就**必须**由玩家选，不得静默取第一个）。
 */
export interface FactoryShopEvolutionTarget {
  /** 队员下标（`playerTeam` 中的位置）。 */
  targetIndex: number;
  /** 冻结时的进化**前**物种：兑换时队员若已不是这个物种，本目标即失效（不得静默顶替）。 */
  fromSpeciesId: number;
  fromPokeApiName: string;
  toSpeciesId: number;
  /** 进化后物种的 PokeAPI slug（取数用，与语言无关）。 */
  toPokeApiName: string;
  toNameZh: string;
  toNameEn: string;
}

/**
 * 进化道具商品：`itemId` 是道具本身，`targets` 是「队里哪些队员用得上的哪些形态」。
 * 同一种道具在货架上**只出现一件**（即使多名队员可用），由玩家在兑换时选队员。
 */
export interface FactoryShopEvolutionItemProduct {
  kind: 'EVOLUTION_ITEM';
  itemId: FactoryEvolutionItemId;
  targets: FactoryShopEvolutionTarget[];
}

export type FactoryShopProduct = FactoryShopHeldItemProduct | FactoryShopEvolutionItemProduct;

function isFactoryShopEvolutionTarget(value: unknown): value is FactoryShopEvolutionTarget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Number.isSafeInteger(record.targetIndex) && (record.targetIndex as number) >= 0
    && Number.isSafeInteger(record.fromSpeciesId) && (record.fromSpeciesId as number) > 0
    && typeof record.fromPokeApiName === 'string' && record.fromPokeApiName.length > 0
    && Number.isSafeInteger(record.toSpeciesId) && (record.toSpeciesId as number) > 0
    && (record.fromSpeciesId as number) !== (record.toSpeciesId as number)
    && typeof record.toPokeApiName === 'string' && record.toPokeApiName.length > 0
    && typeof record.toNameZh === 'string'
    && typeof record.toNameEn === 'string';
}

/** 商品是否为合法商店商品（持有道具或进化道具，后者含名单与排除项校验）。 */
export function isFactoryShopProduct(value: unknown): value is FactoryShopProduct {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.kind === 'HELD_ITEM') return isFactoryRewardHeldItemId(record.itemId);
  if (record.kind !== 'EVOLUTION_ITEM') return false;
  if (!isFactoryEvolutionItemId(record.itemId)) return false;
  if (FACTORY_EVOLUTION_ITEM_EXCLUDED_IDS.has(record.itemId)) return false;
  const targets = record.targets;
  if (!Array.isArray(targets) || targets.length === 0) return false;
  if (!targets.every(isFactoryShopEvolutionTarget)) return false;
  // 同一 (队员, 进化后物种) 只允许出现一次；不同目标物种可以并存。
  const keys = targets.map((target) => `${target.targetIndex}:${target.toSpeciesId}`);
  return new Set(keys).size === keys.length;
}

/** 商品兑换价（券）：持有道具按稀有度档，进化道具统一 3 券。未知返回 `null`（调用方必须禁用）。 */
export function getFactoryShopProductPrice(product: FactoryShopProduct): number | null {
  return product.kind === 'HELD_ITEM'
    ? getFactoryHeldItemShopPrice(product.itemId)
    : getFactoryEvolutionItemPrice(product.itemId);
}

/**
 * 商品此刻是否**仍可兑换**：
 * - 持有道具：至少存在一个合法装备对象（返还基准替换后仍互不重复）；
 * - 进化道具：至少有一个冻结目标**尚未失效**（队员当前物种仍等于冻结时的 `fromSpeciesId`）。
 *   同一件道具即使多名队员可用，只要还有一名可用就仍可兑换。
 */
export function isFactoryShopProductUsable(
  equippedItemIds: readonly (string | null | undefined)[],
  team: readonly GamePokemon[],
  product: FactoryShopProduct,
): boolean {
  if (product.kind === 'HELD_ITEM') {
    return equippedItemIds.some((_, index) => canEquipFactoryRewardItem(equippedItemIds, product.itemId, index));
  }
  return product.targets.some((target) => {
    const pokemon = team[target.targetIndex];
    return pokemon?.speciesId === target.fromSpeciesId
      && (pokemon.formLedgerSlug || pokemon.pokeApiName || pokemon.name)?.toLowerCase() === target.fromPokeApiName;
  });
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
 * `INSUFFICIENT` = 候选数少于货架件数（PRD F2.3：持有道具一类 `9 − 3 = 6` 恒可摆满，
 * 正常路径不可达），**禁止**重复商品 / 空货位 / 未验收技能机 / 旧奖池顶替。
 */
export type FactoryRewardDrawResult =
  | { ok: true; shelf: FactoryShopProduct[] }
  | { ok: false; reason: 'INSUFFICIENT'; candidateCount: number };

/**
 * 商店候选全集（PRD F2.1）：
 * `候选 = 持有道具候选(H \ E) ∪ 队里用得上的进化道具`。
 *
 * - 持有道具候选恒有 `9 − 3 = 6` 件，**自成一类就够摆满货架**；
 * - 进化道具**不参与**「同一种类 1 件」的名额（当场消耗），因此整件道具在候选里只出现一次，
 *   多名队员可用时体现在该件商品的 `targets` 上；
 * - 顺序（货架抽屉与验收脚本共同依赖，单测锁定）：先持有道具（配置顺序），后进化道具（配置顺序）。
 */
export function enumerateFactoryShopCandidates(
  equippedItemIds: readonly (string | null | undefined)[],
  evolutionProducts: readonly FactoryShopEvolutionItemProduct[] = [],
): FactoryShopProduct[] {
  const heldItems: FactoryShopHeldItemProduct[] = enumerateFactoryRewardCandidates(equippedItemIds)
    .map((itemId) => ({ kind: 'HELD_ITEM' as const, itemId }));
  return [...heldItems, ...evolutionProducts];
}

export interface DrawFactoryShopShelfOptions {
  /** 三名队员的本局返还基准（只读 `factoryEquippedHeldItemId`）。 */
  equippedItemIds: readonly (string | null | undefined)[];
  /** 队里用得上的进化道具（已解析出目标）；没人用得上时为空数组。 */
  evolutionProducts?: readonly FactoryShopEvolutionItemProduct[];
  /** 货架件数，默认取配置（6）。 */
  shelfSize?: number;
  /** 注入随机源以便确定性验收。 */
  random?: () => number;
}

/**
 * 货架配货（PRD F2.2）：从候选里**不放回等权抽** `shelfSize` 件，每件机会相同、不规定比例。
 * 因持有道具候选恒有 6 件，货架**永远能摆满 6 件**；不足 6 件视为**缺陷**
 * （返回 `INSUFFICIENT`，调用方必须抛错/上报，不得补位、不得重复、不得悄悄少给）。
 */
export function drawFactoryShopShelf(
  equippedItemIds: readonly (string | null | undefined)[],
  shelfSize?: number,
  random?: () => number,
): { ok: true; shelf: FactoryShopHeldItemProduct[] } | { ok: false; reason: 'INSUFFICIENT'; candidateCount: number };
export function drawFactoryShopShelf(options: DrawFactoryShopShelfOptions): FactoryRewardDrawResult;
export function drawFactoryShopShelf(
  optionsOrEquipped: DrawFactoryShopShelfOptions | readonly (string | null | undefined)[],
  legacyShelfSize?: number,
  legacyRandom?: () => number,
): FactoryRewardDrawResult {
  const options: DrawFactoryShopShelfOptions = Array.isArray(optionsOrEquipped)
    ? { equippedItemIds: optionsOrEquipped, shelfSize: legacyShelfSize, random: legacyRandom }
    : optionsOrEquipped as DrawFactoryShopShelfOptions;
  const { equippedItemIds, evolutionProducts = [], shelfSize = getFactoryShelfSize(), random = Math.random } = options;
  const targetCount = Math.max(1, Math.floor(shelfSize));
  const candidates = enumerateFactoryShopCandidates(equippedItemIds, evolutionProducts);
  if (candidates.length < targetCount) {
    return { ok: false, reason: 'INSUFFICIENT', candidateCount: candidates.length };
  }
  return { ok: true, shelf: sampleWithoutReplacement(candidates, targetCount, random) };
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
