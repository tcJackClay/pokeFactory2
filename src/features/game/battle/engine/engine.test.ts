import test from 'node:test';
import assert from 'node:assert/strict';

import type { GamePokemon, Move, Nature, Stats } from '../../../../types';
import type { BattleSnapshot } from './types';
import { resolveBeforeMoveChecks } from './resolveBeforeMoveChecks';
import { resolveEndTurn } from './resolveEndTurn';
import { setNonVolatileStatus, setVolatileStatus } from '../../utils/battleStatus';

const DEFAULT_NATURE: Nature = {
  name: 'hardy',
  zhName: 'Hardy',
  plus: 'attack',
  minus: 'attack',
};

const DEFAULT_STATS: Stats = {
  hp: 100,
  attack: 80,
  defense: 70,
  spAtk: 80,
  spDef: 70,
  speed: 60,
};

function createMove(overrides: Partial<Move> = {}): Move {
  return {
    name: 'tackle',
    power: 40,
    accuracy: 100,
    type: 'normal',
    damage_class: 'physical',
    pp: 35,
    currentPp: 35,
    ...overrides,
  };
}

function createPokemon(id: number, name: string, overrides: Partial<GamePokemon> = {}): GamePokemon {
  return {
    id,
    name,
    sprites: {
      front_default: '',
      back_default: '',
    },
    stats: [
      { base_stat: 100, stat: { name: 'hp' } },
      { base_stat: 80, stat: { name: 'attack' } },
      { base_stat: 70, stat: { name: 'defense' } },
      { base_stat: 80, stat: { name: 'special-attack' } },
      { base_stat: 70, stat: { name: 'special-defense' } },
      { base_stat: 60, stat: { name: 'speed' } },
    ],
    types: [{ type: { name: 'normal' } }],
    abilities: [{ ability: { name: 'run-away', url: '' } }],
    moves: [{ move: { name: 'tackle', url: '' } }],
    currentHp: 100,
    maxHp: 100,
    selectedMoves: [createMove()],
    level: 50,
    nature: DEFAULT_NATURE,
    ivs: DEFAULT_STATS,
    evs: DEFAULT_STATS,
    baseStats: DEFAULT_STATS,
    calculatedStats: DEFAULT_STATS,
    statStages: {
      attack: 0,
      defense: 0,
      spAtk: 0,
      spDef: 0,
      speed: 0,
      accuracy: 0,
      evasion: 0,
    },
    volatileStatuses: {},
    ...overrides,
  };
}

function createSnapshot(overrides: Partial<BattleSnapshot> = {}): BattleSnapshot {
  return {
    playerTeam: [createPokemon(1, 'player-mon')],
    enemyTeam: [createPokemon(2, 'enemy-mon')],
    weather: 'none',
    weatherTurns: 0,
    fieldState: [],
    fieldTurns: {},
    ...overrides,
  };
}

test('resolveBeforeMoveChecks decrements sleep and blocks ordinary move use', () => {
  const sleepingPokemon = createPokemon(1, 'sleeper', {
    nonVolatileStatus: {
      id: 'sleep',
      turnsRemaining: 3,
    },
  });
  const snapshot = createSnapshot({
    playerTeam: [sleepingPokemon],
  });

  const result = resolveBeforeMoveChecks({
    snapshot,
    side: 'player',
    combatant: sleepingPokemon,
    move: createMove(),
    displayName: 'Sleeper',
    hasAbilityEffect: () => false,
    isMoveUsableWhileAsleep: () => false,
    getEncoredMove: () => null,
    getMoveCurrentPp: (move) => move.currentPp ?? move.pp ?? 0,
    tryConsumeStatusCureBerry: (pokemon) => ({ pokemon, message: null }),
    tryConsumeMentalHerb: (pokemon) => ({ pokemon, message: null }),
    calculateConfusionSelfHitDamage: () => 10,
    random: () => 0.9,
  });

  assert.equal(result.canAct, false);
  assert.equal(result.nextTurn, 'ENEMY');
  assert.equal(result.combatant.nonVolatileStatus?.turnsRemaining, 2);
  assert.equal(result.events[0]?.type, 'message');
});

test('resolveBeforeMoveChecks clears stale infatuation links without blocking the move', () => {
  const infatuatedPokemon = createPokemon(1, 'infatuated', {
    volatileStatuses: {
      infatuation: {
        id: 'infatuation',
        active: true,
        linkedPokemonId: 999,
      },
    },
  });
  const snapshot = createSnapshot({
    playerTeam: [infatuatedPokemon],
    enemyTeam: [createPokemon(2, 'enemy')],
  });

  const result = resolveBeforeMoveChecks({
    snapshot,
    side: 'player',
    combatant: infatuatedPokemon,
    move: createMove(),
    displayName: 'Infatuated',
    hasAbilityEffect: () => false,
    isMoveUsableWhileAsleep: () => false,
    getEncoredMove: () => null,
    getMoveCurrentPp: (move) => move.currentPp ?? move.pp ?? 0,
    tryConsumeStatusCureBerry: (pokemon) => ({ pokemon, message: null }),
    tryConsumeMentalHerb: (pokemon) => ({ pokemon, message: null }),
    calculateConfusionSelfHitDamage: () => 10,
    random: () => 0.9,
  });

  assert.equal(result.canAct, true);
  assert.equal(result.combatant.volatileStatuses?.infatuation, undefined);
});

test('resolveEndTurn applies poison damage before leftovers recovery', () => {
  const poisonedPokemon = createPokemon(1, 'poisoned', {
    currentHp: 80,
    factoryHeldItemId: 'leftovers',
  });
  const snapshot = createSnapshot({
    playerTeam: [setNonVolatileStatus(poisonedPokemon, 'poison', {
      sourceMoveName: 'poison-powder',
    })],
  });

  const result = resolveEndTurn({
    snapshot,
    getLocalized: (pokemon) => pokemon.name,
    formatDynamaxEndMessage: (pokemon) => `${pokemon.name} shrank back down.`,
    getMoveCurrentPp: (move) => move.currentPp ?? move.pp ?? 0,
    tryActivateSitrusBerry: (pokemon) => ({ pokemon, message: null }),
    tryActivatePinchStatBerry: (pokemon) => ({ pokemon, message: null }),
  });

  assert.equal(result.snapshot.playerTeam[0].currentHp, 74);
});

test('resolveEndTurn increments toxic counter at end of turn', () => {
  const badlyPoisonedPokemon = createPokemon(1, 'toxic', {
    currentHp: 100,
  });
  const snapshot = createSnapshot({
    playerTeam: [setNonVolatileStatus(badlyPoisonedPokemon, 'bad_poison', {
      toxicCounter: 2,
      sourceMoveName: 'toxic',
    })],
  });

  const result = resolveEndTurn({
    snapshot,
    getLocalized: (pokemon) => pokemon.name,
    formatDynamaxEndMessage: (pokemon) => `${pokemon.name} shrank back down.`,
    getMoveCurrentPp: (move) => move.currentPp ?? move.pp ?? 0,
    tryActivateSitrusBerry: (pokemon) => ({ pokemon, message: null }),
    tryActivatePinchStatBerry: (pokemon) => ({ pokemon, message: null }),
  });

  assert.equal(result.snapshot.playerTeam[0].currentHp, 88);
  assert.equal(result.snapshot.playerTeam[0].nonVolatileStatus?.toxicCounter, 3);
});

test('resolveEndTurn wakes sleeping battlers during uproar after yawn processing', () => {
  const sleepingPlayer = setNonVolatileStatus(createPokemon(1, 'sleeper'), 'sleep', {
    turnsRemaining: 2,
  });
  const uproaringEnemy = setVolatileStatus(createPokemon(2, 'uproar-user'), 'uproar', {
    turnsRemaining: 3,
    linkedMoveName: 'uproar',
  });
  const snapshot = createSnapshot({
    playerTeam: [sleepingPlayer],
    enemyTeam: [uproaringEnemy],
  });

  const result = resolveEndTurn({
    snapshot,
    getLocalized: (pokemon) => pokemon.name,
    formatDynamaxEndMessage: (pokemon) => `${pokemon.name} shrank back down.`,
    getMoveCurrentPp: (move) => move.currentPp ?? move.pp ?? 0,
    tryActivateSitrusBerry: (pokemon) => ({ pokemon, message: null }),
    tryActivatePinchStatBerry: (pokemon) => ({ pokemon, message: null }),
  });

  assert.equal(result.snapshot.playerTeam[0].nonVolatileStatus, undefined);
  assert.equal(result.snapshot.enemyTeam[0].volatileStatuses?.uproar?.turnsRemaining, 2);
});
