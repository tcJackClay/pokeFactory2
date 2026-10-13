import type {
  BattleMenuTab,
  BattleHazards,
  FieldState,
  FieldTurns,
  GamePokemon,
  GameState,
  Item,
  Move,
  Pokemon,
  TailwindTurns,
  Weather,
} from '../../../types';
import type { RegionDispatchState } from '../config/events';
import type { FactoryTrainerTemplate } from '../config/factoryTrainerTemplates';
import type { CompanionSpeciesId } from '../config/companionCandidates';
import type { FactoryRewardCheckpoint } from '../../../services/saveManager';
import type {
  BaseRunSummary,
  BaseTab,
  BattleSpecialMode,
  BattleSpecialUsageState,
  BattleTurn,
  GameReward,
  RoundResult,
  GameViewAnimationState,
  GameViewSelectionState,
  EventDispatchPopup,
  FactoryAiTier,
  PokemonInfoSource,
  RewardAction,
} from './common';

export interface GameViewFlowState {
  gameState: GameState;
  devToolsAvailable: boolean;
  developerMode: boolean;
  startStep: number;
  showLogHistory: boolean;
  currentLanguage: string;
  pendingRewardAction: RewardAction;
  loading: boolean;
  rentalLoadError: string | null;
  opponentLoadError: boolean;
  /** 换怪/奖励落盘失败的提示（显示于换怪屏） */
  postBattleActionError: string | null;
  rewardClaimError: string | null;
  rewardClaimBusy: boolean;
  rewardContinueError: string | null;
  rewardContinueBusy: boolean;
  /** 奖励候选枚举/冻结失败（留在 PENDING 的缺陷态，可重试） */
  rewardPrepareError: string | null;
  /** 三人返还基准曾被规整为互不重复（检测到重复并恢复），需如实告知玩家 */
  heldItemBaselineRepaired: boolean;
  bootProgress: number;
  canEnterProject: boolean;
  bootStatusText: string;
  stage: number;
  turn: BattleTurn;
  battleMenuTab: BattleMenuTab;
  prevGameState: GameState;
}

export interface GameViewRosterState {
  playerTeam: GamePokemon[];
  enemy: GamePokemon | null;
  enemyTeam: GamePokemon[];
  currentEnemyTrainer: FactoryTrainerTemplate | null;
  nextEnemyPreviewTeam: GamePokemon[];
  nextEnemyPreviewTrainer: FactoryTrainerTemplate | null;
  factoryRentals: GamePokemon[];
  selectedRentalIndices: number[];
  inventory: Item[];
  battleLog: string[];
}

export interface GameViewProgressState {
  coins: number;
  supplyTickets: number;
  streak: number;
  swapCount: number;
  totalRents: number;
  enemyAiTier: FactoryAiTier;
  roundResult: RoundResult;
  lastTokenGain: number;
  rewardChoiceMade: boolean;
  rerollCount: number;
  rewards: GameReward[];
  rewardCheckpointStatus: 'PENDING' | 'READY' | 'CLAIMED' | null;
  rewardCheckpoint: FactoryRewardCheckpoint | null;
}

export interface GameViewBattleState {
  settlementError: boolean;
  activeBuffs: { atk: boolean; def: boolean };
  weather: Weather;
  weatherTurns: number;
  fieldState: FieldState[];
  fieldTurns: FieldTurns;
  tailwindTurns: TailwindTurns;
  hazards: BattleHazards;
  isTransitioning: boolean;
  trainerIntroActive: boolean;
  trainerIntroAwaitingContinue: boolean;
  isMessageProcessing: boolean;
  roundTransactionActive: boolean;
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
  infoPokemonSource: PokemonInfoSource;
  showLangMenu: boolean;
  evolutionChoices: Pokemon[];
}

export interface GameViewBaseState {
  currentBaseTab: BaseTab;
  pendingRunSummary: BaseRunSummary | null;
  hasFactoryRunToResume: boolean;
  highestStreak: number;
  companionSpeciesId: CompanionSpeciesId | null;
  activeEventCount: number;
  seenCount: number;
  ownedCount: number;
  formCount: number;
  collectionSeenIds: number[];
  collectionOwnedIds: number[];
  collectionFormKeys: string[];
  shopUnlocked: boolean;
  collectionUnlocked: boolean;
  eventsUnlocked: boolean;
}

export interface GameViewEventState {
  eventDispatches: Record<string, RegionDispatchState>;
  eventDispatchPokemonByRegion: Record<string, number | null>;
  eventDispatchPopup: EventDispatchPopup | null;
}

export interface GameViewState
  extends GameViewFlowState,
    GameViewRosterState,
    GameViewProgressState,
    GameViewBattleState,
    GameViewSetupState,
    GameViewBaseState,
    GameViewEventState,
    GameViewAnimationState,
    GameViewSelectionState {}
