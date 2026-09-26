import type { BattleHazards, FieldState, FieldTurns, GamePokemon, TailwindTurns, Weather } from '../../../../types';

export type EngineBattleSide = 'player' | 'enemy';
export type EngineNextTurn = 'PLAYER' | 'ENEMY' | null;

export interface BattleSnapshot {
  playerTeam: GamePokemon[];
  enemyTeam: GamePokemon[];
  weather: Weather;
  weatherTurns: number;
  fieldState: FieldState[];
  fieldTurns: FieldTurns;
  tailwindTurns: TailwindTurns;
  hazards: BattleHazards;
}

export type BattleEvent =
  | { type: 'message'; message: string }
  | { type: 'hp-change'; displayName: string; amount: number }
  | { type: 'faint'; side: EngineBattleSide; pokemonId: number };

export interface BeforeMoveCheckResult {
  canAct: boolean;
  combatant: GamePokemon;
  snapshot: BattleSnapshot;
  events: BattleEvent[];
  nextTurn: EngineNextTurn;
}

export interface EndTurnResolutionResult {
  snapshot: BattleSnapshot;
  events: BattleEvent[];
  playerLead: GamePokemon;
  enemyLead: GamePokemon;
  playerLeadFainted: boolean;
  enemyLeadFainted: boolean;
}
