import type { Dispatch, SetStateAction } from 'react';
import type {
  BattleMenuTab,
  GamePokemon,
  GameState,
  Move,
  Pokemon,
} from '../../../types';
import type { RewardAction, SelectedEvolutionPokemon } from './common';

export interface GameViewSetters {
  setShowLangMenu: Dispatch<SetStateAction<boolean>>;
  setCurrentLanguage: Dispatch<SetStateAction<string>>;
  setShowLogHistory: Dispatch<SetStateAction<boolean>>;
  setStartStep: Dispatch<SetStateAction<number>>;
  setSelectedGens: Dispatch<SetStateAction<number[]>>;
  setStartLevel: Dispatch<SetStateAction<number>>;
  setBattleMenuTab: Dispatch<SetStateAction<BattleMenuTab>>;
  setGameState: Dispatch<SetStateAction<GameState>>;
  setInfoPokemonIdx: Dispatch<SetStateAction<number | null>>;
  setPrevGameState: Dispatch<SetStateAction<GameState>>;
  setHoveredMove: Dispatch<SetStateAction<Move | null>>;
  setPendingRewardAction: Dispatch<SetStateAction<RewardAction>>;
  setLearningPokemonIdx: Dispatch<SetStateAction<number | null>>;
  setSelectedNewMove: Dispatch<SetStateAction<Move | null>>;
  setSelectedPokemonForEvolution: Dispatch<SetStateAction<SelectedEvolutionPokemon | null>>;
  setEvolutionChoices: Dispatch<SetStateAction<Pokemon[]>>;
  setShowReplaceUI: Dispatch<SetStateAction<GamePokemon | null>>;
}
