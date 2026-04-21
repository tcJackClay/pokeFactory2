import type {
  AbilityBattleData,
  FieldState,
  ItemBattleData,
  Move,
  MoveBattleData,
  MoveBattleFlag,
  MoveSecondaryEffect,
  Weather,
} from '../../../../types';
import { ABILITY_BATTLE_DATA } from './abilityEffects';
import { ITEM_BATTLE_DATA } from './itemEffects';
import { MOVE_BATTLE_DATA_OVERRIDES } from './moveEffectTable';
import { mapPokeApiMoveFlags } from './moveFlags';

function normalizeMoveOrAbilityId(id?: string | null) {
  return (id ?? '').trim().toLowerCase().replace(/_/g, '-');
}

function normalizeItemId(id?: string | null) {
  return (id ?? '').trim().toLowerCase().replace(/-/g, '_');
}

function mergeMoveFlags(baseFlags: MoveBattleFlag[], overrideFlags?: MoveBattleFlag[]) {
  return [...new Set([...(baseFlags ?? []), ...(overrideFlags ?? [])])];
}

function normalizeBattleStatName(statName?: string) {
  if (statName === 'special-attack') return 'spAtk';
  if (statName === 'special-defense') return 'spDef';
  return statName;
}

function buildMoveSecondaryEffects(data: any): MoveSecondaryEffect[] {
  const secondaryEffects: MoveSecondaryEffect[] = [];
  const isStatusMove = data?.damage_class?.name === 'status';
  const moveTarget = String(data?.target?.name ?? '');
  const defaultStatTarget: 'user' | 'target' = moveTarget.includes('user') ? 'user' : 'target';
  const ailmentName = data?.meta?.ailment?.name;
  const ailmentChance = Number(data?.meta?.ailment_chance ?? 0);
  if (ailmentName && ailmentName !== 'none') {
    secondaryEffects.push({
      kind: ailmentName === 'flinch' ? 'flinch' : ailmentName === 'confusion' ? 'volatile-status' : 'status',
      chance: ailmentChance || 100,
      group: 'ailment',
      appliesTo: 'target',
      isPrimary: isStatusMove,
      requiresHit: !isStatusMove,
      blockedBySubstitute: true,
      statusId: ailmentName,
    });
  }

  const flinchChance = Number(data?.meta?.flinch_chance ?? 0);
  if (flinchChance > 0 && !secondaryEffects.some((effect) => effect.kind === 'flinch')) {
    secondaryEffects.push({
      kind: 'flinch',
      chance: flinchChance,
      group: 'flinch',
      appliesTo: 'target',
      isPrimary: false,
      requiresHit: true,
      blockedBySubstitute: true,
      statusId: 'flinch',
    });
  }

  const statChanges = Array.isArray(data?.stat_changes) ? data.stat_changes : [];
  const statChance = Number(data?.meta?.stat_chance ?? 100);
  for (const statChange of statChanges) {
    secondaryEffects.push({
      kind: 'stat-stage',
      chance: statChance,
      group: 'stat-stage',
      appliesTo: defaultStatTarget,
      isPrimary: isStatusMove || defaultStatTarget === 'user',
      requiresHit: !isStatusMove,
      blockedBySubstitute: defaultStatTarget !== 'user',
      stat: normalizeBattleStatName(statChange?.stat?.name),
      change: Number(statChange?.change ?? 0),
    });
  }

  return secondaryEffects;
}

export function buildMoveBattleDataFromPokeApiMove(data: any): MoveBattleData {
  const normalizedMoveName = normalizeMoveOrAbilityId(data?.name);
  const moveOverride = MOVE_BATTLE_DATA_OVERRIDES[normalizedMoveName] ?? {};
  const apiDrain = Number(data?.meta?.drain ?? 0);
  const minHits = Math.max(1, Number(data?.meta?.min_hits ?? 1));
  const maxHits = Math.max(minHits, Number(data?.meta?.max_hits ?? minHits));
  const baseFlags = mapPokeApiMoveFlags(
    Array.isArray(data?.flags) ? data.flags.map((flag: { name?: string }) => String(flag?.name ?? '')) : [],
  );

  const flags = mergeMoveFlags(baseFlags, moveOverride.flags);
  const makesContact = moveOverride.makesContact ?? flags.includes('contact');
  const soundMove = moveOverride.soundMove ?? flags.includes('sound');
  const powderMove = moveOverride.powderMove ?? flags.includes('powder');
  const ballisticMove = moveOverride.ballisticMove ?? flags.includes('ballistic');
  const punchMove = moveOverride.punchMove ?? flags.includes('punch');
  const bypassProtect = moveOverride.bypassProtect ?? flags.includes('bypass-protect');
  const ignoreAccuracyCheck = moveOverride.ignoreAccuracyCheck ?? flags.includes('ignore-accuracy-check');

  const secondaryEffects = moveOverride.secondaryEffects ?? buildMoveSecondaryEffects(data);
  return {
    effectId: moveOverride.effectId ?? 'NONE',
    priority: Number(moveOverride.priority ?? data?.priority ?? 0),
    target: moveOverride.target ?? data?.target?.name ?? 'selected-pokemon',
    flags,
    critStage: Number(moveOverride.critStage ?? data?.meta?.crit_rate ?? 0),
    drainPercent: Number(moveOverride.drainPercent ?? Math.max(0, apiDrain)),
    recoilPercent: Number(moveOverride.recoilPercent ?? Math.abs(Math.min(0, apiDrain))),
    healingPercent: Number(moveOverride.healingPercent ?? data?.meta?.healing ?? 0),
    strikeMode: maxHits > 1 ? 'multi-hit' : 'single',
    minHits: Number(moveOverride.minHits ?? minHits),
    maxHits: Number(moveOverride.maxHits ?? maxHits),
    guaranteedHits: moveOverride.guaranteedHits,
    secondaryEffects,
    substituteInteraction: moveOverride.substituteInteraction ?? (soundMove ? 'bypass' : 'blocked'),
    makesContact,
    soundMove,
    powderMove,
    ballisticMove,
    punchMove,
    bypassProtect,
    ignoreAccuracyCheck,
    weather: moveOverride.weather,
    fieldState: moveOverride.fieldState,
  };
}

export function getAbilityBattleData(abilityId?: string | null): AbilityBattleData | undefined {
  const normalizedAbilityId = normalizeMoveOrAbilityId(abilityId);
  if (!normalizedAbilityId) return undefined;
  return ABILITY_BATTLE_DATA[normalizedAbilityId] ?? {
    id: normalizedAbilityId,
    effectId: 'NONE',
  };
}

export function hasAbilityBattleEffect(abilityId: string | null | undefined, effectId: string) {
  return getAbilityBattleData(abilityId)?.effectId === effectId;
}

export function abilityHasHook(abilityId: string | null | undefined, hook: string) {
  return Boolean(getAbilityBattleData(abilityId)?.hooks?.includes(hook));
}

export function getItemBattleData(itemId?: string | null): ItemBattleData | undefined {
  const normalizedItemId = normalizeItemId(itemId);
  if (!normalizedItemId) return undefined;
  return ITEM_BATTLE_DATA[normalizedItemId] ?? {
    id: normalizedItemId,
    effectId: 'NONE',
  };
}

export function hasItemBattleEffect(itemId: string | null | undefined, effectId: string) {
  return getItemBattleData(itemId)?.effectId === effectId;
}

export function itemHasHook(itemId: string | null | undefined, hook: string) {
  return Boolean(getItemBattleData(itemId)?.hooks?.includes(hook));
}

export function getItemAccuracyMultiplier(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.accuracyMultiplier ?? 1;
}

export function getItemFlinchChance(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.flinchChance ?? 0;
}

export function getItemEndTurnHealDenominator(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.endTurnHealDenominator ?? null;
}

export function getItemPinchTriggerDenominator(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.pinchTriggerDenominator ?? null;
}

export function getItemPinchHealDenominator(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.pinchHealDenominator ?? null;
}

export function getItemPinchStat(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.pinchStat;
}

export function getItemStatusCures(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.statusCures ?? [];
}

export function getItemMentalStatuses(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.mentalStatuses ?? [];
}

export function getItemCritStageBonus(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.critStageBonus ?? 0;
}

export function getItemPpRestoreAmount(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.ppRestoreAmount ?? 0;
}

export function getItemPriorityProcChance(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.priorityProcChance ?? 0;
}

export function getItemSurviveAtOneHpChance(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.surviveAtOneHpChance ?? 0;
}

export function getItemPhysicalAttackMultiplier(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.physicalAttackMultiplier ?? 1;
}

export function getItemSpecialDefenseMultiplier(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.specialDefenseMultiplier ?? 1;
}

export function getItemDamageBasedHealDenominator(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.damageBasedHealDenominator ?? null;
}

export function getItemTypeBoostType(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.typeBoostType ?? null;
}

export function getItemTypeBoostMultiplier(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.typeBoostMultiplier ?? 1;
}

export function getItemSpeciesIds(itemId: string | null | undefined) {
  return getItemBattleData(itemId)?.speciesIds ?? [];
}

export function getMoveBattleData(move: Move | null | undefined): MoveBattleData | undefined {
  return move?.battleData;
}

export function hasMoveBattleEffect(move: Move | null | undefined, effectId: string) {
  return move?.battleData?.effectId === effectId;
}

export function getMoveTarget(move: Move | null | undefined) {
  return move?.battleData?.target ?? move?.target ?? 'selected-pokemon';
}

export function getMoveWeather(move: Move | null | undefined): Weather | null {
  return move?.battleData?.weather ?? null;
}

export function getMoveFieldState(move: Move | null | undefined): FieldState | null {
  return move?.battleData?.fieldState ?? null;
}

export function getMoveAccuracy(move: Move | null | undefined) {
  if (!move) return null;
  if (move.battleData?.ignoreAccuracyCheck) return null;
  return move.accuracy ?? null;
}

export function getMoveCritStage(move: Move | null | undefined) {
  return move?.battleData?.critStage ?? move?.critRate ?? 0;
}

export function getMoveDrainPercent(move: Move | null | undefined) {
  return move?.battleData?.drainPercent ?? move?.drain ?? 0;
}

export function getMoveRecoilPercent(move: Move | null | undefined) {
  if (!move) return 0;
  return move.battleData?.recoilPercent ?? Math.abs(Math.min(0, move.drain ?? 0));
}

export function getMoveHealingPercent(move: Move | null | undefined) {
  return move?.battleData?.healingPercent ?? move?.healing ?? 0;
}

export function getMoveSecondaryEffects(move: Move | null | undefined) {
  return move?.battleData?.secondaryEffects ?? [];
}

export function getMoveSubstituteInteraction(move: Move | null | undefined) {
  return move?.battleData?.substituteInteraction ?? 'blocked';
}

export function isMegaStoneLikeItem(itemId: string | null | undefined) {
  const normalizedItemId = normalizeItemId(itemId);
  if (!normalizedItemId) return false;
  if (itemHasHook(normalizedItemId, 'mega-like-stone')) return true;
  return normalizedItemId.includes('ite');
}

export function isZCrystalLikeItem(itemId: string | null | undefined) {
  const normalizedItemId = normalizeItemId(itemId);
  if (!normalizedItemId) return false;
  if (itemHasHook(normalizedItemId, 'zmove-mode')) return true;
  return normalizedItemId.endsWith('_z') || normalizedItemId.includes('ium_z');
}

export function getMovePriority(move: Move | null | undefined) {
  return move?.battleData?.priority ?? 0;
}

export function getExpectedMoveHitCount(move: Move | null | undefined, attacker?: { abilities?: { ability?: { name?: string } }[]; factoryHeldItemId?: string }) {
  const moveBattleData = move?.battleData;
  if (!moveBattleData) return 1;
  if (moveBattleData.guaranteedHits) return moveBattleData.guaranteedHits;
  if (moveBattleData.strikeMode === 'single') return 1;

  const primaryAbility = attacker?.abilities?.[0]?.ability?.name;
  if (hasAbilityBattleEffect(primaryAbility, 'SKILL_LINK')) return moveBattleData.maxHits;
  if (hasItemBattleEffect(attacker?.factoryHeldItemId, 'LOADED_DICE') && moveBattleData.minHits === 2 && moveBattleData.maxHits === 5) {
    return 4.5;
  }
  if (moveBattleData.minHits === 2 && moveBattleData.maxHits === 5) {
    return 3;
  }
  return (moveBattleData.minHits + moveBattleData.maxHits) / 2;
}

export function rollMoveHitCount(move: Move | null | undefined, random: () => number = Math.random) {
  const moveBattleData = move?.battleData;
  if (!moveBattleData) return 1;
  if (moveBattleData.guaranteedHits) return moveBattleData.guaranteedHits;
  if (moveBattleData.strikeMode === 'single') return 1;

  const minHits = Math.max(1, moveBattleData.minHits);
  const maxHits = Math.max(minHits, moveBattleData.maxHits);
  if (minHits === 2 && maxHits === 5) {
    const roll = Math.max(0, Math.min(0.999999999, random()));
    if (roll < 0.35) return 2;
    if (roll < 0.7) return 3;
    if (roll < 0.85) return 4;
    return 5;
  }
  const roll = Math.max(0, Math.min(0.999999999, random()));
  return minHits + Math.floor(roll * (maxHits - minHits + 1));
}
