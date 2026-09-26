import type { GamePokemon, StatStages } from '../../../types';
import { recalculatePokemonStats } from './pokemonStats';

const RESET_STAT_STAGES: StatStages = {
  attack: 0,
  defense: 0,
  spAtk: 0,
  spDef: 0,
  speed: 0,
  accuracy: 0,
  evasion: 0,
};

export function restoreFactoryPokemon(pokemon: GamePokemon): GamePokemon {
  const originalForm = recalculatePokemonStats({
    ...pokemon,
    types: pokemon.baseTypes ?? pokemon.types,
  }, false);

  return {
    ...originalForm,
    currentHp: originalForm.maxHp,
    selectedMoves: originalForm.selectedMoves.map((move) => {
      const maxPp = move.maxPp ?? move.pp;
      return maxPp === undefined ? move : { ...move, currentPp: maxPp };
    }),
    nonVolatileStatus: undefined,
    volatileStatuses: {},
    statStages: { ...RESET_STAT_STAGES },
    specialBoostActive: false,
    specialBoostMode: undefined,
    dynamaxTurnsLeft: undefined,
    factoryChoiceLockedMoveName: null,
    factoryLastUsedMoveName: null,
    factoryConsecutiveMoveCount: 0,
    factoryLastDamageReceived: 0,
    factoryLastDamageCategory: undefined,
    factoryDamagedThisTurn: false,
    factoryStockpileCount: 0,
  };
}

export function restoreFactoryParty(team: GamePokemon[]): GamePokemon[] {
  return team.map(restoreFactoryPokemon);
}

export function prepareFactoryPartyForBattle(team: GamePokemon[]): GamePokemon[] {
  return restoreFactoryParty(team).map((pokemon) => ({
    ...pokemon,
    factoryHeldItemId: pokemon.factoryOriginalHeldItemId ?? undefined,
  }));
}
