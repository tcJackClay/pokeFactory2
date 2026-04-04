import type { GamePokemon, Move } from '../../../types';

export const FACTORY_STYLE = {
  NONE: 0,
  PREPARATION: 1,
  SLOW_STEADY: 2,
  ENDURANCE: 3,
  HIGH_RISK: 4,
  WEAKENING: 5,
  UNPREDICTABLE: 6,
  WEATHER: 7,
  NO_SINGULAR: 8,
} as const;

export type FactoryStyleId = typeof FACTORY_STYLE[keyof typeof FACTORY_STYLE];

// Reference: sRequiredMoveCounts in battle_factory.c
export const FACTORY_REQUIRED_MOVE_COUNTS: Record<number, number> = {
  [FACTORY_STYLE.PREPARATION]: 3,
  [FACTORY_STYLE.SLOW_STEADY]: 3,
  [FACTORY_STYLE.ENDURANCE]: 3,
  [FACTORY_STYLE.HIGH_RISK]: 2,
  [FACTORY_STYLE.WEAKENING]: 2,
  [FACTORY_STYLE.UNPREDICTABLE]: 2,
  [FACTORY_STYLE.WEATHER]: 2,
};

const WEATHER_MOVE_NAMES = new Set(['sunny-day', 'rain-dance', 'sandstorm', 'hail', 'snowscape']);
const ENDURANCE_MOVE_NAMES = new Set([
  'protect',
  'detect',
  'endure',
  'substitute',
  'recover',
  'roost',
  'rest',
  'slack-off',
  'soft-boiled',
  'milk-drink',
  'morningsun',
  'moonlight',
  'synthesis',
  'wish',
]);
const UNPREDICTABLE_MOVE_NAMES = new Set([
  'metronome',
  'assist',
  'copycat',
  'mirror-move',
  'me-first',
  'nature-power',
  'sleep-talk',
]);
const SLOW_STEADY_MOVE_NAMES = new Set(['explosion', 'self-destruct']);

const NON_VOLATILE_AILMENTS = new Set(['sleep', 'poison', 'burn', 'paralysis', 'freeze']);

function isStatusMove(move: Move): boolean {
  return move.damage_class === 'status';
}

export function getMoveFactoryStyle(move: Move): FactoryStyleId {
  if (WEATHER_MOVE_NAMES.has(move.name)) return FACTORY_STYLE.WEATHER;

  if (UNPREDICTABLE_MOVE_NAMES.has(move.name)) return FACTORY_STYLE.UNPREDICTABLE;

  if (SLOW_STEADY_MOVE_NAMES.has(move.name)) return FACTORY_STYLE.SLOW_STEADY;

  if ((move.accuracy ?? 100) < 100 && (move.accuracy ?? 100) > 0) return FACTORY_STYLE.HIGH_RISK;
  if ((move.drain ?? 0) <= -33) return FACTORY_STYLE.HIGH_RISK;

  if (move.target?.includes('user') && move.statChanges?.some((change) => change.change <= -2)) {
    return FACTORY_STYLE.HIGH_RISK;
  }

  if (move.ailment && NON_VOLATILE_AILMENTS.has(move.ailment)) return FACTORY_STYLE.SLOW_STEADY;

  if (ENDURANCE_MOVE_NAMES.has(move.name) || (move.healing ?? 0) > 0) return FACTORY_STYLE.ENDURANCE;

  if (isStatusMove(move) && move.statChanges?.some((change) => change.change > 0)) return FACTORY_STYLE.PREPARATION;

  if (
    move.statChanges?.some((change) => change.change < 0)
    || (isStatusMove(move) && Boolean(move.ailment))
    || (move.flinchChance ?? 0) > 0
  ) {
    return FACTORY_STYLE.WEAKENING;
  }

  return FACTORY_STYLE.NONE;
}

export function getFactoryTeamStyle(team: GamePokemon[]): FactoryStyleId {
  const stylePoints = new Map<number, number>();

  for (const pokemon of team) {
    for (const move of pokemon.selectedMoves) {
      const style = getMoveFactoryStyle(move);
      stylePoints.set(style, (stylePoints.get(style) ?? 0) + 1);
    }
  }

  let matchedCount = 0;
  let resolvedStyle: FactoryStyleId = FACTORY_STYLE.NONE;
  for (let style = FACTORY_STYLE.PREPARATION; style <= FACTORY_STYLE.WEATHER; style += 1) {
    const required = FACTORY_REQUIRED_MOVE_COUNTS[style] ?? Number.MAX_SAFE_INTEGER;
    if ((stylePoints.get(style) ?? 0) >= required) {
      matchedCount += 1;
      resolvedStyle = style as FactoryStyleId;
    }
  }

  if (matchedCount > 2) return FACTORY_STYLE.NO_SINGULAR;
  return resolvedStyle;
}

export function getFactoryStyleAffinityBonus(move: Move, preferredStyle: FactoryStyleId): number {
  if (preferredStyle === FACTORY_STYLE.NONE || preferredStyle === FACTORY_STYLE.NO_SINGULAR) return 0;
  const moveStyle = getMoveFactoryStyle(move);
  if (moveStyle === preferredStyle) return 22;
  return 0;
}
