import type { DexSnapshot } from '../../../services/pokedexClient';
import type { GameState } from '../../../types';
import type { BaseTab } from '../view-model';

// Matches GameView's two actual EventsScreen routes.
export function isEventDisplayPage(context: { gameState: GameState; currentBaseTab: BaseTab }) {
  return context.gameState === 'EVENTS' || (context.gameState === 'BASE' && context.currentBaseTab === 'EVENTS');
}

export type EventDisplayRecord =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; snapshot: DexSnapshot };

type SnapshotLoader = (ids: number[]) => Promise<Record<number, DexSnapshot>>;

// Local read-only display cache. Failed IDs only retry on explicit user intent.
export function createEventDisplaySnapshots(load: SnapshotLoader) {
  let records: Record<number, EventDisplayRecord> = {};
  let disposed = false;
  let sequence = 0;
  const tokens = new Map<number, number>();
  const pending = new Map<number, Promise<void>>();
  const listeners = new Set<() => void>();
  const publish = () => { if (!disposed) listeners.forEach((listener) => listener()); };

  const request = async (input: number[], retry = false): Promise<Record<number, EventDisplayRecord>> => {
    if (disposed) return records;
    const ids = [...new Set(input)].filter((id) => Number.isInteger(id) && id > 0);
    const missing = ids.filter((id) => !pending.has(id) && (!records[id] || (retry && records[id].phase === 'error')));
    if (missing.length > 0) {
      const token = ++sequence;
      records = { ...records };
      missing.forEach((id) => { tokens.set(id, token); records[id] = { phase: 'loading' }; });
      // Defer loader invocation until the pending map is populated, including synchronous failures.
      const batch = Promise.resolve().then(() => disposed ? {} : load(missing)).then((result) => {
        if (disposed) return;
        records = { ...records };
        missing.forEach((id) => {
          if (tokens.get(id) !== token) return;
          const snapshot = result[id];
          records[id] = snapshot?.id === id && snapshot.types?.length > 0
            ? { phase: 'ready', snapshot }
            : { phase: 'error' };
        });
      }).catch(() => {
        if (disposed) return;
        records = { ...records };
        missing.forEach((id) => { if (tokens.get(id) === token) records[id] = { phase: 'error' }; });
      }).finally(() => {
        missing.forEach((id) => { if (tokens.get(id) === token) pending.delete(id); });
        publish();
      });
      missing.forEach((id) => pending.set(id, batch));
      publish();
    }
    await Promise.all(ids.map((id) => pending.get(id)));
    return records;
  };

  return {
    request,
    getRecords: () => records,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose() { disposed = true; listeners.clear(); },
  };
}

// A delayed recommendation must not undo manual selection or write after leaving the screen.
export function createEventDisplayActionGuard() {
  let sequence = 0;
  return {
    begin: () => ++sequence,
    cancel: () => { sequence += 1; },
    isCurrent: (token: number, initialContext: string, currentContext: string, blocked: boolean) =>
      token === sequence && initialContext === currentContext && !blocked,
  };
}
