import test from 'node:test';
import assert from 'node:assert/strict';
import type { GamePokemon } from '../types';
import { prepareFactoryPartyForBattle, restoreFactoryParty } from '../features/game/utils/restoreFactoryParty';

import { FACTORY_SINGLES_BP, getFactoryGroupBp, getFactorySetBp, MAX_FACTORY_BP } from '../features/game/config/factoryRewards';
import { FACTORY_BRAIN_TRAINER_ID, isFactoryBrainStage } from '../features/game/config/factoryBrain';
import { getFactoryTrainerTemplateById, selectFactoryTrainerTemplate } from '../features/game/config/factoryTrainerTemplates';
import { COMPANION_CANDIDATES } from '../features/game/config/companionCandidates';
import {
  bindCompanionToSave,
  beginFactoryWalletRun,
  endFactoryWalletRun,
  adjustWalletBalance,
  classifySaveText,
  commitFactoryGroupSettlement,
  commitFactoryBattleStart,
  createEmptyBattleResume,
  discardInvalidSave,
  inspectStoredSave,
  loadPendingFactorySettlement,
  loadSaveData,
  parseSaveDataFromText,
  persistSaveData,
  replaceSaveData,
  readUnsupportedSave,
  discardUnsupportedSave,
  type BattleResumeSnapshot,
} from './saveManager';

function withStorage(run: (storage: Map<string, string>, failNextWrite: () => void, session: Map<string, string>) => void) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storage = new Map<string, string>();
  const session = new Map<string, string>();
  let shouldFail = false;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (shouldFail) {
            shouldFail = false;
            throw new Error('Quota exceeded');
          }
          storage.set(key, value);
        },
        removeItem: (key: string) => { storage.delete(key); },
      },
      sessionStorage: {
        getItem: (key: string) => session.get(key) ?? null,
        setItem: (key: string, value: string) => { session.set(key, value); },
        removeItem: (key: string) => { session.delete(key); },
      },
    },
  });
  try {
    run(storage, () => { shouldFail = true; }, session);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

function buildLegacyReadyBattleResume(overrides: Record<string, unknown> = {}) {
  const resume = {
    status: 'READY',
    battleKind: 'FACTORY',
    checkpointAt: '2026-04-21T00:00:00.000Z',
    stage: 3,
    streak: 2,
    swapCount: 1,
    coins: 50,
    totalRents: 10,
    enemyAiTier: 'ADVANCED',
    specialModeUnlocked: true,
    specialBossBattleActive: false,
    battleSpecialUsage: { MEGA: false, DYNAMAX: false, TERA: false, ZMOVE: false },
    enemySpecialUsage: { MEGA: false, DYNAMAX: false, TERA: false, ZMOVE: false },
    turn: 'PLAYER',
    battleMenuTab: 'MAIN',
    weather: 'none',
    weatherTurns: 0,
    fieldState: [],
    fieldTurns: {},
    tailwindTurns: { player: 0, enemy: 0 },
    activeBuffs: { atk: false, def: false },
    enemyBuffs: { atk: false, def: false },
    factoryRentals: [],
    selectedRentalIndices: [],
    playerTeam: [{
      id: 25,
      name: 'pikachu',
      sprites: { front_default: '', back_default: '' },
      stats: [],
      types: [{ type: { name: 'electric' } }],
      abilities: [{ ability: { name: 'static', url: '' } }],
      moves: [],
      currentHp: 70,
      maxHp: 100,
      selectedMoves: [],
      level: 50,
      nature: { name: 'hardy', zhName: 'Hardy', plus: 'attack', minus: 'attack' },
      ivs: { hp: 1, attack: 1, defense: 1, spAtk: 1, spDef: 1, speed: 1 },
      evs: { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 },
      baseStats: { hp: 35, attack: 55, defense: 40, spAtk: 50, spDef: 50, speed: 90 },
      calculatedStats: { hp: 100, attack: 90, defense: 70, spAtk: 85, spDef: 80, speed: 120 },
      factoryOriginalHeldItemId: null,
      nonVolatileStatus: { id: 'sleep' },
    }],
    enemyTeam: [{
      id: 133,
      name: 'eevee',
      sprites: { front_default: '', back_default: '' },
      stats: [],
      types: [{ type: { name: 'normal' } }],
      abilities: [{ ability: { name: 'run-away', url: '' } }],
      moves: [],
      currentHp: 100,
      maxHp: 100,
      selectedMoves: [],
      level: 50,
      nature: { name: 'hardy', zhName: 'Hardy', plus: 'attack', minus: 'attack' },
      ivs: { hp: 1, attack: 1, defense: 1, spAtk: 1, spDef: 1, speed: 1 },
      evs: { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 },
      baseStats: { hp: 55, attack: 55, defense: 50, spAtk: 45, spDef: 65, speed: 55 },
      calculatedStats: { hp: 100, attack: 80, defense: 75, spAtk: 70, spDef: 90, speed: 80 },
      factoryOriginalHeldItemId: null,
      volatileStatuses: {
        confusion: {
          id: 'confusion',
          active: true,
          turnsRemaining: 2,
        },
      },
    }],
    currentEnemyTrainerId: 'FRONTIER_TRAINER_LIZBETH',
    inventoryItemIds: [],
    battleLog: [],
    phase: 'BATTLE',
    roundResult: null,
    lastBpGain: 0,
    ...overrides,
  } as unknown as BattleResumeSnapshot;
  if (resume.phase !== 'BATTLE') resume.playerTeam = restoreFactoryParty(resume.playerTeam as GamePokemon[]);
  return resume;
}

function draft(runId = 'run:test', balance = 0, settledThrough = 0, stage = 7) {
  return parseSaveDataFromText(JSON.stringify({
    schemaVersion: 13,
    progress: { companionSpeciesId: 25 },
    wallet: { balance, revision: 1, currentRunId: runId, brainSymbols: 0, settledThrough },
    runSupply: { runId, tickets: stage - 1, lastCreditedStage: stage - 1 },
    factory: { battleResume: buildLegacyReadyBattleResume({ stage, coins: balance }) },
  }));
}

function atBattle(saved: ReturnType<typeof draft>, stage: number) {
  const previous = saved.factory.battleResume;
  if (previous.status !== 'READY') throw new Error('Expected a READY checkpoint.');
  return {
    ...saved,
    runSupply: { runId: saved.wallet.currentRunId, tickets: stage - 1, lastCreditedStage: stage - 1 },
    factory: {
      ...saved.factory,
      battleResume: { ...previous, stage, phase: 'BATTLE' as const, roundResult: null, lastBpGain: 0 },
    },
  };
}

test('factory checkpoint preserves Return friendship across save and restore', () => {
  const saved = draft('run:return-friendship');
  const checkpoint = saved.factory.battleResume;
  assert.equal(checkpoint.status, 'READY');
  if (checkpoint.status !== 'READY') return;
  const restored = parseSaveDataFromText(JSON.stringify({
    ...saved,
    factory: {
      ...saved.factory,
      battleResume: {
        ...checkpoint,
        playerTeam: checkpoint.playerTeam.map((member, index) => index === 0 ? { ...member, friendship: 255 } : member),
      },
    },
  })).factory.battleResume;
  assert.equal(restored.status, 'READY');
  if (restored.status === 'READY') assert.equal(restored.playerTeam[0].friendship, 255);
});

test('current save accepts snow weather and its remaining turns', () => {
  const saved = draft('run:snow-save');
  const previous = saved.factory.battleResume;
  assert.equal(previous.status, 'READY');
  if (previous.status !== 'READY') return;
  const snowSave = {
    ...saved,
    factory: { ...saved.factory, battleResume: { ...previous, weather: 'snow', weatherTurns: 4 } },
  };
  const restored = parseSaveDataFromText(JSON.stringify(snowSave)).factory.battleResume;
  assert.equal(restored.status, 'READY');
  if (restored.status !== 'READY') return;
  assert.equal(restored.weather, 'snow');
  assert.equal(restored.weatherTurns, 4);
});

test('battle checkpoint retains separate Tailwind timers and rejects damaged present values', () => {
  const saved = draft('run:tailwind-save');
  const previous = saved.factory.battleResume;
  assert.equal(previous.status, 'READY');
  if (previous.status !== 'READY') return;
  const withTurns = (turns: unknown) => parseSaveDataFromText(JSON.stringify({
    ...saved,
    factory: { ...saved.factory, battleResume: { ...previous, tailwindTurns: turns } },
  })).factory.battleResume;
  const valid = withTurns({ player: 3, enemy: 1 });
  assert.equal(valid.status, 'READY');
  if (valid.status === 'READY') assert.deepEqual(valid.tailwindTurns, { player: 3, enemy: 1 });
  const legacyMissing = withTurns(undefined);
  assert.equal(legacyMissing.status, 'READY');
  if (legacyMissing.status === 'READY') assert.deepEqual(legacyMissing.tailwindTurns, { player: 0, enemy: 0 });
  for (const invalid of [{ player: 999, enemy: -1 }, { player: 2 }, { player: '2', enemy: 1 }]) {
    assert.throws(() => withTurns(invalid), /导入文件损坏/);
  }
});

test('battle checkpoint retains both hazard sides and rejects malformed present values', () => {
  const saved = draft('run:hazards');
  const previous = saved.factory.battleResume;
  assert.equal(previous.status, 'READY');
  if (previous.status !== 'READY') return;
  const hazards = {
    player: { stealthRock: true, toxicSpikesLayers: 0 },
    enemy: { stealthRock: false, toxicSpikesLayers: 0 },
  };
  const withHazards = (value: unknown) => JSON.stringify({
    ...saved,
    factory: { ...saved.factory, battleResume: { ...previous, hazards: value } },
  });
  const restored = parseSaveDataFromText(withHazards(hazards)).factory.battleResume;
  assert.equal(restored.status, 'READY');
  if (restored.status === 'READY') assert.deepEqual(restored.hazards, hazards);
  assert.equal(classifySaveText(withHazards({ player: { stealthRock: 'yes' } })).kind, 'corrupt');
});

test('new save preserves battle snapshots, including postbattle phase', () => {
  const saved = parseSaveDataFromText(JSON.stringify({
    schemaVersion: 13,
    progress: { companionSpeciesId: 25 },
    wallet: { balance: 3, revision: 1, currentRunId: 'run:one', brainSymbols: 0, settledThrough: 1 },
    runSupply: { runId: 'run:one', tickets: 8, lastCreditedStage: 8 },
    factory: { battleResume: buildLegacyReadyBattleResume({ stage: 8, phase: 'FACTORY_SWAP', roundResult: 'WIN', lastBpGain: 0 }) },
  }));
  assert.equal(saved.schemaVersion, 13);
  assert.equal(saved.wallet.balance, 3);
  assert.equal(saved.factory.battleResume.status, 'READY');
  if (saved.factory.battleResume.status !== 'READY') return;
  assert.equal(saved.factory.battleResume.phase, 'FACTORY_SWAP');
  assert.equal(saved.factory.battleResume.roundResult, 'WIN');
  assert.equal(saved.factory.battleResume.playerTeam[0].nonVolatileStatus, undefined);
});

test('old saves are rejected by version, without misclassifying v10 as per-battle currency', () => {
  for (const version of [6, 7, 8, 9, 10, 11, 12]) {
    assert.equal(classifySaveText(JSON.stringify({ schemaVersion: version })).kind, 'legacy');
    assert.throws(() => parseSaveDataFromText(JSON.stringify({ schemaVersion: version, wallet: { balance: 500 }, factory: { battleResume: buildLegacyReadyBattleResume({ coins: 500 }) } })), /旧规则存档不兼容/);
  }
  assert.equal(classifySaveText(JSON.stringify({ schemaVersion: 10, wallet: { balance: 500 } })).kind, 'legacy');
  assert.equal(classifySaveText(JSON.stringify({ schemaVersion: 11, wallet: { balance: 500 } })).kind, 'legacy');
  assert.throws(() => parseSaveDataFromText(JSON.stringify({ schemaVersion: 10, wallet: { balance: 500 } })), /旧规则存档不兼容/);
  for (const malformed of ['null', '[]', '{}', '{"schemaVersion":"8"}']) {
    assert.equal(classifySaveText(malformed).kind, 'corrupt');
  }
  withStorage((storage) => {
    storage.set('pokefactory_save_v1', JSON.stringify({ schemaVersion: 8, wallet: { balance: 500 } }));
    assert.ok(readUnsupportedSave());
    assert.equal(loadSaveData(), null);
    discardUnsupportedSave();
    assert.equal(readUnsupportedSave(), null);
  });
});

test('same-version READY saves require recognizable original items and allow consumed postbattle items', () => {
  const saved = draft('run:item-schema', 0, 0, 1);
  const resume = saved.factory.battleResume;
  if (resume.status !== 'READY') throw new Error('Expected READY checkpoint.');
  const player = { ...resume.playerTeam[0], factoryOriginalHeldItemId: 'sitrus-berry', factoryHeldItemId: undefined };
  const battle = { ...saved, factory: { ...saved.factory, battleResume: { ...resume, playerTeam: [player] } } };
  assert.equal(classifySaveText(JSON.stringify(battle)).kind, 'valid');
  for (const invalid of [
    { ...player, factoryOriginalHeldItemId: undefined },
    { ...player, factoryOriginalHeldItemId: 'forged-item' },
    { ...player, factoryOriginalHeldItemId: null, factoryHeldItemId: 'forged-item' },
  ]) {
    const broken = { ...battle, factory: { ...battle.factory, battleResume: { ...resume, playerTeam: [invalid] } } };
    assert.equal(classifySaveText(JSON.stringify(broken)).kind, 'corrupt');
  }
  const brokenRental = {
    ...battle,
    factory: { ...battle.factory, battleResume: { ...resume, factoryRentals: [{ ...player, factoryOriginalHeldItemId: undefined }] } },
  };
  assert.equal(classifySaveText(JSON.stringify(brokenRental)).kind, 'corrupt');
  const rentalWithoutIdentity = {
    ...battle,
    factory: { ...battle.factory, battleResume: { ...resume, factoryRentals: [{ factoryOriginalHeldItemId: null }] } },
  };
  assert.equal(classifySaveText(JSON.stringify(rentalWithoutIdentity)).kind, 'corrupt');
  const consumedResult = {
    ...battle,
    runSupply: { runId: 'run:item-schema', tickets: 1, lastCreditedStage: 1 },
    factory: { ...battle.factory, battleResume: { ...resume, phase: 'ROUND_RESULT', roundResult: 'WIN', playerTeam: [player] } },
  };
  assert.equal(classifySaveText(JSON.stringify(consumedResult)).kind, 'valid');
});

test('battle result keeps spent items; next BATTLE checkpoint returns originals and resists stale saves', () => {
  withStorage(() => {
    const base = draft('run:held-atomic', 0, 0, 1);
    const resume = base.factory.battleResume;
    if (resume.status !== 'READY') throw new Error('Expected READY checkpoint.');
    const player = { ...resume.playerTeam[0], factoryOriginalHeldItemId: 'sitrus-berry', factoryHeldItemId: undefined };
    const enemy = { ...resume.enemyTeam[0], factoryOriginalHeldItemId: 'white-herb', factoryHeldItemId: undefined };
    const battle = {
      ...base,
      factory: { ...base.factory, battleResume: { ...resume, playerTeam: [player], enemyTeam: [enemy], factoryRentals: [player] } },
    };
    persistSaveData(battle);
    const inBattle = loadSaveData()!.factory.battleResume;
    assert.equal(inBattle.status, 'READY');
    if (inBattle.status !== 'READY') return;
    assert.equal(inBattle.playerTeam[0].factoryHeldItemId, undefined);
    assert.equal(inBattle.playerTeam[0].factoryOriginalHeldItemId, 'sitrus-berry');

    const first = commitFactoryGroupSettlement(battle, 'run:held-atomic', 1, 'WIN', false, { playerTeam: [player], enemyTeam: [enemy] });
    assert.equal(first.amount, 0);
    let committed = loadSaveData()!.factory.battleResume;
    assert.equal(committed.status, 'READY');
    if (committed.status !== 'READY') return;
    assert.equal(committed.phase, 'ROUND_RESULT');
    assert.equal(committed.playerTeam[0].factoryHeldItemId, undefined);
    assert.equal(committed.enemyTeam[0].factoryHeldItemId, undefined);
    const duplicate = commitFactoryGroupSettlement(battle, 'run:held-atomic', 1, 'WIN', false, { playerTeam: [player], enemyTeam: [enemy] });
    assert.equal(duplicate.awarded, false);
    assert.equal(duplicate.wallet.revision, first.wallet.revision);
    persistSaveData(battle);
    committed = loadSaveData()!.factory.battleResume;
    assert.equal(committed.status, 'READY');
    if (committed.status !== 'READY') return;
    assert.equal(committed.playerTeam[0].factoryHeldItemId, undefined);

    const swapCheckpoint = {
      ...loadSaveData()!,
      factory: {
        ...loadSaveData()!.factory,
        battleResume: { ...committed, phase: 'FACTORY_SWAP' as const },
      },
    };
    persistSaveData(swapCheckpoint);
    persistSaveData(battle);
    const swapped = loadSaveData()!.factory.battleResume;
    assert.equal(swapped.status, 'READY');
    if (swapped.status === 'READY') {
      assert.equal(swapped.phase, 'FACTORY_SWAP');
      assert.equal(swapped.playerTeam[0].factoryHeldItemId, undefined);
    }
    if (swapped.status !== 'READY') return;
    const nextBattle = {
      stage: 2,
      playerTeam: prepareFactoryPartyForBattle(swapped.playerTeam),
      enemyTeam: swapped.enemyTeam,
      currentEnemyTrainerId: swapped.currentEnemyTrainerId!,
      enemyAiTier: swapped.enemyAiTier,
      specialBossBattleActive: false,
      swapped: false,
    };
    const freshBattle = commitFactoryBattleStart('run:held-atomic', nextBattle);
    assert.equal(freshBattle.status, 'READY');
    if (freshBattle.status === 'READY') {
      assert.deepEqual(freshBattle.tailwindTurns, { player: 0, enemy: 0 });
      assert.deepEqual(freshBattle.hazards, {
        player: { stealthRock: false, toxicSpikesLayers: 0 },
        enemy: { stealthRock: false, toxicSpikesLayers: 0 },
      });
    }
    assert.deepEqual(commitFactoryBattleStart('run:held-atomic', nextBattle), loadSaveData()!.factory.battleResume);
    assert.throws(() => commitFactoryBattleStart('run:held-atomic', {
      ...nextBattle,
      playerTeam: [{
        ...nextBattle.playerTeam[0],
        factoryOriginalHeldItemId: 'white-herb',
        factoryHeldItemId: 'white-herb',
      }],
    }), /different next battle/);
    assert.throws(() => commitFactoryBattleStart('run:held-atomic', {
      ...nextBattle,
      playerTeam: [{
        ...nextBattle.playerTeam[0],
        ivs: { ...nextBattle.playerTeam[0].ivs, attack: nextBattle.playerTeam[0].ivs.attack + 1 },
      }],
    }), /different next battle/);
    const prepared = loadSaveData()!.factory.battleResume;
    assert.equal(prepared.status, 'READY');
    if (prepared.status === 'READY') {
      assert.equal(prepared.stage, 2);
      assert.equal(prepared.playerTeam[0].factoryHeldItemId, 'sitrus-berry');
    }
    persistSaveData(swapCheckpoint);
    const afterStaleSwap = loadSaveData()!.factory.battleResume;
    assert.equal(afterStaleSwap.status, 'READY');
    if (afterStaleSwap.status === 'READY') assert.equal(afterStaleSwap.stage, 2);
    assert.equal(parseSaveDataFromText(JSON.stringify(loadSaveData())).factory.battleResume.status, 'READY');
  });
});

test('failed next-battle checkpoint keeps result items spent and allows a retry', () => {
  withStorage((_storage, failNextWrite) => {
    const battle = draft('run:next-start-failure', 0, 0, 1);
    const initial = battle.factory.battleResume;
    if (initial.status !== 'READY') throw new Error('Expected READY checkpoint.');
    const spent = { ...initial.playerTeam[0], factoryOriginalHeldItemId: 'sitrus-berry', factoryHeldItemId: undefined };
    const withSpent = { ...battle, factory: { ...battle.factory, battleResume: { ...initial, playerTeam: [spent] } } };
    persistSaveData(withSpent);
    commitFactoryGroupSettlement(withSpent, 'run:next-start-failure', 1, 'WIN', false, { playerTeam: [spent], enemyTeam: initial.enemyTeam });
    const before = loadSaveData()!.factory.battleResume;
    if (before.status !== 'READY') throw new Error('Expected result checkpoint.');
    const start = {
      stage: 2,
      playerTeam: prepareFactoryPartyForBattle(before.playerTeam),
      enemyTeam: before.enemyTeam,
      currentEnemyTrainerId: before.currentEnemyTrainerId!,
      enemyAiTier: before.enemyAiTier,
      specialBossBattleActive: false,
      swapped: false,
    };
    assert.throws(() => commitFactoryBattleStart('run:next-start-failure', { ...start, playerTeam: before.playerTeam }), /cannot start/);
    failNextWrite();
    assert.throws(() => commitFactoryBattleStart('run:next-start-failure', start), /Quota/);
    const afterFailure = loadSaveData()!.factory.battleResume;
    assert.equal(afterFailure.status, 'READY');
    if (afterFailure.status !== 'READY') return;
    assert.equal(afterFailure.phase, 'ROUND_RESULT');
    assert.equal(afterFailure.stage, 1);
    assert.equal(afterFailure.playerTeam[0].factoryHeldItemId, undefined);
    commitFactoryBattleStart('run:next-start-failure', start);
    const resumed = loadSaveData()!.factory.battleResume;
    assert.equal(resumed.status, 'READY');
    if (resumed.status !== 'READY') return;
    assert.equal(resumed.phase, 'BATTLE');
    assert.equal(resumed.stage, 2);
    assert.equal(resumed.playerTeam[0].factoryHeldItemId, 'sitrus-berry');
  });
});

test('completed set starts the next battle with the swapped member original item', () => {
  withStorage(() => {
    const base = draft('run:next-set-item', 0, 0, 7);
    const source = base.factory.battleResume;
    if (source.status !== 'READY') throw new Error('Expected READY checkpoint.');
    const enemy = { ...source.enemyTeam[0], factoryOriginalHeldItemId: 'white-herb', factoryHeldItemId: undefined };
    const battle = { ...base, factory: { ...base.factory, battleResume: { ...source, enemyTeam: [enemy] } } };
    persistSaveData(battle);
    const settled = commitFactoryGroupSettlement(battle, 'run:next-set-item', 7, 'WIN', false, { playerTeam: source.playerTeam, enemyTeam: [enemy] });
    const result = loadSaveData()!.factory.battleResume;
    if (result.status !== 'READY') throw new Error('Expected result checkpoint.');
    persistSaveData({ ...loadSaveData()!, factory: { ...loadSaveData()!.factory, battleResume: { ...result, phase: 'BASE' } } });
    const before = loadSaveData()!.factory.battleResume;
    if (before.status !== 'READY') throw new Error('Expected BASE checkpoint.');
    assert.equal(before.playerTeam[0].factoryHeldItemId, undefined);
    commitFactoryBattleStart('run:next-set-item', {
      stage: 8,
      playerTeam: prepareFactoryPartyForBattle([enemy]),
      enemyTeam: before.enemyTeam,
      currentEnemyTrainerId: before.currentEnemyTrainerId!,
      enemyAiTier: before.enemyAiTier,
      specialBossBattleActive: false,
      swapped: true,
    });
    const after = loadSaveData()!;
    assert.equal(after.wallet.balance, settled.wallet.balance);
    assert.equal(after.factory.battleResume.status, 'READY');
    if (after.factory.battleResume.status !== 'READY') return;
    assert.equal(after.factory.battleResume.stage, 8);
    assert.equal(after.factory.battleResume.playerTeam[0].factoryHeldItemId, 'white-herb');
    assert.equal(after.factory.battleResume.swapCount, before.swapCount + 1);
    assert.equal(after.factory.battleResume.totalRents, before.totalRents + 1);
    persistSaveData({
      ...after,
      factory: {
        ...after.factory,
        battleResume: {
          ...after.factory.battleResume,
          swapCount: before.swapCount,
          totalRents: before.totalRents,
          playerTeam: before.playerTeam,
        },
      },
    });
    const afterSameStageStaleSave = loadSaveData()!.factory.battleResume;
    assert.equal(afterSameStageStaleSave.status, 'READY');
    if (afterSameStageStaleSave.status !== 'READY') return;
    assert.equal(afterSameStageStaleSave.swapCount, before.swapCount + 1);
    assert.equal(afterSameStageStaleSave.totalRents, before.totalRents + 1);
    assert.equal(afterSameStageStaleSave.playerTeam[0].id, enemy.id);
    assert.equal(afterSameStageStaleSave.playerTeam[0].factoryHeldItemId, 'white-herb');
    persistSaveData({
      ...battle,
      wallet: after.wallet,
      factory: { ...battle.factory, battleResume: before },
    });
    const afterStale = loadSaveData()!;
    assert.equal(afterStale.factory.battleResume.status, 'READY');
    if (afterStale.factory.battleResume.status !== 'READY') return;
    assert.equal(afterStale.factory.battleResume.stage, 8);
    assert.equal(afterStale.factory.battleResume.playerTeam[0].factoryHeldItemId, 'white-herb');
    assert.equal(afterStale.progress.totalRents, before.totalRents + 1);
    assert.equal(afterStale.factory.curChallengeBattleNum, 0);
    assert.ok(afterStale.factory.trainerIdsBySet.some((entry) => entry.setNo === 2
      && entry.trainerIds.includes(before.currentEnemyTrainerId!)));
  });
});

test('failed atomic result leaves battle consumption intact until retry', () => {
  withStorage((_storage, failNextWrite) => {
    const base = draft('run:held-failure', 0, 0, 7);
    const resume = base.factory.battleResume;
    if (resume.status !== 'READY') throw new Error('Expected READY checkpoint.');
    const player = { ...resume.playerTeam[0], factoryOriginalHeldItemId: 'white-herb', factoryHeldItemId: undefined };
    const battle = { ...base, factory: { ...base.factory, battleResume: { ...resume, playerTeam: [player] } } };
    persistSaveData(battle);
    failNextWrite();
    assert.throws(() => commitFactoryGroupSettlement(battle, 'run:held-failure', 7, 'WIN', false, { playerTeam: [player], enemyTeam: resume.enemyTeam }), /Quota/);
    const failed = loadSaveData()!.factory.battleResume;
    assert.equal(failed.status, 'READY');
    if (failed.status === 'READY') {
      assert.equal(failed.phase, 'BATTLE');
      assert.equal(failed.playerTeam[0].factoryHeldItemId, undefined);
    }
    assert.ok(loadPendingFactorySettlement());
    const retry = commitFactoryGroupSettlement(loadSaveData()!, 'run:held-failure', 7, 'WIN', false);
    assert.equal(retry.amount, 3);
    const committed = loadSaveData()!.factory.battleResume;
    assert.equal(committed.status, 'READY');
    if (committed.status === 'READY') {
      assert.equal(committed.playerTeam[0].factoryHeldItemId, undefined);
      const baseCheckpoint = {
        ...loadSaveData()!,
        factory: { ...loadSaveData()!.factory, battleResume: { ...committed, phase: 'BASE' as const } },
      };
      persistSaveData(baseCheckpoint);
      persistSaveData(battle);
      const afterStaleSave = loadSaveData()!.factory.battleResume;
      assert.equal(afterStaleSave.status, 'READY');
      if (afterStaleSave.status === 'READY') {
        assert.equal(afterStaleSave.phase, 'BASE');
        assert.equal(afterStaleSave.playerTeam[0].factoryHeldItemId, undefined);
      }
    }
  });
});

test('battle result keeps unrelated data from a newer persisted wallet revision', () => {
  withStorage(() => {
    const older = draft('run:newer-fields', 0, 0, 1);
    persistSaveData(older);
    const newer = {
      ...older,
      settings: { ...older.settings, currentLanguage: 'en' },
      collection: { ...older.collection, seenIds: [25, 133] },
    };
    adjustWalletBalance(newer, 1);
    const result = commitFactoryGroupSettlement(older, 'run:newer-fields', 1, 'WIN', false);
    assert.equal(result.wallet.balance, 1);
    const saved = loadSaveData()!;
    assert.equal(saved.settings.currentLanguage, 'en');
    assert.deepEqual(saved.collection.seenIds, [25, 133]);
    assert.equal(saved.factory.battleResume.status, 'READY');
    if (saved.factory.battleResume.status === 'READY') assert.equal(saved.factory.battleResume.phase, 'ROUND_RESULT');
  });
});

test('companion candidates are fixed and same-version saves require null or one approved ID', () => {
  assert.deepEqual(COMPANION_CANDIDATES.map((candidate) => candidate.id), [25, 133, 175, 447, 744, 921]);
  const base = { schemaVersion: 13, runSupply: { runId: null, tickets: 0, lastCreditedStage: 0 }, factory: { battleResume: { status: 'EMPTY' } }, settings: { selectedGens: [9] } };
  assert.equal(parseSaveDataFromText(JSON.stringify({ ...base, progress: { companionSpeciesId: null } })).progress.companionSpeciesId, null);
  for (const candidate of COMPANION_CANDIDATES) {
    assert.equal(parseSaveDataFromText(JSON.stringify({ ...base, progress: { companionSpeciesId: candidate.id } })).progress.companionSpeciesId, candidate.id);
  }
  for (const progress of [{}, { companionSpeciesId: 0 }, { companionSpeciesId: 1 }, { companionSpeciesId: 999 }, { companionSpeciesId: '25' }, { companionSpeciesId: 25.5 }]) {
    const raw = JSON.stringify({ ...base, progress });
    assert.equal(classifySaveText(raw).kind, 'corrupt');
    assert.throws(() => parseSaveDataFromText(raw), /导入文件损坏/);
  }
  assert.equal(classifySaveText(JSON.stringify({ ...base, progress: { companionSpeciesId: null }, factory: { battleResume: buildLegacyReadyBattleResume() } })).kind, 'corrupt');
  assert.equal(classifySaveText(JSON.stringify({ ...base, schemaVersion: 10 })).kind, 'legacy');
  withStorage((storage) => {
    const brokenRaw = JSON.stringify({ ...base, progress: { companionSpeciesId: 999 } });
    storage.set('pokefactory_save_v1', brokenRaw);
    const valid = parseSaveDataFromText(JSON.stringify({ ...base, progress: { companionSpeciesId: null } }));
    assert.equal(inspectStoredSave().kind, 'corrupt');
    assert.throws(() => persistSaveData(valid), /requires backup/);
    assert.equal(storage.get('pokefactory_save_v1'), brokenRaw);
  });
});

test('companion binding writes before use, retries failed writes, and cannot be changed by stale saves', () => {
  withStorage((storage, failNextWrite) => {
    const unbound = parseSaveDataFromText(JSON.stringify({
      schemaVersion: 13,
      runSupply: { runId: null, tickets: 0, lastCreditedStage: 0 },
      progress: { companionSpeciesId: null },
      settings: { selectedGens: [1] },
      factory: { battleResume: { status: 'EMPTY' } },
    }));
    persistSaveData(unbound);
    failNextWrite();
    assert.throws(() => bindCompanionToSave(unbound, 921), /Quota/);
    assert.equal(loadSaveData()?.progress.companionSpeciesId, null);
    const bound = bindCompanionToSave(unbound, 921);
    assert.equal(bound.progress.companionSpeciesId, 921);
    const committedRaw = storage.get('pokefactory_save_v1');
    assert.equal(bindCompanionToSave(unbound, 921).progress.companionSpeciesId, 921);
    assert.equal(storage.get('pokefactory_save_v1'), committedRaw);
    assert.throws(() => bindCompanionToSave(unbound, 25), /already bound/);
    assert.throws(() => bindCompanionToSave(unbound, 999), /Invalid companion/);
    persistSaveData(unbound);
    assert.equal(loadSaveData()?.progress.companionSpeciesId, 921);
    const exported = JSON.stringify(loadSaveData());
    assert.equal(parseSaveDataFromText(exported).progress.companionSpeciesId, 921);
  });
});

test('current READY phases and transitional EMPTY saves remain readable', () => {
  const saved = draft('run:phases', 3, 0, 7);
  const ready = saved.factory.battleResume;
  assert.equal(ready.status, 'READY');
  if (ready.status !== 'READY') return;
  for (const [stage, phase, result] of [
    [7, 'BATTLE', null],
    [7, 'ROUND_RESULT', 'WIN'],
    [8, 'FACTORY_SWAP', 'WIN'],
    [7, 'BASE', 'WIN'],
  ] as const) {
    const phaseSave = {
      ...saved,
      runSupply: { runId: 'run:phases', tickets: phase === 'BATTLE' ? stage - 1 : stage, lastCreditedStage: phase === 'BATTLE' ? stage - 1 : stage },
      factory: {
        ...saved.factory,
        challengePaused: phase === 'BASE',
        battleResume: {
          ...ready,
          stage,
          phase,
          roundResult: result,
          enemyTeam: ready.enemyTeam.map((pokemon) => ({ ...pokemon, currentHp: phase === 'BATTLE' ? pokemon.currentHp : 0 })),
        },
      },
    };
    assert.equal(classifySaveText(JSON.stringify(phaseSave)).kind, 'valid', `${phase} must remain recoverable`);
  }
  const empty = {
    ...saved,
    factory: { ...saved.factory, challengeStatus: 1, challengePaused: false, battleResume: createEmptyBattleResume() },
  };
  assert.equal(classifySaveText(JSON.stringify(empty)).kind, 'valid');
});

test('damaged current saves are classified before normalization and their original bytes cannot be overwritten', () => {
  withStorage((storage, _failNextWrite, session) => {
    const saved = draft('run:protect', 14, 2, 21);
    const ready = saved.factory.battleResume;
    assert.equal(ready.status, 'READY');
    if (ready.status !== 'READY') return;
    session.set('pokefactory_pending_settlement_v1', JSON.stringify({ runId: 'run:protect', stage: 21, result: 'WIN', isFrontierBrain: true }));
    const damaged = [
      { ...saved, runSupply: undefined },
      { ...saved, runSupply: { runId: 'run:other', tickets: 20, lastCreditedStage: 20 } },
      { ...saved, runSupply: { runId: 'run:protect', tickets: -1, lastCreditedStage: 20 } },
      { ...saved, runSupply: { runId: 'run:protect', tickets: 21, lastCreditedStage: 20 } },
      { ...saved, runSupply: { runId: 'run:protect', tickets: 20, lastCreditedStage: 19 } },
      { ...saved, factory: { ...saved.factory, battleResume: { ...ready, stage: 0 } } },
      { ...saved, factory: { ...saved.factory, battleResume: { ...ready, playerTeam: [{}] } } },
      { ...saved, factory: { ...saved.factory, battleResume: { ...ready, enemyTeam: [] } } },
      { ...saved, factory: { ...saved.factory, battleResume: { ...ready, currentEnemyTrainerId: null } } },
      { ...saved, factory: { ...saved.factory, battleResume: { ...ready, currentEnemyTrainerId: 'UNKNOWN_TRAINER' } } },
      { ...saved, factory: { ...saved.factory, challengePaused: true, battleResume: { ...ready, phase: 'BATTLE' } } },
    ];
    for (const candidate of damaged) {
      const raw = JSON.stringify(candidate);
      storage.set('pokefactory_save_v1', raw);
      assert.equal(inspectStoredSave().kind, 'corrupt');
      assert.equal(loadSaveData(), null);
      assert.equal(readUnsupportedSave(), null);
      assert.throws(() => parseSaveDataFromText(raw), /导入文件损坏/);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        assert.throws(() => persistSaveData(saved), /requires backup/);
      }
      assert.throws(() => replaceSaveData(saved), /requires backup/);
      assert.throws(() => adjustWalletBalance(saved, 1));
      assert.throws(() => beginFactoryWalletRun(saved));
      assert.throws(() => commitFactoryGroupSettlement(saved, 'run:protect', 21, 'WIN', true));
      assert.equal(storage.get('pokefactory_save_v1'), raw);
      assert.ok(loadPendingFactorySettlement());
    }

    for (const unreadable of ['', '{"schemaVersion":10,"factory":']) {
      storage.set('pokefactory_save_v1', unreadable);
      assert.equal(inspectStoredSave().kind, 'unreadable');
      assert.throws(() => persistSaveData(saved), /requires backup/);
      assert.throws(() => beginFactoryWalletRun(saved), /requires backup/);
      assert.equal(storage.get('pokefactory_save_v1'), unreadable);
      assert.ok(loadPendingFactorySettlement());
    }
    discardInvalidSave();
    assert.equal(storage.has('pokefactory_save_v1'), false);
    assert.equal(loadPendingFactorySettlement(), null);
  });
});

test('a damaged import leaves a valid local save and its wallet untouched', () => {
  withStorage((storage) => {
    const saved = draft('run:good', 20);
    persistSaveData(saved);
    const original = storage.get('pokefactory_save_v1');
    const broken = JSON.stringify({ ...saved, factory: { ...saved.factory, battleResume: { status: 'READY', stage: 7 } } });
    assert.throws(() => parseSaveDataFromText(broken), /导入文件损坏/);
    assert.throws(() => parseSaveDataFromText('{'), /导入文件损坏/);
    assert.equal(storage.get('pokefactory_save_v1'), original);
    assert.equal(loadSaveData()?.wallet.balance, 20);
  });
});

test('generation setting keeps exactly one valid generation and defaults to Kanto', () => {
  for (const [raw, expected] of [
    [[9], [9]],
    [[2], [2]],
    [[], [1]],
    [[2, 3], [1]],
    [[0], [1]],
    [[10], [1]],
    [[2.5], [1]],
    [['3'], [1]],
  ] as const) {
    const saved = parseSaveDataFromText(JSON.stringify({ schemaVersion: 13, runSupply: { runId: null, tickets: 0, lastCreditedStage: 0 }, progress: { companionSpeciesId: null }, settings: { selectedGens: raw }, factory: { battleResume: { status: 'EMPTY' } } }));
    assert.deepEqual(saved.settings.selectedGens, expected);
  }
});

test('factory singles table and Brain appearances match the reference', () => {
  assert.deepEqual(FACTORY_SINGLES_BP, [3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,14,14,15,15,15,15,15,15]);
  assert.equal(getFactorySetBp(1), 3);
  assert.equal(getFactorySetBp(2), 3);
  assert.equal(getFactorySetBp(3), 4);
  assert.equal(getFactorySetBp(31), 15);
  assert.equal(getFactoryGroupBp(6, 'WIN', false), 0);
  assert.equal(getFactoryGroupBp(7, 'LOSS', true), 0);
  assert.equal(getFactoryGroupBp(7, 'WIN', false), 3);
  assert.equal(getFactoryGroupBp(21, 'WIN', true), 14);
  assert.equal(isFactoryBrainStage(21, 0), true);
  assert.equal(isFactoryBrainStage(42, 0), false);
  assert.equal(isFactoryBrainStage(42, 1), true);
  assert.equal(isFactoryBrainStage(21, 1), false);
  assert.equal(isFactoryBrainStage(21, 2), true);
  assert.equal(isFactoryBrainStage(42, 2), true);
  assert.equal(isFactoryBrainStage(63, 2), true);
  assert.equal(isFactoryBrainStage(62, 2), false);
  assert.equal(selectFactoryTrainerTemplate({ challengeNum: 2, isBoss: true, isSpecialUnlockBoss: true }).id, FACTORY_BRAIN_TRAINER_ID);
  assert.notEqual(selectFactoryTrainerTemplate({ challengeNum: 2, isBoss: true, isSpecialUnlockBoss: false }).id, FACTORY_BRAIN_TRAINER_ID);
  assert.equal(getFactoryTrainerTemplateById(FACTORY_BRAIN_TRAINER_ID)?.trainerName, 'NOLAND');
});

test('wallet adjustment keeps a newer result and its run tickets', () => {
  withStorage(() => {
    const stale = draft('run:wallet-ticket', 0, 0, 1);
    persistSaveData(stale);
    commitFactoryGroupSettlement(stale, 'run:wallet-ticket', 1, 'WIN', false);

    const adjusted = adjustWalletBalance(stale, 5);
    assert.equal(adjusted.balance, 5);
    const saved = loadSaveData()!;
    assert.deepEqual(saved.runSupply, { runId: 'run:wallet-ticket', tickets: 1, lastCreditedStage: 1 });
    assert.equal(saved.factory.battleResume.status, 'READY');
    if (saved.factory.battleResume.status === 'READY') {
      assert.equal(saved.factory.battleResume.phase, 'ROUND_RESULT');
      assert.equal(saved.factory.battleResume.stage, 1);
    }
  });
});

test('wallet adjustment from an old run cannot overwrite a new run', () => {
  withStorage((storage) => {
    const stale = draft('run:old-wallet', 0, 0, 1);
    persistSaveData(stale);
    const next = beginFactoryWalletRun(stale);
    const before = loadSaveData()!;
    const storedBefore = [...storage.entries()];
    assert.equal(before.wallet.currentRunId, next.currentRunId);

    assert.throws(() => adjustWalletBalance(stale, 5), /Factory run changed/);
    assert.deepEqual([...storage.entries()], storedBefore);
    assert.equal(loadSaveData()?.wallet.currentRunId, before.wallet.currentRunId);
  });
});

test('wallet adjustment preserves a paused base checkpoint and seven tickets', () => {
  withStorage(() => {
    const stale = draft('run:paused-wallet', 0, 0, 7);
    persistSaveData(stale);
    commitFactoryGroupSettlement(stale, 'run:paused-wallet', 7, 'WIN', false);
    const result = loadSaveData()!;
    const checkpoint = result.factory.battleResume;
    assert.equal(checkpoint.status, 'READY');
    if (checkpoint.status !== 'READY') return;
    persistSaveData({
      ...result,
      factory: {
        ...result.factory,
        challengePaused: true,
        battleResume: { ...checkpoint, phase: 'BASE' },
      },
    });

    adjustWalletBalance(stale, 5);
    const saved = loadSaveData()!;
    assert.equal(saved.runSupply.tickets, 7);
    assert.equal(saved.factory.challengePaused, true);
    assert.equal(saved.factory.battleResume.status, 'READY');
    if (saved.factory.battleResume.status === 'READY') assert.equal(saved.factory.battleResume.phase, 'BASE');
  });
});

test('each win credits one run ticket once, including across a seven-battle set', () => {
  withStorage(() => {
    let saved = draft('run:supply', 0, 0, 1);
    persistSaveData(saved);
    for (let stage = 1; stage <= 8; stage += 1) {
      if (stage > 1) {
        saved = atBattle(loadSaveData()!, stage);
        persistSaveData(saved);
      }
      const settled = commitFactoryGroupSettlement(saved, 'run:supply', stage, 'WIN', false);
      assert.equal(settled.runSupply.tickets, stage);
      assert.equal(settled.runSupply.lastCreditedStage, stage);
      assert.equal(settled.wallet.balance, stage >= 7 ? 3 : 0);
      const duplicate = commitFactoryGroupSettlement(saved, 'run:supply', stage, 'WIN', false);
      assert.equal(duplicate.runSupply.tickets, stage);
      assert.equal(duplicate.wallet.balance, settled.wallet.balance);
      persistSaveData(saved);
      assert.equal(loadSaveData()!.runSupply.tickets, stage);
    }
  });
});

test('six wins credit zero; seventh win credits once; later sets and Brain bonus remain distinct', () => {
  withStorage(() => {
    let saved = draft('run:test', 0, 0, 1);
    persistSaveData(saved);
    for (let stage = 1; stage <= 6; stage += 1) {
      if (stage > 1) {
        saved = atBattle(loadSaveData()!, stage);
        persistSaveData(saved);
      }
      const result = commitFactoryGroupSettlement(saved, 'run:test', stage, 'WIN', false);
      assert.equal(result.amount, 0);
      assert.equal(result.wallet.balance, 0);
    }
    assert.equal(loadSaveData()?.wallet.balance, 0);
    saved = atBattle(loadSaveData()!, 7);
    persistSaveData(saved);
    const first = commitFactoryGroupSettlement(saved, 'run:test', 7, 'WIN', false);
    assert.equal(first.wallet.balance, 3);
    assert.equal(first.amount, 3);
    assert.equal(first.wallet.settledThrough, 1);
    const duplicate = commitFactoryGroupSettlement(saved, 'run:test', 7, 'WIN', false);
    assert.equal(duplicate.awarded, false);
    assert.equal(duplicate.amount, 3);
    persistSaveData(saved);
    saved = loadSaveData()!;
    assert.equal(saved.wallet.balance, 3);
    assert.equal(saved.factory.battleResume.status, 'READY');
    if (saved.factory.battleResume.status === 'READY') assert.equal(saved.factory.battleResume.phase, 'ROUND_RESULT');
    saved = atBattle(saved, 14);
    persistSaveData(saved);
    const second = commitFactoryGroupSettlement(saved, 'run:test', 14, 'WIN', false);
    assert.equal(second.wallet.balance, 6);
    saved = atBattle(loadSaveData()!, 21);
    persistSaveData(saved);
    const third = commitFactoryGroupSettlement(saved, 'run:test', 21, 'WIN', true);
    assert.equal(third.wallet.balance, 20);
    assert.equal(third.wallet.brainSymbols, 1);
    assert.equal(third.wallet.lastSettlement?.nominalBp, 14);
    assert.throws(() => commitFactoryGroupSettlement(saved, 'run:test', 35, 'WIN', false));
  });
});

test('loss or forfeit closes its group for zero BP and keeps prior BP', () => {
  for (const stage of [1, 6, 7]) {
    withStorage(() => {
      const saved = draft(`run:loss:${stage}`, 20, 0, stage);
      persistSaveData(saved);
      const loss = commitFactoryGroupSettlement(saved, `run:loss:${stage}`, stage, 'LOSS', false);
      assert.equal(loss.amount, 0);
      assert.equal(loss.wallet.balance, 20);
      assert.equal(loss.wallet.settledThrough, 1);
      assert.deepEqual(loss.runSupply, { runId: null, tickets: 0, lastCreditedStage: 0 });
      assert.deepEqual(loadSaveData()?.runSupply, loss.runSupply);
      persistSaveData(saved);
      assert.deepEqual(loadSaveData()?.runSupply, loss.runSupply);
      assert.throws(() => commitFactoryGroupSettlement(saved, `run:loss:${stage}`, 7, 'WIN', false));
    });
  }
});

test('failed group write keeps READY checkpoint and session retry intent', () => {
  withStorage((_storage, failNextWrite) => {
    const saved = draft('run:retry', 10);
    persistSaveData(saved);
    failNextWrite();
    assert.throws(() => commitFactoryGroupSettlement(saved, 'run:retry', 7, 'WIN', false), /Quota/);
    assert.equal(loadSaveData()?.wallet.balance, 10);
    assert.equal(loadSaveData()?.runSupply.tickets, 6);
    assert.equal(loadSaveData()?.factory.battleResume.status, 'READY');
    assert.deepEqual(loadPendingFactorySettlement(), { runId: 'run:retry', stage: 7, result: 'WIN', isFrontierBrain: false });
    const retry = commitFactoryGroupSettlement(loadSaveData()!, 'run:retry', 7, 'WIN', false);
    assert.equal(retry.wallet.balance, 13);
    assert.equal(retry.runSupply.tickets, 7);
    assert.equal(loadPendingFactorySettlement(), null);
    const after = loadSaveData()?.factory.battleResume;
    assert.equal(after?.status, 'READY');
    if (after?.status === 'READY') assert.equal(after.phase, 'ROUND_RESULT');
  });
});

test('BP caps at 9999 and new run retains BP but clears old encounter', () => {
  withStorage(() => {
    const saved = draft('run:cap', MAX_FACTORY_BP - 1, 0, 7);
    persistSaveData(saved);
    const settled = commitFactoryGroupSettlement(saved, 'run:cap', 7, 'WIN', false);
    assert.equal(settled.amount, 1);
    assert.equal(settled.nominalBp, 3);
    assert.equal(settled.wallet.balance, MAX_FACTORY_BP);
    const next = beginFactoryWalletRun(loadSaveData()!, 0, 7);
    assert.equal(next.balance, MAX_FACTORY_BP);
    assert.equal(next.settledThrough, 0);
    assert.equal(loadSaveData()?.factory.battleResume.status, 'EMPTY');
    assert.notEqual(next.currentRunId, 'run:cap');
    assert.deepEqual(loadSaveData()?.runSupply, { runId: next.currentRunId, tickets: 0, lastCreditedStage: 6 });
    persistSaveData(saved);
    assert.equal(loadSaveData()?.wallet.currentRunId, next.currentRunId);
    assert.deepEqual(loadSaveData()?.runSupply, { runId: next.currentRunId, tickets: 0, lastCreditedStage: 6 });
  });
});

test('developer jump to the third set starts a fresh run at the correct group baseline', () => {
  withStorage(() => {
    const saved = draft('run:old', 20, 1, 8);
    persistSaveData(saved);
    const next = beginFactoryWalletRun(saved, 0, 21);
    assert.equal(next.settledThrough, 2);
    assert.equal(loadSaveData()?.factory.battleResume.status, 'EMPTY');
    const nextBattle = atBattle(draft(next.currentRunId!, next.balance, next.settledThrough, 21), 21);
    persistSaveData(nextBattle);
    assert.equal(commitFactoryGroupSettlement(nextBattle, next.currentRunId!, 21, 'WIN', true).amount, 14);
  });
});

test('ending a paused completed set keeps earned BP and clears continuation without another settlement', () => {
  withStorage((_storage, failNextWrite) => {
    const saved = parseSaveDataFromText(JSON.stringify({
      schemaVersion: 13,
      progress: { companionSpeciesId: 25 },
      wallet: { balance: 14, revision: 4, currentRunId: 'run:pause', brainSymbols: 1, settledThrough: 3 },
      runSupply: { runId: 'run:pause', tickets: 21, lastCreditedStage: 21 },
      factory: {
        challengePaused: true,
        battleResume: buildLegacyReadyBattleResume({ stage: 21, phase: 'BASE', roundResult: 'WIN', lastBpGain: 14 }),
      },
    }));
    persistSaveData(saved);
    failNextWrite();
    assert.throws(() => endFactoryWalletRun(saved, 'run:pause'), /Quota/);
    assert.equal(loadSaveData()?.wallet.currentRunId, 'run:pause');
    assert.equal(loadSaveData()?.factory.battleResume.status, 'READY');
    const wallet = endFactoryWalletRun(saved, 'run:pause');
    assert.equal(wallet.balance, 14);
    assert.equal(wallet.brainSymbols, 1);
    assert.deepEqual(loadSaveData()?.runSupply, { runId: null, tickets: 0, lastCreditedStage: 0 });
    persistSaveData(saved);
    assert.equal(loadSaveData()?.wallet.currentRunId, null);
    assert.deepEqual(loadSaveData()?.runSupply, { runId: null, tickets: 0, lastCreditedStage: 0 });
    assert.equal(wallet.currentRunId, null);
    assert.equal(wallet.lastSettlement, null);
    const ended = loadSaveData()!;
    assert.equal(ended.factory.challengePaused, false);
    assert.equal(ended.factory.battleResume.status, 'EMPTY');
    assert.throws(() => endFactoryWalletRun(ended, 'run:pause'), /changed/);
  });
});
