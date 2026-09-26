import test from 'node:test';
import assert from 'node:assert/strict';

import type { GamePokemon, Move, Nature, Stats } from '../../../../types';
import type { BattleSnapshot } from './types';
import { resolveBeforeMoveChecks } from './resolveBeforeMoveChecks';
import { resolveEndTurn } from './resolveEndTurn';
import { resolveActionSelection } from './resolveActionSelection';
import { isRepeatFieldFailure, nextFieldStates, nextFieldTurns } from './fieldEffectTransition';
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
    tailwindTurns: { player: 0, enemy: 0 },
    ...overrides,
  };
}

test('Tailwind counts down both sides independently and survives a switch', () => {
  const reserve = createPokemon(3, 'reserve');
  let snapshot = createSnapshot({
    playerTeam: [createPokemon(1, 'player'), reserve],
    tailwindTurns: { player: 4, enemy: 2 },
  });
  const options = {
    getLocalized: (pokemon: GamePokemon) => pokemon.name,
    formatDynamaxEndMessage: (pokemon: GamePokemon) => `${pokemon.name} shrank back down.`,
    getMoveCurrentPp: (move: Move) => move.currentPp ?? move.pp ?? 0,
    tryActivateSitrusBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
    tryActivatePinchStatBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
  };
  for (let turn = 1; turn <= 4; turn += 1) {
    if (turn === 2) snapshot = { ...snapshot, playerTeam: [snapshot.playerTeam[1], snapshot.playerTeam[0]] };
    snapshot = resolveEndTurn({ ...options, snapshot }).snapshot;
    assert.deepEqual(snapshot.tailwindTurns, { player: 4 - turn, enemy: Math.max(0, 2 - turn) });
    if (turn >= 2) assert.equal(snapshot.playerTeam[0].id, reserve.id);
  }
});

test('snow has no chip, survives switching, and expires after five end turns', () => {
  const player = createPokemon(1, 'player');
  const reserve = createPokemon(3, 'reserve');
  const options = {
    getLocalized: (pokemon: GamePokemon) => pokemon.name,
    formatDynamaxEndMessage: (pokemon: GamePokemon) => `${pokemon.name} shrank back down.`,
    getMoveCurrentPp: (move: Move) => move.currentPp ?? move.pp ?? 0,
    tryActivateSitrusBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
    tryActivatePinchStatBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
  };
  let snapshot = createSnapshot({ playerTeam: [player, reserve], weather: 'snow', weatherTurns: 5 });
  for (let turn = 1; turn <= 5; turn += 1) {
    if (turn === 2) snapshot = { ...snapshot, playerTeam: [snapshot.playerTeam[1], snapshot.playerTeam[0]] };
    const result = resolveEndTurn({ ...options, snapshot });
    snapshot = result.snapshot;
    assert.equal(snapshot.weather, turn === 5 ? 'none' : 'snow');
    assert.equal(snapshot.weatherTurns, 5 - turn);
    assert.equal(snapshot.playerTeam[0].currentHp, 100);
    assert.equal(snapshot.enemyTeam[0].currentHp, 100);
  }
});

test('Trick Room toggles off without a timer and restores actual speed order', () => {
  const slow = createPokemon(1, 'slow', { calculatedStats: { ...DEFAULT_STATS, speed: 40 } });
  const fast = createPokemon(2, 'fast', { calculatedStats: { ...DEFAULT_STATS, speed: 80 } });
  const move = createMove();
  const enemyActsFirst = (fieldState: BattleSnapshot['fieldState']) => resolveActionSelection({
    playerPokemon: slow, playerMove: move, enemyPokemon: fast, enemyMove: move,
    fieldState, playerQuickClawActivated: false, enemyQuickClawActivated: false,
  }).enemyActsFirst;
  const endTurnOptions = {
    getLocalized: (pokemon: GamePokemon) => pokemon.name,
    formatDynamaxEndMessage: (pokemon: GamePokemon) => `${pokemon.name} shrank back down.`,
    getMoveCurrentPp: (knownMove: Move) => knownMove.currentPp ?? knownMove.pp ?? 0,
    tryActivateSitrusBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
    tryActivatePinchStatBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
  };
  assert.equal(enemyActsFirst([]), true);
  const activeState = nextFieldStates([], 'trick_room');
  const activeTurns = nextFieldTurns({}, 'trick_room');
  assert.deepEqual(activeState, ['trick_room']);
  assert.deepEqual(activeTurns, { trick_room: 5 });
  assert.equal(enemyActsFirst(activeState), false);
  const afterOneTurn = resolveEndTurn({
    ...endTurnOptions,
    snapshot: createSnapshot({ playerTeam: [slow], enemyTeam: [fast], fieldState: activeState, fieldTurns: activeTurns }),
  }).snapshot;
  assert.equal(afterOneTurn.fieldTurns.trick_room, 4);
  const closedState = nextFieldStates(afterOneTurn.fieldState, 'trick_room');
  const closedTurns = nextFieldTurns(afterOneTurn.fieldTurns, 'trick_room');
  assert.deepEqual(closedState, []);
  assert.deepEqual(closedTurns, {});
  assert.equal(enemyActsFirst(closedState), true);
  const afterCloseEndTurn = resolveEndTurn({ ...endTurnOptions, snapshot: { ...afterOneTurn, fieldState: closedState, fieldTurns: closedTurns } }).snapshot;
  assert.deepEqual(afterCloseEndTurn.fieldState, []);
  assert.deepEqual(afterCloseEndTurn.fieldTurns, {});

  let natural = createSnapshot({ playerTeam: [slow], enemyTeam: [fast], fieldState: activeState, fieldTurns: activeTurns });
  for (let turn = 1; turn <= 5; turn += 1) {
    natural = resolveEndTurn({ ...endTurnOptions, snapshot: natural }).snapshot;
    assert.equal(natural.fieldTurns.trick_room, turn === 5 ? undefined : 5 - turn);
    assert.equal(enemyActsFirst(natural.fieldState), turn !== 5 ? false : true);
  }
});

test('other rooms toggle off, repeat Gravity and Fairy Lock stay active, and terrain replaces terrain', () => {
  for (const room of ['magic_room', 'wonder_room'] as const) {
    assert.deepEqual(nextFieldStates([room], room), []);
    assert.deepEqual(nextFieldTurns({ [room]: 3 }, room), {});
  }
  assert.deepEqual(nextFieldStates(['gravity'], 'gravity'), ['gravity']);
  assert.deepEqual(nextFieldTurns({ gravity: 2 }, 'gravity'), { gravity: 2 });
  assert.equal(isRepeatFieldFailure(['gravity'], 'gravity'), true);
  assert.deepEqual(nextFieldStates(['fairy_lock'], 'fairy_lock'), ['fairy_lock']);
  assert.deepEqual(nextFieldTurns({ fairy_lock: 1 }, 'fairy_lock'), { fairy_lock: 1 });
  assert.equal(isRepeatFieldFailure(['fairy_lock'], 'fairy_lock'), true);
  assert.equal(isRepeatFieldFailure(['trick_room'], 'trick_room'), false);
  assert.deepEqual(nextFieldStates(['electric_terrain', 'trick_room'], 'grassy_terrain'), ['trick_room', 'grassy_terrain']);
  assert.deepEqual(nextFieldTurns({ electric_terrain: 2, trick_room: 4 }, 'grassy_terrain'), { trick_room: 4, grassy_terrain: 5 });
  assert.deepEqual(nextFieldStates(['grassy_terrain'], 'grassy_terrain'), ['grassy_terrain']);
  assert.deepEqual(nextFieldTurns({ grassy_terrain: 2 }, 'grassy_terrain'), { grassy_terrain: 5 });
});

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

test('resolveBeforeMoveChecks lets a frozen user thaw with an eligible move', () => {
  const frozen = setNonVolatileStatus(createPokemon(1, 'frozen'), 'freeze', { turnsRemaining: 3 });
  const result = resolveBeforeMoveChecks({
    snapshot: createSnapshot({ playerTeam: [frozen] }),
    side: 'player',
    combatant: frozen,
    move: createMove({
      name: 'scald',
      type: 'water',
      damage_class: 'special',
      battleData: {
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
        thawsUser: true,
      },
    }),
    displayName: 'Frozen',
    hasAbilityEffect: () => false,
    isMoveUsableWhileAsleep: () => false,
    getEncoredMove: () => null,
    getMoveCurrentPp: (move) => move.currentPp ?? move.pp ?? 0,
    tryConsumeStatusCureBerry: (pokemon) => ({ pokemon, message: null }),
    tryConsumeMentalHerb: (pokemon) => ({ pokemon, message: null }),
    calculateConfusionSelfHitDamage: () => 10,
    random: () => 0.99,
  });

  assert.equal(result.canAct, true);
  assert.equal(result.combatant.nonVolatileStatus, undefined);
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

test('end-turn Leftovers messages follow the selected battle language', () => {
  const holder = createPokemon(1, 'ledyba', { zhName: '芭瓢虫', currentHp: 50, factoryHeldItemId: 'leftovers' });
  const snapshot = createSnapshot({ playerTeam: [holder] });
  const options = {
    snapshot,
    formatDynamaxEndMessage: (pokemon: GamePokemon) => `${pokemon.name} shrank back down.`,
    getMoveCurrentPp: (move: Move) => move.currentPp ?? move.pp ?? 0,
    tryActivateSitrusBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
    tryActivatePinchStatBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
  };
  const chinese = resolveEndTurn({ ...options, currentLanguage: 'zh-CN', getLocalized: (pokemon) => pokemon.zhName || pokemon.name });
  const english = resolveEndTurn({ ...options, currentLanguage: 'en', getLocalized: (pokemon) => pokemon.name });
  assert.ok(chinese.events.some((event) => event.type === 'message' && event.message === '芭瓢虫通过剩饭恢复了体力！'));
  assert.ok(english.events.some((event) => event.type === 'message' && event.message === 'ledyba restored HP with Leftovers!'));
});

test('confusion messages are complete Chinese or English sentences', () => {
  const confused = setVolatileStatus(createPokemon(1, 'ledyba', { zhName: '芭瓢虫' }), 'confusion', { turnsRemaining: 3 });
  const options = {
    snapshot: createSnapshot({ playerTeam: [confused] }),
    side: 'player' as const,
    combatant: confused,
    move: createMove(),
    hasAbilityEffect: () => false,
    isMoveUsableWhileAsleep: () => false,
    getEncoredMove: () => null,
    getMoveCurrentPp: (move: Move) => move.currentPp ?? move.pp ?? 0,
    tryConsumeStatusCureBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
    tryConsumeMentalHerb: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
    calculateConfusionSelfHitDamage: () => 10,
    random: () => 0,
  };
  const chinese = resolveBeforeMoveChecks({ ...options, currentLanguage: 'zh-CN', displayName: '芭瓢虫' });
  const english = resolveBeforeMoveChecks({ ...options, currentLanguage: 'en', displayName: 'Ledyba' });
  assert.deepEqual(chinese.events.filter((event) => event.type === 'message').map((event) => event.message), [
    '芭瓢虫陷入了混乱！',
    '芭瓢虫因混乱伤害了自己！',
  ]);
  assert.deepEqual(english.events.filter((event) => event.type === 'message').map((event) => event.message), [
    'Ledyba is confused!',
    'Ledyba hurt itself in its confusion!',
  ]);
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

test('resolveEndTurn uses Pokerogue poison, toxic, and burn residual formulas', () => {
  const poisoned = setNonVolatileStatus(createPokemon(1, 'poisoned', { currentHp: 110, maxHp: 110 }), 'poison');
  const toxic = setNonVolatileStatus(createPokemon(2, 'toxic', { currentHp: 110, maxHp: 110 }), 'bad_poison', { toxicCounter: 3 });
  const burned = setNonVolatileStatus(createPokemon(3, 'burned', { currentHp: 110, maxHp: 110 }), 'burn');
  const commonOptions = {
    getLocalized: (pokemon: GamePokemon) => pokemon.name,
    formatDynamaxEndMessage: (pokemon: GamePokemon) => `${pokemon.name} shrank back down.`,
    getMoveCurrentPp: (move: { currentPp?: number; pp?: number }) => move.currentPp ?? move.pp ?? 0,
    tryActivateSitrusBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
    tryActivatePinchStatBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
  };

  const poisonResult = resolveEndTurn({ ...commonOptions, snapshot: createSnapshot({ playerTeam: [poisoned] }) });
  const toxicResult = resolveEndTurn({ ...commonOptions, snapshot: createSnapshot({ playerTeam: [toxic] }) });
  const burnResult = resolveEndTurn({ ...commonOptions, snapshot: createSnapshot({ playerTeam: [burned] }) });

  assert.equal(poisonResult.playerLead.currentHp, 97);
  assert.equal(toxicResult.playerLead.currentHp, 90);
  assert.equal(burnResult.playerLead.currentHp, 104);
});

test('resolveBeforeMoveChecks uses Pokerogue freeze, confusion, and paralysis chances', () => {
  const baseOptions = {
    side: 'player' as const,
    move: createMove(),
    displayName: 'Status mon',
    hasAbilityEffect: () => false,
    isMoveUsableWhileAsleep: () => false,
    getEncoredMove: () => null,
    getMoveCurrentPp: (move: Move) => move.currentPp ?? move.pp ?? 0,
    tryConsumeStatusCureBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
    tryConsumeMentalHerb: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
    calculateConfusionSelfHitDamage: () => 10,
  };
  const frozen = setNonVolatileStatus(createPokemon(1, 'frozen'), 'freeze', { turnsRemaining: 1 });
  const confused = setVolatileStatus(createPokemon(1, 'confused'), 'confusion', { turnsRemaining: 2 });
  const paralyzed = setNonVolatileStatus(createPokemon(1, 'paralyzed'), 'paralysis');

  const thawed = resolveBeforeMoveChecks({
    ...baseOptions,
    snapshot: createSnapshot({ playerTeam: [frozen] }),
    combatant: frozen,
    random: () => 0.99,
  });
  const confusionContinues = resolveBeforeMoveChecks({
    ...baseOptions,
    snapshot: createSnapshot({ playerTeam: [confused] }),
    combatant: confused,
    random: () => 0.4,
  });
  const paralysisDoesNotProc = resolveBeforeMoveChecks({
    ...baseOptions,
    snapshot: createSnapshot({ playerTeam: [paralyzed] }),
    combatant: paralyzed,
    random: () => 0.2,
  });
  const paralysisProcs = resolveBeforeMoveChecks({
    ...baseOptions,
    snapshot: createSnapshot({ playerTeam: [paralyzed] }),
    combatant: paralyzed,
    random: () => 0.1,
  });

  assert.equal(thawed.canAct, true);
  assert.equal(thawed.combatant.nonVolatileStatus, undefined);
  assert.equal(confusionContinues.canAct, true);
  assert.equal(confusionContinues.combatant.volatileStatuses?.confusion?.turnsRemaining, 1);
  assert.equal(paralysisDoesNotProc.canAct, true);
  assert.equal(paralysisProcs.canAct, false);
});

test('resolveEndTurn applies Pokerogue Hydration and Shed Skin cures after status damage', () => {
  const hydration = setNonVolatileStatus(createPokemon(1, 'hydration', {
    currentHp: 100,
    abilities: [{ ability: { name: 'hydration', url: '' } }],
  }), 'poison');
  const shedSkin = setNonVolatileStatus(createPokemon(2, 'shed-skin', {
    currentHp: 100,
    abilities: [{ ability: { name: 'shed-skin', url: '' } }],
  }), 'burn');
  const commonOptions = {
    getLocalized: (pokemon: GamePokemon) => pokemon.name,
    formatDynamaxEndMessage: (pokemon: GamePokemon) => `${pokemon.name} shrank back down.`,
    getMoveCurrentPp: (move: { currentPp?: number; pp?: number }) => move.currentPp ?? move.pp ?? 0,
    tryActivateSitrusBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
    tryActivatePinchStatBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
  };

  const hydrationResult = resolveEndTurn({
    ...commonOptions,
    snapshot: createSnapshot({ playerTeam: [hydration], weather: 'rainy', weatherTurns: 2 }),
    random: () => 0.99,
  });
  const shedSkinResult = resolveEndTurn({
    ...commonOptions,
    snapshot: createSnapshot({ playerTeam: [shedSkin] }),
    random: () => 0.29,
  });

  assert.equal(hydrationResult.playerLead.currentHp, 88);
  assert.equal(hydrationResult.playerLead.nonVolatileStatus, undefined);
  assert.equal(shedSkinResult.playerLead.currentHp, 94);
  assert.equal(shedSkinResult.playerLead.nonVolatileStatus, undefined);
});

test('resolveEndTurn heals grounded battlers on grassy terrain', () => {
  const groundedPokemon = createPokemon(1, 'grounded', {
    currentHp: 80,
    maxHp: 160,
  });
  const flyingPokemon = createPokemon(2, 'flying', {
    currentHp: 80,
    maxHp: 160,
    types: [{ type: { name: 'flying' } }],
  });
  const snapshot = createSnapshot({
    playerTeam: [groundedPokemon],
    enemyTeam: [flyingPokemon],
    fieldState: ['grassy_terrain'],
    fieldTurns: { grassy_terrain: 2 },
  });

  const result = resolveEndTurn({
    snapshot,
    getLocalized: (pokemon) => pokemon.name,
    formatDynamaxEndMessage: (pokemon) => `${pokemon.name} shrank back down.`,
    getMoveCurrentPp: (move) => move.currentPp ?? move.pp ?? 0,
    tryActivateSitrusBerry: (pokemon) => ({ pokemon, message: null }),
    tryActivatePinchStatBerry: (pokemon) => ({ pokemon, message: null }),
  });

  assert.equal(result.snapshot.playerTeam[0].currentHp, 90);
  assert.equal(result.snapshot.enemyTeam[0].currentHp, 80);
});

test('resolveEndTurn aligns Leech Seed, damaging traps, Ingrain, and Perish Song', () => {
  let player = createPokemon(1, 'player', { currentHp: 100, maxHp: 160 });
  player = setVolatileStatus(player, 'seeded', { linkedPokemonId: 2 });
  player = setVolatileStatus(player, 'trapped', { turnsRemaining: 4, sourceMoveName: 'bind' });
  player = setVolatileStatus(player, 'ingrain');
  player = setVolatileStatus(player, 'perish-song', { counter: 3 });
  const enemy = createPokemon(2, 'enemy', { currentHp: 50, maxHp: 160 });
  const commonOptions = {
    getLocalized: (pokemon: GamePokemon) => pokemon.name,
    formatDynamaxEndMessage: (pokemon: GamePokemon) => `${pokemon.name} shrank back down.`,
    getMoveCurrentPp: (move: Move) => move.currentPp ?? move.pp ?? 0,
    tryActivateSitrusBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
    tryActivatePinchStatBerry: (pokemon: GamePokemon | null | undefined) => ({ pokemon, message: null }),
  };

  const result = resolveEndTurn({
    ...commonOptions,
    snapshot: createSnapshot({ playerTeam: [player], enemyTeam: [enemy] }),
  });

  assert.equal(result.playerLead.currentHp, 70);
  assert.equal(result.enemyLead.currentHp, 70);
  assert.equal(result.playerLead.volatileStatuses?.trapped?.turnsRemaining, 3);
  assert.equal(result.playerLead.volatileStatuses?.perish_song?.counter, 2);

  const perishOne = resolveEndTurn({
    ...commonOptions,
    snapshot: createSnapshot({
      playerTeam: [setVolatileStatus(createPokemon(3, 'perish'), 'perish-song', { counter: 1 })],
    }),
  });
  assert.equal(perishOne.playerLead.currentHp, 0);
  assert.equal(perishOne.playerLead.volatileStatuses?.perish_song, undefined);
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
