import type {
  BattleMenuTab,
  GamePokemon,
  GameState,
  Item,
  Move,
  Pokemon,
} from '../../../types';
import type {
  BattleSpecialMode,
  BattleSpecialUsageState,
  BattleTurn,
  GameReward,
  RoundResult,
  GameViewAnimationState,
  GameViewSelectionState,
  FactoryAiTier,
  RewardAction,
} from './common';

export interface GameViewFlowState {
  gameState: GameState;
  startStep: number;
  showLogHistory: boolean;
  currentLanguage: string;
  pendingRewardAction: RewardAction;
  loading: boolean;
  stage: number;
  turn: BattleTurn;
  battleMenuTab: BattleMenuTab;
  prevGameState: GameState;
}

export interface GameViewRosterState {
  playerTeam: GamePokemon[];
  enemy: GamePokemon | null;
  enemyTeam: GamePokemon[];
  factoryRentals: GamePokemon[];
  selectedRentalIndices: number[];
  inventory: Item[];
  battleLog: string[];
}

export interface GameViewProgressState {
  coins: number;
  streak: number;
  swapCount: number;
  totalRents: number;
  enemyAiTier: FactoryAiTier;
  roundResult: RoundResult;
  lastTokenGain: number;
  rewardChoiceMade: boolean;
  rerollCount: number;
  rewards: GameReward[];
}

export interface GameViewBattleState {
  activeBuffs: { atk: boolean; def: boolean };
  isTransitioning: boolean;
  isMessageProcessing: boolean;
  specialModeUnlocked: boolean;
  specialBossBattleActive: boolean;
  battleSpecialUsage: BattleSpecialUsageState;
  canUseBattleSpecial: boolean;
  canUseBattleSpecialByMode: Record<BattleSpecialMode, boolean>;
}

export interface GameViewSetupState {
  selectedGens: number[];
  startLevel: number;
  infoPokemonIdx: number | null;
  showLangMenu: boolean;
  evolutionChoices: Pokemon[];
}

export interface GameViewState
  extends GameViewFlowState,
    GameViewRosterState,
    GameViewProgressState,
    GameViewBattleState,
    GameViewSetupState,
    GameViewAnimationState,
    GameViewSelectionState {}
