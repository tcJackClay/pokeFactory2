import test from 'node:test';
import assert from 'node:assert/strict';

import type { GamePokemon, Move, MoveBattleData, Nature, Stats } from '../../../../types';
import { calculateDamage } from './resolveDamage';
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
