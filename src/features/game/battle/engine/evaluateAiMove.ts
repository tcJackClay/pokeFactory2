import type { BattleSpecialMode } from '../../view-model';
import type { FieldState, GamePokemon, Move } from '../../../../types';
import { getFactoryStyleAffinityBonus, FACTORY_STYLE, type FactoryStyleId } from '../../config/factoryBattleStyle';
import {
  getExpectedMoveHitCount,
  getMoveAccuracy,
  getMoveHealingPercent,
  getMoveSecondaryEffects,
  getMoveSubstituteInteraction,
  getMoveTarget,
  hasAbilityBattleEffect,
  hasItemBattleEffect,
  hasMoveBattleEffect,
} from '../../data/battle';
import { getNonVolatileStatusId, getVolatileStatus, hasNonVolatileStatus, hasVolatileStatus } from '../../utils/battleStatus';
import { estimateDeterministicDamageWithContext, getMoveTypeMultiplier } from './resolveDamage';

type DamageGimmickMode = BattleSpecialMode | 'NONE';

export interface EvaluateAiMoveOptions {
  move: Move;
  attacker: GamePokemon;
  defender: GamePokemon;
  preferredStyle: FactoryStyleId;
  fieldState: FieldState[];
  attackerGimmick?: DamageGimmickMode;
  defenderGimmick?: DamageGimmickMode;
}

export interface AiMoveScoreResult {
  score: number;
  expectedDamage: number;
  wouldKo: boolean;
  blockedReason: string | null;
}

function moveTargetsOpponent(move: Move) {
  return getMoveTarget(move) !== 'user';
}

function getProtectionScale(move: Move, attackerGimmick: DamageGimmickMode, defender: GamePokemon) {
  if (!moveTargetsOpponent(move)) return 1;
  if (!hasVolatileStatus(defender, 'protect') || move.battleData?.bypassProtect) return 1;
  if (attackerGimmick === 'ZMOVE' && move.damage_class !== 'status') return 0.25;
  return 0;
}

function isSleepPreventingFieldActive(fieldState: FieldState[]) {
  return fieldState.includes('electric_terrain') || fieldState.includes('misty_terrain');
}

function isSleepBlockedByUproar(defender: GamePokemon, attacker: GamePokemon) {
  if (hasAbilityBattleEffect(defender?.abilities?.[0]?.ability?.name, 'SOUNDPROOF')) return false;
  return hasVolatileStatus(defender, 'uproar') || hasVolatileStatus(attacker, 'uproar');
}

function areBattlersOfOppositeGender(attacker: GamePokemon, defender: GamePokemon) {
  if (!attacker.gender || !defender.gender) return false;
  if (attacker.gender === 'genderless' || defender.gender === 'genderless') return false;
  return attacker.gender !== defender.gender;
}

function getBlockedReason(move: Move, attacker: GamePokemon, defender: GamePokemon, fieldState: FieldState[]): string | null {
  const encoredMoveName = getVolatileStatus(attacker, 'encore')?.linkedMoveName;
  if (encoredMoveName && move.name !== encoredMoveName) return 'encore';

  const disabledMoveName = getVolatileStatus(attacker, 'disable')?.linkedMoveName;
  if (disabledMoveName && move.name === disabledMoveName) return 'disable';

  if (hasVolatileStatus(attacker, 'taunt') && move.damage_class === 'status') return 'taunt';
  if (hasVolatileStatus(attacker, 'torment') && attacker.factoryLastUsedMoveName === move.name) return 'torment';

  if (
    hasItemBattleEffect(attacker.factoryHeldItemId, 'CHOICE_BAND')
    && attacker.factoryChoiceLockedMoveName
    && attacker.factoryChoiceLockedMoveName !== move.name
  ) {
    return 'choice-lock';
  }

  if (!moveTargetsOpponent(move)) return null;

  if (hasVolatileStatus(defender, 'substitute') && move.damage_class === 'status' && getMoveSubstituteInteraction(move) !== 'bypass') {
    return 'substitute';
  }

  if (move.damage_class !== 'status' && getMoveTypeMultiplier(move, defender) === 0) {
    return 'type-immune';
  }

  if (hasMoveBattleEffect(move, 'YAWN')) {
    if (hasVolatileStatus(defender, 'yawn') || hasNonVolatileStatus(defender) || isSleepPreventingFieldActive(fieldState)) {
      return 'status-immune';
    }
  }

  if (hasMoveBattleEffect(move, 'NIGHTMARE')) {
    if (getNonVolatileStatusId(defender) !== 'sleep' || hasVolatileStatus(defender, 'nightmare')) {
      return 'status-immune';
    }
  }

  if (hasMoveBattleEffect(move, 'ATTRACT')) {
    if (
      hasVolatileStatus(defender, 'infatuation')
      || hasAbilityBattleEffect(defender?.abilities?.[0]?.ability?.name, 'OBLIVIOUS')
      || !areBattlersOfOppositeGender(attacker, defender)
    ) {
      return 'status-immune';
    }
  }

  if (hasMoveBattleEffect(move, 'TAUNT') && hasVolatileStatus(defender, 'taunt')) return 'status-immune';
  if (hasMoveBattleEffect(move, 'TORMENT') && hasVolatileStatus(defender, 'torment')) return 'status-immune';
  if (hasMoveBattleEffect(move, 'DISABLE')) {
    const targetLastMove = defender.factoryLastUsedMoveName;
    const targetMove = defender.selectedMoves.find((candidate) => candidate.name === targetLastMove);
    if (!targetMove || hasVolatileStatus(defender, 'disable')) return 'status-immune';
  }
  if (hasMoveBattleEffect(move, 'ENCORE')) {
    const targetLastMove = defender.factoryLastUsedMoveName;
    const targetMove = defender.selectedMoves.find((candidate) => candidate.name === targetLastMove);
    if (!targetMove || hasVolatileStatus(defender, 'encore') || (targetMove.currentPp ?? targetMove.pp ?? 0) <= 0) return 'status-immune';
  }

  const statusEffect = getMoveSecondaryEffects(move).find((effect) =>
    (effect.kind === 'status' || effect.kind === 'volatile-status') && (effect.appliesTo ?? 'target') === 'target');
  if (statusEffect?.statusId) {
    const normalizedStatus = statusEffect.statusId;
    if (normalizedStatus === 'sleep') {
      if (
        hasNonVolatileStatus(defender)
        || hasAbilityBattleEffect(defender?.abilities?.[0]?.ability?.name, 'INSOMNIA')
        || hasAbilityBattleEffect(defender?.abilities?.[0]?.ability?.name, 'VITAL_SPIRIT')
        || hasAbilityBattleEffect(defender?.abilities?.[0]?.ability?.name, 'COMATOSE')
        || isSleepPreventingFieldActive(fieldState)
        || isSleepBlockedByUproar(defender, attacker)
      ) {
        return 'status-immune';
      }
    } else if (normalizedStatus === 'confusion') {
      if (hasVolatileStatus(defender, 'confusion')) return 'status-immune';
    } else if (hasNonVolatileStatus(defender)) {
      return 'status-immune';
    }
  }

  return null;
}

function getAccuracyScale(move: Move) {
  return (getMoveAccuracy(move) ?? 100) / 100;
}

function scoreStatusMove(move: Move, attacker: GamePokemon, defender: GamePokemon, preferredStyle: FactoryStyleId) {
  let score = 8 + getFactoryStyleAffinityBonus(move, preferredStyle);
  const healingPercent = getMoveHealingPercent(move);
  const secondaryEffects = getMoveSecondaryEffects(move);
  const targetStatusEffect = secondaryEffects.find((effect) =>
    (effect.kind === 'status' || effect.kind === 'volatile-status') && (effect.appliesTo ?? 'target') === 'target');
  const selfBoostEffects = secondaryEffects.filter((effect) => effect.kind === 'stat-stage' && effect.appliesTo === 'user' && (effect.change ?? 0) > 0);
  const targetDropEffects = secondaryEffects.filter((effect) => effect.kind === 'stat-stage' && (effect.appliesTo ?? 'target') === 'target' && (effect.change ?? 0) < 0);

  if (healingPercent > 0 && attacker.currentHp < attacker.maxHp * 0.5) score += 24;
  if (selfBoostEffects.length > 0) score += 18;
  if (targetDropEffects.length > 0) score += 14;
  if (targetStatusEffect?.statusId) score += 28;

  if (hasMoveBattleEffect(move, 'PROTECT') || hasMoveBattleEffect(move, 'DETECT') || hasMoveBattleEffect(move, 'KINGS_SHIELD') || hasMoveBattleEffect(move, 'SPIKY_SHIELD')) {
    const chainCounter = getVolatileStatus(attacker, 'protect_chain')?.counter ?? 0;
    score += attacker.currentHp <= attacker.maxHp * 0.4 ? 18 : 10;
    score -= chainCounter * 18;
  }
  if (hasMoveBattleEffect(move, 'SUBSTITUTE')) {
    const substituteActive = hasVolatileStatus(attacker, 'substitute');
    if (substituteActive || attacker.currentHp <= Math.max(1, Math.floor(attacker.maxHp / 4))) {
      score -= 40;
    } else {
      score += 16;
    }
  }
  if (hasItemBattleEffect(attacker.factoryHeldItemId, 'CHOICE_BAND') && !attacker.factoryChoiceLockedMoveName) {
    score -= 80;
  }

  return score;
}

export function evaluateAiMove({
  move,
  attacker,
  defender,
  preferredStyle,
  fieldState,
  attackerGimmick = 'NONE',
  defenderGimmick = 'NONE',
}: EvaluateAiMoveOptions): AiMoveScoreResult {
  const blockedReason = getBlockedReason(move, attacker, defender, fieldState);
  if (blockedReason) {
    return {
      score: -1000 + getFactoryStyleAffinityBonus(move, preferredStyle),
      expectedDamage: 0,
      wouldKo: false,
      blockedReason,
    };
  }

  if (move.damage_class === 'status') {
    return {
      score: scoreStatusMove(move, attacker, defender, preferredStyle),
      expectedDamage: 0,
      wouldKo: false,
      blockedReason: null,
    };
  }

  const typeMultiplier = getMoveTypeMultiplier(move, defender);
  const accuracyScale = getAccuracyScale(move);
  const protectScale = getProtectionScale(move, attackerGimmick, defender);
  const substituteHp = getVolatileStatus(defender, 'substitute')?.counter ?? 0;
  const rawExpectedDamage = estimateDeterministicDamageWithContext(move, attacker, defender, {
    attackerGimmick,
    defenderGimmick,
  });

  let expectedDamage = Math.floor(rawExpectedDamage * accuracyScale * protectScale);
  if (substituteHp > 0 && moveTargetsOpponent(move) && getMoveSubstituteInteraction(move) !== 'bypass') {
    expectedDamage = Math.min(expectedDamage, substituteHp);
  }

  const wouldKo = expectedDamage >= (substituteHp > 0 ? substituteHp : defender.currentHp);
  let score = expectedDamage;
  if (wouldKo) score += 140;
  if (typeMultiplier > 1) score += 18;
  if (protectScale === 0) score -= 80;
  if (substituteHp > 0 && getExpectedMoveHitCount(move, attacker) > 1) score += 8;
  if (getExpectedMoveHitCount(move, attacker) > 1) score += 4;

  const secondaryEffects = getMoveSecondaryEffects(move);
  if (secondaryEffects.some((effect) => effect.kind === 'flinch' || (effect.kind === 'stat-stage' && (effect.appliesTo ?? 'target') === 'target' && (effect.change ?? 0) < 0))) {
    score += 10;
  }
  score += getFactoryStyleAffinityBonus(move, preferredStyle);

  return {
    score,
    expectedDamage,
    wouldKo,
    blockedReason: null,
  };
}

export function getBestTypePressureAgainstTarget(attacker: GamePokemon, defender: GamePokemon) {
  return attacker.selectedMoves.reduce((best, move) => {
    if (move.damage_class === 'status') return best;
    const evaluation = evaluateAiMove({
      move,
      attacker,
      defender,
      preferredStyle: FACTORY_STYLE.NONE,
      fieldState: [],
    });
    if (evaluation.blockedReason) return best;
    return Math.max(best, getMoveTypeMultiplier(move, defender));
  }, 0);
}
