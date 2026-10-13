import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReplacePokemonModal } from '../components/game-view/reward/ReplacePokemonModal';
import { getDispatchAcquisitionId } from '../utils/permanentCollection';

// Execute the real hook callbacks without mounting a browser or copying their logic.
function callback(file: string, name: string, scope: Record<string, unknown>) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let expression: string | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name && node.initializer && ts.isCallExpression(node.initializer)) {
      expression = node.initializer.arguments[0].getText(tree);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(expression, `Missing real callback ${name}`);
  const js = ts.transpileModule(`const actual = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(scope), `${js}; return actual;`)(...Object.values(scope));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const region = (id: string, speciesId: number) => ({ id, name: id, category: 'normal', dexRange: [speciesId, speciesId], requiredTypes: ['normal'], specialSites: [], dispatchHours: 1 });
const blankDispatch = () => ({ status: 'IDLE', startedAt: null, readyAt: null, lastResolvedAt: null, lastResult: '' });
const pokemon = (id: number) => ({ id, currentHp: 10, maxHp: 10, sprites: { front_default: '' }, level: 50 });
const ball = { id: 'pokeball', isBall: true, catchRate: 1 };

function eventScope(ballCount = 1, teamCount = 1) {
  const team = [25, 1, 4, 7, 10, 13].slice(0, teamCount).map(pokemon);
  const inventory = Array.from({ length: ballCount }, () => ({ ...ball }));
  const eventRuntimeRef = { current: { playerTeam: team, inventory, eventBattleActive: false, gameState: 'EVENTS', currentBaseTab: 'EVENTS' } };
  const state: Record<string, any> = { playerTeam: team, inventory, eventDispatches: { kanto: { status: 'READY', startedAt: 100, readyAt: 100 }, johto: { status: 'READY', startedAt: 200, readyAt: 200 } } };
  const scope: Record<string, any> = {
    playerTeam: team, inventory, eventRuntimeRef,
    EVENT_REGIONS: [region('kanto', 133), region('johto', 175)],
    factoryResumeActiveRef: { current: false }, dispatchInFlightRef: { current: false },
    eventDispatches: state.eventDispatches, eventDispatchPokemonByRegion: { kanto: 25, johto: 25 },
    eventSpeciesBattleCounts: {}, eventBattleActive: true,
    eventBattleContext: { regionId: 'kanto', selectedPokemonId: 25, targetPokemonId: 133, dispatchStartedAt: 100 },
    enemy: pokemon(133), getLocalized: (entry: any) => String(entry.id),
    t: (key: string) => key,
    fetchPokemon: async () => ({ types: [{ type: { name: 'normal' } }] }),
    isEvolutionChainBaseSpecies: async () => true,
    rollDispatchOutcome: () => 'join', RARE_SPECIES_POOL: [], startLevel: 50,
    getCurrentSaveDraft: () => ({}), loadSaveData: () => null,
    getDispatchAcquisitionId, createDefaultDispatchState: blankDispatch,
    createEmptyBattleHazards: () => ({}), EMPTY_BATTLE_SPECIAL_USAGE: {},
    getStatLabel: () => 'Attack',
    applyDispatchTrainingToTeam: (current: any[]) => ({ trained: true, team: current.map((entry) => ({ ...entry, trained: true })), stat: 'attack', evGain: 1, ivGain: 0 }),
    pickGrowthRewardItem: () => ({ id: 'protein' }), getEventItemLabel: () => 'Protein',
    StaleDispatchError: class StaleDispatchError extends Error {},
    commits: [],
  };
  const setterNames = fs.readFileSync(new URL('./usePokeFactoryGame.ts', import.meta.url), 'utf8').match(/\bset[A-Z]\w*/g) ?? [];
  for (const setter of new Set(setterNames)) {
    const key = setter.slice(3, 4).toLowerCase() + setter.slice(4);
    scope[setter] = (value: any) => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  }
  scope.commitPermanentAcquisition = (_draft: any, record: any, completion: any) => {
    scope.commits.push(record);
    return { applied: true, save: { collection: { acquisitions: [...scope.commits] }, events: { dispatches: { ...state.eventDispatches, [record.regionId]: completion } } } };
  };
  scope.isDispatchContextCurrent = callback('./usePokeFactoryGame.ts', 'isDispatchContextCurrent', scope);
  scope.awardDispatchTraining = callback('./usePokeFactoryGame.ts', 'awardDispatchTraining', scope);
  return { scope, state };
}

async function catchToEvents(teamCount = 1) {
  const { scope, state } = eventScope(1, teamCount);
  scope.handleSuppressedBattleResolved = callback('./usePokeFactoryGame.ts', 'handleSuppressedBattleResolved', scope);
  const liveBattleStateRef = { current: { gameState: 'BATTLE', playerTeam: state.playerTeam, enemy: scope.enemy, enemyTeam: [scope.enemy] } };
  const controllerScope = {
    ...scope,
    gameState: 'BATTLE', turn: 'PLAYER', isMessageProcessing: false,
    battleInstanceRef: { current: { epoch: 1 } }, battleMountedRef: { current: true }, liveBattleStateRef,
    suppressFactoryBattleResult: true, onSuppressBattleResolved: scope.handleSuppressedBattleResolved,
    allowWildCatch: true, commitCaughtPokemon: () => {
      state.collectionLedger = { ownedIds: [133] };
      state.captureCommitCount = (state.captureCommitCount ?? 0) + 1;
      return 'COMMITTED';
    },
    addMessagesSequentially: async () => {},
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    setPlayerTeam: (value: any) => { state.playerTeam = value; liveBattleStateRef.current.playerTeam = value; },
    setEnemy: (value: any) => { liveBattleStateRef.current.enemy = value; },
    setEnemyTeam: (value: any) => { liveBattleStateRef.current.enemyTeam = typeof value === 'function' ? value(liveBattleStateRef.current.enemyTeam) : value; },
  } as Record<string, any>;
  controllerScope.resolveBattleResult = callback('./useBattleController.ts', 'resolveBattleResult', controllerScope);
  controllerScope.winBattle = callback('./useBattleController.ts', 'winBattle', controllerScope);
  const useItem = callback('./useBattleController.ts', 'useItem', controllerScope);
  await useItem(ball, 0);
  Object.assign(scope.eventRuntimeRef.current, { playerTeam: state.playerTeam, inventory: state.inventory, showReplaceUI: state.showReplaceUI, gameState: state.gameState, eventBattleActive: false });
  return { scope, state };
}

test('real catch to winBattle to event training keeps the newly caught party member', async () => {
  const { state } = await catchToEvents();
  assert.deepEqual(state.playerTeam.map((entry: any) => entry.id), [25, 133]);
  assert.equal(state.playerTeam[0].trained, true);
  assert.equal(state.inventory.some((entry: any) => entry.isBall), false);
  assert.equal(state.gameState, 'EVENTS');
});

test('different regions cannot resolve concurrently and a stale callback cannot spend one ball twice', async () => {
  const { scope, state } = eventScope();
  const target = deferred<any>();
  const requested = deferred<void>();
  let targets = 0;
  scope.getProcessedPokemon = () => { targets += 1; requested.resolve(); return target.promise; };
  scope.resolveDispatchRegion = callback('./usePokeFactoryGame.ts', 'resolveDispatchRegion', scope);
  const dispatch = callback('./usePokeFactoryGame.ts', 'dispatchEventRegion', scope);
  const first = dispatch('kanto');
  await requested.promise;
  await dispatch('johto');
  assert.equal(targets, 1);
  target.resolve(pokemon(133));
  await first;
  // Deliberately reuse the original callback and closure after the first grant.
  scope.getProcessedPokemon = async () => pokemon(175);
  await dispatch('johto');
  assert.equal(scope.commits.length, 1);
  assert.deepEqual(state.playerTeam.map((entry: any) => entry.id), [25, 133]);
  assert.equal(state.inventory.length, 0);
  assert.equal(scope.dispatchInFlightRef.current, false);
});

test('serial joins use current resources and retain both newly joined members', async () => {
  const { scope, state } = eventScope(2);
  scope.getProcessedPokemon = async (id: number) => pokemon(id);
  scope.resolveDispatchRegion = callback('./usePokeFactoryGame.ts', 'resolveDispatchRegion', scope);
  const dispatch = callback('./usePokeFactoryGame.ts', 'dispatchEventRegion', scope);
  await dispatch('kanto');
  await dispatch('johto');
  assert.equal(scope.commits.length, 2);
  assert.deepEqual(state.playerTeam.map((entry: any) => entry.id), [25, 133, 175]);
  assert.equal(state.inventory.length, 0);
});

for (const destination of ['event battle', 'factory run', 'another page'] as const) {
test(`a delayed join cannot overwrite ${destination}`, async () => {
  const { scope, state } = eventScope();
  const target = deferred<any>();
  const requested = deferred<void>();
  scope.getProcessedPokemon = () => { requested.resolve(); return target.promise; };
  scope.resolveDispatchRegion = callback('./usePokeFactoryGame.ts', 'resolveDispatchRegion', scope);
  const dispatch = callback('./usePokeFactoryGame.ts', 'dispatchEventRegion', scope);
  const first = dispatch('kanto');
  await requested.promise;
  if (destination === 'event battle') scope.eventRuntimeRef.current.eventBattleActive = true;
  if (destination === 'factory run') scope.factoryResumeActiveRef.current = true;
  if (destination === 'another page') scope.eventRuntimeRef.current.currentBaseTab = 'COLLECTION';
  if (destination === 'another page') scope.eventRuntimeRef.current.gameState = 'BASE';
  const newerTeam = [pokemon(7), pokemon(1)];
  state.playerTeam = newerTeam;
  scope.eventRuntimeRef.current.playerTeam = newerTeam;
  target.resolve(pokemon(133));
  await first;
  assert.equal(scope.commits.length, 0);
  assert.deepEqual(state.playerTeam.map((entry: any) => entry.id), [7, 1]);
  assert.equal(state.inventory.length, 1);
  assert.equal(state.eventDispatches.kanto.status, 'READY');
  assert.equal(scope.dispatchInFlightRef.current, false);
});
}

for (const decision of ['replace', 'cancel'] as const) {
  test(`full-party catch ${decision} retains the acquisition and never spends or awards again`, async () => {
    const { scope, state } = await catchToEvents(6);
    assert.equal(state.showReplaceUI.id, 133);
    assert.equal(state.gameState, 'EVENTS');
    const partyBefore = [...state.playerTeam];
    const inventoryBefore = [...state.inventory];
    const collectionBefore = state.collectionLedger;
    const replace = callback('./usePokeFactoryGame.ts', 'replaceCollectedPokemon', scope);
    const cancel = callback('./usePokeFactoryGame.ts', 'cancelReplacePokemon', scope);
    if (decision === 'replace') replace(2);
    else cancel();
    assert.equal(state.showReplaceUI, null);
    assert.equal(state.playerTeam.length, 6);
    assert.deepEqual(state.playerTeam.map((entry: any) => entry.id), decision === 'replace' ? [25, 1, 133, 7, 10, 13] : partyBefore.map((entry: any) => entry.id));
    assert.equal(state.playerTeam[0].trained, true);
    assert.deepEqual(state.inventory, inventoryBefore);
    assert.equal(state.collectionLedger, collectionBefore);
    assert.deepEqual(state.collectionLedger.ownedIds, [133]);
    assert.equal(state.captureCommitCount, 1);
    assert.equal(state.rewardChoiceMade, undefined);
    const chosenParty = state.playerTeam;
    replace(0); // A queued old click after either choice cannot grant another member.
    assert.equal(state.playerTeam, chosenParty);
  });
}

test('a queued replacement cannot write into a new battle or a factory party', async () => {
  const { scope, state } = await catchToEvents(6);
  const replace = callback('./usePokeFactoryGame.ts', 'replaceCollectedPokemon', scope);
  const before = state.playerTeam;
  replace(-1);
  replace(8);
  assert.equal(state.playerTeam, before);
  scope.eventRuntimeRef.current.eventBattleActive = true;
  replace(0);
  assert.equal(state.playerTeam, before);
  scope.eventRuntimeRef.current.eventBattleActive = false;
  scope.factoryResumeActiveRef.current = true;
  replace(0);
  assert.equal(state.playerTeam, before);
});

test('leaving events clears the replacement before an old click can mutate the party', async () => {
  const { scope, state } = await catchToEvents(6);
  scope.cancelReplacePokemon = callback('./usePokeFactoryGame.ts', 'cancelReplacePokemon', scope);
  scope.companionCommittedRef = { current: 25 };
  const replace = callback('./usePokeFactoryGame.ts', 'replaceCollectedPokemon', scope);
  const enterBase = callback('./usePokeFactoryGame.ts', 'enterBase', scope);
  const teamBefore = state.playerTeam;
  enterBase();
  replace(0); // Reuse the old callback before another React render.
  assert.equal(state.playerTeam, teamBefore);
  assert.equal(state.showReplaceUI, null);
  assert.equal(state.gameState, 'BASE');
  assert.deepEqual(state.collectionLedger.ownedIds, [133]);
});

// SSR the actual GameView function with unrelated screens stubbed: no browser/game runs.
// Reading its real JSX catches a missing parent mount, which modal-only snapshots cannot.
function replacementView(gameState: string, candidate: unknown) {
  const file = '../components/GameView.tsx';
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'GameView');
  assert.ok(declaration);
  const js = ts.transpileModule(declaration.getText(tree).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React } }).outputText;
  const empty = () => null;
  const scope = {
    React, useState: React.useState, useReducedMotion: () => true,
    inspectStoredSave: () => ({ kind: 'none' }),
    APP_PALETTE: { page: {} }, TypeBadgeLanguageContext: React.createContext('en'),
    EventsScreen: empty, BattleScreen: empty, BaseScreen: empty, FactorySelectScreen: empty,
    TopRecordPanel: empty, FactoryHeldItemRepairNotice: empty, DeveloperPanel: empty,
    AnimatePresence: ({ children }: any) => children, ReplacePokemonModal,
  };
  const View = new Function(...Object.keys(scope), `${js}; return GameView;`)(...Object.values(scope));
  return renderToStaticMarkup(React.createElement(View, { viewModel: {
    gameState, currentBaseTab: 'EVENTS', currentLanguage: 'en', companionSpeciesId: 25,
    playerTeam: [25, 1, 4, 7, 10, 13].map((id) => ({ ...pokemon(id), name: `Pokemon${id}`, sprites: { front_default: `/sprite/${id}.png` } })),
    showReplaceUI: candidate, getLocalized: (entry: any) => `Pokemon${entry.id}`,
    t: (key: string) => key, replacePokemon: empty, cancelReplacePokemon: empty,
  } }));
}

test('GameView mounts the full replacement dialog after event settlement and hides it during battle', () => {
  for (const gameState of ['EVENTS', 'BASE']) {
    const html = replacementView(gameState, pokemon(133));
    assert.match(html, /role="dialog"/);
    assert.match(html, /cancelReplace/);
    assert.match(html, /Pokemon133/);
    assert.equal((html.match(/<button/g) ?? []).length, 7);
    assert.match(html, /overflow-y:auto/);
    assert.match(html, /z-index:160/);
  }
  assert.doesNotMatch(replacementView('BATTLE', pokemon(133)), /role="dialog"/);
  assert.doesNotMatch(replacementView('EVENTS', null), /role="dialog"/);
});
