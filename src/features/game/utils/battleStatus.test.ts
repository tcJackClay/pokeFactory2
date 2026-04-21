import test from 'node:test';
import assert from 'node:assert/strict';

import type { GamePokemon, Stats, StatStages } from '../../../types';
import {
  clearNonVolatileStatus,
  clearVolatileStatus,
  getPrimaryBattleStatusId,
  normalizeBattleStatusId,
  rollConfusionTurns,
  rollSleepTurns,
  setNonVolatileStatus,
  setVolatileStatus,
} from './battleStatus';

const DEFAULT_STATS: Stats = {
  hp: 100,
  attack: 80,
  defense: 80,
  spAtk: 80,
  spDef: 80,
  speed: 80,
};

const DEFAULT_STAGES: StatStages = {
  attack: 0,
  defense: 0,
  spAtk: 0,
  spDef: 0,
  speed: 0,
  accuracy: 0,
  evasion: 0,
};

function createPokemon(overrides: Partial<GamePokemon> = {}): GamePokemon {
  return {
    id: 25,
    name: 'pikachu',
    sprites: {
      front_default: '',
      back_default: '',
    },
    stats: [],
    types: [{ type: { name: 'electric' } }],
    abilities: [],
    moves: [],
    currentHp: 100,
    maxHp: 100,
    selectedMoves: [],
    level: 50,
    nature: {
      name: 'hardy',
      zhName: 'Hardy',
      plus: 'attack',
      minus: 'attack',
    },
    ivs: DEFAULT_STATS,
    evs: DEFAULT_STATS,
    baseStats: DEFAULT_STATS,
    calculatedStats: DEFAULT_STATS,
    statStages: DEFAULT_STAGES,
    volatileStatuses: {},
    ...overrides,
  };
}

test('normalizeBattleStatusId maps aliases to canonical ids', () => {
  assert.equal(normalizeBattleStatusId('toxic'), 'bad_poison');
  assert.equal(normalizeBattleStatusId('paralyzed'), 'paralysis');
  assert.equal(normalizeBattleStatusId('badly-poisoned'), 'bad_poison');
});

test('rollSleepTurns follows the Gen 5+ inclusive 2-4 range', () => {
  assert.equal(rollSleepTurns(() => 0), 2);
  assert.equal(rollSleepTurns(() => 0.5), 3);
  assert.equal(rollSleepTurns(() => 0.999999), 4);
});

test('rollConfusionTurns follows the inclusive 2-5 range used by the reference project', () => {
  assert.equal(rollConfusionTurns(() => 0), 2);
  assert.equal(rollConfusionTurns(() => 0.5), 4);
  assert.equal(rollConfusionTurns(() => 0.999999), 5);
});

test('setNonVolatileStatus assigns default counters for sleep and toxic', () => {
  const sleepingPokemon = setNonVolatileStatus(createPokemon(), 'sleep', {}, () => 0.999999);
  const toxicPokemon = setNonVolatileStatus(createPokemon(), 'toxic');

  assert.deepEqual(sleepingPokemon.nonVolatileStatus, {
    id: 'sleep',
    turnsRemaining: 4,
    toxicCounter: undefined,
    sourceMoveName: undefined,
  });
  assert.deepEqual(toxicPokemon.nonVolatileStatus, {
    id: 'bad_poison',
    turnsRemaining: undefined,
    toxicCounter: 1,
    sourceMoveName: undefined,
  });
});

test('volatile statuses can be added, prioritized for display, and cleared independently', () => {
  const basePokemon = createPokemon();
  const confusedPokemon = setVolatileStatus(basePokemon, 'confusion', {}, () => 0.999999);
  const protectedPokemon = setVolatileStatus(confusedPokemon, 'protect');
  const tormentedPokemon = setVolatileStatus(protectedPokemon, 'torment', { linkedMoveName: 'slash' });

  assert.equal(getPrimaryBattleStatusId(tormentedPokemon), 'confusion');
  assert.equal(tormentedPokemon.volatileStatuses?.confusion?.turnsRemaining, 5);
  assert.equal(tormentedPokemon.volatileStatuses?.protect?.turnsRemaining, 1);
  assert.equal(tormentedPokemon.volatileStatuses?.torment?.turnsRemaining, 3);
  assert.equal(tormentedPokemon.volatileStatuses?.torment?.linkedMoveName, 'slash');

  const clearedPokemon = clearVolatileStatus(tormentedPokemon, 'confusion');
  assert.equal(getPrimaryBattleStatusId(clearedPokemon), 'torment');
});

test('non-volatile status takes precedence over volatile status and can be cleared cleanly', () => {
  const pokemon = setNonVolatileStatus(
    setVolatileStatus(createPokemon(), 'confusion'),
    'burn',
  );

  assert.equal(getPrimaryBattleStatusId(pokemon), 'burn');

  const clearedPokemon = clearNonVolatileStatus(pokemon);
  assert.equal(getPrimaryBattleStatusId(clearedPokemon), 'confusion');
});
