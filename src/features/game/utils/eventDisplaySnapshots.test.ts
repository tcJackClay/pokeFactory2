import assert from 'node:assert/strict';
import test from 'node:test';
import type { DexSnapshot } from '../../../services/pokedexClient';
import { createEventDisplayActionGuard, createEventDisplaySnapshots } from './eventDisplaySnapshots';

const snapshot = (id: number): DexSnapshot => ({ id, apiName: `pokemon-${id}`, names: [], sprite: '', types: ['normal'], baseStats: { hp: 1, attack: 1, defense: 1, spAtk: 1, spDef: 1, speed: 1 }, learnableMoves: [] });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

test('summary and picker share pending IDs, preserving independent completed batches', async () => {
  const a = deferred<Record<number, DexSnapshot>>();
  const b = deferred<Record<number, DexSnapshot>>();
  const calls: number[][] = [];
  const store = createEventDisplaySnapshots((ids) => { calls.push(ids); return ids[0] === 1 ? a.promise : b.promise; });
  const summary = store.request([1, 1]);
  const picker = store.request([1, 2]);
  assert.equal(store.getRecords()[1].phase, 'loading');
  await Promise.resolve();
  assert.deepEqual(calls, [[1], [2]]);
  b.resolve({ 2: snapshot(2) });
  await Promise.resolve();
  a.resolve({ 1: snapshot(1) });
  await Promise.all([summary, picker]);
  assert.equal(store.getRecords()[1].phase, 'ready');
  assert.equal(store.getRecords()[2].phase, 'ready');
  await store.request([1, 2]);
  assert.equal(calls.length, 2);
});

test('partial, missing and invalid records fail individually without a request loop; retry keeps successes', async () => {
  let count = 0;
  const store = createEventDisplaySnapshots(async (ids) => {
    count += 1;
    if (count === 1) return { 1: snapshot(1), 3: { ...snapshot(3), types: [] }, 4: snapshot(99) };
    assert.deepEqual(ids, [2, 3, 4]);
    return Object.fromEntries(ids.map((id) => [id, snapshot(id)]));
  });
  await store.request([1, 2, 3, 4]);
  assert.deepEqual(Object.values(store.getRecords()).map((r) => r.phase), ['ready', 'error', 'error', 'error']);
  await store.request([1, 2, 3, 4]);
  assert.equal(count, 1);
  await store.request([1, 2, 3, 4], true);
  assert.equal(count, 2);
  assert.ok(Object.values(store.getRecords()).every((r) => r.phase === 'ready'));
});

test('rejected loader settles loading and explicit retry can recover', async () => {
  let fail = true;
  const store = createEventDisplaySnapshots(async () => {
    if (fail) throw new Error('network');
    return { 25: snapshot(25) };
  });
  await store.request([25]);
  assert.equal(store.getRecords()[25].phase, 'error');
  fail = false;
  await store.request([25], true);
  assert.equal(store.getRecords()[25].phase, 'ready');
});

test('disposed store ignores a late batch and cannot publish or initiate requests', async () => {
  const wait = deferred<Record<number, DexSnapshot>>();
  let notifications = 0;
  let calls = 0;
  const store = createEventDisplaySnapshots(() => { calls += 1; return wait.promise; });
  store.subscribe(() => { notifications += 1; });
  const pending = store.request([25]);
  await Promise.resolve();
  store.dispose();
  wait.resolve({ 25: snapshot(25) });
  await pending;
  await store.request([133]);
  assert.equal(notifications, 1);
  assert.equal(calls, 1);
  assert.equal(store.getRecords()[25].phase, 'loading');
  assert.equal(store.getRecords()[133], undefined);
});

test('new lifecycle is independent from old disposed requests', async () => {
  const late = deferred<Record<number, DexSnapshot>>();
  const old = createEventDisplaySnapshots(() => late.promise);
  const oldRequest = old.request([25]);
  old.dispose();
  const current = createEventDisplaySnapshots(async () => ({ 133: snapshot(133) }));
  await current.request([133]);
  late.resolve({ 25: snapshot(25) });
  await oldRequest;
  assert.deepEqual(Object.keys(current.getRecords()), ['133']);
});

test('recommendation guard rejects replacement, changed selection/ownership, resume and leave', () => {
  const guard = createEventDisplayActionGuard();
  const first = guard.begin();
  assert.equal(guard.isCurrent(first, 'owned:25|selected:25', 'owned:25|selected:25', false), true);
  assert.equal(guard.isCurrent(first, 'selected:25', 'selected:133', false), false);
  assert.equal(guard.isCurrent(first, 'owned:25', 'owned:25,133', false), false);
  assert.equal(guard.isCurrent(first, 'same', 'same', true), false);
  const second = guard.begin();
  assert.equal(guard.isCurrent(first, 'same', 'same', false), false);
  guard.cancel();
  assert.equal(guard.isCurrent(second, 'same', 'same', false), false);
});
