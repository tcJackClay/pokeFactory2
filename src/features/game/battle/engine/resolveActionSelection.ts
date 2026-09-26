import type { FieldState, GamePokemon, Move, TailwindTurns, Weather } from '../../../../types';
import { getMovePriority } from '../../data/battle';
import { getEffectiveBattleSpeed } from './resolveDamage';

interface ResolveActionSelectionOptions {
  playerPokemon: GamePokemon;
  playerMove: Move;
  enemyPokemon: GamePokemon;
  enemyMove: Move;
  fieldState: FieldState[];
  weather?: Weather;
  tailwindTurns?: TailwindTurns;
  playerQuickClawActivated: boolean;
  enemyQuickClawActivated: boolean;
  random?: () => number;
}

export function resolveActionSelection({
  playerPokemon,
  playerMove,
  enemyPokemon,
  enemyMove,
  fieldState,
  weather = 'none',
  tailwindTurns = { player: 0, enemy: 0 },
  playerQuickClawActivated,
  enemyQuickClawActivated,
  random = Math.random,
}: ResolveActionSelectionOptions) {
  if (enemyQuickClawActivated !== playerQuickClawActivated) {
    return { enemyActsFirst: enemyQuickClawActivated };
  }

  const playerPriority = getMovePriority(playerMove);
  const enemyPriority = getMovePriority(enemyMove);
  if (enemyPriority !== playerPriority) {
    return { enemyActsFirst: enemyPriority > playerPriority };
  }

  const weatherSuppressed = [playerPokemon, enemyPokemon].some((pokemon) => (
    ['air-lock', 'cloud-nine'].includes((pokemon.abilities?.[0]?.ability?.name ?? '').trim().toLowerCase().replace(/_/g, '-'))
  ));
  const effectiveWeather = weatherSuppressed ? 'none' : weather;
  const playerSpeed = getEffectiveBattleSpeed(playerPokemon, effectiveWeather, fieldState) * (tailwindTurns.player > 0 ? 2 : 1);
  const enemySpeed = getEffectiveBattleSpeed(enemyPokemon, effectiveWeather, fieldState) * (tailwindTurns.enemy > 0 ? 2 : 1);
  const reverseSpeedOrder = fieldState.includes('trick_room');
  if (enemySpeed !== playerSpeed) {
    return { enemyActsFirst: reverseSpeedOrder ? enemySpeed < playerSpeed : enemySpeed > playerSpeed };
  }

  return { enemyActsFirst: random() < 0.5 };
}
