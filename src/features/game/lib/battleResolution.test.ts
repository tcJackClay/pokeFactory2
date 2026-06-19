import test from 'node:test';
import assert from 'node:assert/strict';

import type { GamePokemon, Move, MoveBattleData, Nature, Stats } from '../../../types';
import { applyMoveSecondaryEffects } from './battleResolution';
import { setVolatileStatus } from '../utils/battleStatus';

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
    power: 90,
    accuracy: 100,
    type: 'normal',
    damage_class: 'physical',
    battleData: createBattleData(overrides.battleData),
    ...overrides,
  };
}

function createPokemon(id: number, name: string, overrides: Partial<GamePokemon> = {}): GamePokemon {
  return {
    id,
    name,
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

test('applyMoveSecondaryEffects keeps user-side drops when the target is behind substitute', () => {
  const move = createMove({
    name: 'overheat',
    type: 'fire',
    damage_class: 'special',
    battleData: createBattleData({
      secondaryEffects: [{
        kind: 'stat-stage',
        chance: 100,
        group: 'overheat-drop',
        appliesTo: 'user',
        isPrimary: true,
        requiresHit: true,
        blockedBySubstitute: false,
        stat: 'spAtk',
        change: -2,
      }],
    }),
  });
  const player = createPokemon(1, 'player');
  const enemy = setVolatileStatus(createPokemon(2, 'enemy'), 'substitute', {
    counter: 25,
  });

  const result = applyMoveSecondaryEffects({
    move,
    actingSide: 'player',
    teams: {
      playerTeam: [player],
      enemyTeam: [enemy],
    },
    getLocalized: (pokemon) => pokemon.name,
    allowUserEffects: true,
    allowTargetEffects: false,
    random: () => 0,
  });

  assert.equal(result.playerTeam[0].statStages.spAtk, -2);
  assert.equal(result.enemyTeam[0].statStages.spAtk, 0);
});

test('applyMoveSecondaryEffects only flinches targets that have not acted yet', () => {
  const move = createMove({
    name: 'headbutt',
    battleData: createBattleData({
      secondaryEffects: [{
        kind: 'flinch',
        chance: 100,
        group: 'flinch',
        appliesTo: 'target',
        isPrimary: false,
        requiresHit: true,
        blockedBySubstitute: true,
        statusId: 'flinch',
      }],
    }),
  });
  const player = createPokemon(1, 'player');
  const enemy = createPokemon(2, 'enemy');

  const result = applyMoveSecondaryEffects({
    move,
    actingSide: 'player',
    teams: {
      playerTeam: [player],
      enemyTeam: [enemy],
    },
    getLocalized: (pokemon) => pokemon.name,
    targetHasActedThisTurn: true,
    random: () => 0,
  });

  assert.equal(result.enemyTeam[0].volatileStatuses?.flinch, undefined);
  assert.equal(result.flinched, false);
});

test('applyMoveSecondaryEffects rolls grouped stat boosts once for ancient-power style effects', () => {
  const move = createMove({
    name: 'ancient-power',
    type: 'rock',
    damage_class: 'special',
    battleData: createBattleData({
      secondaryEffects: [
        { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', requiresHit: true, blockedBySubstitute: false, stat: 'attack', change: 1 },
        { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', requiresHit: true, blockedBySubstitute: false, stat: 'defense', change: 1 },
        { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', requiresHit: true, blockedBySubstitute: false, stat: 'spAtk', change: 1 },
        { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', requiresHit: true, blockedBySubstitute: false, stat: 'spDef', change: 1 },
        { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', requiresHit: true, blockedBySubstitute: false, stat: 'speed', change: 1 },
      ],
    }),
  });
  const player = createPokemon(1, 'player');
  const enemy = createPokemon(2, 'enemy');

  const result = applyMoveSecondaryEffects({
    move,
    actingSide: 'player',
    teams: {
      playerTeam: [player],
      enemyTeam: [enemy],
    },
    getLocalized: (pokemon) => pokemon.name,
    allowUserEffects: true,
    allowTargetEffects: false,
    random: () => 0.05,
  });

  assert.deepEqual(result.playerTeam[0].statStages, {
    attack: 1,
    defense: 1,
    spAtk: 1,
    spDef: 1,
    speed: 1,
    accuracy: 0,
    evasion: 0,
  });
});

test('applyMoveSecondaryEffects respects type and terrain status immunities', () => {
  const thunderWave = createMove({
    name: 'thunder-wave',
    type: 'electric',
    damage_class: 'status',
    battleData: createBattleData({
      secondaryEffects: [{
        kind: 'status',
        chance: 100,
        group: 'paralysis',
        appliesTo: 'target',
        isPrimary: true,
        requiresHit: false,
        blockedBySubstitute: true,
        statusId: 'paralysis',
      }],
    }),
  });
  const spore = createMove({
    name: 'spore',
    type: 'grass',
    damage_class: 'status',
    battleData: createBattleData({
      powderMove: true,
      secondaryEffects: [{
        kind: 'status',
        chance: 100,
        group: 'sleep',
        appliesTo: 'target',
        isPrimary: true,
        requiresHit: false,
        blockedBySubstitute: true,
        statusId: 'sleep',
      }],
    }),
  });
  const player = createPokemon(1, 'player');
  const electricEnemy = createPokemon(2, 'electric-enemy', {
    types: [{ type: { name: 'electric' } }],
  });
  const groundedEnemy = createPokemon(3, 'grounded-enemy');
  const groundEnemy = createPokemon(4, 'ground-enemy', {
    types: [{ type: { name: 'ground' } }],
  });

  const electricResult = applyMoveSecondaryEffects({
    move: thunderWave,
    actingSide: 'player',
    teams: {
      playerTeam: [player],
      enemyTeam: [electricEnemy],
    },
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
  });
  const terrainResult = applyMoveSecondaryEffects({
    move: spore,
    actingSide: 'player',
    teams: {
      playerTeam: [player],
      enemyTeam: [groundedEnemy],
    },
    fieldState: ['electric_terrain'],
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
  });
  const groundResult = applyMoveSecondaryEffects({
    move: thunderWave,
    actingSide: 'player',
    teams: {
      playerTeam: [player],
      enemyTeam: [groundEnemy],
    },
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
  });

  assert.equal(electricResult.enemyTeam[0].nonVolatileStatus, undefined);
  assert.equal(terrainResult.enemyTeam[0].nonVolatileStatus, undefined);
  assert.equal(groundResult.enemyTeam[0].nonVolatileStatus, undefined);
});
