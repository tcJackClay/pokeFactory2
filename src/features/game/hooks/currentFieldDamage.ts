import type { FieldState, GamePokemon, Move, Weather } from '../../../types';
import { calculateDamage } from '../battle/engine/resolveDamage';

interface CurrentFieldRef {
  current: { weather: Weather; fieldState: FieldState[] };
}

/** A retained round callback reads the field at execution, after the first action. */
export function createCurrentFieldDamageResolver(fieldRef: CurrentFieldRef, random?: () => number) {
  return (
    move: Move,
    attacker: GamePokemon,
    defender: GamePokemon,
    atkBuff: boolean,
    defBuff: boolean,
    options?: { basePowerOverride?: number; skipAccuracyCheck?: boolean },
  ) => calculateDamage({
    move, attacker, defender, atkBuff, defBuff,
    weather: fieldRef.current.weather,
    fieldState: fieldRef.current.fieldState,
    basePowerOverride: options?.basePowerOverride,
    skipAccuracyCheck: options?.skipAccuracyCheck,
    random,
  });
}
