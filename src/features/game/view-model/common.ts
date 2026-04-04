import type { GamePokemon, Move, Nature } from '../../../types';
import type { FactoryAiTier } from '../config/factoryBattle';

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;
export type LocalizeFn = (obj: any, key?: string) => string;
export type LocalizeDescFn = (obj: any) => string;
export type RewardAction = 'MOVE' | 'EVOLUTION' | null;
export type BattleTurn = 'PLAYER' | 'ENEMY';
export type BattleAnimation = 'idle' | 'attack' | 'hit';
export type RoundResult = 'WIN' | 'LOSS' | null;
export type { FactoryAiTier };
export type BattleSpecialMode = 'MEGA' | 'DYNAMAX' | 'TERA' | 'ZMOVE';
export type BaseTab = 'HOME' | 'FACTORY' | 'SHOP' | 'BREEDING' | 'COLLECTION' | 'EVENTS' | 'PROFILE';

export interface BaseRunSummary {
  visible: boolean;
  mode: 'CLASSIC' | 'ROGUE' | null;
  setNo: number | null;
  battleIndexInSet: number | null;
  result: 'WIN' | 'LOSS' | 'RETIRE' | null;
  tokenGain: number;
  newRecord: boolean;
  unlockedFeatureIds: string[];
}

export interface BattleSpecialUsageState {
  MEGA: boolean;
  DYNAMAX: boolean;
  TERA: boolean;
  ZMOVE: boolean;
}

export interface GameReward {
  type: 'ITEM' | 'POKEMON' | 'TM' | 'EVOLUTION' | 'SHOP_ITEM';
  data: any;
}

export interface SelectedEvolutionPokemon {
  pokemon: GamePokemon;
  index: number;
}

export interface GameViewLocalization {
  t: TranslateFn;
  getLocalized: LocalizeFn;
  getLocalizedDesc: LocalizeDescFn;
  getLocalizedNature: (nature: Nature) => string;
  getStatName: (stat: string) => string;
}

export interface GameViewAnimationState {
  playerAnim: BattleAnimation;
  enemyAnim: BattleAnimation;
  activeMoveType: string | null;
  isCatching: boolean;
  catchSuccess: boolean | null;
}

export interface GameViewSelectionState {
  learningPokemonIdx: number | null;
  potentialMoves: Move[];
  selectedNewMove: Move | null;
  pendingTmMove: Move | null;
  pendingTmLearnerIndexes: number[];
  pendingEvolutionEligibleIndexes: number[];
  hoveredMove: Move | null;
  showReplaceUI: GamePokemon | null;
  selectedPokemonForEvolution: SelectedEvolutionPokemon | null;
}
