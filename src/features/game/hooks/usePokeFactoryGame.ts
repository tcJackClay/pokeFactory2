/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import type { BattleMenuTab, GamePokemon, GameState, Item, Move, Pokemon, Weather } from '../../../types';
import { getAiTier } from '../config/factoryBattle';
import { FACTORY_REWARD_CONFIG } from '../config/factoryRewards';
import { useGameLocalization } from './useGameLocalization';
import { useBattleController } from './useBattleController';
import { useFactoryFlow } from './useFactoryFlow';
import { useRewardFlow } from './useRewardFlow';
import type {
  BattleSpecialUsageState,
  FactoryAiTier,
  GameReward,
  GameViewModel,
  RoundResult,
  SelectedEvolutionPokemon,
} from '../view-model';

export function usePokeFactoryGame(): GameViewModel {
  const [gameState, setGameState] = useState<GameState>('START');
  const [startStep, setStartStep] = useState(0);
  const [coins, setCoins] = useState(0);
  const [shopItems, setShopItems] = useState<{ item: Item; price: number }[]>([]);
  const [rewardChoiceMade, setRewardChoiceMade] = useState(false);
  const [rerollCount, setRerollCount] = useState(0);
  const [playerTeam, setPlayerTeam] = useState<GamePokemon[]>([]);
  const [rewards, setRewards] = useState<GameReward[]>([]);
  const [activeBuffs, setActiveBuffs] = useState({ atk: false, def: false });
  const [enemyBuffs, setEnemyBuffs] = useState({ atk: false, def: false });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMessageProcessing, setIsMessageProcessing] = useState(false);
  const [showReplaceUI, setShowReplaceUI] = useState<GamePokemon | null>(null);
  const [learningPokemonIdx, setLearningPokemonIdx] = useState<number | null>(null);
  const [potentialMoves, setPotentialMoves] = useState<Move[]>([]);
  const [selectedNewMove, setSelectedNewMove] = useState<Move | null>(null);
  const [selectedGens, setSelectedGens] = useState<number[]>([1]);
  const [startLevel, setStartLevel] = useState(50);
  const [hoveredMove, setHoveredMove] = useState<Move | null>(null);
  const [infoPokemonIdx, setInfoPokemonIdx] = useState<number | null>(null);
  const [prevGameState, setPrevGameState] = useState<GameState>('START');
  const [showLogHistory, setShowLogHistory] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('zh-hans');
  const [pendingRewardAction, setPendingRewardAction] = useState<'MOVE' | 'EVOLUTION' | null>(null);
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<Item[]>([]);
  const [stage, setStage] = useState(1);
  const [enemy, setEnemy] = useState<GamePokemon | null>(null);
  const [enemyTeam, setEnemyTeam] = useState<GamePokemon[]>([]);
  const [streak, setStreak] = useState(0);
  const [swapCount, setSwapCount] = useState(0);
  const [totalRents, setTotalRents] = useState(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('pokefactory_total_rents') : null;
    return saved ? Number(saved) || 0 : 0;
  });
  const [specialModeUnlocked, setSpecialModeUnlocked] = useState(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('pokefactory_special_mode_unlocked') : null;
    return saved === '1';
  });
  const [specialBossBattleActive, setSpecialBossBattleActive] = useState(false);
  const [battleSpecialUsage, setBattleSpecialUsage] = useState<BattleSpecialUsageState>({
    MEGA: false,
    DYNAMAX: false,
    TERA: false,
  });
  const [enemyAiTier, setEnemyAiTier] = useState<FactoryAiTier>(
    getAiTier(1, FACTORY_REWARD_CONFIG.battlesPerSet),
  );
  const [roundResult, setRoundResult] = useState<RoundResult>(null);
  const [lastTokenGain, setLastTokenGain] = useState(0);
  const [factoryRentals, setFactoryRentals] = useState<GamePokemon[]>([]);
  const [selectedRentalIndices, setSelectedRentalIndices] = useState<number[]>([]);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [turn, setTurn] = useState<'PLAYER' | 'ENEMY'>('PLAYER');
  const [battleMenuTab, setBattleMenuTab] = useState<BattleMenuTab>('MAIN');
  const [weather, setWeather] = useState<Weather>('none');
  const [weatherTurns, setWeatherTurns] = useState(0);
  const [evolutionTarget, setEvolutionTarget] = useState<GamePokemon | null>(null);
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolvedPokemon, setEvolvedPokemon] = useState<GamePokemon | null>(null);
  const [evolutionChoices, setEvolutionChoices] = useState<Pokemon[]>([]);
  const [selectedPokemonForEvolution, setSelectedPokemonForEvolution] = useState<SelectedEvolutionPokemon | null>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [playerAnim, setPlayerAnim] = useState<'idle' | 'attack' | 'hit'>('idle');
  const [enemyAnim, setEnemyAnim] = useState<'idle' | 'attack' | 'hit'>('idle');
  const [activeMoveType, setActiveMoveType] = useState<string | null>(null);
  const [isCatching, setIsCatching] = useState(false);
  const [catchSuccess, setCatchSuccess] = useState<boolean | null>(null);

  const { t, getLocalized, getLocalizedDesc, getLocalizedNature, getStatName } = useGameLocalization(currentLanguage);

  const battleController = useBattleController({
    gameState,
    turn,
    isMessageProcessing,
    inventory,
    playerTeam,
    enemy,
    enemyTeam,
    activeBuffs,
    enemyBuffs,
    weather,
    stage,
    streak,
    enemyAiTier,
    specialModeUnlocked,
    specialBossBattleActive,
    battleSpecialUsage,
    t,
    getLocalized,
    setCoins,
    setInventory,
    setPlayerTeam,
    setEnemy,
    setEnemyTeam,
    setActiveBuffs,
    setEnemyBuffs,
    setIsMessageProcessing,
    setBattleLog,
    setTurn,
    setBattleMenuTab,
    setPlayerAnim,
    setEnemyAnim,
    setActiveMoveType,
    setIsCatching,
    setCatchSuccess,
    setShowReplaceUI,
    setGameState,
    setStreak,
    setRoundResult,
    setLastTokenGain,
    setLoading,
    setSpecialModeUnlocked,
    setSpecialBossBattleActive,
    setBattleSpecialUsage,
  });

  const factoryFlow = useFactoryFlow({
    selectedGens,
    startLevel,
    stage,
    totalRents,
    specialModeUnlocked,
    selectedRentalIndices,
    factoryRentals,
    playerTeam,
    enemyTeam,
    t,
    getLocalized,
    addMessagesSequentially: battleController.addMessagesSequentially,
    setLoading,
    setFactoryRentals,
    setSelectedRentalIndices,
    setInventory,
    setCoins,
    setRoundResult,
    setLastTokenGain,
    setSwapCount,
    setTotalRents,
    setEnemyAiTier,
    setSpecialBossBattleActive,
    setBattleSpecialUsage,
    setStage,
    setStreak,
    setGameState,
    setPlayerTeam,
    setIsTransitioning,
    setEnemyTeam,
    setEnemy,
    setBattleLog,
    setTurn,
    setBattleMenuTab,
    setActiveBuffs,
    setEnemyBuffs,
  });

  const rewardFlow = useRewardFlow({
    selectedGens,
    startLevel,
    coins,
    rerollCount,
    rewardChoiceMade,
    playerTeam,
    showReplaceUI,
    learningPokemonIdx,
    selectedNewMove,
    selectedPokemonForEvolution,
    stage,
    t,
    getLocalized,
    addMessagesSequentially: battleController.addMessagesSequentially,
    healAllPokemon: factoryFlow.healAllPokemon,
    startBattleTransition: factoryFlow.startBattleTransition,
    spawnEnemy: factoryFlow.spawnEnemy,
    setLoading,
    setCoins,
    setRerollCount,
    setRewards,
    setRewardChoiceMade,
    setInventory,
    setPlayerTeam,
    setShowReplaceUI,
    setPendingRewardAction,
    setLearningPokemonIdx,
    setPotentialMoves,
    setSelectedNewMove,
    setSelectedPokemonForEvolution,
    setEvolutionChoices,
    setEvolutionTarget,
    setEvolvedPokemon,
    setIsEvolving,
    setGameState,
    setStage,
  });

  void shopItems;
  void setShopItems;
  void weatherTurns;
  void setWeatherTurns;
  void evolutionTarget;
  void isEvolving;
  void evolvedPokemon;
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pokefactory_total_rents', String(totalRents));
    }
  }, [totalRents]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pokefactory_special_mode_unlocked', specialModeUnlocked ? '1' : '0');
    }
  }, [specialModeUnlocked]);

  const continueAfterRoundResult = () => {
    if (roundResult === 'WIN') {
      setGameState('FACTORY_SWAP');
      return;
    }
    setGameState('START');
  };

  const viewModel = {
    gameState,
    startStep,
    coins,
    rewardChoiceMade,
    rerollCount,
    playerTeam,
    rewards,
    activeBuffs,
    isTransitioning,
    isMessageProcessing,
    canUseBattleSpecial: battleController.canUseBattleSpecial,
    canUseBattleSpecialByMode: battleController.canUseBattleSpecialByMode,
    learningPokemonIdx,
    potentialMoves,
    selectedNewMove,
    selectedGens,
    startLevel,
    hoveredMove,
    infoPokemonIdx,
    prevGameState,
    showLogHistory,
    currentLanguage,
    pendingRewardAction,
    loading,
    inventory,
    stage,
    streak,
    swapCount,
    totalRents,
    enemyAiTier,
    specialModeUnlocked,
    specialBossBattleActive,
    battleSpecialUsage,
    roundResult,
    lastTokenGain,
    enemy,
    enemyTeam,
    factoryRentals,
    selectedRentalIndices,
    battleLog,
    turn,
    battleMenuTab,
    selectedPokemonForEvolution,
    evolutionChoices,
    showLangMenu,
    playerAnim,
    enemyAnim,
    activeMoveType,
    isCatching,
    catchSuccess,
    showReplaceUI,
    t,
    getLocalized,
    getLocalizedDesc,
    getLocalizedNature,
    getStatName,
    setShowLangMenu,
    setCurrentLanguage,
    setShowLogHistory,
    setStartStep,
    setSelectedGens,
    setStartLevel,
    setBattleMenuTab,
    setGameState,
    setInfoPokemonIdx,
    setPrevGameState,
    setHoveredMove,
    setPendingRewardAction,
    setLearningPokemonIdx,
    setSelectedNewMove,
    setSelectedPokemonForEvolution,
    setEvolutionChoices,
    setShowReplaceUI,
    startGame: factoryFlow.startGame,
    confirmRentals: factoryFlow.confirmRentals,
    toggleRental: factoryFlow.toggleRental,
    performSwap: factoryFlow.performSwap,
    nextFactoryStage: factoryFlow.nextFactoryStage,
    useItem: battleController.useItem,
    switchPokemon: battleController.switchPokemon,
    handleAttack: battleController.handleAttack,
    triggerBattleSpecial: battleController.triggerBattleSpecial,
    rerollRewards: rewardFlow.rerollRewards,
    nextStage: rewardFlow.nextStage,
    selectReward: rewardFlow.selectReward,
    startLearningMove: rewardFlow.startLearningMove,
    handleLearnMove: rewardFlow.handleLearnMove,
    replaceMove: rewardFlow.replaceMove,
    startEvolution: rewardFlow.startEvolution,
    performEvolution: rewardFlow.performEvolution,
    replacePokemon: rewardFlow.replacePokemon,
    continueAfterRoundResult,
    forfeitChallenge: battleController.forfeitChallenge,
  } satisfies GameViewModel;

  return viewModel;
}
