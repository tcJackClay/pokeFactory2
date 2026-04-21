import test from 'node:test';
import assert from 'node:assert/strict';

import type { GamePokemon, Move, MoveBattleData, Nature, Stats } from '../../../../types';
import { getMoveStrikeBasePower, resolveMoveStrikePlan } from './resolveMoveStrikes';

const DEFAULT_NATURE: Nature = {
  name: 'hardy',
  zhName: 'Hardy',
  plus: 'attack',
  minus: 'attack',
};

const DEFAULT_STATS: Stats = {
  hp: 100,
  attack: 100,
  defense: 100,
  spAtk: 100,
  spDef: 100,
  speed: 100,
};

function createBattleData(overrides: Partial<MoveBattleData> = {}): MoveBattleData {
  return {
    effectId: 'NONE',
    priority: 0,
    target: 'selected-pokemon',
    flags: [],
    critStage: 0,
    drainPercent: 0,
    recoilPercent: 0,
    healingPercent: 0,
    strikeMode: 'single',
    minHits: 1,
    maxHits: 1,
    secondaryEffects: [],
    substituteInteraction: 'blocked',
    makesContact: false,
    soundMove: false,
    powderMove: false,
    ballisticMove: false,
    punchMove: false,
    bypassProtect: false,
    ignoreAccuracyCheck: false,
    ...overrides,
  };
}

function createMove(overrides: Partial<Move> = {}): Move {
  return {
    name: 'neutral-hit',
    power: 10,
    accuracy: 90,
    type: 'normal',
    damage_class: 'physical',
    battleData: createBattleData(overrides.battleData),
    ...overrides,
  };
}

function createPokemon(overrides: Partial<GamePokemon> = {}): GamePokemon {
  return {
    id: 1,
    name: 'attacker',
    sprites: { front_default: '', back_default: '' },
    stats: [
      { base_stat: 100, stat: { name: 'hp' } },
      { base_stat: 100, stat: { name: 'attack' } },
      { base_stat: 100, stat: { name: 'defense' } },
      { base_stat: 100, stat: { name: 'special-attack' } },
      { base_stat: 100, stat: { name: 'special-defense' } },
      { base_stat: 100, stat: { name: 'speed' } },
    ],
    types: [{ type: { name: 'normal' } }],
    baseTypes: [{ type: { name: 'normal' } }],
    abilities: [{ ability: { name: 'run-away', url: '' } }],
    moves: [{ move: { name: 'neutral-hit', url: '' } }],
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
    factoryLastUsedMoveName: null,
    ...overrides,
  };
}

test('resolveMoveStrikePlan uses weighted 2-5 rolls, loaded dice, and skill link', () => {
  const move = createMove({
    battleData: createBattleData({
      strikeMode: 'multi-hit',
      minHits: 2,
      maxHits: 5,
    }),
  });

  assert.equal(resolveMoveStrikePlan({
    move,
    attacker: createPokemon(),
    random: () => 0.34,
  }).plannedHits, 2);
  assert.equal(resolveMoveStrikePlan({
    move,
    attacker: createPokemon({
      factoryHeldItemId: 'loaded-dice',
    }),
    random: () => 0.9,
  }).plannedHits, 5);
  assert.equal(resolveMoveStrikePlan({
    move,
    attacker: createPokemon({
      abilities: [{ ability: { name: 'skill-link', url: '' } }],
    }),
    random: () => 0,
  }).plannedHits, 5);
});

test('resolveMoveStrikePlan exposes independent-accuracy modes and progressive strike power', () => {
  const tripleKick = createMove({
    battleData: createBattleData({
      effectId: 'TRIPLE_KICK',
      strikeMode: 'progressive-multi-hit',
      minHits: 3,
      maxHits: 3,
      guaranteedHits: 3,
    }),
  });
  const populationBomb = createMove({
    battleData: createBattleData({
      effectId: 'POPULATION_BOMB',
      strikeMode: 'multi-hit-per-accuracy',
      minHits: 10,
      maxHits: 10,
      guaranteedHits: 10,
    }),
  });

  assert.equal(resolveMoveStrikePlan({
    move: tripleKick,
    attacker: createPokemon(),
  }).usesIndependentAccuracy, true);
  assert.equal(resolveMoveStrikePlan({
    move: populationBomb,
    attacker: createPokemon(),
  }).usesIndependentAccuracy, true);
  assert.equal(getMoveStrikeBasePower(tripleKick, 0), 10);
  assert.equal(getMoveStrikeBasePower(tripleKick, 1), 20);
  assert.equal(getMoveStrikeBasePower(tripleKick, 2), 30);
});
