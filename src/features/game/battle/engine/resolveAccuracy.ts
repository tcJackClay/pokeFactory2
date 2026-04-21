import type { GamePokemon, Move } from '../../../../types';
import { getItemAccuracyMultiplier, getMoveAccuracy } from '../../data/battle';
import { getAccuracyStageModifier } from './stageModifiers';

interface ResolveAccuracyOptions {
  move: Move;
  attacker: GamePokemon;
  defender: GamePokemon;
  random?: () => number;
}

export function getResolvedMoveAccuracy(move: Move, attacker: GamePokemon, defender: GamePokemon) {
  const moveAccuracy = getMoveAccuracy(move);
  if (moveAccuracy === null) return null;

  const combinedStage = Math.max(-6, Math.min(6, attacker.statStages.accuracy - defender.statStages.evasion));
  const stageModifier = getAccuracyStageModifier(combinedStage);
  const defenderItemModifier = getItemAccuracyMultiplier(defender.factoryHeldItemId);
  return moveAccuracy * stageModifier * defenderItemModifier;
}

export function resolveAccuracy({
  move,
  attacker,
  defender,
  random = Math.random,
}: ResolveAccuracyOptions) {
  const finalAccuracy = getResolvedMoveAccuracy(move, attacker, defender);
  if (finalAccuracy === null) {
    return {
      didHit: true,
      finalAccuracy: null,
    };
  }

  return {
    didHit: random() * 100 <= finalAccuracy,
    finalAccuracy,
  };
}
