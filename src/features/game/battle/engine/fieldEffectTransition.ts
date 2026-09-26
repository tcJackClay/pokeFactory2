import type { FieldState, FieldTurns } from '../../../../types';

const TERRAIN_FIELDS: readonly FieldState[] = ['electric_terrain', 'grassy_terrain', 'misty_terrain', 'psychic_terrain'];
const ROOM_FIELDS: readonly FieldState[] = ['trick_room', 'magic_room', 'wonder_room'];

function isTerrain(field: FieldState): boolean {
  return TERRAIN_FIELDS.includes(field);
}

function isRoom(field: FieldState): boolean {
  return ROOM_FIELDS.includes(field);
}

export function isRepeatFieldFailure(previous: readonly FieldState[], nextField: FieldState): boolean {
  return (nextField === 'gravity' || nextField === 'fairy_lock') && previous.includes(nextField);
}

export function nextFieldStates(previous: FieldState[], nextField: FieldState): FieldState[] {
  if (isTerrain(nextField)) {
    return [...previous.filter((field) => !isTerrain(field)), nextField];
  }
  if (previous.includes(nextField)) {
    return isRoom(nextField) ? previous.filter((field) => field !== nextField) : previous;
  }
  return [...previous, nextField];
}

export function nextFieldTurns(previous: FieldTurns, nextField: FieldState): FieldTurns {
  const next = { ...previous };
  if (isTerrain(nextField)) {
    for (const terrain of TERRAIN_FIELDS) delete next[terrain];
    next[nextField] = 5;
    return next;
  }
  if (Object.prototype.hasOwnProperty.call(previous, nextField)) {
    if (isRoom(nextField)) delete next[nextField];
    return next;
  }
  next[nextField] = nextField === 'fairy_lock' ? 2 : 5;
  return next;
}
