/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BattleMenuTab, GamePokemon, GameState, Item, Move, Pokemon, Weather } from '../../../types';
import { ALL_ITEMS } from '../../../uiAppConstants';
import { GENERATIONS } from '../../../constants';
import { fetchPokemon, getProcessedPokemon, isEvolutionChainBaseSpecies } from '../../../services/pokeApi';
import { getAiTier } from '../config/factoryBattle';
import { FACTORY_REWARD_CONFIG } from '../config/factoryRewards';
import { EVENT_REGIONS, IV_TRAIN_BATTLE_THRESHOLD, RARE_SPECIES_POOL, createDefaultDispatchState } from '../config/events';
import { useGameLocalization } from './useGameLocalization';
import { useBattleController } from './useBattleController';
import { useFactoryFlow } from './useFactoryFlow';
import { useRewardFlow } from './useRewardFlow';
import { addEvToPokemon, addIvToPokemon, type StatKey } from '../utils/pokemonStats';
import { getFactoryTrainerTemplateById, type FactoryTrainerTemplate } from '../config/factoryTrainerTemplates';
import type {
  BaseRunSummary,
  BaseTab,
  BattleSpecialUsageState,
  EventDispatchPopup,
  FactoryAiTier,
  GameReward,
  GameViewModel,
  RoundResult,
  SelectedEvolutionPokemon,
} from '../view-model';
import { getBattleIndexInSet, getSetNoByStage } from '../config/factoryRewards';
import {
  buildSaveExportFilename,
  createEmptyBattleResume,
  createSaveData,
  loadSaveData,
  parseSaveDataFromText,
  persistSaveData,
  triggerJsonDownload,
  type BattleResumeSnapshot,
  type CollectionLedger,
} from '../../../services/saveManager';
import { createPokemonFormLedgerKey, normalizeStoredFormKeys } from '../utils/formLedger';
import {
  fetchDexCatalogEntries,
  fetchDexMoveDetails,
  fetchDexSnapshots,
  fetchDexTypeMap,
} from '../../../services/pokedexClient';
import { getPokemonSpriteUrl } from '../../../services/pokeApiEndpoint';

const STREAK_FACTORY_SINGLES_50 = 1 << 8;
const STREAK_FACTORY_SINGLES_OPEN = 1 << 9;
const WIN_STREAK_ACTIVE_MASK_DEFAULT = 0xffffffff;
const CHALLENGE_ACTIVE_STATES: GameState[] = ['FACTORY_SELECT', 'FACTORY_SWAP', 'BATTLE', 'REWARD', 'ROUND_RESULT'];
const BOOT_ENTER_THRESHOLD = 80;
const EMPTY_BATTLE_SPECIAL_USAGE: BattleSpecialUsageState = { MEGA: false, DYNAMAX: false, TERA: false, ZMOVE: false };
const ITEM_BY_ID = Object.fromEntries(ALL_ITEMS.map((item) => [item.id, item] as const));

function hydrateInventoryFromItemIds(itemIds: string[]): Item[] {
  return itemIds
    .map((itemId) => ITEM_BY_ID[itemId])
    .filter((item): item is Item => Boolean(item));
}

export function usePokeFactoryGame(): GameViewModel {
  const initialSave = loadSaveData();
  const initialBattleResume = initialSave?.factory.battleResume.status === 'READY'
    ? initialSave.factory.battleResume
    : null;
  const initialEnemyTrainer = initialBattleResume?.currentEnemyTrainerId
    ? getFactoryTrainerTemplateById(initialBattleResume.currentEnemyTrainerId)
    : null;
  const devToolsAvailable = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEVTOOLS === '1';
  const [gameState, setGameState] = useState<GameState>('BOOT');
  const [developerMode, setDeveloperMode] = useState(() => {
    const saved = initialSave?.settings.developerMode ?? false;
    return devToolsAvailable ? saved : false;
  });
  const [startStep, setStartStep] = useState(0);
  const [coins, setCoins] = useState(initialBattleResume?.coins ?? 0);
  const [shopItems, setShopItems] = useState<{ item: Item; price: number }[]>([]);
  const [rewardChoiceMade, setRewardChoiceMade] = useState(false);
  const [rerollCount, setRerollCount] = useState(0);
  const [teamCapacity, setTeamCapacity] = useState(3);
  const [playerTeam, setPlayerTeam] = useState<GamePokemon[]>(initialBattleResume?.playerTeam ?? []);
  const [rewards, setRewards] = useState<GameReward[]>([]);
  const [activeBuffs, setActiveBuffs] = useState(initialBattleResume?.activeBuffs ?? { atk: false, def: false });
  const [enemyBuffs, setEnemyBuffs] = useState(initialBattleResume?.enemyBuffs ?? { atk: false, def: false });
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
  const [bootProgress, setBootProgress] = useState(0);
  const [bootStatusText, setBootStatusText] = useState('');
  const [inventory, setInventory] = useState<Item[]>(() => hydrateInventoryFromItemIds(initialBattleResume?.inventoryItemIds ?? []));
  const [stage, setStage] = useState(initialBattleResume?.stage ?? 1);
  const [enemy, setEnemy] = useState<GamePokemon | null>(initialBattleResume?.enemyTeam[0] ?? null);
  const [enemyTeam, setEnemyTeam] = useState<GamePokemon[]>(initialBattleResume?.enemyTeam ?? []);
  const [currentEnemyTrainer, setCurrentEnemyTrainer] = useState<FactoryTrainerTemplate | null>(initialEnemyTrainer);
  const [streak, setStreak] = useState(initialBattleResume?.streak ?? 0);
  const [swapCount, setSwapCount] = useState(initialBattleResume?.swapCount ?? 0);
  const [totalRents, setTotalRents] = useState(initialBattleResume?.totalRents ?? initialSave?.progress.totalRents ?? 0);
  const [specialModeUnlocked, setSpecialModeUnlocked] = useState(initialBattleResume?.specialModeUnlocked ?? initialSave?.progress.specialModeUnlocked ?? false);
  const [specialBossBattleActive, setSpecialBossBattleActive] = useState(initialBattleResume?.specialBossBattleActive ?? false);
  const [battleSpecialUsage, setBattleSpecialUsage] = useState<BattleSpecialUsageState>(initialBattleResume?.battleSpecialUsage ?? EMPTY_BATTLE_SPECIAL_USAGE);
  const [enemySpecialUsage, setEnemySpecialUsage] = useState<BattleSpecialUsageState>(initialBattleResume?.enemySpecialUsage ?? EMPTY_BATTLE_SPECIAL_USAGE);
  const [enemyAiTier, setEnemyAiTier] = useState<FactoryAiTier>(
    initialBattleResume?.enemyAiTier ?? getAiTier(1, FACTORY_REWARD_CONFIG.battlesPerSet),
  );
  const [roundResult, setRoundResult] = useState<RoundResult>(null);
  const [lastTokenGain, setLastTokenGain] = useState(0);
  const [factoryRentals, setFactoryRentals] = useState<GamePokemon[]>(initialBattleResume?.factoryRentals ?? []);
  const [selectedRentalIndices, setSelectedRentalIndices] = useState<number[]>(initialBattleResume?.selectedRentalIndices ?? []);
  const [battleLog, setBattleLog] = useState<string[]>(initialBattleResume?.battleLog ?? []);
  const [turn, setTurn] = useState<'PLAYER' | 'ENEMY'>(initialBattleResume?.turn ?? 'PLAYER');
  const [battleMenuTab, setBattleMenuTab] = useState<BattleMenuTab>(initialBattleResume?.battleMenuTab ?? 'MAIN');
  const [weather, setWeather] = useState<Weather>(initialBattleResume?.weather ?? 'none');
  const [weatherTurns, setWeatherTurns] = useState(initialBattleResume?.weatherTurns ?? 0);
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
  const [pendingBattleResumeRestore, setPendingBattleResumeRestore] = useState(Boolean(initialBattleResume));
  const [starterName] = useState('Pikachu');
  const [starterBondLevel] = useState(1);
  const [availableEggCount] = useState(0);
  const [activeEventCount] = useState(EVENT_REGIONS.length);
  const [shopUnlocked] = useState(true);
  const [breedingUnlocked] = useState(true);
  const [collectionUnlocked] = useState(true);
  const [eventsUnlocked] = useState(true);
  const [eventDispatches, setEventDispatches] = useState(() => {
    const saved = initialSave?.events.dispatches ?? {};
    const base = Object.fromEntries(EVENT_REGIONS.map((region) => [region.id, createDefaultDispatchState()]));
    const merged = { ...base, ...saved };
    const now = Date.now();
    for (const region of EVENT_REGIONS) {
      const dispatch = merged[region.id];
      if (dispatch?.status === 'RUNNING' && dispatch.readyAt !== null && dispatch.readyAt <= now) {
        merged[region.id] = { ...dispatch, status: 'READY' };
      }
    }
    return merged;
  });
  const [eventSpeciesBattleCounts, setEventSpeciesBattleCounts] = useState<Record<string, number>>(initialSave?.events.speciesBattleCounts ?? {});
  const [eventDispatchPokemonByRegion, setEventDispatchPokemonByRegion] = useState<Record<string, number | null>>(() => {
    const saved = initialSave?.events.dispatchPokemonByRegion ?? {};
    const base = Object.fromEntries(EVENT_REGIONS.map((region) => [region.id, null as number | null]));
    return { ...base, ...saved };
  });
  const [eventDispatchPopup, setEventDispatchPopup] = useState<EventDispatchPopup | null>(null);
  const [eventBattleActive, setEventBattleActive] = useState(false);
  const [highestStreak, setHighestStreak] = useState(initialSave?.progress.highestStreak ?? 0);
  const [collectionLedger, setCollectionLedger] = useState<CollectionLedger>(() => ({
    seenIds: initialSave?.collection?.seenIds ?? [],
    ownedIds: initialSave?.collection?.ownedIds ?? [],
    formKeys: normalizeStoredFormKeys(initialSave?.collection?.formKeys ?? []),
  }));

  const { t, getLocalized, getLocalizedDesc, getLocalizedNature, getStatName } = useGameLocalization(currentLanguage);
  const canEnterProject = bootProgress >= BOOT_ENTER_THRESHOLD;
  const battleResumeSnapshotRef = useRef<BattleResumeSnapshot | null>(initialBattleResume);

  const buildStableFactoryBattleResume = useCallback((): BattleResumeSnapshot | null => {
    if (eventBattleActive || gameState !== 'BATTLE') return null;
    if (turn !== 'PLAYER' || isMessageProcessing || loading || isTransitioning) return null;
    if (playerAnim !== 'idle' || enemyAnim !== 'idle' || activeMoveType !== null) return null;
    if (isCatching || showReplaceUI !== null) return null;
    if (playerTeam.length === 0 || enemyTeam.length === 0 || !currentEnemyTrainer) return null;

    return {
      status: 'READY',
      battleKind: 'FACTORY',
      checkpointAt: new Date().toISOString(),
      stage,
      streak,
      swapCount,
      coins,
      totalRents,
      enemyAiTier,
      specialModeUnlocked,
      specialBossBattleActive,
      battleSpecialUsage,
      enemySpecialUsage,
      turn,
      battleMenuTab,
      weather,
      weatherTurns,
      activeBuffs,
      enemyBuffs,
      factoryRentals,
      selectedRentalIndices,
      playerTeam,
      enemyTeam,
      currentEnemyTrainerId: currentEnemyTrainer.id,
      inventoryItemIds: inventory.map((item) => item.id),
      battleLog,
    };
  }, [
    activeBuffs,
    activeMoveType,
    battleLog,
    battleMenuTab,
    battleSpecialUsage,
    coins,
    currentEnemyTrainer,
    enemyAiTier,
    enemyAnim,
    enemyBuffs,
    enemySpecialUsage,
    enemyTeam,
    eventBattleActive,
    factoryRentals,
    gameState,
    inventory,
    isCatching,
    isMessageProcessing,
    isTransitioning,
    loading,
    playerAnim,
    playerTeam,
    selectedRentalIndices,
    showReplaceUI,
    specialBossBattleActive,
    specialModeUnlocked,
    stage,
    streak,
    swapCount,
    totalRents,
    turn,
    weather,
    weatherTurns,
  ]);

  const getPersistableBattleResume = useCallback(() => {
    const stableSnapshot = buildStableFactoryBattleResume();
    if (stableSnapshot) {
      return stableSnapshot;
    }
    if (pendingBattleResumeRestore && battleResumeSnapshotRef.current) {
      return battleResumeSnapshotRef.current;
    }
    if (!eventBattleActive && gameState === 'BATTLE' && battleResumeSnapshotRef.current) {
      return battleResumeSnapshotRef.current;
    }
    return createEmptyBattleResume();
  }, [buildStableFactoryBattleResume, eventBattleActive, gameState, pendingBattleResumeRestore]);

  const handleSuppressedBattleResolved = useCallback((_result: 'WIN' | 'LOSS') => {
    if (!eventBattleActive) return;
    setRoundResult(null);
    setLastTokenGain(0);
    setEnemy(null);
    setEnemyTeam([]);
    setCurrentEnemyTrainer(null);
    setBattleLog([]);
    setTurn('PLAYER');
    setBattleMenuTab('MAIN');
    setSpecialBossBattleActive(false);
    setBattleSpecialUsage(EMPTY_BATTLE_SPECIAL_USAGE);
    setEnemySpecialUsage(EMPTY_BATTLE_SPECIAL_USAGE);
    setCatchSuccess(null);
    setGameState('EVENTS');
    setEventBattleActive(false);
  }, [eventBattleActive]);

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
    enemySpecialUsage,
    allowWildCatch: eventBattleActive,
    suppressFactoryBattleResult: eventBattleActive,
    onSuppressBattleResolved: handleSuppressedBattleResolved,
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
    setEnemySpecialUsage,
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
    setEnemySpecialUsage,
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
  const {
    prefetchRentals,
    prefetchEnemy,
    exportUsedTrainerIdsBySet,
    importUsedTrainerIdsBySet,
  } = factoryFlow;

  useEffect(() => {
    importUsedTrainerIdsBySet(initialSave?.factory.trainerIdsBySet ?? []);
  }, [importUsedTrainerIdsBySet, initialSave?.factory.trainerIdsBySet]);

  useEffect(() => {
    const stableSnapshot = buildStableFactoryBattleResume();
    if (!stableSnapshot) return;
    battleResumeSnapshotRef.current = stableSnapshot;
  }, [buildStableFactoryBattleResume]);

  useEffect(() => {
    if (pendingBattleResumeRestore) return;
    if (eventBattleActive || gameState !== 'BATTLE') {
      battleResumeSnapshotRef.current = null;
    }
  }, [eventBattleActive, gameState, pendingBattleResumeRestore]);

  useEffect(() => {
    if (!pendingBattleResumeRestore || !canEnterProject || gameState !== 'START') return;
    setPendingBattleResumeRestore(false);
    setGameState('BATTLE');
  }, [canEnterProject, gameState, pendingBattleResumeRestore]);

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
    if (!eventBattleActive || !catchSuccess || !enemy) return;
    setCollectionLedger((prev) => {
      const seen = new Set(prev.seenIds);
      const owned = new Set(prev.ownedIds);
      seen.add(enemy.id);
      owned.add(enemy.id);
      return {
        ...prev,
        seenIds: [...seen].sort((a, b) => Number(a) - Number(b)),
        ownedIds: [...owned].sort((a, b) => Number(a) - Number(b)),
      };
    });
  }, [catchSuccess, enemy, eventBattleActive]);

  useEffect(() => {
    if (gameState !== 'START') return;
    void prefetchRentals();
  }, [gameState, prefetchRentals]);

  useEffect(() => {
    let cancelled = false;
    let progressValue = 0;
    const setProgress = (value: number) => {
      progressValue = Math.max(progressValue, Math.min(100, value));
      if (!cancelled) setBootProgress(progressValue);
    };

    void (async () => {
      setBootStatusText(t('bootPreparingRentalPool'));
      setProgress(10);
      try {
        await prefetchRentals();
      } catch {
        // Allow degraded startup if rental prefetch fails.
      }
      setProgress(30);

      setBootStatusText(t('bootPreparingEnemyPreview'));
      try {
        await prefetchEnemy(1);
      } catch {
        // Allow degraded startup if enemy prefetch fails.
      }
      setProgress(45);

      setBootStatusText(t('bootPreparingPokedexIndex'));
      try {
        await Promise.all([
          fetchDexCatalogEntries(),
          fetchDexTypeMap(),
        ]);
      } catch {
        // Allow degraded startup if Pokedex prefetch fails.
      }
      setProgress(70);

      setBootStatusText(t('bootPreparingDexSnapshots'));
      try {
        await fetchDexSnapshots([1, 4, 7, 25, 39, 94, 133, 150, 245, 249, 384, 493, 722, 810, 905]);
      } catch {
        // Allow degraded startup if snapshot prefetch fails.
      }
      setProgress(84);

      setBootStatusText(t('bootPreparingMoveIndex'));
      try {
        await fetchDexMoveDetails([
          'tackle',
          'quick-attack',
          'thunderbolt',
          'ice-beam',
          'flamethrower',
          'surf',
          'earthquake',
          'psychic',
          'shadow-ball',
          'dragon-claw',
          'close-combat',
          'moonblast',
          'dark-pulse',
          'iron-head',
          'energy-ball',
          'stone-edge',
          'u-turn',
          'protect',
          'toxic',
          'swords-dance',
        ]);
      } catch {
        // Allow degraded startup if move index prefetch fails.
      }
      setProgress(92);

      setBootStatusText(t('bootFinalizingStartup'));
      await new Promise((resolve) => setTimeout(resolve, 120));
      setProgress(100);
      if (!cancelled) {
        setBootStatusText(t('bootReady'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [prefetchEnemy, prefetchRentals, t]);

  useEffect(() => {
    if (streak > highestStreak) {
      setHighestStreak(streak);
    }
  }, [highestStreak, streak]);

  useEffect(() => {
    if (gameState !== 'EVENTS') {
      setEventDispatchPopup(null);
    }
  }, [gameState]);

  const buildCurrentSaveData = useCallback(() => {
    const levelModeIsOpen = startLevel > 50;
    const activeFlag = levelModeIsOpen ? STREAK_FACTORY_SINGLES_OPEN : STREAK_FACTORY_SINGLES_50;
    const challengeActive = CHALLENGE_ACTIVE_STATES.includes(gameState);
    const winStreakActiveFlags = challengeActive || hasFactoryRunToResume ? activeFlag : 0;
    const winStreakActiveMasks = (WIN_STREAK_ACTIVE_MASK_DEFAULT & (~activeFlag >>> 0)) >>> 0;
    const curChallengeBattleNum = Math.max(0, Math.min(FACTORY_REWARD_CONFIG.battlesPerSet - 1, (stage - 1) % FACTORY_REWARD_CONFIG.battlesPerSet));
    const battleResume = getPersistableBattleResume();

    return createSaveData({
      totalRents,
      highestStreak,
      specialModeUnlocked,
      currentLanguage,
      selectedGens,
      startLevel,
      developerMode: devToolsAvailable ? developerMode : false,
      factory: {
        challengeStatus: challengeActive ? 1 : 0,
        curChallengeBattleNum,
        challengePaused: !challengeActive && hasFactoryRunToResume,
        disableRecordBattle: false,
        winStreakActiveFlags,
        winStreakActiveMasks,
        trainerIdsBySet: exportUsedTrainerIdsBySet(),
        battleResume,
      },
      events: {
        speciesBattleCounts: eventSpeciesBattleCounts,
        dispatchPokemonByRegion: eventDispatchPokemonByRegion,
        dispatches: eventDispatches,
      },
      collection: collectionLedger,
    });
  }, [
    collectionLedger,
    currentLanguage,
    developerMode,
    devToolsAvailable,
    eventDispatches,
    eventDispatchPokemonByRegion,
    eventSpeciesBattleCounts,
    exportUsedTrainerIdsBySet,
    getPersistableBattleResume,
    gameState,
    hasFactoryRunToResume,
    highestStreak,
    selectedGens,
    specialModeUnlocked,
    stage,
    startLevel,
    totalRents,
  ]);

  useEffect(() => {
    persistSaveData(buildCurrentSaveData());
  }, [buildCurrentSaveData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const persistCurrentState = () => {
      persistSaveData(buildCurrentSaveData());
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistCurrentState();
      }
    };

    window.addEventListener('beforeunload', persistCurrentState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', persistCurrentState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
    setBattleSpecialUsage({ MEGA: false, DYNAMAX: false, TERA: false, ZMOVE: false });
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
    if (!canEnterProject) return;
    setHasFactoryRunToResume(false);
    setPendingRunSummary(null);
    setTeamCapacity(3);
    setPendingTmMove(null);
    setPendingTmLearnerIndexes([]);
    setPendingEvolutionEligibleIndexes([]);
    await factoryFlow.startGame();
  }, [canEnterProject, factoryFlow]);

  const quickStartDevBattle = useCallback(async () => {
    if (!canEnterProject) return;
    setHasFactoryRunToResume(false);
    setPendingRunSummary(null);
    setTeamCapacity(3);
    setPendingTmMove(null);
    setPendingTmLearnerIndexes([]);
    setPendingEvolutionEligibleIndexes([]);
    await factoryFlow.quickStartDevBattle();
  }, [canEnterProject, factoryFlow]);

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
  const setEventDispatchPokemon = useCallback((regionId: string, pokemonId: number | null) => {
    if (!EVENT_REGIONS.some((region) => region.id === regionId)) return;
    setEventDispatchPokemonByRegion((prev) => ({ ...prev, [regionId]: pokemonId }));
  }, []);

  const autoPickDispatchPokemon = useCallback(async (regionId: string) => {
    const region = EVENT_REGIONS.find((entry) => entry.id === regionId);
    if (!region) return null;
    const ownedIds = [...collectionLedger.ownedIds];
    if (ownedIds.length === 0) return null;
    const shuffled = ownedIds.sort(() => Math.random() - 0.5);
    for (const pokemonId of shuffled) {
      try {
        const data = await fetchPokemon(pokemonId);
        const types = data.types.map((slot) => slot.type.name);
        if (region.requiredTypes.some((type) => types.includes(type))) {
          return pokemonId;
        }
      } catch {
        continue;
      }
    }
    return null;
  }, [collectionLedger.ownedIds]);

  const pickSpecialSiteEncounter = useCallback((regionId: string) => {
    const region = EVENT_REGIONS.find((entry) => entry.id === regionId);
    if (!region || region.specialSites.length === 0) return null;
    const candidates = region.specialSites.filter((site) => site.speciesPool.length > 0);
    if (candidates.length === 0) return null;
    const totalWeight = candidates.reduce((sum, site) => sum + (site.weight ?? 1), 0);
    let roll = Math.random() * totalWeight;
    const site = candidates.find((entry) => {
      roll -= (entry.weight ?? 1);
      return roll <= 0;
    }) ?? candidates[candidates.length - 1];
    if (!site) return null;
    const speciesId = site.speciesPool[Math.floor(Math.random() * site.speciesPool.length)];
    if (!speciesId) return null;
    return { site, speciesId } as const;
  }, []);

  const resolveDispatchRegion = useCallback(async (regionId: string) => {
    const region = EVENT_REGIONS.find((entry) => entry.id === regionId);
    if (!region) return 'Dispatch failed';

    const selectedPokemonId = eventDispatchPokemonByRegion[regionId];
    if (!selectedPokemonId) return 'Select a Pokedex-owned Pokemon first';

    const selectedPokemonData = await fetchPokemon(selectedPokemonId);
    const selectedTypes = selectedPokemonData.types.map((slot) => slot.type.name);
    const matched = region.requiredTypes.some((type) => selectedTypes.includes(type));
    if (!matched) {
      return `${region.name}: Selected Pokemon does not match region type filter`;
    }

    const roll = Math.random();
    const outcome: 'item' | 'join' | 'battle' = roll < 0.58 ? 'item' : roll < 0.88 ? 'join' : 'battle';
    if (outcome === 'item') {
      const growthPool = ALL_ITEMS.filter((item) => ['protein', 'iron', 'calcium', 'zinc_item', 'carbos', 'hp_up'].includes(item.id));
      const rewardItem = growthPool[Math.floor(Math.random() * growthPool.length)] ?? ALL_ITEMS[0];
      setInventory((prev) => [...prev, rewardItem]);
      setEventDispatchPopup({
        kind: 'ITEM',
        title: `${region.name}派遣完成`,
        message: '侦察队带回了珍贵补给，已自动放入背包。',
        itemName: getLocalized(rewardItem),
        itemId: rewardItem.id,
      });
      return `${region.name}: Gained growth item ${getLocalized(rewardItem)}`;
    }

    const [dexMin, dexMax] = region.dexRange;
    const regionalPool = Array.from({ length: dexMax - dexMin + 1 }, (_, index) => dexMin + index);
    const sampledBaseSpecies: number[] = [];
    const maxAttempts = Math.min(80, regionalPool.length);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = regionalPool[Math.floor(Math.random() * regionalPool.length)];
      if (!candidate) continue;
      if (await isEvolutionChainBaseSpecies(candidate)) {
        sampledBaseSpecies.push(candidate);
      }
    }
    const initialFormPool = [...new Set(sampledBaseSpecies)];
    if (initialFormPool.length === 0) {
      return `${region.name}: No valid base-form species in regional dex`;
    }
    const rarePool = RARE_SPECIES_POOL.filter((speciesId) => (
      speciesId >= dexMin
      && speciesId <= dexMax
      && initialFormPool.includes(speciesId)
    ));
    const useRarePool = region.category === 'rare_hunt' && rarePool.length > 0;
    const commonTargetPool = useRarePool ? rarePool : initialFormPool;

    if (outcome === 'join') {
      const joinIdentifier = commonTargetPool[Math.floor(Math.random() * commonTargetPool.length)];
      if (!joinIdentifier) return `${region.name}: Failed to generate target`;
      const targetPokemon = await getProcessedPokemon(joinIdentifier, Math.max(20, startLevel));
      const ballIndex = inventory.findIndex((item) => item.isBall);
      if (ballIndex < 0) return `${region.name}: No Pokeball`;

      setInventory((prev) => {
        const next = [...prev];
        next.splice(ballIndex, 1);
        return next;
      });

      setCollectionLedger((prev) => {
        const seen = new Set(prev.seenIds);
        const owned = new Set(prev.ownedIds);
        seen.add(targetPokemon.id);
        owned.add(targetPokemon.id);
        return {
          ...prev,
          seenIds: [...seen].sort((a, b) => Number(a) - Number(b)),
          ownedIds: [...owned].sort((a, b) => Number(a) - Number(b)),
        };
      });

      setPlayerTeam((prev) => (prev.length < 6 ? [...prev, targetPokemon] : prev));
      setEventDispatchPopup({
        kind: 'POKEMON',
        title: `${region.name}奇遇成功`,
        message: '目标宝可梦认可了你的队伍，主动申请加入。',
        pokemonName: getLocalized(targetPokemon),
        pokemonSprite: targetPokemon.sprites.front_default ?? '',
        pokemonLevel: targetPokemon.level,
      });
      return `${region.name}: ${getLocalized(targetPokemon)} joined directly`;
    }

    if (!inventory.some((item) => item.isBall)) {
      return `${region.name}: No Pokeball`;
    }

    const specialEncounter = pickSpecialSiteEncounter(regionId);
    const battleIdentifier = specialEncounter?.speciesId ?? commonTargetPool[Math.floor(Math.random() * commonTargetPool.length)];
    if (!battleIdentifier) return `${region.name}: Failed to generate encounter`;
    const battleLevel = Math.max(20, specialEncounter?.site.minLevel ?? startLevel);
    const targetPokemon = await getProcessedPokemon(battleIdentifier, battleLevel);

    setCatchSuccess(null);
    setEventBattleActive(true);
    setEnemyTeam([targetPokemon]);
    setEnemy(targetPokemon);
    setBattleLog([]);
    setTurn('PLAYER');
    setBattleMenuTab('MAIN');
    setGameState('BATTLE');
    if (specialEncounter) {
      return `${region.name}: 特殊事件地点 ${specialEncounter.site.name}，遭遇 ${getLocalized(targetPokemon)}`;
    }
    return `${region.name}: 遭遇战斗 ${getLocalized(targetPokemon)}`;
  }, [
    eventDispatchPokemonByRegion,
    getLocalized,
    inventory,
    pickSpecialSiteEncounter,
    setEventDispatchPopup,
    startLevel,
  ]);

  const dispatchEventRegion = useCallback(async (regionId: string) => {
    const region = EVENT_REGIONS.find((entry) => entry.id === regionId);
    if (!region) return;

    const now = Date.now();
    const current = eventDispatches[regionId] ?? createDefaultDispatchState();
    const isReady = current.status === 'READY' || (current.status === 'RUNNING' && current.readyAt !== null && current.readyAt <= now);

    if (!isReady && current.status === 'RUNNING') return;

    if (!isReady) {
      let selectedPokemonId = eventDispatchPokemonByRegion[regionId] ?? null;
      if (!selectedPokemonId) {
        selectedPokemonId = await autoPickDispatchPokemon(regionId);
        if (selectedPokemonId) {
          setEventDispatchPokemonByRegion((prev) => ({ ...prev, [regionId]: selectedPokemonId }));
        }
      }
      if (!selectedPokemonId) {
        setEventDispatches((prev) => ({
          ...prev,
          [regionId]: {
            ...current,
            status: 'IDLE',
            lastResolvedAt: now,
            lastResult: `${region.name}: 无可派遣的图鉴宝可梦`,
          },
        }));
        return;
      }
      setEventDispatches((prev) => ({
        ...prev,
        [regionId]: {
          ...current,
          status: 'RUNNING',
          startedAt: now,
          readyAt: now + (region.dispatchHours * 60 * 60 * 1000),
        },
      }));
      return;
    }

    const resultText = await resolveDispatchRegion(regionId);
    const resolvedAt = Date.now();
    setEventDispatches((prev) => ({
      ...prev,
      [regionId]: {
        ...createDefaultDispatchState(),
        lastResolvedAt: resolvedAt,
        lastResult: resultText,
      },
    }));
  }, [autoPickDispatchPokemon, eventDispatchPokemonByRegion, eventDispatches, resolveDispatchRegion]);

  const mockEventDispatchResult = useCallback((regionId: string, outcome: 'item' | 'join' | 'battle_special') => {
    if (!developerMode) return;
    const region = EVENT_REGIONS.find((entry) => entry.id === regionId);
    if (!region) return;

    if (outcome === 'item') {
      setEventDispatchPopup({
        kind: 'ITEM',
        title: `${region.name}派遣完成（Mock）`,
        message: '测试投放：一份成长补给已加入背包预览。',
        itemName: '体力增强剂',
        itemId: 'hp_up',
      });
    }

    if (outcome === 'join') {
      const mockPokemonId = eventDispatchPokemonByRegion[regionId] ?? region.dexRange[0];
      const level = Math.max(20, startLevel);
      void fetchPokemon(mockPokemonId)
        .then((pokemon) => {
          setEventDispatchPopup({
            kind: 'POKEMON',
            title: `${region.name}奇遇成功（Mock）`,
            message: '测试投放：宝可梦加入弹窗展示。',
            pokemonName: getLocalized(pokemon),
            pokemonSprite: pokemon.sprites?.front_default || getPokemonSpriteUrl(mockPokemonId),
            pokemonLevel: level,
          });
        })
        .catch(() => {
          setEventDispatchPopup({
            kind: 'POKEMON',
            title: `${region.name}奇遇成功（Mock）`,
            message: '测试投放：宝可梦加入弹窗展示。',
            pokemonName: '未知宝可梦',
            pokemonSprite: getPokemonSpriteUrl(mockPokemonId),
            pokemonLevel: level,
          });
        });
    }

    const firstSite = region.specialSites[0];
    const resultText = outcome === 'item'
      ? `${region.name}: 获得成长道具 体力增强剂（Mock）`
      : outcome === 'join'
        ? `${region.name}: 宝可梦已直接加入（Mock）`
        : `${region.name}: 特殊事件地点 ${firstSite?.name ?? '未知地点'}，遭遇战斗（Mock）`;

    setEventDispatches((prev) => ({
      ...prev,
      [regionId]: {
        ...createDefaultDispatchState(),
        lastResolvedAt: Date.now(),
        lastResult: resultText,
      },
    }));
  }, [developerMode, eventDispatchPokemonByRegion, getLocalized, startLevel]);

  const closeEventDispatchPopup = useCallback(() => {
    setEventDispatchPopup(null);
  }, []);

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
      setEventSpeciesBattleCounts(parsed.events.speciesBattleCounts);
      setEventDispatchPokemonByRegion(() => {
        const base = Object.fromEntries(EVENT_REGIONS.map((region) => [region.id, null as number | null]));
        return { ...base, ...parsed.events.dispatchPokemonByRegion };
      });
      setEventDispatches(() => {
        const base = Object.fromEntries(EVENT_REGIONS.map((region) => [region.id, createDefaultDispatchState()]));
        return { ...base, ...parsed.events.dispatches };
      });

      setCollectionLedger(normalizedCollection);
      importUsedTrainerIdsBySet(parsed.factory.trainerIdsBySet);
      persistSaveData(normalizedParsed);

      return {
        ok: true,
        message: 'Save imported successfully.',
      };
    } catch (error) {
      console.error('Import save failed', error);
      return {
        ok: false,
        message: 'Invalid save format. Import failed.',
      };
    }
  }, [devToolsAvailable, importUsedTrainerIdsBySet]);

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
    bootProgress,
    canEnterProject,
    bootStatusText,
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
    eventDispatches,
    eventDispatchPokemonByRegion,
    eventDispatchPopup,
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
    setEventDispatchPokemon,
    dispatchEventRegion,
    mockEventDispatchResult,
    closeEventDispatchPopup,
  } satisfies GameViewModel;

  return viewModel;
}


