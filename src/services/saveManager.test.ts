import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSaveDataFromText } from './saveManager';

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

test('parseSaveDataFromText migrates legacy pokemon status fields into the new battle status model', () => {
  const parsed = parseSaveDataFromText(JSON.stringify({
    schemaVersion: 6,
    progress: { totalRents: 12, highestStreak: 4, specialModeUnlocked: true },
    settings: { currentLanguage: 'zh-hans', selectedGens: [1, 2], startLevel: 50, developerMode: false },
    factory: {
      challengeStatus: 1,
      curChallengeBattleNum: 2,
      challengePaused: true,
      disableRecordBattle: false,
      winStreakActiveFlags: 0,
      winStreakActiveMasks: 0xffffffff,
      trainerIdsBySet: [],
      battleResume: buildLegacyReadyBattleResume(),
    },
    collection: { seenIds: [], ownedIds: [], formKeys: [] },
    events: { speciesBattleCounts: {}, dispatchPokemonByRegion: {}, dispatches: {} },
  }));

  assert.equal(parsed.schemaVersion, 7);
  assert.equal(parsed.factory.battleResume.status, 'READY');
  if (parsed.factory.battleResume.status !== 'READY') {
    assert.fail('battle resume should be ready after migration');
  }
  assert.equal(parsed.factory.battleResume.playerTeam[0].nonVolatileStatus?.id, 'sleep');
  assert.equal(parsed.factory.battleResume.playerTeam[0].baseTypes?.[0]?.type.name, 'electric');
  assert.equal(parsed.factory.battleResume.playerTeam[0].factoryChoiceLockedMoveName, null);
  assert.equal(parsed.factory.battleResume.enemyTeam[0].volatileStatuses?.confusion?.turnsRemaining, 2);
});

test('parseSaveDataFromText safely drops only invalid battle resumes without losing broader save progress', () => {
  const parsed = parseSaveDataFromText(JSON.stringify({
    schemaVersion: 6,
    progress: { totalRents: 99, highestStreak: 11, specialModeUnlocked: true },
    settings: { currentLanguage: 'en', selectedGens: [3], startLevel: 50, developerMode: true },
    factory: {
      challengeStatus: 1,
      curChallengeBattleNum: 2,
      challengePaused: true,
      disableRecordBattle: false,
      winStreakActiveFlags: 0,
      winStreakActiveMasks: 0xffffffff,
      trainerIdsBySet: [],
      battleResume: {
        status: 'READY',
        battleKind: 'FACTORY',
        stage: 0,
        playerTeam: [],
        enemyTeam: [],
      },
    },
    collection: { seenIds: [25], ownedIds: [25], formKeys: [] },
    events: { speciesBattleCounts: { '25': 3 }, dispatchPokemonByRegion: {}, dispatches: {} },
  }));

  assert.equal(parsed.schemaVersion, 7);
  assert.equal(parsed.progress.totalRents, 99);
  assert.equal(parsed.progress.highestStreak, 11);
  assert.equal(parsed.settings.developerMode, true);
  assert.equal(parsed.collection.ownedIds[0], 25);
  assert.equal(parsed.factory.battleResume.status, 'EMPTY');
});
