import test from 'node:test';
import assert from 'node:assert/strict';

import { FACTORY_SINGLES_BP, getFactoryGroupBp, getFactorySetBp, MAX_FACTORY_BP } from '../features/game/config/factoryRewards';
import { FACTORY_BRAIN_TRAINER_ID, isFactoryBrainStage } from '../features/game/config/factoryBrain';
import { getFactoryTrainerTemplateById, selectFactoryTrainerTemplate } from '../features/game/config/factoryTrainerTemplates';
import {
  beginFactoryWalletRun,
  endFactoryWalletRun,
  commitFactoryGroupSettlement,
  loadPendingFactorySettlement,
  loadSaveData,
  parseSaveDataFromText,
  persistSaveData,
  readUnsupportedSave,
  discardUnsupportedSave,
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
  return {
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
      status: 'sleep',
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
      volatileStatuses: {
        confusion: {
          id: 'confusion',
          active: true,
          turnsRemaining: 2,
        },
      },
    }],
    currentEnemyTrainerId: 'trainer-1',
    inventoryItemIds: [],
    battleLog: [],
    ...overrides,
  };
}

function draft(runId = 'run:test', balance = 0, settledThrough = 0, stage = 7) {
  return parseSaveDataFromText(JSON.stringify({
    schemaVersion: 10,
    wallet: { balance, revision: 1, currentRunId: runId, brainSymbols: 0, settledThrough },
    factory: { battleResume: buildLegacyReadyBattleResume({ stage, coins: balance }) },
  }));
}

test('new save preserves battle snapshots, including postbattle phase', () => {
  const saved = parseSaveDataFromText(JSON.stringify({
    schemaVersion: 10,
    wallet: { balance: 3, revision: 1, currentRunId: 'run:one', brainSymbols: 0, settledThrough: 1 },
    factory: { battleResume: buildLegacyReadyBattleResume({ stage: 8, phase: 'FACTORY_SWAP', roundResult: 'WIN', lastBpGain: 0 }) },
  }));
  assert.equal(saved.schemaVersion, 10);
  assert.equal(saved.wallet.balance, 3);
  assert.equal(saved.factory.battleResume.status, 'READY');
  if (saved.factory.battleResume.status !== 'READY') return;
  assert.equal(saved.factory.battleResume.phase, 'FACTORY_SWAP');
  assert.equal(saved.factory.battleResume.roundResult, 'WIN');
  assert.equal(saved.factory.battleResume.playerTeam[0].nonVolatileStatus?.id, 'sleep');
});

test('old per-battle saves are rejected with a visible reset path and no BP migration', () => {
  for (const version of [6, 7, 8, 9]) {
    assert.throws(() => parseSaveDataFromText(JSON.stringify({ schemaVersion: version, wallet: { balance: 500 }, factory: { battleResume: buildLegacyReadyBattleResume({ coins: 500 }) } })), /旧规则存档不兼容/);
  }
  withStorage((storage) => {
    storage.set('pokefactory_save_v1', JSON.stringify({ schemaVersion: 8, wallet: { balance: 500 } }));
    assert.ok(readUnsupportedSave());
    assert.equal(loadSaveData(), null);
    discardUnsupportedSave();
    assert.equal(readUnsupportedSave(), null);
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
    const saved = parseSaveDataFromText(JSON.stringify({ schemaVersion: 10, settings: { selectedGens: raw } }));
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

test('six wins credit zero; seventh win credits once; later sets and Brain bonus remain distinct', () => {
  withStorage(() => {
    let saved = draft();
    persistSaveData(saved);
    for (let stage = 1; stage <= 6; stage += 1) {
      const result = commitFactoryGroupSettlement(saved, 'run:test', stage, 'WIN', false);
      assert.equal(result.amount, 0);
      assert.equal(result.wallet.balance, 0);
    }
    assert.equal(loadSaveData()?.wallet.balance, 0);
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
    const second = commitFactoryGroupSettlement(saved, 'run:test', 14, 'WIN', false);
    assert.equal(second.wallet.balance, 6);
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
    assert.equal(loadSaveData()?.factory.battleResume.status, 'READY');
    assert.deepEqual(loadPendingFactorySettlement(), { runId: 'run:retry', stage: 7, result: 'WIN', isFrontierBrain: false });
    const retry = commitFactoryGroupSettlement(loadSaveData()!, 'run:retry', 7, 'WIN', false);
    assert.equal(retry.wallet.balance, 13);
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
  });
});

test('developer jump to the third set starts a fresh run at the correct group baseline', () => {
  withStorage(() => {
    const saved = draft('run:old', 20, 1, 8);
    persistSaveData(saved);
    const next = beginFactoryWalletRun(saved, 0, 21);
    assert.equal(next.settledThrough, 2);
    assert.equal(loadSaveData()?.factory.battleResume.status, 'EMPTY');
    assert.equal(commitFactoryGroupSettlement(loadSaveData()!, next.currentRunId!, 21, 'WIN', true).amount, 14);
  });
});

test('ending a paused completed set keeps earned BP and clears continuation without another settlement', () => {
  withStorage((_storage, failNextWrite) => {
    const saved = parseSaveDataFromText(JSON.stringify({
      schemaVersion: 10,
      wallet: { balance: 14, revision: 4, currentRunId: 'run:pause', brainSymbols: 1, settledThrough: 3 },
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
    assert.equal(wallet.currentRunId, null);
    assert.equal(wallet.lastSettlement, null);
    const ended = loadSaveData()!;
    assert.equal(ended.factory.challengePaused, false);
    assert.equal(ended.factory.battleResume.status, 'EMPTY');
    assert.throws(() => endFactoryWalletRun(ended, 'run:pause'), /changed/);
  });
});
