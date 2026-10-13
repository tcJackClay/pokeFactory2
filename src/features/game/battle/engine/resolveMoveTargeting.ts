import type { Move } from '../../../../types';
import { getMoveFieldState, getMoveTarget, getMoveWeather, hasMoveBattleEffect } from '../../data/battle';

/** Self/team/field effects do not test the current opponent's evasion or defenses. */
export function isNonOpponentStatusMove(move: Move): boolean {
  if (move.damage_class !== 'status') return false;
  const target = getMoveTarget(move);
  return target === 'user'
    || target === 'user-field'
    || target === 'users-field'
    || target === 'opponents-field'
    || target === 'entire-field'
    || getMoveWeather(move) !== null
    || getMoveFieldState(move) !== null
    // Old snapshots can retain Haze's all-pokemon target. Teeter Dance shares
    // that target label but applies to individuals and must keep their checks.
    || hasMoveBattleEffect(move, 'HAZE');
}
