export type {
  BattleAnimation,
  BaseRunSummary,
  BaseTab,
  BattleSpecialMode,
  BattleTurn,
  BattleSpecialUsageState,
  FactoryAiTier,
  GameReward,
  GameViewAnimationState,
  GameViewLocalization,
  LocalizeDescFn,
  LocalizeFn,
  RoundResult,
  RewardAction,
  SelectedEvolutionPokemon,
  TranslateFn,
} from './view-model/common';
export type { GameViewActions } from './view-model/actions';
export type { GameViewSetters } from './view-model/setters';
export type {
  GameViewBattleState,
  GameViewBaseState,
  GameViewFlowState,
  GameViewProgressState,
  GameViewRosterState,
  GameViewEventState,
  GameViewSetupState,
  GameViewState,
} from './view-model/state';

import type { GameViewActions } from './view-model/actions';
import type { GameViewLocalization } from './view-model/common';
import type { GameViewSetters } from './view-model/setters';
import type { GameViewState } from './view-model/state';

export interface GameViewModel extends GameViewState, GameViewLocalization, GameViewSetters, GameViewActions {}
