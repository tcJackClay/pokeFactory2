import type { FieldState, GamePokemon, Move } from '../../../../types';
import { getMovePriority } from '../../data/battle';
import { getEffectiveBattleSpeed } from './resolveDamage';

interface ResolveActionSelectionOptions {
  playerPokemon: GamePokemon;
  playerMove: Move;
  enemyPokemon: GamePokemon;
  enemyMove: Move;
  fieldState: FieldState[];
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

  const playerSpeed = getEffectiveBattleSpeed(playerPokemon);
  const enemySpeed = getEffectiveBattleSpeed(enemyPokemon);
  const reverseSpeedOrder = fieldState.includes('trick_room');
  if (enemySpeed !== playerSpeed) {
    return { enemyActsFirst: reverseSpeedOrder ? enemySpeed < playerSpeed : enemySpeed > playerSpeed };
  }

  return { enemyActsFirst: random() < 0.5 };
}
