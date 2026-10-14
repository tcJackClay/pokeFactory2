import type { GamePokemon } from '../../../types';
import type { DispatchOutcome } from './eventDispatchRewards';
import { EVENT_REGIONS, EVENT_GROWTH_ITEM_IDS, DISPATCH_ITEM_BALL_REWARD } from '../config/events';

export const BASE_BALL_IDS = ['pokeball', 'greatball', 'ultraball', 'masterball'] as const;
export type BaseBallId = typeof BASE_BALL_IDS[number];
export type BaseBallCounts = Record<BaseBallId, number>;
export interface BaseBallTransaction {
  id: string;
  dispatchKey: string;
  kind: 'ITEM' | 'JOIN' | 'CATCH' | 'ATTEMPT';
  ballId: BaseBallId;
  delta: number;
  at: number;
}
export interface BaseBallInventory { revision: number; balls: BaseBallCounts; transactions: BaseBallTransaction[] }
export interface PendingDispatchResult {
  key: string;
  regionId: string;
  startedAt: number;
  selectedPokemonId: number;
  outcome: DispatchOutcome;
  growthItemId: string | null;
}
export interface DispatchResultReceipt { key: string; regionId: string; startedAt: number; result: string; at: number }
export interface EventResourceCheckpoint { playerTeam: GamePokemon[]; inventoryItemIds: string[] }
export interface EventPersistentState {
  pendingResults: Record<string, PendingDispatchResult>;
  completedResults: Record<string, DispatchResultReceipt>;
  resourceCheckpoint: EventResourceCheckpoint | null;
}
export function createEmptyBaseInventory(): BaseBallInventory {
  return { revision: 0, balls: { pokeball: 0, greatball: 0, ultraball: 0, masterball: 0 }, transactions: [] };
}
export function createEmptyEventPersistentState(): EventPersistentState {
  return { pendingResults: {}, completedResults: {}, resourceCheckpoint: null };
}
export function isBaseBallId(value: unknown): value is BaseBallId {
  return typeof value === 'string' && (BASE_BALL_IDS as readonly string[]).includes(value);
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const uint = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
export function validateBaseInventory(value: unknown): BaseBallInventory {
  if (!record(value) || !uint(value.revision) || !record(value.balls) || !Array.isArray(value.transactions)
    || Object.keys(value.balls).length !== BASE_BALL_IDS.length
    || !BASE_BALL_IDS.every((id) => uint((value.balls as Record<string, unknown>)[id]))) throw new Error('Invalid base ball inventory.');
  const ids = new Set<string>();
  for (const tx of value.transactions) {
    if (!record(tx) || typeof tx.id !== 'string' || !tx.id || ids.has(tx.id)
      || typeof tx.dispatchKey !== 'string' || !/^dispatch:[a-z]+:[1-9]\d*$/.test(tx.dispatchKey)
      || !EVENT_REGIONS.some((region) => tx.dispatchKey === `dispatch:${region.id}:${(tx.dispatchKey as string).split(':')[2]}`)
      || (tx.kind === 'ITEM' || tx.kind === 'JOIN' ? tx.id !== tx.dispatchKey : !tx.id.startsWith(`${tx.dispatchKey}:attempt:`))
      || !isBaseBallId(tx.ballId) || !uint(tx.at) || !['ITEM', 'JOIN', 'CATCH', 'ATTEMPT'].includes(String(tx.kind))
      || (tx.kind === 'ITEM' ? tx.delta !== DISPATCH_ITEM_BALL_REWARD || tx.ballId !== 'pokeball' : tx.delta !== -1)) throw new Error('Invalid ball transaction.');
    ids.add(tx.id);
  }
  return { revision: value.revision, balls: Object.fromEntries(BASE_BALL_IDS.map((id) => [id, (value.balls as BaseBallCounts)[id]])) as BaseBallCounts, transactions: structuredClone(value.transactions) as BaseBallTransaction[] };
}
export function validatePendingResult(value: unknown): PendingDispatchResult {
  if (!record(value) || typeof value.regionId !== 'string' || !EVENT_REGIONS.some((r) => r.id === value.regionId)
    || !uint(value.startedAt) || value.startedAt === 0 || value.key !== `dispatch:${value.regionId}:${value.startedAt}`
    || !uint(value.selectedPokemonId) || value.selectedPokemonId === 0
    || !['item', 'join', 'battle'].includes(String(value.outcome))
    || (value.outcome === 'item' ? !(EVENT_GROWTH_ITEM_IDS as readonly unknown[]).includes(value.growthItemId) : value.growthItemId !== null)) throw new Error('Invalid pending dispatch result.');
  return structuredClone(value) as unknown as PendingDispatchResult;
}
export function nextBaseInventory(inventory: BaseBallInventory, tx?: BaseBallTransaction): BaseBallInventory {
  if (inventory.revision === Number.MAX_SAFE_INTEGER) throw new Error('Inventory revision overflow.');
  const next = structuredClone(inventory);
  next.revision++;
  if (tx) {
    if (next.transactions.some((entry) => entry.id === tx.id)) throw new Error('Duplicate ball transaction.');
    const count = next.balls[tx.ballId] + tx.delta;
    if (!uint(count)) throw new Error('Not enough balls or inventory overflow.');
    next.balls[tx.ballId] = count;
    next.transactions.push(tx);
  }
  return validateBaseInventory(next);
}

let attemptSequence = 0;
/** No battle RNG is consumed for transaction identity; LAN HTTP also works. */
export function createBallAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}:${++attemptSequence}`;
}
