import type { FieldState, FieldTurns, GamePokemon } from '../types';
import { getBattleIndexInSet, getFactoryGroupBp, getSetNoByStage, MAX_FACTORY_BP } from '../features/game/config/factoryRewards';
import { getFactoryTrainerTemplateById } from '../features/game/config/factoryTrainerTemplates';
import { isCompanionSpeciesId, type CompanionSpeciesId } from '../features/game/config/companionCandidates';
import { hasRecoverableFactoryBaseCheckpoint } from '../features/game/hooks/factoryResumeCheckpoint';
import { isKnownFactoryHeldItemId } from '../features/game/data/battle';
import { restoreFactoryParty } from '../features/game/utils/restoreFactoryParty';

const SAVE_STORAGE_KEY = 'pokefactory_save_v1';
const PENDING_SETTLEMENT_KEY = 'pokefactory_pending_settlement_v1';
const SAVE_SCHEMA_VERSION = 12 as const;

export type SaveInspection =
  | { kind: 'none' }
  | { kind: 'valid'; raw: string; save: GameSaveData }
  | { kind: 'legacy'; raw: string; version: unknown }
  | { kind: 'unreadable'; raw: string; reason: 'invalid_json' }
  | { kind: 'corrupt'; raw: string; reason: string };

export interface FactoryWallet {
  balance: number;
  revision: number;
  currentRunId: string | null;
  brainSymbols: number;
  settledThrough: number;
  lastSettlement: {
    runId: string;
    setNo: number;
    stage: number;
    result: 'WIN' | 'LOSS';
    isFrontierBrain: boolean;
    nominalBp: number;
    amount: number;
    settledAt: string;
  } | null;
}

export interface PendingFactorySettlement {
  runId: string;
  stage: number;
  result: 'WIN' | 'LOSS';
  isFrontierBrain: boolean;
}

export interface BattleResumeSpecialUsageState {
  MEGA: boolean;
  DYNAMAX: boolean;
  TERA: boolean;
  ZMOVE: boolean;
}

export interface EmptyBattleResume {
  status: 'EMPTY';
}

export interface BattleResumeSnapshot {
  status: 'READY';
  battleKind: 'FACTORY';
  checkpointAt: string;
  stage: number;
  streak: number;
  swapCount: number;
  coins: number;
  totalRents: number;
  enemyAiTier: 'RANDOM' | 'BASIC' | 'ADVANCED' | 'BOSS';
  specialModeUnlocked: boolean;
  specialBossBattleActive: boolean;
  battleSpecialUsage: BattleResumeSpecialUsageState;
  enemySpecialUsage: BattleResumeSpecialUsageState;
  turn: 'PLAYER' | 'ENEMY';
  battleMenuTab: 'MAIN' | 'MOVES' | 'POKEMON' | 'BAG' | 'STATUS';
  weather: 'none' | 'sunny' | 'rainy' | 'sandstorm' | 'hail';
  weatherTurns: number;
  fieldState: FieldState[];
  fieldTurns: FieldTurns;
  activeBuffs: { atk: boolean; def: boolean };
  enemyBuffs: { atk: boolean; def: boolean };
  factoryRentals: GamePokemon[];
  selectedRentalIndices: number[];
  playerTeam: GamePokemon[];
  enemyTeam: GamePokemon[];
  currentEnemyTrainerId: string | null;
  inventoryItemIds: string[];
  battleLog: string[];
  phase: 'BATTLE' | 'ROUND_RESULT' | 'FACTORY_SWAP' | 'BASE';
  roundResult: 'WIN' | 'LOSS' | null;
  lastBpGain: number;
}

export type FactoryBattleResume = EmptyBattleResume | BattleResumeSnapshot;

export function createEmptyBattleResume(): EmptyBattleResume {
  return { status: 'EMPTY' };
}

export interface CollectionLedger {
  seenIds: number[];
  ownedIds: number[];
  formKeys: string[];
}

export interface GameSaveData {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  updatedAt: string;
  wallet: FactoryWallet;
  progress: {
    totalRents: number;
    highestStreak: number;
    specialModeUnlocked: boolean;
    companionSpeciesId: CompanionSpeciesId | null;
  };
  settings: {
    currentLanguage: string;
    selectedGens: number[];
    startLevel: number;
    developerMode: boolean;
  };
  factory: {
    challengeStatus: number;
    curChallengeBattleNum: number;
    challengePaused: boolean;
    disableRecordBattle: boolean;
    winStreakActiveFlags: number;
    winStreakActiveMasks: number;
    trainerIdsBySet: Array<{
      setNo: number;
      trainerIds: string[];
    }>;
    battleResume: FactoryBattleResume;
  };
  collection: CollectionLedger;
  events: {
    speciesBattleCounts: Record<string, number>;
    dispatchPokemonByRegion: Record<string, number | null>;
    dispatches: Record<string, {
      status: 'IDLE' | 'RUNNING' | 'READY';
      startedAt: number | null;
      readyAt: number | null;
      lastResolvedAt: number | null;
      lastResult: string;
    }>;
  };
}

interface SaveDraftInput {
  wallet: FactoryWallet;
  companionSpeciesId: CompanionSpeciesId | null;
  totalRents: number;
  highestStreak: number;
  specialModeUnlocked: boolean;
  currentLanguage: string;
  selectedGens: number[];
  startLevel: number;
  developerMode: boolean;
  factory: GameSaveData['factory'];
  collection: CollectionLedger;
  events: GameSaveData['events'];
}

const NON_VOLATILE_STATUS_IDS = new Set([
  'sleep',
  'poison',
  'bad_poison',
  'burn',
  'paralysis',
  'freeze',
]);

const STATUS_ALIAS_MAP: Record<string, string> = {
  badly_poisoned: 'bad_poison',
  paralyzed: 'paralysis',
  toxic: 'bad_poison',
};

const DEFAULT_STAT_STAGES: GamePokemon['statStages'] = {
  attack: 0,
  defense: 0,
  spAtk: 0,
  spDef: 0,
  speed: 0,
  accuracy: 0,
  evasion: 0,
};

function sanitizePositiveInt(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function sanitizeSafeNonNegativeInt(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

export function createEmptyWallet(): FactoryWallet {
  return {
    balance: 0,
    revision: 0,
    currentRunId: null,
    brainSymbols: 0,
    settledThrough: 0,
    lastSettlement: null,
  };
}

function sanitizeWallet(value: unknown): FactoryWallet {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const settlement = source.lastSettlement && typeof source.lastSettlement === 'object'
    ? (source.lastSettlement as Record<string, unknown>)
    : {};
  const currentRunId = typeof source.currentRunId === 'string' && source.currentRunId.length > 0 && source.currentRunId.length <= 160
    ? source.currentRunId
    : null;
  const stage = sanitizeSafeNonNegativeInt(settlement.stage);
  const setNo = sanitizeSafeNonNegativeInt(settlement.setNo);
  const lastSettlement = currentRunId && settlement.runId === currentRunId && stage > 0
    && setNo === getSetNoByStage(stage)
    && (settlement.result === 'WIN' || settlement.result === 'LOSS')
    ? {
        runId: currentRunId,
        setNo,
        stage,
        result: settlement.result as 'WIN' | 'LOSS',
        isFrontierBrain: settlement.isFrontierBrain === true,
        nominalBp: sanitizeSafeNonNegativeInt(settlement.nominalBp),
        amount: sanitizeSafeNonNegativeInt(settlement.amount),
        settledAt: typeof settlement.settledAt === 'string' ? settlement.settledAt : '',
      }
    : null;
  return {
    balance: Math.min(MAX_FACTORY_BP, sanitizeSafeNonNegativeInt(source.balance)),
    revision: sanitizeSafeNonNegativeInt(source.revision),
    currentRunId,
    brainSymbols: Math.min(2, sanitizeSafeNonNegativeInt(source.brainSymbols)),
    settledThrough: currentRunId ? sanitizeSafeNonNegativeInt(source.settledThrough) : 0,
    lastSettlement,
  };
}

function sanitizeIntArray(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map((value) => (typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : NaN))
    .filter((value) => Number.isFinite(value) && value > 0);
  return [...new Set(normalized)];
}

function sanitizeGenerationSelection(values: unknown): number[] {
  if (!Array.isArray(values) || values.length !== 1) return [1];
  const generation = values[0];
  return typeof generation === 'number' && Number.isInteger(generation) && generation >= 1 && generation <= 9
    ? [generation]
    : [1];
}

function sanitizeNonNegativeIntList(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : NaN))
    .filter((value) => Number.isFinite(value) && value >= 0);
}

function sanitizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);
  return [...new Set(normalized)];
}

function sanitizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);
}

function sanitizeLanguage(value: unknown, fallback = 'zh-hans') {
  if (typeof value !== 'string' || value.trim().length === 0) return fallback;
  return value.trim();
}

function sanitizeUnsignedInt(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback >>> 0;
  return (Math.floor(value) >>> 0);
}

function sanitizeSpecialUsage(value: unknown): BattleResumeSpecialUsageState {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    MEGA: Boolean(source.MEGA),
    DYNAMAX: Boolean(source.DYNAMAX),
    TERA: Boolean(source.TERA),
    ZMOVE: Boolean(source.ZMOVE),
  };
}

function sanitizeAtkDefFlags(value: unknown): { atk: boolean; def: boolean } {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    atk: Boolean(source.atk),
    def: Boolean(source.def),
  };
}

function sanitizeGamePokemonArray(value: unknown): GamePokemon[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => sanitizeGamePokemon(entry))
    .filter((entry): entry is GamePokemon => Boolean(entry));
}

function normalizeStatusId(value: unknown) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase().replace(/-/g, '_');
  return STATUS_ALIAS_MAP[normalized] ?? normalized;
}

function sanitizeStatStages(value: unknown): GamePokemon['statStages'] {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const sanitizeStage = (key: keyof GamePokemon['statStages']) => {
    const raw = source[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
    return Math.max(-6, Math.min(6, Math.trunc(raw)));
  };
  return {
    attack: sanitizeStage('attack'),
    defense: sanitizeStage('defense'),
    spAtk: sanitizeStage('spAtk'),
    spDef: sanitizeStage('spDef'),
    speed: sanitizeStage('speed'),
    accuracy: sanitizeStage('accuracy'),
    evasion: sanitizeStage('evasion'),
  };
}

function sanitizeNonVolatileStatusState(value: unknown, legacyStatus?: unknown) {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const fallbackId = normalizeStatusId(legacyStatus);
  const id = normalizeStatusId(source.id) || (NON_VOLATILE_STATUS_IDS.has(fallbackId) ? fallbackId : '');
  if (!NON_VOLATILE_STATUS_IDS.has(id)) return undefined;

  const turnsRemaining = typeof source.turnsRemaining === 'number' && Number.isFinite(source.turnsRemaining)
    ? Math.max(0, Math.trunc(source.turnsRemaining))
    : undefined;
  const toxicCounter = typeof source.toxicCounter === 'number' && Number.isFinite(source.toxicCounter)
    ? Math.max(1, Math.trunc(source.toxicCounter))
    : id === 'bad_poison' ? 1 : undefined;
  const sourceMoveName = typeof source.sourceMoveName === 'string' && source.sourceMoveName.trim().length > 0
    ? source.sourceMoveName
    : undefined;

  return {
    id: id as NonNullable<GamePokemon['nonVolatileStatus']>['id'],
    turnsRemaining,
    toxicCounter,
    sourceMoveName,
  };
}

function sanitizeVolatileStatuses(value: unknown, legacyStatus?: unknown) {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const nextStatuses: NonNullable<GamePokemon['volatileStatuses']> = {};

  for (const [rawKey, rawEntry] of Object.entries(source)) {
    if (!rawEntry || typeof rawEntry !== 'object') continue;
    const entry = rawEntry as Record<string, unknown>;
    const id = normalizeStatusId(entry.id ?? rawKey);
    if (!id) continue;
    nextStatuses[id] = {
      id,
      active: entry.active !== false,
      turnsRemaining: typeof entry.turnsRemaining === 'number' && Number.isFinite(entry.turnsRemaining)
        ? Math.max(0, Math.trunc(entry.turnsRemaining))
        : undefined,
      counter: typeof entry.counter === 'number' && Number.isFinite(entry.counter)
        ? Math.max(0, Math.trunc(entry.counter))
        : undefined,
      sourceMoveName: typeof entry.sourceMoveName === 'string' && entry.sourceMoveName.trim().length > 0
        ? entry.sourceMoveName
        : undefined,
      linkedMoveName: typeof entry.linkedMoveName === 'string' && entry.linkedMoveName.trim().length > 0
        ? entry.linkedMoveName
        : undefined,
      linkedPokemonId: typeof entry.linkedPokemonId === 'number' && Number.isFinite(entry.linkedPokemonId)
        ? Math.trunc(entry.linkedPokemonId)
        : undefined,
    };
  }

  const legacyStatusId = normalizeStatusId(legacyStatus);
  if (legacyStatusId && !NON_VOLATILE_STATUS_IDS.has(legacyStatusId) && !nextStatuses[legacyStatusId]) {
    nextStatuses[legacyStatusId] = {
      id: legacyStatusId,
      active: true,
    };
  }

  return nextStatuses;
}

function sanitizeGamePokemon(value: unknown): GamePokemon | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const legacyStatus = source.status;
  const nonVolatileStatus = sanitizeNonVolatileStatusState(source.nonVolatileStatus, legacyStatus);
  const volatileStatuses = sanitizeVolatileStatuses(source.volatileStatuses, legacyStatus);

  return {
    ...(source as unknown as GamePokemon),
    currentHp: sanitizePositiveInt(source.currentHp, 0),
    maxHp: sanitizePositiveInt(source.maxHp, 1),
    baseTypes: Array.isArray(source.baseTypes)
      ? source.baseTypes as GamePokemon['baseTypes']
      : Array.isArray(source.types)
        ? source.types as GamePokemon['baseTypes']
        : [],
    selectedMoves: Array.isArray(source.selectedMoves) ? source.selectedMoves as GamePokemon['selectedMoves'] : [],
    factoryOriginalHeldItemId: source.factoryOriginalHeldItemId as string | null,
    factoryHeldItemId: typeof source.factoryHeldItemId === 'string' ? source.factoryHeldItemId : undefined,
    gender: source.gender === 'male' || source.gender === 'female' || source.gender === 'genderless'
      ? source.gender
      : undefined,
    nonVolatileStatus,
    volatileStatuses,
    statStages: sanitizeStatStages(source.statStages ?? DEFAULT_STAT_STAGES),
    factoryChoiceLockedMoveName: typeof source.factoryChoiceLockedMoveName === 'string'
      ? source.factoryChoiceLockedMoveName
      : null,
    factoryLastUsedMoveName: typeof source.factoryLastUsedMoveName === 'string'
      ? source.factoryLastUsedMoveName
      : null,
    factoryConsecutiveMoveCount: typeof source.factoryConsecutiveMoveCount === 'number' && Number.isFinite(source.factoryConsecutiveMoveCount)
      ? Math.max(0, Math.trunc(source.factoryConsecutiveMoveCount))
      : 0,
    friendship: typeof source.friendship === 'number' && Number.isFinite(source.friendship)
      ? Math.max(0, Math.min(255, Math.trunc(source.friendship)))
      : 70,
    factoryLastDamageReceived: typeof source.factoryLastDamageReceived === 'number' && Number.isFinite(source.factoryLastDamageReceived)
      ? Math.max(0, Math.trunc(source.factoryLastDamageReceived))
      : 0,
    factoryLastDamageCategory: source.factoryLastDamageCategory === 'physical' || source.factoryLastDamageCategory === 'special'
      ? source.factoryLastDamageCategory
      : undefined,
    factoryDamagedThisTurn: source.factoryDamagedThisTurn === true,
    factoryStockpileCount: typeof source.factoryStockpileCount === 'number' && Number.isFinite(source.factoryStockpileCount)
      ? Math.max(0, Math.min(3, Math.trunc(source.factoryStockpileCount)))
      : 0,
  };
}

const VALID_FIELD_STATES: FieldState[] = [
  'electric_terrain',
  'grassy_terrain',
  'misty_terrain',
  'psychic_terrain',
  'trick_room',
  'magic_room',
  'wonder_room',
  'gravity',
  'fairy_lock',
];

function isFieldState(value: unknown): value is FieldState {
  return typeof value === 'string' && VALID_FIELD_STATES.includes(value as FieldState);
}

function sanitizeFieldStateList(value: unknown): FieldState[] {
  if (Array.isArray(value)) {
    return [...new Set(value.filter(isFieldState))];
  }
  if (isFieldState(value)) {
    return [value];
  }
  return [];
}

function sanitizeFieldTurns(value: unknown, activeStates: FieldState[]): FieldTurns {
  if (typeof value === 'number' && Number.isFinite(value) && activeStates.length === 1) {
    return { [activeStates[0]]: Math.max(0, Math.floor(value)) };
  }
  if (!value || typeof value !== 'object') return {};

  const source = value as Record<string, unknown>;
  const normalized: FieldTurns = {};
  for (const field of activeStates) {
    const raw = source[field];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      normalized[field] = Math.floor(raw);
    }
  }
  return normalized;
}

function sanitizeBattleResume(value: unknown): FactoryBattleResume {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  if (source.status !== 'READY') {
    return createEmptyBattleResume();
  }

  const battleKind = source.battleKind === 'FACTORY' ? 'FACTORY' : null;
  const enemyAiTierRaw = typeof source.enemyAiTier === 'string' ? source.enemyAiTier : 'RANDOM';
  const enemyAiTier = enemyAiTierRaw === 'BASIC'
    || enemyAiTierRaw === 'ADVANCED'
    || enemyAiTierRaw === 'BOSS'
    ? enemyAiTierRaw
    : 'RANDOM';
  const turn = source.turn === 'ENEMY' ? 'ENEMY' : 'PLAYER';
  const battleMenuTab = source.battleMenuTab === 'MOVES'
    || source.battleMenuTab === 'POKEMON'
    || source.battleMenuTab === 'BAG'
    || source.battleMenuTab === 'STATUS'
    ? source.battleMenuTab
    : 'MAIN';
  const weather = source.weather === 'sunny'
    || source.weather === 'rainy'
    || source.weather === 'sandstorm'
    || source.weather === 'hail'
    ? source.weather
    : 'none';
  const fieldState = sanitizeFieldStateList(source.fieldState);
  const fieldTurns = sanitizeFieldTurns(source.fieldTurns, fieldState);
  const stage = sanitizePositiveInt(source.stage, 0);
  const playerTeam = sanitizeGamePokemonArray(source.playerTeam);
  const enemyTeam = sanitizeGamePokemonArray(source.enemyTeam);

  if (!battleKind || stage <= 0 || playerTeam.length === 0 || enemyTeam.length === 0) {
    return createEmptyBattleResume();
  }

  return {
    status: 'READY',
    battleKind,
    checkpointAt: typeof source.checkpointAt === 'string' && source.checkpointAt.length > 0
      ? source.checkpointAt
      : new Date().toISOString(),
    stage,
    streak: sanitizePositiveInt(source.streak, 0),
    swapCount: sanitizePositiveInt(source.swapCount, 0),
    coins: sanitizePositiveInt(source.coins, 0),
    totalRents: sanitizePositiveInt(source.totalRents, 0),
    enemyAiTier,
    specialModeUnlocked: Boolean(source.specialModeUnlocked),
    specialBossBattleActive: Boolean(source.specialBossBattleActive),
    battleSpecialUsage: sanitizeSpecialUsage(source.battleSpecialUsage),
    enemySpecialUsage: sanitizeSpecialUsage(source.enemySpecialUsage),
    turn,
    battleMenuTab,
    weather,
    weatherTurns: sanitizePositiveInt(source.weatherTurns, 0),
    fieldState,
    fieldTurns,
    activeBuffs: sanitizeAtkDefFlags(source.activeBuffs),
    enemyBuffs: sanitizeAtkDefFlags(source.enemyBuffs),
    factoryRentals: sanitizeGamePokemonArray(source.factoryRentals),
    selectedRentalIndices: sanitizeNonNegativeIntList(source.selectedRentalIndices),
    playerTeam,
    enemyTeam,
    currentEnemyTrainerId: typeof source.currentEnemyTrainerId === 'string' && source.currentEnemyTrainerId.length > 0
      ? source.currentEnemyTrainerId
      : null,
    inventoryItemIds: sanitizeStringList(source.inventoryItemIds),
    battleLog: sanitizeStringList(source.battleLog),
    phase: source.phase === 'ROUND_RESULT' || source.phase === 'FACTORY_SWAP' || source.phase === 'BASE' ? source.phase : 'BATTLE',
    roundResult: source.roundResult === 'WIN' || source.roundResult === 'LOSS' ? source.roundResult : null,
    lastBpGain: sanitizeSafeNonNegativeInt(source.lastBpGain),
  };
}

function sanitizeTrainerIdsBySet(values: unknown): GameSaveData['factory']['trainerIdsBySet'] {
  if (!Array.isArray(values)) return [];
  const normalized: GameSaveData['factory']['trainerIdsBySet'] = [];

  for (const entry of values) {
    if (!entry || typeof entry !== 'object') continue;
    const source = entry as Record<string, unknown>;
    const setNo = sanitizePositiveInt(source.setNo, 0);
    if (setNo <= 0) continue;
    const trainerIds = sanitizeStringArray(source.trainerIds);
    if (trainerIds.length === 0) continue;
    normalized.push({ setNo, trainerIds });
  }

  return normalized.sort((a, b) => a.setNo - b.setNo);
}

function sanitizeLevel(value: unknown, fallback = 50) {
  const normalized = sanitizePositiveInt(value, fallback);
  return Math.max(1, normalized);
}

function sanitizeCollectionLedger(value: unknown): CollectionLedger {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    seenIds: sanitizeIntArray(source.seenIds),
    ownedIds: sanitizeIntArray(source.ownedIds),
    formKeys: sanitizeStringArray(source.formKeys),
  };
}

function sanitizeEventBattleCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, count]) => key.length > 0 && typeof count === 'number' && Number.isFinite(count) && count >= 0)
    .map(([key, count]) => [key, Math.floor(count as number)] as const);
  return Object.fromEntries(entries);
}

function sanitizeEvents(value: unknown): GameSaveData['events'] {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const dispatchesSource = source.dispatches && typeof source.dispatches === 'object'
    ? (source.dispatches as Record<string, unknown>)
    : {};

  const dispatchEntries = Object.entries(dispatchesSource).map(([regionId, raw]) => {
    const entry = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const statusRaw = typeof entry.status === 'string' ? entry.status : 'IDLE';
    const status = statusRaw === 'RUNNING' || statusRaw === 'READY' ? statusRaw : 'IDLE';
    const startedAt = typeof entry.startedAt === 'number' && Number.isFinite(entry.startedAt) ? Math.floor(entry.startedAt) : null;
    const readyAt = typeof entry.readyAt === 'number' && Number.isFinite(entry.readyAt) ? Math.floor(entry.readyAt) : null;
    const lastResolvedAt = typeof entry.lastResolvedAt === 'number' && Number.isFinite(entry.lastResolvedAt) ? Math.floor(entry.lastResolvedAt) : null;
    const lastResult = typeof entry.lastResult === 'string' ? entry.lastResult : '';
    return [regionId, { status, startedAt, readyAt, lastResolvedAt, lastResult }] as const;
  });

  return {
    speciesBattleCounts: sanitizeEventBattleCounts(source.speciesBattleCounts),
    dispatchPokemonByRegion: Object.fromEntries(
      Object.entries(source.dispatchPokemonByRegion && typeof source.dispatchPokemonByRegion === 'object'
        ? (source.dispatchPokemonByRegion as Record<string, unknown>)
        : {})
        .map(([regionId, value]) => {
          if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            return [regionId, Math.floor(value)] as const;
          }
          return [regionId, null] as const;
        }),
    ),
    dispatches: Object.fromEntries(dispatchEntries),
  };
}

function normalizeSaveData(value: unknown): GameSaveData {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const progress = source.progress && typeof source.progress === 'object'
    ? (source.progress as Record<string, unknown>)
    : {};
  const settings = source.settings && typeof source.settings === 'object'
    ? (source.settings as Record<string, unknown>)
    : {};
  const factory = source.factory && typeof source.factory === 'object'
    ? (source.factory as Record<string, unknown>)
    : {};
  const battleResume = sanitizeBattleResume(factory.battleResume);
  const schemaVersion = sanitizeSafeNonNegativeInt(source.schemaVersion);
  if (schemaVersion !== SAVE_SCHEMA_VERSION) throw new Error(`旧规则存档不兼容（版本 ${schemaVersion}），请备份后重新开始。`);
  const wallet = sanitizeWallet(source.wallet);

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    wallet,
    progress: {
      totalRents: sanitizePositiveInt(progress.totalRents, 0),
      highestStreak: sanitizePositiveInt(progress.highestStreak, 0),
      specialModeUnlocked: Boolean(progress.specialModeUnlocked),
      companionSpeciesId: progress.companionSpeciesId as CompanionSpeciesId | null,
    },
    settings: {
      currentLanguage: sanitizeLanguage(settings.currentLanguage, 'zh-hans'),
      selectedGens: sanitizeGenerationSelection(settings.selectedGens),
      startLevel: sanitizeLevel(settings.startLevel, 50),
      developerMode: Boolean(settings.developerMode),
    },
    factory: {
      challengeStatus: sanitizePositiveInt(factory.challengeStatus, 0),
      curChallengeBattleNum: sanitizePositiveInt(factory.curChallengeBattleNum, 0),
      challengePaused: Boolean(factory.challengePaused),
      disableRecordBattle: Boolean(factory.disableRecordBattle),
      winStreakActiveFlags: sanitizeUnsignedInt(factory.winStreakActiveFlags, 0),
      winStreakActiveMasks: sanitizeUnsignedInt(factory.winStreakActiveMasks, 0xffffffff),
      trainerIdsBySet: sanitizeTrainerIdsBySet(factory.trainerIdsBySet),
      battleResume,
    },
    collection: sanitizeCollectionLedger(source.collection),
    events: sanitizeEvents(source.events),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasRecoverablePokemonCore(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Number.isSafeInteger(value.id) && (value.id as number) > 0
    && typeof value.name === 'string' && value.name.length > 0
    && Number.isSafeInteger(value.level) && (value.level as number) > 0
    && Number.isSafeInteger(value.currentHp) && (value.currentHp as number) >= 0
    && Number.isSafeInteger(value.maxHp) && (value.maxHp as number) > 0
    && Array.isArray(value.selectedMoves)
    && value.selectedMoves.every((move) => isRecord(move)
      && typeof move.name === 'string' && move.name.length > 0
      && typeof move.type === 'string' && move.type.length > 0)
    && isRecord(value.sprites)
    && Array.isArray(value.types)
    && Array.isArray(value.abilities);
}

function hasValidFactoryHeldItemState(value: unknown): boolean {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, 'factoryOriginalHeldItemId')) return false;
  const original = value.factoryOriginalHeldItemId;
  const current = value.factoryHeldItemId;
  return (original === null || (typeof original === 'string' && original.length > 0 && isKnownFactoryHeldItemId(original)))
    && (current === undefined || (typeof current === 'string' && current.length > 0 && isKnownFactoryHeldItemId(current)));
}

function assertCurrentSaveRecoverability(value: unknown): void {
  if (!isRecord(value)) throw new Error('Current save root is invalid.');
  const progress = isRecord(value.progress) ? value.progress : null;
  const companionSpeciesId = progress?.companionSpeciesId;
  if (companionSpeciesId !== null && !isCompanionSpeciesId(companionSpeciesId)) {
    throw new Error('Companion selection is missing or invalid.');
  }
  const factory = isRecord(value.factory) ? value.factory : null;
  const resume = factory && isRecord(factory.battleResume) ? factory.battleResume : null;
  if (!resume || (resume.status !== 'EMPTY' && resume.status !== 'READY')) {
    throw new Error('Battle checkpoint status is missing or invalid.');
  }

  if (resume.status === 'READY') {
    if (companionSpeciesId === null) throw new Error('Challenge exists before companion selection.');
    const phase = resume.phase;
    const validPhase = phase === 'BATTLE' || phase === 'ROUND_RESULT' || phase === 'FACTORY_SWAP' || phase === 'BASE';
    const playerTeam = resume.playerTeam;
    const enemyTeam = resume.enemyTeam;
    const factoryRentals = resume.factoryRentals;
    if (resume.battleKind !== 'FACTORY' || !Number.isSafeInteger(resume.stage) || (resume.stage as number) < 1
      || !validPhase || !Array.isArray(playerTeam) || playerTeam.length === 0
      || !Array.isArray(enemyTeam) || enemyTeam.length === 0
      || !playerTeam.every(hasRecoverablePokemonCore) || !enemyTeam.every(hasRecoverablePokemonCore)
      || !Array.isArray(factoryRentals)
      || !factoryRentals.every(hasRecoverablePokemonCore)
      || ![...factoryRentals, ...playerTeam, ...enemyTeam].every(hasValidFactoryHeldItemState)
      || typeof resume.currentEnemyTrainerId !== 'string'
      || !getFactoryTrainerTemplateById(resume.currentEnemyTrainerId)) {
      throw new Error('Battle checkpoint has missing or damaged participants.');
    }
    if ((phase === 'ROUND_RESULT' && resume.roundResult !== 'WIN' && resume.roundResult !== 'LOSS')
      || (phase === 'FACTORY_SWAP' && resume.roundResult !== 'WIN')
      || (phase === 'BASE' && (resume.roundResult !== 'WIN' || getBattleIndexInSet(resume.stage as number) !== 7))) {
      throw new Error('Battle checkpoint phase and result disagree.');
    }
  }

  if (factory?.challengePaused === true) {
    const wallet = isRecord(value.wallet) ? value.wallet : null;
    const candidate = resume.status === 'READY' ? resume as unknown as BattleResumeSnapshot : null;
    const runId = typeof wallet?.currentRunId === 'string' ? wallet.currentRunId : null;
    if (!hasRecoverableFactoryBaseCheckpoint(candidate, runId)) {
      throw new Error('Paused challenge has no recoverable base checkpoint.');
    }
  }
}

function normalizeSaveDataSafely(value: unknown): GameSaveData {
  const version = value && typeof value === 'object' ? (value as Record<string, unknown>).schemaVersion : undefined;
  if (version !== SAVE_SCHEMA_VERSION) throw new Error(`旧规则存档不兼容（版本 ${String(version ?? 'unknown')}），请备份后重新开始。`);
  assertCurrentSaveRecoverability(value);
  const normalized = normalizeSaveData(value);
  if (isRecord(value) && isRecord(value.factory) && isRecord(value.factory.battleResume)
    && value.factory.battleResume.status === 'READY' && normalized.factory.battleResume.status !== 'READY') {
    throw new Error('Battle checkpoint could not be restored.');
  }
  return normalized;
}

export function createSaveData(input: SaveDraftInput): GameSaveData {
  return normalizeSaveDataSafely({
    schemaVersion: SAVE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    wallet: input.wallet,
    progress: {
      companionSpeciesId: input.companionSpeciesId,
      totalRents: input.totalRents,
      highestStreak: input.highestStreak,
      specialModeUnlocked: input.specialModeUnlocked,
    },
    settings: {
      currentLanguage: input.currentLanguage,
      selectedGens: input.selectedGens,
      startLevel: input.startLevel,
      developerMode: input.developerMode,
    },
    factory: input.factory,
    collection: input.collection,
    events: input.events,
  });
}

export function parseSaveDataFromText(text: string): GameSaveData {
  const inspection = classifySaveText(text);
  if (inspection.kind === 'valid') return inspection.save;
  if (inspection.kind === 'legacy') {
    throw new Error(`旧规则存档不兼容（版本 ${String(inspection.version ?? 'unknown')}），请备份后重新开始。`);
  }
  throw new Error('导入文件损坏，原有存档未修改。');
}

export function classifySaveText(raw: string): Exclude<SaveInspection, { kind: 'none' }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { kind: 'unreadable', raw, reason: 'invalid_json' };
  }
  if (!isRecord(parsed)) return { kind: 'corrupt', raw, reason: 'Save root is invalid.' };
  const version = parsed.schemaVersion;
  if (!Number.isSafeInteger(version) || (version as number) < 1) {
    return { kind: 'corrupt', raw, reason: 'Save version is missing or invalid.' };
  }
  if (version !== SAVE_SCHEMA_VERSION) return { kind: 'legacy', raw, version };
  try {
    return { kind: 'valid', raw, save: normalizeSaveDataSafely(parsed) };
  } catch (error) {
    return { kind: 'corrupt', raw, reason: error instanceof Error ? error.message : 'Invalid current save.' };
  }
}

export function inspectStoredSave(): SaveInspection {
  if (typeof window === 'undefined') return { kind: 'none' };
  const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
  return raw === null ? { kind: 'none' } : classifySaveText(raw);
}

export function readUnsupportedSave(): string | null {
  const inspection = inspectStoredSave();
  return inspection.kind === 'legacy' ? inspection.raw : null;
}

export function discardUnsupportedSave() {
  discardInvalidSave();
}

export function discardInvalidSave() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SAVE_STORAGE_KEY);
  clearPendingFactorySettlement();
}

export function loadSaveData(): GameSaveData | null {
  const inspection = inspectStoredSave();
  return inspection.kind === 'valid' ? inspection.save : null;
}

export function persistSaveData(saveData: GameSaveData) {
  if (typeof window === 'undefined') return;
  const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
  let wallet = saveData.wallet;
  let battleResume = saveData.factory.battleResume;
  let companionSpeciesId = saveData.progress.companionSpeciesId;
  if (raw !== null) {
    const inspection = classifySaveText(raw);
    if (inspection.kind !== 'valid') throw new Error('Stored save requires backup or removal before writing.');
    const persisted = inspection.save;
    if (persisted.progress.companionSpeciesId !== null) {
      companionSpeciesId = persisted.progress.companionSpeciesId;
    }
    if (persisted.wallet.revision > wallet.revision) wallet = persisted.wallet;
    const committed = persisted.factory.battleResume;
    if (committed.status === 'READY' && wallet.currentRunId === persisted.wallet.currentRunId) {
      const phaseRank = { BATTLE: 0, ROUND_RESULT: 1, FACTORY_SWAP: 2, BASE: 2 } as const;
      if (battleResume.status === 'EMPTY'
        || (battleResume.status === 'READY' && (committed.stage > battleResume.stage
          || (committed.stage === battleResume.stage && phaseRank[committed.phase] > phaseRank[battleResume.phase])))) {
        battleResume = committed;
      }
    }
  }
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({
    ...saveData,
    wallet,
    progress: { ...saveData.progress, companionSpeciesId },
    factory: { ...saveData.factory, battleResume },
  }));
}

export function bindCompanionToSave(draft: GameSaveData, speciesId: number): GameSaveData {
  if (!isCompanionSpeciesId(speciesId)) throw new Error('Invalid companion species.');
  if (typeof window === 'undefined') throw new Error('Save storage is unavailable.');
  const inspection = inspectStoredSave();
  if (inspection.kind !== 'none' && inspection.kind !== 'valid') {
    throw new Error('Stored save requires backup or removal before companion selection.');
  }
  const existing = inspection.kind === 'valid' ? inspection.save : draft;
  if (existing.progress.companionSpeciesId !== null) {
    if (existing.progress.companionSpeciesId !== speciesId) throw new Error('Companion is already bound to this save.');
    return existing;
  }
  const next: GameSaveData = {
    ...draft,
    progress: { ...draft.progress, companionSpeciesId: speciesId },
  };
  persistSaveData(next);
  const persisted = loadSaveData();
  if (!persisted || persisted.progress.companionSpeciesId !== speciesId) {
    throw new Error('Companion selection could not be verified after saving.');
  }
  return persisted;
}

export function replaceSaveData(saveData: GameSaveData) {
  if (typeof window === 'undefined') throw new Error('Save storage is unavailable.');
  normalizeSaveDataSafely(saveData);
  const inspection = inspectStoredSave();
  if (inspection.kind !== 'none' && inspection.kind !== 'valid') {
    throw new Error('Stored save requires backup or removal before replacement.');
  }
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(saveData));
}

export function loadPendingFactorySettlement(): PendingFactorySettlement | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_SETTLEMENT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (typeof value.runId !== 'string' || value.runId.length === 0 || value.runId.length > 160
      || !Number.isSafeInteger(value.stage) || (value.stage as number) < 1
      || (value.result !== 'WIN' && value.result !== 'LOSS')
      || typeof value.isFrontierBrain !== 'boolean') return null;
    return value as unknown as PendingFactorySettlement;
  } catch {
    return null;
  }
}

export function clearPendingFactorySettlement() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_SETTLEMENT_KEY);
  } catch {
    // Settlement has already been saved; a stale intent is harmless and idempotent.
  }
}

function rememberPendingFactorySettlement(pending: PendingFactorySettlement) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_SETTLEMENT_KEY, JSON.stringify(pending));
  } catch (error) {
    console.error('Could not retain failed factory settlement for this tab.', error);
  }
}

function commitWalletChange(
  draft: GameSaveData,
  change: (wallet: FactoryWallet) => FactoryWallet,
  saveForWallet?: (draft: GameSaveData, wallet: FactoryWallet) => GameSaveData,
): FactoryWallet {
  if (typeof window === 'undefined') throw new Error('Save storage is unavailable.');
  const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
  let wallet = draft.wallet;
  if (raw !== null) {
    const inspection = classifySaveText(raw);
    if (inspection.kind !== 'valid') throw new Error('Stored save requires backup or removal before wallet changes.');
    const persisted = inspection.save;
    if (persisted.wallet.revision >= wallet.revision) wallet = persisted.wallet;
  }
  const nextWallet = change(wallet);
  if (nextWallet === wallet) return wallet;
  const save = saveForWallet ? saveForWallet(draft, nextWallet) : draft;
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ ...save, wallet: nextWallet, updatedAt: new Date().toISOString() }));
  return nextWallet;
}

function nextWalletRevision(wallet: FactoryWallet): number {
  if (wallet.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Wallet revision overflow.');
  return wallet.revision + 1;
}

function createFactoryRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `run:${crypto.randomUUID()}`;
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return `run:${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  return `run:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

export function beginFactoryWalletRun(draft: GameSaveData, devBonus = 0, startingStage = 1): FactoryWallet {
  if (!Number.isSafeInteger(devBonus) || devBonus < 0) throw new Error('Invalid developer bonus.');
  if (!Number.isSafeInteger(startingStage) || startingStage < 1) throw new Error('Invalid starting stage.');
  const freshRunDraft: GameSaveData = {
    ...draft,
    factory: {
      ...draft.factory,
      challengeStatus: 0,
      curChallengeBattleNum: 0,
      challengePaused: false,
      winStreakActiveFlags: 0,
      trainerIdsBySet: [],
      battleResume: createEmptyBattleResume(),
    },
  };
  const nextWallet = commitWalletChange(freshRunDraft, (wallet) => {
    const balance = Math.min(MAX_FACTORY_BP, wallet.balance + devBonus);
    if (!Number.isSafeInteger(balance)) throw new Error('Wallet balance overflow.');
    return {
      ...wallet,
      balance,
      revision: nextWalletRevision(wallet),
      currentRunId: createFactoryRunId(),
      settledThrough: getSetNoByStage(startingStage) - 1,
      lastSettlement: null,
    };
  });
  clearPendingFactorySettlement();
  return nextWallet;
}

export function endFactoryWalletRun(draft: GameSaveData, runId: string): FactoryWallet {
  const endedDraft: GameSaveData = {
    ...draft,
    factory: {
      ...draft.factory,
      challengeStatus: 0,
      curChallengeBattleNum: 0,
      challengePaused: false,
      winStreakActiveFlags: 0,
      trainerIdsBySet: [],
      battleResume: createEmptyBattleResume(),
    },
  };
  const wallet = commitWalletChange(endedDraft, (current) => {
    if (!runId || current.currentRunId !== runId) throw new Error('Factory run changed before ending.');
    return {
      ...current,
      revision: nextWalletRevision(current),
      currentRunId: null,
      settledThrough: 0,
      lastSettlement: null,
    };
  });
  clearPendingFactorySettlement();
  return wallet;
}

export function adjustWalletBalance(draft: GameSaveData, delta: number): FactoryWallet {
  if (!Number.isSafeInteger(delta)) throw new Error('Invalid wallet adjustment.');
  return commitWalletChange(draft, (wallet) => {
    const balance = wallet.balance + delta;
    if (!Number.isSafeInteger(balance) || balance < 0 || balance > MAX_FACTORY_BP) throw new Error('Insufficient or invalid wallet balance.');
    return { ...wallet, balance, revision: nextWalletRevision(wallet) };
  });
}

export function commitFactoryGroupSettlement(
  draft: GameSaveData,
  runId: string,
  stage: number,
  result: 'WIN' | 'LOSS',
  isFrontierBrain: boolean,
  finalTeams?: { playerTeam: GamePokemon[]; enemyTeam: GamePokemon[] },
): { wallet: FactoryWallet; awarded: boolean; amount: number; nominalBp: number } {
  if (!Number.isSafeInteger(stage) || stage < 1) throw new Error('Invalid factory settlement.');
  const setNo = getSetNoByStage(stage);
  const completesSet = result === 'LOSS' || getBattleIndexInSet(stage) === 7;
  const nominalBp = completesSet ? getFactoryGroupBp(stage, result, isFrontierBrain) : 0;
  const pending: PendingFactorySettlement = { runId, stage, result, isFrontierBrain };
  try {
    if (typeof window === 'undefined') throw new Error('Save storage is unavailable.');
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    const inspection = raw === null ? null : classifySaveText(raw);
    if (inspection && inspection.kind !== 'valid') throw new Error('Stored save requires backup or removal before settlement.');
    const persisted = inspection?.kind === 'valid' ? inspection.save : draft;
    const current = persisted.wallet.revision >= draft.wallet.revision ? persisted.wallet : draft.wallet;
    if (!runId || current.currentRunId !== runId) throw new Error('Factory run changed before settlement.');

    const committed = persisted.factory.battleResume;
    if (committed.status === 'READY' && committed.stage === stage && committed.phase !== 'BATTLE') {
      if (committed.roundResult !== result) throw new Error('Factory battle was committed with a different result.');
      clearPendingFactorySettlement();
      return {
        wallet: current,
        awarded: false,
        amount: committed.lastBpGain,
        nominalBp,
      };
    }
    if (committed.status === 'READY' && committed.stage > stage) throw new Error('A newer factory battle is already saved.');
    if (setNo !== current.settledThrough + 1) throw new Error('Factory group is out of sequence.');

    const sourceResume = persisted.wallet.revision > draft.wallet.revision
      && persisted.factory.battleResume.status === 'READY'
      && persisted.factory.battleResume.stage === stage
      && persisted.factory.battleResume.phase === 'BATTLE'
      ? persisted.factory.battleResume
      : draft.factory.battleResume;
    if (sourceResume.status !== 'READY' || sourceResume.stage !== stage || sourceResume.phase !== 'BATTLE') {
      throw new Error('Final factory battle checkpoint is unavailable.');
    }
    const playerTeam = restoreFactoryParty(finalTeams?.playerTeam ?? sourceResume.playerTeam);
    const enemyTeam = finalTeams?.enemyTeam ?? sourceResume.enemyTeam;
    const amount = completesSet ? Math.min(nominalBp, MAX_FACTORY_BP - current.balance) : 0;
    const wallet: FactoryWallet = {
      ...current,
      balance: current.balance + amount,
      brainSymbols: completesSet && result === 'WIN' && isFrontierBrain ? Math.min(2, current.brainSymbols + 1) : current.brainSymbols,
      revision: nextWalletRevision(current),
      settledThrough: completesSet ? setNo : current.settledThrough,
      lastSettlement: completesSet
        ? { runId, setNo, stage, result, isFrontierBrain, nominalBp, amount, settledAt: new Date().toISOString() }
        : current.lastSettlement,
    };
    const nextResume: BattleResumeSnapshot = {
      ...sourceResume,
      checkpointAt: new Date().toISOString(),
      phase: 'ROUND_RESULT',
      roundResult: result,
      lastBpGain: amount,
      streak: result === 'WIN' ? sourceResume.streak + 1 : 0,
      playerTeam,
      enemyTeam,
    };
    const baseSave = persisted.wallet.revision > draft.wallet.revision ? persisted : draft;
    const nextSave: GameSaveData = {
      ...baseSave,
      updatedAt: new Date().toISOString(),
      wallet,
      factory: { ...baseSave.factory, battleResume: nextResume },
    };
    normalizeSaveDataSafely(nextSave);
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(nextSave));
    clearPendingFactorySettlement();
    return { wallet, awarded: completesSet, amount, nominalBp };
  } catch (error) {
    rememberPendingFactorySettlement(pending);
    throw error;
  }
}

export function buildSaveExportFilename() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `pokefactory-save-${yyyy}${mm}${dd}-${hh}${min}.json`;
}

export function triggerJsonDownload(text: string, filename: string) {
  triggerTextDownload(text, filename, 'application/json;charset=utf-8');
}

export function triggerTextDownload(text: string, filename: string, mimeType: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
