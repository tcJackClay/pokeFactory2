import type { GamePokemon } from '../../../../types';
import { clearVolatileStatuses } from '../../utils/battleStatus';

export function clearSwitchingBattleState(pokemon: GamePokemon) {
  const clearedPokemon = clearVolatileStatuses(pokemon);
  return {
    ...clearedPokemon,
    factoryChoiceLockedMoveName: null,
    factoryLastUsedMoveName: null,
  };
}
