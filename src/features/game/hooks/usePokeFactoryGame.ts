/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import type { BattleMenuTab, GamePokemon, GameState, Item, Move, Pokemon, Weather } from '../../../types';
import { ALL_ITEMS } from '../../../uiAppConstants';
import { GENERATIONS } from '../../../constants';
import { getAiTier } from '../config/factoryBattle';
import { FACTORY_REWARD_CONFIG } from '../config/factoryRewards';
import { useGameLocalization } from './useGameLocalization';
import { useBattleController } from './useBattleController';
import { useFactoryFlow } from './useFactoryFlow';
import { useRewardFlow } from './useRewardFlow';
import type { FactoryTrainerTemplate } from '../config/factoryTrainerTemplates';
import type {
  BaseRunSummary,
  BaseTab,
  BattleSpecialUsageState,
  FactoryAiTier,
  GameReward,
  GameViewModel,
  RoundResult,
  SelectedEvolutionPokemon,
} from '../view-model';
import { getBattleIndexInSet, getSetNoByStage } from '../config/factoryRewards';
import {
  buildSaveExportFilename,
  createSaveData,
  loadSaveData,
  parseSaveDataFromText,
  persistSaveData,
  triggerJsonDownload,
  type CollectionLedger,
} from '../../../services/saveManager';
import { createPokemonFormLedgerKey, normalizeStoredFormKeys } from '../utils/formLedger';

export function usePokeFactoryGame(): GameViewModel {
  const initialSave = loadSaveData();
  const devToolsAvailable = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEVTOOLS === '1';
  const [gameState, setGameState] = useState<GameState>('START');
  const [developerMode, setDeveloperMode] = useState(() => {
    const saved = initialSave?.settings.developerMode ?? false;
    return devToolsAvailable ? saved : false;
  });
  const [startStep, setStartStep] = useState(0);
  const [coins, setCoins] = useState(0);
  const [shopItems, setShopItems] = useState<{ item: Item; price: number }[]>([]);
  const [rewardChoiceMade, setRewardChoiceMade] = useState(false);
  const [rerollCount, setRerollCount] = useState(0);
  const [teamCapacity, setTeamCapacity] = useState(3);
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
  const [pendingTmMove, setPendingTmMove] = useState<Move | null>(null);
  const [pendingTmLearnerIndexes, setPendingTmLearnerIndexes] = useState<number[]>([]);
  const [pendingEvolutionEligibleIndexes, setPendingEvolutionEligibleIndexes] = useState<number[]>([]);
  const [selectedGens, setSelectedGens] = useState<number[]>(
    () => initialSave?.settings.selectedGens?.length ? initialSave.settings.selectedGens : GENERATIONS.map((generation) => generation.id),
  );
  const [startLevel, setStartLevel] = useState(initialSave?.settings.startLevel ?? 50);
  const [hoveredMove, setHoveredMove] = useState<Move | null>(null);
  const [infoPokemonIdx, setInfoPokemonIdx] = useState<number | null>(null);
  const [prevGameState, setPrevGameState] = useState<GameState>('START');
  const [showLogHistory, setShowLogHistory] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(initialSave?.settings.currentLanguage ?? 'zh-hans');
  const [pendingRewardAction, setPendingRewardAction] = useState<'MOVE' | 'EVOLUTION' | null>(null);
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<Item[]>([]);
  const [stage, setStage] = useState(1);
  const [enemy, setEnemy] = useState<GamePokemon | null>(null);
  const [enemyTeam, setEnemyTeam] = useState<GamePokemon[]>([]);
  const [currentEnemyTrainer, setCurrentEnemyTrainer] = useState<FactoryTrainerTemplate | null>(null);
  const [streak, setStreak] = useState(0);
  const [swapCount, setSwapCount] = useState(0);
  const [totalRents, setTotalRents] = useState(initialSave?.progress.totalRents ?? 0);
  const [specialModeUnlocked, setSpecialModeUnlocked] = useState(initialSave?.progress.specialModeUnlocked ?? false);
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
  const [currentBaseTab, setCurrentBaseTab] = useState<BaseTab>('HOME');
  const [pendingRunSummary, setPendingRunSummary] = useState<BaseRunSummary | null>(null);
  const [hasFactoryRunToResume, setHasFactoryRunToResume] = useState(false);
  const [starterName] = useState('Pikachu');
  const [starterBondLevel] = useState(1);
  const [availableEggCount] = useState(0);
  const [activeEventCount] = useState(0);
  const [shopUnlocked] = useState(true);
  const [breedingUnlocked] = useState(true);
  const [collectionUnlocked] = useState(true);
  const [eventsUnlocked] = useState(true);
  const [highestStreak, setHighestStreak] = useState(initialSave?.progress.highestStreak ?? 0);
  const [collectionLedger, setCollectionLedger] = useState<CollectionLedger>(() => ({
    seenIds: initialSave?.collection?.seenIds ?? [],
    ownedIds: initialSave?.collection?.ownedIds ?? [],
    formKeys: normalizeStoredFormKeys(initialSave?.collection?.formKeys ?? []),
  }));

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
    setCurrentEnemyTrainer,
    setBattleLog,
    setTurn,
    setBattleMenuTab,
    setActiveBuffs,
    setEnemyBuffs,
  });
  const { prefetchRentals } = factoryFlow;

  const rewardFlow = useRewardFlow({
    selectedGens,
    startLevel,
    coins,
    rerollCount,
    rewardChoiceMade,
    teamCapacity,
    playerTeam,
    showReplaceUI,
    learningPokemonIdx,
    selectedNewMove,
    pendingTmMove,
    pendingTmLearnerIndexes,
    pendingEvolutionEligibleIndexes,
    selectedPokemonForEvolution,
    stage,
    t,
    getLocalized,
    addMessagesSequentially: battleController.addMessagesSequentially,
    healAllPokemon: factoryFlow.healAllPokemon,
    startBattleTransition: factoryFlow.startBattleTransition,
    spawnEnemy: factoryFlow.spawnEnemy,
    prefetchEnemy: factoryFlow.prefetchEnemy,
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
    setPendingTmMove,
    setPendingTmLearnerIndexes,
    setPendingEvolutionEligibleIndexes,
    setSelectedPokemonForEvolution,
    setEvolutionChoices,
    setEvolutionTarget,
    setEvolvedPokemon,
    setIsEvolving,
    setGameState,
    setStage,
    setTeamCapacity,
  });

  void shopItems;
  void setShopItems;
  void weatherTurns;
  void setWeatherTurns;
  void evolutionTarget;
  void isEvolving;
  void evolvedPokemon;

  useEffect(() => {
    const seenIds = new Set<number>(collectionLedger.seenIds);
    const ownedIds = new Set<number>(collectionLedger.ownedIds);
    const formKeys = new Set<string>(normalizeStoredFormKeys(collectionLedger.formKeys));

    const registerSeen = (pokemon: GamePokemon) => {
      if (!Number.isFinite(pokemon.id) || pokemon.id <= 0) return;
      seenIds.add(pokemon.id);
      const formKey = createPokemonFormLedgerKey(pokemon);
      if (formKey) {
        formKeys.add(formKey);
      }
    };

    const registerOwned = (pokemon: GamePokemon) => {
      if (!Number.isFinite(pokemon.id) || pokemon.id <= 0) return;
      ownedIds.add(pokemon.id);
    };

    factoryRentals.forEach(registerSeen);
    enemyTeam.forEach(registerSeen);
    playerTeam.forEach((pokemon) => {
      registerSeen(pokemon);
      registerOwned(pokemon);
    });

    const nextSeenIds = [...seenIds].sort((a, b) => a - b);
    const nextOwnedIds = [...ownedIds].sort((a, b) => a - b);
    const nextFormKeys = [...formKeys].sort((a, b) => a.localeCompare(b));

    if (
      nextSeenIds.length === collectionLedger.seenIds.length
      && nextOwnedIds.length === collectionLedger.ownedIds.length
      && nextFormKeys.length === collectionLedger.formKeys.length
      && nextSeenIds.every((value, idx) => value === collectionLedger.seenIds[idx])
      && nextOwnedIds.every((value, idx) => value === collectionLedger.ownedIds[idx])
      && nextFormKeys.every((value, idx) => value === collectionLedger.formKeys[idx])
    ) {
      return;
    }

    setCollectionLedger({
      seenIds: nextSeenIds,
      ownedIds: nextOwnedIds,
      formKeys: nextFormKeys,
    });
  }, [collectionLedger.formKeys, collectionLedger.ownedIds, collectionLedger.seenIds, enemyTeam, factoryRentals, playerTeam]);

  const seenCount = collectionLedger.seenIds.length;
  const ownedCount = collectionLedger.ownedIds.length;
  const formCount = collectionLedger.formKeys.length;

  useEffect(() => {
    if (gameState !== 'START') return;
    void prefetchRentals();
  }, [gameState, prefetchRentals]);

  useEffect(() => {
    if (streak > highestStreak) {
      setHighestStreak(streak);
    }
  }, [highestStreak, streak]);

  const buildCurrentSaveData = useCallback(() => createSaveData({
    totalRents,
    highestStreak,
    specialModeUnlocked,
    currentLanguage,
    selectedGens,
    startLevel,
    developerMode: devToolsAvailable ? developerMode : false,
    collection: collectionLedger,
  }), [
    collectionLedger,
    currentLanguage,
    developerMode,
    devToolsAvailable,
    highestStreak,
    selectedGens,
    specialModeUnlocked,
    startLevel,
    totalRents,
  ]);

  useEffect(() => {
    persistSaveData(buildCurrentSaveData());
  }, [buildCurrentSaveData]);

  const enterBase = useCallback(() => {
    setCurrentBaseTab('HOME');
    setGameState('START');
  }, []);

  const openBaseTab = useCallback((tab: BaseTab) => {
    setCurrentBaseTab(tab);
  }, []);

  const closeRunSummary = useCallback(() => {
    setPendingRunSummary((prev) => (prev ? { ...prev, visible: false } : prev));
  }, []);

  const continueAfterRoundResult = () => {
    const setNo = getSetNoByStage(stage);
    const battleIndexInSet = getBattleIndexInSet(stage);
    const newRecord = roundResult === 'WIN' ? streak >= highestStreak : false;

    if (roundResult === 'WIN') {
      if (battleIndexInSet === FACTORY_REWARD_CONFIG.battlesPerSet) {
        setPendingRunSummary({
          visible: true,
          mode: 'CLASSIC',
          setNo,
          battleIndexInSet,
          result: 'WIN',
          tokenGain: lastTokenGain,
          newRecord,
          unlockedFeatureIds: [],
        });
        setHasFactoryRunToResume(true);
        setCurrentBaseTab('HOME');
        setGameState('START');
        return;
      }

      void factoryFlow.prefetchEnemy(stage + 1);
      setGameState('FACTORY_SWAP');
      return;
    }
    setPendingRunSummary({
      visible: true,
      mode: 'CLASSIC',
      setNo,
      battleIndexInSet,
      result: 'LOSS',
      tokenGain: lastTokenGain,
      newRecord,
      unlockedFeatureIds: [],
    });
    setHasFactoryRunToResume(false);
    setCurrentBaseTab('HOME');
    setGameState('START');
  };

  const toggleDeveloperMode = useCallback(() => {
    if (!devToolsAvailable) return;
    setDeveloperMode((prev) => !prev);
  }, [devToolsAvailable]);

  const devAddCoins = useCallback((amount: number) => {
    setCoins((prev) => Math.max(0, prev + amount));
  }, []);

  const devSetStage = useCallback((value: number) => {
    const normalized = Math.max(1, Math.floor(value));
    setStage(normalized);
    setEnemyAiTier(getAiTier(normalized, FACTORY_REWARD_CONFIG.battlesPerSet));
  }, []);

  const devUnlockSpecialMode = useCallback(() => {
    setSpecialModeUnlocked(true);
  }, []);

  const devResetBattleSpecialUsage = useCallback(() => {
    setBattleSpecialUsage({ MEGA: false, DYNAMAX: false, TERA: false });
    setSpecialBossBattleActive(false);
  }, []);

  const devOpenRewardScreen = useCallback(() => {
    const fallbackItem = ALL_ITEMS[0];
    const potionItem = ALL_ITEMS.find((item) => item.id === 'potion') ?? fallbackItem;
    const ballItem = ALL_ITEMS.find((item) => item.isBall) ?? fallbackItem;
    const battleItem = ALL_ITEMS.find((item) => item.isBattleItem) ?? fallbackItem;
    const samplePokemon = playerTeam[0] ?? factoryRentals[0];
    const sampleTmMove = samplePokemon?.selectedMoves?.[0];
    const tmReward: GameReward = sampleTmMove
      ? { type: 'TM', data: { move: sampleTmMove, learnerIndexes: [0] } }
      : { type: 'ITEM', data: potionItem };
    const nextRewards: GameReward[] = [
      { type: 'ITEM', data: potionItem },
      samplePokemon ? { type: 'POKEMON', data: samplePokemon } : { type: 'ITEM', data: potionItem },
      tmReward,
      { type: 'EVOLUTION', data: { eligibleIndexes: [0] } },
      { type: 'SHOP_ITEM', data: { item: battleItem, price: 80 } },
      { type: 'SHOP_ITEM', data: { item: ballItem, price: 60 } },
    ];

    setRewards(nextRewards);
    setRewardChoiceMade(false);
    setRerollCount(0);
    setPendingTmMove(null);
    setPendingTmLearnerIndexes([]);
    setPendingEvolutionEligibleIndexes([]);
    setPendingRewardAction(null);
    setLearningPokemonIdx(null);
    setSelectedNewMove(null);
    setSelectedPokemonForEvolution(null);
    setEvolutionChoices([]);
    setShowReplaceUI(null);
    setGameState('REWARD');
  }, [factoryRentals, playerTeam]);

  const shouldTriggerPreBattleReward = useCallback((nextStage: number) => {
    const battleInSet = ((nextStage - 1) % FACTORY_REWARD_CONFIG.battlesPerSet) + 1;
    if (battleInSet !== 1 && battleInSet !== 4 && battleInSet !== 7) return false;
    if (battleInSet === 1 && streak === 0) return false;
    return true;
  }, [streak]);

  const nextFactoryStage = useCallback(async () => {
    const nextStageValue = stage + 1;
    if (shouldTriggerPreBattleReward(nextStageValue)) {
      void factoryFlow.prefetchEnemy(nextStageValue);
      await rewardFlow.openRewardStage();
      return;
    }
    await factoryFlow.nextFactoryStage();
  }, [factoryFlow, rewardFlow, shouldTriggerPreBattleReward, stage]);

  const performSwap = useCallback(async (playerIdx: number, enemyIdx: number) => {
    await factoryFlow.performSwap(playerIdx, enemyIdx);
    await nextFactoryStage();
  }, [factoryFlow, nextFactoryStage]);

  const startGame = useCallback(async () => {
    setHasFactoryRunToResume(false);
    setPendingRunSummary(null);
    setTeamCapacity(3);
    setPendingTmMove(null);
    setPendingTmLearnerIndexes([]);
    setPendingEvolutionEligibleIndexes([]);
    await factoryFlow.startGame();
  }, [factoryFlow]);

  const quickStartDevBattle = useCallback(async () => {
    setHasFactoryRunToResume(false);
    setPendingRunSummary(null);
    setTeamCapacity(3);
    setPendingTmMove(null);
    setPendingTmLearnerIndexes([]);
    setPendingEvolutionEligibleIndexes([]);
    await factoryFlow.quickStartDevBattle();
  }, [factoryFlow]);

  const startOrResumeFactoryFromBase = useCallback(async () => {
    setPendingRunSummary(null);
    setCurrentBaseTab('HOME');

    if (hasFactoryRunToResume) {
      setHasFactoryRunToResume(false);
      await factoryFlow.nextFactoryStage();
      return;
    }

    await startGame();
  }, [factoryFlow, hasFactoryRunToResume, startGame]);

  const exportSaveData = useCallback(() => {
    const saveData = buildCurrentSaveData();
    const exportText = JSON.stringify(saveData, null, 2);
    triggerJsonDownload(exportText, buildSaveExportFilename());
  }, [buildCurrentSaveData]);

  const importSaveData = useCallback((jsonText: string) => {
    try {
      const parsed = parseSaveDataFromText(jsonText);
      const normalizedCollection: CollectionLedger = {
        ...parsed.collection,
        formKeys: normalizeStoredFormKeys(parsed.collection.formKeys),
      };
      const normalizedParsed = {
        ...parsed,
        collection: normalizedCollection,
      };

      setTotalRents(parsed.progress.totalRents);
      setHighestStreak(parsed.progress.highestStreak);
      setSpecialModeUnlocked(parsed.progress.specialModeUnlocked);

      setCurrentLanguage(parsed.settings.currentLanguage);
      setSelectedGens(parsed.settings.selectedGens.length > 0 ? parsed.settings.selectedGens : GENERATIONS.map((generation) => generation.id));
      setStartLevel(parsed.settings.startLevel);
      setDeveloperMode(devToolsAvailable ? parsed.settings.developerMode : false);

      setCollectionLedger(normalizedCollection);
      persistSaveData(normalizedParsed);

      return {
        ok: true,
        message: currentLanguage.startsWith('zh') ? '存档导入成功。' : 'Save imported successfully.',
      };
    } catch (error) {
      console.error('Import save failed', error);
      return {
        ok: false,
        message: currentLanguage.startsWith('zh') ? '存档格式无效，导入失败。' : 'Invalid save format. Import failed.',
      };
    }
  }, [currentLanguage, devToolsAvailable]);

  const viewModel = {
    gameState,
    devToolsAvailable,
    developerMode,
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
    pendingTmMove,
    pendingTmLearnerIndexes,
    pendingEvolutionEligibleIndexes,
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
    currentEnemyTrainer,
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
    currentBaseTab,
    pendingRunSummary,
    hasFactoryRunToResume,
    highestStreak,
    starterName,
    starterBondLevel,
    availableEggCount,
    activeEventCount,
    seenCount,
    ownedCount,
    formCount,
    collectionSeenIds: collectionLedger.seenIds,
    collectionOwnedIds: collectionLedger.ownedIds,
    collectionFormKeys: collectionLedger.formKeys,
    shopUnlocked,
    breedingUnlocked,
    collectionUnlocked,
    eventsUnlocked,
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
    setPendingEvolutionEligibleIndexes,
    setLearningPokemonIdx,
    setSelectedNewMove,
    setSelectedPokemonForEvolution,
    setEvolutionChoices,
    setShowReplaceUI,
    enterBase,
    openBaseTab,
    closeRunSummary,
    startOrResumeFactoryFromBase,
    startGame,
    quickStartDevBattle,
    confirmRentals: factoryFlow.confirmRentals,
    toggleRental: factoryFlow.toggleRental,
    performSwap,
    nextFactoryStage,
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
    toggleDeveloperMode,
    devAddCoins,
    devSetStage,
    devUnlockSpecialMode,
    devResetBattleSpecialUsage,
    devOpenRewardScreen,
    exportSaveData,
    importSaveData,
  } satisfies GameViewModel;

  return viewModel;
}
