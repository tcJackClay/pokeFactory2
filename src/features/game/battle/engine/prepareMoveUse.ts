import type { GamePokemon, Move } from '../../../../types';
import { hasItemBattleEffect } from '../../data/battle';

/** Called once before the controller's strike loop. Struggle never occupies or spends a move slot. */
export function prepareMoveUse(actor: GamePokemon, selectedMove: Move): GamePokemon {
  if (selectedMove.name === 'struggle') return actor;
  const index = actor.selectedMoves.findIndex((move) => move === selectedMove || (move.name === selectedMove.name && move.type === selectedMove.type));
  if (index < 0) return actor;
  return {
    ...actor,
    selectedMoves: actor.selectedMoves.map((move, i) => i === index ? {
      ...move, maxPp: move.maxPp ?? move.pp ?? 0,
      currentPp: Math.max(0, (move.currentPp ?? move.maxPp ?? move.pp ?? 0) - 1),
    } : move),
    factoryChoiceLockedMoveName: hasItemBattleEffect(actor.factoryHeldItemId, 'CHOICE_BAND')
      ? actor.factoryChoiceLockedMoveName || selectedMove.name : null,
  };
}
