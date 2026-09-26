import type { FieldState, GamePokemon, Move, Pokemon, Weather } from '../../../../types';
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
import { getNonVolatileStatusId, getVolatileStatus, hasVolatileStatus } from '../../utils/battleStatus';
import type { BattleSpecialMode } from '../../view-model';
import { resolveAccuracy } from './resolveAccuracy';
import { getStatStageModifier } from './stageModifiers';
import { getMoveTypeMultiplier as resolveTypeEffectiveness } from './resolveTypeEffectiveness';
import { resolveBattleMoveType } from './resolveMoveType';

type DamageGimmickMode = BattleSpecialMode | 'NONE';
type PokemonTypeSlots = Pokemon['types'];

interface CalculateDamageOptions {
  move: Move;
  attacker: GamePokemon;
  defender: GamePokemon;
  weather: Weather;
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
  targetHealing?: number;
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

function getPrimaryAbilityName(pokemon: GamePokemon | null | undefined) {
  return (pokemon?.abilities?.[0]?.ability?.name ?? '').trim().toLowerCase().replace(/_/g, '-');
}

function ignoresDefenderAbility(attacker: GamePokemon | null | undefined) {
  const ability = getPrimaryAbilityName(attacker);
  return ability === 'mold-breaker' || ability === 'teravolt' || ability === 'turboblaze';
}

function suppressesWeather(pokemon: GamePokemon | null | undefined) {
  const ability = getPrimaryAbilityName(pokemon);
  return ability === 'air-lock' || ability === 'cloud-nine';
}

function isGrounded(pokemon: GamePokemon, fieldState: FieldState[] = []) {
  if (fieldState.includes('gravity')) return true;
  const ability = getPrimaryAbilityName(pokemon);
  return !hasType(getCurrentTypeSlots(pokemon), 'flying') && ability !== 'levitate' && ability !== 'eelevate';
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
  let multiplier = baseHasType ? 1.5 : 1;
  if (getPrimaryAbilityName(attacker) === 'adaptability' && multiplier > 1) multiplier += 0.5;
  if (attacker.specialBoostActive && attacker.specialBoostMode === 'TERA') {
    const teraType = getCurrentOrBaseTeraType(attacker);
    if (moveType === teraType) multiplier += 0.5;
  }
  return Math.min(multiplier, 2.25);
}

function getCritChanceFromStage(critStage: number) {
  if (critStage <= 0) return 1 / 24;
  if (critStage === 1) return 1 / 8;
  if (critStage === 2) return 1 / 2;
  return 1;
}

function isCritBlocked(defender: GamePokemon, attacker: GamePokemon) {
  if (ignoresDefenderAbility(attacker)) return false;
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
  const attackerAbility = getPrimaryAbilityName(attacker);
  const defenderAbility = ignoresDefenderAbility(attacker) ? '' : getPrimaryAbilityName(defender);
  const attackerHasStatus = Boolean(getNonVolatileStatusId(attacker)) || attackerAbility === 'comatose';
  const defenderHasStatus = Boolean(getNonVolatileStatusId(defender)) || defenderAbility === 'comatose';
  const defeatistMultiplier = attackerAbility === 'defeatist' && attacker.currentHp <= attacker.maxHp / 2 ? 0.5 : 1;
  if (move.damage_class === 'special') {
    const attackStage = getAdjustedStage(attacker.statStages.spAtk, { isCrit, forAttacker: true });
    const defenseStage = getAdjustedStage(defender.statStages.spDef, { isCrit, forAttacker: false });
    const weatherSpecialDefenseMultiplier = weather === 'sandstorm' && hasType(getCurrentTypeSlots(defender), 'rock') ? 1.5 : 1;
    return {
      attack: Math.max(1, Math.floor(attacker.calculatedStats.spAtk
        * getStatStageModifier(attackStage)
        * defeatistMultiplier
        * (attackerAbility === 'solar-power' && weather === 'sunny' ? 1.5 : 1))),
      defense: Math.max(1, Math.floor(defender.calculatedStats.spDef
        * getStatStageModifier(defenseStage)
        * getSpecialDefenseMultiplierFromItem(defender)
        * weatherSpecialDefenseMultiplier
        * (defenderAbility === 'ice-scales' ? 2 : 1))),
    };
  }

  const attackStage = getAdjustedStage(attacker.statStages.attack, { isCrit, forAttacker: true });
  const defenseStage = getAdjustedStage(defender.statStages.defense, { isCrit, forAttacker: false });
  return {
    attack: Math.max(1, Math.floor(attacker.calculatedStats.attack
      * getStatStageModifier(attackStage)
      * getPhysicalAttackMultiplierFromItem(attacker)
      * defeatistMultiplier
      * (attackerAbility === 'huge-power' || attackerAbility === 'pure-power' ? 2 : 1)
      * (attackerAbility === 'hustle' ? 1.5 : 1)
      * (attackerAbility === 'guts' && attackerHasStatus ? 1.5 : 1))),
    defense: Math.max(1, Math.floor(defender.calculatedStats.defense
      * getStatStageModifier(defenseStage)
      * (defenderAbility === 'fur-coat' ? 2 : 1)
      * (defenderAbility === 'marvel-scale' && defenderHasStatus ? 1.5 : 1))),
  };
}

function getAbilityAdjustedBasePower(move: Move, attacker: GamePokemon, initialPower: number) {
  if (initialPower <= 0) return 0;
  const ability = getPrimaryAbilityName(attacker);
  const statusId = getNonVolatileStatusId(attacker);
  let multiplier = 1;
  if (ability === 'sheer-force' && (move.battleData?.secondaryEffects ?? []).some((effect) => !effect.isPrimary)) multiplier *= 1.3;
  if (ability === 'technician' && initialPower <= 60) multiplier *= 1.5;
  if (ability === 'iron-fist' && move.battleData?.punchMove) multiplier *= 1.2;
  if (ability === 'strong-jaw' && move.battleData?.flags.includes('bite')) multiplier *= 1.5;
  if (ability === 'mega-launcher' && move.battleData?.flags.includes('pulse')) multiplier *= 1.5;
  if (ability === 'sharpness' && move.battleData?.flags.includes('slicing')) multiplier *= 1.5;
  if (ability === 'tough-claws' && move.battleData?.makesContact) multiplier *= 1.3;
  if (ability === 'reckless' && (move.battleData?.recoilPercent ?? 0) > 0) multiplier *= 1.2;
  if (ability === 'water-bubble' && move.type === 'water') multiplier *= 2;
  if (move.type === 'fire' && getVolatileStatus(attacker, 'flash-fire')) multiplier *= 1.5;
  if (ability === 'toxic-boost' && move.damage_class === 'physical' && (statusId === 'poison' || statusId === 'bad_poison')) multiplier *= 1.5;
  if (ability === 'flare-boost' && move.damage_class === 'special' && statusId === 'burn') multiplier *= 1.5;
  if (ability === 'steelworker' && move.type === 'steel') multiplier *= 1.5;
  if (ability === 'rocky-payload' && move.type === 'rock') multiplier *= 1.5;
  if (ability === 'transistor' && move.type === 'electric') multiplier *= 1.3;
  if (ability === 'dragons-maw' && move.type === 'dragon') multiplier *= 1.5;
  const lowHpType = ability === 'overgrow' ? 'grass' : ability === 'blaze' ? 'fire' : ability === 'torrent' ? 'water' : ability === 'swarm' ? 'bug' : null;
  if (lowHpType === move.type && attacker.currentHp <= attacker.maxHp / 3) multiplier *= 1.5;
  return Math.max(1, Math.floor(initialPower * multiplier));
}

function getPostCalculationAbilityMultipliers(
  move: Move,
  attacker: GamePokemon,
  defender: GamePokemon,
  _isCrit: boolean,
  typeMultiplier: number,
) {
  const attackerAbility = getPrimaryAbilityName(attacker);
  const defenderAbility = ignoresDefenderAbility(attacker) ? '' : getPrimaryAbilityName(defender);
  let attackerMultiplier = 1;
  let defenderMultiplier = 1;
  if (attackerAbility === 'tinted-lens' && typeMultiplier <= 0.5) attackerMultiplier *= 2;
  if (attackerAbility === 'neuroforce' && typeMultiplier >= 2) attackerMultiplier *= 1.25;
  if (attackerAbility === 'punk-rock' && move.battleData?.soundMove) attackerMultiplier *= 1.3;
  if (defenderAbility === 'thick-fat' && (move.type === 'fire' || move.type === 'ice')) defenderMultiplier *= 0.5;
  if (defenderAbility === 'heatproof' && move.type === 'fire') defenderMultiplier *= 0.5;
  if (defenderAbility === 'dry-skin' && move.type === 'fire') defenderMultiplier *= 1.25;
  if (defenderAbility === 'water-bubble' && move.type === 'fire') defenderMultiplier *= 0.5;
  if (defenderAbility === 'purifying-salt' && move.type === 'ghost') defenderMultiplier *= 0.5;
  if (defenderAbility === 'fluffy') {
    if (move.battleData?.makesContact) defenderMultiplier *= 0.5;
    if (move.type === 'fire') defenderMultiplier *= 2;
  }
  if (defenderAbility === 'punk-rock' && move.battleData?.soundMove) defenderMultiplier *= 0.5;
  if ((defenderAbility === 'filter' || defenderAbility === 'solid-rock' || defenderAbility === 'prism-armor') && typeMultiplier >= 2) defenderMultiplier *= 0.75;
  if ((defenderAbility === 'multiscale' || defenderAbility === 'shadow-shield') && defender.currentHp >= defender.maxHp) defenderMultiplier *= 0.5;
  return { attackerMultiplier, defenderMultiplier };
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
  if (fieldState.includes('electric_terrain') && moveType === 'electric' && isGrounded(attacker, fieldState)) return 1.3;
  if (fieldState.includes('grassy_terrain') && moveType === 'grass' && isGrounded(attacker, fieldState)) return 1.3;
  if (fieldState.includes('psychic_terrain') && moveType === 'psychic' && isGrounded(attacker, fieldState)) return 1.3;
  if (fieldState.includes('misty_terrain') && moveType === 'dragon' && isGrounded(defender, fieldState)) return 0.5;
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

function getSpecialCaseDamage(
  move: Move,
  attacker: GamePokemon,
  defender: GamePokemon,
  random: () => number,
) {
  const effectId = move.battleData?.effectId;
  if (effectId === 'DRAGON_RAGE') return 40;
  if (effectId === 'SONIC_BOOM') return 20;
  if (effectId === 'LEVEL_DAMAGE') return Math.max(1, attacker.level);
  if (effectId === 'HALF_HP') return Math.max(1, Math.floor(defender.currentHp / 2));
  if (effectId === 'ENDEAVOR') return Math.max(0, defender.currentHp - attacker.currentHp);
  if (effectId === 'RANDOM_LEVEL_DAMAGE') {
    const roll = Math.floor(Math.max(0, Math.min(0.999999999, random())) * 101) + 50;
    return Math.max(1, Math.floor(attacker.level * roll / 100));
  }
  if (effectId === 'ONE_HIT_KO' || effectId === 'SHEER_COLD') {
    if (!ignoresDefenderAbility(attacker) && getPrimaryAbilityName(defender) === 'sturdy') return 0;
    return defender.currentHp;
  }
  if (effectId === 'COUNTER_PHYSICAL') {
    return attacker.factoryLastDamageCategory === 'physical'
      ? Math.max(0, (attacker.factoryLastDamageReceived ?? 0) * 2)
      : 0;
  }
  if (effectId === 'COUNTER_SPECIAL') {
    return attacker.factoryLastDamageCategory === 'special'
      ? Math.max(0, (attacker.factoryLastDamageReceived ?? 0) * 2)
      : 0;
  }
  return null;
}

function getWeightBasedPower(defender: GamePokemon) {
  const weightKg = Math.max(0, (defender.weight ?? 1000) / 10);
  const thresholds = [10, 25, 50, 100, 200];
  let index = 0;
  while (index < thresholds.length && weightKg >= thresholds[index]) index += 1;
  return (index + 1) * 20;
}

function getMagnitudePower(random: () => number) {
  const roll = Math.floor(Math.max(0, Math.min(0.999999999, random())) * 100);
  if (roll < 5) return 10;
  if (roll < 15) return 30;
  if (roll < 35) return 50;
  if (roll < 65) return 70;
  if (roll < 85) return 90;
  if (roll < 95) return 110;
  return 150;
}

function getConsecutiveMovePower(move: Move, attacker: GamePokemon, initialPower: number) {
  const count = Math.max(1, attacker.factoryConsecutiveMoveCount ?? 1);
  const exponent = move.name === 'fury-cutter'
    ? Math.min(2, count - 1)
    : (count - 1) % 5;
  const defenseCurlMultiplier = (move.name === 'rollout' || move.name === 'ice-ball')
    && getVolatileStatus(attacker, 'defense-curl')
    ? 2
    : 1;
  return initialPower * (2 ** exponent) * defenseCurlMultiplier;
}

function getResolvedMoveBasePower(
  move: Move,
  attacker: GamePokemon,
  defender: GamePokemon,
  initialPower: number,
  random?: () => number,
  fieldState: FieldState[] = [],
  weather: Weather = 'none',
) {
  let basePower = initialPower;
  if (move.battleData?.effectId === 'LOW_HP_POWER') basePower = getLowHpPower(attacker);
  if (move.battleData?.effectId === 'HIGH_HP_POWER') basePower = getHighHpPower(attacker);
  if (move.battleData?.effectId === 'FACADE' && getNonVolatileStatusId(attacker)) basePower *= 2;
  if (move.battleData?.effectId === 'WEIGHT_POWER') basePower = getWeightBasedPower(defender);
  if (move.battleData?.effectId === 'FRIENDSHIP_POWER') {
    basePower = Math.max(1, Math.floor(Math.max(0, Math.min(255, attacker.friendship ?? 70)) / 2.5));
  }
  if (move.battleData?.effectId === 'INVERSE_FRIENDSHIP_POWER') {
    basePower = Math.max(1, Math.floor((255 - Math.max(0, Math.min(255, attacker.friendship ?? 70))) / 2.5));
  }
  if (move.battleData?.effectId === 'MAGNITUDE') basePower = random ? getMagnitudePower(random) : 71;
  if (move.battleData?.effectId === 'CONSECUTIVE_POWER') {
    basePower = getConsecutiveMovePower(move, attacker, basePower);
  }
  if (move.battleData?.effectId === 'SPIT_UP') basePower = 100 * Math.max(0, Math.min(3, attacker.factoryStockpileCount ?? 0));
  if (move.battleData?.effectId === 'REVENGE' && attacker.factoryDamagedThisTurn) basePower *= 2;
  if (move.battleData?.effectId === 'SMELLING_SALTS' && getNonVolatileStatusId(defender) === 'paralysis') basePower *= 2;
  if (move.battleData?.effectId === 'KNOCK_OFF' && defender.factoryHeldItemId) basePower *= 1.5;
  if ((move.name === 'earthquake' || move.name === 'magnitude') && fieldState.includes('grassy_terrain') && isGrounded(defender, fieldState)) {
    basePower *= 0.5;
  }
  if ((move.name === 'earthquake' || move.name === 'magnitude') && getVolatileStatus(defender, 'underground')) basePower *= 2;
  if ((move.name === 'stomp' || move.name === 'body-slam') && getVolatileStatus(defender, 'minimized')) basePower *= 2;
  if ((move.name === 'surf' || move.name === 'whirlpool') && getVolatileStatus(defender, 'underwater')) basePower *= 2;
  if (move.name === 'solar-beam' && (weather === 'rainy' || weather === 'sandstorm' || weather === 'hail')) {
    basePower *= 0.5;
  }
  return getAbilityAdjustedBasePower(move, attacker, basePower);
}

function getExpectedSpecialCaseDamage(move: Move, attacker: GamePokemon, defender: GamePokemon) {
  const effectId = move.battleData?.effectId;
  if (effectId === 'DRAGON_RAGE') return 40;
  if (effectId === 'SONIC_BOOM') return 20;
  if (effectId === 'LEVEL_DAMAGE' || effectId === 'RANDOM_LEVEL_DAMAGE') return Math.max(1, attacker.level);
  if (effectId === 'HALF_HP') return Math.max(1, Math.floor(defender.currentHp / 2));
  if (effectId === 'ENDEAVOR') return Math.max(0, defender.currentHp - attacker.currentHp);
  if (effectId === 'ONE_HIT_KO' || effectId === 'SHEER_COLD') {
    if (!ignoresDefenderAbility(attacker) && getPrimaryAbilityName(defender) === 'sturdy') return 0;
    return defender.currentHp;
  }
  if (effectId === 'COUNTER_PHYSICAL') return attacker.factoryLastDamageCategory === 'physical' ? (attacker.factoryLastDamageReceived ?? 0) * 2 : 0;
  if (effectId === 'COUNTER_SPECIAL') return attacker.factoryLastDamageCategory === 'special' ? (attacker.factoryLastDamageReceived ?? 0) * 2 : 0;
  return null;
}

function shouldTreatAsZPoweredMove(attacker: GamePokemon, move: Move) {
  return attacker.specialBoostActive && attacker.specialBoostMode === 'ZMOVE' && move.damage_class !== 'status';
}

export function calculateConfusionSelfHitDamage(pokemon: GamePokemon, random: () => number = Math.random) {
  const levelMultiplier = (2 * pokemon.level / 5) + 2;
  let attack = Math.floor(pokemon.calculatedStats.attack * getStatStageModifier(pokemon.statStages.attack));
  const defense = Math.floor(pokemon.calculatedStats.defense * getStatStageModifier(pokemon.statStages.defense));
  attack *= getPhysicalAttackMultiplierFromItem(pokemon);
  attack = Math.max(1, Math.floor(attack));

  const randomVariance = (Math.floor(Math.max(0, Math.min(0.999999999, random())) * 16) + 85) / 100;
  const damage = Math.floor(((((levelMultiplier * 40 * attack / Math.max(1, defense)) / 50) + 2)) * randomVariance);
  return Math.max(1, damage);
}

export function getEffectiveBattleSpeed(
  pokemon: GamePokemon | null | undefined,
  weather: Weather = 'none',
  fieldState: FieldState[] = [],
) {
  if (!pokemon) return 0;
  const statusId = getNonVolatileStatusId(pokemon);
  const ability = getPrimaryAbilityName(pokemon);
  let abilityMultiplier = 1;
  if (ability === 'quick-feet' && statusId) {
    abilityMultiplier *= statusId === 'paralysis' ? 3 : 1.5;
  }
  if (ability === 'swift-swim' && weather === 'rainy') abilityMultiplier *= 2;
  if (ability === 'chlorophyll' && weather === 'sunny') abilityMultiplier *= 2;
  if (ability === 'sand-rush' && weather === 'sandstorm') abilityMultiplier *= 2;
  if (ability === 'slush-rush' && weather === 'hail') abilityMultiplier *= 2;
  if (ability === 'surge-surfer' && fieldState.includes('electric_terrain')) abilityMultiplier *= 2;
  const paralysisMultiplier = statusId === 'paralysis' ? 0.5 : 1;
  return Math.max(1, Math.floor(
    pokemon.calculatedStats.speed
      * getStatStageModifier(pokemon.statStages.speed)
      * paralysisMultiplier
      * abilityMultiplier,
  ));
}

export function getMoveTypeMultiplier(
  move: Move,
  defender: GamePokemon,
  attacker?: GamePokemon,
  fieldState: FieldState[] = [],
) {
  return resolveTypeEffectiveness(move, defender, attacker, fieldState);
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
  move = resolveBattleMoveType(move, attacker);
  const effectiveWeather: Weather = suppressesWeather(attacker) || suppressesWeather(defender) ? 'none' : weather;
  const attackerAbility = getPrimaryAbilityName(attacker);
  const defenderAbility = getPrimaryAbilityName(defender);
  const dreamEaterBlocked = move.name === 'dream-eater'
    && getNonVolatileStatusId(defender) !== 'sleep'
    && defenderAbility !== 'comatose';
  const dampBlocksSelfDestruct = move.battleData?.effectId === 'SELF_DESTRUCT' && (
    attackerAbility === 'damp'
    || (defenderAbility === 'damp' && !ignoresDefenderAbility(attacker))
  );
  if (dreamEaterBlocked || dampBlocksSelfDestruct) {
    return {
      damage: 0,
      multiplier: 1,
      isMiss: false,
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
      weather: effectiveWeather,
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

  if (move.battleData?.effectId === 'PRESENT') {
    const typeMultiplier = resolveTypeEffectiveness(move, defender, attacker, fieldState);
    const presentRoll = Math.floor(Math.max(0, Math.min(0.999999999, random())) * 100);
    if (presentRoll > 80) {
      return {
        damage: 0,
        multiplier: typeMultiplier,
        isMiss: false,
        isCrit: false,
        blockedByProtect,
        protectReducedDamage,
        blockedBySubstitute: false,
        substituteDamage: 0,
        substituteHpRemaining: null,
        substituteBroke: false,
        applyUserSecondaryEffects: false,
        applyTargetSecondaryEffects: false,
        targetHealing: typeMultiplier > 0
          ? Math.max(0, Math.min(Math.floor(defender.maxHp / 4), defender.maxHp - defender.currentHp))
          : 0,
      };
    }
    basePowerOverride = presentRoll <= 40 ? 40 : presentRoll <= 70 ? 80 : 120;
  }

  const specialCaseDamage = getSpecialCaseDamage(move, attacker, defender, random);
  const focusEnergyCritStages = hasVolatileStatus(attacker, 'crit-boost') ? 2 : 0;
  const critStage = (move.battleData?.critStage ?? move.critRate ?? 0)
    + getAdditionalCritStageFromItem(attacker)
    + focusEnergyCritStages;
  const isCrit = specialCaseDamage === null
    && !isCritBlocked(defender, attacker)
    && random() < getCritChanceFromStage(critStage);
  const { attack, defense } = getEffectiveOffenseAndDefense(move, attacker, defender, isCrit, effectiveWeather);

  if (specialCaseDamage !== null) {
    const typeMultiplier = resolveTypeEffectiveness(move, defender, attacker, fieldState);
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

  const basePower = getResolvedMoveBasePower(
    move,
    attacker,
    defender,
    basePowerOverride ?? move.power ?? 40,
    random,
    fieldState,
    effectiveWeather,
  );
  if (basePower <= 0) {
    const typeMultiplier = resolveTypeEffectiveness(move, defender, attacker, fieldState);
    return {
      damage: 0,
      multiplier: typeMultiplier,
      isMiss: false,
      isCrit: false,
      blockedByProtect,
      protectReducedDamage,
      blockedBySubstitute: false,
      substituteDamage: 0,
      substituteHpRemaining: null,
      substituteBroke: false,
      applyUserSecondaryEffects: false,
      applyTargetSecondaryEffects: false,
    };
  }
  const levelMultiplier = (2 * attacker.level / 5) + 2;
  const typeMultiplier = resolveTypeEffectiveness(move, defender, attacker, fieldState);
  const stabMultiplier = getSameTypeAttackBonusMultiplier(attacker, move.type);
  const weatherMultiplier = getWeatherMultiplier(effectiveWeather, move.type);
  const terrainMultiplier = getTerrainMoveMultiplier(fieldState, move.type, attacker, defender);
  const critMultiplier = isCrit ? (getPrimaryAbilityName(attacker) === 'sniper' ? 2.25 : 1.5) : 1;
  const burnMultiplier = getNonVolatileStatusId(attacker) === 'burn'
    && move.damage_class === 'physical'
    && getPrimaryAbilityName(attacker) !== 'guts'
    && move.battleData?.effectId !== 'FACADE'
    ? 0.5
    : 1;
  const zMoveBoost = shouldTreatAsZPoweredMove(attacker, move) ? 1.55 : 1;
  const heldTypeBoost = getHeldMovePowerMultiplier(attacker, move.type);
  const protectMultiplier = protectReducedDamage ? 0.25 : 1;
  const screenBypassed = isCrit
    || getPrimaryAbilityName(attacker) === 'infiltrator'
    || move.battleData?.effectId === 'BREAK_SCREENS';
  const screenMultiplier = !screenBypassed && (
    (move.damage_class === 'physical' && hasVolatileStatus(defender, 'reflect'))
    || (move.damage_class === 'special' && hasVolatileStatus(defender, 'light-screen'))
  ) ? 0.5 : 1;
  const randomVariance = (Math.floor(Math.max(0, Math.min(0.999999999, random())) * 16) + 85) / 100;

  let perHitDamage = Math.floor(
    ((((levelMultiplier * basePower * attack / Math.max(1, defense)) / 50) + 2)
      * randomVariance
      * typeMultiplier
      * stabMultiplier
      * weatherMultiplier
      * terrainMultiplier
      * critMultiplier
      * burnMultiplier
      * zMoveBoost
      * heldTypeBoost
      * protectMultiplier
      * screenMultiplier),
  );

  if (typeMultiplier > 0) {
    perHitDamage = Math.max(1, perHitDamage);
  }
  const abilityMultipliers = getPostCalculationAbilityMultipliers(move, attacker, defender, isCrit, typeMultiplier);
  const applyDamageMultiplier = (damage: number, multiplier: number) => (
    typeMultiplier > 0 ? Math.max(1, Math.floor(damage * multiplier)) : 0
  );
  perHitDamage = applyDamageMultiplier(perHitDamage, abilityMultipliers.attackerMultiplier);
  if (
    !ignoresDefenderAbility(attacker)
    && getPrimaryAbilityName(defender) === 'fluffy'
    && move.battleData?.makesContact
    && move.type === 'fire'
  ) {
    perHitDamage = applyDamageMultiplier(perHitDamage, 0.5);
    perHitDamage = applyDamageMultiplier(perHitDamage, 2);
  } else {
    perHitDamage = applyDamageMultiplier(perHitDamage, abilityMultipliers.defenderMultiplier);
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
  move = resolveBattleMoveType(move, attacker);
  if (
    (move.name === 'dream-eater' && getNonVolatileStatusId(defender) !== 'sleep' && getPrimaryAbilityName(defender) !== 'comatose')
    || (move.battleData?.effectId === 'SELF_DESTRUCT' && (
      getPrimaryAbilityName(attacker) === 'damp'
      || (getPrimaryAbilityName(defender) === 'damp' && !ignoresDefenderAbility(attacker))
    ))
  ) return 0;
  const expectedSpecialDamage = getExpectedSpecialCaseDamage(move, attacker, defender);
  if (expectedSpecialDamage !== null) {
    return resolveTypeEffectiveness(move, defender, attacker) > 0 ? expectedSpecialDamage : 0;
  }

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
  const basePower = getResolvedMoveBasePower(move, simulatedAttacker, defender, move.power ?? 40);
  const expectedHits = getExpectedMoveHitCount(move, simulatedAttacker);
  const levelScale = ((2 * attacker.level) / 5) + 2;
  const typeMultiplier = resolveTypeEffectiveness(move, defender, simulatedAttacker);
  const stabMultiplier = getSameTypeAttackBonusMultiplier(simulatedAttacker, move.type);
  const heldTypeBoost = getHeldMovePowerMultiplier(attacker, move.type);
  const zMoveBoost = gimmickMode === 'ZMOVE' ? 1.55 : 1;
  const burnMultiplier = getNonVolatileStatusId(simulatedAttacker) === 'burn'
    && move.damage_class === 'physical'
    && getPrimaryAbilityName(simulatedAttacker) !== 'guts'
    && move.battleData?.effectId !== 'FACADE'
    ? 0.5
    : 1;
  const abilityMultipliers = getPostCalculationAbilityMultipliers(move, simulatedAttacker, defender, false, typeMultiplier);
  const raw = (((levelScale * basePower * Math.max(1, attack)) / Math.max(1, defense)) / 50) + 2;
  if (typeMultiplier <= 0) return 0;
  return Math.max(1, Math.floor(
    raw
      * typeMultiplier
      * stabMultiplier
      * heldTypeBoost
      * zMoveBoost
      * burnMultiplier
      * expectedHits
      * abilityMultipliers.attackerMultiplier
      * abilityMultipliers.defenderMultiplier,
  ));
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
  move = resolveBattleMoveType(move, attacker);
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

  if (
    (move.name === 'dream-eater' && getNonVolatileStatusId(simulatedDefender) !== 'sleep' && getPrimaryAbilityName(simulatedDefender) !== 'comatose')
    || (move.battleData?.effectId === 'SELF_DESTRUCT' && (
      getPrimaryAbilityName(simulatedAttacker) === 'damp'
      || (getPrimaryAbilityName(simulatedDefender) === 'damp' && !ignoresDefenderAbility(simulatedAttacker))
    ))
  ) return 0;

  const expectedSpecialDamage = getExpectedSpecialCaseDamage(move, simulatedAttacker, simulatedDefender);
  if (expectedSpecialDamage !== null) {
    return resolveTypeEffectiveness(move, simulatedDefender, simulatedAttacker) > 0 ? expectedSpecialDamage : 0;
  }

  const { attack, defense } = getEffectiveOffenseAndDefense(move, simulatedAttacker, simulatedDefender, false);
  const basePower = getResolvedMoveBasePower(move, simulatedAttacker, simulatedDefender, move.power ?? 40);
  const expectedHits = getExpectedMoveHitCount(move, simulatedAttacker);
  const levelScale = ((2 * attacker.level) / 5) + 2;
  const typeMultiplier = resolveTypeEffectiveness(move, simulatedDefender, simulatedAttacker);
  const stabMultiplier = getSameTypeAttackBonusMultiplier(simulatedAttacker, move.type);
  const heldTypeBoost = getHeldMovePowerMultiplier(attacker, move.type);
  const zMoveBoost = attackerGimmick === 'ZMOVE' ? 1.55 : 1;
  const burnMultiplier = getNonVolatileStatusId(simulatedAttacker) === 'burn'
    && move.damage_class === 'physical'
    && getPrimaryAbilityName(simulatedAttacker) !== 'guts'
    && move.battleData?.effectId !== 'FACADE'
    ? 0.5
    : 1;
  const abilityMultipliers = getPostCalculationAbilityMultipliers(move, simulatedAttacker, simulatedDefender, false, typeMultiplier);
  const raw = (((levelScale * basePower * Math.max(1, attack)) / Math.max(1, defense)) / 50) + 2;
  if (typeMultiplier <= 0) return 0;
  return Math.max(1, Math.floor(
    raw
      * typeMultiplier
      * stabMultiplier
      * heldTypeBoost
      * zMoveBoost
      * burnMultiplier
      * expectedHits
      * abilityMultipliers.attackerMultiplier
      * abilityMultipliers.defenderMultiplier,
  ));
}
