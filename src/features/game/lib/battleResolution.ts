import type { GamePokemon, Move, StatStages, Weather } from '../../../types';
import { AILMENT_ZH, STAT_ZH } from '../../../uiAppConstants';
import type { LocalizeFn } from '../view-model';

export type BattleSide = 'player' | 'enemy';

export interface BattleTeams {
  playerTeam: GamePokemon[];
  enemyTeam: GamePokemon[];
}

interface ApplyMoveSecondaryEffectsOptions {
  move: Move;
  actingSide: BattleSide;
  teams: BattleTeams;
  getLocalized: LocalizeFn;
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

function isRockGroundSteelType(pokemon: GamePokemon) {
  return pokemon.types.some((typeSlot) => ['rock', 'ground', 'steel'].includes(typeSlot.type.name));
}

function isIceType(pokemon: GamePokemon) {
  return pokemon.types.some((typeSlot) => typeSlot.type.name === 'ice');
}

function replaceLead(team: GamePokemon[], pokemon: GamePokemon) {
  const nextTeam = [...team];
  nextTeam[0] = pokemon;
  return nextTeam;
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
    const weatherDamage = Math.floor(pokemon.maxHp / 16);
    const updatedPokemon = { ...pokemon, currentHp: Math.max(0, pokemon.currentHp - weatherDamage) };
    return {
      pokemon: updatedPokemon,
      messages: [`${getLocalized(updatedPokemon)} is hurt by the sandstorm!`],
      fainted: updatedPokemon.currentHp <= 0,
    };
  }

  if (weather === 'hail' && !isIceType(pokemon)) {
    const weatherDamage = Math.floor(pokemon.maxHp / 16);
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
  if (pokemon.currentHp <= 0 || (pokemon.status !== 'poison' && pokemon.status !== 'burn')) {
    return { pokemon, messages: [], fainted: false };
  }

  const statusDamage = Math.floor(pokemon.maxHp / 8);
  const updatedPokemon = {
    ...pokemon,
    currentHp: Math.max(0, pokemon.currentHp - statusDamage),
  };

  return {
    pokemon: updatedPokemon,
    messages: [`${getLocalized(updatedPokemon)} took ${AILMENT_ZH[updatedPokemon.status] || updatedPokemon.status} damage!`],
    fainted: updatedPokemon.currentHp <= 0,
  };
}

export function applyMoveSecondaryEffects({
  move,
  actingSide,
  teams,
  getLocalized,
  random = Math.random,
}: ApplyMoveSecondaryEffectsOptions): ApplyMoveSecondaryEffectsResult {
  const targetSide: BattleSide = move.target === 'user'
    ? actingSide
    : (actingSide === 'player' ? 'enemy' : 'player');

  let playerTeam = [...teams.playerTeam];
  let enemyTeam = [...teams.enemyTeam];
  const targetTeam = targetSide === 'player' ? playerTeam : enemyTeam;
  const originalTarget = targetTeam[0];

  if (!originalTarget) {
    return { playerTeam, enemyTeam, messages: [], flinched: false };
  }

  let targetPokemon = { ...originalTarget };
  const messages: string[] = [];

  if (move.ailment && !targetPokemon.status && random() * 100 < (move.ailmentChance || 100)) {
    targetPokemon.status = move.ailment;
    messages.push(`${getLocalized(targetPokemon)} is afflicted with ${AILMENT_ZH[move.ailment] || move.ailment}!`);
  }

  if (move.statChanges) {
    const newStatStages = { ...targetPokemon.statStages };

    for (const statChange of move.statChanges) {
      const statKey = statChange.stat as keyof StatStages;
      if (newStatStages[statKey] !== undefined) {
        const oldStage = newStatStages[statKey];
        const newStage = Math.max(-6, Math.min(6, oldStage + statChange.change));
        if (newStage !== oldStage) {
          newStatStages[statKey] = newStage;
          const changeText = statChange.change > 0 ? 'rose' : 'fell';
          const statName = STAT_ZH[statChange.stat] || statChange.stat;
          messages.push(`${getLocalized(targetPokemon)}'s ${statName} ${changeText}!`);
        }
      }
    }

    targetPokemon.statStages = newStatStages;
  }

  let flinched = false;
  if (random() * 100 < (move.flinchChance || 0)) {
    flinched = true;
    messages.push(`${getLocalized(targetPokemon)} flinched and couldn't move!`);
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
