import type { FieldState, GamePokemon, Move, StatStages, Weather } from '../../../types';
import { AILMENT_ZH, STAT_ZH } from '../battle/battleText';
import { getMoveSecondaryEffects, getMoveTarget, hasAbilityBattleEffect, hasMoveBattleEffect } from '../data/battle';
import type { LocalizeFn } from '../view-model';
import {
  clearNonVolatileStatus,
  clearVolatileStatus,
  getNonVolatileStatusId,
  getVolatileStatus,
  hasNonVolatileStatus,
  hasVolatileStatus,
  normalizeBattleStatusId,
  normalizeNonVolatileStatusId,
  setNonVolatileStatus,
  setVolatileStatus,
} from '../utils/battleStatus';

export type BattleSide = 'player' | 'enemy';

export interface BattleTeams {
  playerTeam: GamePokemon[];
  enemyTeam: GamePokemon[];
}

interface ApplyMoveSecondaryEffectsOptions {
  move: Move;
  actingSide: BattleSide;
  teams: BattleTeams;
  fieldState?: FieldState[];
  weather?: Weather;
  getLocalized: LocalizeFn;
  targetHasActedThisTurn?: boolean;
  extraFlinchChance?: number;
  allowUserEffects?: boolean;
  allowTargetEffects?: boolean;
  random?: () => number;
}

interface BattleMessageResult {
  messages: string[];
}

export interface ApplyMoveSecondaryEffectsResult extends BattleTeams, BattleMessageResult {
  flinched: boolean;
}

export interface ApplyResidualDamageResult extends BattleMessageResult {
  pokemon: GamePokemon;
  fainted: boolean;
}

interface ApplyWeatherChipDamageOptions {
  pokemon: GamePokemon;
  weather: Weather;
  getLocalized: LocalizeFn;
}

interface ResolveYawnEndTurnOptions {
  pokemon: GamePokemon;
  playerTeam: GamePokemon[];
  enemyTeam: GamePokemon[];
  fieldState?: FieldState[];
  getLocalized: LocalizeFn;
  random?: () => number;
}

function isRockGroundSteelType(pokemon: GamePokemon) {
  return pokemon.types.some((typeSlot) => ['rock', 'ground', 'steel'].includes(typeSlot.type.name));
}

function isIceType(pokemon: GamePokemon) {
  return pokemon.types.some((typeSlot) => typeSlot.type.name === 'ice');
}

function hasPokemonType(pokemon: GamePokemon | null | undefined, typeName: string) {
  return Boolean(pokemon?.types.some((typeSlot) => typeSlot.type.name === typeName));
}

function isGrounded(pokemon: GamePokemon | null | undefined, fieldState: FieldState[] = []) {
  if (!pokemon) return false;
  if (fieldState.includes('gravity')) return true;
  const ability = (pokemon.abilities?.[0]?.ability?.name ?? '').trim().toLowerCase().replace(/_/g, '-');
  return !hasPokemonType(pokemon, 'flying') && ability !== 'levitate' && ability !== 'eelevate';
}

function ignoresDefenderAbility(sourcePokemon: GamePokemon | null | undefined) {
  const ability = (sourcePokemon?.abilities?.[0]?.ability?.name ?? '').trim().toLowerCase().replace(/_/g, '-');
  return ability === 'mold-breaker' || ability === 'teravolt' || ability === 'turboblaze';
}

function isGhostType(pokemon: GamePokemon | null | undefined) {
  return Boolean(pokemon?.types.some((typeSlot) => typeSlot.type.name === 'ghost'));
}

function areBattlersOfOppositeGender(attacker: GamePokemon | null | undefined, target: GamePokemon | null | undefined) {
  const attackerGender = attacker?.gender;
  const targetGender = target?.gender;
  if (!attackerGender || !targetGender) return false;
  if (attackerGender === 'genderless' || targetGender === 'genderless') return false;
  return attackerGender !== targetGender;
}

function replaceLead(team: GamePokemon[], pokemon: GamePokemon) {
  const nextTeam = [...team];
  nextTeam[0] = pokemon;
  return nextTeam;
}

function findMoveByName(pokemon: GamePokemon, moveName?: string | null) {
  if (!moveName) return undefined;
  return pokemon.selectedMoves.find((move) => move.name === moveName);
}

function isNonVolatileStatusBlocked(
  targetPokemon: GamePokemon,
  statusId: string | null,
  fieldState?: FieldState[],
  move?: Move,
  sourcePokemon?: GamePokemon,
  weather: Weather = 'none',
) {
  if (!statusId) return false;
  const targetAbility = targetPokemon?.abilities?.[0]?.ability?.name;
  const sourceAbility = sourcePokemon?.abilities?.[0]?.ability?.name;
  const ignoresTargetAbility = ignoresDefenderAbility(sourcePokemon);
  if (
    hasAbilityBattleEffect(targetAbility, 'COMATOSE')
    || (!ignoresTargetAbility && hasAbilityBattleEffect(targetAbility, 'PURIFYING_SALT'))
    || (!ignoresTargetAbility && hasAbilityBattleEffect(targetAbility, 'LEAF_GUARD') && weather === 'sunny')
  ) return true;
  if (
    getVolatileStatus(targetPokemon, 'safeguard')
    && (sourceAbility ?? '').trim().toLowerCase().replace(/_/g, '-') !== 'infiltrator'
  ) return true;
  if (move?.battleData?.powderMove && hasPokemonType(targetPokemon, 'grass')) return true;
  if (statusId === 'burn' && (hasPokemonType(targetPokemon, 'fire') || (!ignoresTargetAbility && hasAbilityBattleEffect(targetAbility, 'BURN_IMMUNITY')))) return true;
  if (statusId === 'freeze' && (
    hasPokemonType(targetPokemon, 'ice')
    || weather === 'sunny'
    || (!ignoresTargetAbility && hasAbilityBattleEffect(targetAbility, 'FREEZE_IMMUNITY'))
  )) return true;
  if (statusId === 'paralysis' && (
    hasPokemonType(targetPokemon, 'electric')
    || (!ignoresTargetAbility && hasAbilityBattleEffect(targetAbility, 'PARALYSIS_IMMUNITY'))
  )) return true;
  if (statusId === 'paralysis' && move?.type === 'electric' && hasPokemonType(targetPokemon, 'ground')) return true;
  if ((statusId === 'poison' || statusId === 'bad_poison') && (
    (!ignoresTargetAbility && hasAbilityBattleEffect(targetAbility, 'POISON_IMMUNITY'))
    || (
      !hasAbilityBattleEffect(sourceAbility, 'CORROSION')
      && (hasPokemonType(targetPokemon, 'poison') || hasPokemonType(targetPokemon, 'steel'))
    )
  )) return true;
  if (statusId === 'sleep' && (
    (!ignoresTargetAbility && hasAbilityBattleEffect(targetAbility, 'INSOMNIA'))
    || (!ignoresTargetAbility && hasAbilityBattleEffect(targetAbility, 'VITAL_SPIRIT'))
    || (fieldState?.includes('electric_terrain') && isGrounded(targetPokemon, fieldState ?? []))
  )) return true;
  if (fieldState?.includes('misty_terrain') && isGrounded(targetPokemon, fieldState ?? [])) return true;
  return false;
}

function isSleepBlockedByUproar(targetPokemon: GamePokemon, playerTeam: GamePokemon[], enemyTeam: GamePokemon[]) {
  if (hasAbilityBattleEffect(targetPokemon?.abilities?.[0]?.ability?.name, 'SOUNDPROOF')) return false;
  const activeLeads = [playerTeam[0], enemyTeam[0]];
  return activeLeads.some((pokemon) => Boolean(getVolatileStatus(pokemon, 'uproar')));
}

export function moveTeamMemberToFront<T>(team: T[], index: number): T[] {
  const nextTeam = [...team];
  const [selectedMember] = nextTeam.splice(index, 1);
  nextTeam.unshift(selectedMember);
  return nextTeam;
}

export function findNextLivingLeadIndex(team: GamePokemon[], options?: { excludeId?: number }) {
  return team.findIndex((pokemon) => pokemon.currentHp > 0 && (options?.excludeId === undefined || pokemon.id !== options.excludeId));
}

export function applyWeatherChipDamage({
  pokemon,
  weather,
  getLocalized,
}: ApplyWeatherChipDamageOptions): ApplyResidualDamageResult {
  if (pokemon.currentHp <= 0) {
    return { pokemon, messages: [], fainted: false };
  }
  const ability = (pokemon.abilities?.[0]?.ability?.name ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (hasAbilityBattleEffect(ability, 'MAGIC_GUARD')) {
    return { pokemon, messages: [], fainted: false };
  }

  const healForWeather = (
    (weather === 'rainy' && (ability === 'dry-skin' || ability === 'rain-dish'))
    || (weather === 'hail' && ability === 'ice-body')
  );
  if (healForWeather) {
    const denominator = ability === 'dry-skin' ? 8 : 16;
    const heal = Math.max(0, Math.min(Math.floor(pokemon.maxHp / denominator), pokemon.maxHp - pokemon.currentHp));
    const updatedPokemon = heal > 0 ? { ...pokemon, currentHp: pokemon.currentHp + heal } : pokemon;
    return {
      pokemon: updatedPokemon,
      messages: heal > 0 ? [`${getLocalized(updatedPokemon)} restored HP in the weather!`] : [],
      fainted: false,
    };
  }

  if (weather === 'sunny' && (ability === 'dry-skin' || ability === 'solar-power')) {
    const weatherDamage = Math.max(1, Math.floor(pokemon.maxHp / 8));
    const updatedPokemon = { ...pokemon, currentHp: Math.max(0, pokemon.currentHp - weatherDamage) };
    return {
      pokemon: updatedPokemon,
      messages: [`${getLocalized(updatedPokemon)} was hurt by the sunlight!`],
      fainted: updatedPokemon.currentHp <= 0,
    };
  }

  const blocksSandDamage = ['overcoat', 'sand-force', 'sand-rush', 'sand-veil'].includes(ability);
  if (weather === 'sandstorm' && !isRockGroundSteelType(pokemon) && !blocksSandDamage) {
    const weatherDamage = Math.max(1, Math.floor(pokemon.maxHp / 16));
    const updatedPokemon = { ...pokemon, currentHp: Math.max(0, pokemon.currentHp - weatherDamage) };
    return {
      pokemon: updatedPokemon,
      messages: [`${getLocalized(updatedPokemon)} is hurt by the sandstorm!`],
      fainted: updatedPokemon.currentHp <= 0,
    };
  }

  const blocksHailDamage = ['ice-body', 'overcoat', 'slush-rush', 'snow-cloak'].includes(ability);
  if (weather === 'hail' && !isIceType(pokemon) && !blocksHailDamage) {
    const weatherDamage = Math.max(1, Math.floor(pokemon.maxHp / 16));
    const updatedPokemon = { ...pokemon, currentHp: Math.max(0, pokemon.currentHp - weatherDamage) };
    return {
      pokemon: updatedPokemon,
      messages: [`${getLocalized(updatedPokemon)} is pelted by hail!`],
      fainted: updatedPokemon.currentHp <= 0,
    };
  }

  return { pokemon, messages: [], fainted: false };
}

export function applyStatusResidualDamage(pokemon: GamePokemon, getLocalized: LocalizeFn): ApplyResidualDamageResult {
  const statusId = getNonVolatileStatusId(pokemon);
  if (pokemon.currentHp <= 0 || (statusId !== 'poison' && statusId !== 'burn' && statusId !== 'bad_poison')) {
    return { pokemon, messages: [], fainted: false };
  }

  const abilityName = pokemon?.abilities?.[0]?.ability?.name;
  if (hasAbilityBattleEffect(abilityName, 'MAGIC_GUARD')) {
    return { pokemon, messages: [], fainted: false };
  }
  if (
    hasAbilityBattleEffect(abilityName, 'POISON_HEAL')
    && (statusId === 'poison' || statusId === 'bad_poison')
  ) {
    const healAmount = Math.max(1, Math.min(Math.floor(pokemon.maxHp / 8), pokemon.maxHp - pokemon.currentHp));
    let updatedPokemon = healAmount > 0
      ? { ...pokemon, currentHp: pokemon.currentHp + healAmount }
      : pokemon;
    if (statusId === 'bad_poison') {
      updatedPokemon = setNonVolatileStatus(updatedPokemon, 'bad_poison', {
        toxicCounter: (pokemon.nonVolatileStatus?.toxicCounter ?? 1) + 1,
        sourceMoveName: pokemon.nonVolatileStatus?.sourceMoveName,
      });
    }
    return {
      pokemon: updatedPokemon,
      messages: healAmount > 0 ? [`${getLocalized(updatedPokemon)} restored HP with Poison Heal!`] : [],
      fainted: false,
    };
  }

  const toxicCounter = pokemon.nonVolatileStatus?.toxicCounter ?? 1;
  let statusDamage = statusId === 'bad_poison'
    ? Math.max(1, Math.floor((pokemon.maxHp * toxicCounter) / 16))
    : statusId === 'burn'
      ? Math.max(1, Math.floor(pokemon.maxHp / 16))
      : Math.max(1, Math.floor(pokemon.maxHp / 8));
  if (statusId === 'burn' && hasAbilityBattleEffect(abilityName, 'HEATPROOF')) {
    statusDamage = Math.max(1, Math.floor(statusDamage * 0.5));
  }
  let updatedPokemon: GamePokemon = {
    ...pokemon,
    currentHp: Math.max(0, pokemon.currentHp - statusDamage),
  };

  if (statusId === 'bad_poison') {
    updatedPokemon = setNonVolatileStatus(updatedPokemon, 'bad_poison', {
      turnsRemaining: pokemon.nonVolatileStatus?.turnsRemaining,
      toxicCounter: toxicCounter + 1,
      sourceMoveName: pokemon.nonVolatileStatus?.sourceMoveName,
    });
  }

  return {
    pokemon: updatedPokemon,
    messages: [`${getLocalized(updatedPokemon)} took ${AILMENT_ZH[statusId] || statusId} damage!`],
    fainted: updatedPokemon.currentHp <= 0,
  };
}

export function applyNightmareResidualDamage(pokemon: GamePokemon, getLocalized: LocalizeFn): ApplyResidualDamageResult {
  if (pokemon.currentHp <= 0 || !hasVolatileStatus(pokemon, 'nightmare')) {
    return { pokemon, messages: [], fainted: false };
  }

  if (getNonVolatileStatusId(pokemon) !== 'sleep') {
    return {
      pokemon: clearVolatileStatus(pokemon, 'nightmare'),
      messages: [],
      fainted: false,
    };
  }

  const nightmareDamage = Math.max(1, Math.floor(pokemon.maxHp / 4));
  const updatedPokemon = {
    ...pokemon,
    currentHp: Math.max(0, pokemon.currentHp - nightmareDamage),
  };

  return {
    pokemon: updatedPokemon,
    messages: [`${getLocalized(updatedPokemon)} is locked in a nightmare!`],
    fainted: updatedPokemon.currentHp <= 0,
  };
}

export function applyCurseResidualDamage(pokemon: GamePokemon, getLocalized: LocalizeFn): ApplyResidualDamageResult {
  if (pokemon.currentHp <= 0 || !hasVolatileStatus(pokemon, 'curse')) {
    return { pokemon, messages: [], fainted: false };
  }

  const curseDamage = Math.max(1, Math.floor(pokemon.maxHp / 4));
  const updatedPokemon = {
    ...pokemon,
    currentHp: Math.max(0, pokemon.currentHp - curseDamage),
  };

  return {
    pokemon: updatedPokemon,
    messages: [`${getLocalized(updatedPokemon)} is afflicted by the curse!`],
    fainted: updatedPokemon.currentHp <= 0,
  };
}

export function resolveYawnEndTurn({
  pokemon,
  playerTeam,
  enemyTeam,
  fieldState,
  getLocalized,
  random = Math.random,
}: ResolveYawnEndTurnOptions): ApplyResidualDamageResult {
  const yawnState = getVolatileStatus(pokemon, 'yawn');
  if (!yawnState || pokemon.currentHp <= 0) {
    return { pokemon, messages: [], fainted: false };
  }

  const turnsRemaining = Math.max(0, yawnState.turnsRemaining ?? 2);
  if (turnsRemaining > 1) {
    return {
      pokemon: setVolatileStatus(pokemon, 'yawn', {
        turnsRemaining: turnsRemaining - 1,
        sourceMoveName: yawnState.sourceMoveName,
      }),
      messages: [],
      fainted: false,
    };
  }

  let updatedPokemon = clearVolatileStatus(pokemon, 'yawn');
  if (
    hasNonVolatileStatus(updatedPokemon)
    || hasAbilityBattleEffect(updatedPokemon?.abilities?.[0]?.ability?.name, 'INSOMNIA')
    || hasAbilityBattleEffect(updatedPokemon?.abilities?.[0]?.ability?.name, 'VITAL_SPIRIT')
    || isNonVolatileStatusBlocked(updatedPokemon, 'sleep', fieldState)
    || isSleepBlockedByUproar(updatedPokemon, playerTeam, enemyTeam)
  ) {
    return { pokemon: updatedPokemon, messages: [], fainted: false };
  }

  updatedPokemon = setNonVolatileStatus(updatedPokemon, 'sleep', {}, random);
  return {
    pokemon: updatedPokemon,
    messages: [`${getLocalized(updatedPokemon)} grew drowsy and fell asleep!`],
    fainted: false,
  };
}

export function applyMoveSecondaryEffects({
  move,
  actingSide,
  teams,
  fieldState,
  weather = 'none',
  getLocalized,
  targetHasActedThisTurn = false,
  extraFlinchChance = 0,
  allowUserEffects = true,
  allowTargetEffects = true,
  random = Math.random,
}: ApplyMoveSecondaryEffectsOptions): ApplyMoveSecondaryEffectsResult {
  let playerTeam = [...teams.playerTeam];
  let enemyTeam = [...teams.enemyTeam];
  let actorPokemon = { ...(actingSide === 'player' ? playerTeam[0] : enemyTeam[0]) };
  const weatherSuppressed = [playerTeam[0], enemyTeam[0]].some((pokemon) => (
    ['air-lock', 'cloud-nine'].includes((pokemon?.abilities?.[0]?.ability?.name ?? '').trim().toLowerCase().replace(/_/g, '-'))
  ));
  const effectiveWeather: Weather = weatherSuppressed ? 'none' : weather;
  const isGhostCurse = hasMoveBattleEffect(move, 'CURSE') && isGhostType(actorPokemon);
  const targetSide: BattleSide = isGhostCurse
    ? (actingSide === 'player' ? 'enemy' : 'player')
    : hasMoveBattleEffect(move, 'CURSE')
      ? actingSide
      : getMoveTarget(move) === 'user'
        ? actingSide
        : (actingSide === 'player' ? 'enemy' : 'player');
  const targetTeam = targetSide === 'player' ? playerTeam : enemyTeam;
  const originalTarget = targetTeam[0];

  if (!originalTarget) {
    return { playerTeam, enemyTeam, messages: [], flinched: false };
  }

  let targetPokemon = { ...originalTarget };
  const messages: string[] = [];

  if (hasMoveBattleEffect(move, 'SAFEGUARD')) {
    const protectedTeam = (actingSide === 'player' ? playerTeam : enemyTeam).map((pokemon) => setVolatileStatus(
      pokemon,
      'safeguard',
      { turnsRemaining: 5, sourceMoveName: move.name },
    ));
    if (actingSide === 'player') playerTeam = protectedTeam;
    else enemyTeam = protectedTeam;
    actorPokemon = protectedTeam[0];
    messages.push(`${getLocalized(actorPokemon)}'s team became protected by Safeguard!`);
  }
  const screenStatus = hasMoveBattleEffect(move, 'REFLECT')
    ? 'reflect'
    : hasMoveBattleEffect(move, 'LIGHT_SCREEN')
      ? 'light-screen'
      : null;
  if (screenStatus) {
    const screenedTeam = (actingSide === 'player' ? playerTeam : enemyTeam).map((pokemon) => setVolatileStatus(
      pokemon,
      screenStatus,
      { turnsRemaining: 5, sourceMoveName: move.name },
    ));
    if (actingSide === 'player') playerTeam = screenedTeam;
    else enemyTeam = screenedTeam;
    actorPokemon = screenedTeam[0];
    messages.push(`${getLocalized(actorPokemon)}'s team put up ${move.name}!`);
  }
  if (hasMoveBattleEffect(move, 'BREAK_SCREENS')) {
    const clearedTeam = (targetSide === 'player' ? playerTeam : enemyTeam).map((pokemon) => (
      clearVolatileStatus(clearVolatileStatus(pokemon, 'reflect'), 'light-screen')
    ));
    if (targetSide === 'player') playerTeam = clearedTeam;
    else enemyTeam = clearedTeam;
    targetPokemon = clearedTeam[0];
  }
  if (hasMoveBattleEffect(move, 'PARTY_STATUS_CURE')) {
    const curedTeam = (actingSide === 'player' ? playerTeam : enemyTeam).map((pokemon) => (
      move.name === 'heal-bell' && hasAbilityBattleEffect(pokemon?.abilities?.[0]?.ability?.name, 'SOUNDPROOF')
        ? pokemon
        : clearNonVolatileStatus(pokemon)
    ));
    if (actingSide === 'player') playerTeam = curedTeam;
    else enemyTeam = curedTeam;
    actorPokemon = curedTeam[0];
    messages.push(`${getLocalized(actorPokemon)}'s team was cured of status conditions!`);
  }
  if (hasMoveBattleEffect(move, 'REFRESH')) {
    const refreshableStatus = getNonVolatileStatusId(actorPokemon);
    if (refreshableStatus === 'burn' || refreshableStatus === 'paralysis' || refreshableStatus === 'poison' || refreshableStatus === 'bad_poison') {
      actorPokemon = clearNonVolatileStatus(actorPokemon);
      messages.push(`${getLocalized(actorPokemon)} became healthy!`);
    }
  }
  if (targetSide === actingSide) targetPokemon = actorPokemon;

  if (hasMoveBattleEffect(move, 'HP_SPLIT') && targetSide !== actingSide) {
    const sharedHp = Math.floor((actorPokemon.currentHp + targetPokemon.currentHp) / 2);
    actorPokemon = { ...actorPokemon, currentHp: Math.min(actorPokemon.maxHp, sharedHp) };
    targetPokemon = { ...targetPokemon, currentHp: Math.min(targetPokemon.maxHp, sharedHp) };
    messages.push(`${getLocalized(actorPokemon)} shared its pain with ${getLocalized(targetPokemon)}!`);
  }
  if (hasMoveBattleEffect(move, 'BELLY_DRUM')) {
    const hpCost = Math.max(1, Math.floor(actorPokemon.maxHp / 2));
    if (actorPokemon.currentHp > hpCost && actorPokemon.statStages.attack < 6) {
      actorPokemon = {
        ...actorPokemon,
        currentHp: actorPokemon.currentHp - hpCost,
        statStages: { ...actorPokemon.statStages, attack: 6 },
      };
      targetPokemon = actorPokemon;
      messages.push(`${getLocalized(actorPokemon)} cut its HP and maximized its Attack!`);
    }
  }
  if (hasMoveBattleEffect(move, 'FOCUS_ENERGY')) {
    actorPokemon = setVolatileStatus(actorPokemon, 'crit-boost', {
      sourceMoveName: move.name,
      counter: 2,
    });
    targetPokemon = actorPokemon;
  }
  if (hasMoveBattleEffect(move, 'FORESIGHT')) {
    targetPokemon = setVolatileStatus(targetPokemon, 'foresight', { sourceMoveName: move.name });
  }
  if (hasMoveBattleEffect(move, 'HAZE')) {
    const resetStages = (pokemon: GamePokemon) => clearVolatileStatus({
      ...pokemon,
      statStages: {
        attack: 0,
        defense: 0,
        spAtk: 0,
        spDef: 0,
        speed: 0,
        accuracy: 0,
        evasion: 0,
      },
    }, 'crit-boost');
    actorPokemon = resetStages(actorPokemon);
    targetPokemon = resetStages(targetPokemon);
  }
  if (hasMoveBattleEffect(move, 'PSYCH_UP')) {
    actorPokemon = {
      ...actorPokemon,
      statStages: { ...targetPokemon.statStages },
    };
    actorPokemon = hasVolatileStatus(targetPokemon, 'crit-boost')
      ? setVolatileStatus(actorPokemon, 'crit-boost', { counter: 2, sourceMoveName: move.name })
      : clearVolatileStatus(actorPokemon, 'crit-boost');
  }
  if (
    hasMoveBattleEffect(move, 'LEECH_SEED')
    && allowTargetEffects
    && !targetPokemon.types.some((slot) => slot.type.name === 'grass')
    && !hasVolatileStatus(targetPokemon, 'seeded')
  ) {
    targetPokemon = setVolatileStatus(targetPokemon, 'seeded', {
      sourceMoveName: move.name,
      linkedPokemonId: actorPokemon.id,
    });
  }
  if (
    hasMoveBattleEffect(move, 'DAMAGING_TRAP')
    && allowTargetEffects
    && !hasVolatileStatus(targetPokemon, 'trapped')
  ) {
    targetPokemon = setVolatileStatus(targetPokemon, 'trapped', {
      turnsRemaining: 4 + Math.floor(Math.max(0, Math.min(0.999999999, random())) * 2),
      sourceMoveName: move.name,
      linkedPokemonId: actorPokemon.id,
    });
  }
  if (hasMoveBattleEffect(move, 'PERISH_SONG')) {
    if (!hasAbilityBattleEffect(actorPokemon.abilities?.[0]?.ability?.name, 'SOUNDPROOF')) {
      actorPokemon = setVolatileStatus(actorPokemon, 'perish-song', { counter: 3, sourceMoveName: move.name });
    }
    if (!hasAbilityBattleEffect(targetPokemon.abilities?.[0]?.ability?.name, 'SOUNDPROOF')) {
      targetPokemon = setVolatileStatus(targetPokemon, 'perish-song', { counter: 3, sourceMoveName: move.name });
    }
  }
  if (hasMoveBattleEffect(move, 'INGRAIN')) {
    actorPokemon = setVolatileStatus(actorPokemon, 'ingrain', {
      sourceMoveName: move.name,
      linkedPokemonId: actorPokemon.id,
    });
    targetPokemon = actorPokemon;
  }

  if (move.name === 'defense-curl') {
    actorPokemon = setVolatileStatus(actorPokemon, 'defense-curl', { sourceMoveName: move.name });
  }
  if (move.name === 'minimize') {
    actorPokemon = setVolatileStatus(actorPokemon, 'minimized', { sourceMoveName: move.name });
  }
  if (hasMoveBattleEffect(move, 'STOCKPILE')) {
    actorPokemon = {
      ...actorPokemon,
      factoryStockpileCount: Math.min(3, (actorPokemon.factoryStockpileCount ?? 0) + 1),
    };
  }

  if (move.battleData?.thawsTarget && getNonVolatileStatusId(targetPokemon) === 'freeze') {
    targetPokemon = clearNonVolatileStatus(targetPokemon);
    messages.push(`${getLocalized(targetPokemon)} thawed out!`);
  }

  const isYawnMove = hasMoveBattleEffect(move, 'YAWN');
  const isNightmareMove = hasMoveBattleEffect(move, 'NIGHTMARE');
  const isTauntMove = hasMoveBattleEffect(move, 'TAUNT');
  const isTormentMove = hasMoveBattleEffect(move, 'TORMENT');
  const isDisableMove = hasMoveBattleEffect(move, 'DISABLE');
  const isEncoreMove = hasMoveBattleEffect(move, 'ENCORE');
  const isAttractMove = hasMoveBattleEffect(move, 'ATTRACT');
  let secondaryEffects = getMoveSecondaryEffects(move);
  if (hasMoveBattleEffect(move, 'BELLY_DRUM')) secondaryEffects = [];
  if (move.name === 'growth' && effectiveWeather === 'sunny') {
    secondaryEffects = secondaryEffects.map((effect) => (
      effect.kind === 'stat-stage' && effect.appliesTo === 'user'
        ? { ...effect, change: Math.sign(effect.change ?? 0) * 2 }
        : effect
    ));
  }
  if (hasMoveBattleEffect(move, 'SECRET_POWER')) {
    if (fieldState?.includes('misty_terrain')) {
      secondaryEffects = [{ kind: 'stat-stage', chance: 30, appliesTo: 'target', isPrimary: false, stat: 'spAtk', change: -1 }];
    } else if (fieldState?.includes('grassy_terrain')) {
      secondaryEffects = [{ kind: 'status', chance: 30, appliesTo: 'target', isPrimary: false, statusId: 'sleep' }];
    } else if (fieldState?.includes('psychic_terrain')) {
      secondaryEffects = [{ kind: 'stat-stage', chance: 30, appliesTo: 'target', isPrimary: false, stat: 'speed', change: -1 }];
    } else {
      secondaryEffects = [{ kind: 'status', chance: 30, appliesTo: 'target', isPrimary: false, statusId: 'paralysis' }];
    }
  }
  const ailmentEffect = secondaryEffects.find((effect) => effect.kind === 'status' || effect.kind === 'volatile-status');
  const statStageEffects = secondaryEffects.filter((effect) => effect.kind === 'stat-stage');
  const baseFlinchChance = secondaryEffects
    .filter((effect) => effect.kind === 'flinch')
    .reduce((maxChance, effect) => Math.max(maxChance, effect.chance), 0);

  if (isYawnMove) {
    const canApplyYawn = (
      !hasVolatileStatus(targetPokemon, 'yawn')
      && !hasNonVolatileStatus(targetPokemon)
      && !isNonVolatileStatusBlocked(targetPokemon, 'sleep', fieldState, move, actorPokemon, effectiveWeather)
    );
    if (canApplyYawn) {
      targetPokemon = setVolatileStatus(targetPokemon, 'yawn', {
        turnsRemaining: 2,
        sourceMoveName: move.name,
      });
      messages.push(`${getLocalized(targetPokemon)} grew drowsy!`);
    }
  } else if (isNightmareMove) {
    if (getNonVolatileStatusId(targetPokemon) === 'sleep' && !hasVolatileStatus(targetPokemon, 'nightmare')) {
      targetPokemon = setVolatileStatus(targetPokemon, 'nightmare', {
        sourceMoveName: move.name,
      });
      messages.push(`${getLocalized(targetPokemon)} began having a nightmare!`);
    }
  } else if (isGhostCurse) {
    if (!hasVolatileStatus(targetPokemon, 'curse')) {
      targetPokemon = setVolatileStatus(targetPokemon, 'curse', {
        sourceMoveName: move.name,
        linkedPokemonId: actorPokemon?.id,
      });
      messages.push(`${getLocalized(targetPokemon)} was afflicted by the curse!`);
    }
  } else if (isAttractMove) {
    if (
      actorPokemon
      && !hasVolatileStatus(targetPokemon, 'infatuation')
      && (ignoresDefenderAbility(actorPokemon) || !hasAbilityBattleEffect(targetPokemon?.abilities?.[0]?.ability?.name, 'OBLIVIOUS'))
      && areBattlersOfOppositeGender(actorPokemon, targetPokemon)
    ) {
      targetPokemon = setVolatileStatus(targetPokemon, 'infatuation', {
        sourceMoveName: move.name,
        linkedPokemonId: actorPokemon.id,
      });
      messages.push(`${getLocalized(targetPokemon)} fell in love!`);
    }
  } else if (isTauntMove) {
    if (!hasVolatileStatus(targetPokemon, 'taunt')) {
      targetPokemon = setVolatileStatus(targetPokemon, 'taunt', {
        turnsRemaining: targetHasActedThisTurn ? 4 : 3,
        sourceMoveName: move.name,
      });
      messages.push(`${getLocalized(targetPokemon)} fell for the taunt!`);
    }
  } else if (isTormentMove) {
    if (!hasVolatileStatus(targetPokemon, 'torment')) {
      targetPokemon = setVolatileStatus(targetPokemon, 'torment', {
        turnsRemaining: 3,
        sourceMoveName: move.name,
      });
      messages.push(`${getLocalized(targetPokemon)} was subjected to torment!`);
    }
  } else if (isDisableMove) {
    const moveToDisable = findMoveByName(targetPokemon, targetPokemon.factoryLastUsedMoveName);
    if (moveToDisable && !hasVolatileStatus(targetPokemon, 'disable')) {
      targetPokemon = setVolatileStatus(targetPokemon, 'disable', {
        turnsRemaining: 4,
        sourceMoveName: move.name,
        linkedMoveName: moveToDisable.name,
      });
      messages.push(`${getLocalized(targetPokemon)}'s ${moveToDisable.name} was disabled!`);
    }
  } else if (isEncoreMove) {
    const moveToEncore = findMoveByName(targetPokemon, targetPokemon.factoryLastUsedMoveName);
    if (moveToEncore && !hasVolatileStatus(targetPokemon, 'encore') && (moveToEncore.currentPp ?? moveToEncore.pp ?? 0) > 0) {
      targetPokemon = setVolatileStatus(targetPokemon, 'encore', {
        turnsRemaining: targetHasActedThisTurn ? 4 : 3,
        sourceMoveName: move.name,
        linkedMoveName: moveToEncore.name,
      });
      messages.push(`${getLocalized(targetPokemon)} received an encore!`);
    }
  }

  const handledBySpecialMove = isYawnMove || isNightmareMove || isTauntMove || isTormentMove || isDisableMove || isEncoreMove || isAttractMove || isGhostCurse;
  const groupedEffects = new Map<string, typeof secondaryEffects>();
  secondaryEffects.forEach((effect, index) => {
    if (effect.kind === 'flinch') return;
    const appliesTo = effect.appliesTo ?? 'target';
    const isAllowed = appliesTo === 'user' ? allowUserEffects : allowTargetEffects;
    const actorAbility = actorPokemon?.abilities?.[0]?.ability?.name;
    const targetAbility = targetPokemon?.abilities?.[0]?.ability?.name;
    const suppressedBySheerForce = !effect.isPrimary && hasAbilityBattleEffect(actorAbility, 'SHEER_FORCE');
    const blockedByShieldDust = appliesTo === 'target'
      && !effect.isPrimary
      && !ignoresDefenderAbility(actorPokemon)
      && hasAbilityBattleEffect(targetAbility, 'SHIELD_DUST');
    if (!isAllowed || handledBySpecialMove || suppressedBySheerForce || blockedByShieldDust) return;
    const key = `${appliesTo}:${effect.group ?? `effect-${index}`}`;
    const existing = groupedEffects.get(key) ?? [];
    existing.push(effect);
    groupedEffects.set(key, existing);
  });

  let flinched = false;
  for (const effectGroup of groupedEffects.values()) {
    const sereneGraceMultiplier = effectGroup.some((effect) => !effect.isPrimary)
      && hasAbilityBattleEffect(actorPokemon?.abilities?.[0]?.ability?.name, 'SERENE_GRACE')
      ? 2
      : 1;
    const effectChance = Math.min(100, (effectGroup[0]?.chance ?? 100) * sereneGraceMultiplier);
    if (effectChance <= 0 || random() * 100 >= effectChance) continue;

    for (const effect of effectGroup) {
      const appliesTo = effect.appliesTo ?? 'target';
      const affectsUser = appliesTo === 'user';
      let affectedPokemon = affectsUser ? actorPokemon : targetPokemon;
      const affectedTeamSide = affectsUser ? actingSide : targetSide;
      const affectedIsTarget = !affectsUser;
      let statusId = normalizeBattleStatusId(effect.statusId);
      if (statusId === 'tri_attack') {
        statusId = ['burn', 'freeze', 'paralysis'][Math.floor(random() * 3)] ?? 'burn';
      }
      const nonVolatileStatusId = normalizeNonVolatileStatusId(statusId);
      const effectSleepBlockedByUproar = nonVolatileStatusId === 'sleep'
        && affectedIsTarget
        && isSleepBlockedByUproar(affectedPokemon, playerTeam, enemyTeam);
      const effectNonVolatileBlocked = nonVolatileStatusId
        ? isNonVolatileStatusBlocked(affectedPokemon, nonVolatileStatusId, fieldState, move, actorPokemon, effectiveWeather)
        : false;
      const effectVolatileBlocked = statusId === 'confusion' && (
        (!ignoresDefenderAbility(actorPokemon) && hasAbilityBattleEffect(affectedPokemon?.abilities?.[0]?.ability?.name, 'OWN_TEMPO'))
        || (fieldState?.includes('misty_terrain') && isGrounded(affectedPokemon, fieldState ?? []))
      );

      if (effect.kind === 'status' || effect.kind === 'volatile-status') {
        const canApplyAilment = nonVolatileStatusId
          ? !hasNonVolatileStatus(affectedPokemon) && !effectSleepBlockedByUproar && !effectNonVolatileBlocked
          : statusId
            ? !hasVolatileStatus(affectedPokemon, statusId) && !effectVolatileBlocked
            : false;
        if (statusId && canApplyAilment) {
          affectedPokemon = nonVolatileStatusId
            ? setNonVolatileStatus(affectedPokemon, nonVolatileStatusId, {}, random)
            : setVolatileStatus(affectedPokemon, statusId, {}, random);
          messages.push(`${getLocalized(affectedPokemon)} is afflicted with ${AILMENT_ZH[statusId] || statusId}!`);
          const synchronizable = nonVolatileStatusId
            && ['burn', 'paralysis', 'poison', 'bad_poison'].includes(nonVolatileStatusId);
          if (
            affectedIsTarget
            && synchronizable
            && hasAbilityBattleEffect(affectedPokemon?.abilities?.[0]?.ability?.name, 'SYNCHRONIZE')
            && !hasNonVolatileStatus(actorPokemon)
            && !isNonVolatileStatusBlocked(actorPokemon, nonVolatileStatusId, fieldState, move, affectedPokemon, effectiveWeather)
          ) {
            actorPokemon = setNonVolatileStatus(actorPokemon, nonVolatileStatusId, {}, random);
            messages.push(`${getLocalized(actorPokemon)} was afflicted by Synchronize!`);
          }
        } else if (effectSleepBlockedByUproar) {
          messages.push(`${getLocalized(affectedPokemon)} cannot fall asleep during the uproar!`);
        }
      }

      if (effect.kind === 'stat-stage' && !isGhostCurse) {
        const statKey = effect.stat as keyof StatStages;
        if (affectedPokemon.statStages[statKey] !== undefined) {
          const oldStage = affectedPokemon.statStages[statKey];
          const stageDelta = Number(effect.change ?? 0);
          const newStage = Math.max(-6, Math.min(6, oldStage + stageDelta));
          if (newStage !== oldStage) {
            affectedPokemon = {
              ...affectedPokemon,
              statStages: {
                ...affectedPokemon.statStages,
                [statKey]: newStage,
              },
            };
            const changeText = stageDelta > 0 ? 'rose' : 'fell';
            const statName = STAT_ZH[String(effect.stat)] || effect.stat;
            messages.push(`${getLocalized(affectedPokemon)}'s ${statName} ${changeText}!`);
          }
        }
      }

      if (
        effect.kind === 'flinch'
        && affectedIsTarget
        && !targetHasActedThisTurn
        && (ignoresDefenderAbility(actorPokemon) || !hasAbilityBattleEffect(affectedPokemon?.abilities?.[0]?.ability?.name, 'INNER_FOCUS'))
        && !hasVolatileStatus(affectedPokemon, 'flinch')
      ) {
        flinched = true;
        affectedPokemon = setVolatileStatus(affectedPokemon, 'flinch', {
          turnsRemaining: 1,
          sourceMoveName: move.name,
          linkedPokemonId: actorPokemon?.id,
        });
      }

      if (affectsUser) {
        actorPokemon = affectedPokemon;
      } else {
        targetPokemon = affectedPokemon;
      }
      if (targetSide === actingSide) {
        actorPokemon = affectedPokemon;
        targetPokemon = affectedPokemon;
      }

      if (affectedTeamSide === 'player') {
        playerTeam = replaceLead(playerTeam, affectedPokemon);
      } else {
        enemyTeam = replaceLead(enemyTeam, affectedPokemon);
      }
    }
  }

  const actorAbility = actorPokemon?.abilities?.[0]?.ability?.name;
  const targetAbility = targetPokemon?.abilities?.[0]?.ability?.name;
  const flinchChanceMultiplier = hasAbilityBattleEffect(actorAbility, 'SERENE_GRACE') ? 2 : 1;
  const moveFlinchChance = hasAbilityBattleEffect(actorAbility, 'SHEER_FORCE')
    ? 0
    : Math.min(100, baseFlinchChance * flinchChanceMultiplier);
  const combinedFlinchChance = !ignoresDefenderAbility(actorPokemon) && hasAbilityBattleEffect(targetAbility, 'SHIELD_DUST')
    ? 0
    : Math.max(0, moveFlinchChance, Math.min(100, extraFlinchChance * flinchChanceMultiplier));
  if (
    allowTargetEffects
    && !targetHasActedThisTurn
    && combinedFlinchChance > 0
    && !flinched
    && (ignoresDefenderAbility(actorPokemon) || !hasAbilityBattleEffect(targetPokemon?.abilities?.[0]?.ability?.name, 'INNER_FOCUS'))
    && random() * 100 < combinedFlinchChance
  ) {
    flinched = true;
    targetPokemon = setVolatileStatus(targetPokemon, 'flinch', {
      turnsRemaining: 1,
      sourceMoveName: move.name,
      linkedPokemonId: actorPokemon?.id,
    });
  }

  if (actingSide === 'player') {
    playerTeam = replaceLead(playerTeam, actorPokemon);
  } else {
    enemyTeam = replaceLead(enemyTeam, actorPokemon);
  }

  if (targetSide !== actingSide) {
    if (targetSide === 'player') {
      playerTeam = replaceLead(playerTeam, targetPokemon);
    } else {
      enemyTeam = replaceLead(enemyTeam, targetPokemon);
    }
  }

  return {
    playerTeam,
    enemyTeam,
    messages,
    flinched,
  };
}
