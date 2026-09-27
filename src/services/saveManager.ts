import type { BattleHazards, FieldState, FieldTurns, GamePokemon, TailwindTurns } from '../types';
import {
  getBattleIndexInSet,
  getFactoryGroupBp,
  getFactoryRewardChoiceCount,
  getSetNoByStage,
  MAX_FACTORY_BP,
  shouldEnterRewardAfterWinning,
} from '../features/game/config/factoryRewards';
import {
  canEquipFactoryRewardItem,
  isFactoryRewardHeldItemId,
  normalizeFactoryHeldItemId,
  type FactoryRewardHeldItemId,
} from '../features/game/config/factoryRewardPool';
import {
  repairFactoryHeldItemBaselines,
  type FactoryHeldItemTeamMember,
} from '../features/game/config/factoryHeldItemRules';
import { getFactoryTrainerTemplateById } from '../features/game/config/factoryTrainerTemplates';
import { isCompanionSpeciesId, type CompanionSpeciesId } from '../features/game/config/companionCandidates';
import { hasRecoverableFactoryBaseCheckpoint } from '../features/game/hooks/factoryResumeCheckpoint';
import { getItemBattleData, isKnownFactoryHeldItemId } from '../features/game/data/battle';
import { prepareFactoryPartyForBattle, restoreFactoryParty } from '../features/game/utils/restoreFactoryParty';
import { createEmptyBattleHazards } from '../features/game/battle/engine/resolveEntryHazards';

const SAVE_STORAGE_KEY = 'pokefactory_save_v1';
const PENDING_SETTLEMENT_KEY = 'pokefactory_pending_settlement_v1';
const SAVE_SCHEMA_VERSION = 14 as const;

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

export interface FactoryRunSupply {
  runId: string | null;
  tickets: number;
  lastCreditedStage: number;
}

export function createEmptyRunSupply(): FactoryRunSupply {
  return { runId: null, tickets: 0, lastCreditedStage: 0 };
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

/**
 * 奖励节点检查点（PRD §3.4/§3.5、plan §2.2/§3）。
 * `PENDING` 只记锚点；`READY` 冻结四张候选；`CLAIMED` 记领取结果与「已请求继续」意图。
 */
export type FactoryRewardCheckpoint =
  | { runId: string; stage: number; status: 'PENDING' }
  | { runId: string; stage: number; status: 'READY'; cardItemIds: FactoryRewardHeldItemId[] }
  | {
      runId: string;
      stage: number;
      status: 'CLAIMED';
      cardItemIds: FactoryRewardHeldItemId[];
      claim: { itemId: FactoryRewardHeldItemId; targetIndex: number };
      continueRequested?: true;
    };

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
  weather: 'none' | 'sunny' | 'rainy' | 'sandstorm' | 'hail' | 'snow';
  weatherTurns: number;
  fieldState: FieldState[];
  fieldTurns: FieldTurns;
  tailwindTurns: TailwindTurns;
  hazards: BattleHazards;
  activeBuffs: { atk: boolean; def: boolean };
  enemyBuffs: { atk: boolean; def: boolean };
  factoryRentals: GamePokemon[];
  selectedRentalIndices: number[];
  playerTeam: GamePokemon[];
  enemyTeam: GamePokemon[];
  currentEnemyTrainerId: string | null;
  inventoryItemIds: string[];
  battleLog: string[];
  phase: 'BATTLE' | 'ROUND_RESULT' | 'FACTORY_SWAP' | 'REWARD' | 'BASE';
  roundResult: 'WIN' | 'LOSS' | null;
  lastBpGain: number;
  rewardCheckpoint?: FactoryRewardCheckpoint;
  /**
   * 读取/导入时检测到三人返还基准重复，并按 `repairFactoryHeldItemBaselines` 规整过。
   * 只用于「如实提示」，不参与相位合法性判定（修复后不变量恒成立）。
   */
  heldItemBaselineRepaired?: true;
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
  runSupply: FactoryRunSupply;
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
  runSupply: FactoryRunSupply;
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
    factoryEquippedHeldItemId: source.factoryEquippedHeldItemId as string | null,
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

function sanitizeTailwindTurns(value: unknown): TailwindTurns {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { player: 0, enemy: 0 };
  const source = value as Record<string, unknown>;
  const normalize = (raw: unknown) => typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 4 ? raw : 0;
  return { player: normalize(source.player), enemy: normalize(source.enemy) };
}

function hasValidTailwindTurns(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const turns = value as Record<string, unknown>;
  return ['player', 'enemy'].every((side) => Number.isInteger(turns[side])
    && (turns[side] as number) >= 0 && (turns[side] as number) <= 4);
}

function hasValidBattleHazards(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return ['player', 'enemy'].every((side) => {
    const entry = value[side];
    return isRecord(entry)
      && typeof entry.stealthRock === 'boolean'
      && Number.isInteger(entry.toxicSpikesLayers)
      && (entry.toxicSpikesLayers as number) >= 0
      && (entry.toxicSpikesLayers as number) <= 2;
  });
}

function sanitizeBattleHazards(value: unknown): BattleHazards {
  if (!hasValidBattleHazards(value)) return createEmptyBattleHazards();
  const source = value as Record<string, Record<string, unknown>>;
  return {
    player: { stealthRock: source.player.stealthRock as boolean, toxicSpikesLayers: source.player.toxicSpikesLayers as 0 | 1 | 2 },
    enemy: { stealthRock: source.enemy.stealthRock as boolean, toxicSpikesLayers: source.enemy.toxicSpikesLayers as 0 | 1 | 2 },
  };
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
    || source.weather === 'snow'
    ? source.weather
    : 'none';
  const fieldState = sanitizeFieldStateList(source.fieldState);
  const fieldTurns = sanitizeFieldTurns(source.fieldTurns, fieldState);
  const tailwindTurns = sanitizeTailwindTurns(source.tailwindTurns);
  const hazards = sanitizeBattleHazards(source.hazards);
  const stage = sanitizePositiveInt(source.stage, 0);
  const playerTeam = sanitizeGamePokemonArray(source.playerTeam);
  const enemyTeam = sanitizeGamePokemonArray(source.enemyTeam);

  if (!battleKind || stage <= 0 || playerTeam.length === 0 || enemyTeam.length === 0) {
    return createEmptyBattleResume();
  }

  const phase: BattleResumeSnapshot['phase'] = source.phase === 'ROUND_RESULT' || source.phase === 'FACTORY_SWAP'
    || source.phase === 'REWARD' || source.phase === 'BASE'
    ? source.phase
    : 'BATTLE';
  // 奖励检查点只在 REWARD 相位存在；其余相位一律丢弃（PRD 边界「阶段切换」）。
  const rewardCheckpoint = source.phase === 'REWARD' && isRecord(source.rewardCheckpoint)
    ? source.rewardCheckpoint as unknown as FactoryRewardCheckpoint
    : undefined;
  // 不变量修复（裁决补遗一）：load / 旧档迁移 / 同版导入都必须让三人返还基准回到互不重复。
  // 已落盘的 CLAIMED 领取目标优先保留，避免修复把「刚领到的装备」改判掉。
  const claimedTargetIndex = phase === 'REWARD' ? resolveRewardClaimTargetIndex(rewardCheckpoint) : [];
  const baselineRepair = repairFactoryHeldItemBaselines(playerTeam, { keepIndices: claimedTargetIndex });

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
    tailwindTurns,
    hazards,
    activeBuffs: sanitizeAtkDefFlags(source.activeBuffs),
    enemyBuffs: sanitizeAtkDefFlags(source.enemyBuffs),
    factoryRentals: sanitizeGamePokemonArray(source.factoryRentals),
    selectedRentalIndices: sanitizeNonNegativeIntList(source.selectedRentalIndices),
    playerTeam: baselineRepair.team,
    enemyTeam,
    currentEnemyTrainerId: typeof source.currentEnemyTrainerId === 'string' && source.currentEnemyTrainerId.length > 0
      ? source.currentEnemyTrainerId
      : null,
    inventoryItemIds: sanitizeStringList(source.inventoryItemIds),
    battleLog: sanitizeStringList(source.battleLog),
    phase,
    roundResult: source.roundResult === 'WIN' || source.roundResult === 'LOSS' ? source.roundResult : null,
    lastBpGain: sanitizeSafeNonNegativeInt(source.lastBpGain),
    rewardCheckpoint,
    // 修复发生过就如实上报（不静默）：UI 据此提示玩家返还基准已被规整。
    heldItemBaselineRepaired: baselineRepair.repaired || source.heldItemBaselineRepaired === true ? true : undefined,
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
  const runSupply = source.runSupply as FactoryRunSupply;

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    wallet,
    runSupply,
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
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, 'factoryOriginalHeldItemId')
    || !Object.prototype.hasOwnProperty.call(value, 'factoryEquippedHeldItemId')) return false;
  const original = value.factoryOriginalHeldItemId;
  const equipped = value.factoryEquippedHeldItemId;
  const current = value.factoryHeldItemId;
  return (original === null || (typeof original === 'string' && original.length > 0 && isKnownFactoryHeldItemId(original)))
    && (equipped === null || (typeof equipped === 'string' && equipped.length > 0 && isKnownFactoryHeldItemId(equipped)))
    && (current === undefined || (typeof current === 'string' && current.length > 0 && isKnownFactoryHeldItemId(current)));
}

function hasPreparedFactoryHeldItem(value: unknown): boolean {
  return hasValidFactoryHeldItemState(value) && isRecord(value)
    && (value.factoryEquippedHeldItemId ?? undefined) === value.factoryHeldItemId;
}

function pokemonEquippedItemId(pokemon: unknown): string | null {
  return isRecord(pokemon) ? normalizeFactoryHeldItemId(pokemon.factoryEquippedHeldItemId as string | null) : null;
}

/** 三人（或整队）「本局返还基准」互不重复 —— 本任务的不变量。 */
function hasUniqueEquippedItems(team: readonly unknown[]): boolean {
  const equipped = team
    .map(pokemonEquippedItemId)
    .filter((itemId): itemId is string => Boolean(itemId));
  return equipped.length === new Set(equipped).size;
}

/**
 * 换怪冲突（PRD 边界「换怪后须先核验整队返还基准唯一性」）：
 * 换入成员的「本局返还基准」与留下的某名队员重复时返回冲突，否则 `null`。
 */
export function getFactorySwapEquippedItemConflict(
  playerTeam: readonly GamePokemon[],
  enemyTeam: readonly GamePokemon[],
  playerIndex: number,
  enemyIndex: number,
): { itemId: string; retainedPlayerIndex: number } | null {
  if (!Number.isSafeInteger(playerIndex) || playerIndex < 0 || playerIndex >= playerTeam.length
    || !Number.isSafeInteger(enemyIndex) || enemyIndex < 0 || enemyIndex >= enemyTeam.length) return null;
  const itemId = pokemonEquippedItemId(enemyTeam[enemyIndex]);
  if (!itemId) return null;
  const retainedPlayerIndex = playerTeam.findIndex((pokemon, index) => (
    index !== playerIndex && pokemonEquippedItemId(pokemon) === itemId
  ));
  return retainedPlayerIndex < 0 ? null : { itemId, retainedPlayerIndex };
}

/** 合法装备对象判定：委托候选池模块的纯函数（单一真值源）。 */
export function canEquipRewardItem(team: readonly unknown[], itemId: FactoryRewardHeldItemId, targetIndex: number): boolean {
  if (!Array.isArray(team)) return false;
  return canEquipFactoryRewardItem(team.map(pokemonEquippedItemId), itemId, targetIndex);
}

function hasValidFactoryRewardCheckpoint(value: unknown, runId: unknown, stage: unknown, playerTeam: unknown): boolean {
  if (!isRecord(value) || value.runId !== runId || value.stage !== stage) return false;
  if (value.status === 'PENDING') {
    return value.cardItemIds === undefined && value.claim === undefined && value.continueRequested === undefined;
  }
  const cards = value.cardItemIds;
  // 张数联动 `FACTORY_REWARD_CONFIG.freeRewardChoiceCount`（不再硬编码 4）。
  const choiceCount = getFactoryRewardChoiceCount();
  if (!Array.isArray(cards) || cards.length !== choiceCount || !cards.every(isFactoryRewardHeldItemId)
    || new Set(cards).size !== choiceCount || !Array.isArray(playerTeam)) return false;
  if (value.status === 'READY') {
    return value.claim === undefined && value.continueRequested === undefined
      && cards.every((itemId) => playerTeam.some((_, index) => canEquipRewardItem(playerTeam, itemId, index)));
  }
  if (value.status !== 'CLAIMED' || (value.continueRequested !== undefined && value.continueRequested !== true)
    || !isRecord(value.claim)
    || !isFactoryRewardHeldItemId(value.claim.itemId)
    || !cards.includes(value.claim.itemId)
    || !Number.isSafeInteger(value.claim.targetIndex)
    || (value.claim.targetIndex as number) < 0
    || (value.claim.targetIndex as number) >= playerTeam.length) return false;
  const target = playerTeam[value.claim.targetIndex as number];
  return isRecord(target) && target.factoryEquippedHeldItemId === value.claim.itemId
    && target.factoryHeldItemId === value.claim.itemId && hasUniqueEquippedItems(playerTeam);
}

/**
 * `CLAIMED` 检查点的领取目标下标（作为 `repairFactoryHeldItemBaselines` 的 `keepIndices` 输入）。
 * 领取目标必须优先保住自己的基准，否则读档修复会把「刚领到的装备」改判掉。
 */
function resolveRewardClaimTargetIndex(rewardCheckpoint: unknown): number[] {
  if (!isRecord(rewardCheckpoint) || rewardCheckpoint.status !== 'CLAIMED' || !isRecord(rewardCheckpoint.claim)) return [];
  const targetIndex = rewardCheckpoint.claim.targetIndex;
  return Number.isSafeInteger(targetIndex) ? [targetIndex as number] : [];
}

function assertCurrentSaveRecoverability(value: unknown): void {
  if (!isRecord(value)) throw new Error('Current save root is invalid.');
  const wallet = isRecord(value.wallet) ? value.wallet : null;
  const supply = isRecord(value.runSupply) ? value.runSupply : null;
  if (!supply || !(supply.runId === null || (typeof supply.runId === 'string' && supply.runId.length > 0 && supply.runId.length <= 160))
    || !Number.isSafeInteger(supply.tickets) || (supply.tickets as number) < 0
    || !Number.isSafeInteger(supply.lastCreditedStage) || (supply.lastCreditedStage as number) < 0
    || (supply.tickets as number) > (supply.lastCreditedStage as number)
    || (supply.runId === null && (supply.tickets !== 0 || supply.lastCreditedStage !== 0))
    || (supply.runId !== null && supply.runId !== wallet?.currentRunId)) {
    throw new Error('Factory run supply is missing or invalid.');
  }
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
    if (resume.hazards !== undefined && !hasValidBattleHazards(resume.hazards)) {
      throw new Error('Battle checkpoint has invalid entry hazards.');
    }
    if (resume.tailwindTurns !== undefined && !hasValidTailwindTurns(resume.tailwindTurns)) {
      throw new Error('Battle checkpoint has invalid Tailwind timers.');
    }
    if (companionSpeciesId === null) throw new Error('Challenge exists before companion selection.');
    const phase = resume.phase;
    const validPhase = phase === 'BATTLE' || phase === 'ROUND_RESULT' || phase === 'FACTORY_SWAP' || phase === 'REWARD' || phase === 'BASE';
    const playerTeam = resume.playerTeam;
    const enemyTeam = resume.enemyTeam;
    const factoryRentals = resume.factoryRentals;
    // 返还基准重复属于**可修复**状态（读档时由 `sanitizeBattleResume` 规整并如实上报标志），
    // 不构成「整份存档不可恢复」—— 否则奖励节点对这类存档就是死路。
    // 因此奖励检查点按**规整后**的队伍校验，且已落盘的 CLAIMED 领取目标优先保留。
    const rewardPhaseTeam = repairFactoryHeldItemBaselines(
      (playerTeam as readonly FactoryHeldItemTeamMember[] | undefined) ?? [],
      { keepIndices: resolveRewardClaimTargetIndex(resume.rewardCheckpoint) },
    ).team;
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
      || (phase === 'REWARD' && (resume.roundResult !== 'WIN'
        || !shouldEnterRewardAfterWinning(resume.stage as number)
        || !hasValidFactoryRewardCheckpoint(resume.rewardCheckpoint, wallet?.currentRunId, resume.stage, rewardPhaseTeam)))
      || (phase === 'BASE' && (resume.roundResult !== 'WIN' || getBattleIndexInSet(resume.stage as number) !== 7))) {
      throw new Error('Battle checkpoint phase and result disagree.');
    }
    if (phase !== 'REWARD' && resume.rewardCheckpoint !== undefined) {
      throw new Error('Reward checkpoint exists outside reward phase.');
    }
    const expectedCreditedStage = phase === 'BATTLE' ? (resume.stage as number) - 1 : resume.stage;
    if (phase === 'BATTLE' || resume.roundResult === 'WIN') {
      if (supply.runId !== wallet?.currentRunId || supply.runId === null
        || supply.lastCreditedStage !== expectedCreditedStage) {
        throw new Error('Factory run supply disagrees with battle progress.');
      }
    } else if (supply.runId !== null) {
      throw new Error('Ended factory run still has supply tickets.');
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
    runSupply: input.runSupply,
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
  let runSupply = saveData.runSupply;
  let battleResume = saveData.factory.battleResume;
  let companionSpeciesId = saveData.progress.companionSpeciesId;
  let persistedSameRun: GameSaveData | null = null;
  if (raw !== null) {
    const inspection = classifySaveText(raw);
    if (inspection.kind !== 'valid') throw new Error('Stored save requires backup or removal before writing.');
    const persisted = inspection.save;
    if (persisted.wallet.revision > wallet.revision
      && persisted.wallet.currentRunId !== wallet.currentRunId) return;
    if (persisted.wallet.currentRunId && persisted.wallet.currentRunId === saveData.wallet.currentRunId) {
      persistedSameRun = persisted;
    }
    if (persisted.progress.companionSpeciesId !== null) {
      companionSpeciesId = persisted.progress.companionSpeciesId;
    }
    if (persisted.wallet.revision > wallet.revision) wallet = persisted.wallet;
    if (wallet.currentRunId === persisted.wallet.currentRunId) {
      const persistedSupply = persisted.runSupply;
      const terminalLoss = persisted.factory.battleResume.status === 'READY'
        && persisted.factory.battleResume.phase !== 'BATTLE'
        && persisted.factory.battleResume.roundResult === 'LOSS';
      if (terminalLoss || runSupply.runId !== wallet.currentRunId
        || (persistedSupply.runId === wallet.currentRunId
          && (persistedSupply.lastCreditedStage > runSupply.lastCreditedStage
            || (persistedSupply.lastCreditedStage === runSupply.lastCreditedStage
              && persistedSupply.tickets > runSupply.tickets)))) {
        runSupply = persistedSupply;
      }
    }
    const committed = persisted.factory.battleResume;
    if (committed.status === 'READY' && wallet.currentRunId === persisted.wallet.currentRunId) {
      const phaseRank = { BATTLE: 0, ROUND_RESULT: 1, FACTORY_SWAP: 2, REWARD: 3, BASE: 2 } as const;
      if (battleResume.status === 'EMPTY'
        || (battleResume.status === 'READY' && (committed.stage > battleResume.stage
          || (committed.stage === battleResume.stage && phaseRank[committed.phase] > phaseRank[battleResume.phase])
          // 同为 REWARD 时以已落盘者为准，避免旧快照把 PENDING 回退覆盖 READY/CLAIMED。
          || (committed.stage === battleResume.stage && committed.phase === 'REWARD' && battleResume.phase === 'REWARD')
          || (committed.stage === battleResume.stage && committed.phase === 'BATTLE' && battleResume.phase === 'BATTLE'
            && (committed.swapCount > battleResume.swapCount || committed.totalRents > battleResume.totalRents))))) {
        battleResume = committed;
      }
    }
  }
  // 不变量（裁决补遗一）：任何写入路径都必须维持三人返还基准互不重复，落盘前再规整一次。
  // 与 `sanitizeBattleResume` / `assertCurrentSaveRecoverability` 同口径：CLAIMED 领取目标优先保位，
  // 否则兜底路径会把玩家刚领到的装备挤掉，还会让这份存档在下一次加载时被判 corrupt。
  if (battleResume.status === 'READY') {
    const baselineRepair = repairFactoryHeldItemBaselines(battleResume.playerTeam, {
      keepIndices: resolveRewardClaimTargetIndex(battleResume.rewardCheckpoint),
    });
    if (baselineRepair.repaired) {
      battleResume = {
        ...battleResume,
        playerTeam: baselineRepair.team,
        heldItemBaselineRepaired: true,
      };
    }
  }
  if (wallet.currentRunId === null) runSupply = createEmptyRunSupply();
  const trainerIdsBySet = new Map<number, Set<string>>();
  for (const entry of [...(persistedSameRun?.factory.trainerIdsBySet ?? []), ...saveData.factory.trainerIdsBySet]) {
    const ids = trainerIdsBySet.get(entry.setNo) ?? new Set<string>();
    entry.trainerIds.forEach((id) => ids.add(id));
    trainerIdsBySet.set(entry.setNo, ids);
  }
  const storedTotalRents = persistedSameRun?.progress.totalRents ?? 0;
  const checkpointTotalRents = battleResume.status === 'READY' ? battleResume.totalRents : 0;
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({
    ...saveData,
    wallet,
    runSupply,
    progress: {
      ...saveData.progress,
      companionSpeciesId,
      totalRents: Math.max(saveData.progress.totalRents, storedTotalRents, checkpointTotalRents),
    },
    factory: {
      ...saveData.factory,
      challengeStatus: battleResume.status === 'READY' && battleResume.phase === 'BATTLE' ? 1 : saveData.factory.challengeStatus,
      challengePaused: battleResume.status === 'READY' && battleResume.phase === 'BATTLE' ? false : saveData.factory.challengePaused,
      curChallengeBattleNum: battleResume.status === 'READY'
        ? getBattleIndexInSet(battleResume.stage) - 1
        : saveData.factory.curChallengeBattleNum,
      trainerIdsBySet: [...trainerIdsBySet.entries()]
        .map(([setNo, trainerIds]) => ({ setNo, trainerIds: [...trainerIds].sort((a, b) => a.localeCompare(b)) }))
        .sort((a, b) => a.setNo - b.setNo),
      battleResume,
    },
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
    runSupply: createEmptyRunSupply(),
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
  }, (save, wallet) => ({
    ...save,
    runSupply: { runId: wallet.currentRunId, tickets: 0, lastCreditedStage: startingStage - 1 },
  }));
  clearPendingFactorySettlement();
  return nextWallet;
}

export function endFactoryWalletRun(draft: GameSaveData, runId: string): FactoryWallet {
  const endedDraft: GameSaveData = {
    ...draft,
    runSupply: createEmptyRunSupply(),
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
  if (typeof window === 'undefined') throw new Error('Save storage is unavailable.');
  const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
  const inspection = raw === null ? null : classifySaveText(raw);
  if (inspection && inspection.kind !== 'valid') throw new Error('Stored save requires backup or removal before wallet changes.');
  const persisted = inspection?.kind === 'valid' ? inspection.save : null;
  if (persisted && persisted.wallet.currentRunId !== draft.wallet.currentRunId) {
    throw new Error('Factory run changed before wallet adjustment.');
  }
  const current = persisted?.wallet ?? draft.wallet;
  const balance = current.balance + delta;
  if (!Number.isSafeInteger(balance) || balance < 0 || balance > MAX_FACTORY_BP) {
    throw new Error('Insufficient or invalid wallet balance.');
  }
  const wallet = { ...current, balance, revision: nextWalletRevision(current) };
  persistSaveData({
    ...draft,
    wallet,
    runSupply: persisted?.runSupply ?? draft.runSupply,
    factory: persisted?.factory ?? draft.factory,
  });
  const confirmed = loadSaveData();
  if (!confirmed || confirmed.wallet.currentRunId !== wallet.currentRunId || confirmed.wallet.revision !== wallet.revision) {
    throw new Error('Wallet adjustment could not be verified after saving.');
  }
  return confirmed.wallet;
}

export function commitFactoryGroupSettlement(
  draft: GameSaveData,
  runId: string,
  stage: number,
  result: 'WIN' | 'LOSS',
  isFrontierBrain: boolean,
  finalTeams?: { playerTeam: GamePokemon[]; enemyTeam: GamePokemon[] },
): { wallet: FactoryWallet; runSupply: FactoryRunSupply; awarded: boolean; amount: number; nominalBp: number } {
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
        runSupply: persisted.runSupply,
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
    const currentSupply = persisted.runSupply;
    if (currentSupply.runId !== runId || currentSupply.lastCreditedStage !== stage - 1) {
      throw new Error('Factory supply credit is out of sequence.');
    }
    if (result === 'WIN' && currentSupply.tickets >= Number.MAX_SAFE_INTEGER) {
      throw new Error('Factory supply ticket overflow.');
    }
    const runSupply: FactoryRunSupply = result === 'WIN'
      ? { runId, tickets: currentSupply.tickets + 1, lastCreditedStage: stage }
      : createEmptyRunSupply();
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
      runSupply,
      factory: { ...baseSave.factory, battleResume: nextResume },
    };
    normalizeSaveDataSafely(nextSave);
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(nextSave));
    clearPendingFactorySettlement();
    return { wallet, runSupply, awarded: completesSet, amount, nominalBp };
  } catch (error) {
    rememberPendingFactorySettlement(pending);
    throw error;
  }
}

/**
 * 持久化点①：换怪/跳过完成 → 写 `phase: 'REWARD'` + `{status:'PENDING'}`。
 * 失败时不推进战次、不出卡（PRD §4 与边界 A）。
 */
export function commitFactoryRewardPending(
  runId: string,
  stage: number,
  finalTeam: GamePokemon[],
  swapped: boolean,
): BattleResumeSnapshot {
  if (typeof window === 'undefined') throw new Error('Save storage is unavailable.');
  if (!runId || !shouldEnterRewardAfterWinning(stage)) throw new Error('This factory round has no reward checkpoint.');
  const inspection = inspectStoredSave();
  if (inspection.kind !== 'valid') throw new Error('A saved factory swap is required before the reward checkpoint.');
  const previous = inspection.save;
  const checkpoint = previous.factory.battleResume;
  if (previous.wallet.currentRunId !== runId || checkpoint.status !== 'READY' || checkpoint.stage !== stage) {
    throw new Error('Factory run changed before the reward checkpoint.');
  }
  if (checkpoint.phase === 'REWARD') {
    // 幂等：同锚点重复调用返回同一检查点。
    if (checkpoint.rewardCheckpoint?.runId !== runId || checkpoint.rewardCheckpoint.stage !== stage
      || !['PENDING', 'READY', 'CLAIMED'].includes(checkpoint.rewardCheckpoint.status)) {
      throw new Error('Reward checkpoint is damaged.');
    }
    return checkpoint;
  }
  if (checkpoint.phase !== 'FACTORY_SWAP' || checkpoint.roundResult !== 'WIN') {
    throw new Error('Factory swap must be completed before the reward checkpoint.');
  }
  if (finalTeam.length !== checkpoint.playerTeam.length || finalTeam.length === 0
    || !finalTeam.every((pokemon) => hasRecoverablePokemonCore(pokemon) && hasValidFactoryHeldItemState(pokemon))) {
    throw new Error('Final factory team is invalid.');
  }
  // 不变量（裁决补遗一/二）：此处**不因**返还基准重复而抛错——那会把奖励节点变成死路。
  // 重复在下面落盘前被规整（保留首个持有者、重复者回落原配或空位），并以 `heldItemBaselineRepaired` 如实上报。
  const oldMembers = checkpoint.playerTeam.map(factoryRewardMemberIdentity);
  const newMembers = finalTeam.map(factoryRewardMemberIdentity);
  const changedSlots = newMembers.flatMap((member, index) => (member === oldMembers[index] ? [] : [index]));
  if ((!swapped && changedSlots.length !== 0)
    || (swapped && (changedSlots.length !== 1
      || !checkpoint.enemyTeam.some((pokemon) => factoryRewardMemberIdentity(pokemon) === newMembers[changedSlots[0]])))) {
    throw new Error('Final factory team does not match the chosen swap.');
  }
  // 奖励节点位于战前，返还基准必须保持「战斗中消耗态」：不得提前返还。
  if (finalTeam.some((pokemon, index) => {
    const source = changedSlots.includes(index)
      ? checkpoint.enemyTeam.find((enemy) => factoryRewardMemberIdentity(enemy) === newMembers[index])
      : checkpoint.playerTeam[index];
    return !source || pokemon.factoryHeldItemId !== source.factoryHeldItemId
      || pokemon.factoryEquippedHeldItemId !== source.factoryEquippedHeldItemId;
  })) {
    throw new Error('Factory held items must remain spent until the next battle.');
  }
  const baselineRepair = repairFactoryHeldItemBaselines(finalTeam);
  const nextResume: BattleResumeSnapshot = {
    ...checkpoint,
    checkpointAt: new Date().toISOString(),
    phase: 'REWARD',
    playerTeam: baselineRepair.team,
    swapCount: checkpoint.swapCount + (swapped ? 1 : 0),
    totalRents: checkpoint.totalRents + (swapped ? 1 : 0),
    rewardCheckpoint: { runId, stage, status: 'PENDING' },
    heldItemBaselineRepaired: baselineRepair.repaired || checkpoint.heldItemBaselineRepaired === true
      ? true
      : undefined,
  };
  const nextSave: GameSaveData = {
    ...previous,
    updatedAt: new Date().toISOString(),
    progress: { ...previous.progress, totalRents: Math.max(previous.progress.totalRents, nextResume.totalRents) },
    factory: { ...previous.factory, battleResume: nextResume },
  };
  normalizeSaveDataSafely(nextSave);
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(nextSave));
  const confirmed = loadSaveData()?.factory.battleResume;
  if (confirmed?.status !== 'READY' || confirmed.phase !== 'REWARD'
    || confirmed.rewardCheckpoint?.runId !== runId || confirmed.rewardCheckpoint.stage !== stage) {
    throw new Error('Reward checkpoint could not be verified after saving.');
  }
  return confirmed;
}

/**
 * 持久化点②：冻结四张候选（`PENDING → READY`）。
 * 同锚点二次调用同卡幂等返回；不同卡抛错 ⇒ 刷新/重开/导入**不重抽**（PRD §3.4）。
 */
export function commitFactoryRewardReady(
  runId: string,
  stage: number,
  cardItemIds: readonly FactoryRewardHeldItemId[],
): BattleResumeSnapshot {
  if (typeof window === 'undefined') throw new Error('Save storage is unavailable.');
  const inspection = inspectStoredSave();
  if (inspection.kind !== 'valid') throw new Error('A saved reward checkpoint is required.');
  const previous = inspection.save;
  const checkpoint = previous.factory.battleResume;
  if (!runId || previous.wallet.currentRunId !== runId || checkpoint.status !== 'READY'
    || checkpoint.stage !== stage || checkpoint.phase !== 'REWARD'
    || checkpoint.rewardCheckpoint?.runId !== runId || checkpoint.rewardCheckpoint.stage !== stage) {
    throw new Error('Factory reward changed before cards were saved.');
  }
  const cards = [...cardItemIds];
  if (checkpoint.rewardCheckpoint.status !== 'PENDING') {
    if (JSON.stringify(checkpoint.rewardCheckpoint.cardItemIds) !== JSON.stringify(cards)) {
      throw new Error('Different reward cards are already saved.');
    }
    return checkpoint;
  }
  const candidate: FactoryRewardCheckpoint = { runId, stage, status: 'READY', cardItemIds: cards };
  if (!hasValidFactoryRewardCheckpoint(candidate, runId, stage, checkpoint.playerTeam)) {
    throw new Error('Reward cards must be four distinct approved and claimable held items.');
  }
  const nextResume: BattleResumeSnapshot = {
    ...checkpoint,
    checkpointAt: new Date().toISOString(),
    rewardCheckpoint: candidate,
  };
  const nextSave: GameSaveData = {
    ...previous,
    updatedAt: new Date().toISOString(),
    factory: { ...previous.factory, battleResume: nextResume },
  };
  normalizeSaveDataSafely(nextSave);
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(nextSave));
  const confirmed = loadSaveData()?.factory.battleResume;
  if (confirmed?.status !== 'READY' || confirmed.phase !== 'REWARD'
    || confirmed.rewardCheckpoint?.status !== 'READY'
    || JSON.stringify(confirmed.rewardCheckpoint.cardItemIds) !== JSON.stringify(cards)) {
    throw new Error('Reward cards could not be verified after saving.');
  }
  return confirmed;
}

/**
 * 持久化点③：领取（`READY → CLAIMED`，原子）。
 * - 同 `(itemId, targetIndex)` 二次调用幂等返回同一检查点 ⇒ 双击/连点只领一次；
 * - 不同参数抛错且不写盘 ⇒ 不产生第二次 `CLAIMED`；
 * - 旧装备**直接移除、不进背包**（`inventoryItemIds` 不变），并因基准字段改写而立即回池。
 */
export function commitFactoryItemRewardClaim(
  runId: string,
  stage: number,
  itemId: FactoryRewardHeldItemId,
  targetIndex: number,
): BattleResumeSnapshot {
  if (typeof window === 'undefined') throw new Error('Save storage is unavailable.');
  const inspection = inspectStoredSave();
  if (inspection.kind !== 'valid') throw new Error('Saved reward cards are required.');
  const previous = inspection.save;
  const checkpoint = previous.factory.battleResume;
  if (!runId || previous.wallet.currentRunId !== runId || checkpoint.status !== 'READY'
    || checkpoint.stage !== stage || checkpoint.phase !== 'REWARD'
    || checkpoint.rewardCheckpoint?.runId !== runId || checkpoint.rewardCheckpoint.stage !== stage) {
    throw new Error('Factory reward changed before the item was claimed.');
  }
  const reward = checkpoint.rewardCheckpoint;
  if (reward.status === 'CLAIMED') {
    if (reward.claim.itemId !== itemId || reward.claim.targetIndex !== targetIndex) {
      throw new Error('A different reward was already claimed.');
    }
    return checkpoint;
  }
  if (reward.status !== 'READY' || !isFactoryRewardHeldItemId(itemId)
    || !reward.cardItemIds.includes(itemId)
    || !canEquipRewardItem(checkpoint.playerTeam, itemId, targetIndex)) {
    throw new Error('Item reward or target is not claimable.');
  }
  const nextTeam = checkpoint.playerTeam.map((pokemon, index) => (index === targetIndex
    ? { ...pokemon, factoryEquippedHeldItemId: itemId, factoryHeldItemId: itemId }
    : pokemon));
  const nextResume: BattleResumeSnapshot = {
    ...checkpoint,
    checkpointAt: new Date().toISOString(),
    playerTeam: nextTeam,
    rewardCheckpoint: {
      runId,
      stage,
      status: 'CLAIMED',
      cardItemIds: reward.cardItemIds,
      claim: { itemId, targetIndex },
    },
  };
  const nextSave: GameSaveData = {
    ...previous,
    updatedAt: new Date().toISOString(),
    factory: { ...previous.factory, battleResume: nextResume },
  };
  normalizeSaveDataSafely(nextSave);
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(nextSave));
  const confirmed = loadSaveData()?.factory.battleResume;
  if (confirmed?.status !== 'READY' || confirmed.phase !== 'REWARD'
    || confirmed.rewardCheckpoint?.status !== 'CLAIMED'
    || confirmed.rewardCheckpoint.claim.itemId !== itemId
    || confirmed.rewardCheckpoint.claim.targetIndex !== targetIndex) {
    throw new Error('Item reward could not be verified after saving.');
  }
  return confirmed;
}

/**
 * 持久化点④：`CLAIMED` 后请求进入下一战。幂等 ⇒ 刷新/重开后可再次点击而不重复起战。
 */
export function commitFactoryRewardContinueIntent(runId: string, stage: number): BattleResumeSnapshot {
  if (typeof window === 'undefined') throw new Error('Save storage is unavailable.');
  const inspection = inspectStoredSave();
  if (inspection.kind !== 'valid') throw new Error('A claimed reward checkpoint is required.');
  const previous = inspection.save;
  const checkpoint = previous.factory.battleResume;
  if (!runId || previous.wallet.currentRunId !== runId || checkpoint.status !== 'READY'
    || checkpoint.phase !== 'REWARD' || checkpoint.stage !== stage
    || checkpoint.rewardCheckpoint?.status !== 'CLAIMED'
    || checkpoint.rewardCheckpoint.runId !== runId || checkpoint.rewardCheckpoint.stage !== stage) {
    throw new Error('A claimed reward is required before continuing.');
  }
  if (checkpoint.rewardCheckpoint.continueRequested) return checkpoint;
  const nextResume: BattleResumeSnapshot = {
    ...checkpoint,
    checkpointAt: new Date().toISOString(),
    rewardCheckpoint: { ...checkpoint.rewardCheckpoint, continueRequested: true },
  };
  const nextSave: GameSaveData = {
    ...previous,
    updatedAt: new Date().toISOString(),
    factory: { ...previous.factory, battleResume: nextResume },
  };
  normalizeSaveDataSafely(nextSave);
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(nextSave));
  const confirmed = loadSaveData()?.factory.battleResume;
  if (confirmed?.status !== 'READY' || confirmed.phase !== 'REWARD'
    || confirmed.rewardCheckpoint?.status !== 'CLAIMED'
    || confirmed.rewardCheckpoint.continueRequested !== true) {
    throw new Error('Reward continuation could not be verified after saving.');
  }
  return confirmed;
}

export interface FactoryBattleStart {
  stage: number;
  playerTeam: GamePokemon[];
  enemyTeam: GamePokemon[];
  currentEnemyTrainerId: string;
  enemyAiTier: BattleResumeSnapshot['enemyAiTier'];
  specialBossBattleActive: boolean;
  swapped: boolean;
}

/** 换怪前后「是否同一名队员」的身份指纹（含上下场装备，不含战斗内变化）。 */
function factoryRewardMemberIdentity(pokemon: GamePokemon): string {
  return JSON.stringify({
    id: pokemon.id,
    speciesId: pokemon.speciesId,
    pokeApiName: pokemon.pokeApiName,
    formLedgerSlug: pokemon.formLedgerSlug,
    level: pokemon.level,
    nature: pokemon.nature,
    ivs: pokemon.ivs,
    evs: pokemon.evs,
    originalItem: pokemon.factoryOriginalHeldItemId,
    equippedItem: pokemon.factoryEquippedHeldItemId,
    moveNames: pokemon.selectedMoves.map((move) => move.name),
  });
}

function factoryBattleMemberFingerprint(pokemon: GamePokemon): string {
  return JSON.stringify({
    id: pokemon.id,
    speciesId: pokemon.speciesId,
    pokeApiName: pokemon.pokeApiName,
    formLedgerSlug: pokemon.formLedgerSlug,
    level: pokemon.level,
    nature: pokemon.nature,
    ivs: pokemon.ivs,
    evs: pokemon.evs,
    baseStats: pokemon.baseStats,
    calculatedStats: pokemon.calculatedStats,
    maxHp: pokemon.maxHp,
    currentHp: pokemon.currentHp,
    originalItem: pokemon.factoryOriginalHeldItemId,
    equippedItem: pokemon.factoryEquippedHeldItemId,
    currentItem: pokemon.factoryHeldItemId ?? null,
    selectedMoves: pokemon.selectedMoves.map((move) => ({
      name: move.name,
      pp: move.pp,
      maxPp: move.maxPp,
      currentPp: move.currentPp,
    })),
  });
}

function sameFactoryBattleTeam(left: GamePokemon[], right: GamePokemon[]): boolean {
  return left.length === right.length
    && left.every((pokemon, index) => factoryBattleMemberFingerprint(pokemon) === factoryBattleMemberFingerprint(right[index]));
}

/**
 * 起战前的队伍规整：三人返还基准重复时按下标保留首个持有者，重复者回落原配或空位，
 * 并把「本场当前持有物」对齐到修复后的基准（起战态定义见 `hasPreparedFactoryHeldItem`）。
 * 未发生时**逐项原样返回**，不做任何多余改写。
 */
function normalizeBattleStartTeam(team: GamePokemon[]): { team: GamePokemon[]; repaired: boolean } {
  const repair = repairFactoryHeldItemBaselines(team);
  if (!repair.repaired) return { team, repaired: false };
  return {
    team: repair.team.map((pokemon) => ({
      ...pokemon,
      factoryHeldItemId: pokemon.factoryEquippedHeldItemId ?? undefined,
    })),
    repaired: true,
  };
}

export function commitFactoryBattleStart(runId: string, start: FactoryBattleStart): BattleResumeSnapshot {
  if (typeof window === 'undefined') throw new Error('Save storage is unavailable.');
  const inspection = inspectStoredSave();
  if (inspection.kind !== 'valid') throw new Error('A saved factory result is required before the next battle.');
  const previous = inspection.save;
  const checkpoint = previous.factory.battleResume;
  if (!runId || previous.wallet.currentRunId !== runId || checkpoint.status !== 'READY') {
    throw new Error('Factory run changed before the next battle.');
  }
  if (checkpoint.stage === start.stage && checkpoint.phase === 'BATTLE') {
    const sameEncounter = checkpoint.currentEnemyTrainerId === start.currentEnemyTrainerId
      && sameFactoryBattleTeam(checkpoint.playerTeam, start.playerTeam)
      && sameFactoryBattleTeam(checkpoint.enemyTeam, start.enemyTeam);
    if (!sameEncounter) throw new Error('A different next battle is already saved.');
    return checkpoint;
  }
  // 不变量（裁决补遗一）：受损输入**修复而非抛错终止**，否则换怪/续战会被永久卡住。
  const startTeam = normalizeBattleStartTeam(start.playerTeam);
  // 奖励节点后的起战：必须「已领取 + 已请求继续」，且队伍与按返还基准返还的结果逐字段一致。
  const rewardStage = shouldEnterRewardAfterWinning(checkpoint.stage);
  const claimedRewardReadyToContinue = rewardStage && checkpoint.phase === 'REWARD'
    && checkpoint.rewardCheckpoint?.status === 'CLAIMED'
    && checkpoint.rewardCheckpoint.continueRequested === true
    && !start.swapped
    && sameFactoryBattleTeam(prepareFactoryPartyForBattle(checkpoint.playerTeam), startTeam.team);
  if (checkpoint.stage + 1 !== start.stage || checkpoint.roundResult !== 'WIN'
    || (rewardStage ? !claimedRewardReadyToContinue : !['ROUND_RESULT', 'FACTORY_SWAP', 'BASE'].includes(checkpoint.phase))
    || !getFactoryTrainerTemplateById(start.currentEnemyTrainerId)
    || startTeam.team.length === 0 || start.enemyTeam.length === 0
    || !startTeam.team.every((pokemon) => hasRecoverablePokemonCore(pokemon) && hasPreparedFactoryHeldItem(pokemon))
    || !start.enemyTeam.every((pokemon) => hasRecoverablePokemonCore(pokemon) && hasValidFactoryHeldItemState(pokemon))) {
    throw new Error('Next factory battle cannot start from this checkpoint.');
  }

  const setNo = getSetNoByStage(start.stage);
  const usedTrainers = previous.factory.trainerIdsBySet.filter((entry) => entry.setNo !== setNo);
  const inSet = previous.factory.trainerIdsBySet.find((entry) => entry.setNo === setNo)?.trainerIds ?? [];
  usedTrainers.push({ setNo, trainerIds: [...new Set([...inSet, start.currentEnemyTrainerId])] });
  usedTrainers.sort((a, b) => a.setNo - b.setNo);
  const nextResume: BattleResumeSnapshot = {
    ...checkpoint,
    checkpointAt: new Date().toISOString(),
    stage: start.stage,
    swapCount: checkpoint.swapCount + (start.swapped ? 1 : 0),
    totalRents: checkpoint.totalRents + (start.swapped ? 1 : 0),
    coins: previous.wallet.balance,
    enemyAiTier: start.enemyAiTier,
    specialBossBattleActive: start.specialBossBattleActive,
    battleSpecialUsage: { MEGA: false, DYNAMAX: false, TERA: false, ZMOVE: false },
    enemySpecialUsage: { MEGA: false, DYNAMAX: false, TERA: false, ZMOVE: false },
    turn: 'PLAYER',
    battleMenuTab: 'MAIN',
    weather: 'none',
    weatherTurns: 0,
    fieldState: [],
    fieldTurns: {},
    tailwindTurns: { player: 0, enemy: 0 },
    hazards: createEmptyBattleHazards(),
    activeBuffs: { atk: false, def: false },
    enemyBuffs: { atk: false, def: false },
    playerTeam: startTeam.team,
    enemyTeam: start.enemyTeam,
    currentEnemyTrainerId: start.currentEnemyTrainerId,
    battleLog: [],
    phase: 'BATTLE',
    roundResult: null,
    lastBpGain: 0,
    rewardCheckpoint: undefined,
    heldItemBaselineRepaired: startTeam.repaired || checkpoint.heldItemBaselineRepaired === true ? true : undefined,
  };
  const nextSave: GameSaveData = {
    ...previous,
    updatedAt: new Date().toISOString(),
    progress: { ...previous.progress, totalRents: nextResume.totalRents },
    factory: {
      ...previous.factory,
      challengePaused: false,
      challengeStatus: 1,
      curChallengeBattleNum: getBattleIndexInSet(start.stage) - 1,
      trainerIdsBySet: usedTrainers,
      battleResume: nextResume,
    },
  };
  normalizeSaveDataSafely(nextSave);
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(nextSave));
  return nextResume;
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
