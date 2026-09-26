import type { TailwindTurns } from '../../../../types';
import type { EngineBattleSide } from './types';

export const EMPTY_TAILWIND_TURNS: TailwindTurns = { player: 0, enemy: 0 };
export const TAILWIND_DURATION = 4;

export function resolveTailwindUse(turns: TailwindTurns, side: EngineBattleSide) {
  if (turns[side] > 0) return { succeeded: false, turns };
  return { succeeded: true, turns: { ...turns, [side]: TAILWIND_DURATION } };
}

export function advanceTailwind(turns: TailwindTurns): TailwindTurns {
  return {
    player: Math.max(0, turns.player - 1),
    enemy: Math.max(0, turns.enemy - 1),
  };
}
