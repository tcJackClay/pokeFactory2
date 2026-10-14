import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import type { GamePokemon } from '../../../types';
import {
  parseSaveDataFromText, replaceSaveData, loadSaveData, persistSaveData, prepareDispatchResult,
  commitDispatchResult, commitEventBallAttempt, persistEventResources, beginFactoryWalletRun,
  endFactoryWalletRun, adjustWalletBalance, startEventDispatch, deferDispatchBattle,
} from '../../../services/saveManager';
import { BASE_BALL_IDS, createEmptyBaseInventory, createEmptyEventPersistentState, isBaseBallId, validateBaseInventory } from '../utils/baseBallInventory';
import { EVENT_REGIONS, DISPATCH_ITEM_BALL_REWARD, createDefaultDispatchState } from '../config/events';
import { applyDispatchTrainingToTeam, getStatLabel, rollDispatchOutcome } from '../utils/eventDispatchRewards';
import { getDispatchAcquisitionId } from '../utils/permanentCollection';

function callback(file: string, name: string, scope: Record<string, unknown>) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let expression = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name && node.initializer && ts.isCallExpression(node.initializer)) expression = node.initializer.arguments[0].getText(tree);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(expression, name);
  const js = ts.transpileModule(`const actual = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${js}; return actual;`)(...Object.values(scope));
}
const key = 'pokefactory_save_v1';
function pokemon(id = 133): GamePokemon {
  const stats = { hp: 60, attack: 60, defense: 60, spAtk: 60, spDef: 60, speed: 60 };
  return { id, name: `pokemon-${id}`, level: 50, currentHp: 120, maxHp: 120, sprites: {}, types: [{ slot: 1, type: { name: 'normal', url: '' } }], abilities: [], selectedMoves: [{ name: 'tackle', type: 'normal' }], nature: { name: 'Hardy', plus: null, minus: null }, baseStats: stats, calculatedStats: stats, ivs: { ...stats, hp: 1 }, evs: { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 }, statStages: { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0, evasion: 0 } } as unknown as GamePokemon;
}
function base() {
  return parseSaveDataFromText(JSON.stringify({ schemaVersion: 16,
    baseInventory: createEmptyBaseInventory(), progress: { companionSpeciesId: 133 },
    collection: { acquisitions: [], seenIds: [], ownedIds: [], formKeys: [] },
    wallet: { balance: 0, revision: 0, currentRunId: null, brainSymbols: 0, settledThrough: 0 },
    runSupply: { runId: null, tickets: 0, lastCreditedStage: 0 }, factory: { battleResume: { status: 'EMPTY' } },
    events: { ...createEmptyEventPersistentState(), dispatchPokemonByRegion: { kanto: 133, johto: 133 },
      dispatches: { kanto: { status: 'READY', startedAt: 100, readyAt: 200 }, johto: { status: 'READY', startedAt: 300, readyAt: 400 } } },
  }));
}
async function storage(fn: (data: Map<string, string>, fail: () => void) => Promise<void> | void) {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const data = new Map<string, string>();
  let fails = false;
  const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { if (fails) { fails = false; throw new Error('storage fault'); } data.set(k, v); }, removeItem: (k: string) => data.delete(k) };
  Object.defineProperty(globalThis, 'window', { value: { localStorage: store, sessionStorage: store }, configurable: true });
  try { replaceSaveData(base()); await fn(data, () => { fails = true; }); }
  finally { if (old) Object.defineProperty(globalThis, 'window', old); else delete (globalThis as { window?: unknown }).window; }
}
function scopeFor(outcome: 'item' | 'join' | 'battle' = 'item') {
  const saved = loadSaveData()!;
  const state: Record<string, any> = { playerTeam: [pokemon()], inventory: [], eventDispatches: saved.events.dispatches, collectionLedger: saved.collection };
  const scope: Record<string, any> = {
    EVENT_REGIONS, BASE_BALL_IDS, DISPATCH_ITEM_BALL_REWARD, createDefaultDispatchState,
    eventDispatches: state.eventDispatches, eventDispatchPokemonByRegion: saved.events.dispatchPokemonByRegion,
    eventRuntimeRef: { current: { playerTeam: state.playerTeam, inventory: state.inventory, gameState: 'EVENTS', currentBaseTab: 'EVENTS', eventBattleActive: false } },
    baseInventoryRef: { current: saved.baseInventory }, eventPersistentRef: { current: saved.events },
    dispatchInFlightRef: { current: false }, preparedDispatchRef: { current: {} }, factoryResumeActiveRef: { current: false },
    dispatchContextRef: { current: 'events' }, skipExitPersistRef: { current: false },
    StaleDispatchError: class StaleDispatchError extends Error {},
    fetchPokemon: async () => ({ types: [{ type: { name: 'normal' } }] }),
    loadSaveData, prepareDispatchResult, commitDispatchResult, startEventDispatch, deferDispatchBattle, getDispatchAcquisitionId,
    applyDispatchTrainingToTeam, getStatLabel,
    pickGrowthRewardItem: () => ({ id: 'protein' }), getEventItemLabel: () => 'Protein',
    rollDispatchOutcome: () => outcome, ALL_ITEMS: [{ id: 'protein' }],
    getLocalized: (p: any) => p.name, startLevel: 50, RARE_SPECIES_POOL: [],
    isEvolutionChainBaseSpecies: async () => true, getProcessedPokemon: async (id: number) => pokemon(id),
    pickSpecialSiteEncounter: () => null, createEmptyBattleHazards: () => ({}),
    hydrateInventoryFromItemIds: (ids: string[]) => ids.map((id) => ({ id })),
    t: (id: string, values?: unknown) => `${id}:${JSON.stringify(values ?? {})}`,
  };
  for (const setter of new Set(fs.readFileSync(new URL('./usePokeFactoryGame.ts', import.meta.url), 'utf8').match(/\bset[A-Z]\w*/g))) {
    const prop = setter[3].toLowerCase() + setter.slice(4);
    scope[setter] = (value: any) => { state[prop] = typeof value === 'function' ? value(state[prop]) : value; };
  }
  scope.syncEventSave = callback('./usePokeFactoryGame.ts', 'syncEventSave', scope);
  scope.isDispatchContextCurrent = callback('./usePokeFactoryGame.ts', 'isDispatchContextCurrent', scope);
  scope.resolveDispatchRegion = callback('./usePokeFactoryGame.ts', 'resolveDispatchRegion', scope);
  return { scope, state, dispatch: callback('./usePokeFactoryGame.ts', 'dispatchEventRegion', scope) };
}

const resources = () => ({ playerTeam: [pokemon()], inventoryItemIds: [] });
const pending = (outcome: 'item' | 'join' | 'battle' = 'item', regionId = 'kanto', startedAt = 100) => ({ key: getDispatchAcquisitionId(regionId, startedAt), regionId, startedAt, selectedPokemonId: 133, outcome, growthItemId: outcome === 'item' ? 'protein' : null });
function giveBalls() { prepareDispatchResult(pending()); return commitDispatchResult({ key: pending().key, result: 'item', resources: resources() }).save; }
function restart(region = 'kanto', at = 500) {
  const saved = loadSaveData()!;
  saved.events.dispatches[region] = { status: 'READY', startedAt: at, readyAt: at + 1, lastResult: '', lastResolvedAt: null };
  persistSaveData(saved);
}

test('base inventory rejects malformed counts and transaction identities; v15 is not migrated', async () => storage(() => {
  for (const count of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    const inventory = createEmptyBaseInventory(); inventory.balls.pokeball = count;
    assert.throws(() => validateBaseInventory(inventory));
  }
  assert.throws(() => validateBaseInventory({ ...createEmptyBaseInventory(), balls: { ...createEmptyBaseInventory().balls, fake: 2 } }));
  const saved = base();
  assert.throws(() => parseSaveDataFromText(JSON.stringify({ ...saved, schemaVersion: 15 })));
  assert.throws(() => parseSaveDataFromText(JSON.stringify({ ...saved, baseInventory: undefined })));
}));

test('actual item callback saves growth, training, three balls and completed dispatch once', async () => storage(async () => {
  const { scope, state, dispatch } = scopeFor();
  await dispatch('kanto');
  const saved = loadSaveData()!;
  assert.equal(saved.baseInventory.balls.pokeball, 3);
  assert.deepEqual(saved.events.resourceCheckpoint?.inventoryItemIds, ['protein']);
  assert.ok(saved.events.resourceCheckpoint!.playerTeam[0].evs!.hp > 0);
  assert.equal(saved.events.dispatches.kanto.status, 'IDLE');
  assert.match(state.eventDispatchPopup.message, /dispatchItemAndBalls/);
  await dispatch('kanto'); // original stale closure, same result
  assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 3);
  assert.equal(scope.dispatchInFlightRef.current, false);
  restart('kanto', 500);
  const next = scopeFor(); await next.dispatch('kanto');
  assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 6);
}));

test('actual item callback preparation and final-write failures do not partially reward; retries keep saved outcome', async () => storage(async (data, fail) => {
  const { scope, state, dispatch } = scopeFor();
  const original = data.get(key);
  fail(); await dispatch('kanto');
  assert.equal(data.get(key), original);
  assert.equal(state.eventDispatchPopup, undefined);
  assert.equal(state.inventory.length, 0);
  let calls = 0;
  scope.rollDispatchOutcome = () => { calls++; return 'join'; };
  // Re-extract after replacing dependencies; the retained pending object wins.
  scope.resolveDispatchRegion = callback('./usePokeFactoryGame.ts', 'resolveDispatchRegion', scope);
  scope.prepareDispatchResult = (p: any) => { const saved = prepareDispatchResult(p); fail(); return saved; };
  scope.resolveDispatchRegion = callback('./usePokeFactoryGame.ts', 'resolveDispatchRegion', scope);
  await callback('./usePokeFactoryGame.ts', 'dispatchEventRegion', scope)('kanto');
  assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 0);
  assert.equal(loadSaveData()!.events.pendingResults[pending().key].outcome, 'item');
  assert.equal(state.playerTeam[0].evs.hp, 0);
  scope.prepareDispatchResult = prepareDispatchResult;
  scope.resolveDispatchRegion = callback('./usePokeFactoryGame.ts', 'resolveDispatchRegion', scope);
  await callback('./usePokeFactoryGame.ts', 'dispatchEventRegion', scope)('kanto');
  assert.equal(calls, 0);
  assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 3);
  assert.equal(loadSaveData()!.events.pendingResults[pending().key], undefined);
}));

test('stale automatic saves and wallet writers preserve issued and spent balls; import replaces instead of adding', async () => storage(() => {
  const stale = loadSaveData()!;
  giveBalls();
  restart('johto', 300);
  prepareDispatchResult(pending('join', 'johto', 300));
  commitDispatchResult({ key: pending('join', 'johto', 300).key, result: 'join', resources: resources(), acquisition: {
    acquisitionId: 'dispatch:johto:300', regionId: 'johto', dispatchStartedAt: 300, acquiredAt: Date.now(), speciesId: 175, source: 'DISPATCH_JOIN',
  } });
  persistSaveData(stale); adjustWalletBalance(stale, 0);
  const saved = loadSaveData()!;
  assert.equal(saved.baseInventory.balls.pokeball, 2);
  assert.equal(saved.events.dispatches.kanto.status, 'IDLE');
  assert.equal(saved.events.dispatches.johto.status, 'IDLE');
  const exported = JSON.stringify(saved);
  replaceSaveData(parseSaveDataFromText(exported));
  assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 2);
  replaceSaveData(stale);
  assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 0);
  assert.equal(Object.keys(loadSaveData()!.events.completedResults).length, 0);
}));

test('new ordinary factory atomically invalidates temporary reward snapshot but keeps base balls', async () => storage(() => {
  const issued = giveBalls();
  const run = beginFactoryWalletRun(issued);
  assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 3);
  assert.equal(loadSaveData()!.events.resourceCheckpoint, null);
  persistEventResources(resources(), issued.baseInventory.revision);
  persistSaveData(issued);
  assert.equal(loadSaveData()!.events.resourceCheckpoint, null);
  endFactoryWalletRun(loadSaveData()!, run.currentRunId!);
  assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 3);
}));

test('ball failure and successful catch share atomic permanent stock and receipt; failures and repeated attempt do not spend twice', async () => storage((data, fail) => {
  giveBalls(); restart('kanto', 500);
  prepareDispatchResult(pending('battle', 'kanto', 500));
  commitDispatchResult({ key: 'dispatch:kanto:500', result: 'battle', resources: resources() });
  const input = { dispatchKey: 'dispatch:kanto:500', attemptId: 'dispatch:kanto:500:attempt:1', ballId: 'pokeball' as const, resources: resources() };
  const before = data.get(key); fail(); assert.throws(() => commitEventBallAttempt(input)); assert.equal(data.get(key), before);
  assert.equal(commitEventBallAttempt(input).applied, true);
  assert.equal(commitEventBallAttempt(input).applied, false);
  assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 2);
  assert.deepEqual(loadSaveData()!.collection.ownedIds, [133]);
  const caught = { ...input, attemptId: 'dispatch:kanto:500:attempt:2', acquisition: {
    acquisitionId: 'dispatch:kanto:500', regionId: 'kanto', dispatchStartedAt: 500, acquiredAt: Date.now(), speciesId: 25, source: 'DISPATCH_CATCH' as const,
  } };
  const preCatch = data.get(key); fail(); assert.throws(() => commitEventBallAttempt(caught)); assert.equal(data.get(key), preCatch);
  commitEventBallAttempt(caught);
  assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 1);
  assert.deepEqual(loadSaveData()!.collection.ownedIds, [25, 133]);
  assert.equal(commitEventBallAttempt({ ...caught, attemptId: 'dispatch:kanto:500:attempt:3' }).applied, false);
  assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 1);
}));

test('Alola adds rock at the end, preserving training, duration, pool and outcome thresholds', () => {
  const alola = EVENT_REGIONS.find((r) => r.id === 'alola')!;
  assert.deepEqual(alola.requiredTypes, ['fairy', 'ghost', 'grass', 'rock']);
  assert.equal(alola.dispatchHours, 10); assert.deepEqual(alola.dexRange, [722, 809]);
  assert.equal(applyDispatchTrainingToTeam([pokemon()], 133, alola).stat, 'spDef');
  assert.deepEqual([0.47, 0.48, 0.73, 0.74].map((n) => rollDispatchOutcome('rare_hunt', () => n)), ['item', 'join', 'join', 'battle']);
});
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }

for (const balls of [1, 2]) {
  test(`actual concurrent region callbacks serialize the last ${balls} balls against stored stock`, async () => storage(async () => {
    const saved = loadSaveData()!; saved.baseInventory.balls.pokeball = balls; replaceSaveData(saved);
    const { scope, state } = scopeFor('join');
    // Controlled API metadata qualifies the fixture member in both regions.
    scope.fetchPokemon = async () => ({ types: [{ type: { name: 'normal' } }, { type: { name: 'psychic' } }] });
    const target = deferred<GamePokemon>(); const requested = deferred<void>(); let calls = 0;
    scope.getProcessedPokemon = () => { calls++; requested.resolve(); return target.promise; };
    scope.resolveDispatchRegion = callback('./usePokeFactoryGame.ts', 'resolveDispatchRegion', scope);
    const dispatch = callback('./usePokeFactoryGame.ts', 'dispatchEventRegion', scope);
    const first = dispatch('kanto'); await requested.promise;
    await dispatch('johto'); assert.equal(calls, 1);
    target.resolve(pokemon(1)); await first;
    assert.equal(loadSaveData()!.baseInventory.balls.pokeball, balls - 1);
    scope.getProcessedPokemon = async () => pokemon(175);
    scope.resolveDispatchRegion = callback('./usePokeFactoryGame.ts', 'resolveDispatchRegion', scope);
    await callback('./usePokeFactoryGame.ts', 'dispatchEventRegion', scope)('johto');
    assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 0);
    assert.equal(loadSaveData()!.collection.acquisitions.length, balls);
    assert.deepEqual(state.playerTeam.map((p: GamePokemon) => p.id), balls === 2 ? [133, 1, 175] : [133, 1]);
    assert.equal(loadSaveData()!.events.dispatches.johto.status, 'IDLE');
    if (balls === 1) assert.match(loadSaveData()!.events.dispatches.johto.lastResult, /baseNoBalls/);
  }));
}

for (const destination of ['page', 'factory', 'import', 'selection']) {
  test(`actual delayed dispatch cannot commit after ${destination} changes`, async () => storage(async () => {
    const saved = loadSaveData()!; saved.baseInventory.balls.pokeball = 1; replaceSaveData(saved);
    const { scope } = scopeFor('join'); const target = deferred<GamePokemon>(); const requested = deferred<void>();
    scope.getProcessedPokemon = () => { requested.resolve(); return target.promise; };
    scope.resolveDispatchRegion = callback('./usePokeFactoryGame.ts', 'resolveDispatchRegion', scope);
    const dispatch = callback('./usePokeFactoryGame.ts', 'dispatchEventRegion', scope);
    const operation = dispatch('kanto'); await requested.promise;
    if (destination === 'factory') scope.factoryResumeActiveRef.current = true;
    if (destination === 'import') scope.skipExitPersistRef.current = true;
    if (destination === 'page') scope.eventRuntimeRef.current.gameState = 'COLLECTION';
    if (destination === 'selection') scope.dispatchContextRef.current = 'different selection';
    target.resolve(pokemon(1)); await operation;
    assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 1);
    assert.equal(loadSaveData()!.collection.acquisitions.length, 0);
    assert.equal(loadSaveData()!.events.dispatches.kanto.status, 'READY');
  }));
}

for (const caught of [false, true]) {
  test(`actual controller and hook save ${caught ? 'successful catch' : 'failed capture'} before resource or battle mutations`, async () => storage(async (data, fail) => {
    giveBalls(); restart('kanto', 500);
    prepareDispatchResult(pending('battle', 'kanto', 500));
    commitDispatchResult({ key: 'dispatch:kanto:500', result: 'battle', resources: resources() });
    const { scope, state } = scopeFor();
    scope.eventRuntimeRef.current.eventBattleActive = true;
    scope.eventBattleContext = { regionId: 'kanto', dispatchStartedAt: 500, targetPokemonId: 25 };
    scope.commitEventBallAttempt = commitEventBallAttempt;
    scope.commitBallAttempt = callback('./usePokeFactoryGame.ts', 'commitBallAttempt', scope);
    state.enemyTeam = [pokemon(25)];
    const live = { current: { gameState: 'BATTLE', enemy: pokemon(25) } };
    const messages: string[] = [];
    Object.assign(scope, { gameState: 'BATTLE', turn: 'PLAYER', isMessageProcessing: false,
      enemy: live.current.enemy, playerTeam: state.playerTeam, inventory: [], baseBallCounts: loadSaveData()!.baseInventory.balls,
      isBaseBallId, allowWildCatch: true, battleInstanceRef: { current: { epoch: 1 } }, battleMountedRef: { current: true }, liveBattleStateRef: live,
      ItemActionCancelledError: class Cancelled extends Error {}, StaleRoundError: class Stale extends Error {},
      addMessagesSequentially: async (lines: string[]) => { messages.push(...lines); },
      Math: Object.assign(Object.create(Math), { random: () => caught ? 0 : 0.99 }), createBallAttemptId: () => 'unit-attempt',
      battleLine: (_lang: unknown, en: string) => en, currentLanguage: 'en',
      winBattle: async () => { state.wins = (state.wins ?? 0) + 1; },
    });
    const useItem = callback('./useBattleController.ts', 'useItem', scope);
    const before = data.get(key); fail();
    await assert.rejects(useItem({ id: 'pokeball', isBall: true, catchRate: 1 }, -1));
    assert.equal(data.get(key), before); assert.equal(state.wins, undefined);
    assert.equal(state.catchSuccess, null); assert.equal(state.playerTeam.length, 1);
    assert.ok(messages.some((m) => m.includes('dispatchSaveFailed')));
    await useItem({ id: 'pokeball', isBall: true, catchRate: 1 }, -1);
    assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 2);
    assert.equal(loadSaveData()!.collection.acquisitions.length, caught ? 1 : 0);
    assert.equal(state.wins, caught ? 1 : undefined);
    assert.equal(state.catchSuccess, caught);
    // Reusing exactly the same attempt is refused even if the old closure still has stock.
    await assert.rejects(useItem({ id: 'pokeball', isBall: true, catchRate: 1 }, -1));
    assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 2);
  }));
}

test('factory rejects injected ball callbacks and event growth-item failures cannot resurrect a consumed reward', async () => storage(async (_data, fail) => {
  const issued = giveBalls();
  const { scope, state } = scopeFor();
  scope.eventRuntimeRef.current.eventBattleActive = true;
  scope.persistEventResources = persistEventResources;
  scope.commitEventItemUse = callback('./usePokeFactoryGame.ts', 'commitEventItemUse', scope);
  scope.baseInventoryRef.current = issued.baseInventory;
  fail(); assert.equal(scope.commitEventItemUse([pokemon()], []), false);
  // Original resources persisted by the item transaction remain unchanged on failure.
  const original = loadSaveData()!.events.resourceCheckpoint;
  assert.ok(original);
  assert.equal(scope.commitEventItemUse([pokemon(25)], []), true);
  persistSaveData(issued);
  assert.equal(loadSaveData()!.events.resourceCheckpoint!.playerTeam[0].id, 25);
  const denied = callback('./useBattleController.ts', 'useItem', {
    gameState: 'BATTLE', turn: 'PLAYER', isMessageProcessing: false, enemy: pokemon(25), playerTeam: state.playerTeam,
    allowWildCatch: false, isBaseBallId, baseBallCounts: issued.baseInventory.balls,
    ItemActionCancelledError: class Cancelled extends Error {},
  });
  await assert.rejects(denied({ id: 'pokeball', isBall: true }, -1));
  assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 3);
}));

for (const team of [[], [{ ...pokemon(), currentHp: 0 }]]) {
  test(`actual battle claim retains pending and resources for ${team.length ? 'all fainted' : 'empty'} team; same result resumes`, async () => storage(async () => {
    const saved = loadSaveData()!; saved.baseInventory.balls.pokeball = 3;
    saved.events.resourceCheckpoint = { playerTeam: team, inventoryItemIds: ['protein'] }; replaceSaveData(saved);
    const baselineResources = loadSaveData()!.events.resourceCheckpoint;
    const { scope, state } = scopeFor('battle');
    scope.eventRuntimeRef.current.playerTeam = team;
    let generated = 0; scope.getProcessedPokemon = async () => { generated++; return pokemon(25); };
    scope.resolveDispatchRegion = callback('./usePokeFactoryGame.ts', 'resolveDispatchRegion', scope);
    await callback('./usePokeFactoryGame.ts', 'dispatchEventRegion', scope)('kanto');
    const blocked = loadSaveData()!;
    assert.equal(blocked.events.dispatches.kanto.status, 'READY');
    assert.match(blocked.events.dispatches.kanto.lastResult, /dispatchNeedsTeam/);
    assert.equal(blocked.events.pendingResults[pending().key].outcome, 'battle');
    assert.equal(blocked.events.completedResults[pending().key], undefined);
    assert.deepEqual(blocked.events.resourceCheckpoint, baselineResources);
    assert.equal(blocked.baseInventory.balls.pokeball, 3); assert.equal(generated, 0);
    assert.notEqual(state.gameState, 'BATTLE');
    // A usable temporary team is supplied here; natural acquisition is player evidence, not this unit test.
    scope.eventRuntimeRef.current.playerTeam = [pokemon()];
    scope.rollDispatchOutcome = () => { throw new Error('must not reroll'); };
    scope.resolveDispatchRegion = callback('./usePokeFactoryGame.ts', 'resolveDispatchRegion', scope);
    await callback('./usePokeFactoryGame.ts', 'dispatchEventRegion', scope)('kanto');
    assert.equal(state.gameState, 'BATTLE'); assert.equal(generated, 1);
    assert.equal(loadSaveData()!.events.pendingResults[pending().key], undefined);
    assert.equal(loadSaveData()!.baseInventory.balls.pokeball, 3);
  }));
}

test('actual encounter rechecks usable team after target await, then opens replacement panel for fainted lead with reserve', async () => storage(async () => {
  const saved = loadSaveData()!; saved.baseInventory.balls.pokeball = 1; replaceSaveData(saved);
  const { scope, state } = scopeFor('battle'); const target = deferred<GamePokemon>(); const requested = deferred<void>();
  scope.getProcessedPokemon = () => { requested.resolve(); return target.promise; };
  scope.resolveDispatchRegion = callback('./usePokeFactoryGame.ts', 'resolveDispatchRegion', scope);
  const operation = callback('./usePokeFactoryGame.ts', 'dispatchEventRegion', scope)('kanto');
  await requested.promise; scope.eventRuntimeRef.current.playerTeam = []; target.resolve(pokemon(25)); await operation;
  assert.notEqual(state.gameState, 'BATTLE'); assert.equal(loadSaveData()!.events.dispatches.kanto.status, 'READY');
  scope.eventRuntimeRef.current.playerTeam = [{ ...pokemon(), currentHp: 0 }, pokemon(1)];
  scope.getProcessedPokemon = async () => pokemon(25);
  scope.resolveDispatchRegion = callback('./usePokeFactoryGame.ts', 'resolveDispatchRegion', scope);
  await callback('./usePokeFactoryGame.ts', 'dispatchEventRegion', scope)('kanto');
  assert.equal(state.gameState, 'BATTLE'); assert.equal(state.battleMenuTab, 'POKEMON');
  assert.equal(state.playerTeam[0].currentHp, 0); assert.ok(state.playerTeam[1].currentHp > 0);
}));

function idleBase() {
  const saved = loadSaveData()!; saved.events.dispatches.kanto = createDefaultDispatchState(); replaceSaveData(saved); return saved;
}
test('actual IDLE start persists before RUNNING; write fault is visible and retry/export/stale save preserve start', async () => storage(async (data, fail) => {
  const stale = idleBase(); const { scope, state, dispatch } = scopeFor(); const before = data.get(key);
  fail(); await dispatch('kanto');
  assert.equal(data.get(key), before); assert.equal(state.eventDispatches.kanto.status, 'IDLE');
  assert.match(state.eventDispatches.kanto.lastResult, /dispatchSaveFailed/);
  assert.equal(loadSaveData()!.events.dispatchPokemonByRegion.kanto, 133);
  await dispatch('kanto'); const started = loadSaveData()!;
  assert.equal(started.events.dispatches.kanto.status, 'RUNNING');
  assert.equal(state.eventDispatches.kanto.startedAt, started.events.dispatches.kanto.startedAt);
  const region = EVENT_REGIONS.find((r) => r.id === 'kanto')!;
  assert.equal(started.events.dispatches.kanto.readyAt! - started.events.dispatches.kanto.startedAt!, region.dispatchHours * 3600000);
  assert.deepEqual(parseSaveDataFromText(data.get(key)!).events.dispatches.kanto, started.events.dispatches.kanto);
  persistSaveData(stale); assert.deepEqual(loadSaveData()!.events.dispatches.kanto, started.events.dispatches.kanto);
  await dispatch('kanto'); assert.deepEqual(loadSaveData()!.events.dispatches.kanto, started.events.dispatches.kanto);
  assert.equal(scope.dispatchInFlightRef.current, false);
}));
for (const destination of ['selection', 'leave-return', 'factory', 'import', 'ownership']) {
  test(`actual IDLE start rejects late metadata after ${destination}`, async () => storage(async (data) => {
    idleBase(); const { scope, state } = scopeFor(); const fetched = deferred<any>();
    scope.fetchPokemon = () => fetched.promise;
    const operation = callback('./usePokeFactoryGame.ts', 'dispatchEventRegion', scope)('kanto');
    if (destination === 'selection') {
      const next = loadSaveData()!; next.events.dispatchPokemonByRegion.kanto = null; replaceSaveData(next);
    }
    if (destination === 'leave-return') scope.dispatchContextRef.current = 'returned events';
    if (destination === 'factory') { scope.factoryResumeActiveRef.current = true; beginFactoryWalletRun(loadSaveData()!, 0); }
    if (destination === 'import') { scope.skipExitPersistRef.current = true; const next = base(); next.events.dispatches.kanto = createDefaultDispatchState(); next.baseInventory.balls.pokeball = 8; replaceSaveData(next); }
    if (destination === 'ownership') {
      // Controlled external ownership loss: metadata was fetched for the old owner.
      const next = loadSaveData()!; next.progress.companionSpeciesId = 25; next.events.dispatchPokemonByRegion.kanto = 133; replaceSaveData(next);
    }
    const before = data.get(key); fetched.resolve({ types: [{ type: { name: 'normal' } }] }); await operation;
    assert.equal(data.get(key), before); assert.equal(state.eventDispatches.kanto.status, 'IDLE');
    assert.equal(scope.dispatchInFlightRef.current, false);
  }));
}
