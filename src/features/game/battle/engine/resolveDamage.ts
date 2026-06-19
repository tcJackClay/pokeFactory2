import type { FieldState, GamePokemon, Move, Pokemon } from '../../../../types';
import {
  getItemCritStageBonus,
  getItemPhysicalAttackMultiplier,
  getItemSpecialDefenseMultiplier,
  getItemSpeciesIds,
  getItemTypeBoostMultiplier,
  getItemTypeBoostType,
  getExpectedMoveHitCount,
  getMoveTarget,
  getMoveSubstituteInteraction,
  hasAbilityBattleEffect,
} from '../../data/battle';
import { getNonVolatileStatusId, getVolatileStatus } from '../../utils/battleStatus';
import type { BattleSpecialMode } from '../../view-model';
import { resolveAccuracy } from './resolveAccuracy';
import { getStatStageModifier } from './stageModifiers';
import { getMoveTypeMultiplier as resolveTypeEffectiveness } from './resolveTypeEffectiveness';

type DamageGimmickMode = BattleSpecialMode | 'NONE';
type PokemonTypeSlots = Pokemon['types'];

interface CalculateDamageOptions {
  move: Move;
  attacker: GamePokemon;
  defender: GamePokemon;
  weather: string;
  fieldState?: FieldState[];
  atkBuff: boolean;
  defBuff: boolean;
  basePowerOverride?: number;
  skipAccuracyCheck?: boolean;
  random?: () => number;
}

export interface DamageCalculationResult {
  damage: number;
  multiplier: number;
  isMiss: boolean;
  isCrit: boolean;
  blockedByProtect: boolean;
  protectReducedDamage: boolean;
  blockedBySubstitute: boolean;
  substituteDamage: number;
  substituteHpRemaining: number | null;
  substituteBroke: boolean;
  applyUserSecondaryEffects: boolean;
  applyTargetSecondaryEffects: boolean;
}

function getSpeciesId(pokemon: GamePokemon | null | undefined) {
  if (!pokemon) return 0;
  return pokemon.speciesId ?? pokemon.id;
}

function getCurrentTypeSlots(pokemon: GamePokemon | null | undefined): PokemonTypeSlots {
  return pokemon?.types ?? [];
}

function getBaseTypeSlots(pokemon: GamePokemon | null | undefined): PokemonTypeSlots {
  return pokemon?.baseTypes ?? pokemon?.types ?? [];
}

function hasType(typeSlots: PokemonTypeSlots, typeName: string) {
  return typeSlots.some((slot) => slot.type.name === typeName);
}

function isGrounded(pokemon: GamePokemon) {
  return !hasType(getCurrentTypeSlots(pokemon), 'flying');
}

function doesHeldItemMatchSpecies(pokemon: GamePokemon | null | undefined) {
  if (!pokemon) return false;
  const allowedSpeciesIds = getItemSpeciesIds(pokemon.factoryHeldItemId);
  if (allowedSpeciesIds.length === 0) return true;
  return allowedSpeciesIds.includes(getSpeciesId(pokemon));
}

function getPhysicalAttackMultiplierFromItem(pokemon: GamePokemon | null | undefined) {
  if (!pokemon || !doesHeldItemMatchSpecies(pokemon)) return 1;
  return getItemPhysicalAttackMultiplier(pokemon.factoryHeldItemId);
}

function getSpecialDefenseMultiplierFromItem(pokemon: GamePokemon | null | undefined) {
  if (!pokemon || !doesHeldItemMatchSpecies(pokemon)) return 1;
  return getItemSpecialDefenseMultiplier(pokemon.factoryHeldItemId);
}

function getAdditionalCritStageFromItem(pokemon: GamePokemon | null | undefined) {
  if (!pokemon || !doesHeldItemMatchSpecies(pokemon)) return 0;
  return getItemCritStageBonus(pokemon.factoryHeldItemId);
}

function getHeldMovePowerMultiplier(pokemon: GamePokemon | null | undefined, moveType?: string) {
  if (!pokemon || !moveType) return 1;
  const boostedType = getItemTypeBoostType(pokemon.factoryHeldItemId);
  if (!boostedType || boostedType !== moveType) return 1;
  return getItemTypeBoostMultiplier(pokemon.factoryHeldItemId);
}

function getCurrentOrBaseTeraType(pokemon: GamePokemon) {
  return pokemon.teraType || getCurrentTypeSlots(pokemon)[0]?.type.name || getBaseTypeSlots(pokemon)[0]?.type.name || 'normal';
}

export function getSameTypeAttackBonusMultiplier(attacker: GamePokemon, moveType: string) {
  const baseHasType = hasType(getBaseTypeSlots(attacker), moveType);
  if (!(attacker.specialBoostActive && attacker.specialBoostMode === 'TERA')) {
    return baseHasType ? 1.5 : 1;
  }

  const teraType = getCurrentOrBaseTeraType(attacker);
  if (moveType !== teraType) {
    return baseHasType ? 1.5 : 1;
  }

  return baseHasType ? 2 : 1.5;
}

function getCritChanceFromStage(critStage: number) {
  if (critStage <= 0) return 1 / 24;
  if (critStage === 1) return 1 / 8;
  if (critStage === 2) return 1 / 2;
  return 1;
}

function isCritBlocked(defender: GamePokemon) {
  const primaryAbility = defender.abilities?.[0]?.ability?.name;
  return (
    hasAbilityBattleEffect(primaryAbility, 'BATTLE_ARMOR')
    || hasAbilityBattleEffect(primaryAbility, 'SHELL_ARMOR')
  );
}

function getAdjustedStage(stage: number, { isCrit, forAttacker }: { isCrit: boolean; forAttacker: boolean }) {
  if (!isCrit) return stage;
  if (forAttacker && stage < 0) return 0;
  if (!forAttacker && stage > 0) return 0;
  return stage;
}

function getEffectiveOffenseAndDefense(move: Move, attacker: GamePokemon, defender: GamePokemon, isCrit: boolean, weather = 'none') {
  if (move.damage_class === 'special') {
    const attackStage = getAdjustedStage(attacker.statStages.spAtk, { isCrit, forAttacker: true });
    const defenseStage = getAdjustedStage(defender.statStages.spDef, { isCrit, forAttacker: false });
    const weatherSpecialDefenseMultiplier = weather === 'sandstorm' && hasType(getCurrentTypeSlots(defender), 'rock') ? 1.5 : 1;
    return {
      attack: attacker.calculatedStats.spAtk * getStatStageModifier(attackStage),
      defense: defender.calculatedStats.spDef
        * getStatStageModifier(defenseStage)
        * getSpecialDefenseMultiplierFromItem(defender)
        * weatherSpecialDefenseMultiplier,
    };
  }

  const attackStage = getAdjustedStage(attacker.statStages.attack, { isCrit, forAttacker: true });
  const defenseStage = getAdjustedStage(defender.statStages.defense, { isCrit, forAttacker: false });
  return {
    attack: attacker.calculatedStats.attack * getStatStageModifier(attackStage) * getPhysicalAttackMultiplierFromItem(attacker),
    defense: defender.calculatedStats.defense * getStatStageModifier(defenseStage),
  };
}

function getWeatherMultiplier(weather: string, moveType: string) {
  if (weather === 'sunny') {
    if (moveType === 'fire') return 1.5;
    if (moveType === 'water') return 0.5;
  }
  if (weather === 'rainy') {
    if (moveType === 'water') return 1.5;
    if (moveType === 'fire') return 0.5;
  }
  return 1;
}

function getTerrainMoveMultiplier(fieldState: FieldState[] | undefined, moveType: string, attacker: GamePokemon, defender: GamePokemon) {
  if (!fieldState || fieldState.length === 0) return 1;
  if (fieldState.includes('electric_terrain') && moveType === 'electric' && isGrounded(attacker)) return 1.3;
  if (fieldState.includes('grassy_terrain') && moveType === 'grass' && isGrounded(attacker)) return 1.3;
  if (fieldState.includes('psychic_terrain') && moveType === 'psychic' && isGrounded(attacker)) return 1.3;
  if (fieldState.includes('misty_terrain') && moveType === 'dragon' && isGrounded(defender)) return 0.5;
  return 1;
}

function getLowHpPower(attacker: GamePokemon) {
  const hpRatio = attacker.currentHp / Math.max(1, attacker.maxHp);
  if (hpRatio <= 1 / 48) return 200;
  if (hpRatio <= 1 / 16) return 150;
  if (hpRatio <= 1 / 8) return 100;
  if (hpRatio <= 1 / 4) return 80;
  if (hpRatio <= 1 / 3) return 40;
  if (hpRatio <= 1 / 2) return 20;
  return 20;
}

function getHighHpPower(attacker: GamePokemon) {
  return Math.max(1, Math.floor(150 * attacker.currentHp / Math.max(1, attacker.maxHp)));
}

function getSpecialCaseDamage(move: Move, attacker: GamePokemon, defender: GamePokemon) {
  const effectId = move.battleData?.effectId;
  if (effectId === 'DRAGON_RAGE') return 40;
  if (effectId === 'SONIC_BOOM') return 20;
  if (effectId === 'LEVEL_DAMAGE') return Math.max(1, attacker.level);
  if (effectId === 'HALF_HP') return Math.max(1, Math.floor(defender.currentHp / 2));
  if (effectId === 'ENDEAVOR') return Math.max(0, defender.currentHp - attacker.currentHp);
  return null;
}

function shouldTreatAsZPoweredMove(attacker: GamePokemon, move: Move) {
  return attacker.specialBoostActive && attacker.specialBoostMode === 'ZMOVE' && move.damage_class !== 'status';
}

export function calculateConfusionSelfHitDamage(pokemon: GamePokemon) {
  const levelMultiplier = (2 * pokemon.level / 5) + 2;
  let attack = pokemon.calculatedStats.attack * getStatStageModifier(pokemon.statStages.attack);
  const defense = pokemon.calculatedStats.defense * getStatStageModifier(pokemon.statStages.defense);
  attack *= getPhysicalAttackMultiplierFromItem(pokemon);

  const damage = Math.floor((((levelMultiplier * 40 * attack / Math.max(1, defense)) / 50) + 2));
  return Math.max(1, damage);
}

export function getEffectiveBattleSpeed(pokemon: GamePokemon | null | undefined) {
  if (!pokemon) return 0;
  return pokemon.calculatedStats.speed * getStatStageModifier(pokemon.statStages.speed);
}

export function getMoveTypeMultiplier(move: Move, defender: GamePokemon) {
  return resolveTypeEffectiveness(move, defender);
}

export function calculateDamage({
  move,
  attacker,
  defender,
  weather,
  fieldState,
  atkBuff,
  defBuff,
  basePowerOverride,
  skipAccuracyCheck = false,
  random = Math.random,
}: CalculateDamageOptions): DamageCalculationResult {
  const moveTargetsUser = getMoveTarget(move) === 'user';
  const blockedByProtect = (
    !moveTargetsUser
    && Boolean(getVolatileStatus(defender, 'protect'))
    && !move.battleData?.bypassProtect
  );
  const protectReducedDamage = blockedByProtect && shouldTreatAsZPoweredMove(attacker, move);
  const blockedBySubstitute = (
    !moveTargetsUser
    && Boolean(getVolatileStatus(defender, 'substitute'))
    && getMoveSubstituteInteraction(move) !== 'bypass'
  );

  if (blockedByProtect && !protectReducedDamage) {
    return {
      damage: 0,
      multiplier: 0,
      isMiss: false,
      isCrit: false,
      blockedByProtect: true,
      protectReducedDamage: false,
      blockedBySubstitute: false,
      substituteDamage: 0,
      substituteHpRemaining: null,
      substituteBroke: false,
      applyUserSecondaryEffects: false,
      applyTargetSecondaryEffects: false,
    };
  }

  if (move.damage_class === 'status') {
    return {
      damage: 0,
      multiplier: 1,
      isMiss: false,
      isCrit: false,
      blockedByProtect,
      protectReducedDamage,
      blockedBySubstitute,
      substituteDamage: 0,
      substituteHpRemaining: blockedBySubstitute ? (getVolatileStatus(defender, 'substitute')?.counter ?? null) : null,
      substituteBroke: false,
      applyUserSecondaryEffects: !blockedByProtect,
      applyTargetSecondaryEffects: !blockedBySubstitute && !blockedByProtect,
    };
  }

  if (!skipAccuracyCheck) {
    const accuracyResult = resolveAccuracy({
      move,
      attacker,
      defender,
      random,
    });
    if (!accuracyResult.didHit) {
      return {
        damage: 0,
        multiplier: 0,
        isMiss: true,
        isCrit: false,
        blockedByProtect: false,
        protectReducedDamage: false,
        blockedBySubstitute: false,
        substituteDamage: 0,
        substituteHpRemaining: null,
        substituteBroke: false,
        applyUserSecondaryEffects: false,
        applyTargetSecondaryEffects: false,
      };
    }
  }

  const critStage = (move.battleData?.critStage ?? move.critRate ?? 0) + getAdditionalCritStageFromItem(attacker);
  const isCrit = !isCritBlocked(defender) && random() < getCritChanceFromStage(critStage);
  const { attack, defense } = getEffectiveOffenseAndDefense(move, attacker, defender, isCrit, weather);

  let effectiveAttack = attack;
  if (getNonVolatileStatusId(attacker) === 'burn' && move.damage_class === 'physical') {
    effectiveAttack *= 0.5;
  }

  const specialCaseDamage = getSpecialCaseDamage(move, attacker, defender);
  if (specialCaseDamage !== null) {
    const typeMultiplier = resolveTypeEffectiveness(move, defender);
    const totalDamage = typeMultiplier > 0 ? Math.min(defender.currentHp, specialCaseDamage) : 0;
    if (blockedBySubstitute && typeMultiplier > 0) {
      const substituteHp = Math.max(0, getVolatileStatus(defender, 'substitute')?.counter ?? 0);
      const remainingSubstituteHp = Math.max(0, substituteHp - totalDamage);
      return {
        damage: 0,
        multiplier: typeMultiplier,
        isMiss: false,
        isCrit,
        blockedByProtect,
        protectReducedDamage,
        blockedBySubstitute: true,
        substituteDamage: Math.min(substituteHp, totalDamage),
        substituteHpRemaining: remainingSubstituteHp,
        substituteBroke: substituteHp > 0 && remainingSubstituteHp <= 0,
        applyUserSecondaryEffects: true,
        applyTargetSecondaryEffects: false,
      };
    }
    return {
      damage: totalDamage,
      multiplier: typeMultiplier,
      isMiss: false,
      isCrit: false,
      blockedByProtect,
      protectReducedDamage,
      blockedBySubstitute: false,
      substituteDamage: 0,
      substituteHpRemaining: null,
      substituteBroke: false,
      applyUserSecondaryEffects: typeMultiplier > 0 && !blockedByProtect,
      applyTargetSecondaryEffects: typeMultiplier > 0 && !blockedByProtect,
    };
  }

  let basePower = basePowerOverride ?? move.power ?? 40;
  if (move.battleData?.effectId === 'LOW_HP_POWER') basePower = getLowHpPower(attacker);
  if (move.battleData?.effectId === 'HIGH_HP_POWER') basePower = getHighHpPower(attacker);
  if (move.battleData?.effectId === 'FACADE' && getNonVolatileStatusId(attacker)) basePower *= 2;
  const levelMultiplier = (2 * attacker.level / 5) + 2;
  const typeMultiplier = resolveTypeEffectiveness(move, defender);
  const stabMultiplier = getSameTypeAttackBonusMultiplier(attacker, move.type);
  const weatherMultiplier = getWeatherMultiplier(weather, move.type);
  const terrainMultiplier = getTerrainMoveMultiplier(fieldState, move.type, attacker, defender);
  const critMultiplier = isCrit ? 1.5 : 1;
  const zMoveBoost = shouldTreatAsZPoweredMove(attacker, move) ? 1.55 : 1;
  const heldTypeBoost = getHeldMovePowerMultiplier(attacker, move.type);
  const protectMultiplier = protectReducedDamage ? 0.25 : 1;
  const randomVariance = (random() * 0.15) + 0.85;

  let perHitDamage = Math.floor(
    ((((levelMultiplier * basePower * effectiveAttack / Math.max(1, defense)) / 50) + 2)
      * randomVariance
      * typeMultiplier
      * stabMultiplier
      * weatherMultiplier
      * terrainMultiplier
      * critMultiplier
      * zMoveBoost
      * heldTypeBoost
      * protectMultiplier),
  );

  if (typeMultiplier > 0) {
    perHitDamage = Math.max(1, perHitDamage);
  }
  if (atkBuff) perHitDamage = Math.floor(perHitDamage * 1.5);
  if (defBuff) perHitDamage = Math.floor(perHitDamage * 0.7);

  const totalDamage = Math.max(0, perHitDamage);
  if (blockedBySubstitute && typeMultiplier > 0) {
    const substituteHp = Math.max(0, getVolatileStatus(defender, 'substitute')?.counter ?? 0);
    const remainingSubstituteHp = Math.max(0, substituteHp - totalDamage);
    return {
      damage: 0,
      multiplier: typeMultiplier,
      isMiss: false,
      isCrit,
      blockedByProtect,
      protectReducedDamage,
      blockedBySubstitute: true,
      substituteDamage: Math.min(substituteHp, totalDamage),
      substituteHpRemaining: remainingSubstituteHp,
      substituteBroke: substituteHp > 0 && remainingSubstituteHp <= 0,
      applyUserSecondaryEffects: true,
      applyTargetSecondaryEffects: false,
    };
  }

  return {
    damage: totalDamage,
    multiplier: typeMultiplier,
    isMiss: false,
    isCrit,
    blockedByProtect,
    protectReducedDamage,
    blockedBySubstitute: false,
    substituteDamage: 0,
    substituteHpRemaining: null,
    substituteBroke: false,
    applyUserSecondaryEffects: typeMultiplier > 0 && !blockedByProtect,
    applyTargetSecondaryEffects: typeMultiplier > 0 && !blockedByProtect,
  };
}

export function estimateDeterministicDamage(
  move: Move,
  attacker: GamePokemon,
  defender: GamePokemon,
  gimmickMode: DamageGimmickMode,
) {
  if (move.damage_class === 'status') return 0;

  const simulatedAttacker = gimmickMode === 'TERA'
    ? {
      ...attacker,
      specialBoostActive: true,
      specialBoostMode: 'TERA' as const,
      types: [{ type: { name: getCurrentOrBaseTeraType(attacker) } }],
    }
    : gimmickMode === 'ZMOVE'
      ? {
        ...attacker,
        specialBoostActive: true,
        specialBoostMode: 'ZMOVE' as const,
      }
      : attacker;

  const { attack, defense } = getEffectiveOffenseAndDefense(move, simulatedAttacker, defender, false);
  const basePower = move.power ?? 0;
  const expectedHits = getExpectedMoveHitCount(move, simulatedAttacker);
  const levelScale = ((2 * attacker.level) / 5) + 2;
  const typeMultiplier = resolveTypeEffectiveness(move, defender);
  const stabMultiplier = getSameTypeAttackBonusMultiplier(simulatedAttacker, move.type);
  const heldTypeBoost = getHeldMovePowerMultiplier(attacker, move.type);
  const zMoveBoost = gimmickMode === 'ZMOVE' ? 1.55 : 1;
  const raw = (((levelScale * basePower * Math.max(1, attack)) / Math.max(1, defense)) / 50) + 2;
  return Math.max(1, Math.floor(raw * typeMultiplier * stabMultiplier * heldTypeBoost * zMoveBoost * expectedHits));
}

export function estimateDeterministicDamageWithContext(
  move: Move,
  attacker: GamePokemon,
  defender: GamePokemon,
  options?: {
    attackerGimmick?: DamageGimmickMode;
    defenderGimmick?: DamageGimmickMode;
  },
) {
  if (move.damage_class === 'status') return 0;
  const attackerGimmick = options?.attackerGimmick ?? 'NONE';
  const defenderGimmick = options?.defenderGimmick ?? 'NONE';

  const simulatedAttacker = attackerGimmick === 'TERA'
    ? {
      ...attacker,
      specialBoostActive: true,
      specialBoostMode: 'TERA' as const,
      types: [{ type: { name: getCurrentOrBaseTeraType(attacker) } }],
    }
    : attackerGimmick === 'ZMOVE'
      ? {
        ...attacker,
        specialBoostActive: true,
        specialBoostMode: 'ZMOVE' as const,
      }
      : attacker;
  const simulatedDefender = defenderGimmick === 'TERA'
    ? {
      ...defender,
      specialBoostActive: true,
      specialBoostMode: 'TERA' as const,
      types: [{ type: { name: getCurrentOrBaseTeraType(defender) } }],
    }
    : defender;

  const { attack, defense } = getEffectiveOffenseAndDefense(move, simulatedAttacker, simulatedDefender, false);
  const basePower = move.power ?? 0;
  const expectedHits = getExpectedMoveHitCount(move, simulatedAttacker);
  const levelScale = ((2 * attacker.level) / 5) + 2;
  const typeMultiplier = resolveTypeEffectiveness(move, simulatedDefender);
  const stabMultiplier = getSameTypeAttackBonusMultiplier(simulatedAttacker, move.type);
  const heldTypeBoost = getHeldMovePowerMultiplier(attacker, move.type);
  const zMoveBoost = attackerGimmick === 'ZMOVE' ? 1.55 : 1;
  const raw = (((levelScale * basePower * Math.max(1, attack)) / Math.max(1, defense)) / 50) + 2;
  return Math.max(1, Math.floor(raw * typeMultiplier * stabMultiplier * heldTypeBoost * zMoveBoost * expectedHits));
}
