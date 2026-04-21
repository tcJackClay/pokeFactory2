import type { GamePokemon, Move } from '../../../../types';
import { getMoveBattleData, hasAbilityBattleEffect, hasItemBattleEffect } from '../../data/battle';

interface ResolveMoveStrikePlanOptions {
  move: Move;
  attacker: GamePokemon;
  random?: () => number;
}

export interface MoveStrikePlan {
  plannedHits: number;
  usesIndependentAccuracy: boolean;
}

function clampRoll(random: () => number) {
  return Math.max(0, Math.min(0.999999999, random()));
}

function rollStandardTwoToFiveHitCount(random: () => number) {
  const roll = clampRoll(random);
  if (roll < 0.35) return 2;
  if (roll < 0.7) return 3;
  if (roll < 0.85) return 4;
  return 5;
}

export function getMoveStrikeBasePower(move: Move, hitIndex: number) {
  const basePower = move.power ?? 0;
  if (move.battleData?.strikeMode === 'progressive-multi-hit') {
    return basePower * (hitIndex + 1);
  }
  return basePower;
}

export function resolveMoveStrikePlan({
  move,
  attacker,
  random = Math.random,
}: ResolveMoveStrikePlanOptions): MoveStrikePlan {
  const battleData = getMoveBattleData(move);
  if (!battleData || battleData.strikeMode === 'single') {
    return {
      plannedHits: 1,
      usesIndependentAccuracy: false,
    };
  }

  const guaranteedHits = battleData.guaranteedHits ?? Math.max(1, battleData.minHits);
  const maxHits = Math.max(guaranteedHits, battleData.maxHits);
  const minHits = Math.max(1, battleData.minHits);
  const primaryAbility = attacker.abilities?.[0]?.ability?.name;

  let plannedHits = guaranteedHits;
  if (hasAbilityBattleEffect(primaryAbility, 'SKILL_LINK')) {
    plannedHits = maxHits;
  } else if (hasItemBattleEffect(attacker.factoryHeldItemId, 'LOADED_DICE') && minHits === 2 && maxHits === 5) {
    plannedHits = clampRoll(random) < 0.5 ? 4 : 5;
  } else if (minHits === 2 && maxHits === 5) {
    plannedHits = rollStandardTwoToFiveHitCount(random);
  } else if (!battleData.guaranteedHits) {
    const roll = clampRoll(random);
    plannedHits = minHits + Math.floor(roll * (maxHits - minHits + 1));
  }

  return {
    plannedHits,
    usesIndependentAccuracy: battleData.strikeMode === 'progressive-multi-hit' || battleData.strikeMode === 'multi-hit-per-accuracy',
  };
}
