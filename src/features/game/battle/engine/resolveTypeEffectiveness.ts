import type { GamePokemon, Move, Pokemon } from '../../../../types';
import { TYPE_CHART } from '../../../../constants';

type PokemonTypeSlots = Pokemon['types'];

function getTypeSlots(pokemon: GamePokemon): PokemonTypeSlots {
  return pokemon.types;
}

export function getTypeEffectivenessMultiplierForTypes(moveType: string, defenderTypes: PokemonTypeSlots) {
  let multiplier = 1;
  defenderTypes.forEach((typeSlot) => {
    const typeMultiplier = TYPE_CHART[moveType]?.[typeSlot.type.name];
    if (typeMultiplier !== undefined) {
      multiplier *= typeMultiplier;
    }
  });
  return multiplier;
}

export function getMoveTypeMultiplier(move: Move, defender: GamePokemon) {
  return getTypeEffectivenessMultiplierForTypes(move.type, getTypeSlots(defender));
}
