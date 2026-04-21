import type { FieldState, GamePokemon, Move } from '../../../../types';
import { applyMoveSecondaryEffects } from '../../lib/battleResolution';
import type { LocalizeFn } from '../../view-model';

interface ResolveSecondaryEffectsOptions {
  move: Move;
  actingSide: 'player' | 'enemy';
  playerTeam: GamePokemon[];
  enemyTeam: GamePokemon[];
  fieldState: FieldState[];
  getLocalized: LocalizeFn;
  targetHasActedThisTurn?: boolean;
  extraFlinchChance?: number;
  allowUserEffects?: boolean;
  allowTargetEffects?: boolean;
}

export function resolveSecondaryEffectsStep({
  move,
  actingSide,
  playerTeam,
  enemyTeam,
  fieldState,
  getLocalized,
  targetHasActedThisTurn,
  extraFlinchChance,
  allowUserEffects,
  allowTargetEffects,
}: ResolveSecondaryEffectsOptions) {
  const result = applyMoveSecondaryEffects({
    move,
    actingSide,
    teams: { playerTeam, enemyTeam },
    fieldState,
    getLocalized,
    targetHasActedThisTurn,
    extraFlinchChance,
    allowUserEffects,
    allowTargetEffects,
  });

  return {
    ...result,
    events: result.messages.map((message) => ({ type: 'message' as const, message })),
  };
}
