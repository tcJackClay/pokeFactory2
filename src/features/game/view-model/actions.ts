import type { GamePokemon, Item, Move } from '../../../types';
import type { BaseTab, BattleSpecialMode, GameReward } from './common';

export interface SaveImportResult {
  ok: boolean;
  message: string;
}

export interface GameViewActions {
  enterBase: () => void;
  openBaseTab: (tab: BaseTab) => void;
  closeRunSummary: () => void;
  startOrResumeFactoryFromBase: () => Promise<void>;
  startGame: () => Promise<void>;
  quickStartDevBattle: () => Promise<void>;
  confirmRentals: () => Promise<void>;
  toggleRental: (index: number) => void;
  performSwap: (playerIdx: number, enemyIdx: number) => Promise<void>;
  nextFactoryStage: () => Promise<void>;
  useItem: (item: Item, index: number) => Promise<void>;
  switchPokemon: (index: number) => Promise<void>;
  handleAttack: (move: Move) => Promise<void>;
  triggerBattleSpecial: (mode: BattleSpecialMode) => Promise<void>;
  rerollRewards: () => Promise<void>;
  nextStage: () => Promise<void>;
  selectReward: (reward: GameReward) => void;
  startLearningMove: (idx: number) => Promise<void>;
  handleLearnMove: (move: Move) => void;
  replaceMove: (oldMoveIdx: number) => void;
  startEvolution: (pokemon: GamePokemon, index: number) => Promise<void>;
  performEvolution: (evolvedId: number) => Promise<void>;
  replacePokemon: (index: number) => void;
  continueAfterRoundResult: () => void;
  forfeitChallenge: () => void;
  toggleDeveloperMode: () => void;
  devAddCoins: (amount: number) => void;
  devSetStage: (stage: number) => void;
  devUnlockSpecialMode: () => void;
  devResetBattleSpecialUsage: () => void;
  devOpenRewardScreen: () => void;
  exportSaveData: () => void;
  importSaveData: (jsonText: string) => SaveImportResult;
  setEventDispatchPokemon: (regionId: string, pokemonId: number | null) => void;
  dispatchEventRegion: (regionId: string) => Promise<void>;
  mockEventDispatchResult: (regionId: string, outcome: 'item' | 'join' | 'battle_special') => void;
  closeEventDispatchPopup: () => void;
}
