import test from 'node:test';
import assert from 'node:assert/strict';

import { selectFactoryTrainerTemplate } from '../config/factoryTrainerTemplates';
import {
  createEmptyBattleResume,
  createEmptyWallet,
  createSaveData,
  loadSaveData,
  persistSaveData,
  type GameSaveData,
} from '../../../services/saveManager';
import { hydrateTrainerHistoryOnce } from './factoryTrainerHistory';

test('trainer history survives rerenders and refresh, excluding a trainer already used in the set', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { storage.set(key, value); },
        removeItem: (key: string) => { storage.delete(key); },
      },
    },
  });

  try {
    let usedBySet = new Map<number, Set<string>>();
    const importHistory = (history: GameSaveData['factory']['trainerIdsBySet']) => {
      usedBySet = new Map(history.map(({ setNo, trainerIds }) => [setNo, new Set(trainerIds)]));
    };
    const initialHistory: GameSaveData['factory']['trainerIdsBySet'] = [];
    const hydrated = { current: false };
    hydrateTrainerHistoryOnce(hydrated, initialHistory, importHistory);

    const firstTrainer = selectFactoryTrainerTemplate({
      challengeNum: 1,
      isBoss: false,
      isSpecialUnlockBoss: false,
      usedTrainerIds: usedBySet.get(1),
    });
    usedBySet.set(1, new Set([firstTrainer.id]));

    // The startup effect may run again, but cannot replace the newly recorded trainer.
    hydrateTrainerHistoryOnce(hydrated, initialHistory, importHistory);
    assert.deepEqual([...usedBySet.get(1)!], [firstTrainer.id]);

    persistSaveData(createSaveData({
      wallet: createEmptyWallet(),
      runSupply: { runId: null, tickets: 0, lastCreditedStage: 0 },
      companionSpeciesId: null,
      totalRents: 0,
      highestStreak: 0,
      specialModeUnlocked: false,
      currentLanguage: 'zh-hans',
      selectedGens: [1],
      startLevel: 50,
      developerMode: false,
      factory: {
        challengeStatus: 1,
        curChallengeBattleNum: 1,
        challengePaused: false,
        disableRecordBattle: false,
        winStreakActiveFlags: 0,
        winStreakActiveMasks: 0,
        trainerIdsBySet: [{ setNo: 1, trainerIds: [...usedBySet.get(1)!] }],
        battleResume: createEmptyBattleResume(),
      },
      collection: { seenIds: [], ownedIds: [], formKeys: [] },
      events: { speciesBattleCounts: {}, dispatchPokemonByRegion: {}, dispatches: {} },
    }));

    const restoredHistory = loadSaveData()?.factory.trainerIdsBySet ?? [];
    const afterRefresh = { current: false };
    usedBySet = new Map();
    hydrateTrainerHistoryOnce(afterRefresh, restoredHistory, importHistory);
    assert.deepEqual([...usedBySet.get(1)!], [firstTrainer.id]);

    const nextTrainer = selectFactoryTrainerTemplate({
      challengeNum: 1,
      isBoss: false,
      isSpecialUnlockBoss: false,
      usedTrainerIds: usedBySet.get(1),
    });
    assert.notEqual(nextTrainer.id, firstTrainer.id);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
