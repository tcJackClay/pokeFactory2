/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BattleMenuTab, FieldState, FieldTurns, GamePokemon, GameState, Item, Move, Pokemon, Weather } from '../../../types';
import { ALL_ITEMS } from '../../../uiAppConstants';
import { fetchPokemon, getProcessedPokemon, isEvolutionChainBaseSpecies } from '../../../services/pokeApi';
import { getAiTier } from '../config/factoryBattle';
import { FACTORY_REWARD_CONFIG, getFactoryRewardChoiceCount } from '../config/factoryRewards';
import { canAdvanceClassicStage, createClassicActionGate, getClassicPostBattleDestination } from '../config/classicFlow';
import { EVENT_REGIONS, IV_TRAIN_BATTLE_THRESHOLD, RARE_SPECIES_POOL, createDefaultDispatchState } from '../config/events';
import { useGameLocalization } from './useGameLocalization';
import { useBattleController } from './useBattleController';
import { useFactoryFlow } from './useFactoryFlow';
import { hydrateTrainerHistoryOnce } from './factoryTrainerHistory';
import { hasRecoverableFactoryBaseCheckpoint, shouldReleaseFactoryBaseCheckpoint } from './factoryResumeCheckpoint';
import { useRewardFlow } from './useRewardFlow';
import { clearNonVolatileStatus, clearVolatileStatuses } from '../utils/battleStatus';
import { addEvToPokemon, addIvToPokemon, type StatKey } from '../utils/pokemonStats';
import {
  applyDispatchTrainingToTeam,
  getStatLabel,
  rollDispatchOutcome,
} from '../utils/eventDispatchRewards';
import { getFactoryTrainerTemplateById, type FactoryTrainerTemplate } from '../config/factoryTrainerTemplates';
import { FACTORY_BRAIN_TRAINER_ID } from '../config/factoryBrain';
import { isCompanionSpeciesId, type CompanionSpeciesId } from '../config/companionCandidates';
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
  PokemonInfoSource,
} from '../view-model';
import { getBattleIndexInSet, getSetNoByStage } from '../config/factoryRewards';
import {
  buildSaveExportFilename,
  bindCompanionToSave,
  beginFactoryWalletRun,
  endFactoryWalletRun,
  adjustWalletBalance,
  commitFactoryGroupSettlement,
  commitFactoryBattleStart,
  createEmptyBattleResume,
  createEmptyWallet,
  createSaveData,
  inspectStoredSave,
  loadPendingFactorySettlement,
  parseSaveDataFromText,
  persistSaveData,
  replaceSaveData,
  triggerJsonDownload,
  type BattleResumeSnapshot,
  type CollectionLedger,
  type FactoryWallet,
  type GameSaveData,
} from '../../../services/saveManager';
import { createPokemonFormLedgerKey, normalizeStoredFormKeys } from '../utils/formLedger';
import { getPokemonSpriteUrl } from '../../../services/pokeApiEndpoint';
import { rentalDuration, rentalNow, reportRentalPerformance } from '../performance/rentalPerformance';

const STREAK_FACTORY_SINGLES_50 = 1 << 8;
const STREAK_FACTORY_SINGLES_OPEN = 1 << 9;
const WIN_STREAK_ACTIVE_MASK_DEFAULT = 0xffffffff;
const CHALLENGE_ACTIVE_STATES: GameState[] = ['FACTORY_SELECT', 'FACTORY_SWAP', 'BATTLE', 'REWARD', 'ROUND_RESULT'];
const BOOT_ENTER_THRESHOLD = 80;
const EMPTY_BATTLE_SPECIAL_USAGE: BattleSpecialUsageState = { MEGA: false, DYNAMAX: false, TERA: false, ZMOVE: false };
const ITEM_BY_ID = Object.fromEntries(ALL_ITEMS.map((item) => [item.id, item] as const));
const EVENT_GROWTH_ITEM_IDS = ['protein', 'iron', 'calcium', 'zinc_item', 'carbos', 'hp_up'];
const EVENT_ITEM_LABELS: Record<string, string> = {
  protein: '攻击增强剂',
  iron: '防御增强剂',
  calcium: '特攻增强剂',
  zinc_item: '特防增强剂',
  carbos: '速度增强剂',
  hp_up: 'HP增强剂',
};
interface EventBattleContext {
  regionId: string;
  selectedPokemonId: number | null;
  targetPokemonId: number;
  specialSiteName?: string;
}

function hydrateInventoryFromItemIds(itemIds: string[]): Item[] {
  return itemIds
    .map((itemId) => ITEM_BY_ID[itemId])
    .filter((item): item is Item => Boolean(item));
}

export function usePokeFactoryGame(): GameViewModel {
  const [initialInspection] = useState(inspectStoredSave);
  const initialSave = initialInspection.kind === 'valid' ? initialInspection.save : null;
  const saveBlocked = initialInspection.kind !== 'none' && initialInspection.kind !== 'valid';
  const trainerHistoryHydratedRef = useRef(false);
  const initialBattleResume = initialSave?.factory.battleResume.status === 'READY'
    ? initialSave.factory.battleResume
    : null;
  const storedPendingSettlement = loadPendingFactorySettlement();
  const initialPendingSettlement = storedPendingSettlement
    && initialBattleResume
    && storedPendingSettlement.runId === initialSave?.wallet.currentRunId
    && storedPendingSettlement.stage === initialBattleResume.stage
    ? storedPendingSettlement
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
  const walletRef = useRef<FactoryWallet>(initialSave?.wallet ?? createEmptyWallet());
  const currentSaveBuilderRef = useRef<(() => GameSaveData) | null>(null);
  const [coins, setCoins] = useState(walletRef.current.balance);
  const [shopItems, setShopItems] = useState<{ item: Item; price: number }[]>([]);
  const [rewardChoiceMade, setRewardChoiceMade] = useState(false);
  const [rerollCount, setRerollCount] = useState(0);
  const [teamCapacity, setTeamCapacity] = useState(3);
  const [playerTeam, setPlayerTeam] = useState<GamePokemon[]>(initialBattleResume?.playerTeam ?? []);
  const [rewards, setRewards] = useState<GameReward[]>([]);
  const [activeBuffs, setActiveBuffs] = useState(initialBattleResume?.activeBuffs ?? { atk: false, def: false });
  const [enemyBuffs, setEnemyBuffs] = useState(initialBattleResume?.enemyBuffs ?? { atk: false, def: false });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [trainerIntroActive, setTrainerIntroActive] = useState(false);
  const [trainerIntroAwaitingContinue, setTrainerIntroAwaitingContinue] = useState(false);
  const [isMessageProcessing, setIsMessageProcessing] = useState(false);
  const [showReplaceUI, setShowReplaceUI] = useState<GamePokemon | null>(null);
  const [learningPokemonIdx, setLearningPokemonIdx] = useState<number | null>(null);
  const [potentialMoves, setPotentialMoves] = useState<Move[]>([]);
  const [selectedNewMove, setSelectedNewMove] = useState<Move | null>(null);
  const [pendingTmMove, setPendingTmMove] = useState<Move | null>(null);
  const [pendingTmLearnerIndexes, setPendingTmLearnerIndexes] = useState<number[]>([]);
  const [pendingEvolutionEligibleIndexes, setPendingEvolutionEligibleIndexes] = useState<number[]>([]);
  const [selectedGens, setSelectedGens] = useState<number[]>(
    () => [initialSave?.settings.selectedGens?.[0] ?? 1],
  );
  const [startLevel, setStartLevel] = useState(initialSave?.settings.startLevel ?? 50);
  const [hoveredMove, setHoveredMove] = useState<Move | null>(null);
  const [infoPokemonIdx, setInfoPokemonIdx] = useState<number | null>(null);
  const [infoPokemonSource, setInfoPokemonSource] = useState<PokemonInfoSource>('PLAYER');
  const [prevGameState, setPrevGameState] = useState<GameState>('BASE');
  const [showLogHistory, setShowLogHistory] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(initialSave?.settings.currentLanguage ?? 'zh-hans');
  const [pendingRewardAction, setPendingRewardAction] = useState<'MOVE' | 'EVOLUTION' | null>(null);
  const [loading, setLoading] = useState(false);
  const [rentalLoadError, setRentalLoadError] = useState<string | null>(null);
  const [bootProgress, setBootProgress] = useState(0);
  const [bootStatusText, setBootStatusText] = useState('');
  const [inventory, setInventory] = useState<Item[]>(() => hydrateInventoryFromItemIds(initialBattleResume?.inventoryItemIds ?? []));
  const [stage, setStage] = useState(initialBattleResume?.stage ?? 1);
  const [enemy, setEnemy] = useState<GamePokemon | null>(initialBattleResume?.enemyTeam[0] ?? null);
  const [enemyTeam, setEnemyTeam] = useState<GamePokemon[]>(initialBattleResume?.enemyTeam ?? []);
  const [currentEnemyTrainer, setCurrentEnemyTrainer] = useState<FactoryTrainerTemplate | null>(initialEnemyTrainer);
  const [nextEnemyPreviewTeam, setNextEnemyPreviewTeam] = useState<GamePokemon[]>([]);
  const [nextEnemyPreviewTrainer, setNextEnemyPreviewTrainer] = useState<FactoryTrainerTemplate | null>(null);
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
  const [roundResult, setRoundResult] = useState<RoundResult>(initialBattleResume?.roundResult ?? null);
  const [lastTokenGain, setLastTokenGain] = useState(initialBattleResume?.lastBpGain ?? 0);
  const [factoryRentals, setFactoryRentals] = useState<GamePokemon[]>(initialBattleResume?.factoryRentals ?? []);
  const [selectedRentalIndices, setSelectedRentalIndices] = useState<number[]>(initialBattleResume?.selectedRentalIndices ?? []);
  const [battleLog, setBattleLog] = useState<string[]>(initialBattleResume?.battleLog ?? []);
  const [turn, setTurn] = useState<'PLAYER' | 'ENEMY'>(initialBattleResume?.turn ?? 'PLAYER');
  const [battleMenuTab, setBattleMenuTab] = useState<BattleMenuTab>(initialBattleResume?.battleMenuTab ?? 'MAIN');
  const [weather, setWeather] = useState<Weather>(initialBattleResume?.weather ?? 'none');
  const [weatherTurns, setWeatherTurns] = useState(initialBattleResume?.weatherTurns ?? 0);
  const [fieldState, setFieldState] = useState<FieldState[]>(initialBattleResume?.fieldState ?? []);
  const [fieldTurns, setFieldTurns] = useState<FieldTurns>(initialBattleResume?.fieldTurns ?? {});
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
  const [hasFactoryRunToResume, setHasFactoryRunToResume] = useState(
    hasRecoverableFactoryBaseCheckpoint(initialBattleResume, initialSave?.wallet.currentRunId),
  );
  const [pendingBattleResumeRestore, setPendingBattleResumeRestore] = useState(Boolean(initialBattleResume));
  const [companionSpeciesId, setCompanionSpeciesId] = useState<CompanionSpeciesId | null>(initialSave?.progress.companionSpeciesId ?? null);
  const companionCommittedRef = useRef<CompanionSpeciesId | null>(initialSave?.progress.companionSpeciesId ?? null);
  const companionConfirmingRef = useRef(false);
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
  const [eventBattleContext, setEventBattleContext] = useState<EventBattleContext | null>(null);
  const [highestStreak, setHighestStreak] = useState(initialSave?.progress.highestStreak ?? 0);
  const [collectionLedger, setCollectionLedger] = useState<CollectionLedger>(() => ({
    seenIds: initialSave?.collection?.seenIds ?? [],
    ownedIds: initialSave?.collection?.ownedIds ?? [],
    formKeys: normalizeStoredFormKeys(initialSave?.collection?.formKeys ?? []),
  }));

  const { t, getLocalized, getLocalizedDesc, getLocalizedNature, getStatName } = useGameLocalization(currentLanguage);
  const canEnterProject = bootProgress >= BOOT_ENTER_THRESHOLD;
  const battleResumeSnapshotRef = useRef<BattleResumeSnapshot | null>(initialBattleResume);
  const factoryResumeActiveRef = useRef(hasFactoryRunToResume);
  factoryResumeActiveRef.current = hasFactoryRunToResume;
  const classicAdvanceGateRef = useRef(createClassicActionGate());
  const handledRoundResultRef = useRef<string | null>(null);

  const buildStableFactoryBattleResume = useCallback((): BattleResumeSnapshot | null => {
    if (eventBattleActive || gameState !== 'BATTLE') return null;
    if (turn !== 'PLAYER' || isMessageProcessing || loading || isTransitioning || trainerIntroActive || trainerIntroAwaitingContinue) return null;
    if (playerAnim !== 'idle' || enemyAnim !== 'idle' || activeMoveType !== null) return null;
    if (isCatching || showReplaceUI !== null) return null;
    if (playerTeam.length === 0 || enemyTeam.length === 0 || !currentEnemyTrainer) return null;
    if (playerTeam.every((pokemon) => pokemon.currentHp <= 0) || enemyTeam.every((pokemon) => pokemon.currentHp <= 0)) return null;

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
      fieldState,
      fieldTurns,
      activeBuffs,
      enemyBuffs,
      factoryRentals,
      selectedRentalIndices,
      playerTeam,
      enemyTeam,
      currentEnemyTrainerId: currentEnemyTrainer.id,
      inventoryItemIds: inventory.map((item) => item.id),
      battleLog,
      phase: 'BATTLE',
      roundResult: null,
      lastBpGain: 0,
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
    trainerIntroActive,
    trainerIntroAwaitingContinue,
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
    fieldState,
    fieldTurns,
  ]);

  const getPersistableBattleResume = useCallback(() => {
    const stableSnapshot = buildStableFactoryBattleResume();
    if (stableSnapshot) {
      return stableSnapshot;
    }
    if (!eventBattleActive && hasFactoryRunToResume
      && hasRecoverableFactoryBaseCheckpoint(battleResumeSnapshotRef.current, walletRef.current.currentRunId)) {
      return battleResumeSnapshotRef.current!;
    }
    if (pendingBattleResumeRestore && battleResumeSnapshotRef.current) {
      return battleResumeSnapshotRef.current;
    }
    if (!eventBattleActive && gameState === 'BATTLE' && battleResumeSnapshotRef.current) {
      return battleResumeSnapshotRef.current;
    }
    if (!eventBattleActive && (gameState === 'ROUND_RESULT' || gameState === 'FACTORY_SWAP' || (gameState === 'BASE' && hasFactoryRunToResume)) && battleResumeSnapshotRef.current) {
      const snapshot: BattleResumeSnapshot = {
        ...battleResumeSnapshotRef.current,
        phase: gameState,
        roundResult,
        lastBpGain: lastTokenGain,
        streak,
        swapCount,
        totalRents,
        playerTeam,
        enemyTeam,
      };
      if (gameState === 'BASE') battleResumeSnapshotRef.current = snapshot;
      return snapshot;
    }
    return createEmptyBattleResume();
  }, [buildStableFactoryBattleResume, eventBattleActive, gameState, hasFactoryRunToResume, pendingBattleResumeRestore, roundResult, lastTokenGain, streak, swapCount, totalRents, playerTeam, enemyTeam]);

  const getEventItemLabel = useCallback((item: Item) => EVENT_ITEM_LABELS[item.id] ?? getLocalized(item), [getLocalized]);

  const pickGrowthRewardItem = useCallback(() => {
    const growthPool = ALL_ITEMS.filter((item) => EVENT_GROWTH_ITEM_IDS.includes(item.id));
    return growthPool[Math.floor(Math.random() * growthPool.length)] ?? ALL_ITEMS[0];
  }, []);

  const awardDispatchTraining = useCallback((region: (typeof EVENT_REGIONS)[number], selectedPokemonId: number | null, completedBattleCount = 0) => {
    const training = applyDispatchTrainingToTeam(playerTeam, selectedPokemonId, region, completedBattleCount);
    if (training.trained) {
      setPlayerTeam(training.team);
      const ivText = training.ivGain > 0 ? `，并获得 ${training.ivGain} 点个体值` : '';
      return {
        training,
        text: `派遣宝可梦获得 ${getStatLabel(training.stat)} +${training.evGain} 努力值${ivText}`,
      };
    }
    return {
      training,
      text: '派遣宝可梦不在当前队伍，训练收益已跳过。',
    };
  }, [playerTeam]);

  const handleSuppressedBattleResolved = useCallback((result: 'WIN' | 'LOSS') => {
    if (!eventBattleActive) return;

    const context = eventBattleContext;
    const region = context ? EVENT_REGIONS.find((entry) => entry.id === context.regionId) : null;
    const targetId = context?.targetPokemonId ?? enemy?.id ?? null;
    const targetName = enemy ? getLocalized(enemy) : '目标宝可梦';
    let battleResultText = result === 'WIN' ? `战胜了 ${targetName}` : `未能战胜 ${targetName}`;

    if (region && context && targetId !== null) {
      const nextBattleCount = (eventSpeciesBattleCounts[String(targetId)] ?? 0) + 1;
      setEventSpeciesBattleCounts((prev) => ({
        ...prev,
        [String(targetId)]: nextBattleCount,
      }));

      if (result === 'WIN') {
        const training = awardDispatchTraining(region, context.selectedPokemonId, nextBattleCount);
        const rewardItem = pickGrowthRewardItem();
        const rewardName = getEventItemLabel(rewardItem);
        setInventory((prev) => [...prev, rewardItem]);
        battleResultText = `${region.name}: ${battleResultText}，获得${rewardName}；${training.text}`;
        setEventDispatchPopup({
          kind: 'ITEM',
          title: `${region.name}战斗派遣完成`,
          message: `${context.specialSiteName ? `特殊地点「${context.specialSiteName}」调查完成。` : '遭遇战调查完成。'}${training.text}`,
          itemName: rewardName,
          itemId: rewardItem.id,
        });
      } else {
        battleResultText = `${region.name}: ${battleResultText}，遭遇记录已更新`;
      }

      setEventDispatches((prev) => ({
        ...prev,
        [region.id]: {
          ...createDefaultDispatchState(),
          lastResolvedAt: Date.now(),
          lastResult: battleResultText,
        },
      }));
    }

    setRoundResult(null);
    setLastTokenGain(0);
    setEnemy(null);
    setEnemyTeam([]);
    setCurrentEnemyTrainer(null);
    setTrainerIntroActive(false);
    setTrainerIntroAwaitingContinue(false);
    setBattleLog([]);
    setTurn('PLAYER');
    setBattleMenuTab('MAIN');
    setWeather('none');
    setWeatherTurns(0);
    setFieldState([]);
    setFieldTurns({});
    setSpecialBossBattleActive(false);
    setBattleSpecialUsage(EMPTY_BATTLE_SPECIAL_USAGE);
    setEnemySpecialUsage(EMPTY_BATTLE_SPECIAL_USAGE);
    setCatchSuccess(null);
    setGameState('EVENTS');
    setEventBattleActive(false);
    setEventBattleContext(null);
  }, [
    awardDispatchTraining,
    enemy,
    eventBattleActive,
    eventBattleContext,
    eventSpeciesBattleCounts,
    getEventItemLabel,
    getLocalized,
    pickGrowthRewardItem,
  ]);
  const getCurrentSaveDraft = useCallback(() => {
    const build = currentSaveBuilderRef.current;
    if (!build) throw new Error('Save draft is not ready.');
    return build();
  }, []);

  const syncWallet = useCallback((wallet: FactoryWallet) => {
    walletRef.current = wallet;
    setCoins(wallet.balance);
  }, []);

  const beginWalletRun = useCallback((devBonus = 0, startingStage = 1) => {
    syncWallet(beginFactoryWalletRun(getCurrentSaveDraft(), devBonus, startingStage));
  }, [getCurrentSaveDraft, syncWallet]);

  const adjustWallet = useCallback((delta: number) => {
    syncWallet(adjustWalletBalance(getCurrentSaveDraft(), delta));
  }, [getCurrentSaveDraft, syncWallet]);

  const spendWallet = useCallback((amount: number) => {
    if (!Number.isSafeInteger(amount) || amount < 0) return false;
    try {
      adjustWallet(-amount);
      return true;
    } catch (error) {
      console.error('Wallet spend failed', error);
      return false;
    }
  }, [adjustWallet]);

  const settleFactoryBattle = useCallback((runId: string, battleStage: number, result: 'WIN' | 'LOSS', isFrontierBrain: boolean, finalTeams: { playerTeam: GamePokemon[]; enemyTeam: GamePokemon[] }) => {
    const settlement = commitFactoryGroupSettlement(getCurrentSaveDraft(), runId, battleStage, result, isFrontierBrain, finalTeams);
    syncWallet(settlement.wallet);
    return settlement;
  }, [getCurrentSaveDraft, syncWallet]);

  const commitNextBattleStart = useCallback((start: Parameters<typeof commitFactoryBattleStart>[1]) => {
    const runId = walletRef.current.currentRunId;
    if (!runId) throw new Error('Factory run is unavailable.');
    const checkpoint = commitFactoryBattleStart(runId, start);
    battleResumeSnapshotRef.current = checkpoint;
    setHasFactoryRunToResume(false);
  }, []);

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
    weatherTurns,
    fieldState,
    fieldTurns,
    stage,
    streak,
    enemyAiTier,
    specialModeUnlocked,
    specialBossBattleActive,
    isFrontierBrain: currentEnemyTrainer?.id === FACTORY_BRAIN_TRAINER_ID,
    battleSpecialUsage,
    enemySpecialUsage,
    allowWildCatch: eventBattleActive,
    suppressFactoryBattleResult: eventBattleActive,
    onSuppressBattleResolved: handleSuppressedBattleResolved,
    factoryRunId: walletRef.current.currentRunId,
    pendingSettlement: initialPendingSettlement,
    settleFactoryBattle,
    t,
    currentLanguage,
    getLocalized,
    setInventory,
    setPlayerTeam,
    setEnemy,
    setEnemyTeam,
    setActiveBuffs,
    setEnemyBuffs,
    setWeather,
    setWeatherTurns,
    setFieldState,
    setFieldTurns,
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
      developerMode: devToolsAvailable ? developerMode : false,
      stage,
  totalRents,
  specialModeUnlocked,
  brainSymbols: walletRef.current.brainSymbols,
    selectedRentalIndices,
    factoryRentals,
    playerTeam,
    enemyTeam,
    gameState,
    battlePresentation: {
      enemy,
      enemyTeam,
      currentEnemyTrainer,
      nextEnemyPreviewTeam,
      nextEnemyPreviewTrainer,
      specialBossBattleActive,
      enemyAiTier,
      battleSpecialUsage,
      enemySpecialUsage,
      battleLog,
      turn,
      battleMenuTab,
      weather,
      weatherTurns,
      fieldState,
      fieldTurns,
      activeBuffs,
      enemyBuffs,
    },
    commitNextBattleStart,
    currentEnemyTrainer,
    t,
    getLocalized,
    addMessagesSequentially: battleController.addMessagesSequentially,
    setLoading,
    setRentalLoadError,
    setFactoryRentals,
    setSelectedRentalIndices,
    setInventory,
    beginWalletRun,
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
      setTrainerIntroActive,
      setTrainerIntroAwaitingContinue,
    setEnemyTeam,
    setEnemy,
    setCurrentEnemyTrainer,
    setNextEnemyPreviewTeam,
    setNextEnemyPreviewTrainer,
    setBattleLog,
    setTurn,
    setBattleMenuTab,
    setWeather,
    setWeatherTurns,
    setFieldState,
    setFieldTurns,
    setActiveBuffs,
    setEnemyBuffs,
  });
  const {
    clearFactoryEncounter,
    prefetchRentals,
    prefetchEnemy,
    exportUsedTrainerIdsBySet,
    importUsedTrainerIdsBySet,
  } = factoryFlow;

  useEffect(() => {
    hydrateTrainerHistoryOnce(
      trainerHistoryHydratedRef,
      initialSave?.factory.trainerIdsBySet ?? [],
      importUsedTrainerIdsBySet,
    );
  }, [importUsedTrainerIdsBySet, initialSave?.factory.trainerIdsBySet]);

  useEffect(() => {
    const stableSnapshot = buildStableFactoryBattleResume();
    if (!stableSnapshot) return;
    const checkpointStage = battleResumeSnapshotRef.current?.stage ?? null;
    battleResumeSnapshotRef.current = stableSnapshot;
    if (shouldReleaseFactoryBaseCheckpoint(hasFactoryRunToResume, checkpointStage, stableSnapshot.stage)) {
      setHasFactoryRunToResume(false);
    }
  }, [buildStableFactoryBattleResume, hasFactoryRunToResume]);

  useEffect(() => {
    if (pendingBattleResumeRestore) return;
    if (!eventBattleActive && hasFactoryRunToResume
      && hasRecoverableFactoryBaseCheckpoint(battleResumeSnapshotRef.current, walletRef.current.currentRunId)) return;
    if (eventBattleActive || !(['BATTLE', 'ROUND_RESULT', 'FACTORY_SWAP'].includes(gameState) || (gameState === 'BASE' && hasFactoryRunToResume))) {
      battleResumeSnapshotRef.current = null;
    }
  }, [eventBattleActive, gameState, hasFactoryRunToResume, pendingBattleResumeRestore]);

  useEffect(() => {
    if (!pendingBattleResumeRestore || !canEnterProject || gameState !== 'BASE') return;
    setPendingBattleResumeRestore(false);
    setGameState(initialBattleResume?.phase ?? 'BATTLE');
  }, [canEnterProject, gameState, pendingBattleResumeRestore, initialBattleResume?.phase]);

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
    spendWallet,
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
    if (saveBlocked || gameState !== 'BOOT') return;
    let cancelled = false;
    let progressValue = 0;
    const setProgress = (value: number) => {
      progressValue = Math.max(progressValue, Math.min(100, value));
      if (!cancelled) setBootProgress(progressValue);
    };

    void (async () => {
      if (pendingBattleResumeRestore) {
        setBootStatusText(t('bootFinalizingStartup'));
        setProgress(72);
      } else {
        setBootStatusText(t('bootPreparingRentalPool'));
        setProgress(18);
        const bootPrefetchStartedAt = rentalNow();
        const prefetchResult = prefetchRentals();
        queueMicrotask(() => {
          if (cancelled) return;
          reportRentalPerformance('boot-prefetch-start');
          void prefetchResult.then((ready) => {
            if (cancelled) return;
            reportRentalPerformance('boot-prefetch-end', {
              durationMs: rentalDuration(bootPrefetchStartedAt),
              ready,
            });
          });
        });
      }

      setBootStatusText(t('bootFinalizingStartup'));
      await new Promise((resolve) => setTimeout(resolve, 80));
      setProgress(100);
      if (!cancelled) {
        setBootStatusText(t('bootReady'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gameState, pendingBattleResumeRestore, prefetchRentals, saveBlocked, t]);

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
    const checkpointPaused = hasFactoryRunToResume && battleResume.status === 'READY' && battleResume.phase === 'BASE';

    return createSaveData({
      wallet: walletRef.current,
      companionSpeciesId,
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
        challengePaused: checkpointPaused,
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
    companionSpeciesId,
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

  currentSaveBuilderRef.current = buildCurrentSaveData;

  useEffect(() => {
    try {
      if (saveBlocked || isTransitioning || loading || trainerIntroActive || trainerIntroAwaitingContinue) return;
      persistSaveData(buildCurrentSaveData());
    } catch (error) {
      console.error('Auto save failed', error);
    }
  }, [buildCurrentSaveData, isTransitioning, loading, saveBlocked, trainerIntroActive, trainerIntroAwaitingContinue]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const persistCurrentState = () => {
      try {
        if (saveBlocked || isTransitioning || loading || trainerIntroActive || trainerIntroAwaitingContinue) return;
        persistSaveData(buildCurrentSaveData());
      } catch (error) {
        console.error('Save on page exit failed', error);
      }
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
  }, [buildCurrentSaveData, isTransitioning, loading, saveBlocked, trainerIntroActive, trainerIntroAwaitingContinue]);

  const confirmCompanion = useCallback((speciesId: number): boolean => {
    if (!isCompanionSpeciesId(speciesId) || saveBlocked) return false;
    if (companionCommittedRef.current !== null) return companionCommittedRef.current === speciesId;
    if (companionConfirmingRef.current) return false;
    companionConfirmingRef.current = true;
    try {
      bindCompanionToSave(buildCurrentSaveData(), speciesId);
      companionCommittedRef.current = speciesId;
      setCompanionSpeciesId(speciesId);
      setCurrentBaseTab('HOME');
      setGameState('BASE');
      return true;
    } catch (error) {
      console.error('Companion selection could not be saved', error);
      return false;
    } finally {
      companionConfirmingRef.current = false;
    }
  }, [buildCurrentSaveData, saveBlocked]);

  const enterBase = useCallback(() => {
    setCurrentBaseTab('HOME');
    setGameState(companionCommittedRef.current === null ? 'COMPANION_SELECT' : 'BASE');
  }, []);

  const openBaseTab = useCallback((tab: BaseTab) => {
    if (companionCommittedRef.current === null) { setGameState('COMPANION_SELECT'); return; }
    setCurrentBaseTab(tab);
    setGameState('BASE');
  }, []);

  const closeRunSummary = useCallback(() => {
    setPendingRunSummary((prev) => (prev ? { ...prev, visible: false } : prev));
  }, []);

  const continueAfterRoundResult = () => {
    if (gameState !== 'ROUND_RESULT' || !roundResult) return;
    const roundKey = `${walletRef.current.currentRunId}:${stage}`;
    if (handledRoundResultRef.current === roundKey) return;
    handledRoundResultRef.current = roundKey;
    const setNo = getSetNoByStage(stage);
    const battleIndexInSet = getBattleIndexInSet(stage);
    const newRecord = roundResult === 'WIN' ? streak >= highestStreak : false;

    if (getClassicPostBattleDestination(stage, roundResult) === 'FACTORY_SWAP') {
      void factoryFlow.prefetchEnemy(stage + 1);
      setGameState('FACTORY_SWAP');
      return;
    }

    if (roundResult === 'WIN') {
      if (battleIndexInSet === FACTORY_REWARD_CONFIG.battlesPerSet) {
        if (battleResumeSnapshotRef.current) {
          battleResumeSnapshotRef.current = {
            ...battleResumeSnapshotRef.current,
            phase: 'BASE',
            roundResult: 'WIN',
            lastBpGain: lastTokenGain,
            streak,
            swapCount,
            totalRents,
            playerTeam,
            enemyTeam,
          };
        }
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
        setHasFactoryRunToResume(hasRecoverableFactoryBaseCheckpoint(battleResumeSnapshotRef.current, walletRef.current.currentRunId));
        setCurrentBaseTab('HOME');
        setGameState('BASE');
        return;
      }

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
    setGameState('BASE');
  };

  const toggleDeveloperMode = useCallback(() => {
    if (!devToolsAvailable) return;
    setDeveloperMode((prev) => !prev);
  }, [devToolsAvailable]);

  const devAddCoins = useCallback((amount: number) => {
    if (!devToolsAvailable) return;
    try {
      adjustWallet(amount);
    } catch (error) {
      console.error('Developer wallet adjustment failed', error);
    }
  }, [adjustWallet, devToolsAvailable]);

  const devSetStage = useCallback((value: number) => {
    if (!devToolsAvailable || companionCommittedRef.current === null || playerTeam.length === 0) return;
    const normalized = Math.max(1, Math.floor(value));
    try {
      beginWalletRun(0, normalized);
      battleResumeSnapshotRef.current = null;
      setHasFactoryRunToResume(false);
      setRoundResult(null);
      setLastTokenGain(0);
      setStage(normalized);
      setStreak(normalized - 1);
      setEnemyAiTier(getAiTier(normalized, FACTORY_REWARD_CONFIG.battlesPerSet));
      setIsTransitioning(true);
      setGameState('BATTLE');
      void factoryFlow.spawnEnemy(normalized).then((ready) => {
        if (!ready) {
          setIsTransitioning(false);
          setGameState('BASE');
        }
      });
    } catch (error) {
      console.error('Developer stage change failed', error);
    }
  }, [beginWalletRun, devToolsAvailable, factoryFlow, playerTeam.length]);

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
    const battleItem = ALL_ITEMS.find((item) => item.isBattleItem) ?? fallbackItem;
    const permitItem = ALL_ITEMS.find((item) => item.id === 'team_capacity_permit') ?? fallbackItem;
    const rewardChoiceCount = getFactoryRewardChoiceCount();
    const samplePokemon = playerTeam[0] ?? factoryRentals[0];
    const sampleTmMove = samplePokemon?.selectedMoves?.[0];
    const tmReward: GameReward = sampleTmMove
      ? { type: 'TM', data: { move: sampleTmMove, learnerIndexes: [0] } }
      : { type: 'ITEM', data: potionItem };
    const rewardCandidates: GameReward[] = [
      { type: 'ITEM', data: potionItem },
      samplePokemon ? { type: 'POKEMON', data: samplePokemon } : { type: 'ITEM', data: potionItem },
      tmReward,
      playerTeam.length > 0 ? { type: 'EVOLUTION', data: { eligibleIndexes: [0] } } : { type: 'ITEM', data: battleItem },
      { type: 'ITEM', data: permitItem },
      { type: 'ITEM', data: battleItem },
    ];
    const nextRewards = rewardCandidates.slice(0, rewardChoiceCount);
    while (nextRewards.length < rewardChoiceCount) {
      nextRewards.push({ type: 'ITEM', data: potionItem });
    }

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

  const devOpenStatusPanel = useCallback(() => {
    if (gameState !== 'BATTLE') return;
    setTurn('PLAYER');
    setBattleMenuTab('STATUS');
    setIsMessageProcessing(false);
  }, [gameState]);

  const devSetWeather = useCallback((nextWeather: Weather, turns = 5) => {
    setWeather(nextWeather);
    setWeatherTurns(nextWeather === 'none' ? 0 : Math.max(1, turns));
  }, []);

  const devToggleFieldEffect = useCallback((field: FieldState, turns = 5) => {
    setFieldState((prev) => (
      prev.includes(field)
        ? prev.filter((entry) => entry !== field)
        : [...prev, field]
    ));
    setFieldTurns((prev) => {
      if (field in prev) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: Math.max(1, turns) };
    });
  }, []);

  const devAdjustLeadStatStage = useCallback((stat: 'attack' | 'defense' | 'spAtk', delta: number) => {
    setPlayerTeam((prev) => {
      if (prev.length === 0) return prev;
      const lead = prev[0];
      const nextValue = Math.max(-6, Math.min(6, (lead.statStages[stat] ?? 0) + delta));
      const nextLead = {
        ...lead,
        statStages: {
          ...lead.statStages,
          [stat]: nextValue,
        },
      };
      return [nextLead, ...prev.slice(1)];
    });
  }, []);

  const devClearBattleStatuses = useCallback(() => {
    setWeather('none');
    setWeatherTurns(0);
    setFieldState([]);
    setFieldTurns({});
    setPlayerTeam((prev) => {
      if (prev.length === 0) return prev;
      const lead = prev[0];
      const nextLead = {
        ...lead,
        specialBoostActive: false,
        dynamaxTurnsLeft: 0,
        nonVolatileStatus: undefined,
        volatileStatuses: {},
        statStages: {
          ...lead.statStages,
          attack: 0,
          defense: 0,
          spAtk: 0,
        },
      };
      return [nextLead, ...prev.slice(1)];
    });
  }, []);

  const devApplyStatusPanelPreset = useCallback(() => {
    if (gameState !== 'BATTLE') return;
    setTurn('PLAYER');
    setBattleMenuTab('STATUS');
    setIsMessageProcessing(false);
    setWeather('sunny');
    setWeatherTurns(4);
    setFieldState(['electric_terrain']);
    setFieldTurns({ electric_terrain: 4 });
    setPlayerTeam((prev) => {
      if (prev.length === 0) return prev;
      const lead = prev[0];
      const nextLead = {
        ...clearVolatileStatuses(clearNonVolatileStatus(lead)),
        statStages: {
          ...lead.statStages,
          attack: 2,
          defense: -1,
          spAtk: 1,
        },
      };
      return [nextLead, ...prev.slice(1)];
    });
  }, [gameState]);

  const nextFactoryStage = useCallback(async () => {
    if (!canAdvanceClassicStage(stage, gameState, roundResult, hasFactoryRunToResume)) return;
    const actionKey = `${walletRef.current.currentRunId}:${stage}:${gameState}`;
    await classicAdvanceGateRef.current(actionKey, async () => {
      const ready = await factoryFlow.nextFactoryStage();
      return ready;
    });
  }, [factoryFlow, gameState, hasFactoryRunToResume, roundResult, stage]);

  const performSwap = useCallback(async (playerIdx: number, enemyIdx: number) => {
    if (!canAdvanceClassicStage(stage, gameState, roundResult, hasFactoryRunToResume)) return;
    if (!Number.isInteger(playerIdx) || playerIdx < 0 || playerIdx >= playerTeam.length) return;
    if (!Number.isInteger(enemyIdx) || enemyIdx < 0 || enemyIdx >= enemyTeam.length) return;
    const actionKey = `${walletRef.current.currentRunId}:${stage}:${gameState}`;
    await classicAdvanceGateRef.current(actionKey, async () => {
      const swappedTeam = await factoryFlow.performSwap(playerIdx, enemyIdx);
      if (!swappedTeam) return false;
      const ready = await factoryFlow.nextFactoryStage(swappedTeam);
      if (ready) factoryFlow.commitSwap(swappedTeam);
      return ready;
    });
  }, [enemyTeam.length, factoryFlow, gameState, hasFactoryRunToResume, playerTeam, roundResult, stage]);

  const startGame = useCallback(async () => {
    if (!canEnterProject || companionCommittedRef.current === null) return;
    setHasFactoryRunToResume(false);
    setPendingRunSummary(null);
    setTeamCapacity(3);
    setPendingTmMove(null);
    setPendingTmLearnerIndexes([]);
    setPendingEvolutionEligibleIndexes([]);
    await factoryFlow.startGame();
  }, [canEnterProject, factoryFlow]);

  const quickStartDevBattle = useCallback(async () => {
    if (!canEnterProject || companionCommittedRef.current === null) return;
    setHasFactoryRunToResume(false);
    setPendingRunSummary(null);
    setTeamCapacity(3);
    setPendingTmMove(null);
    setPendingTmLearnerIndexes([]);
    setPendingEvolutionEligibleIndexes([]);
    await factoryFlow.quickStartDevBattle();
  }, [canEnterProject, factoryFlow]);

  const startOrResumeFactoryFromBase = useCallback(async () => {
    if (companionCommittedRef.current === null) { setGameState('COMPANION_SELECT'); return; }
    setPendingRunSummary(null);
    setCurrentBaseTab('HOME');

    if (hasFactoryRunToResume) {
      await nextFactoryStage();
      return;
    }

    await startGame();
  }, [hasFactoryRunToResume, nextFactoryStage, startGame]);

  const endPausedFactoryRun = useCallback(() => {
    const runId = walletRef.current.currentRunId;
    if (gameState !== 'BASE' || !hasFactoryRunToResume || !runId
      || !hasRecoverableFactoryBaseCheckpoint(battleResumeSnapshotRef.current, runId)) return false;
    try {
      const wallet = endFactoryWalletRun(buildCurrentSaveData(), runId);
      syncWallet(wallet);
      factoryResumeActiveRef.current = false;
      battleResumeSnapshotRef.current = null;
      setHasFactoryRunToResume(false);
      setPendingRunSummary(null);
      setRoundResult(null);
      setLastTokenGain(0);
      clearFactoryEncounter();
      setStage(1);
      setStreak(0);
      setSwapCount(0);
      setCurrentBaseTab('HOME');
      return true;
    } catch (error) {
      console.error('Failed to end factory run', error);
      return false;
    }
  }, [buildCurrentSaveData, clearFactoryEncounter, gameState, hasFactoryRunToResume, syncWallet]);
  const setEventDispatchPokemon = useCallback((regionId: string, pokemonId: number | null) => {
    if (factoryResumeActiveRef.current) return;
    if (!EVENT_REGIONS.some((region) => region.id === regionId)) return;
    setEventDispatchPokemonByRegion((prev) => ({ ...prev, [regionId]: pokemonId }));
  }, []);

  const autoPickDispatchPokemon = useCallback(async (regionId: string) => {
    if (factoryResumeActiveRef.current) return null;
    const region = EVENT_REGIONS.find((entry) => entry.id === regionId);
    if (!region) return null;
    const ownedIds = [...collectionLedger.ownedIds];
    if (ownedIds.length === 0) return null;
    const shuffled = ownedIds.sort(() => Math.random() - 0.5);
    for (const pokemonId of shuffled) {
      try {
        const data = await fetchPokemon(pokemonId);
        if (factoryResumeActiveRef.current) return null;
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
    if (factoryResumeActiveRef.current) return '请先继续或结束当前挑战';
    const region = EVENT_REGIONS.find((entry) => entry.id === regionId);
    if (!region) return '派遣失败：未知地区';

    const selectedPokemonId = eventDispatchPokemonByRegion[regionId];
    if (!selectedPokemonId) return '请先选择一只已拥有的派遣宝可梦';

    const selectedPokemonData = await fetchPokemon(selectedPokemonId);
    if (factoryResumeActiveRef.current) return '请先继续或结束当前挑战';
    const selectedTypes = selectedPokemonData.types.map((slot) => slot.type.name);
    const matched = region.requiredTypes.some((type) => selectedTypes.includes(type));
    if (!matched) {
      return `${region.name}: 当前选择的宝可梦属性不匹配地区要求`;
    }

    const outcome = rollDispatchOutcome(region.category);
    if (outcome === 'item') {
      const rewardItem = pickGrowthRewardItem();
      const rewardName = getEventItemLabel(rewardItem);
      const training = awardDispatchTraining(region, selectedPokemonId);
      setInventory((prev) => [...prev, rewardItem]);
      setEventDispatchPopup({
        kind: 'ITEM',
        title: `${region.name}派遣完成`,
        message: `侦察队带回了${rewardName}。${training.text}`,
        itemName: rewardName,
        itemId: rewardItem.id,
      });
      return `${region.name}: 获得${rewardName}；${training.text}`;
    }

    const [dexMin, dexMax] = region.dexRange;
    const regionalPool = Array.from({ length: dexMax - dexMin + 1 }, (_, index) => dexMin + index);
    const sampledBaseSpecies: number[] = [];
    const maxAttempts = Math.min(80, regionalPool.length);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = regionalPool[Math.floor(Math.random() * regionalPool.length)];
      if (!candidate) continue;
      if (await isEvolutionChainBaseSpecies(candidate)) {
        if (factoryResumeActiveRef.current) return '请先继续或结束当前挑战';
        sampledBaseSpecies.push(candidate);
      }
    }
    const initialFormPool = [...new Set(sampledBaseSpecies)];
    const rarePool = RARE_SPECIES_POOL.filter((speciesId) => speciesId >= dexMin && speciesId <= dexMax);
    const useRarePool = region.category === 'rare_hunt' && rarePool.length > 0;
    const commonTargetPool = useRarePool ? rarePool : initialFormPool;
    if (commonTargetPool.length === 0) {
      return `${region.name}: 没有可用的地区基础形态目标`;
    }

    if (outcome === 'join') {
      const joinIdentifier = commonTargetPool[Math.floor(Math.random() * commonTargetPool.length)];
      if (!joinIdentifier) return `${region.name}: 生成目标失败`;
      const targetPokemon = await getProcessedPokemon(joinIdentifier, Math.max(20, startLevel));
      if (factoryResumeActiveRef.current) return '请先继续或结束当前挑战';
      const ballIndex = inventory.findIndex((item) => item.isBall);
      if (ballIndex < 0) return `${region.name}: 背包里没有可用的精灵球`;

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

      const joinedParty = playerTeam.length < 6;
      const training = awardDispatchTraining(region, selectedPokemonId);
      setPlayerTeam((prev) => (prev.length < 6 ? [...prev, targetPokemon] : prev));
      const targetName = getLocalized(targetPokemon);
      const rosterText = joinedParty ? '已加入当前队伍。' : '队伍已满，已登记到图鉴后备名册。';
      setEventDispatchPopup({
        kind: 'POKEMON',
        title: `${region.name}奇遇成功`,
        message: `「${targetName}」认可了你的队伍，${rosterText} ${training.text}`,
        pokemonName: targetName,
        pokemonSprite: targetPokemon.sprites.front_default ?? '',
        pokemonLevel: targetPokemon.level,
      });
      return `${region.name}: ${targetName}${joinedParty ? '加入队伍' : '进入图鉴后备名册'}；${training.text}`;
    }

    if (!inventory.some((item) => item.isBall)) {
      return `${region.name}: 背包里没有可用的精灵球`;
    }

    const specialEncounter = pickSpecialSiteEncounter(regionId);
    const battleIdentifier = specialEncounter?.speciesId ?? commonTargetPool[Math.floor(Math.random() * commonTargetPool.length)];
    if (!battleIdentifier) return `${region.name}: 生成遭遇失败`;
    const battleLevel = Math.max(20, specialEncounter?.site.minLevel ?? startLevel);
    const targetPokemon = await getProcessedPokemon(battleIdentifier, battleLevel);
    if (factoryResumeActiveRef.current) return '请先继续或结束当前挑战';

    setCatchSuccess(null);
    setEventBattleActive(true);
    setEventBattleContext({
      regionId,
      selectedPokemonId,
      targetPokemonId: targetPokemon.id,
      specialSiteName: specialEncounter?.site.name,
    });
    setEnemyTeam([targetPokemon]);
    setEnemy(targetPokemon);
    setBattleLog([]);
    setTurn('PLAYER');
    setBattleMenuTab('MAIN');
    setWeather('none');
    setWeatherTurns(0);
    setFieldState([]);
    setFieldTurns({});
    setGameState('BATTLE');
    if (specialEncounter) {
      return `${region.name}: 特殊事件地点 ${specialEncounter.site.name}，遭遇 ${getLocalized(targetPokemon)}`;
    }
    return `${region.name}: 遭遇战斗 ${getLocalized(targetPokemon)}`;
  }, [
    awardDispatchTraining,
    eventDispatchPokemonByRegion,
    getEventItemLabel,
    getLocalized,
    inventory,
    pickGrowthRewardItem,
    pickSpecialSiteEncounter,
    playerTeam.length,
    startLevel,
  ]);
  const dispatchEventRegion = useCallback(async (regionId: string) => {
    if (factoryResumeActiveRef.current) return;
    const region = EVENT_REGIONS.find((entry) => entry.id === regionId);
    if (!region) return;

    const now = Date.now();
    const current = eventDispatches[regionId] ?? createDefaultDispatchState();
    const isReady = current.status === 'READY' || (current.status === 'RUNNING' && current.readyAt !== null && current.readyAt <= now);

    if (!isReady && current.status === 'RUNNING') return;

    if (!isReady) {
      const selectedPokemonId = eventDispatchPokemonByRegion[regionId] ?? null;
      if (!selectedPokemonId) {
        setEventDispatches((prev) => ({
          ...prev,
          [regionId]: {
            ...current,
            status: 'IDLE',
            lastResolvedAt: now,
            lastResult: `${region.name}: 请先选择派遣宝可梦（可点击“推荐”）`,
          },
        }));
        return;
      }
      try {
        const selectedPokemonData = await fetchPokemon(selectedPokemonId);
        if (factoryResumeActiveRef.current) return;
        const selectedTypes = selectedPokemonData.types.map((slot) => slot.type.name);
        const matched = region.requiredTypes.some((type) => selectedTypes.includes(type));
        if (!matched) {
          setEventDispatches((prev) => ({
            ...prev,
            [regionId]: {
              ...current,
              status: 'IDLE',
              lastResolvedAt: now,
              lastResult: `${region.name}: 当前选择宝可梦属性不匹配地区要求`,
            },
          }));
          return;
        }
      } catch {
        if (factoryResumeActiveRef.current) return;
        setEventDispatches((prev) => ({
          ...prev,
          [regionId]: {
            ...current,
            status: 'IDLE',
            lastResolvedAt: now,
            lastResult: `${region.name}: 派遣前校验失败，请重试`,
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
    if (factoryResumeActiveRef.current) return;
    const resolvedAt = Date.now();
    setEventDispatches((prev) => ({
      ...prev,
      [regionId]: {
        ...createDefaultDispatchState(),
        lastResolvedAt: resolvedAt,
        lastResult: resultText,
      },
    }));
  }, [eventDispatchPokemonByRegion, eventDispatches, resolveDispatchRegion]);

  const mockEventDispatchResult = useCallback((regionId: string, outcome: 'item' | 'join' | 'battle_special') => {
    if (factoryResumeActiveRef.current) return;
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
          if (factoryResumeActiveRef.current) return;
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
          if (factoryResumeActiveRef.current) return;
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

      replaceSaveData(normalizedParsed);
      window.location.reload();

      return {
        ok: true,
        message: 'Save imported successfully.',
      };
    } catch (error) {
      console.error('Import save failed', error);
      return {
        ok: false,
        message: error instanceof Error && (error.message.includes('旧规则存档不兼容') || error.message.includes('导入文件损坏'))
          ? error.message
          : 'Invalid save format. Import failed.',
      };
    }
  }, []);

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
    weather,
    weatherTurns,
    fieldState,
    fieldTurns,
    isTransitioning,
    trainerIntroActive,
    trainerIntroAwaitingContinue,
    isMessageProcessing,
    settlementError: battleController.settlementError,
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
    infoPokemonSource,
    prevGameState,
    showLogHistory,
    currentLanguage,
    pendingRewardAction,
    loading,
    rentalLoadError,
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
    nextEnemyPreviewTeam,
    nextEnemyPreviewTrainer,
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
    companionSpeciesId,
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
    setInfoPokemonSource,
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
    confirmCompanion,
    openBaseTab,
    closeRunSummary,
    startOrResumeFactoryFromBase,
    endPausedFactoryRun,
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
    continueTrainerIntro: factoryFlow.continueTrainerIntro,
    forfeitChallenge: battleController.forfeitChallenge,
    retrySettlement: battleController.retrySettlement,
    toggleDeveloperMode,
    devAddCoins,
    devSetStage,
    devWinBattle: battleController.devWinBattle,
    devUnlockSpecialMode,
    devResetBattleSpecialUsage,
    devOpenRewardScreen,
    devOpenStatusPanel,
    devApplyStatusPanelPreset,
    devSetWeather,
    devToggleFieldEffect,
    devAdjustLeadStatStage,
    devClearBattleStatuses,
    exportSaveData,
    importSaveData,
    setEventDispatchPokemon,
    dispatchEventRegion,
    mockEventDispatchResult,
    closeEventDispatchPopup,
  } satisfies GameViewModel;

  return viewModel;
}


