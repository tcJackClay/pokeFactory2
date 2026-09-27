import type { GamePokemon } from '../../../types';
import { normalizeFactoryHeldItemId } from './factoryRewardPool';

/**
 * 三人「本局返还基准」唯一性 —— 全任务不变量（PRD 边界「任何写入路径都必须维持」
 * + Orchestrator 裁决补遗一）。本模块是检测与修复的**单一真值源**，只做纯函数。
 *
 * 口径（三条硬约束）：
 * 1. 只读 `factoryEquippedHeldItemId`（本局返还基准），**不读** `factoryHeldItemId`（本场当前持有物）。
 *    战斗中被打落/消耗属于「暂时不在手」，按既有语义该件仍在队，若误读会放出重复卡。
 * 2. 修复只改「本局返还基准」一个字段：与前面队员重复者，优先回落其 `factoryOriginalHeldItemId`
 *    （租借原配，**永不改写、永不丢弃**）；原配也被在队持有时才置为空装备位。
 * 3. **从不触碰** `factoryOriginalHeldItemId` 与 `inventoryItemIds` ⇒ 不构成「静默侵占玩家资产」；
 *    修复与否由调用方以 `heldItemBaselineRepaired` 如实上报，不静默。
 */

export interface FactoryHeldItemDuplicate {
  itemId: string;
  /** 出现该基准的队员下标，升序；`indices[0]` 为被保留的持有者。 */
  indices: number[];
}

export type FactoryHeldItemTeamMember = Pick<GamePokemon, 'factoryEquippedHeldItemId' | 'factoryOriginalHeldItemId'>;

/** 归一后的返还基准（`null` = 空装备位）。 */
export function getFactoryHeldItemBaselines(team: readonly FactoryHeldItemTeamMember[]): Array<string | null> {
  return team.map((member) => normalizeFactoryHeldItemId(member.factoryEquippedHeldItemId));
}

/** 归一后的在队持有物 ID 集合（用于生成期排除、存档迁移等只关心集合的场景）。 */
export function getFactoryHeldItemInTeamIds(team: readonly FactoryHeldItemTeamMember[]): string[] {
  const ids = new Set<string>();
  for (const itemId of getFactoryHeldItemBaselines(team)) {
    if (itemId) ids.add(itemId);
  }
  return [...ids];
}

/** 检测重复（只报 >1 次的基准）。 */
export function findFactoryHeldItemDuplicates(team: readonly FactoryHeldItemTeamMember[]): FactoryHeldItemDuplicate[] {
  const byItemId = new Map<string, number[]>();
  getFactoryHeldItemBaselines(team).forEach((itemId, index) => {
    if (!itemId) return;
    const indices = byItemId.get(itemId);
    if (indices) indices.push(index);
    else byItemId.set(itemId, [index]);
  });
  return [...byItemId.entries()]
    .filter(([, indices]) => indices.length > 1)
    .map(([itemId, indices]) => ({ itemId, indices }));
}

export function isFactoryHeldItemTeamUnique(team: readonly FactoryHeldItemTeamMember[]): boolean {
  return findFactoryHeldItemDuplicates(team).length === 0;
}

export interface FactoryHeldItemRepair<T> {
  /** 修复后的队伍（未发生修复时逐项原样返回）。 */
  team: T[];
  repaired: boolean;
  /** 因重复被改判的队员下标（升序）。 */
  repairedIndices: number[];
  /** 其中回落为空装备位的下标（该队员的原配也被在队持有）。 */
  clearedIndices: number[];
  /** 修复前检测到的重复。 */
  duplicates: FactoryHeldItemDuplicate[];
}

/**
 * 修复不变量：保留首个持有者，其余重复者回落原配或空位。
 *
 * @param options.keepIndices 必须优先保留的下标（例如已落盘的 `CLAIMED` 领取目标），
 *   它们先占用各自的基准，因此不会被后加的下标抢走。
 */
export function repairFactoryHeldItemBaselines<T extends FactoryHeldItemTeamMember>(
  team: readonly T[],
  options: { keepIndices?: readonly number[] } = {},
): FactoryHeldItemRepair<T> {
  const duplicates = findFactoryHeldItemDuplicates(team);
  const taken = new Set<string>();
  const repairedIndices: number[] = [];
  const clearedIndices: number[] = [];
  const settled = new Set<number>();
  const result: Array<T | null> = team.map(() => null);

  // ① 先锁定必须保留的下标（CLAIMED 领取目标优先于「下标最小者优先」）。
  for (const index of options.keepIndices ?? []) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= team.length || settled.has(index)) continue;
    const itemId = normalizeFactoryHeldItemId(team[index].factoryEquippedHeldItemId);
    if (!itemId || taken.has(itemId)) continue;
    taken.add(itemId);
    settled.add(index);
    result[index] = team[index];
  }

  // ② 其余队员按下标升序保留首个持有者。
  team.forEach((member, index) => {
    if (settled.has(index)) return;
    const itemId = normalizeFactoryHeldItemId(member.factoryEquippedHeldItemId);
    if (!itemId || !taken.has(itemId)) {
      if (itemId) taken.add(itemId);
      result[index] = member;
      return;
    }
    const original = normalizeFactoryHeldItemId(member.factoryOriginalHeldItemId);
    const fallback = original && !taken.has(original) ? original : null;
    if (fallback) taken.add(fallback);
    else clearedIndices.push(index);
    repairedIndices.push(index);
    result[index] = { ...member, factoryEquippedHeldItemId: fallback };
  });

  return {
    team: result as T[],
    repaired: repairedIndices.length > 0,
    repairedIndices: repairedIndices.sort((a, b) => a - b),
    clearedIndices,
    duplicates,
  };
}
