import type { FieldState, FieldTurns, GamePokemon } from '../types';

const SAVE_STORAGE_KEY = 'pokefactory_save_v1';
const SAVE_SCHEMA_VERSION = 7 as const;

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
  progress: {
    totalRents: number;
    highestStreak: number;
    specialModeUnlocked: boolean;
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

function sanitizeIntArray(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map((value) => (typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : NaN))
    .filter((value) => Number.isFinite(value) && value > 0);
  return [...new Set(normalized)];
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

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    progress: {
      totalRents: sanitizePositiveInt(progress.totalRents, 0),
      highestStreak: sanitizePositiveInt(progress.highestStreak, 0),
      specialModeUnlocked: Boolean(progress.specialModeUnlocked),
    },
    settings: {
      currentLanguage: sanitizeLanguage(settings.currentLanguage, 'zh-hans'),
      selectedGens: sanitizeIntArray(settings.selectedGens),
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
      battleResume: sanitizeBattleResume(factory.battleResume),
    },
    collection: sanitizeCollectionLedger(source.collection),
    events: sanitizeEvents(source.events),
  };
}

function normalizeSaveDataSafely(value: unknown): GameSaveData {
  try {
    return normalizeSaveData(value);
  } catch (error) {
    console.error('Failed to normalize full save data, attempting battle resume fallback.', error);
    const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const factory = source.factory && typeof source.factory === 'object'
      ? { ...(source.factory as Record<string, unknown>), battleResume: createEmptyBattleResume() }
      : { battleResume: createEmptyBattleResume() };
    return normalizeSaveData({
      ...source,
      factory,
    });
  }
}

function readLegacySaveFallback(): Partial<GameSaveData> {
  if (typeof window === 'undefined') return {};

  const totalRents = Number(window.localStorage.getItem('pokefactory_total_rents') ?? 0);
  const highestStreak = Number(window.localStorage.getItem('pokefactory_highest_streak') ?? 0);
  const specialModeUnlocked = window.localStorage.getItem('pokefactory_special_mode_unlocked') === '1';
  const developerMode = window.localStorage.getItem('pokefactory_developer_mode') === '1';

  return {
    progress: {
      totalRents: Number.isFinite(totalRents) ? Math.max(0, Math.floor(totalRents)) : 0,
      highestStreak: Number.isFinite(highestStreak) ? Math.max(0, Math.floor(highestStreak)) : 0,
      specialModeUnlocked,
    },
    settings: {
      currentLanguage: 'zh-hans',
      selectedGens: [],
      startLevel: 50,
      developerMode,
    },
    factory: {
      challengeStatus: 0,
      curChallengeBattleNum: 0,
      challengePaused: false,
      disableRecordBattle: false,
      winStreakActiveFlags: 0,
      winStreakActiveMasks: 0xffffffff,
      trainerIdsBySet: [],
      battleResume: createEmptyBattleResume(),
    },
    collection: {
      seenIds: [],
      ownedIds: [],
      formKeys: [],
    },
    events: {
      speciesBattleCounts: {},
      dispatchPokemonByRegion: {},
      dispatches: {},
    },
  };
}

export function createSaveData(input: SaveDraftInput): GameSaveData {
  return normalizeSaveDataSafely({
    schemaVersion: SAVE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    progress: {
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
  const parsed = JSON.parse(text) as unknown;
  return normalizeSaveDataSafely(parsed);
}

export function loadSaveData(): GameSaveData | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
  if (!raw) {
    const legacy = readLegacySaveFallback();
    const normalized = normalizeSaveDataSafely(legacy);
    if (normalized.progress.totalRents > 0 || normalized.progress.highestStreak > 0 || normalized.progress.specialModeUnlocked || normalized.settings.developerMode) {
      persistSaveData(normalized);
      return normalized;
    }
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeSaveDataSafely(parsed);
    return normalized;
  } catch (error) {
    console.error('Failed to parse save data from localStorage', error);
    return null;
  }
}

export function persistSaveData(saveData: GameSaveData) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(saveData));
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
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
