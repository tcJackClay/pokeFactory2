// Static callback reproduction only. No React render, browser, or game server.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { createSaveData, parseSaveDataFromText, replaceSaveData, loadSaveData, persistSaveData, startEventDispatch } from '../../../src/services/saveManager.ts';
import { createEmptyBaseInventory, createEmptyEventPersistentState } from '../../../src/features/game/utils/baseBallInventory.ts';
const data = new Map();
globalThis.window = { localStorage: { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) } };
const initial = parseSaveDataFromText(JSON.stringify({ schemaVersion: 16, baseInventory: createEmptyBaseInventory(),
  progress: { companionSpeciesId: 133 }, collection: { acquisitions: [], seenIds: [], ownedIds: [], formKeys: [] },
  wallet: { balance: 0, revision: 0, currentRunId: null, brainSymbols: 0, settledThrough: 0 },
  runSupply: { runId: null, tickets: 0, lastCreditedStage: 0 }, factory: { battleResume: { status: 'EMPTY' } },
  events: { ...createEmptyEventPersistentState(), dispatchPokemonByRegion: { kanto: 133 }, dispatches: { kanto: { status: 'IDLE', startedAt: null, readyAt: null } } },
}));
replaceSaveData(initial);
const text = fs.readFileSync(new URL('../../../src/features/game/hooks/usePokeFactoryGame.ts', import.meta.url), 'utf8');
const tree = ts.createSourceFile('hook.ts', text, ts.ScriptTarget.Latest, true);
function extract(name, scope) {
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) expression = node.initializer.arguments[0].getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  const js = ts.transpileModule(`const callback = ${expression}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${js};return callback`)(...Object.values(scope));
}
const refs = { baseInventoryRef: { current: initial.baseInventory }, eventPersistentRef: { current: initial.events } };
const scope = { ...refs, startLevel: 50, STREAK_FACTORY_SINGLES_OPEN: 2, STREAK_FACTORY_SINGLES_50: 1,
  CHALLENGE_ACTIVE_STATES: [], gameState: 'EVENTS', hasFactoryRunToResume: false, WIN_STREAK_ACTIVE_MASK_DEFAULT: 3,
  FACTORY_REWARD_CONFIG: { battlesPerSet: 7 }, stage: 1, getPersistableBattleResume: () => initial.factory.battleResume,
  createSaveData, walletRef: { current: initial.wallet }, runSupplyRef: { current: initial.runSupply },
  companionSpeciesId: 133, totalRents: 0, highestStreak: 0, specialModeUnlocked: false, currentLanguage: 'en', selectedGens: [1],
  devToolsAvailable: false, developerMode: false, exportUsedTrainerIdsBySet: () => [],
  eventSpeciesBattleCounts: {}, eventDispatchPokemonByRegion: initial.events.dispatchPokemonByRegion,
  eventDispatches: initial.events.dispatches, collectionLedger: initial.collection,
};
const builder = extract('buildCurrentSaveData', scope);
const noOp = () => {};
const sync = extract('syncEventSave', { ...refs, setBaseInventory: noOp, setCollectionLedger: noOp, setEventDispatches: noOp });
const started = startEventDispatch('kanto', 133, ['normal']);
sync(started); // Actual ref synchronization happens before the next React render.
const oldClosureDraft = builder();
assert.equal(oldClosureDraft.baseInventory.revision, started.baseInventory.revision);
assert.equal(oldClosureDraft.events.dispatches.kanto.status, 'IDLE');
persistSaveData(oldClosureDraft);
const result = loadSaveData();
console.log(JSON.stringify({ started: started.events.dispatches.kanto, draftRevision: oldClosureDraft.baseInventory.revision,
  storedRevision: result.baseInventory.revision, afterOldBuilderSave: result.events.dispatches.kanto }, null, 2));
assert.equal(result.events.dispatches.kanto.status, 'IDLE', '7c27209 A2 regression should reproduce on 13dd1f2');
