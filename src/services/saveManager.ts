import { createEmptyBaseInventory, createEmptyEventPersistentState, validateBaseInventory, validatePendingResult, nextBaseInventory, isBaseBallId, BASE_BALL_IDS, type BaseBallInventory, type EventPersistentState, type EventResourceCheckpoint, type PendingDispatchResult, type BaseBallId, type DispatchResultReceipt } from '../features/game/utils/baseBallInventory';
import { DISPATCH_ITEM_BALL_REWARD, EVENT_REGIONS } from '../features/game/config/events';
import type { BattleHazards, FieldState, FieldTurns, GamePokemon, TailwindTurns } from '../types';
import {
  getBattleIndexInSet,
  getFactoryGroupBp,
  getFactoryShelfSize,
  FACTORY_TICKETS_TO_BP_RATE,
  getSetNoByStage,
  MAX_FACTORY_BP,
  shouldEnterRewardAfterWinning,
} from '../features/game/config/factoryRewards';
import {
  canEquipFactoryRewardItem,
  getFactoryShopProductPrice,
  isFactoryRewardHeldItemId,
  isFactoryShopProduct,
  isFactoryShopProductUsable,
  normalizeFactoryHeldItemId,
  type FactoryRewardHeldItemId,
  type FactoryShopProduct,
} from '../features/game/config/factoryRewardPool';
import { isFactoryEvolutionItemId, type FactoryEvolutionItemId } from '../features/game/config/factoryEvolutionItems';
import { assertFactoryEvolutionPreserved } from '../features/game/config/factoryEvolutionRules';
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
import { normalizePermanentCollection, samePermanentAcquisition, validatePermanentAcquisitions, type PermanentAcquisition } from '../features/game/utils/permanentCollection';

const SAVE_STORAGE_KEY = 'pokefactory_save_v1';
const PENDING_SETTLEMENT_KEY = 'pokefactory_pending_settlement_v1';
const SAVE_SCHEMA_VERSION = 16 as const;

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
    /** 本次结算里来自「组末券折算」的 BP（1 券 = FACTORY_TICKETS_TO_BP_RATE BP）。 */
    ticketBp: number;
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
 * 一次成功兑换的入账记录（PRD 奖励商店 F3）：先扣券、再交货的原子结果。
 * `ticketsSpent` 为购买时的实际扣券数（档位价），用于审计「恰好按档位减少」。
 *
 * 第一阶段（merge a8ade80）落盘的记录**没有** `kind` 字段：读取时按 `HELD_ITEM` 处理，
 * 不做写盘迁移（PRD 奖励商店 S6「旧档读入必须兼容」）。
 */
export interface FactoryHeldItemPurchase {
  kind?: 'HELD_ITEM';
  itemId: FactoryRewardHeldItemId;
  targetIndex: number;
  ticketsSpent: number;
}

/**
 * 进化道具兑换记录（PRD 奖励商店 F4）：`fromSpeciesId` / `toSpeciesId` 一并留痕，
 * 既用于审计「换的是货架冻结的那个目标」，也让读档校验能证明进化确实发生过。
 * 进化**当场消耗**该道具，故不写入任何持有物字段、不进背包。
 */
export interface FactoryEvolutionItemPurchase {
  kind: 'EVOLUTION_ITEM';
  itemId: FactoryEvolutionItemId;
  targetIndex: number;
  fromSpeciesId: number;
  fromPokeApiName: string;
  toSpeciesId: number;
  toPokeApiName: string;
  ticketsSpent: number;
}

export type FactoryShopPurchase = FactoryHeldItemPurchase | FactoryEvolutionItemPurchase;

/** `kind === 'EVOLUTION_ITEM'` 才是进化记录；缺省（旧档）按持有道具处理。 */
export function isFactoryEvolutionPurchase(purchase: unknown): purchase is FactoryEvolutionItemPurchase {
  return isRecord(purchase) && purchase.kind === 'EVOLUTION_ITEM';
}

function isFactoryHeldItemPurchase(purchase: unknown): purchase is FactoryHeldItemPurchase {
  return isRecord(purchase) && (purchase.kind === undefined || purchase.kind === 'HELD_ITEM');
}

/**
 * 奖励商店节点检查点（PRD 奖励商店 F2/F3/F4、plan §2）。
 * `PENDING` 只记锚点；`READY` 冻结六件货架并累积兑换记录（`purchases` 可多次追加）；
 * `CLAIMED` = 商店已关闭（玩家离开，无论是否买过），`continueRequested` 记「已请求继续」意图。
 * 旧「四卡免费领」格式（`cardItemIds` / `claim`）读取时迁移为 `PENDING`（重新配货），不得崩溃。
 */
export type FactoryRewardCheckpoint =
  | { runId: string; stage: number; status: 'PENDING' }
  | { runId: string; stage: number; status: 'READY'; shelf: FactoryShopProduct[]; purchases: FactoryShopPurchase[] }
  | {
      runId: string;
      stage: number;
      status: 'CLAIMED';
      shelf: FactoryShopProduct[];
      purchases: FactoryShopPurchase[];
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
  acquisitions: PermanentAcquisition[];
}

export interface GameSaveData {
  baseInventory: BaseBallInventory;
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
  events: EventPersistentState & {
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
  events: Omit<GameSaveData['events'], keyof EventPersistentState> & Partial<EventPersistentState>;
  baseInventory?: BaseBallInventory;
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
        ticketBp: sanitizeSafeNonNegativeInt(settlement.ticketBp),
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
  // 旧「四卡免费领」格式在此迁移为 PENDING（重新配货，不崩溃）；新格式损坏则丢弃（整档按既有策略拒收）。
  const rewardCheckpoint = source.phase === 'REWARD'
    ? sanitizeFactoryRewardCheckpoint(source.rewardCheckpoint, stage)
    : undefined;
  // 不变量修复（裁决补遗一）：load / 旧档迁移 / 同版导入都必须让三人返还基准回到互不重复。
  // 已落盘的兑换（新 purchases / 旧 claim）目标优先保留，避免修复把「刚换到的装备」改判掉。
  // 注意：keepIndices 必须取自**迁移前**的原始记录——旧 CLAIMED 的 claim 目标才能在被迁移成
  // PENDING 之前参与保位。
  const claimedTargetIndex = phase === 'REWARD' ? resolveRewardKeepIndices(source.rewardCheckpoint) : [];
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

function sanitizeCollectionLedger(value: unknown, companionSpeciesId: number | null): CollectionLedger {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return normalizePermanentCollection({
    seenIds: sanitizeIntArray(source.seenIds),
    ownedIds: sanitizeIntArray(source.ownedIds),
    formKeys: sanitizeStringArray(source.formKeys),
    acquisitions: validatePermanentAcquisitions(source.acquisitions),
  }, companionSpeciesId);
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
    ...validateEventPersistentState(source),
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

function validateEventPersistentState(source: Record<string, unknown>): EventPersistentState {
  if (!isRecord(source.pendingResults) || !isRecord(source.completedResults)
    || !(source.resourceCheckpoint === null || isRecord(source.resourceCheckpoint))) throw new Error('Event transaction state is missing.');
  const pendingResults: EventPersistentState['pendingResults'] = {};
  for (const [key, value] of Object.entries(source.pendingResults)) {
    const pending = validatePendingResult(value);
    if (pending.key !== key) throw new Error('Pending dispatch identity mismatch.');
    pendingResults[key] = pending;
  }
  const completedResults: EventPersistentState['completedResults'] = {};
  for (const [key, value] of Object.entries(source.completedResults)) {
    if (!isRecord(value) || value.key !== key || typeof value.regionId !== 'string'
      || !EVENT_REGIONS.some((r) => r.id === value.regionId) || !Number.isSafeInteger(value.startedAt)
      || (value.startedAt as number) <= 0 || key !== `dispatch:${value.regionId}:${value.startedAt}`
      || !Number.isSafeInteger(value.at) || (value.at as number) < (value.startedAt as number)
      || typeof value.result !== 'string' || pendingResults[key]) throw new Error('Invalid completed dispatch.');
    completedResults[key] = value as unknown as DispatchResultReceipt;
  }
  let resourceCheckpoint: EventResourceCheckpoint | null = null;
  if (isRecord(source.resourceCheckpoint)) {
    const checkpoint = source.resourceCheckpoint;
    if (!Array.isArray(checkpoint.playerTeam) || checkpoint.playerTeam.length > 6
      || !checkpoint.playerTeam.every(hasRecoverablePokemonCore) || !Array.isArray(checkpoint.inventoryItemIds)
      || !checkpoint.inventoryItemIds.every((id) => typeof id === 'string' && !isBaseBallId(id) && /^[a-z][a-z0-9_]*$/.test(id))) throw new Error('Invalid event resources.');
    resourceCheckpoint = { playerTeam: sanitizeGamePokemonArray(checkpoint.playerTeam), inventoryItemIds: [...checkpoint.inventoryItemIds] };
  }
  return { pendingResults, completedResults, resourceCheckpoint };
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
    baseInventory: validateBaseInventory(source.baseInventory),
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
    collection: sanitizeCollectionLedger(source.collection, progress.companionSpeciesId as number | null),
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

function pokemonSpeciesId(pokemon: unknown): number | undefined {
  return isRecord(pokemon) && Number.isSafeInteger(pokemon.speciesId) ? pokemon.speciesId as number : undefined;
}

function pokemonFormSlug(pokemon: unknown): string | null {
  if (!isRecord(pokemon)) return null;
  const slug = pokemon.formLedgerSlug || pokemon.pokeApiName || pokemon.name;
  return typeof slug === 'string' ? slug.trim().toLowerCase() : null;
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

/**
 * 检查点合法性（新「奖励商店」格式 + 旧「四卡免费领」格式兼容读，PRD 奖励商店 S6）。
 * `playerTeam` 为 `null` 时跳过队伍级校验（仅结构校验）。
 */
function hasValidFactoryRewardCheckpoint(value: unknown, runId: unknown, stage: unknown, playerTeam: unknown): boolean {
  if (!isRecord(value) || value.runId !== runId || value.stage !== stage) return false;
  const team = Array.isArray(playerTeam) ? playerTeam : null;

  if (value.status === 'PENDING') {
    return value.shelf === undefined && value.cardItemIds === undefined && value.claim === undefined
      && value.purchases === undefined && value.continueRequested === undefined;
  }

  // ---- 新格式：奖励商店（shelf + purchases）----
  if (value.shelf !== undefined || value.purchases !== undefined) {
    const shelf = value.shelf;
    const shelfSize = getFactoryShelfSize();
    if (!Array.isArray(shelf) || shelf.length !== shelfSize || !shelf.every(isFactoryShopProduct)) return false;
    const shelfItemIds = shelf.map((product) => product.itemId);
    if (new Set(shelfItemIds).size !== shelfSize) return false;
    // 进化商品的冻结目标必须落在队内（店员只会摆出「队里用得上」的进化道具）。
    if (team !== null && !shelf.every((product) => product.kind === 'HELD_ITEM'
      || product.targets.every((target) => target.targetIndex < team.length))) return false;
    const productByItemId = new Map<string, FactoryShopProduct>(shelf.map((product) => [product.itemId, product]));
    const purchases = value.purchases;
    if (!Array.isArray(purchases)) return false;
    // 逐条兑换记录：必须命中架上的那件商品、付出该商品的确切价格，且按 `kind` 校验各自字段。
    if (purchases.some((purchase) => {
      if (!isRecord(purchase)) return true;
      const product = productByItemId.get(purchase.itemId as string);
      if (!product) return true;
      const targetIndex = purchase.targetIndex;
      const ticketsSpent = purchase.ticketsSpent;
      if (!Number.isSafeInteger(targetIndex) || (targetIndex as number) < 0) return true;
      if (team !== null && (targetIndex as number) >= team.length) return true;
      if (!Number.isSafeInteger(ticketsSpent) || (ticketsSpent as number) < 1) return true;
      if ((ticketsSpent as number) !== getFactoryShopProductPrice(product)) return true;
      if (product.kind === 'HELD_ITEM') {
        // 第一阶段旧档没有 `kind` 字段：`isFactoryHeldItemPurchase` 接受缺省值（不写盘迁移）。
        return !isFactoryHeldItemPurchase(purchase);
      }
      // 进化道具：必须精确命中货架冻结的 (队员, 进化前物种, 进化后物种) 三元组，不得改写任何一项。
      if (!isFactoryEvolutionPurchase(purchase)) return true;
      const fromSpeciesId = purchase.fromSpeciesId;
      const toSpeciesId = purchase.toSpeciesId;
      if (!Number.isSafeInteger(fromSpeciesId) || (fromSpeciesId as number) <= 0) return true;
      if (!Number.isSafeInteger(toSpeciesId) || (toSpeciesId as number) <= 0) return true;
      if (typeof purchase.fromPokeApiName !== 'string' || typeof purchase.toPokeApiName !== 'string') return true;
      return !product.targets.some((target) => (
        target.targetIndex === targetIndex
        && target.fromSpeciesId === fromSpeciesId
        && target.toSpeciesId === toSpeciesId
        && target.fromPokeApiName === purchase.fromPokeApiName
        && target.toPokeApiName === purchase.toPokeApiName
      ));
    })) return false;
    // 同一件商品只能兑换成功一次：已购商品不得重复入账。
    const purchasedIds = purchases.map((purchase) => (isRecord(purchase) ? purchase.itemId : null));
    if (purchasedIds.some((itemId, index) => itemId !== null && purchasedIds.indexOf(itemId) !== index)) return false;
    if (value.cardItemIds !== undefined || value.claim !== undefined) return false;
    // 历史兑换可以被后续购买覆盖：按队员/类别只校验最后一笔的当前效果。
    // 每笔的合法货架目标、价格与唯一性已在上面逐条验过。
    const latestHeld = new Map<number, FactoryHeldItemPurchase>();
    const latestEvolution = new Map<number, FactoryEvolutionItemPurchase>();
    for (const purchase of purchases) {
      if (isFactoryEvolutionPurchase(purchase)) latestEvolution.set(purchase.targetIndex, purchase);
      else latestHeld.set(purchase.targetIndex, purchase as FactoryHeldItemPurchase);
    }
    if (team !== null && purchases.length > 0
      && (![...latestHeld.values()].every((purchase) => (
        isRecord(team[purchase.targetIndex])
        && (team[purchase.targetIndex] as Record<string, unknown>).factoryEquippedHeldItemId === purchase.itemId
      )) || ![...latestEvolution.values()].every((purchase) => (
        pokemonSpeciesId(team[purchase.targetIndex]) === purchase.toSpeciesId
        && pokemonFormSlug(team[purchase.targetIndex]) === purchase.toPokeApiName
      )) || !hasUniqueEquippedItems(team))) {
      return false;
    }
    if (value.status === 'READY') {
      return value.continueRequested === undefined;
    }
    if (value.status !== 'CLAIMED' || (value.continueRequested !== undefined && value.continueRequested !== true)) {
      return false;
    }
    return true;
  }

  // ---- 旧格式：四卡免费领（cardItemIds [+ claim]），读入不崩溃，由 sanitize 迁移 ----
  const cards = value.cardItemIds;
  if (value.status !== 'READY' && value.status !== 'CLAIMED') return false;
  if (!Array.isArray(cards) || cards.length === 0 || !cards.every(isFactoryRewardHeldItemId)
    || new Set(cards).size !== cards.length) return false;
  if (value.status === 'READY') {
    if (value.claim !== undefined || value.continueRequested !== undefined) return false;
    return team === null
      || cards.every((itemId) => team.some((_, index) => canEquipRewardItem(team, itemId, index)));
  }
  if (value.continueRequested !== undefined && value.continueRequested !== true) return false;
  if (!isRecord(value.claim)
    || !isFactoryRewardHeldItemId(value.claim.itemId)
    || !cards.includes(value.claim.itemId)
    || !Number.isSafeInteger(value.claim.targetIndex)
    || (value.claim.targetIndex as number) < 0
    || (team !== null && (value.claim.targetIndex as number) >= team.length)) return false;
  if (team === null) return true;
  const target = team[value.claim.targetIndex as number];
  return isRecord(target) && target.factoryEquippedHeldItemId === value.claim.itemId
    && target.factoryHeldItemId === value.claim.itemId && hasUniqueEquippedItems(team);
}

/**
 * `CLAIMED` / `READY` 检查点须优先保住基准的队员下标（`repairFactoryHeldItemBaselines` 的 `keepIndices` 输入）。
 * 新格式取全部兑换目标；旧格式取旧领取目标。已购 / 已领装备必须优先保住，否则读档修复会把它们改判掉。
 */
function resolveRewardKeepIndices(rewardCheckpoint: unknown): number[] {
  if (!isRecord(rewardCheckpoint)) return [];
  const purchases = rewardCheckpoint.purchases;
  if (Array.isArray(purchases)) {
    return purchases
      .map((purchase) => (isRecord(purchase) ? purchase.targetIndex : null))
      .filter((targetIndex): targetIndex is number => Number.isSafeInteger(targetIndex));
  }
  if (rewardCheckpoint.status === 'CLAIMED' && isRecord(rewardCheckpoint.claim)) {
    const targetIndex = rewardCheckpoint.claim.targetIndex;
    return Number.isSafeInteger(targetIndex) ? [targetIndex as number] : [];
  }
  return [];
}

/**
 * 旧「四卡免费领」检查点（`cardItemIds`，无 `shelf`/`purchases`）识别。
 * 这些是上一阶段（merge f6518c3）落盘的合法旧档，读入必须迁移而非崩溃。
 */
function isLegacyFourCardRewardCheckpoint(value: Record<string, unknown>): boolean {
  if (value.shelf !== undefined || value.purchases !== undefined) return false;
  if (value.status === 'PENDING') return value.cardItemIds === undefined && value.claim === undefined;
  if (value.status !== 'READY' && value.status !== 'CLAIMED') return false;
  return Array.isArray(value.cardItemIds)
    && value.cardItemIds.length > 0
    && value.cardItemIds.every(isFactoryRewardHeldItemId);
}

/**
 * 奖励检查点读取归一（PRD 奖励商店 S6 存档兼容）：
 * - 新格式：结构完整则原样保留（货架冻结，不得重抽）；
 * - 旧四卡格式：迁移为 `PENDING`（重新配货摆满 6 件；旧档无已购记录、无扣券，迁移不构成重复给）；
 * - 损坏：返回 `undefined`，整档按既有策略拒收。
 */
function sanitizeFactoryRewardCheckpoint(value: unknown, stage: number): FactoryRewardCheckpoint | undefined {
  if (!isRecord(value)) return undefined;
  const runId = typeof value.runId === 'string' && value.runId.length > 0 ? value.runId : null;
  if (runId === null || value.stage !== stage) return undefined;
  // 旧四卡格式优先识别：一律迁移为 PENDING（重新配货），不得按新格式保留。
  if (isLegacyFourCardRewardCheckpoint(value)) {
    return { runId, stage, status: 'PENDING' };
  }
  if (hasValidFactoryRewardCheckpoint(value, runId, stage, null)) {
    return value as unknown as FactoryRewardCheckpoint;
  }
  return undefined;
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
    if (Array.isArray(resume.inventoryItemIds) && resume.inventoryItemIds.some(isBaseBallId)) throw new Error('Factory inventory cannot contain base balls.');
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
      { keepIndices: resolveRewardKeepIndices(resume.rewardCheckpoint) },
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
    events: { ...createEmptyEventPersistentState(), ...input.events },
    baseInventory: input.baseInventory ?? createEmptyBaseInventory(),
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

/** Keep committed acquisition receipts when an older in-memory draft is saved. */
function serializeSaveData(draft: GameSaveData, replace = false, eventWrite = false): string {
  const inspection = inspectStoredSave();
  if (inspection.kind !== 'none' && inspection.kind !== 'valid') {
    throw new Error('Stored save requires backup or removal before writing.');
  }
  const stored = !replace && inspection.kind === 'valid' ? inspection.save : null;
  const companionSpeciesId = stored?.progress.companionSpeciesId ?? draft.progress.companionSpeciesId;
  const acquisitions = validatePermanentAcquisitions([
    ...(stored?.collection.acquisitions ?? []), ...draft.collection.acquisitions,
  ]);
  const collection = normalizePermanentCollection({
    ...draft.collection,
    seenIds: [...new Set([...(stored?.collection.seenIds ?? []), ...draft.collection.seenIds])],
    acquisitions,
  }, companionSpeciesId);
  const dispatches = { ...draft.events.dispatches };
  let baseInventory = stored && !eventWrite ? stored.baseInventory : draft.baseInventory;
  let persistent = stored && !eventWrite ? stored.events : draft.events;
  if (stored && !replace && draft.wallet.currentRunId !== null && draft.wallet.currentRunId !== stored.wallet.currentRunId) {
    baseInventory = nextBaseInventory(baseInventory);
    persistent = { ...persistent, resourceCheckpoint: null };
  }
  if (stored) {
    for (const receipt of Object.values(stored.events.completedResults)) {
      if (dispatches[receipt.regionId]?.startedAt === receipt.startedAt) {
        dispatches[receipt.regionId] = stored.events.dispatches[receipt.regionId];
      }
    }
  }
  if (stored) {
    for (const record of stored.collection.acquisitions) {
      const stale = dispatches[record.regionId];
      const committed = stored.events.dispatches[record.regionId];
      if (stale?.startedAt === record.dispatchStartedAt && committed) {
        dispatches[record.regionId] = committed;
      }
    }
  }
  return JSON.stringify({
    ...draft,
    collection,
    progress: { ...draft.progress, companionSpeciesId },
    baseInventory,
    events: { ...draft.events, dispatches, pendingResults: persistent.pendingResults,
      completedResults: persistent.completedResults, resourceCheckpoint: persistent.resourceCheckpoint },
  });
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
      keepIndices: resolveRewardKeepIndices(battleResume.rewardCheckpoint),
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
  window.localStorage.setItem(SAVE_STORAGE_KEY, serializeSaveData({
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
  if (!persisted || persisted.progress.companionSpeciesId !== speciesId
    || !persisted.collection.ownedIds.includes(speciesId) || !persisted.collection.seenIds.includes(speciesId)) {
    throw new Error('Companion selection could not be verified after saving.');
  }
  return persisted;
}

export function replaceSaveData(saveData: GameSaveData) {
  if (typeof window === 'undefined') throw new Error('Save storage is unavailable.');
  const normalized = normalizeSaveDataSafely(saveData);
  const inspection = inspectStoredSave();
  if (inspection.kind !== 'none' && inspection.kind !== 'valid') {
    throw new Error('Stored save requires backup or removal before replacement.');
  }
  window.localStorage.setItem(SAVE_STORAGE_KEY, serializeSaveData(normalized, true));
}

export function commitPermanentAcquisition(
  draft: GameSaveData,
  record: PermanentAcquisition,
  completedDispatch: GameSaveData['events']['dispatches'][string],
): { save: GameSaveData; applied: boolean } {
  if (typeof window === 'undefined') throw new Error('Save storage is unavailable.');
  const inspection = inspectStoredSave();
  if (inspection.kind !== 'valid') throw new Error('A valid save is required for a permanent acquisition.');
  const stored = inspection.save;
  validatePermanentAcquisitions([record]);
  if (stored.progress.companionSpeciesId === null) throw new Error('Companion selection is required.');
  const existing = stored.collection.acquisitions.find((entry) => entry.acquisitionId === record.acquisitionId);
  if (existing) {
    if (!samePermanentAcquisition(existing, record)) throw new Error('Conflicting permanent acquisition record.');
    return { save: stored, applied: false };
  }
  if (completedDispatch.status !== 'IDLE' || completedDispatch.startedAt !== null || completedDispatch.readyAt !== null) {
    throw new Error('Acquisition must complete its dispatch.');
  }
  if (record.source === 'DISPATCH_JOIN') {
    const dispatch = stored.events.dispatches[record.regionId];
    if (!dispatch || dispatch.startedAt !== record.dispatchStartedAt
      || (dispatch.status !== 'READY' && !(dispatch.status === 'RUNNING' && dispatch.readyAt !== null && dispatch.readyAt <= Date.now()))) {
      throw new Error('Dispatch is not ready for this acquisition.');
    }
  }
  const next: GameSaveData = {
    ...draft,
    progress: { ...draft.progress, companionSpeciesId: stored.progress.companionSpeciesId },
    collection: normalizePermanentCollection({
      ...draft.collection,
      acquisitions: validatePermanentAcquisitions([...stored.collection.acquisitions, ...draft.collection.acquisitions, record]),
    }, stored.progress.companionSpeciesId),
    events: {
      ...draft.events,
      dispatches: { ...draft.events.dispatches, [record.regionId]: completedDispatch },
    },
  };
  const serialized = serializeSaveData(next);
  const committed = parseSaveDataFromText(serialized);
  window.localStorage.setItem(SAVE_STORAGE_KEY, serialized);
  return { save: committed, applied: true };
}

/** All event resource transactions use one current stored save and one final write. */
function requireEventSave(): GameSaveData {
  const save = loadSaveData();
  if (!save || save.progress.companionSpeciesId === null) throw new Error('A bound, valid save is required.');
  return save;
}
function writeEventSave(save: GameSaveData): GameSaveData {
  const serialized = serializeSaveData(save, false, true);
  const normalized = parseSaveDataFromText(serialized);
  window.localStorage.setItem(SAVE_STORAGE_KEY, serialized);
  return normalized;
}
function assertDispatchReady(save: GameSaveData, pending: PendingDispatchResult) {
  validatePendingResult(pending);
  const dispatch = save.events.dispatches[pending.regionId];
  if (!dispatch || dispatch.startedAt !== pending.startedAt
    || !(dispatch.status === 'READY' || (dispatch.status === 'RUNNING' && dispatch.readyAt !== null && dispatch.readyAt <= Date.now()))
    || !save.collection.ownedIds.includes(pending.selectedPokemonId)
    || save.events.dispatchPokemonByRegion[pending.regionId] !== pending.selectedPokemonId) throw new Error('Dispatch changed before receipt.');
}
export function prepareDispatchResult(pending: PendingDispatchResult): GameSaveData {
  const save = requireEventSave();
  if (save.wallet.currentRunId !== null) throw new Error('Factory challenge blocks dispatch rewards.');
  if (save.events.completedResults[pending.key] || save.events.pendingResults[pending.key]) return save;
  assertDispatchReady(save, pending);
  return writeEventSave({ ...save, baseInventory: nextBaseInventory(save.baseInventory), events: { ...save.events,
    pendingResults: { ...save.events.pendingResults, [pending.key]: pending } } });
}
export function commitDispatchResult(input: {
  key: string; result: string; resources: EventResourceCheckpoint; acquisition?: PermanentAcquisition;
}): { save: GameSaveData; applied: boolean } {
  const save = requireEventSave();
  if (save.wallet.currentRunId !== null) throw new Error('Factory challenge blocks dispatch rewards.');
  if (save.events.completedResults[input.key]) return { save, applied: false };
  const pending = save.events.pendingResults[input.key];
  if (!pending) throw new Error('A saved dispatch result is required.');
  assertDispatchReady(save, pending);
  const at = Date.now();
  let baseInventory = save.baseInventory;
  let collection = save.collection;
  if (pending.outcome === 'item') {
    baseInventory = nextBaseInventory(baseInventory, { id: input.key, dispatchKey: input.key,
      kind: 'ITEM', ballId: 'pokeball', delta: DISPATCH_ITEM_BALL_REWARD, at });
  } else if (input.acquisition) {
    if (pending.outcome !== 'join' || input.acquisition.acquisitionId !== input.key || input.acquisition.source !== 'DISPATCH_JOIN') throw new Error('Dispatch acquisition mismatch.');
    const ballId = BASE_BALL_IDS.find((id) => baseInventory.balls[id] > 0);
    if (!ballId) throw new Error('No base balls available.');
    baseInventory = nextBaseInventory(baseInventory, { id: input.key, dispatchKey: input.key, kind: 'JOIN', ballId, delta: -1, at });
    collection = normalizePermanentCollection({ ...collection,
      acquisitions: validatePermanentAcquisitions([...collection.acquisitions, input.acquisition]) }, save.progress.companionSpeciesId);
  } else baseInventory = nextBaseInventory(baseInventory);
  const pendingResults = { ...save.events.pendingResults };
  delete pendingResults[input.key];
  const receipt: DispatchResultReceipt = { key: input.key, regionId: pending.regionId, startedAt: pending.startedAt, result: input.result, at };
  return { applied: true, save: writeEventSave({ ...save, baseInventory, collection, events: { ...save.events,
    pendingResults, completedResults: { ...save.events.completedResults, [input.key]: receipt },
    resourceCheckpoint: input.resources,
    dispatches: { ...save.events.dispatches, [pending.regionId]: { status: 'IDLE', startedAt: null, readyAt: null, lastResolvedAt: at, lastResult: input.result } },
  } }) };
}
export function commitEventBallAttempt(input: {
  dispatchKey: string; attemptId: string; ballId: BaseBallId; acquisition?: PermanentAcquisition;
  resources: EventResourceCheckpoint;
}): { save: GameSaveData; applied: boolean } {
  const save = requireEventSave();
  if (save.wallet.currentRunId !== null) throw new Error('Factory challenge cannot consume base balls.');
  const receipt = save.events.completedResults[input.dispatchKey];
  if (!receipt) throw new Error('Unknown event battle source.');
  if (save.baseInventory.transactions.some((tx) => tx.id === input.attemptId)
    || save.collection.acquisitions.some((entry) => entry.acquisitionId === input.dispatchKey)) return { save, applied: false };
  if (!input.attemptId.startsWith(`${input.dispatchKey}:attempt:`) || !isBaseBallId(input.ballId)) throw new Error('Invalid ball attempt.');
  let collection = save.collection;
  if (input.acquisition) {
    if (input.acquisition.acquisitionId !== input.dispatchKey || input.acquisition.source !== 'DISPATCH_CATCH') throw new Error('Catch source mismatch.');
    collection = normalizePermanentCollection({ ...collection,
      acquisitions: validatePermanentAcquisitions([...collection.acquisitions, input.acquisition]) }, save.progress.companionSpeciesId);
  }
  const baseInventory = nextBaseInventory(save.baseInventory, { id: input.attemptId, dispatchKey: input.dispatchKey,
    kind: input.acquisition ? 'CATCH' : 'ATTEMPT', ballId: input.ballId, delta: -1, at: Date.now() });
  return { applied: true, save: writeEventSave({ ...save, baseInventory, collection,
    events: { ...save.events, resourceCheckpoint: input.resources } }) };
}
export function persistEventResources(resources: EventResourceCheckpoint, expectedRevision: number): GameSaveData {
  const save = requireEventSave();
  if (save.baseInventory.revision !== expectedRevision || save.wallet.currentRunId !== null) return save;
  if (JSON.stringify(save.events.resourceCheckpoint) === JSON.stringify(resources)) return save;
  return writeEventSave({ ...save, baseInventory: nextBaseInventory(save.baseInventory),
    events: { ...save.events, resourceCheckpoint: resources } });
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
  window.localStorage.setItem(SAVE_STORAGE_KEY, serializeSaveData({ ...save, wallet: nextWallet, updatedAt: new Date().toISOString() }));
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
): { wallet: FactoryWallet; runSupply: FactoryRunSupply; awarded: boolean; amount: number; nominalBp: number; ticketBp: number } {
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
        ticketBp: current.lastSettlement?.runId === runId && current.lastSettlement.stage === stage
          ? current.lastSettlement.ticketBp ?? 0
          : 0,
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
    // 组末券折算 BP（PRD F7 / decisions.md 第一节）：七战整组获胜的结算环节，
    // 剩余券（含本战刚攒到的第 7 张）按 1 券 = FACTORY_TICKETS_TO_BP_RATE BP 并入同一次结算，
    // 折算后券清零，下一组从 0 张重攒；中途败退不折算（createEmptyRunSupply 现行为保持不变）。
    const ticketBp = result === 'WIN' && completesSet
      ? (currentSupply.tickets + 1) * FACTORY_TICKETS_TO_BP_RATE
      : 0;
    const runSupply: FactoryRunSupply = result === 'WIN'
      ? completesSet
        ? { runId, tickets: 0, lastCreditedStage: stage }
        : { runId, tickets: currentSupply.tickets + 1, lastCreditedStage: stage }
      : createEmptyRunSupply();
    const playerTeam = restoreFactoryParty(finalTeams?.playerTeam ?? sourceResume.playerTeam);
    const enemyTeam = finalTeams?.enemyTeam ?? sourceResume.enemyTeam;
    const amount = completesSet ? Math.min(nominalBp + ticketBp, MAX_FACTORY_BP - current.balance) : 0;
    const wallet: FactoryWallet = {
      ...current,
      balance: current.balance + amount,
      brainSymbols: completesSet && result === 'WIN' && isFrontierBrain ? Math.min(2, current.brainSymbols + 1) : current.brainSymbols,
      revision: nextWalletRevision(current),
      settledThrough: completesSet ? setNo : current.settledThrough,
      lastSettlement: completesSet
        ? { runId, setNo, stage, result, isFrontierBrain, nominalBp, ticketBp, amount, settledAt: new Date().toISOString() }
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
    window.localStorage.setItem(SAVE_STORAGE_KEY, serializeSaveData(nextSave));
    clearPendingFactorySettlement();
    return { wallet, runSupply, awarded: completesSet, amount, nominalBp, ticketBp };
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
  window.localStorage.setItem(SAVE_STORAGE_KEY, serializeSaveData(nextSave));
  const confirmed = loadSaveData()?.factory.battleResume;
  if (confirmed?.status !== 'READY' || confirmed.phase !== 'REWARD'
    || confirmed.rewardCheckpoint?.runId !== runId || confirmed.rewardCheckpoint.stage !== stage) {
    throw new Error('Reward checkpoint could not be verified after saving.');
  }
  return confirmed;
}

/**
 * 持久化点②：冻结货架（`PENDING → READY`，六件商品）。
 * 同锚点二次调用同货架幂等返回；不同货架抛错 ⇒ 刷新/重开/导入**不重抽**（PRD F2.4）。
 */
export function commitFactoryRewardReady(
  runId: string,
  stage: number,
  shelf: readonly FactoryShopProduct[],
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
  const frozenShelf = [...shelf];
  const shelfSize = getFactoryShelfSize();
  if (!Array.isArray(frozenShelf) || frozenShelf.length !== shelfSize
    || !frozenShelf.every(isFactoryShopProduct)
    || new Set(frozenShelf.map((product) => product.itemId)).size !== shelfSize) {
    throw new Error('Reward shelf must be distinct approved shop products.');
  }
  if (checkpoint.rewardCheckpoint.status !== 'PENDING') {
    if (JSON.stringify(checkpoint.rewardCheckpoint.shelf) !== JSON.stringify(frozenShelf)) {
      throw new Error('Different reward cards are already saved.');
    }
    return checkpoint;
  }
  // 冻结不变量：每件商品此刻至少有一个可用对象（与候选枚举的断言同口径）——
  // 持有道具 = 至少一个合法装备位；进化道具 = 至少一个冻结目标尚未失效。
  const baselineItemIds = checkpoint.playerTeam.map(pokemonEquippedItemId);
  if (!frozenShelf.every((product) => isFactoryShopProductUsable(baselineItemIds, checkpoint.playerTeam, product))) {
    throw new Error('Reward shelf products must each have a legal teammate.');
  }
  const candidate: FactoryRewardCheckpoint = {
    runId,
    stage,
    status: 'READY',
    shelf: frozenShelf,
    purchases: [],
  };
  if (!hasValidFactoryRewardCheckpoint(candidate, runId, stage, checkpoint.playerTeam)) {
    throw new Error('Reward cards must be distinct approved and claimable held items.');
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
  window.localStorage.setItem(SAVE_STORAGE_KEY, serializeSaveData(nextSave));
  const confirmed = loadSaveData()?.factory.battleResume;
  if (confirmed?.status !== 'READY' || confirmed.phase !== 'REWARD'
    || confirmed.rewardCheckpoint?.status !== 'READY'
    || JSON.stringify(confirmed.rewardCheckpoint.shelf) !== JSON.stringify(frozenShelf)) {
    throw new Error('Reward cards could not be verified after saving.');
  }
  return confirmed;
}

/**
 * 持久化点③：兑换（`READY` 上原子追加一条 `purchases`，先扣券、再交货，要么全成、要么全不做）。
 * - 券扣减（`runSupply.tickets`）与装备改写在**同一次**落盘里完成 ⇒ 无半兑换态；
 * - 同 `(itemId, targetIndex)` 二次调用幂等返回同一检查点 ⇒ 双击/连点只扣一次券；
 * - 同一件商品换目标 / 不同商品已购：抛错且不写盘；
 * - 券不足、目标不合法：抛错且不写盘，留在商店可重试（不推进战次、不少给、不重复给）；
 * - 旧装备**直接移除、不进背包**（`inventoryItemIds` 不变），并因基准字段改写而立即回池。
 */
export function commitFactoryShopPurchase(
  runId: string,
  stage: number,
  itemId: FactoryRewardHeldItemId,
  targetIndex: number,
): { resume: BattleResumeSnapshot; runSupply: FactoryRunSupply } {
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
  if (reward.status !== 'READY') {
    // 商店已关闭：兑换路径不复存在（防御性，正常 UI 不可达）。
    throw new Error('The reward shop is closed.');
  }
  const existingPurchase = reward.purchases.find((purchase) => (
    isFactoryHeldItemPurchase(purchase) && purchase.itemId === itemId
  ));
  if (existingPurchase) {
    if (existingPurchase.targetIndex !== targetIndex) {
      throw new Error('This reward was already claimed.');
    }
    return { resume: checkpoint, runSupply: previous.runSupply };
  }
  const shelfProduct = reward.shelf.find((product) => product.kind === 'HELD_ITEM' && product.itemId === itemId);
  const price = shelfProduct ? getFactoryShopProductPrice(shelfProduct) : null;
  if (price === null || !shelfProduct
    || !canEquipRewardItem(checkpoint.playerTeam, itemId, targetIndex)) {
    throw new Error('Item reward or target is not claimable.');
  }
  const supply = previous.runSupply;
  if (supply.runId !== runId) {
    throw new Error('Factory supply does not match the reward run.');
  }
  if (!Number.isSafeInteger(supply.tickets) || supply.tickets < price) {
    throw new Error('Not enough reward tickets.');
  }
  const nextTickets = supply.tickets - price;
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
      status: 'READY',
      shelf: reward.shelf,
      purchases: [...reward.purchases, { itemId, targetIndex, ticketsSpent: price }],
    },
  };
  const nextSave: GameSaveData = {
    ...previous,
    updatedAt: new Date().toISOString(),
    runSupply: { ...supply, tickets: nextTickets },
    factory: { ...previous.factory, battleResume: nextResume },
  };
  normalizeSaveDataSafely(nextSave);
  window.localStorage.setItem(SAVE_STORAGE_KEY, serializeSaveData(nextSave));
  const confirmed = loadSaveData();
  const confirmedResume = confirmed?.factory.battleResume;
  const confirmedReward = confirmedResume?.status === 'READY' ? confirmedResume.rewardCheckpoint : undefined;
  if (confirmed?.runSupply.runId !== runId || confirmed.runSupply.tickets !== nextTickets
    || confirmedResume?.status !== 'READY' || confirmedResume.phase !== 'REWARD'
    || confirmedReward?.status !== 'READY'
    || !confirmedReward.purchases.some((purchase) => (
      purchase.itemId === itemId && purchase.targetIndex === targetIndex && purchase.ticketsSpent === price
    ))) {
    throw new Error('Item reward could not be verified after saving.');
  }
  return { resume: confirmedResume, runSupply: confirmed.runSupply };
}

/**
 * 持久化点③′：兑换进化道具（PRD 奖励商店 F4，`READY` 上原子追加一条进化记录）。
 *
 * 与持有道具兑换同构（先扣券、再交货，要么全成、要么全不做），但「交货」= **当场进化**：
 * - 道具当场消耗（不进背包、不写任何持有物字段）；
 * - `evolvedTeam` 由调用方用 `pokeApi.buildEvolvedFactoryPokemon` 产生，本函数在落盘前用
 *   `assertFactoryEvolutionPreserved` **证明**保留契约（等级 / 个体值 / 努力值 / 性格 / 性别 /
 *   四招逐招且顺序 / 三个持有物字段 / 其余队员逐字段不变），任一被破坏即抛错不写盘；
 * - 目标必须精确命中货架冻结的三元组 `(targetIndex, fromSpeciesId, toSpeciesId)`，
 *   且队员当前物种仍等于 `fromSpeciesId`（先被别件道具进化过则本件失效，**不得**静默顶替）；
 * - 同一件商品二次调用同参数幂等返回同一检查点；换目标 / 换物种抛错且不写盘；
 * - 券不足、参数不合法：抛错且不写盘，留在商店可重试（不推进战次、不少给、不重复给）。
 */
export function commitFactoryEvolutionPurchase(
  runId: string,
  stage: number,
  itemId: FactoryEvolutionItemId,
  targetIndex: number,
  toSpeciesId: number,
  toPokeApiName: string,
  evolvedTeam: readonly GamePokemon[],
): { resume: BattleResumeSnapshot; runSupply: FactoryRunSupply } {
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
  if (reward.status !== 'READY') {
    throw new Error('The reward shop is closed.');
  }
  const existingPurchase = reward.purchases.find((purchase) => isFactoryEvolutionPurchase(purchase) && purchase.itemId === itemId) ?? null;
  if (existingPurchase && existingPurchase.itemId === itemId) {
    if (existingPurchase.targetIndex !== targetIndex || existingPurchase.toSpeciesId !== toSpeciesId
      || existingPurchase.toPokeApiName !== toPokeApiName) {
      throw new Error('This reward was already claimed.');
    }
    return { resume: checkpoint, runSupply: previous.runSupply };
  }
  const shelfProduct = reward.shelf.find((product) => (
    product.kind === 'EVOLUTION_ITEM' && product.itemId === itemId
  )) ?? null;
  const evolutionProduct = shelfProduct && shelfProduct.kind === 'EVOLUTION_ITEM' ? shelfProduct : null;
  const price = evolutionProduct ? getFactoryShopProductPrice(evolutionProduct) : null;
  const target = evolutionProduct?.targets.find((entry) => (
    entry.targetIndex === targetIndex && entry.toSpeciesId === toSpeciesId
      && entry.toPokeApiName === toPokeApiName
  ));
  if (!evolutionProduct || price === null || !target) {
    throw new Error('Evolution reward or target is not claimable.');
  }
  // 货架冻结的是「这只队员当时的物种」：队员若已被别件道具进化过，本件即失效。
  if (pokemonSpeciesId(checkpoint.playerTeam[targetIndex]) !== target.fromSpeciesId
    || pokemonFormSlug(checkpoint.playerTeam[targetIndex]) !== target.fromPokeApiName) {
    throw new Error('Evolution target is no longer available.');
  }
  if (!Array.isArray(evolvedTeam) || evolvedTeam.length !== checkpoint.playerTeam.length
    || !evolvedTeam.every((pokemon) => hasRecoverablePokemonCore(pokemon) && hasValidFactoryHeldItemState(pokemon))
    || !hasUniqueEquippedItems(evolvedTeam)) {
    throw new Error('Evolved factory team is invalid.');
  }
  // 保留契约（等级 / 个体值 / 努力值 / 性格 / 性别 / 四招顺序 / 持有物 / 其余队员）必须成立。
  assertFactoryEvolutionPreserved(checkpoint.playerTeam, evolvedTeam, targetIndex, toSpeciesId);
  if (pokemonFormSlug(evolvedTeam[targetIndex]) !== toPokeApiName) {
    throw new Error('Evolved form does not match the frozen shelf.');
  }
  const supply = previous.runSupply;
  if (supply.runId !== runId) {
    throw new Error('Factory supply does not match the reward run.');
  }
  if (!Number.isSafeInteger(supply.tickets) || supply.tickets < price) {
    throw new Error('Not enough reward tickets.');
  }
  const nextTickets = supply.tickets - price;
  const nextResume: BattleResumeSnapshot = {
    ...checkpoint,
    checkpointAt: new Date().toISOString(),
    playerTeam: [...evolvedTeam],
    rewardCheckpoint: {
      runId,
      stage,
      status: 'READY',
      shelf: reward.shelf,
      purchases: [
        ...reward.purchases,
        {
          kind: 'EVOLUTION_ITEM',
          itemId,
          targetIndex,
          fromSpeciesId: target.fromSpeciesId,
          fromPokeApiName: target.fromPokeApiName,
          toSpeciesId,
          toPokeApiName: target.toPokeApiName,
          ticketsSpent: price,
        },
      ],
    },
  };
  const nextSave: GameSaveData = {
    ...previous,
    updatedAt: new Date().toISOString(),
    runSupply: { ...supply, tickets: nextTickets },
    factory: { ...previous.factory, battleResume: nextResume },
  };
  normalizeSaveDataSafely(nextSave);
  window.localStorage.setItem(SAVE_STORAGE_KEY, serializeSaveData(nextSave));
  const confirmed = loadSaveData();
  const confirmedResume = confirmed?.factory.battleResume;
  const confirmedReward = confirmedResume?.status === 'READY' ? confirmedResume.rewardCheckpoint : undefined;
  if (confirmed?.runSupply.runId !== runId || confirmed.runSupply.tickets !== nextTickets
    || confirmedResume?.status !== 'READY' || confirmedResume.phase !== 'REWARD'
    || pokemonSpeciesId(confirmedResume.playerTeam[targetIndex]) !== toSpeciesId
    || pokemonFormSlug(confirmedResume.playerTeam[targetIndex]) !== target.toPokeApiName
    || confirmedReward?.status !== 'READY'
    || !confirmedReward.purchases.some((purchase) => (
      isFactoryEvolutionPurchase(purchase)
      && purchase.itemId === itemId && purchase.targetIndex === targetIndex
      && purchase.toSpeciesId === toSpeciesId && purchase.ticketsSpent === price
    ))) {
    throw new Error('Evolution reward could not be verified after saving.');
  }
  return { resume: confirmedResume, runSupply: confirmed.runSupply };
}

/**
 * 持久化点④：离开商店（`READY → CLAIMED`，无论是否买过）并请求进入下一战。
 * 幂等 ⇒ 刷新/重开后可再次点击而不重复起战。买过与否由 `purchases` 留痕，不另设标志。
 */
export function commitFactoryRewardContinueIntent(runId: string, stage: number): BattleResumeSnapshot {
  if (typeof window === 'undefined') throw new Error('Save storage is unavailable.');
  const inspection = inspectStoredSave();
  if (inspection.kind !== 'valid') throw new Error('A claimed reward checkpoint is required.');
  const previous = inspection.save;
  const checkpoint = previous.factory.battleResume;
  if (!runId || previous.wallet.currentRunId !== runId || checkpoint.status !== 'READY'
    || checkpoint.phase !== 'REWARD' || checkpoint.stage !== stage
    || checkpoint.rewardCheckpoint?.runId !== runId || checkpoint.rewardCheckpoint.stage !== stage) {
    throw new Error('A claimed reward is required before continuing.');
  }
  const reward = checkpoint.rewardCheckpoint;
  if (reward.status === 'CLAIMED') {
    if (reward.continueRequested) return checkpoint;
  } else if (reward.status !== 'READY') {
    throw new Error('A claimed reward is required before continuing.');
  }
  const nextResume: BattleResumeSnapshot = {
    ...checkpoint,
    checkpointAt: new Date().toISOString(),
    rewardCheckpoint: {
      runId,
      stage,
      status: 'CLAIMED',
      shelf: reward.shelf,
      purchases: reward.purchases,
      continueRequested: true,
    },
  };
  const nextSave: GameSaveData = {
    ...previous,
    updatedAt: new Date().toISOString(),
    factory: { ...previous.factory, battleResume: nextResume },
  };
  normalizeSaveDataSafely(nextSave);
  window.localStorage.setItem(SAVE_STORAGE_KEY, serializeSaveData(nextSave));
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
  window.localStorage.setItem(SAVE_STORAGE_KEY, serializeSaveData(nextSave));
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
