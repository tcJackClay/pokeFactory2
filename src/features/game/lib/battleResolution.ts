import type { FieldState, GamePokemon, Move, StatStages, Weather } from '../../../types';
import { AILMENT_ZH, STAT_ZH } from '../battle/battleText';
import { getMoveSecondaryEffects, getMoveTarget, hasAbilityBattleEffect, hasMoveBattleEffect } from '../data/battle';
import type { LocalizeFn } from '../view-model';
import {
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

function isGrounded(pokemon: GamePokemon | null | undefined) {
  return !hasPokemonType(pokemon, 'flying');
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
) {
  if (!statusId) return false;
  if (hasAbilityBattleEffect(targetPokemon?.abilities?.[0]?.ability?.name, 'PURIFYING_SALT')) return true;
  if (move?.battleData?.powderMove && hasPokemonType(targetPokemon, 'grass')) return true;
  if (statusId === 'burn' && hasPokemonType(targetPokemon, 'fire')) return true;
  if (statusId === 'freeze' && hasPokemonType(targetPokemon, 'ice')) return true;
  if (statusId === 'paralysis' && hasPokemonType(targetPokemon, 'electric')) return true;
  if (statusId === 'paralysis' && move?.type === 'electric' && hasPokemonType(targetPokemon, 'ground')) return true;
  if ((statusId === 'poison' || statusId === 'bad_poison') && (hasPokemonType(targetPokemon, 'poison') || hasPokemonType(targetPokemon, 'steel'))) return true;
  if (statusId === 'sleep' && fieldState?.includes('electric_terrain') && isGrounded(targetPokemon)) return true;
  if (fieldState?.includes('misty_terrain') && isGrounded(targetPokemon)) return true;
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

  if (weather === 'sandstorm' && !isRockGroundSteelType(pokemon)) {
    const weatherDamage = Math.max(1, Math.floor(pokemon.maxHp / 16));
    const updatedPokemon = { ...pokemon, currentHp: Math.max(0, pokemon.currentHp - weatherDamage) };
    return {
      pokemon: updatedPokemon,
      messages: [`${getLocalized(updatedPokemon)} is hurt by the sandstorm!`],
      fainted: updatedPokemon.currentHp <= 0,
    };
  }

  if (weather === 'hail' && !isIceType(pokemon)) {
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

  const toxicCounter = pokemon.nonVolatileStatus?.toxicCounter ?? 1;
  const statusDamage = statusId === 'bad_poison'
    ? Math.max(1, Math.floor(pokemon.maxHp / 16) * toxicCounter)
    : Math.max(1, Math.floor(pokemon.maxHp / 8));
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

  const isYawnMove = hasMoveBattleEffect(move, 'YAWN');
  const isNightmareMove = hasMoveBattleEffect(move, 'NIGHTMARE');
  const isTauntMove = hasMoveBattleEffect(move, 'TAUNT');
  const isTormentMove = hasMoveBattleEffect(move, 'TORMENT');
  const isDisableMove = hasMoveBattleEffect(move, 'DISABLE');
  const isEncoreMove = hasMoveBattleEffect(move, 'ENCORE');
  const isAttractMove = hasMoveBattleEffect(move, 'ATTRACT');
  const secondaryEffects = getMoveSecondaryEffects(move);
  const ailmentEffect = secondaryEffects.find((effect) => effect.kind === 'status' || effect.kind === 'volatile-status');
  const statStageEffects = secondaryEffects.filter((effect) => effect.kind === 'stat-stage');
  const baseFlinchChance = secondaryEffects
    .filter((effect) => effect.kind === 'flinch')
    .reduce((maxChance, effect) => Math.max(maxChance, effect.chance), 0);

  if (isYawnMove) {
    const canApplyYawn = (
      !hasVolatileStatus(targetPokemon, 'yawn')
      && !hasNonVolatileStatus(targetPokemon)
      && !isNonVolatileStatusBlocked(targetPokemon, 'sleep', fieldState, move)
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
      && !hasAbilityBattleEffect(targetPokemon?.abilities?.[0]?.ability?.name, 'OBLIVIOUS')
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
    const appliesTo = effect.appliesTo ?? 'target';
    const isAllowed = appliesTo === 'user' ? allowUserEffects : allowTargetEffects;
    if (!isAllowed || handledBySpecialMove) return;
    const key = `${appliesTo}:${effect.group ?? `effect-${index}`}`;
    const existing = groupedEffects.get(key) ?? [];
    existing.push(effect);
    groupedEffects.set(key, existing);
  });

  let flinched = false;
  for (const effectGroup of groupedEffects.values()) {
    const effectChance = effectGroup[0]?.chance ?? 100;
    if (effectChance <= 0 || random() * 100 >= effectChance) continue;

    for (const effect of effectGroup) {
      const appliesTo = effect.appliesTo ?? 'target';
      const affectsUser = appliesTo === 'user';
      let affectedPokemon = affectsUser ? actorPokemon : targetPokemon;
      const affectedTeamSide = affectsUser ? actingSide : targetSide;
      const affectedIsTarget = !affectsUser;
      const statusId = normalizeBattleStatusId(effect.statusId);
      const nonVolatileStatusId = normalizeNonVolatileStatusId(effect.statusId);
      const effectSleepBlockedByUproar = nonVolatileStatusId === 'sleep'
        && affectedIsTarget
        && isSleepBlockedByUproar(affectedPokemon, playerTeam, enemyTeam);
      const effectNonVolatileBlocked = nonVolatileStatusId
        ? isNonVolatileStatusBlocked(affectedPokemon, nonVolatileStatusId, fieldState, move)
        : false;

      if (effect.kind === 'status' || effect.kind === 'volatile-status') {
        const canApplyAilment = nonVolatileStatusId
          ? !hasNonVolatileStatus(affectedPokemon) && !effectSleepBlockedByUproar && !effectNonVolatileBlocked
          : statusId
            ? !hasVolatileStatus(affectedPokemon, statusId)
            : false;
        if (statusId && canApplyAilment) {
          affectedPokemon = nonVolatileStatusId
            ? setNonVolatileStatus(affectedPokemon, nonVolatileStatusId, {}, random)
            : setVolatileStatus(affectedPokemon, statusId, {}, random);
          messages.push(`${getLocalized(affectedPokemon)} is afflicted with ${AILMENT_ZH[statusId] || statusId}!`);
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

      if (affectedTeamSide === 'player') {
        playerTeam = replaceLead(playerTeam, affectedPokemon);
      } else {
        enemyTeam = replaceLead(enemyTeam, affectedPokemon);
      }
    }
  }

  const combinedFlinchChance = Math.max(0, baseFlinchChance, extraFlinchChance);
  if (
    allowTargetEffects
    && !targetHasActedThisTurn
    && combinedFlinchChance > 0
    && !flinched
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

  if (targetSide === 'player') {
    playerTeam = replaceLead(playerTeam, targetPokemon);
  } else {
    enemyTeam = replaceLead(enemyTeam, targetPokemon);
  }

  return {
    playerTeam,
    enemyTeam,
    messages,
    flinched,
  };
}
