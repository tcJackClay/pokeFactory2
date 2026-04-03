import type { GamePokemon, Item, Move } from '../../../types';
import type { BattleSpecialMode, GameReward } from './common';

export interface GameViewActions {
  startGame: () => Promise<void>;
  confirmRentals: () => Promise<void>;
  toggleRental: (index: number) => void;
  performSwap: (playerIdx: number, enemyIdx: number) => Promise<void>;
  nextFactoryStage: () => Promise<void>;
  useItem: (item: Item, index: number) => Promise<void>;
  switchPokemon: (index: number) => Promise<void>;
  handleAttack: (move: Move) => Promise<void>;
  triggerBattleSpecial: (mode: BattleSpecialMode) => Promise<void>;
  rerollRewards: () => Promise<void>;
  nextStage: () => void;
  selectReward: (reward: GameReward) => void;
  startLearningMove: (idx: number) => Promise<void>;
  handleLearnMove: (move: Move) => void;
  replaceMove: (oldMoveIdx: number) => void;
  startEvolution: (pokemon: GamePokemon, index: number) => Promise<void>;
  performEvolution: (evolvedId: number) => Promise<void>;
  replacePokemon: (index: number) => void;
  continueAfterRoundResult: () => void;
  forfeitChallenge: () => void;
}
