import test from 'node:test';
import assert from 'node:assert/strict';
import type { GamePokemon } from '../types';
import { prepareFactoryPartyForBattle, restoreFactoryParty } from '../features/game/utils/restoreFactoryParty';

import { FACTORY_SINGLES_BP, getFactoryGroupBp, getFactorySetBp, MAX_FACTORY_BP, shouldEnterRewardAfterWinning } from '../features/game/config/factoryRewards';
import {
  FACTORY_REWARD_HELD_ITEM_IDS,
  canEquipFactoryRewardItem,
  enumerateFactoryRewardCandidates,
  type FactoryRewardHeldItemId,
} from '../features/game/config/factoryRewardPool';
import {
  getFactoryHeldItemBaselines,
  isFactoryHeldItemTeamUnique,
} from '../features/game/config/factoryHeldItemRules';
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
  commitFactoryRewardPending,
  commitFactoryRewardReady,
  commitFactoryItemRewardClaim,
  commitFactoryRewardContinueIntent,
  createEmptyBattleResume,
  discardInvalidSave,
  getFactorySwapEquippedItemConflict,
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
      factoryEquippedHeldItemId: null,
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
      factoryEquippedHeldItemId: null,
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
    schemaVersion: 14,
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
    player: { stealthRock: true, toxicSpikesLayers: 2 },
    enemy: { stealthRock: false, toxicSpikesLayers: 1 },
  };
  const withHazards = (value: unknown) => JSON.stringify({
    ...saved,
    factory: { ...saved.factory, battleResume: { ...previous, hazards: value } },
  });
  const restored = parseSaveDataFromText(withHazards(hazards)).factory.battleResume;
  assert.equal(restored.status, 'READY');
  if (restored.status === 'READY') assert.deepEqual(restored.hazards, hazards);
  const poisoned = parseSaveDataFromText(JSON.stringify({
    ...saved,
    factory: { ...saved.factory, battleResume: {
      ...previous,
      hazards,
      playerTeam: [{ ...previous.playerTeam[0], nonVolatileStatus: { id: 'bad_poison', toxicCounter: 1 } }, ...previous.playerTeam.slice(1)],
    } },
  })).factory.battleResume;
  assert.equal(poisoned.status, 'READY');
  if (poisoned.status === 'READY') {
    assert.equal(poisoned.hazards.player.toxicSpikesLayers, 2);
    assert.equal(poisoned.playerTeam[0].nonVolatileStatus?.id, 'bad_poison');
    assert.equal(poisoned.playerTeam[0].nonVolatileStatus?.toxicCounter, 1);
  }
  assert.equal(classifySaveText(withHazards({ player: { stealthRock: 'yes' } })).kind, 'corrupt');
  for (const layers of [-1, 3, 1.5]) {
    assert.equal(classifySaveText(withHazards({ ...hazards, player: { ...hazards.player, toxicSpikesLayers: layers } })).kind, 'corrupt');
  }
});

test('new save preserves battle snapshots, including postbattle phase', () => {
  const saved = parseSaveDataFromText(JSON.stringify({
    schemaVersion: 14,
    progress: { companionSpeciesId: 25 },
    wallet: { balance: 3, revision: 1, currentRunId: 'run:one', brainSymbols: 0, settledThrough: 1 },
    runSupply: { runId: 'run:one', tickets: 8, lastCreditedStage: 8 },
    factory: { battleResume: buildLegacyReadyBattleResume({ stage: 8, phase: 'FACTORY_SWAP', roundResult: 'WIN', lastBpGain: 0 }) },
  }));
  assert.equal(saved.schemaVersion, 14);
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
  const player = { ...resume.playerTeam[0], factoryOriginalHeldItemId: 'sitrus-berry', factoryEquippedHeldItemId: 'sitrus-berry', factoryHeldItemId: undefined };
  const battle = { ...saved, factory: { ...saved.factory, battleResume: { ...resume, playerTeam: [player] } } };
  assert.equal(classifySaveText(JSON.stringify(battle)).kind, 'valid');
  for (const invalid of [
    { ...player, factoryOriginalHeldItemId: undefined },
    { ...player, factoryOriginalHeldItemId: 'forged-item' },
    { ...player, factoryOriginalHeldItemId: null, factoryEquippedHeldItemId: 'sitrus-berry', factoryHeldItemId: 'forged-item' },
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
    const player = { ...resume.playerTeam[0], factoryOriginalHeldItemId: 'sitrus-berry', factoryEquippedHeldItemId: 'sitrus-berry', factoryHeldItemId: undefined };
    const enemy = { ...resume.enemyTeam[0], factoryOriginalHeldItemId: 'white-herb', factoryEquippedHeldItemId: 'white-herb', factoryHeldItemId: undefined };
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
        factoryEquippedHeldItemId: 'white-herb',
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
    const spent = { ...initial.playerTeam[0], factoryOriginalHeldItemId: 'sitrus-berry', factoryEquippedHeldItemId: 'sitrus-berry', factoryHeldItemId: undefined };
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
    const enemy = { ...source.enemyTeam[0], factoryOriginalHeldItemId: 'white-herb', factoryEquippedHeldItemId: 'white-herb', factoryHeldItemId: undefined };
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
    const player = { ...resume.playerTeam[0], factoryOriginalHeldItemId: 'white-herb', factoryEquippedHeldItemId: 'white-herb', factoryHeldItemId: undefined };
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
  const base = { schemaVersion: 14, runSupply: { runId: null, tickets: 0, lastCreditedStage: 0 }, factory: { battleResume: { status: 'EMPTY' } }, settings: { selectedGens: [9] } };
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
      schemaVersion: 14,
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
    const saved = parseSaveDataFromText(JSON.stringify({ schemaVersion: 14, runSupply: { runId: null, tickets: 0, lastCreditedStage: 0 }, progress: { companionSpeciesId: null }, settings: { selectedGens: raw }, factory: { battleResume: { status: 'EMPTY' } } }));
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
      schemaVersion: 14,
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

// --- 四卡生成 / 奖励节点检查点事务层（PRD §3.2–§3.6、§4、边界 A/B）---------------------------------

/**
 * 逐队员夹具。`side: 'enemy'` 生成身份指纹不同的敌方成员，
 * 从而满足「换入成员必须是本场敌方成员」的换怪语义。
 */
function rewardMember(index: number, item: string | null, side: 'player' | 'enemy' = 'player'): GamePokemon {
  const playerNames = ['bulbasaur', 'charmander', 'squirtle'];
  const playerIds = [1, 4, 7];
  const enemyNames = ['pidgey', 'rattata', 'zubat'];
  const enemyIds = [16, 19, 41];
  const name = side === 'player' ? playerNames[index] : enemyNames[index];
  const id = side === 'player' ? playerIds[index] : enemyIds[index];
  const maxHp = 100 + index * 10 + id;
  return {
    id,
    name,
    sprites: { front_default: '', back_default: '' },
    stats: [],
    types: [{ type: { name: 'normal' } }],
    abilities: [{ ability: { name: 'static', url: '' } }],
    moves: [],
    currentHp: maxHp,
    maxHp,
    selectedMoves: [{ name: 'tackle', type: 'normal', pp: 35, maxPp: 35 }],
    level: 50,
    nature: { name: 'hardy', zhName: 'Hardy', plus: 'attack', minus: 'attack' },
    ivs: { hp: 1, attack: 1, defense: 1, spAtk: 1, spDef: 1, speed: 1 },
    evs: { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 },
    baseStats: { hp: 45, attack: 49, defense: 49, spAtk: 65, spDef: 65, speed: 45 },
    calculatedStats: { hp: maxHp, attack: 90, defense: 90, spAtk: 100, spDef: 100, speed: 80 },
    factoryOriginalHeldItemId: item,
    factoryEquippedHeldItemId: item,
    factoryHeldItemId: item ?? undefined,
  } as unknown as GamePokemon;
}

function baselinesOf(team: readonly GamePokemon[]): Array<string | null> {
  return team.map((pokemon) => pokemon.factoryEquippedHeldItemId ?? null);
}

/** 组内第 3 战胜后的换怪完成态：`phase: 'FACTORY_SWAP'` + `roundResult: 'WIN'`，可直接提交奖励节点。 */
function rewardSwapSave(options: {
  runId?: string;
  stage?: number;
  playerItems?: Array<string | null>;
  enemyItems?: Array<string | null>;
  /** 模拟「战斗中消耗 / 被拍落」的队员下标：清空本场当前持有物，但保留本局返还基准。 */
  spentIndices?: number[];
} = {}) {
  const runId = options.runId ?? 'run:reward';
  const stage = options.stage ?? 3;
  const playerItems = options.playerItems ?? [null, null, null];
  const enemyItems = options.enemyItems ?? [null, null, null];
  const resume = buildLegacyReadyBattleResume({
    stage,
    phase: 'FACTORY_SWAP',
    roundResult: 'WIN',
    lastBpGain: 7,
    coins: 0,
    playerTeam: playerItems.map((item, index) => rewardMember(index, item, 'player')),
    enemyTeam: enemyItems.map((item, index) => rewardMember(index, item, 'enemy')),
    rewardCheckpoint: undefined,
  });
  for (const index of options.spentIndices ?? []) {
    resume.playerTeam[index] = { ...resume.playerTeam[index], factoryHeldItemId: undefined };
  }
  return parseSaveDataFromText(JSON.stringify({
    schemaVersion: 14,
    progress: { companionSpeciesId: 25 },
    wallet: { balance: 0, revision: 1, currentRunId: runId, brainSymbols: 0, settledThrough: stage },
    runSupply: { runId, tickets: 0, lastCreditedStage: stage },
    factory: { battleResume: resume },
  }));
}

function storedResume(): BattleResumeSnapshot {
  const saved = loadSaveData();
  if (!saved || saved.factory.battleResume.status !== 'READY') throw new Error('Expected a stored READY checkpoint.');
  return saved.factory.battleResume;
}

test('skipping into the reward node commits one durable PENDING checkpoint and recovers after a write failure', () => {
  withStorage((_storage, failNextWrite) => {
    const saved = rewardSwapSave({ runId: 'run:pending', stage: 3 });
    persistSaveData(saved);
    const swapResume = storedResume();
    assert.equal(swapResume.phase, 'FACTORY_SWAP');
    assert.equal(swapResume.roundResult, 'WIN');
    assert.equal(shouldEnterRewardAfterWinning(swapResume.stage), true);
    const finalTeam = swapResume.playerTeam;

    // ① 写盘失败：不推进战次、不出卡，盘中仍是换怪完成态（PRD 边界 A）。
    failNextWrite();
    assert.throws(() => commitFactoryRewardPending('run:pending', 3, finalTeam, false), /Quota/);
    const afterFailure = storedResume();
    assert.equal(afterFailure.phase, 'FACTORY_SWAP');
    assert.equal(afterFailure.rewardCheckpoint, undefined);

    // ② 非奖励锚点（组内第 4 战胜后）不得进入奖励节点。
    assert.throws(() => commitFactoryRewardPending('run:pending', 4, finalTeam, false), /no reward checkpoint/);

    // ③ 「未换怪」不得被伪报为换怪：换入成员必须是本场敌方成员。
    const phantom = { ...finalTeam[0], level: 51 };
    assert.throws(() => commitFactoryRewardPending('run:pending', 3, [phantom, finalTeam[1], finalTeam[2]], true), /does not match/);

    // ④ 重试成功：只落 PENDING 锚点，尚未出卡。
    const pending = commitFactoryRewardPending('run:pending', 3, finalTeam, false);
    assert.equal(pending.phase, 'REWARD');
    assert.deepEqual(pending.rewardCheckpoint, { runId: 'run:pending', stage: 3, status: 'PENDING' });
    assert.deepEqual(storedResume().rewardCheckpoint, { runId: 'run:pending', stage: 3, status: 'PENDING' });

    // ⑤ 幂等：同锚点重复调用为同一检查点，且完全不重写盘（把下一次写盘设为必失败仍应成功）。
    failNextWrite();
    const repeat = commitFactoryRewardPending('run:pending', 3, finalTeam, false);
    assert.deepEqual(repeat.rewardCheckpoint, { runId: 'run:pending', stage: 3, status: 'PENDING' });
  });
});

test('a swap into the reward node commits once, counts the rent, and duplicate baselines are reconciled', () => {
  withStorage(() => {
    const saved = rewardSwapSave({
      runId: 'run:swap',
      stage: 3,
      playerItems: ['quick_claw', null, null],
      enemyItems: [null, 'quick_claw', null],
    });
    persistSaveData(saved);
    const swapResume = storedResume();

    // 冲突判定：换入成员的本局返还基准与留下的队员重复 ⇒ 指名冲突（UI 据此禁用该组合）。
    assert.equal(getFactorySwapEquippedItemConflict(swapResume.playerTeam, swapResume.enemyTeam, 2, 2), null);
    assert.deepEqual(getFactorySwapEquippedItemConflict(swapResume.playerTeam, swapResume.enemyTeam, 2, 1), {
      itemId: 'quick_claw',
      retainedPlayerIndex: 0,
    });

    // 即便绕过 UI 守卫直接提交受损队伍，事务层也**不写入重复队伍**：修复 + 如实上报，而不是抛错终止。
    const duplicateSwapTeam = [swapResume.playerTeam[0], swapResume.playerTeam[1], swapResume.enemyTeam[1]];
    const pending = commitFactoryRewardPending('run:swap', 3, duplicateSwapTeam, true);
    assert.equal(pending.rewardCheckpoint?.status, 'PENDING');
    assert.equal(pending.heldItemBaselineRepaired, true);
    assert.deepEqual(baselinesOf(pending.playerTeam), ['quick_claw', null, null]);
    assert.equal(isFactoryHeldItemTeamUnique(pending.playerTeam), true);
    // 原配字段未被改写 ⇒ 不静默侵占玩家资产。
    assert.equal(pending.playerTeam[2].factoryOriginalHeldItemId, 'quick_claw');
    // 换怪只计一次。
    assert.equal(pending.swapCount, swapResume.swapCount + 1);
    assert.equal(pending.totalRents, swapResume.totalRents + 1);

    // 幂等：重复提交不重复计租金。
    const repeat = commitFactoryRewardPending('run:swap', 3, duplicateSwapTeam, true);
    assert.equal(repeat.swapCount, pending.swapCount);
    assert.equal(repeat.totalRents, pending.totalRents);

    // 死路已消除：规整后的队伍仍然能正常出四张并冻结。
    const cards = enumerateFactoryRewardCandidates(baselinesOf(pending.playerTeam)).slice(0, 4);
    assert.equal(cards.length, 4);
    assert.equal(cards.includes('quick_claw'), false);
    const ready = commitFactoryRewardReady('run:swap', 3, cards).rewardCheckpoint;
    assert.equal(ready?.status, 'READY');

    // 正常换怪（不引入重复）：只在真正换怪时 +1，且不产生「已修复」标志。
    const normalSwap = rewardSwapSave({
      runId: 'run:swap-clean',
      stage: 3,
      playerItems: [null, null, null],
      enemyItems: [null, 'quick_claw', null],
    });
    persistSaveData(normalSwap);
    const cleanResume = storedResume();
    const cleanTeam = [cleanResume.playerTeam[0], cleanResume.enemyTeam[1], cleanResume.playerTeam[2]];
    const cleanPending = commitFactoryRewardPending('run:swap-clean', 3, cleanTeam, true);
    assert.equal(cleanPending.heldItemBaselineRepaired, undefined);
    assert.deepEqual(baselinesOf(cleanPending.playerTeam), [null, 'quick_claw', null]);
    assert.equal(cleanPending.swapCount, cleanResume.swapCount + 1);
    assert.equal(cleanPending.totalRents, cleanResume.totalRents + 1);
  });
});

test('the four approved cards are frozen once and never re-drawn across refresh, reopen and same-version import', () => {
  withStorage(() => {
    // H \ E 口径：无人持有时候选为全部七件；持有某件后该件退出候选池。
    assert.equal(enumerateFactoryRewardCandidates([null, null, null]).length, FACTORY_REWARD_HELD_ITEM_IDS.length);
    const saved = rewardSwapSave({ runId: 'run:freeze', stage: 3, playerItems: [null, 'quick_claw', null] });
    persistSaveData(saved);
    const swapResume = storedResume();
    commitFactoryRewardPending('run:freeze', 3, swapResume.playerTeam, false);
    const candidates = enumerateFactoryRewardCandidates(baselinesOf(swapResume.playerTeam));
    assert.equal(candidates.length, FACTORY_REWARD_HELD_ITEM_IDS.length - 1);
    assert.equal(candidates.includes('quick_claw'), false);

    // 未冻结时一律拒收非法四张：不足四张、重复卡、已持有（无合法装备对象）都被挡下。
    const cards = candidates.slice(0, 4);
    assert.equal(new Set(cards).size, 4);
    assert.throws(() => commitFactoryRewardReady('run:freeze', 3, cards.slice(0, 3)), /four distinct/);
    assert.throws(() => commitFactoryRewardReady('run:freeze', 3, [cards[0], cards[0], cards[1], cards[2]]), /four distinct/);
    assert.throws(
      () => commitFactoryRewardReady('run:freeze', 3, ['quick_claw' as FactoryRewardHeldItemId, cards[0], cards[1], cards[2]]),
      /four distinct/,
    );

    // 冻结：一次落盘，此后逐张不变。
    const frozen = commitFactoryRewardReady('run:freeze', 3, cards).rewardCheckpoint;
    assert.equal(frozen?.status, 'READY');
    assert.deepEqual(frozen, { runId: 'run:freeze', stage: 3, status: 'READY', cardItemIds: cards });

    // 刷新 / 重开：回读盘仍是同一组四张。
    assert.deepEqual(storedResume().rewardCheckpoint, frozen);

    // 同版导入：导出文本 → 重新解析 → 覆盖写盘，四张逐张不变。
    replaceSaveData(parseSaveDataFromText(JSON.stringify(loadSaveData())));
    assert.deepEqual(storedResume().rewardCheckpoint, frozen);

    // 同卡二次提交幂等；不同卡被拒 ⇒ 绝不重抽、绝不换一组。
    assert.deepEqual(commitFactoryRewardReady('run:freeze', 3, cards).rewardCheckpoint, frozen);
    assert.throws(() => commitFactoryRewardReady('run:freeze', 3, candidates.slice(1, 5)), /Different reward cards/);
    // 重新回到 PENDING 提交路径也复用同一组四张（不重抽）。
    assert.deepEqual(commitFactoryRewardPending('run:freeze', 3, swapResume.playerTeam, false).rewardCheckpoint, frozen);
  });
});

test('a claim is single-shot, idempotent, and the replaced item never enters the bag', () => {
  withStorage((_storage, failNextWrite) => {
    const saved = rewardSwapSave({ runId: 'run:claim', stage: 3, playerItems: [null, 'quick_claw', null] });
    persistSaveData(saved);
    const swapResume = storedResume();
    commitFactoryRewardPending('run:claim', 3, swapResume.playerTeam, false);
    const cards = enumerateFactoryRewardCandidates(baselinesOf(swapResume.playerTeam)).slice(0, 4);
    commitFactoryRewardReady('run:claim', 3, cards);
    const bagBefore = JSON.stringify(storedResume().inventoryItemIds);
    const claimItem = cards[0];
    const otherItem = cards[1];

    // 写盘失败：不产生半领取状态。
    failNextWrite();
    assert.throws(() => commitFactoryItemRewardClaim('run:claim', 3, claimItem, 1), /Quota/);
    assert.equal(storedResume().rewardCheckpoint?.status, 'READY');

    // 双击 / 连点：同参数只领一次（不依赖 UI busy）。
    const first = commitFactoryItemRewardClaim('run:claim', 3, claimItem, 1);
    assert.equal(first.rewardCheckpoint?.status, 'CLAIMED');
    const second = commitFactoryItemRewardClaim('run:claim', 3, claimItem, 1);
    assert.deepEqual(second.rewardCheckpoint, first.rewardCheckpoint);

    const claimed = storedResume();
    // 目标队员的本局返还基准与当前持有物都改判为领取到的道具。
    assert.equal(claimed.playerTeam[1].factoryEquippedHeldItemId, claimItem);
    assert.equal(claimed.playerTeam[1].factoryHeldItemId, claimItem);
    // 旧物「直接移除、不进背包」，且已被替换掉。
    assert.equal(JSON.stringify(claimed.inventoryItemIds), bagBefore);
    assert.notEqual(claimed.playerTeam[1].factoryEquippedHeldItemId, 'quick_claw');

    // 不同参数的第二次领取被绝对拒绝（换道具、换队员都不行）。
    assert.throws(() => commitFactoryItemRewardClaim('run:claim', 3, otherItem, 1), /already claimed/);
    assert.throws(() => commitFactoryItemRewardClaim('run:claim', 3, claimItem, 2), /already claimed/);
  });
});

test('READY claims reject items outside the four cards, already-held items and out-of-range targets', () => {
  withStorage(() => {
    const saved = rewardSwapSave({ runId: 'run:claim-reject', stage: 3, playerItems: [null, 'quick_claw', null] });
    persistSaveData(saved);
    const swapResume = storedResume();
    commitFactoryRewardPending('run:claim-reject', 3, swapResume.playerTeam, false);
    const candidates = enumerateFactoryRewardCandidates(baselinesOf(swapResume.playerTeam));
    const cards = candidates.slice(0, 4);
    commitFactoryRewardReady('run:claim-reject', 3, cards);
    const outsideItem = candidates.find((itemId) => !cards.includes(itemId));
    assert.notEqual(outsideItem, undefined);

    // 未在四张内。
    assert.throws(() => commitFactoryItemRewardClaim('run:claim-reject', 3, outsideItem!, 1), /not claimable/);
    // 队伍已作为返还基准持有的道具（无合法装备对象）。
    assert.throws(() => commitFactoryItemRewardClaim('run:claim-reject', 3, 'quick_claw', 1), /not claimable/);
    // 越界队员。
    assert.throws(() => commitFactoryItemRewardClaim('run:claim-reject', 3, cards[0], 5), /not claimable/);
    // 仍然一张都没被领走。
    assert.equal(storedResume().rewardCheckpoint?.status, 'READY');
  });
});

test('the replaced baseline returns to the pool while the three baselines stay unique', () => {
  withStorage(() => {
    const saved = rewardSwapSave({ runId: 'run:pool', stage: 3, playerItems: [null, 'quick_claw', null] });
    persistSaveData(saved);
    const swapResume = storedResume();
    commitFactoryRewardPending('run:pool', 3, swapResume.playerTeam, false);
    const candidates = enumerateFactoryRewardCandidates(baselinesOf(swapResume.playerTeam));
    const cards = candidates.slice(0, 4);
    commitFactoryRewardReady('run:pool', 3, cards);
    const claimItem = cards[0];

    const claimedTeam = commitFactoryItemRewardClaim('run:pool', 3, claimItem, 1).playerTeam;
    const baselines = baselinesOf(claimedTeam);
    assert.deepEqual(baselines, [null, claimItem, null]);
    // 三人返还基准互不重复 —— 本任务的不变量。
    const held = baselines.filter((itemId): itemId is FactoryRewardHeldItemId => Boolean(itemId));
    assert.equal(new Set(held).size, held.length);

    // 被替换掉的旧道具立即回到候选池，领取到的道具退出候选池。
    const poolAfter = enumerateFactoryRewardCandidates(baselines);
    assert.equal(poolAfter.includes('quick_claw'), true);
    assert.equal(poolAfter.includes(claimItem), false);
    assert.equal(poolAfter.length, FACTORY_REWARD_HELD_ITEM_IDS.length - 1);
  });
});

test('duplicate equipped baselines are rejected wherever they appear', () => {
  // 纯函数层：目标已持有该道具、或装备后与队友重复、或队员越界 ⇒ 均非合法装备对象。
  assert.equal(canEquipFactoryRewardItem([null, null, null], 'scope_lens', 0), true);
  assert.equal(canEquipFactoryRewardItem(['scope_lens', null, null], 'scope_lens', 0), false);
  assert.equal(canEquipFactoryRewardItem(['kings_rock', null, null], 'kings_rock', 1), false);
  assert.equal(canEquipFactoryRewardItem([null, null, null], 'scope_lens', 3), false);

  // 代码断言（而非默认假设）：即使输入含重复基准，枚举出的每张候选仍至少有一个合法装备对象。
  const duplicated = ['scope_lens', 'scope_lens', null];
  for (const itemId of enumerateFactoryRewardCandidates(duplicated)) {
    assert.equal([0, 1, 2].some((index) => canEquipFactoryRewardItem(duplicated, itemId, index)), true);
  }

  withStorage(() => {
    // 存档层：REWARD 检查点不再因「未满足唯一性」而整份拒收（那会把奖励节点变成死路），
    // 而是在读取/导入时**修复**并如实打上标志。
    const resume = buildLegacyReadyBattleResume({
      stage: 3,
      phase: 'REWARD',
      roundResult: 'WIN',
      lastBpGain: 7,
      coins: 0,
      playerTeam: [rewardMember(0, 'quick_claw'), rewardMember(1, 'quick_claw'), rewardMember(2, null)],
      enemyTeam: [rewardMember(0, null, 'enemy'), rewardMember(1, null, 'enemy'), rewardMember(2, null, 'enemy')],
      rewardCheckpoint: { runId: 'run:unique', stage: 3, status: 'PENDING' },
    });
    const inspection = classifySaveText(JSON.stringify({
      schemaVersion: 14,
      progress: { companionSpeciesId: 25 },
      wallet: { balance: 0, revision: 1, currentRunId: 'run:unique', brainSymbols: 0, settledThrough: 3 },
      runSupply: { runId: 'run:unique', tickets: 0, lastCreditedStage: 3 },
      factory: { battleResume: resume },
    }));
    assert.equal(inspection.kind, 'valid');
    if (inspection.kind !== 'valid') return;
    const restored = inspection.save.factory.battleResume;
    assert.equal(restored.status, 'READY');
    if (restored.status !== 'READY') return;
    assert.equal(restored.heldItemBaselineRepaired, true);
    assert.equal(isFactoryHeldItemTeamUnique(restored.playerTeam), true);
    assert.deepEqual(baselinesOf(restored.playerTeam), ['quick_claw', null, null]);
  });
});

test('the next battle cannot bypass the reward node and restores the claimed baseline once', () => {
  withStorage(() => {
    const saved = rewardSwapSave({ runId: 'run:next', stage: 3, playerItems: [null, 'quick_claw', null] });
    persistSaveData(saved);
    const swapResume = storedResume();
    const startFrom = (playerTeam: GamePokemon[]) => ({
      stage: 4,
      playerTeam,
      enemyTeam: swapResume.enemyTeam,
      currentEnemyTrainerId: swapResume.currentEnemyTrainerId,
      enemyAiTier: swapResume.enemyAiTier,
      specialBossBattleActive: false,
      swapped: false,
    });

    // ① 还没进奖励节点就想起下一战 ⇒ 拒绝（不能跳过奖励节点）。
    assert.throws(() => commitFactoryBattleStart('run:next', startFrom(swapResume.playerTeam)), /cannot start/);
    commitFactoryRewardPending('run:next', 3, swapResume.playerTeam, false);
    assert.throws(() => commitFactoryBattleStart('run:next', startFrom(swapResume.playerTeam)), /cannot start/);

    const cards = enumerateFactoryRewardCandidates(baselinesOf(swapResume.playerTeam)).slice(0, 4);
    commitFactoryRewardReady('run:next', 3, cards);
    // ② 只冻结、未领取 ⇒ 仍不能起战。
    assert.throws(() => commitFactoryBattleStart('run:next', startFrom(swapResume.playerTeam)), /cannot start/);

    const claimItem = cards[0];
    commitFactoryItemRewardClaim('run:next', 3, claimItem, 1);
    // ③ 已领取但未请求继续 ⇒ 仍不能起战。
    assert.throws(() => commitFactoryBattleStart('run:next', startFrom(swapResume.playerTeam)), /cannot start/);

    commitFactoryRewardContinueIntent('run:next', 3);
    // ④ 起战必须使用「按本局返还基准返还」后的队伍；拿未返还的旧队伍会被拒。
    assert.throws(() => commitFactoryBattleStart('run:next', startFrom(swapResume.playerTeam)), /cannot start/);

    const prepared = prepareFactoryPartyForBattle(storedResume().playerTeam);
    const started = commitFactoryBattleStart('run:next', startFrom(prepared));
    assert.equal(started.phase, 'BATTLE');
    assert.equal(started.stage, 4);
    assert.equal(started.rewardCheckpoint, undefined);
    // 逐战返还：起战携带的是本局返还基准（含刚领取的装备），而不是租借原配。
    assert.equal(started.playerTeam[1].factoryHeldItemId, claimItem);
    assert.equal(started.playerTeam[1].factoryEquippedHeldItemId, claimItem);

    // ⑤ 幂等：同一场再起一次返回同一检查点，不重复消耗。
    const repeat = commitFactoryBattleStart('run:next', startFrom(prepared));
    assert.equal(repeat.stage, 4);
    assert.equal(repeat.phase, 'BATTLE');
    assert.equal(repeat.playerTeam[1].factoryHeldItemId, claimItem);
    assert.equal(repeat.playerTeam[1].factoryEquippedHeldItemId, claimItem);
    assert.equal(repeat.swapCount, started.swapCount);

    // ⑥ 领取只发生一次：起战后奖励检查点已消费。
    assert.throws(() => commitFactoryItemRewardClaim('run:next', 3, claimItem, 1), /changed before the item was claimed/);
    assert.equal(storedResume().rewardCheckpoint, undefined);
    assert.equal(shouldEnterRewardAfterWinning(4), false);
  });
});

test('a reward checkpoint is only readable inside its own run, stage and phase', () => {
  withStorage(() => {
    assert.equal(shouldEnterRewardAfterWinning(6), true);
    assert.equal(shouldEnterRewardAfterWinning(3), true);
    assert.equal(shouldEnterRewardAfterWinning(4), false);
    assert.equal(shouldEnterRewardAfterWinning(7), false);

    const saved = rewardSwapSave({ runId: 'run:scope', stage: 3 });
    persistSaveData(saved);
    const swapResume = storedResume();
    commitFactoryRewardPending('run:scope', 3, swapResume.playerTeam, false);
    const cards = enumerateFactoryRewardCandidates(baselinesOf(swapResume.playerTeam)).slice(0, 4);

    // 别的 run、别的 stage 一律不可读。
    assert.throws(() => commitFactoryRewardReady('run:other', 3, cards), /Factory reward changed/);
    assert.throws(() => commitFactoryRewardReady('run:scope', 6, cards), /Factory reward changed/);
    // PENDING 阶段还不能领取，也不能请求继续。
    assert.throws(() => commitFactoryItemRewardClaim('run:scope', 3, cards[0], 0), /not claimable/);
    assert.throws(() => commitFactoryRewardContinueIntent('run:scope', 3), /claimed reward is required/);

    const ready = commitFactoryRewardReady('run:scope', 3, cards);
    assert.equal(ready.rewardCheckpoint?.stage, 3);
    assert.equal(ready.rewardCheckpoint?.runId, 'run:scope');
    // 冻结之后，跨锚点提交仍被拒。
    assert.throws(() => commitFactoryRewardReady('run:scope', 6, cards), /Factory reward changed/);
  });
});

test('a spent current held item does not reopen its baseline candidate slot', () => {
  withStorage(() => {
    // 1 号队员本场当前持有物已被消耗/拍落，但本局返还基准仍是 quick_claw。
    const saved = rewardSwapSave({
      runId: 'run:spent',
      stage: 3,
      playerItems: [null, 'quick_claw', null],
      spentIndices: [1],
    });
    persistSaveData(saved);
    const swapResume = storedResume();
    assert.equal(swapResume.playerTeam[1].factoryHeldItemId, undefined);
    assert.deepEqual(baselinesOf(swapResume.playerTeam), [null, 'quick_claw', null]);

    const pending = commitFactoryRewardPending('run:spent', 3, swapResume.playerTeam, false);
    assert.equal(pending.rewardCheckpoint?.status, 'PENDING');
    // 候选必须按「本局返还基准」重算 ⇒ quick_claw 仍视为在队，不放出重复卡。
    const candidates = enumerateFactoryRewardCandidates(baselinesOf(pending.playerTeam));
    assert.equal(candidates.includes('quick_claw'), false);
    assert.equal(candidates.length, FACTORY_REWARD_HELD_ITEM_IDS.length - 1);
    // 战斗中消耗态不得被提前返还：进入奖励节点时本场当前持有物保持不变。
    assert.equal(pending.playerTeam[1].factoryHeldItemId, undefined);

    const cards = candidates.slice(0, 4);
    const ready = commitFactoryRewardReady('run:spent', 3, cards).rewardCheckpoint;
    assert.equal(ready?.status, 'READY');
    if (ready?.status !== 'READY') return;
    assert.deepEqual(ready.cardItemIds, cards);
  });
});

test('winning the last battle of a set has no reward node and never restores items early', () => {
  withStorage(() => {
    // 组内第 7 战胜后没有「下一战的战前阶段」，因此不存在奖励节点。
    assert.equal(shouldEnterRewardAfterWinning(7), false);
    const saved = rewardSwapSave({
      runId: 'run:set-end',
      stage: 7,
      playerItems: [null, 'quick_claw', null],
      spentIndices: [1],
    });
    persistSaveData(saved);
    const endResume = storedResume();
    assert.throws(() => commitFactoryRewardPending('run:set-end', 7, endResume.playerTeam, false), /no reward checkpoint/);

    // 被拒之后不留痕：仍是换怪完成态，返还基准与消耗态都原样保留（不提前返还）。
    const untouched = storedResume();
    assert.equal(untouched.phase, 'FACTORY_SWAP');
    assert.equal(untouched.rewardCheckpoint, undefined);
    assert.deepEqual(baselinesOf(untouched.playerTeam), [null, 'quick_claw', null]);
    assert.equal(untouched.playerTeam[1].factoryHeldItemId, undefined);
  });
});

// --- 三人返还基准唯一性：全写入路径不变量（PRD 边界 + Orchestrator 裁决补遗一/二）-------------------

test('a duplicate-introducing swap after wins 1, 2, 4 and 5 is reconciled, never written as a duplicate team', () => {
  for (const stageNo of [1, 2, 4, 5]) {
    withStorage(() => {
      const runId = `run:swap-${stageNo}`;
      const saved = rewardSwapSave({
        runId,
        stage: stageNo,
        playerItems: ['quick_claw', null, null],
        enemyItems: [null, 'quick_claw', null],
      });
      persistSaveData(saved);
      const swapResume = storedResume();
      // 这些胜次都不是奖励锚点 ⇒ 走「普通换怪 + 起战」路径（旧实现完全没有守卫）。
      assert.equal(shouldEnterRewardAfterWinning(stageNo), false);
      // 冲突可见：UI 会禁用该组合（守卫已从「仅奖励前那一战」扩到每一次换怪）。
      assert.deepEqual(getFactorySwapEquippedItemConflict(swapResume.playerTeam, swapResume.enemyTeam, 2, 1), {
        itemId: 'quick_claw',
        retainedPlayerIndex: 0,
      });
      assert.equal(getFactorySwapEquippedItemConflict(swapResume.playerTeam, swapResume.enemyTeam, 2, 2), null);

      // 绕过 UI 直接提交受损队伍：可恢复、不抛错终止，且**落盘的是唯一队伍**。
      const duplicateSwapTeam = [swapResume.playerTeam[0], swapResume.playerTeam[1], swapResume.enemyTeam[1]];
      const started = commitFactoryBattleStart(runId, {
        stage: stageNo + 1,
        playerTeam: prepareFactoryPartyForBattle(duplicateSwapTeam),
        enemyTeam: swapResume.enemyTeam,
        currentEnemyTrainerId: swapResume.currentEnemyTrainerId,
        enemyAiTier: swapResume.enemyAiTier,
        specialBossBattleActive: false,
        swapped: true,
      });
      assert.equal(started.phase, 'BATTLE');
      assert.equal(started.heldItemBaselineRepaired, true);
      assert.equal(isFactoryHeldItemTeamUnique(started.playerTeam), true);
      assert.deepEqual(baselinesOf(started.playerTeam), ['quick_claw', null, null]);
      // 落盘内容同样唯一（回读校验）。
      assert.equal(isFactoryHeldItemTeamUnique(storedResume().playerTeam), true);
      // 原配未被改写 ⇒ 不静默侵占玩家资产。
      assert.equal(started.playerTeam[2].factoryOriginalHeldItemId, 'quick_claw');
    });
  }
});

test('the reward node still produces four cards for a team built by an earlier legal swap', () => {
  withStorage(() => {
    const runId = 'run:chain';
    // 组内第 1 胜后：合法换怪（换入成员的持有物与保留队员不重复）。
    const saved = rewardSwapSave({
      runId,
      stage: 1,
      playerItems: [null, null, null],
      enemyItems: [null, 'quick_claw', null],
    });
    persistSaveData(saved);
    const swapResume = storedResume();
    assert.equal(getFactorySwapEquippedItemConflict(swapResume.playerTeam, swapResume.enemyTeam, 0, 1), null);

    const swappedTeam = [swapResume.enemyTeam[1], swapResume.playerTeam[1], swapResume.playerTeam[2]];
    const started = commitFactoryBattleStart(runId, {
      stage: 2,
      playerTeam: prepareFactoryPartyForBattle(swappedTeam),
      enemyTeam: swapResume.enemyTeam,
      currentEnemyTrainerId: swapResume.currentEnemyTrainerId,
      enemyAiTier: swapResume.enemyAiTier,
      specialBossBattleActive: false,
      swapped: true,
    });
    assert.equal(started.phase, 'BATTLE');
    assert.equal(started.heldItemBaselineRepaired, undefined);
    assert.equal(isFactoryHeldItemTeamUnique(started.playerTeam), true);
    assert.deepEqual(baselinesOf(started.playerTeam), ['quick_claw', null, null]);

    // 推进到组内第 3 胜后的奖励锚点（换过怪的那支队伍继续打）。
    const afterStart = loadSaveData()!;
    const rewardResume: BattleResumeSnapshot = {
      ...started,
      stage: 3,
      phase: 'FACTORY_SWAP',
      roundResult: 'WIN',
      lastBpGain: 7,
    };
    persistSaveData({
      ...afterStart,
      runSupply: { runId, tickets: 2, lastCreditedStage: 3 },
      factory: { ...afterStart.factory, battleResume: rewardResume },
    });

    // 死于奖励节点的老问题不复现：照常出四张、逐张互异、不出现重复卡。
    const pending = commitFactoryRewardPending(runId, 3, rewardResume.playerTeam, false);
    assert.equal(pending.rewardCheckpoint?.status, 'PENDING');
    assert.equal(pending.heldItemBaselineRepaired, undefined);
    const candidates = enumerateFactoryRewardCandidates(baselinesOf(pending.playerTeam));
    assert.equal(candidates.includes('quick_claw'), false);
    const cards = candidates.slice(0, 4);
    assert.equal(cards.length, 4);
    assert.equal(new Set(cards).size, 4);
    assert.equal(commitFactoryRewardReady(runId, 3, cards).rewardCheckpoint?.status, 'READY');
  });
});

test('importing a save with duplicate baselines recovers with an honest notice instead of crashing', () => {
  withStorage(() => {
    const runId = 'run:dupe-import';
    // 直接构造「外部导入」的受损存档：两名队员持有同一件，数据层已落盘，UI 守卫无从拦截。
    const resume = buildLegacyReadyBattleResume({
      stage: 3,
      phase: 'REWARD',
      roundResult: 'WIN',
      lastBpGain: 7,
      coins: 0,
      playerTeam: [rewardMember(0, 'quick_claw'), rewardMember(1, 'quick_claw'), rewardMember(2, null)],
      enemyTeam: [rewardMember(0, null, 'enemy'), rewardMember(1, null, 'enemy'), rewardMember(2, null, 'enemy')],
      rewardCheckpoint: { runId, stage: 3, status: 'PENDING' },
    });
    const text = JSON.stringify({
      schemaVersion: 14,
      progress: { companionSpeciesId: 25 },
      wallet: { balance: 0, revision: 1, currentRunId: runId, brainSymbols: 0, settledThrough: 3 },
      runSupply: { runId, tickets: 0, lastCreditedStage: 3 },
      factory: { battleResume: resume },
    });

    // ① 同版导入不崩溃：不变量被修复，并如实打上标志。
    const imported = parseSaveDataFromText(text);
    assert.equal(imported.factory.battleResume.status, 'READY');
    const importedResume = imported.factory.battleResume;
    if (importedResume.status !== 'READY') return;
    assert.equal(importedResume.heldItemBaselineRepaired, true);
    assert.equal(isFactoryHeldItemTeamUnique(importedResume.playerTeam), true);
    assert.deepEqual(baselinesOf(importedResume.playerTeam), ['quick_claw', null, null]);
    // 原配没有被丢弃。
    assert.equal(importedResume.playerTeam[1].factoryOriginalHeldItemId, 'quick_claw');

    // ② 落盘 + 回读：任何写入路径都维持不变量，提示不丢失。
    replaceSaveData(imported);
    const reloaded = storedResume();
    assert.equal(isFactoryHeldItemTeamUnique(reloaded.playerTeam), true);
    assert.equal(reloaded.heldItemBaselineRepaired, true);

    // ③ 奖励节点不死路：这支「曾经重复」的队伍仍能出四张并正常领取。
    const cards = enumerateFactoryRewardCandidates(baselinesOf(reloaded.playerTeam)).slice(0, 4);
    assert.equal(commitFactoryRewardReady(runId, 3, cards).rewardCheckpoint?.status, 'READY');
    const claimed = commitFactoryItemRewardClaim(runId, 3, cards[0], 2);
    const claimedCheckpoint = claimed.rewardCheckpoint;
    if (claimedCheckpoint?.status !== 'CLAIMED') throw new Error('Expected a CLAIMED reward checkpoint.');
    assert.equal(claimedCheckpoint.claim.targetIndex, 2);
    assert.equal(isFactoryHeldItemTeamUnique(claimed.playerTeam), true);
  });
});

test('a claimed reward target keeps its item when the imported save is reconciled', () => {
  withStorage(() => {
    const runId = 'run:dupe-claimed';
    // CLAIMED 存档里领取目标（下标 2）与下标 0 重复：修复必须保留**领取目标**的基准。
    const resume = buildLegacyReadyBattleResume({
      stage: 3,
      phase: 'REWARD',
      roundResult: 'WIN',
      lastBpGain: 7,
      coins: 0,
      playerTeam: [
        // 下标 0 的原配是 leftovers，返还基准却也是 scope_lens（人为制造的重复基准）。
        { ...rewardMember(0, 'scope_lens'), factoryOriginalHeldItemId: 'leftovers' },
        rewardMember(1, null),
        { ...rewardMember(2, 'scope_lens'), factoryHeldItemId: 'scope_lens' },
      ],
      enemyTeam: [rewardMember(0, null, 'enemy'), rewardMember(1, null, 'enemy'), rewardMember(2, null, 'enemy')],
      rewardCheckpoint: {
        runId,
        stage: 3,
        status: 'CLAIMED',
        cardItemIds: ['scope_lens', 'quick_claw', 'kings_rock', 'choice_band'],
        claim: { itemId: 'scope_lens', targetIndex: 2 },
      },
    });
    const imported = parseSaveDataFromText(JSON.stringify({
      schemaVersion: 14,
      progress: { companionSpeciesId: 25 },
      wallet: { balance: 0, revision: 1, currentRunId: runId, brainSymbols: 0, settledThrough: 3 },
      runSupply: { runId, tickets: 0, lastCreditedStage: 3 },
      factory: { battleResume: resume },
    }));
    const restored = imported.factory.battleResume;
    assert.equal(restored.status, 'READY');
    if (restored.status !== 'READY') return;
    assert.equal(restored.heldItemBaselineRepaired, true);
    // 领取目标保留了自己刚领到的 scope_lens；重复由下标 0 让出。
    assert.equal(restored.rewardCheckpoint?.status, 'CLAIMED');
    assert.equal(restored.playerTeam[2].factoryEquippedHeldItemId, 'scope_lens');
    assert.deepEqual(baselinesOf(restored.playerTeam), ['leftovers', null, 'scope_lens']);
    assert.equal(isFactoryHeldItemTeamUnique(restored.playerTeam), true);
  });
});
