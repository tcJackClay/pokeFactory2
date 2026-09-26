import test from 'node:test';
import assert from 'node:assert/strict';

import type { GamePokemon, Move, MoveBattleData, Nature, Stats } from '../../../../types';
import { calculateConfusionSelfHitDamage, calculateDamage, getEffectiveBattleSpeed } from './resolveDamage';
import { getResolvedMoveAccuracy } from './resolveAccuracy';
import { setVolatileStatus } from '../../utils/battleStatus';

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
    flags: ['protect'],
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
    power: 80,
    accuracy: 100,
    type: 'normal',
    damage_class: 'physical',
    pp: 10,
    currentPp: 10,
    battleData: createBattleData(overrides.battleData),
    ...overrides,
  };
}

function createPokemon(id: number, types: string[], overrides: Partial<GamePokemon> = {}): GamePokemon {
  const typeSlots = types.map((typeName) => ({ type: { name: typeName } }));
  return {
    id,
    name: `pokemon-${id}`,
    sprites: {
      front_default: '',
      back_default: '',
    },
    stats: [
      { base_stat: 100, stat: { name: 'hp' } },
      { base_stat: 100, stat: { name: 'attack' } },
      { base_stat: 100, stat: { name: 'defense' } },
      { base_stat: 100, stat: { name: 'special-attack' } },
      { base_stat: 100, stat: { name: 'special-defense' } },
      { base_stat: 100, stat: { name: 'speed' } },
    ],
    types: typeSlots,
    baseTypes: typeSlots,
    abilities: [{ ability: { name: 'run-away', url: '' } }],
    moves: [{ move: { name: 'neutral-hit', url: '' } }],
    currentHp: 200,
    maxHp: 200,
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

function createRandomSequence(values: number[]) {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

test('calculateDamage applies STAB and stronger tera STAB', () => {
  const defender = createPokemon(2, ['normal']);
  const attacker = createPokemon(1, ['fire', 'flying']);
  const fireMove = createMove({ type: 'fire' });
  const electricMove = createMove({ type: 'electric' });

  const stabDamage = calculateDamage({
    move: fireMove,
    attacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });
  const neutralDamage = calculateDamage({
    move: electricMove,
    attacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });

  const teraAttacker = createPokemon(3, ['fire', 'flying'], {
    specialBoostActive: true,
    specialBoostMode: 'TERA',
    teraType: 'fire',
    types: [{ type: { name: 'fire' } }],
  });
  const teraDamage = calculateDamage({
    move: fireMove,
    attacker: teraAttacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });

  assert.ok(stabDamage.damage > neutralDamage.damage);
  assert.ok(teraDamage.damage > stabDamage.damage);
});

test('calculateDamage respects accuracy and evasion stages', () => {
  const attacker = createPokemon(1, ['normal'], {
    statStages: {
      attack: 0,
      defense: 0,
      spAtk: 0,
      spDef: 0,
      speed: 0,
      accuracy: -6,
      evasion: 0,
    },
  });
  const defender = createPokemon(2, ['normal'], {
    statStages: {
      attack: 0,
      defense: 0,
      spAtk: 0,
      spDef: 0,
      speed: 0,
      accuracy: 0,
      evasion: 6,
    },
  });

  const result = calculateDamage({
    move: createMove(),
    attacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0.5]),
  });

  assert.equal(result.isMiss, true);
});

test('calculateDamage uses Pokerogue integer accuracy rolls and strict comparison', () => {
  const result = calculateDamage({
    move: createMove({ accuracy: 90 }),
    attacker: createPokemon(1, ['normal']),
    defender: createPokemon(2, ['normal']),
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: () => 0.9,
  });

  assert.equal(result.isMiss, true);
});

test('accuracy applies Pokerogue No Guard, Compound Eyes, Hustle, and weather evasion', () => {
  const defender = createPokemon(2, ['normal']);
  const compoundEyes = createPokemon(1, ['normal'], {
    abilities: [{ ability: { name: 'compound-eyes', url: '' } }],
  });
  const hustle = createPokemon(3, ['normal'], {
    abilities: [{ ability: { name: 'hustle', url: '' } }],
  });
  const sandVeil = createPokemon(4, ['ground'], {
    abilities: [{ ability: { name: 'sand-veil', url: '' } }],
  });
  const noGuard = createPokemon(5, ['normal'], {
    abilities: [{ ability: { name: 'no-guard', url: '' } }],
  });
  const move = createMove({ accuracy: 80 });

  assert.equal(getResolvedMoveAccuracy(move, compoundEyes, defender), 104);
  assert.equal(getResolvedMoveAccuracy(move, hustle, defender), 64);
  assert.equal(getResolvedMoveAccuracy(move, compoundEyes, sandVeil, 'sandstorm'), 83.2);
  assert.equal(getResolvedMoveAccuracy(move, noGuard, defender), null);
});

test('accuracy applies Pokerogue weather and Minimize move overrides', () => {
  const attacker = createPokemon(1, ['normal']);
  const defender = createPokemon(2, ['normal']);
  const minimized = setVolatileStatus(defender, 'minimized');

  assert.equal(getResolvedMoveAccuracy(createMove({ name: 'thunder', accuracy: 70 }), attacker, defender, 'rainy'), null);
  assert.equal(getResolvedMoveAccuracy(createMove({ name: 'thunder', accuracy: 70 }), attacker, defender, 'sunny'), 50);
  assert.equal(getResolvedMoveAccuracy(createMove({ name: 'blizzard', accuracy: 70 }), attacker, defender, 'hail'), null);
  assert.equal(getResolvedMoveAccuracy(createMove({ name: 'stomp', accuracy: 100 }), attacker, minimized), null);
});

test('calculateDamage applies terrain power and misty dragon reduction', () => {
  const groundedAttacker = createPokemon(1, ['electric']);
  const groundedDefender = createPokemon(2, ['normal']);
  const electricMove = createMove({ type: 'electric' });
  const dragonMove = createMove({ type: 'dragon' });

  const neutralElectric = calculateDamage({
    move: electricMove,
    attacker: groundedAttacker,
    defender: groundedDefender,
    weather: 'none',
    fieldState: [],
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });
  const terrainElectric = calculateDamage({
    move: electricMove,
    attacker: groundedAttacker,
    defender: groundedDefender,
    weather: 'none',
    fieldState: ['electric_terrain'],
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });
  const neutralDragon = calculateDamage({
    move: dragonMove,
    attacker: groundedAttacker,
    defender: groundedDefender,
    weather: 'none',
    fieldState: [],
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });
  const mistyDragon = calculateDamage({
    move: dragonMove,
    attacker: groundedAttacker,
    defender: groundedDefender,
    weather: 'none',
    fieldState: ['misty_terrain'],
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });

  assert.ok(terrainElectric.damage > neutralElectric.damage);
  assert.ok(mistyDragon.damage < neutralDragon.damage);
});

test('calculateDamage boosts rock special defense during sandstorm', () => {
  const attacker = createPokemon(1, ['water']);
  const rockDefender = createPokemon(2, ['rock']);
  const specialMove = createMove({ type: 'water', damage_class: 'special' });

  const normalWeather = calculateDamage({
    move: specialMove,
    attacker,
    defender: rockDefender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });
  const sandstorm = calculateDamage({
    move: specialMove,
    attacker,
    defender: rockDefender,
    weather: 'sandstorm',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });

  assert.ok(sandstorm.damage < normalWeather.damage);
});

test('calculateDamage handles fixed and hp-based damage effects', () => {
  const attacker = createPokemon(1, ['normal'], {
    level: 50,
    currentHp: 20,
    maxHp: 200,
  });
  const defender = createPokemon(2, ['normal'], {
    currentHp: 120,
  });

  const seismicToss = calculateDamage({
    move: createMove({ battleData: createBattleData({ effectId: 'LEVEL_DAMAGE' }) }),
    attacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99]),
  });
  const superFang = calculateDamage({
    move: createMove({ battleData: createBattleData({ effectId: 'HALF_HP' }) }),
    attacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99]),
  });
  const endeavor = calculateDamage({
    move: createMove({ battleData: createBattleData({ effectId: 'ENDEAVOR' }) }),
    attacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99]),
  });

  assert.equal(seismicToss.damage, 50);
  assert.equal(superFang.damage, 60);
  assert.equal(endeavor.damage, 100);
});

test('calculateDamage handles low-hp, high-hp, and facade power changes', () => {
  const defender = createPokemon(2, ['normal']);
  const lowHpAttacker = createPokemon(1, ['normal'], {
    currentHp: 1,
    maxHp: 100,
  });
  const healthyAttacker = createPokemon(3, ['normal'], {
    currentHp: 100,
    maxHp: 100,
  });
  const burnedAttacker = {
    ...healthyAttacker,
    nonVolatileStatus: { id: 'burn' as const },
  };

  const flail = calculateDamage({
    move: createMove({ power: 1, battleData: createBattleData({ effectId: 'LOW_HP_POWER' }) }),
    attacker: lowHpAttacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });
  const waterSpout = calculateDamage({
    move: createMove({ power: 1, type: 'water', battleData: createBattleData({ effectId: 'HIGH_HP_POWER' }) }),
    attacker: healthyAttacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });
  const facade = calculateDamage({
    move: createMove({ power: 70, battleData: createBattleData({ effectId: 'FACADE' }) }),
    attacker: burnedAttacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });

  assert.ok(flail.damage > 50);
  assert.ok(waterSpout.damage > 50);
  assert.ok(facade.damage > 25);
});

test('calculateDamage aligns Pokerogue variable and fixed move formulas', () => {
  const defender = createPokemon(2, ['normal'], { weight: 2000 });
  const calculate = (move: Move, attackerOverrides: Partial<GamePokemon> = {}, randomValues = [0.99, 0.999999]) => calculateDamage({
    move,
    attacker: createPokemon(1, ['normal'], attackerOverrides),
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    skipAccuracyCheck: true,
    random: createRandomSequence(randomValues),
  }).damage;

  assert.equal(calculate(createMove({
    name: 'low-kick',
    power: null,
    type: 'fighting',
    battleData: createBattleData({ effectId: 'WEIGHT_POWER' }),
  })), 109);
  assert.equal(calculate(createMove({
    name: 'return',
    power: null,
    battleData: createBattleData({ effectId: 'FRIENDSHIP_POWER' }),
  }), { friendship: 255 }), 70);
  assert.equal(calculate(createMove({
    name: 'frustration',
    power: null,
    battleData: createBattleData({ effectId: 'INVERSE_FRIENDSHIP_POWER' }),
  }), { friendship: 0 }), 70);
  assert.equal(calculate(createMove({
    name: 'magnitude',
    power: null,
    type: 'ground',
    battleData: createBattleData({ effectId: 'MAGNITUDE' }),
  }), {}, [0.99, 0, 0.999999]), 6);
  assert.equal(calculate(createMove({
    name: 'fury-cutter',
    power: 40,
    type: 'bug',
    battleData: createBattleData({ effectId: 'CONSECUTIVE_POWER' }),
  }), { factoryConsecutiveMoveCount: 3 }), 72);
  assert.equal(calculate(createMove({
    name: 'psywave',
    power: null,
    type: 'psychic',
    damage_class: 'special',
    battleData: createBattleData({ effectId: 'RANDOM_LEVEL_DAMAGE' }),
  }), {}, [0.999999]), 75);
  assert.equal(calculate(createMove({
    name: 'counter',
    power: null,
    type: 'fighting',
    battleData: createBattleData({ effectId: 'COUNTER_PHYSICAL' }),
  }), { factoryLastDamageReceived: 30, factoryLastDamageCategory: 'physical' }), 60);
  assert.equal(calculate(createMove({
    name: 'spit-up',
    power: null,
    damage_class: 'special',
    battleData: createBattleData({ effectId: 'SPIT_UP' }),
  }), { factoryStockpileCount: 2 }), 135);
  assert.equal(calculate(createMove({
    name: 'revenge',
    power: 60,
    type: 'fighting',
    battleData: createBattleData({ effectId: 'REVENGE' }),
  }), { factoryDamagedThisTurn: true }), 109);
  assert.equal(calculate(createMove({
    name: 'smelling-salts',
    power: 70,
    battleData: createBattleData({ effectId: 'SMELLING_SALTS' }),
  }), {}, [0.99, 0.999999]), 49);
  assert.equal(calculateDamage({
    move: createMove({
      name: 'smelling-salts',
      power: 70,
      battleData: createBattleData({ effectId: 'SMELLING_SALTS' }),
    }),
    attacker: createPokemon(9, ['normal']),
    defender: { ...defender, nonVolatileStatus: { id: 'paralysis' } },
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    skipAccuracyCheck: true,
    random: createRandomSequence([0.99, 0.999999]),
  }).damage, 95);
  assert.equal(calculateDamage({
    move: createMove({
      name: 'knock-off',
      power: 65,
      type: 'dark',
      battleData: createBattleData({ effectId: 'KNOCK_OFF' }),
    }),
    attacker: createPokemon(10, ['normal']),
    defender: { ...defender, factoryHeldItemId: 'leftovers' },
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    skipAccuracyCheck: true,
    random: createRandomSequence([0.99, 0.999999]),
  }).damage, 44);

  const presentHeal = calculateDamage({
    move: createMove({
      name: 'present',
      power: null,
      battleData: createBattleData({ effectId: 'PRESENT' }),
    }),
    attacker: createPokemon(5, ['normal']),
    defender: createPokemon(6, ['normal'], { currentHp: 100, maxHp: 200 }),
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    skipAccuracyCheck: true,
    random: () => 0.99,
  });
  assert.equal(presentHeal.damage, 0);
  assert.equal(presentHeal.targetHealing, 50);
});

test('one-hit KO moves use Pokerogue level accuracy and immunity rules', () => {
  const attacker = createPokemon(1, ['normal'], { level: 50 });
  const defender = createPokemon(2, ['normal'], { level: 50 });
  const guillotine = createMove({
    name: 'guillotine',
    power: 250,
    accuracy: 30,
    battleData: createBattleData({ effectId: 'ONE_HIT_KO' }),
  });
  const hit = calculateDamage({
    move: guillotine,
    attacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: () => 0.29,
  });
  const miss = calculateDamage({
    move: guillotine,
    attacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: () => 0.3,
  });
  const sheerCold = calculateDamage({
    move: createMove({
      name: 'sheer-cold',
      type: 'ice',
      damage_class: 'special',
      power: 250,
      accuracy: 30,
      battleData: createBattleData({ effectId: 'SHEER_COLD' }),
    }),
    attacker: createPokemon(3, ['ice']),
    defender: createPokemon(4, ['ice']),
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: () => 0,
  });

  assert.equal(hit.damage, defender.currentHp);
  assert.equal(miss.isMiss, true);
  assert.equal(sheerCold.damage, 0);
});

test('calculateDamage blocks regular moves with protect and reduces z-powered moves', () => {
  const attacker = createPokemon(1, ['normal']);
  const protectedDefender = setVolatileStatus(createPokemon(2, ['normal']), 'protect', {
    turnsRemaining: 1,
  });
  const move = createMove();

  const blockedResult = calculateDamage({
    move,
    attacker,
    defender: protectedDefender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });
  const zPoweredResult = calculateDamage({
    move,
    attacker: {
      ...attacker,
      specialBoostActive: true,
      specialBoostMode: 'ZMOVE',
    },
    defender: protectedDefender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });

  assert.equal(blockedResult.blockedByProtect, true);
  assert.equal(blockedResult.damage, 0);
  assert.equal(zPoweredResult.blockedByProtect, true);
  assert.equal(zPoweredResult.protectReducedDamage, true);
  assert.ok(zPoweredResult.damage > 0);
});

test('calculateDamage routes blocked hits into substitute instead of HP', () => {
  const attacker = createPokemon(1, ['normal']);
  const defender = setVolatileStatus(createPokemon(2, ['normal']), 'substitute', {
    counter: 30,
  });

  const damagingResult = calculateDamage({
    move: createMove(),
    attacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    random: createRandomSequence([0, 0.99, 0]),
  });
  const statusResult = calculateDamage({
    move: createMove({
      damage_class: 'status',
      battleData: createBattleData(),
    }),
    attacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
  });

  assert.equal(damagingResult.damage, 0);
  assert.ok(damagingResult.substituteDamage > 0);
  assert.equal(damagingResult.applyUserSecondaryEffects, true);
  assert.equal(damagingResult.applyTargetSecondaryEffects, false);
  assert.equal(statusResult.blockedBySubstitute, true);
  assert.equal(statusResult.applyUserSecondaryEffects, true);
  assert.equal(statusResult.applyTargetSecondaryEffects, false);
});

test('calculateDamage follows Pokerogue final burn modifier and discrete variance', () => {
  const attacker = createPokemon(1, ['normal']);
  const burnedAttacker = {
    ...attacker,
    nonVolatileStatus: { id: 'burn' as const },
  };
  const defender = createPokemon(2, ['normal']);
  const move = createMove();

  const maximum = calculateDamage({
    move,
    attacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    skipAccuracyCheck: true,
    random: createRandomSequence([0.99, 0.999999]),
  });
  const minimum = calculateDamage({
    move,
    attacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    skipAccuracyCheck: true,
    random: createRandomSequence([0.99, 0]),
  });
  const burned = calculateDamage({
    move,
    attacker: burnedAttacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    skipAccuracyCheck: true,
    random: createRandomSequence([0.99, 0.999999]),
  });

  assert.equal(maximum.damage, 55);
  assert.equal(minimum.damage, 47);
  assert.equal(burned.damage, 27);
});

test('Solar Beam follows Pokerogue adverse-weather power and weather suppression', () => {
  const attacker = createPokemon(1, ['grass']);
  const airLockAttacker = createPokemon(3, ['grass'], {
    abilities: [{ ability: { name: 'air-lock', url: '' } }],
  });
  const defender = createPokemon(2, ['normal']);
  const move = createMove({ name: 'solar-beam', type: 'grass', power: 120, damage_class: 'special' });
  const calculate = (selectedAttacker: GamePokemon, weather: 'none' | 'rainy') => calculateDamage({
    move,
    attacker: selectedAttacker,
    defender,
    weather,
    atkBuff: false,
    defBuff: false,
    skipAccuracyCheck: true,
    random: createRandomSequence([0.99, 0.999999]),
  }).damage;

  assert.equal(calculate(attacker, 'none'), 82);
  assert.equal(calculate(attacker, 'rainy'), 42);
  assert.equal(calculate(airLockAttacker, 'rainy'), 82);
});

test('Reflect and Light Screen follow Pokerogue single-battle damage rules', () => {
  const attacker = createPokemon(1, ['normal']);
  const infiltrator = createPokemon(3, ['normal'], {
    abilities: [{ ability: { name: 'infiltrator', url: '' } }],
  });
  const defender = setVolatileStatus(
    setVolatileStatus(createPokemon(2, ['normal']), 'reflect'),
    'light-screen',
  );
  const calculate = (selectedAttacker: GamePokemon, move: Move, critRoll = 0.99) => calculateDamage({
    move,
    attacker: selectedAttacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    skipAccuracyCheck: true,
    random: createRandomSequence([critRoll, 0.999999]),
  }).damage;

  assert.equal(calculate(attacker, createMove()), 27);
  assert.equal(calculate(attacker, createMove({ damage_class: 'special' })), 27);
  assert.equal(calculate(infiltrator, createMove()), 55);
  assert.equal(calculate(attacker, createMove({
    name: 'brick-break',
    battleData: createBattleData({ effectId: 'BREAK_SCREENS' }),
  })), 55);
  assert.equal(calculate(attacker, createMove(), 0), 83);
});

test('Focus Energy contributes two Pokerogue critical-hit stages', () => {
  const attacker = createPokemon(1, ['normal']);
  const focusedAttacker = setVolatileStatus(attacker, 'crit-boost', { counter: 2 });
  const defender = createPokemon(2, ['normal']);
  const calculate = (selectedAttacker: GamePokemon) => calculateDamage({
    move: createMove(),
    attacker: selectedAttacker,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    skipAccuracyCheck: true,
    random: createRandomSequence([0.13, 0.999999]),
  });

  assert.equal(calculate(attacker).isCrit, false);
  assert.equal(calculate(focusedAttacker).isCrit, true);
});

test('damage conditions align Dream Eater, Damp, and Sturdy', () => {
  const attacker = createPokemon(1, ['psychic']);
  const defender = createPokemon(2, ['normal']);
  const calculate = (move: Move, target: GamePokemon = defender, selectedAttacker: GamePokemon = attacker) => calculateDamage({
    move,
    attacker: selectedAttacker,
    defender: target,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    skipAccuracyCheck: true,
    random: createRandomSequence([0.99, 0.999999]),
  }).damage;
  const dreamEater = createMove({ name: 'dream-eater', type: 'psychic', damage_class: 'special' });
  const explosion = createMove({ name: 'explosion', battleData: createBattleData({ effectId: 'SELF_DESTRUCT' }) });
  const guillotine = createMove({ name: 'guillotine', battleData: createBattleData({ effectId: 'ONE_HIT_KO' }) });

  assert.equal(calculate(dreamEater), 0);
  assert.ok(calculate(dreamEater, { ...defender, nonVolatileStatus: { id: 'sleep', turnsRemaining: 2 } }) > 0);
  assert.equal(calculate(explosion, createPokemon(3, ['normal'], {
    abilities: [{ ability: { name: 'damp', url: '' } }],
  })), 0);
  assert.equal(calculate(guillotine, createPokemon(4, ['normal'], {
    abilities: [{ ability: { name: 'sturdy', url: '' } }],
  })), 0);
  assert.equal(calculate(guillotine, createPokemon(5, ['normal'], {
    abilities: [{ ability: { name: 'sturdy', url: '' } }],
  }), createPokemon(6, ['normal'], {
    abilities: [{ ability: { name: 'mold-breaker', url: '' } }],
  })), 200);
});

test('confusion damage and paralysis speed use Pokerogue modifiers', () => {
  const pokemon = createPokemon(1, ['normal']);
  const paralyzedPokemon = {
    ...pokemon,
    nonVolatileStatus: { id: 'paralysis' as const },
  };

  assert.equal(calculateConfusionSelfHitDamage(pokemon, () => 0), 16);
  assert.equal(calculateConfusionSelfHitDamage(pokemon, () => 0.999999), 19);
  assert.equal(getEffectiveBattleSpeed(pokemon), 100);
  assert.equal(getEffectiveBattleSpeed(paralyzedPokemon), 50);
});

test('damage applies common Pokerogue offensive and defensive ability modifiers', () => {
  const defender = createPokemon(2, ['normal']);
  const move = createMove();
  const calculate = (attacker: GamePokemon, target: GamePokemon = defender, selectedMove: Move = move) => calculateDamage({
    move: selectedMove,
    attacker,
    defender: target,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    skipAccuracyCheck: true,
    random: createRandomSequence([0.99, 0.999999]),
  }).damage;
  const normalAttacker = createPokemon(1, ['normal']);
  const adaptability = createPokemon(3, ['normal'], {
    abilities: [{ ability: { name: 'adaptability', url: '' } }],
  });
  const hugePower = createPokemon(4, ['normal'], {
    abilities: [{ ability: { name: 'huge-power', url: '' } }],
  });
  const guts = createPokemon(5, ['normal'], {
    abilities: [{ ability: { name: 'guts', url: '' } }],
    nonVolatileStatus: { id: 'burn' },
  });
  const technician = createPokemon(6, ['normal'], {
    abilities: [{ ability: { name: 'technician', url: '' } }],
  });
  const thickFat = createPokemon(7, ['normal'], {
    abilities: [{ ability: { name: 'thick-fat', url: '' } }],
  });
  const sniper = createPokemon(9, ['normal'], {
    abilities: [{ ability: { name: 'sniper', url: '' } }],
  });
  const fluffy = createPokemon(10, ['normal'], {
    abilities: [{ ability: { name: 'fluffy', url: '' } }],
  });
  const sheerForce = createPokemon(12, ['normal'], {
    abilities: [{ ability: { name: 'sheer-force', url: '' } }],
  });

  assert.equal(calculate(normalAttacker), 55);
  assert.equal(calculate(adaptability), 74);
  assert.equal(calculate(hugePower), 108);
  assert.equal(calculate(guts), 82);
  assert.equal(calculate(technician, defender, createMove({ power: 40 })), 42);
  assert.equal(
    calculate(createPokemon(8, ['fire']), thickFat, createMove({ type: 'fire' })),
    27,
  );
  assert.equal(
    calculate(createPokemon(14, ['fire'], {
      abilities: [{ ability: { name: 'mold-breaker', url: '' } }],
    }), thickFat, createMove({ type: 'fire' })),
    55,
  );
  assert.equal(calculateDamage({
    move,
    attacker: sniper,
    defender,
    weather: 'none',
    atkBuff: false,
    defBuff: false,
    skipAccuracyCheck: true,
    random: createRandomSequence([0, 0.999999]),
  }).damage, 125);
  assert.equal(
    calculate(
      createPokemon(11, ['fire']),
      fluffy,
      createMove({ type: 'fire', battleData: createBattleData({ makesContact: true }) }),
    ),
    54,
  );
  assert.equal(calculate(
    sheerForce,
    defender,
    createMove({
      battleData: createBattleData({
        secondaryEffects: [{
          kind: 'status',
          chance: 10,
          isPrimary: false,
          statusId: 'paralysis',
        }],
      }),
    }),
  ), 71);
  assert.equal(
    calculate(
      setVolatileStatus(createPokemon(13, ['fire']), 'flash-fire'),
      defender,
      createMove({ type: 'fire' }),
    ),
    82,
  );
});

test('speed applies Pokerogue Quick Feet and weather ability modifiers', () => {
  const quickFeet = createPokemon(1, ['normal'], {
    abilities: [{ ability: { name: 'quick-feet', url: '' } }],
    nonVolatileStatus: { id: 'paralysis' },
  });
  const swiftSwim = createPokemon(2, ['water'], {
    abilities: [{ ability: { name: 'swift-swim', url: '' } }],
  });
  const surgeSurfer = createPokemon(3, ['electric'], {
    abilities: [{ ability: { name: 'surge-surfer', url: '' } }],
  });

  assert.equal(getEffectiveBattleSpeed(quickFeet), 150);
  assert.equal(getEffectiveBattleSpeed(swiftSwim, 'rainy'), 200);
  assert.equal(getEffectiveBattleSpeed(surgeSurfer, 'none', ['electric_terrain']), 200);
});
