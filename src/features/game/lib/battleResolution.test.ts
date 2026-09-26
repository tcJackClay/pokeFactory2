import test from 'node:test';
import assert from 'node:assert/strict';

import type { GamePokemon, Move, MoveBattleData, Nature, Stats } from '../../../types';
import { applyMoveSecondaryEffects, applyStatusResidualDamage, applyWeatherChipDamage } from './battleResolution';
import { setNonVolatileStatus, setVolatileStatus } from '../utils/battleStatus';

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

test('applyMoveSecondaryEffects thaws a frozen target for an eligible move', () => {
  const move = createMove({
    name: 'flamethrower',
    type: 'fire',
    damage_class: 'special',
    battleData: createBattleData({ thawsTarget: true }),
  });
  const player = createPokemon(1, 'player');
  const enemy = setNonVolatileStatus(createPokemon(2, 'enemy'), 'freeze', { turnsRemaining: 3 });

  const result = applyMoveSecondaryEffects({
    move,
    actingSide: 'player',
    teams: { playerTeam: [player], enemyTeam: [enemy] },
    getLocalized: (pokemon) => pokemon.name,
    allowUserEffects: true,
    allowTargetEffects: true,
    random: () => 0,
  });

  assert.equal(result.enemyTeam[0].nonVolatileStatus, undefined);
  assert.ok(result.messages.some((message) => message.includes('thawed out')));
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

test('applyMoveSecondaryEffects applies Pokerogue status ability and weather interactions', () => {
  const makeStatusMove = (statusId: string) => createMove({
    name: statusId,
    damage_class: 'status',
    battleData: createBattleData({
      secondaryEffects: [{
        kind: statusId === 'confusion' ? 'volatile-status' : 'status',
        chance: 100,
        group: statusId,
        appliesTo: 'target',
        isPrimary: true,
        requiresHit: false,
        blockedBySubstitute: true,
        statusId,
      }],
    }),
  });
  const player = createPokemon(1, 'player');
  const resolve = (
    move: Move,
    enemy: GamePokemon,
    options: { fieldState?: ('misty_terrain')[]; weather?: 'sunny' } = {},
  ) => applyMoveSecondaryEffects({
    move,
    actingSide: 'player',
    teams: { playerTeam: [player], enemyTeam: [enemy] },
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
    ...options,
  });

  assert.equal(resolve(makeStatusMove('paralysis'), createPokemon(2, 'limber', {
    abilities: [{ ability: { name: 'limber', url: '' } }],
  })).enemyTeam[0].nonVolatileStatus, undefined);
  assert.equal(resolve(makeStatusMove('poison'), createPokemon(3, 'immune', {
    abilities: [{ ability: { name: 'immunity', url: '' } }],
  })).enemyTeam[0].nonVolatileStatus, undefined);
  assert.equal(resolve(makeStatusMove('burn'), createPokemon(4, 'water-veil', {
    abilities: [{ ability: { name: 'water-veil', url: '' } }],
  })).enemyTeam[0].nonVolatileStatus, undefined);
  assert.equal(resolve(makeStatusMove('freeze'), createPokemon(5, 'sun-target'), {
    weather: 'sunny',
  }).enemyTeam[0].nonVolatileStatus, undefined);
  assert.equal(resolve(makeStatusMove('confusion'), createPokemon(6, 'own-tempo', {
    abilities: [{ ability: { name: 'own-tempo', url: '' } }],
  })).enemyTeam[0].volatileStatuses?.confusion, undefined);
  assert.equal(resolve(makeStatusMove('confusion'), createPokemon(7, 'misty-target'), {
    fieldState: ['misty_terrain'],
  }).enemyTeam[0].volatileStatuses?.confusion, undefined);

  const moldBreakerResult = applyMoveSecondaryEffects({
    move: makeStatusMove('paralysis'),
    actingSide: 'player',
    teams: {
      playerTeam: [createPokemon(8, 'mold-breaker', {
        abilities: [{ ability: { name: 'mold-breaker', url: '' } }],
      })],
      enemyTeam: [createPokemon(9, 'limber', {
        abilities: [{ ability: { name: 'limber', url: '' } }],
      })],
    },
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
  });
  assert.equal(moldBreakerResult.enemyTeam[0].nonVolatileStatus?.id, 'paralysis');
});

test('applyMoveSecondaryEffects lets Corrosion poison Steel and blocks flinch with Inner Focus', () => {
  const poisonMove = createMove({
    name: 'toxic',
    damage_class: 'status',
    battleData: createBattleData({
      secondaryEffects: [{
        kind: 'status',
        chance: 100,
        group: 'poison',
        appliesTo: 'target',
        isPrimary: true,
        requiresHit: false,
        blockedBySubstitute: true,
        statusId: 'bad_poison',
      }],
    }),
  });
  const flinchMove = createMove({
    name: 'fake-out',
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
  const corrosionUser = createPokemon(1, 'corrosion-user', {
    abilities: [{ ability: { name: 'corrosion', url: '' } }],
  });
  const steelTarget = createPokemon(2, 'steel-target', {
    types: [{ type: { name: 'steel' } }],
  });
  const innerFocusTarget = createPokemon(3, 'inner-focus', {
    abilities: [{ ability: { name: 'inner-focus', url: '' } }],
  });

  const poisoned = applyMoveSecondaryEffects({
    move: poisonMove,
    actingSide: 'player',
    teams: { playerTeam: [corrosionUser], enemyTeam: [steelTarget] },
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
  });
  const notFlinched = applyMoveSecondaryEffects({
    move: flinchMove,
    actingSide: 'player',
    teams: { playerTeam: [corrosionUser], enemyTeam: [innerFocusTarget] },
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
  });

  assert.equal(poisoned.enemyTeam[0].nonVolatileStatus?.id, 'bad_poison');
  assert.equal(notFlinched.enemyTeam[0].volatileStatuses?.flinch, undefined);
  assert.equal(notFlinched.flinched, false);
});

test('applyMoveSecondaryEffects applies Pokerogue secondary-effect abilities and Synchronize', () => {
  const poisonEffect = {
    kind: 'status' as const,
    chance: 30,
    group: 'poison',
    appliesTo: 'target' as const,
    isPrimary: false,
    requiresHit: true,
    blockedBySubstitute: true,
    statusId: 'poison',
  };
  const move = createMove({ battleData: createBattleData({ secondaryEffects: [poisonEffect] }) });
  const sereneGraceUser = createPokemon(1, 'serene-grace', {
    abilities: [{ ability: { name: 'serene-grace', url: '' } }],
  });
  const sheerForceUser = createPokemon(2, 'sheer-force', {
    abilities: [{ ability: { name: 'sheer-force', url: '' } }],
  });
  const shieldDustTarget = createPokemon(3, 'shield-dust', {
    abilities: [{ ability: { name: 'shield-dust', url: '' } }],
  });

  const sereneGraceResult = applyMoveSecondaryEffects({
    move,
    actingSide: 'player',
    teams: { playerTeam: [sereneGraceUser], enemyTeam: [createPokemon(4, 'target')] },
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0.5,
  });
  const sheerForceResult = applyMoveSecondaryEffects({
    move,
    actingSide: 'player',
    teams: { playerTeam: [sheerForceUser], enemyTeam: [createPokemon(5, 'target')] },
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
  });
  const shieldDustResult = applyMoveSecondaryEffects({
    move,
    actingSide: 'player',
    teams: { playerTeam: [createPokemon(6, 'user')], enemyTeam: [shieldDustTarget] },
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
  });

  const synchronizeTarget = createPokemon(7, 'synchronize', {
    abilities: [{ ability: { name: 'synchronize', url: '' } }],
  });
  const synchronizeResult = applyMoveSecondaryEffects({
    move: createMove({
      name: 'poison-powder',
      damage_class: 'status',
      battleData: createBattleData({ secondaryEffects: [{ ...poisonEffect, chance: 100, isPrimary: true, requiresHit: false }] }),
    }),
    actingSide: 'player',
    teams: { playerTeam: [createPokemon(8, 'source')], enemyTeam: [synchronizeTarget] },
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
  });

  assert.equal(sereneGraceResult.enemyTeam[0].nonVolatileStatus?.id, 'poison');
  assert.equal(sheerForceResult.enemyTeam[0].nonVolatileStatus, undefined);
  assert.equal(shieldDustResult.enemyTeam[0].nonVolatileStatus, undefined);
  assert.equal(synchronizeResult.enemyTeam[0].nonVolatileStatus?.id, 'poison');
  assert.equal(synchronizeResult.playerTeam[0].nonVolatileStatus?.id, 'poison');
});

test('applyMoveSecondaryEffects aligns Safeguard and party status cures', () => {
  const healthyLead = createPokemon(1, 'lead');
  const burnedBench = setNonVolatileStatus(createPokemon(2, 'bench'), 'burn');
  const safeguard = createMove({
    name: 'safeguard',
    damage_class: 'status',
    battleData: createBattleData({ effectId: 'SAFEGUARD', target: 'user' }),
  });
  const safeguardResult = applyMoveSecondaryEffects({
    move: safeguard,
    actingSide: 'player',
    teams: { playerTeam: [healthyLead, burnedBench], enemyTeam: [createPokemon(3, 'enemy')] },
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
  });

  assert.equal(safeguardResult.playerTeam[0].volatileStatuses?.safeguard?.turnsRemaining, 5);
  assert.equal(safeguardResult.playerTeam[1].volatileStatuses?.safeguard?.turnsRemaining, 5);

  const blockedStatus = applyMoveSecondaryEffects({
    move: createMove({
      name: 'poison-powder',
      damage_class: 'status',
      battleData: createBattleData({ secondaryEffects: [{
        kind: 'status',
        chance: 100,
        appliesTo: 'target',
        isPrimary: true,
        statusId: 'poison',
      }] }),
    }),
    actingSide: 'enemy',
    teams: { playerTeam: safeguardResult.playerTeam, enemyTeam: [createPokemon(3, 'enemy')] },
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
  });
  assert.equal(blockedStatus.playerTeam[0].nonVolatileStatus, undefined);

  const cureResult = applyMoveSecondaryEffects({
    move: createMove({
      name: 'aromatherapy',
      damage_class: 'status',
      battleData: createBattleData({ effectId: 'PARTY_STATUS_CURE', target: 'user' }),
    }),
    actingSide: 'player',
    teams: {
      playerTeam: [setNonVolatileStatus(safeguardResult.playerTeam[0], 'poison'), safeguardResult.playerTeam[1]],
      enemyTeam: [createPokemon(3, 'enemy')],
    },
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
  });

  assert.equal(cureResult.playerTeam[0].nonVolatileStatus, undefined);
  assert.equal(cureResult.playerTeam[1].nonVolatileStatus, undefined);
});

test('applyMoveSecondaryEffects aligns screens, Pain Split, Belly Drum, and sunny Growth', () => {
  const player = createPokemon(1, 'player', { currentHp: 30 });
  const reserve = createPokemon(3, 'reserve');
  const enemy = createPokemon(2, 'enemy', { currentHp: 90 });
  const reflect = createMove({
    name: 'reflect',
    damage_class: 'status',
    battleData: createBattleData({ effectId: 'REFLECT', target: 'user' }),
  });
  const reflected = applyMoveSecondaryEffects({
    move: reflect,
    actingSide: 'player',
    teams: { playerTeam: [player, reserve], enemyTeam: [enemy] },
    getLocalized: (pokemon) => pokemon.name,
  });
  assert.equal(reflected.playerTeam.every((pokemon) => Boolean(pokemon.volatileStatuses?.reflect)), true);

  const brickBreak = createMove({
    name: 'brick-break',
    battleData: createBattleData({ effectId: 'BREAK_SCREENS' }),
  });
  const screensBroken = applyMoveSecondaryEffects({
    move: brickBreak,
    actingSide: 'enemy',
    teams: reflected,
    getLocalized: (pokemon) => pokemon.name,
  });
  assert.equal(screensBroken.playerTeam.some((pokemon) => Boolean(pokemon.volatileStatuses?.reflect)), false);

  const painSplit = applyMoveSecondaryEffects({
    move: createMove({
      name: 'pain-split',
      damage_class: 'status',
      battleData: createBattleData({ effectId: 'HP_SPLIT' }),
    }),
    actingSide: 'player',
    teams: { playerTeam: [player], enemyTeam: [enemy] },
    getLocalized: (pokemon) => pokemon.name,
  });
  assert.equal(painSplit.playerTeam[0].currentHp, 60);
  assert.equal(painSplit.enemyTeam[0].currentHp, 60);

  const bellyDrum = applyMoveSecondaryEffects({
    move: createMove({
      name: 'belly-drum',
      damage_class: 'status',
      battleData: createBattleData({ effectId: 'BELLY_DRUM', target: 'user' }),
    }),
    actingSide: 'player',
    teams: { playerTeam: [{ ...player, currentHp: 100 }], enemyTeam: [enemy] },
    getLocalized: (pokemon) => pokemon.name,
  });
  assert.equal(bellyDrum.playerTeam[0].currentHp, 50);
  assert.equal(bellyDrum.playerTeam[0].statStages.attack, 6);

  const growth = applyMoveSecondaryEffects({
    move: createMove({
      name: 'growth',
      damage_class: 'status',
      battleData: createBattleData({
        target: 'user',
        secondaryEffects: [
          { kind: 'stat-stage', chance: 100, appliesTo: 'user', isPrimary: true, stat: 'attack', change: 1 },
          { kind: 'stat-stage', chance: 100, appliesTo: 'user', isPrimary: true, stat: 'spAtk', change: 1 },
        ],
      }),
    }),
    actingSide: 'player',
    teams: { playerTeam: [player], enemyTeam: [enemy] },
    weather: 'sunny',
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
  });
  assert.equal(growth.playerTeam[0].statStages.attack, 2);
  assert.equal(growth.playerTeam[0].statStages.spAtk, 2);
});

test('applyMoveSecondaryEffects aligns Focus Energy, Foresight, Haze, and Psych Up', () => {
  const boostedEnemy = setVolatileStatus(createPokemon(2, 'enemy', {
    statStages: {
      attack: 3,
      defense: -1,
      spAtk: 2,
      spDef: 0,
      speed: 1,
      accuracy: 0,
      evasion: 4,
    },
  }), 'crit-boost', { counter: 2 });
  const player = createPokemon(1, 'player');
  const useMove = (move: Move, teams = { playerTeam: [player], enemyTeam: [boostedEnemy] }) => applyMoveSecondaryEffects({
    move,
    actingSide: 'player',
    teams,
    getLocalized: (pokemon) => pokemon.name,
  });

  const focused = useMove(createMove({
    name: 'focus-energy',
    damage_class: 'status',
    battleData: createBattleData({ effectId: 'FOCUS_ENERGY', target: 'user' }),
  }));
  assert.equal(focused.playerTeam[0].volatileStatuses?.crit_boost?.counter, 2);

  const exposed = useMove(createMove({
    name: 'foresight',
    damage_class: 'status',
    battleData: createBattleData({ effectId: 'FORESIGHT' }),
  }));
  assert.equal(exposed.enemyTeam[0].volatileStatuses?.foresight?.active, true);

  const copied = useMove(createMove({
    name: 'psych-up',
    damage_class: 'status',
    battleData: createBattleData({ effectId: 'PSYCH_UP' }),
  }));
  assert.deepEqual(copied.playerTeam[0].statStages, boostedEnemy.statStages);
  assert.equal(copied.playerTeam[0].volatileStatuses?.crit_boost?.active, true);

  const hazed = useMove(createMove({
    name: 'haze',
    damage_class: 'status',
    battleData: createBattleData({ effectId: 'HAZE', target: 'entire-field' }),
  }), copied);
  assert.equal(Object.values(hazed.playerTeam[0].statStages).every((stage) => stage === 0), true);
  assert.equal(Object.values(hazed.enemyTeam[0].statStages).every((stage) => stage === 0), true);
  assert.equal(hazed.playerTeam[0].volatileStatuses?.crit_boost, undefined);
  assert.equal(hazed.enemyTeam[0].volatileStatuses?.crit_boost, undefined);
});

test('applyMoveSecondaryEffects applies Pokerogue persistent volatile statuses', () => {
  const player = createPokemon(1, 'player');
  const enemy = createPokemon(2, 'enemy');
  const useMove = (move: Move, teams = { playerTeam: [player], enemyTeam: [enemy] }) => applyMoveSecondaryEffects({
    move,
    actingSide: 'player',
    teams,
    getLocalized: (pokemon) => pokemon.name,
    random: () => 0,
  });

  const seeded = useMove(createMove({
    name: 'leech-seed',
    damage_class: 'status',
    battleData: createBattleData({ effectId: 'LEECH_SEED' }),
  }));
  assert.equal(seeded.enemyTeam[0].volatileStatuses?.seeded?.active, true);

  const grassTarget = createPokemon(3, 'grass', { types: [{ type: { name: 'grass' } }] });
  const grassSeeded = useMove(createMove({
    name: 'leech-seed',
    damage_class: 'status',
    battleData: createBattleData({ effectId: 'LEECH_SEED' }),
  }), { playerTeam: [player], enemyTeam: [grassTarget] });
  assert.equal(grassSeeded.enemyTeam[0].volatileStatuses?.seeded, undefined);

  const trapped = useMove(createMove({
    name: 'bind',
    battleData: createBattleData({ effectId: 'DAMAGING_TRAP' }),
  }));
  assert.equal(trapped.enemyTeam[0].volatileStatuses?.trapped?.turnsRemaining, 4);

  const perishing = useMove(createMove({
    name: 'perish-song',
    damage_class: 'status',
    battleData: createBattleData({ effectId: 'PERISH_SONG', soundMove: true }),
  }));
  assert.equal(perishing.playerTeam[0].volatileStatuses?.perish_song?.counter, 3);
  assert.equal(perishing.enemyTeam[0].volatileStatuses?.perish_song?.counter, 3);

  const rooted = useMove(createMove({
    name: 'ingrain',
    damage_class: 'status',
    battleData: createBattleData({ effectId: 'INGRAIN', target: 'user' }),
  }));
  assert.equal(rooted.playerTeam[0].volatileStatuses?.ingrain?.active, true);
});

test('status residuals apply Pokerogue Magic Guard, Poison Heal, and Heatproof behavior', () => {
  const magicGuard = setNonVolatileStatus(createPokemon(1, 'magic-guard', {
    abilities: [{ ability: { name: 'magic-guard', url: '' } }],
  }), 'poison');
  const poisonHeal = setNonVolatileStatus(createPokemon(2, 'poison-heal', {
    currentHp: 50,
    abilities: [{ ability: { name: 'poison-heal', url: '' } }],
  }), 'bad_poison', { toxicCounter: 3 });
  const heatproof = setNonVolatileStatus(createPokemon(3, 'heatproof', {
    abilities: [{ ability: { name: 'heatproof', url: '' } }],
  }), 'burn');

  const magicGuardResult = applyStatusResidualDamage(magicGuard, (pokemon) => pokemon.name);
  const poisonHealResult = applyStatusResidualDamage(poisonHeal, (pokemon) => pokemon.name);
  const heatproofResult = applyStatusResidualDamage(heatproof, (pokemon) => pokemon.name);
  const weatherResult = applyWeatherChipDamage({
    pokemon: magicGuard,
    weather: 'sandstorm',
    getLocalized: (pokemon) => pokemon.name,
  });

  assert.equal(magicGuardResult.pokemon.currentHp, 100);
  assert.equal(poisonHealResult.pokemon.currentHp, 62);
  assert.equal(poisonHealResult.pokemon.nonVolatileStatus?.toxicCounter, 4);
  assert.equal(heatproofResult.pokemon.currentHp, 97);
  assert.equal(weatherResult.pokemon.currentHp, 100);
});

test('weather residuals apply Pokerogue immunity, healing, and ability chip', () => {
  const localize = (pokemon: GamePokemon) => pokemon.name;
  const sandVeil = createPokemon(1, 'sand-veil', {
    abilities: [{ ability: { name: 'sand-veil', url: '' } }],
  });
  const rainDish = createPokemon(2, 'rain-dish', {
    currentHp: 50,
    abilities: [{ ability: { name: 'rain-dish', url: '' } }],
  });
  const solarPower = createPokemon(3, 'solar-power', {
    abilities: [{ ability: { name: 'solar-power', url: '' } }],
  });

  assert.equal(applyWeatherChipDamage({ pokemon: sandVeil, weather: 'sandstorm', getLocalized: localize }).pokemon.currentHp, 100);
  assert.equal(applyWeatherChipDamage({ pokemon: rainDish, weather: 'rainy', getLocalized: localize }).pokemon.currentHp, 56);
  assert.equal(applyWeatherChipDamage({ pokemon: solarPower, weather: 'sunny', getLocalized: localize }).pokemon.currentHp, 88);
});
