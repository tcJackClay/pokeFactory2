import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
import type { DexSnapshot } from '../../../services/pokedexClient';
import { createEventDisplayActionGuard, createEventDisplaySnapshots, isEventDisplayPage } from './eventDisplaySnapshots';
import { EVENT_REGIONS } from '../config/events';

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

// Execute the production EventsScreen callbacks (the repository's static callback-test pattern).
// This detects route wiring errors that a precomputed "blocked" boolean cannot detect.
function eventCallback(name: string, scope: Record<string, unknown>) {
  const path = new URL('../components/game-view/EventsScreen.tsx', import.meta.url);
  const source = fs.readFileSync(path, 'utf8');
  const tree = ts.createSourceFile(path.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression: string | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name && node.initializer && ts.isArrowFunction(node.initializer)) {
      expression = node.initializer.getText(tree);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(expression, `Missing production callback ${name}`);
  const js = ts.transpileModule(`const actual = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(scope), `${js}; return actual;`)(...Object.values(scope));
}

function recommendationHarness(gameState: 'BASE' | 'EVENTS' = 'BASE', currentBaseTab = 'EVENTS') {
  let recommendation: any = null;
  const selections: Array<[string, number]> = [];
  const pending: Array<ReturnType<typeof deferred<Record<number, any>>>> = [];
  const scope: Record<string, any> = {
    hasFactoryRunToResume: false,
    collectionOwnedIds: [133],
    contextKey: 'initial-selection',
    latest: { current: { contextKey: 'initial-selection', hasFactoryRunToResume: false, gameState, currentBaseTab } },
    mounted: { current: true },
    actionGuard: { current: createEventDisplayActionGuard() },
    EVENT_REGIONS, isEventDisplayPage,
    setRecommendation: (value: any) => { recommendation = typeof value === 'function' ? value(recommendation) : value; },
    ensure: () => { const wait = deferred<Record<number, any>>(); pending.push(wait); return wait.promise; },
    setEventDispatchPokemon: (region: string, id: number) => { selections.push([region, id]); },
  };
  const pick = eventCallback('pickRecommendedPokemon', scope) as (region: string) => Promise<void>;
  const cancel = eventCallback('cancelRecommendation', scope) as () => void;
  const resolve = (index = 0) => pending[index].resolve({ 133: { phase: 'ready', snapshot: snapshot(133) } });
  return { scope, pick, cancel, resolve, selections, pending, status: () => recommendation };
}

for (const route of [{ gameState: 'BASE', currentBaseTab: 'EVENTS' }, { gameState: 'EVENTS', currentBaseTab: 'HOME' }] as const) {
  test(`real recommendation completes on ${route.gameState}/${route.currentBaseTab} and releases loading`, async () => {
    const h = recommendationHarness(route.gameState, route.currentBaseTab);
    const request = h.pick('kanto');
    assert.equal(h.status().status, 'loading');
    h.resolve();
    await request;
    assert.deepEqual(h.selections, [['kanto', 133]]);
    assert.equal(h.status(), null);
  });
}

test('real BASE event recommendation rejects a late response after another base tab and can retry on return', async () => {
  const h = recommendationHarness();
  const first = h.pick('kanto');
  h.scope.latest.current.currentBaseTab = 'COLLECTION';
  h.resolve();
  await first;
  assert.deepEqual(h.selections, []);
  assert.equal(h.status(), null);
  await h.pick('kanto');
  assert.equal(h.pending.length, 1, 'cannot start another request while off the event page');
  h.scope.latest.current.currentBaseTab = 'EVENTS';
  const retry = h.pick('kanto');
  h.resolve(1);
  await retry;
  assert.deepEqual(h.selections, [['kanto', 133]]);
  assert.equal(h.status(), null);
});

test('real recommendation rejects late selection changes, resume and battle transitions without stuck loading', async () => {
  for (const change of [
    { contextKey: 'manually-selected-new-member' },
    { hasFactoryRunToResume: true },
    { gameState: 'BATTLE' },
  ]) {
    const h = recommendationHarness();
    const request = h.pick('kanto');
    Object.assign(h.scope.latest.current, change);
    h.resolve();
    await request;
    assert.deepEqual(h.selections, []);
    assert.equal(h.status(), null);
  }
});

test('real manual cancel releases loading and an older callback cannot clear a new request spinner', async () => {
  const h = recommendationHarness();
  const first = h.pick('kanto');
  h.cancel();
  assert.equal(h.status(), null);
  const second = h.pick('kanto');
  const secondToken = h.status().token;
  h.resolve(0);
  await first;
  assert.deepEqual(h.selections, []);
  assert.equal(h.status().token, secondToken);
  assert.equal(h.status().status, 'loading');
  h.resolve(1);
  await second;
  assert.deepEqual(h.selections, [['kanto', 133]]);
  assert.equal(h.status(), null);
});

test('real unmounted recommendation does not write UI or select after its response', async () => {
  const h = recommendationHarness();
  const request = h.pick('kanto');
  const oldState = h.status();
  h.scope.mounted.current = false;
  h.resolve();
  await request;
  assert.deepEqual(h.selections, []);
  assert.equal(h.status(), oldState, 'must not call a React setter after unmount');
});
