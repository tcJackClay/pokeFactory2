import { BASE_BALL_IDS, createEmptyBaseInventory, isBaseBallId, type BaseBallId, type PendingDispatchResult } from '../utils/baseBallInventory';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BattleHazards, BattleMenuTab, FieldState, FieldTurns, GamePokemon, GameState, Item, Move, Pokemon, TailwindTurns, Weather } from '../../../types';
import { createEmptyBattleHazards } from '../battle/engine/resolveEntryHazards';
import { ALL_ITEMS } from '../../../uiAppConstants';
import { buildEvolvedFactoryPokemon, fetchPokemon, getProcessedPokemon, isEvolutionChainBaseSpecies } from '../../../services/pokeApi';
import { getAiTier } from '../config/factoryBattle';
import { FACTORY_REWARD_CONFIG, shouldEnterRewardAfterWinning } from '../config/factoryRewards';
import { drawFactoryShopShelf, type FactoryRewardHeldItemId } from '../config/factoryRewardPool';
import { buildFactoryEvolutionShopProducts } from '../utils/factoryEvolutionShop';
import type { FactoryEvolutionItemId } from '../config/factoryEvolutionItems';
import { canAdvanceClassicStage, createClassicActionGate, getClassicPostBattleDestination } from '../config/classicFlow';
import { EVENT_GROWTH_ITEM_IDS, DISPATCH_ITEM_BALL_REWARD, EVENT_REGIONS, IV_TRAIN_BATTLE_THRESHOLD, RARE_SPECIES_POOL, createDefaultDispatchState } from '../config/events';
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
import { getBattleIndexInSet, getFactoryShelfSize, getSetNoByStage } from '../config/factoryRewards';
import { getFactoryHeldItemInTeamIds } from '../config/factoryHeldItemRules';
import {
  buildSaveExportFilename,
  bindCompanionToSave,
  beginFactoryWalletRun,
  endFactoryWalletRun,
  adjustWalletBalance,
  commitFactoryGroupSettlement,
  prepareDispatchResult,
  commitDispatchResult,
  commitEventBallAttempt,
  persistEventResources,
  commitFactoryBattleStart,
  commitFactoryRewardPending,
  commitFactoryRewardReady,
  commitFactoryShopPurchase,
  commitFactoryEvolutionPurchase,
  commitFactoryRewardContinueIntent,
  getFactorySwapEquippedItemConflict,
  createEmptyBattleResume,
  createEmptyRunSupply,
  createEmptyWallet,
  createSaveData,
  inspectStoredSave,
  loadSaveData,
  loadPendingFactorySettlement,
  parseSaveDataFromText,
  persistSaveData,
  replaceSaveData,
  triggerJsonDownload,
  type BattleResumeSnapshot,
  type CollectionLedger,
  type FactoryRewardCheckpoint,
  type FactoryWallet,
  type FactoryRunSupply,
  type GameSaveData,
} from '../../../services/saveManager';
import { createPokemonFormLedgerKey, normalizeStoredFormKeys } from '../utils/formLedger';
import { getPokemonSpriteUrl } from '../../../services/pokeApiEndpoint';
import { rentalDuration, rentalNow, reportRentalPerformance } from '../performance/rentalPerformance';
import { getDispatchAcquisitionId, normalizePermanentCollection } from '../utils/permanentCollection';

const STREAK_FACTORY_SINGLES_50 = 1 << 8;
const STREAK_FACTORY_SINGLES_OPEN = 1 << 9;
const WIN_STREAK_ACTIVE_MASK_DEFAULT = 0xffffffff;
const CHALLENGE_ACTIVE_STATES: GameState[] = ['FACTORY_SELECT', 'FACTORY_SWAP', 'BATTLE', 'REWARD', 'ROUND_RESULT'];
const BOOT_ENTER_THRESHOLD = 80;
const EMPTY_BATTLE_SPECIAL_USAGE: BattleSpecialUsageState = { MEGA: false, DYNAMAX: false, TERA: false, ZMOVE: false };
const ITEM_BY_ID = Object.fromEntries(ALL_ITEMS.map((item) => [item.id, item] as const));

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
  dispatchStartedAt: number;
}
class StaleDispatchError extends Error {}

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
  const runSupplyRef = useRef<FactoryRunSupply>(initialSave?.runSupply ?? createEmptyRunSupply());
  const currentSaveBuilderRef = useRef<(() => GameSaveData) | null>(null);
  const [coins, setCoins] = useState(walletRef.current.balance);
  const [supplyTickets, setSupplyTickets] = useState(runSupplyRef.current.tickets);
  const [shopItems, setShopItems] = useState<{ item: Item; price: number }[]>([]);
  const [rewardChoiceMade, setRewardChoiceMade] = useState(false);
  const [rerollCount, setRerollCount] = useState(0);
  const [teamCapacity, setTeamCapacity] = useState(3);
  const [playerTeam, setPlayerTeam] = useState<GamePokemon[]>(initialBattleResume?.playerTeam ?? initialSave?.events.resourceCheckpoint?.playerTeam ?? []);
  const [rewards, setRewards] = useState<GameReward[]>([]);
  const [activeBuffs, setActiveBuffs] = useState(initialBattleResume?.activeBuffs ?? { atk: false, def: false });
  const [enemyBuffs, setEnemyBuffs] = useState(initialBattleResume?.enemyBuffs ?? { atk: false, def: false });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [trainerIntroActive, setTrainerIntroActive] = useState(false);
  const [trainerIntroAwaitingContinue, setTrainerIntroAwaitingContinue] = useState(false);
  const [isMessageProcessing, setIsMessageProcessing] = useState(false);
  const [roundTransactionActive, setRoundTransactionActive] = useState(false);
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
  const [opponentLoadError, setOpponentLoadError] = useState(false);
  const [postBattleActionError, setPostBattleActionError] = useState<string | null>(null);
  const [rewardClaimError, setRewardClaimError] = useState<string | null>(null);
  const [rewardClaimBusy, setRewardClaimBusy] = useState(false);
  const [rewardContinueError, setRewardContinueError] = useState<string | null>(null);
  const [rewardContinueBusy, setRewardContinueBusy] = useState(false);
  const [rewardPrepareError, setRewardPrepareError] = useState<string | null>(null);
  // 生成失败的「重新准备」重试令牌：变化即让生成 effect 重跑。
  const [rewardPrepareAttempt, setRewardPrepareAttempt] = useState(0);
  const [rewardCheckpoint, setRewardCheckpoint] = useState<FactoryRewardCheckpoint | null>(
    initialBattleResume?.phase === 'REWARD' ? initialBattleResume.rewardCheckpoint ?? null : null,
  );
  // 三人返还基准唯一性被规整过的如实提示（PRD 裁决补遗一/二：可恢复 + 如实提示，不静默）。
  // 单一状态：`repaired` 由写入层的 `heldItemBaselineRepaired` 驱动，`dismissed` 只在同一次修复内有效 ——
  // 离开本局（含新挑战开始）时整体复位，避免上一局的规整提示跨 run 残留。
  const [heldItemRepairNotice, setHeldItemRepairNotice] = useState({
    repaired: initialBattleResume?.status === 'READY' && initialBattleResume.heldItemBaselineRepaired === true,
    dismissed: false,
  });
  const [bootProgress, setBootProgress] = useState(0);
  const [bootStatusText, setBootStatusText] = useState('');
  const [inventory, setInventory] = useState<Item[]>(() => hydrateInventoryFromItemIds(initialBattleResume?.inventoryItemIds ?? initialSave?.events.resourceCheckpoint?.inventoryItemIds ?? []));
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
  const [tailwindTurns, setTailwindTurns] = useState<TailwindTurns>(initialBattleResume?.tailwindTurns ?? { player: 0, enemy: 0 });
  const [hazards, setHazards] = useState<BattleHazards>(initialBattleResume?.hazards ?? createEmptyBattleHazards());
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
  const dispatchInFlightRef = useRef(false);
  const preparedDispatchRef = useRef<Record<string, PendingDispatchResult>>({});
  const [baseInventory, setBaseInventory] = useState(() => initialSave?.baseInventory ?? createEmptyBaseInventory());
  const baseInventoryRef = useRef(baseInventory);
  const eventPersistentRef = useRef(initialSave?.events);

  const [activeEventCount] = useState(EVENT_REGIONS.length);
  const [shopUnlocked] = useState(true);
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
  const dispatchContextRef = useRef({ key: '', generation: 0 });
  const dispatchContextKey = JSON.stringify([gameState, currentBaseTab, eventDispatchPokemonByRegion, hasFactoryRunToResume]);
  if (dispatchContextRef.current.key !== dispatchContextKey) {
    dispatchContextRef.current = { key: dispatchContextKey, generation: dispatchContextRef.current.generation + 1 };
  }
  const [eventDispatchPopup, setEventDispatchPopup] = useState<EventDispatchPopup | null>(null);
  const [eventBattleActive, setEventBattleActive] = useState(false);
  const [eventBattleContext, setEventBattleContext] = useState<EventBattleContext | null>(null);
  const eventRuntimeRef = useRef({ playerTeam, inventory, eventBattleActive, gameState, currentBaseTab, showReplaceUI });
  eventRuntimeRef.current = { playerTeam, inventory, eventBattleActive, gameState, currentBaseTab, showReplaceUI };
  const syncEventSave = useCallback((save: GameSaveData, resources = false) => {
    baseInventoryRef.current = save.baseInventory;
    eventPersistentRef.current = save.events;
    setBaseInventory(save.baseInventory);
    setCollectionLedger(save.collection);
    setEventDispatches(save.events.dispatches);
    if (resources && save.events.resourceCheckpoint) {
      const next = save.events.resourceCheckpoint;
      const items = hydrateInventoryFromItemIds(next.inventoryItemIds);
      eventRuntimeRef.current.playerTeam = next.playerTeam;
      eventRuntimeRef.current.inventory = items;
      setPlayerTeam(next.playerTeam);
      setInventory(items);
    }
  }, []);
  const isDispatchContextCurrent = useCallback(() => {
    const live = eventRuntimeRef.current;
    return !factoryResumeActiveRef.current && !live.eventBattleActive
      && (live.gameState === 'EVENTS' || (live.gameState === 'BASE' && live.currentBaseTab === 'EVENTS'));
  }, []);
  const cancelReplacePokemon = useCallback(() => {
    eventRuntimeRef.current.showReplaceUI = null;
    setShowReplaceUI(null);
  }, []);
  const replaceCollectedPokemon = useCallback((index: number) => {
    const live = eventRuntimeRef.current;
    if (!isDispatchContextCurrent() || !live.showReplaceUI || !Number.isInteger(index) || !live.playerTeam[index]) return;
    const nextTeam = live.playerTeam.map((pokemon, teamIndex) => teamIndex === index ? live.showReplaceUI! : pokemon);
    // The catch receipt and ball consumption already committed before this choice.
    live.playerTeam = nextTeam;
    live.showReplaceUI = null;
    setPlayerTeam(nextTeam);
    setShowReplaceUI(null);
  }, [isDispatchContextCurrent]);
  useEffect(() => {
    const onEventPage = gameState === 'EVENTS' || (gameState === 'BASE' && currentBaseTab === 'EVENTS');
    if (showReplaceUI && gameState !== 'BATTLE' && !onEventPage) cancelReplacePokemon();
  }, [cancelReplacePokemon, currentBaseTab, gameState, showReplaceUI]);
  const [highestStreak, setHighestStreak] = useState(initialSave?.progress.highestStreak ?? 0);
  const [collectionLedger, setCollectionLedger] = useState<CollectionLedger>(() => ({
    seenIds: initialSave?.collection?.seenIds ?? [],
    ownedIds: initialSave?.collection?.ownedIds ?? [],
    formKeys: normalizeStoredFormKeys(initialSave?.collection?.formKeys ?? []),
    acquisitions: initialSave?.collection.acquisitions ?? [],
  }));

  const { t, getLocalized, getLocalizedDesc, getLocalizedNature, getStatName } = useGameLocalization(currentLanguage);
  const canEnterProject = bootProgress >= BOOT_ENTER_THRESHOLD;
  const battleResumeSnapshotRef = useRef<BattleResumeSnapshot | null>(initialBattleResume);
  const factoryResumeActiveRef = useRef(hasFactoryRunToResume);
  factoryResumeActiveRef.current = hasFactoryRunToResume;
  const classicAdvanceGateRef = useRef(createClassicActionGate());
  const rewardClaimInFlightRef = useRef(false);
  const rewardPrepareInFlightRef = useRef(false);
  const handledRoundResultRef = useRef<string | null>(null);
  // 导入存档后立即 reload：此时 beforeunload / visibilitychange 的「退出存档」会把导入前的
  // 内存旧状态回写，覆盖刚落盘的导入结果（导入被静默丢弃）。置位本标记让退出存档在本次导航内跳过。
  const skipExitPersistRef = useRef(false);

  const buildStableFactoryBattleResume = useCallback((): BattleResumeSnapshot | null => {
    if (eventBattleActive || gameState !== 'BATTLE') return null;
    if (turn !== 'PLAYER' || isMessageProcessing || roundTransactionActive || loading || isTransitioning || trainerIntroActive || trainerIntroAwaitingContinue) return null;
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
      tailwindTurns,
      hazards,
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
    roundTransactionActive,
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
    tailwindTurns,
    hazards,
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
    if (!eventBattleActive && gameState === 'REWARD' && battleResumeSnapshotRef.current?.phase === 'REWARD') {
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

  /**
   * 奖励节点 `PENDING → READY`：枚举候选 + 等权不放回抽满货架（shelfSize 件）并**冻结落盘**。
   * PRD 奖励商店 F2：候选不足**不得**补位、不得重复出卡、不得悄悄少给；写入失败留在 PENDING 可重试。
   * 只在 `gameState === 'REWARD'` 且锚点仍为 PENDING 时执行，且带同步门闩防重复抽取。
   */
  useEffect(() => {
    if (gameState !== 'REWARD' || !canEnterProject) return;
    const snapshot = battleResumeSnapshotRef.current;
    if (snapshot?.phase !== 'REWARD' || snapshot.rewardCheckpoint?.status !== 'PENDING') return;
    if (rewardPrepareInFlightRef.current) return;
    const runId = walletRef.current.currentRunId;
    if (!runId) return;
    rewardPrepareInFlightRef.current = true;
    const isZh = currentLanguage.startsWith('zh');
    void (async () => {
    try {
      const shelfSize = getFactoryShelfSize();
      const evolution = await buildFactoryEvolutionShopProducts(snapshot.playerTeam);
      const current = battleResumeSnapshotRef.current;
      if (walletRef.current.currentRunId !== runId || current?.phase !== 'REWARD'
        || current.rewardCheckpoint?.status !== 'PENDING'
        || current.rewardCheckpoint.runId !== runId
        || current.rewardCheckpoint.stage !== snapshot.rewardCheckpoint.stage) return;
      if (JSON.stringify(current.playerTeam) !== JSON.stringify(snapshot.playerTeam)) {
        setRewardPrepareError(isZh
          ? '队伍在货架生成时发生变化，请重试。'
          : 'The team changed while preparing the shelf. Please retry.');
        return;
      }
      const drawn = drawFactoryShopShelf({
        equippedItemIds: current.playerTeam.map((pokemon) => pokemon.factoryEquippedHeldItemId),
        evolutionProducts: evolution.products,
      });
      if (drawn.ok === false) {
        // 边界（正常路径不可达）：候选不足是缺陷，明确上报而不静默补位。
        setRewardPrepareError(isZh
          ? `货架候选不足（${drawn.candidateCount}/${shelfSize}），已按缺陷记录，不会补位或重复上架。请重试或上报。`
          : `Not enough shop candidates (${drawn.candidateCount}/${shelfSize}). This is a defect: no padding or duplicate products. Please retry or report.`);
        return;
      }
      const ready = commitFactoryRewardReady(runId, current.rewardCheckpoint.stage, drawn.shelf);
      battleResumeSnapshotRef.current = ready;
      setRewardCheckpoint(ready.rewardCheckpoint ?? null);
      if (evolution.degraded.length > 0) {
        console.warn('Some fixed Rogue evolution targets could not be loaded', evolution.degraded);
        setRewardPrepareError(isZh
          ? `部分进化商品资料未能读取（${evolution.degraded.length} 条），本次货架已安全排除这些商品。`
          : `${evolution.degraded.length} evolution targets could not be loaded and were omitted from this shelf.`);
      } else setRewardPrepareError(null);
    } catch (error) {
      console.error('Factory reward shelf preparation failed', error);
      // 候选货架可能已被同版导入/其它标签页冻结：采用已落盘结果，绝不重抽。
      const stored = loadSaveData()?.factory.battleResume;
      if (stored?.status === 'READY' && stored.phase === 'REWARD' && stored.rewardCheckpoint?.status === 'READY') {
        battleResumeSnapshotRef.current = stored;
        setRewardCheckpoint(stored.rewardCheckpoint);
        setRewardPrepareError(null);
      } else {
        setRewardPrepareError(isZh
          ? '货架保存失败，进度未改变。请检查存储空间后重试。'
          : 'Could not save the shop shelf. Progress is unchanged. Check storage and retry.');
      }
    } finally {
      rewardPrepareInFlightRef.current = false;
    }
    })();
  }, [canEnterProject, currentLanguage, gameState, rewardPrepareAttempt]);

  /**
   * 不变量修复的如实上报（裁决补遗一）：任何写入路径（load / 导入 / 换怪 / 起战 / 奖励节点）
   * 一旦规整过返还基准，就在此统一采集并告知玩家，**不静默**。
   */
  useEffect(() => {
    const resume = battleResumeSnapshotRef.current;
    if (resume?.status !== 'READY' || resume.heldItemBaselineRepaired !== true) return;
    setHeldItemRepairNotice((prev) => (prev.repaired ? prev : { repaired: true, dismissed: false }));
  }, [gameState, playerTeam, rewardCheckpoint]);

  const retryFactoryItemRewardPrepare = useCallback(() => {
    setRewardPrepareError(null);
    setRewardPrepareAttempt((prev) => prev + 1);
  }, []);

  const getEventItemLabel = useCallback((item: Item) => EVENT_ITEM_LABELS[item.id] ?? getLocalized(item), [getLocalized]);

  const pickGrowthRewardItem = useCallback(() => {
    const growthPool = ALL_ITEMS.filter((item) => EVENT_GROWTH_ITEM_IDS.includes(item.id));
    return growthPool[Math.floor(Math.random() * growthPool.length)] ?? ALL_ITEMS[0];
  }, []);

  const awardDispatchTraining = useCallback((region: (typeof EVENT_REGIONS)[number], selectedPokemonId: number | null, completedBattleCount = 0, team = eventRuntimeRef.current.playerTeam) => {
    const training = applyDispatchTrainingToTeam(team, selectedPokemonId, region, completedBattleCount);
    if (training.trained) {
      eventRuntimeRef.current.playerTeam = training.team;
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
  }, []);

  const handleSuppressedBattleResolved = useCallback((result: 'WIN' | 'LOSS', resolvedTeam: GamePokemon[]) => {
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
        const training = awardDispatchTraining(region, context.selectedPokemonId, nextBattleCount, resolvedTeam);
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
    setTailwindTurns({ player: 0, enemy: 0 });
    setHazards(createEmptyBattleHazards());
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

  const commitBallAttempt = useCallback((pokemon: GamePokemon, ballId: BaseBallId, caught: boolean, attemptId: string): 'COMMITTED' | 'ALREADY_COMMITTED' | 'NO_BALLS' | 'FAILED' => {
    const context = eventBattleContext;
    if (skipExitPersistRef.current || !eventRuntimeRef.current.eventBattleActive || !context || context.targetPokemonId !== pokemon.id) return 'FAILED';
    try {
      const current = loadSaveData();
      if (current && current.baseInventory.balls[ballId] < 1) {
        syncEventSave(current);
        return 'NO_BALLS';
      }
      const acquiredAt = Date.now();
      const dispatchKey = getDispatchAcquisitionId(context.regionId, context.dispatchStartedAt);
      const live = eventRuntimeRef.current;
      const team = caught && live.playerTeam.length < 6 ? [...live.playerTeam, pokemon] : live.playerTeam;
      const committed = commitEventBallAttempt({
        dispatchKey, attemptId: `${dispatchKey}:attempt:${attemptId}`, ballId,
        resources: { playerTeam: team, inventoryItemIds: live.inventory.map((item) => item.id) },
        ...(caught ? { acquisition: {
          acquisitionId: dispatchKey, speciesId: pokemon.id, source: 'DISPATCH_CATCH' as const,
          regionId: context.regionId, dispatchStartedAt: context.dispatchStartedAt, acquiredAt,
        } } : {}),
      });
      syncEventSave(committed.save);
      return committed.applied ? 'COMMITTED' : 'ALREADY_COMMITTED';
    } catch (error) {
      console.error('Ball attempt could not be saved', error);
      return 'FAILED';
    }
  }, [eventBattleContext, syncEventSave]);

  const commitEventItemUse = useCallback((team: GamePokemon[], items: Item[]): boolean => {
    if (!eventRuntimeRef.current.eventBattleActive) return false;
    try {
      const saved = loadSaveData();
      if (!saved || saved.wallet.currentRunId !== null || saved.baseInventory.revision !== baseInventoryRef.current.revision) {
        if (saved) syncEventSave(saved);
        return false;
      }
      syncEventSave(persistEventResources({ playerTeam: team, inventoryItemIds: items.map((item) => item.id) }, saved.baseInventory.revision));
      return true;
    } catch (error) {
      console.error('Event item could not be saved', error);
      return false;
    }
  }, [syncEventSave]);

  const syncWallet = useCallback((wallet: FactoryWallet) => {
    walletRef.current = wallet;
    setCoins(wallet.balance);
  }, []);

  const syncRunSupply = useCallback((supply: FactoryRunSupply) => {
    runSupplyRef.current = supply;
    setSupplyTickets(supply.tickets);
  }, []);

  const beginWalletRun = useCallback((devBonus = 0, startingStage = 1) => {
    const wallet = beginFactoryWalletRun(getCurrentSaveDraft(), devBonus, startingStage);
    const saved = loadSaveData();
    if (!saved || saved.wallet.currentRunId !== wallet.currentRunId) {
      throw new Error('New factory run could not be verified after saving.');
    }
    syncWallet(wallet);
    syncRunSupply(saved.runSupply);
    syncEventSave(saved);
  }, [getCurrentSaveDraft, syncRunSupply, syncWallet, syncEventSave]);

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
    syncRunSupply(settlement.runSupply);
    return settlement;
  }, [getCurrentSaveDraft, syncRunSupply, syncWallet]);

  const commitNextBattleStart = useCallback((start: Parameters<typeof commitFactoryBattleStart>[1]) => {
    const runId = walletRef.current.currentRunId;
    if (!runId) throw new Error('Factory run is unavailable.');
    const checkpoint = commitFactoryBattleStart(runId, start);
    battleResumeSnapshotRef.current = checkpoint;
    setHasFactoryRunToResume(false);
    // 返回落盘后的队伍：事务层可能规整过返还基准，调用方须回写内存（见 `useFactoryFlow.nextFactoryStage`）。
    return checkpoint;
  }, []);

  const battleController = useBattleController({
    gameState,
    turn,
    isMessageProcessing,
    setRoundTransactionActive,
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
    tailwindTurns,
    hazards,
    stage,
    streak,
    enemyAiTier,
    specialModeUnlocked,
    specialBossBattleActive,
    isFrontierBrain: currentEnemyTrainer?.id === FACTORY_BRAIN_TRAINER_ID,
    battleSpecialUsage,
    enemySpecialUsage,
    allowWildCatch: eventBattleActive,
    commitBallAttempt,
    commitEventItemUse,
    baseBallCounts: baseInventory.balls,
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
    setTailwindTurns,
    setHazards,
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
      tailwindTurns,
      hazards,
      activeBuffs,
      enemyBuffs,
    },
    commitNextBattleStart,
    currentEnemyTrainer,
    t,
    getLocalized,
    addMessagesSequentially: battleController.addMessagesSequentially,
    setLoading,
    setOpponentLoadError,
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
    setTailwindTurns,
    setHazards,
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
    if (eventBattleActive || !(['BATTLE', 'ROUND_RESULT', 'FACTORY_SWAP', 'REWARD'].includes(gameState) || (gameState === 'BASE' && hasFactoryRunToResume))) {
      battleResumeSnapshotRef.current = null;
      // 本局已结束 / 尚未开战（含**新挑战开始**）⇒ 复位提示，不让上一局的规整提示跨 run 残留。
      setHeldItemRepairNotice((prev) => (prev.repaired || prev.dismissed ? { repaired: false, dismissed: false } : prev));
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
    const permanent = normalizePermanentCollection(collectionLedger, companionSpeciesId);
    permanent.seenIds.forEach((id) => seenIds.add(id));
    const formKeys = new Set<string>(normalizeStoredFormKeys(collectionLedger.formKeys));

    const registerSeen = (pokemon: GamePokemon) => {
      if (!Number.isFinite(pokemon.id) || pokemon.id <= 0) return;
      seenIds.add(pokemon.id);
      const formKey = createPokemonFormLedgerKey(pokemon);
      if (formKey) {
        formKeys.add(formKey);
      }
    };

    factoryRentals.forEach(registerSeen);
    enemyTeam.forEach(registerSeen);
    playerTeam.forEach(registerSeen);

    const nextSeenIds = [...seenIds].sort((a, b) => a - b);
    const nextOwnedIds = permanent.ownedIds;
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
      ...collectionLedger,
      seenIds: nextSeenIds,
      ownedIds: nextOwnedIds,
      formKeys: nextFormKeys,
    });
  }, [collectionLedger, companionSpeciesId, enemyTeam, factoryRentals, playerTeam]);

  const seenCount = collectionLedger.seenIds.length;
  const ownedCount = collectionLedger.ownedIds.length;
  const formCount = collectionLedger.formKeys.length;

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
      baseInventory: baseInventoryRef.current,
      wallet: walletRef.current,
      runSupply: runSupplyRef.current,
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
        pendingResults: eventPersistentRef.current?.pendingResults ?? {},
        completedResults: eventPersistentRef.current?.completedResults ?? {},
        resourceCheckpoint: eventPersistentRef.current?.resourceCheckpoint ?? null,
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

  useEffect(() => {
    if (skipExitPersistRef.current || saveBlocked || dispatchInFlightRef.current || factoryResumeActiveRef.current || !companionCommittedRef.current) return;
    if (!(gameState === 'BASE' || gameState === 'EVENTS' || eventBattleActive)) return;
    try {
      // A previous render must not promote its old resource snapshot to a newly committed revision.
      const expectedRevision = baseInventory.revision;
      if (baseInventoryRef.current.revision !== expectedRevision) return;
      const saved = persistEventResources({ playerTeam, inventoryItemIds: inventory.map((item) => item.id) }, expectedRevision);
      baseInventoryRef.current = saved.baseInventory;
      eventPersistentRef.current = saved.events;
      if (saved.baseInventory.revision !== expectedRevision) setBaseInventory(saved.baseInventory);
    } catch (error) {
      console.error('Event resources could not be saved', error);
    }
  }, [playerTeam, inventory, gameState, eventBattleActive, saveBlocked, baseInventory.revision]);

  currentSaveBuilderRef.current = buildCurrentSaveData;

  useEffect(() => {
    try {
      if (skipExitPersistRef.current || saveBlocked || isTransitioning || loading || trainerIntroActive || trainerIntroAwaitingContinue) return;
      persistSaveData(buildCurrentSaveData());
    } catch (error) {
      console.error('Auto save failed', error);
    }
  }, [buildCurrentSaveData, isTransitioning, loading, saveBlocked, trainerIntroActive, trainerIntroAwaitingContinue]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const persistCurrentState = () => {
      try {
        if (skipExitPersistRef.current) return;
        if (skipExitPersistRef.current || saveBlocked || isTransitioning || loading || trainerIntroActive || trainerIntroAwaitingContinue) return;
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
      const saved = bindCompanionToSave(buildCurrentSaveData(), speciesId);
      companionCommittedRef.current = speciesId;
      setCompanionSpeciesId(speciesId);
      setCollectionLedger(saved.collection);
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
    cancelReplacePokemon();
    setCurrentBaseTab('HOME');
    setGameState(companionCommittedRef.current === null ? 'COMPANION_SELECT' : 'BASE');
  }, [cancelReplacePokemon]);

  const openBaseTab = useCallback((tab: BaseTab) => {
    if (tab !== 'EVENTS') cancelReplacePokemon();
    if (companionCommittedRef.current === null) { setGameState('COMPANION_SELECT'); return; }
    setCurrentBaseTab(tab);
    setGameState('BASE');
  }, [cancelReplacePokemon]);

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
      // 奖励前那一战（组内第 3、6 胜后）先换怪/跳过再进奖励节点，此处不预取敌队。
      // 预取时带上玩家在队持有物做生成期排除（裁决补遗二），使换怪不会撞上唯一性不变量。
      if (!shouldEnterRewardAfterWinning(stage)) {
        void factoryFlow.prefetchEnemy(stage + 1, { blockedItemIds: getFactoryHeldItemInTeamIds(playerTeam) });
      }
      setPostBattleActionError(null);
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
      void factoryFlow.spawnEnemy(normalized, { blockedItemIds: getFactoryHeldItemInTeamIds(playerTeam) }).then((ready) => {
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
    setTailwindTurns({ player: 0, enemy: 0 });
    setHazards(createEmptyBattleHazards());
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
    setTailwindTurns({ player: 0, enemy: 0 });
    setHazards(createEmptyBattleHazards());
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
      // 奖励前那一战（组内第 3、6 胜后）的「跳过换怪」：先落盘 PENDING，再进奖励节点。
      if (gameState === 'FACTORY_SWAP' && shouldEnterRewardAfterWinning(stage)) {
        try {
          const checkpoint = commitFactoryRewardPending(walletRef.current.currentRunId ?? '', stage, playerTeam, false);
          battleResumeSnapshotRef.current = checkpoint;
          setPlayerTeam(checkpoint.playerTeam);
          setRewardCheckpoint(checkpoint.rewardCheckpoint ?? null);
          setRewardPrepareError(null);
          setPostBattleActionError(null);
          setGameState('REWARD');
          return true;
        } catch (error) {
          console.error('Reward checkpoint save failed', error);
          setPostBattleActionError(currentLanguage.startsWith('zh')
            ? '奖励进度保存失败，请重试。'
            : 'Could not save reward progress. Please retry.');
          return false;
        }
      }
      const ready = await factoryFlow.nextFactoryStage();
      return ready;
    });
  }, [currentLanguage, factoryFlow, gameState, hasFactoryRunToResume, playerTeam, roundResult, stage]);

  const performSwap = useCallback(async (playerIdx: number, enemyIdx: number) => {
    if (!canAdvanceClassicStage(stage, gameState, roundResult, hasFactoryRunToResume)) return;
    if (!Number.isInteger(playerIdx) || playerIdx < 0 || playerIdx >= playerTeam.length) return;
    if (!Number.isInteger(enemyIdx) || enemyIdx < 0 || enemyIdx >= enemyTeam.length) return;
    // 三人返还基准互不重复是**全任务不变量**（PRD 边界 + 裁决补遗一）：
    // 守卫挂在**每一次**换怪上（组内第 1–6 胜后都进 FACTORY_SWAP），不只在奖励前那一战。
    // 会让基准重复的组合直接禁用并说明（不自动替换、不丢弃原配）。
    if (getFactorySwapEquippedItemConflict(playerTeam, enemyTeam, playerIdx, enemyIdx)) {
      setPostBattleActionError(currentLanguage.startsWith('zh')
        ? '换入成员的本局装备与留下队员重复，请改选组合或跳过换怪。'
        : 'The incoming member has the same equipped item as a remaining teammate. Choose another swap or skip.');
      return;
    }
    setPostBattleActionError(null);
    const actionKey = `${walletRef.current.currentRunId}:${stage}:${gameState}`;
    await classicAdvanceGateRef.current(actionKey, async () => {
      const swappedTeam = await factoryFlow.performSwap(playerIdx, enemyIdx);
      if (!swappedTeam) return false;
      if (shouldEnterRewardAfterWinning(stage)) {
        try {
          const checkpoint = commitFactoryRewardPending(walletRef.current.currentRunId ?? '', stage, swappedTeam, true);
          battleResumeSnapshotRef.current = checkpoint;
          setPlayerTeam(checkpoint.playerTeam);
          setSwapCount(checkpoint.swapCount);
          setTotalRents(checkpoint.totalRents);
          setRewardCheckpoint(checkpoint.rewardCheckpoint ?? null);
          setRewardPrepareError(null);
          setPostBattleActionError(null);
          setGameState('REWARD');
          return true;
        } catch (error) {
          console.error('Reward checkpoint save failed', error);
          setPostBattleActionError(currentLanguage.startsWith('zh')
            ? '奖励进度保存失败，请重试。'
            : 'Could not save reward progress. Please retry.');
          return false;
        }
      }
      const ready = await factoryFlow.nextFactoryStage(swappedTeam);
      if (ready) factoryFlow.commitSwap(swappedTeam);
      return ready;
    });
  }, [currentLanguage, enemyTeam, factoryFlow, gameState, hasFactoryRunToResume, playerTeam, roundResult, stage]);

  const clearPostBattleActionError = useCallback(() => setPostBattleActionError(null), []);

  /** 兑换商店购买：先扣券、再交货（单次落盘原子）；同步门闩保证双击/连点只扣一次券。 */
  const purchaseFactoryShopItem = useCallback(async (itemId: FactoryRewardHeldItemId, targetIndex: number): Promise<boolean> => {
    if (rewardClaimInFlightRef.current || gameState !== 'REWARD'
      || battleResumeSnapshotRef.current?.phase !== 'REWARD'
      || battleResumeSnapshotRef.current.rewardCheckpoint?.status !== 'READY') return false;
    rewardClaimInFlightRef.current = true;
    setRewardClaimBusy(true);
    try {
      const { resume, runSupply } = commitFactoryShopPurchase(walletRef.current.currentRunId ?? '', stage, itemId, targetIndex);
      battleResumeSnapshotRef.current = resume;
      setPlayerTeam(resume.playerTeam);
      setRewardCheckpoint(resume.rewardCheckpoint ?? null);
      syncRunSupply(runSupply);
      setRewardClaimError(null);
      return true;
    } catch (error) {
      console.error('Factory shop purchase failed', error);
      setRewardClaimError(currentLanguage.startsWith('zh')
        ? '兑换失败：券不足、队员不合法或保存出错。未扣券、未装备，请重试。'
        : 'Purchase failed: not enough tickets, an invalid teammate, or a save error. Nothing was spent or equipped. Retry.');
      return false;
    } finally {
      rewardClaimInFlightRef.current = false;
      setRewardClaimBusy(false);
    }
  }, [currentLanguage, gameState, stage, syncRunSupply]);

  const purchaseFactoryEvolutionItem = useCallback(async (
    itemId: FactoryEvolutionItemId, targetIndex: number, toSpeciesId: number, toPokeApiName: string,
  ): Promise<boolean> => {
    const snapshot = battleResumeSnapshotRef.current;
    if (rewardClaimInFlightRef.current || gameState !== 'REWARD' || snapshot?.phase !== 'REWARD'
      || snapshot.rewardCheckpoint?.status !== 'READY') return false;
    const product = snapshot.rewardCheckpoint.shelf.find((entry) => entry.kind === 'EVOLUTION_ITEM' && entry.itemId === itemId);
    const target = product?.kind === 'EVOLUTION_ITEM'
      ? product.targets.find((entry) => entry.targetIndex === targetIndex && entry.toSpeciesId === toSpeciesId
        && entry.toPokeApiName === toPokeApiName)
      : undefined;
    if (!target) return false;
    rewardClaimInFlightRef.current = true;
    setRewardClaimBusy(true);
    try {
      const evolved = await buildEvolvedFactoryPokemon(snapshot.playerTeam[targetIndex], toSpeciesId, target.toPokeApiName);
      if (battleResumeSnapshotRef.current !== snapshot || walletRef.current.currentRunId !== snapshot.rewardCheckpoint.runId) {
        throw new Error('Shop changed while evolution resources were loading.');
      }
      const evolvedTeam = snapshot.playerTeam.map((pokemon, index) => index === targetIndex ? evolved : pokemon);
      const { resume, runSupply } = commitFactoryEvolutionPurchase(
        snapshot.rewardCheckpoint.runId, snapshot.rewardCheckpoint.stage, itemId, targetIndex, toSpeciesId, toPokeApiName, evolvedTeam,
      );
      battleResumeSnapshotRef.current = resume;
      setPlayerTeam(resume.playerTeam);
      setRewardCheckpoint(resume.rewardCheckpoint ?? null);
      syncRunSupply(runSupply);
      setRewardClaimError(null);
      return true;
    } catch (error) {
      console.error('Factory evolution purchase failed', error);
      setRewardClaimError(currentLanguage.startsWith('zh')
        ? '进化兑换失败，进度与兑换券未改变。请检查目标或网络后重试。'
        : 'Evolution purchase failed. No tickets or progress changed. Check the target or network and retry.');
      return false;
    } finally {
      rewardClaimInFlightRef.current = false;
      setRewardClaimBusy(false);
    }
  }, [currentLanguage, gameState, syncRunSupply]);

  const clearFactoryItemRewardError = useCallback(() => setRewardClaimError(null), []);

  /** 离开商店（可一件不买）→ 落盘「继续意图」（幂等）→ 起下一战。 */
  const continueAfterFactoryReward = useCallback(async () => {
    if (gameState !== 'REWARD' || battleResumeSnapshotRef.current?.phase !== 'REWARD') return;
    const checkpointStatus = battleResumeSnapshotRef.current.rewardCheckpoint?.status;
    if (checkpointStatus !== 'READY' && checkpointStatus !== 'CLAIMED') return;
    const runId = walletRef.current.currentRunId ?? '';
    const actionKey = `${runId}:${stage}:REWARD`;
    await classicAdvanceGateRef.current(actionKey, async () => {
      setRewardContinueBusy(true);
      try {
        const checkpoint = commitFactoryRewardContinueIntent(runId, stage);
        battleResumeSnapshotRef.current = checkpoint;
        setRewardCheckpoint(checkpoint.rewardCheckpoint ?? null);
        setRewardContinueError(null);
        const ready = await factoryFlow.nextFactoryStage();
        if (!ready) {
          setRewardContinueError(currentLanguage.startsWith('zh')
            ? '下一场战斗加载失败，请重试。'
            : 'Could not load the next battle. Please retry.');
        }
        return ready;
      } catch (error) {
        console.error('Factory reward continuation failed', error);
        setRewardContinueError(currentLanguage.startsWith('zh')
          ? '进度保存失败，请检查存储空间后重试。'
          : 'Could not save progress. Check storage and retry.');
        return false;
      } finally {
        setRewardContinueBusy(false);
      }
    });
  }, [currentLanguage, factoryFlow, gameState, stage]);

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
    cancelReplacePokemon();
    if (companionCommittedRef.current === null) { setGameState('COMPANION_SELECT'); return; }
    setPendingRunSummary(null);
    setCurrentBaseTab('HOME');

    if (hasFactoryRunToResume) {
      await nextFactoryStage();
      return;
    }

    await startGame();
  }, [cancelReplacePokemon, hasFactoryRunToResume, nextFactoryStage, startGame]);

  const endPausedFactoryRun = useCallback(() => {
    const runId = walletRef.current.currentRunId;
    if (gameState !== 'BASE' || !hasFactoryRunToResume || !runId
      || !hasRecoverableFactoryBaseCheckpoint(battleResumeSnapshotRef.current, runId)) return false;
    try {
      const wallet = endFactoryWalletRun(buildCurrentSaveData(), runId);
      syncWallet(wallet);
      syncRunSupply(createEmptyRunSupply());
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
  }, [buildCurrentSaveData, clearFactoryEncounter, gameState, hasFactoryRunToResume, syncRunSupply, syncWallet]);
  const setEventDispatchPokemon = useCallback((regionId: string, pokemonId: number | null) => {
    if (factoryResumeActiveRef.current) return;
    if (!EVENT_REGIONS.some((region) => region.id === regionId)) return;
    if (pokemonId !== null && !loadSaveData()?.collection.ownedIds.includes(pokemonId)) return;
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

  const resolveDispatchRegion = useCallback(async (regionId: string, dispatchStartedAt: number) => {
    const expectedContext = dispatchContextRef.current;
    const assertCurrentDispatch = () => {
      if (!isDispatchContextCurrent() || dispatchContextRef.current !== expectedContext || skipExitPersistRef.current) throw new StaleDispatchError();
    };
    assertCurrentDispatch();
    const region = EVENT_REGIONS.find((entry) => entry.id === regionId);
    if (!region) return '派遣失败：未知地区';

    const selectedPokemonId = eventDispatchPokemonByRegion[regionId];
    if (!selectedPokemonId) return '请先选择一只已拥有的派遣宝可梦';

    const selectedPokemonData = await fetchPokemon(selectedPokemonId);
    assertCurrentDispatch();
    const selectedTypes = selectedPokemonData.types.map((slot) => slot.type.name);
    const matched = region.requiredTypes.some((type) => selectedTypes.includes(type));
    if (!matched) {
      return `${region.name}: 当前选择的宝可梦属性不匹配地区要求`;
    }

    const key = getDispatchAcquisitionId(regionId, dispatchStartedAt);
    const storedPending = loadSaveData()?.events.pendingResults[key];
    let prepared = storedPending ?? preparedDispatchRef.current[key];
    if (!prepared) {
      const outcome = rollDispatchOutcome(region.category);
      prepared = { key, regionId, startedAt: dispatchStartedAt, selectedPokemonId, outcome,
        growthItemId: outcome === 'item' ? pickGrowthRewardItem().id : null };
      preparedDispatchRef.current[key] = prepared;
    }
    const preparedSave = prepareDispatchResult(prepared);
    syncEventSave(preparedSave);
    const pending = preparedSave.events.pendingResults[key];
    if (!pending) return preparedSave.events.completedResults[key]?.result ?? '';
    const outcome = pending.outcome;
    const complete = (result: string, team = eventRuntimeRef.current.playerTeam, items = eventRuntimeRef.current.inventory) => {
      assertCurrentDispatch();
      const committed = commitDispatchResult({ key, result, resources: { playerTeam: team, inventoryItemIds: items.map((item) => item.id) } });
      syncEventSave(committed.save, true);
      return result;
    };
    if (outcome === 'item') {
      const rewardItem = ALL_ITEMS.find((item) => item.id === pending.growthItemId);
      if (!rewardItem) throw new Error('Dispatch reward is unavailable.');
      const rewardName = getEventItemLabel(rewardItem);
      const training = applyDispatchTrainingToTeam(eventRuntimeRef.current.playerTeam, selectedPokemonId, region);
      const trainingText = training.trained
        ? t('dispatchTrainingGain', { stat: getStatLabel(training.stat), count: training.evGain })
        : t('dispatchTrainingSkipped');
      const result = t('dispatchItemAndBalls', { region: region.name, item: rewardName, count: DISPATCH_ITEM_BALL_REWARD, training: trainingText });
      complete(result, training.team, [...eventRuntimeRef.current.inventory, rewardItem]);
      setEventDispatchPopup({ kind: 'ITEM', title: t('dispatchCompleted'), message: result, itemName: rewardName, itemId: rewardItem.id });
      return result;
    }

    const [dexMin, dexMax] = region.dexRange;
    const regionalPool = Array.from({ length: dexMax - dexMin + 1 }, (_, index) => dexMin + index);
    const sampledBaseSpecies: number[] = [];
    const maxAttempts = Math.min(80, regionalPool.length);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = regionalPool[Math.floor(Math.random() * regionalPool.length)];
      if (!candidate) continue;
      if (await isEvolutionChainBaseSpecies(candidate)) {
        assertCurrentDispatch();
        sampledBaseSpecies.push(candidate);
      }
    }
    const initialFormPool = [...new Set(sampledBaseSpecies)];
    const rarePool = RARE_SPECIES_POOL.filter((speciesId) => speciesId >= dexMin && speciesId <= dexMax);
    const useRarePool = region.category === 'rare_hunt' && rarePool.length > 0;
    const commonTargetPool = useRarePool ? rarePool : initialFormPool;
    if (commonTargetPool.length === 0) {
      return complete(`${region.name}: 没有可用的地区基础形态目标`);
    }

    if (outcome === 'join') {
      const joinIdentifier = commonTargetPool[Math.floor(Math.random() * commonTargetPool.length)];
      if (!joinIdentifier) return complete(`${region.name}: 生成目标失败`);
      const targetPokemon = await getProcessedPokemon(joinIdentifier, Math.max(20, startLevel));
      assertCurrentDispatch();
      const live = eventRuntimeRef.current;
      if (!BASE_BALL_IDS.some((id) => (loadSaveData()?.baseInventory.balls[id] ?? 0) > 0)) return complete(t('baseNoBalls'));

      const joinedParty = live.playerTeam.length < 6;
      const targetName = getLocalized(targetPokemon);
      const trainingResult = applyDispatchTrainingToTeam(live.playerTeam, selectedPokemonId, region);
      const trainingText = trainingResult.trained
        ? `派遣宝可梦获得 ${getStatLabel(trainingResult.stat)} +${trainingResult.evGain} 努力值`
        : '派遣宝可梦不在当前队伍，训练收益已跳过。';
      const resultText = `${region.name}: ${targetName}${joinedParty ? '加入队伍' : '进入图鉴后备名册'}；${trainingText}`;
      const acquiredAt = Date.now();
      const nextTeam = joinedParty ? [...trainingResult.team, targetPokemon] : trainingResult.team;
      const committed = commitDispatchResult({ key, result: resultText,
        resources: { playerTeam: nextTeam, inventoryItemIds: live.inventory.map((item) => item.id) },
        acquisition: { acquisitionId: key, speciesId: targetPokemon.id, source: 'DISPATCH_JOIN', regionId, dispatchStartedAt, acquiredAt },
      });
      syncEventSave(committed.save, true);
      if (!committed.applied) return committed.save.events.completedResults[key].result;
      const rosterText = joinedParty ? '已加入当前队伍。' : '队伍已满，已登记到图鉴后备名册。';
      setEventDispatchPopup({
        kind: 'POKEMON',
        title: `${region.name}奇遇成功`,
        message: `「${targetName}」认可了你的队伍，${rosterText} ${trainingText}`,
        pokemonName: targetName,
        pokemonSprite: targetPokemon.sprites.front_default ?? '',
        pokemonLevel: targetPokemon.level,
      });
      return resultText;
    }

    if (!BASE_BALL_IDS.some((id) => (loadSaveData()?.baseInventory.balls[id] ?? 0) > 0)) return complete(t('baseNoBalls'));

    const specialEncounter = pickSpecialSiteEncounter(regionId);
    const battleIdentifier = specialEncounter?.speciesId ?? commonTargetPool[Math.floor(Math.random() * commonTargetPool.length)];
    if (!battleIdentifier) return complete(`${region.name}: 生成遭遇失败`);
    const battleLevel = Math.max(20, specialEncounter?.site.minLevel ?? startLevel);
    const targetPokemon = await getProcessedPokemon(battleIdentifier, battleLevel);
    assertCurrentDispatch();

    const battleResult = specialEncounter
      ? `${region.name}: 特殊事件地点 ${specialEncounter.site.name}，遭遇 ${getLocalized(targetPokemon)}`
      : `${region.name}: 遭遇战斗 ${getLocalized(targetPokemon)}`;
    complete(battleResult);
    eventRuntimeRef.current.eventBattleActive = true;
    setCatchSuccess(null);
    setEventBattleActive(true);
    setEventBattleContext({
      regionId,
      selectedPokemonId,
      targetPokemonId: targetPokemon.id,
      specialSiteName: specialEncounter?.site.name,
      dispatchStartedAt,
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
    setTailwindTurns({ player: 0, enemy: 0 });
    setHazards(createEmptyBattleHazards());
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
    getCurrentSaveDraft,
    isDispatchContextCurrent,
    pickGrowthRewardItem,
    pickSpecialSiteEncounter,
    syncEventSave,
    t,
    startLevel,
  ]);
  const dispatchEventRegion = useCallback(async (regionId: string) => {
    if (!isDispatchContextCurrent() || dispatchInFlightRef.current) return;
    dispatchInFlightRef.current = true;
    try {
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
          if (!isDispatchContextCurrent()) return;
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
          if (!isDispatchContextCurrent()) return;
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

      if (current.startedAt === null) throw new Error('Dispatch start time is missing.');
      const stored = loadSaveData();
      if (stored?.events.completedResults[getDispatchAcquisitionId(regionId, current.startedAt)]) {
        syncEventSave(stored);
        return;
      }
      await resolveDispatchRegion(regionId, current.startedAt);
    } catch (error) {
      if (error instanceof StaleDispatchError) return;
      console.error('Dispatch result could not be saved', error);
      setEventDispatches((prev) => ({
        ...prev,
        [regionId]: { ...(prev[regionId] ?? createDefaultDispatchState()), lastResult: t('dispatchSaveFailed') },
      }));
    } finally {
      dispatchInFlightRef.current = false;
    }
  }, [eventDispatchPokemonByRegion, eventDispatches, isDispatchContextCurrent, resolveDispatchRegion, syncEventSave, t]);

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
      // 导入已落盘，随后的 reload 会触发 beforeunload / visibilitychange 的退出存档；
      // 若不跳过，退出存档会用导入前的内存旧状态覆盖导入结果。
      skipExitPersistRef.current = true;
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
    supplyTickets,
    rewardChoiceMade,
    rerollCount,
    playerTeam,
    rewards,
    rewardCheckpointStatus: gameState === 'REWARD' && rewardCheckpoint ? rewardCheckpoint.status : null,
    rewardCheckpoint: gameState === 'REWARD' ? rewardCheckpoint : null,
    activeBuffs,
    weather,
    weatherTurns,
    fieldState,
    fieldTurns,
    tailwindTurns,
    hazards,
    isTransitioning,
    trainerIntroActive,
    trainerIntroAwaitingContinue,
    isMessageProcessing,
    roundTransactionActive,
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
    opponentLoadError,
    postBattleActionError,
    rewardClaimError,
    rewardClaimBusy,
    rewardContinueError,
    rewardContinueBusy,
    rewardPrepareError,
    // 返还基准被规整过的如实提示（可关闭，但不会被静默吞掉）。
    heldItemBaselineRepaired: heldItemRepairNotice.repaired && !heldItemRepairNotice.dismissed,
    dismissHeldItemRepairNotice: () => setHeldItemRepairNotice((prev) => (prev.dismissed ? prev : { ...prev, dismissed: true })),
    bootProgress,
    canEnterProject,
    bootStatusText,
    inventory,
    baseBallCounts: baseInventory.balls,
    eventBattleActive,
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
    clearPostBattleActionError,
    nextFactoryStage,
    useItem: battleController.useItem,
    switchPokemon: battleController.switchPokemon,
    handleAttack: battleController.handleAttack,
    triggerBattleSpecial: battleController.triggerBattleSpecial,
    // 奖励节点期间旧奖池路径全部短路（PRD：旧奖池只需不再使用）。
    rerollRewards: gameState === 'REWARD' ? async () => {} : rewardFlow.rerollRewards,
    nextStage: gameState === 'REWARD' ? async () => {} : rewardFlow.nextStage,
    selectReward: gameState === 'REWARD' ? () => {} : rewardFlow.selectReward,
    purchaseFactoryShopItem,
    purchaseFactoryEvolutionItem,
    continueAfterFactoryReward,
    clearFactoryItemRewardError,
    retryFactoryItemRewardPrepare,
    startLearningMove: rewardFlow.startLearningMove,
    handleLearnMove: rewardFlow.handleLearnMove,
    replaceMove: rewardFlow.replaceMove,
    startEvolution: rewardFlow.startEvolution,
    performEvolution: rewardFlow.performEvolution,
    replacePokemon: replaceCollectedPokemon,
    cancelReplacePokemon,
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


