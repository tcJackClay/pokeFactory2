import type { GamePokemon } from '../../../../types';
import { getItemMentalStatuses, hasItemBattleEffect } from '../../data/battle';
import { clearVolatileStatuses, hasVolatileStatus } from '../../utils/battleStatus';

export function resolveMentalHerb(pokemon: GamePokemon) {
  const cleared = hasItemBattleEffect(pokemon.factoryHeldItemId, 'MENTAL_HERB')
    ? getItemMentalStatuses(pokemon.factoryHeldItemId).filter((id) => hasVolatileStatus(pokemon, id))
    : [];
  return {
    pokemon: cleared.length ? {
      ...clearVolatileStatuses(pokemon, cleared), factoryHeldItemId: undefined,
    } : pokemon,
    cleared,
  };
}
