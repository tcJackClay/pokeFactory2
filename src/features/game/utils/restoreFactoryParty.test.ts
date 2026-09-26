import assert from 'node:assert/strict';
import test from 'node:test';
import type { GamePokemon } from '../../../types';
import { swapDefeatedPokemon } from '../config/classicFlow';
import { prepareFactoryPartyForBattle, restoreFactoryParty, restoreFactoryPokemon } from './restoreFactoryParty';

function makePokemon(id: number): GamePokemon {
  const stats = { hp: 60, attack: 60, defense: 60, spAtk: 60, spDef: 60, speed: 60 };
  const calculatedStats = { hp: 125, attack: 70, defense: 70, spAtk: 70, spDef: 70, speed: 70 };
  return {
    id,
    name: `pokemon-${id}`,
    sprites: { front_default: '', back_default: '' },
    stats: [],
    types: [{ type: { name: 'normal' } }],
    baseTypes: [{ type: { name: 'normal' } }],
    abilities: [],
    moves: [],
    currentHp: 0,
    maxHp: 125,
    selectedMoves: [
      { name: 'tackle', power: 40, accuracy: 100, type: 'normal', damage_class: 'physical', pp: 35, maxPp: 40, currentPp: 1 },
      { name: 'growl', power: null, accuracy: 100, type: 'normal', damage_class: 'status', pp: 40, currentPp: 0 },
    ],
    level: 50,
    nature: { name: 'hardy', zhName: '勤奋', plus: '', minus: '' },
    ivs: { hp: 10, attack: 10, defense: 10, spAtk: 10, spDef: 10, speed: 10 },
    evs: { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 },
    baseStats: stats,
    calculatedStats,
    statStages: { attack: 2, defense: -1, spAtk: 0, spDef: 0, speed: 1, accuracy: -2, evasion: 0 },
    nonVolatileStatus: { id: 'bad_poison', toxicCounter: 3 },
    volatileStatuses: { confusion: { id: 'confusion', active: true }, protect_chain: { id: 'protect_chain', active: true, counter: 2 } },
    factoryHeldItemId: 'leftovers',
    factoryOriginalHeldItemId: 'leftovers',
    factoryChoiceLockedMoveName: 'tackle',
    factoryLastUsedMoveName: 'tackle',
    factoryConsecutiveMoveCount: 2,
    factoryLastDamageReceived: 10,
    factoryLastDamageCategory: 'physical',
    factoryDamagedThisTurn: true,
    factoryStockpileCount: 2,
  };
}

test('postbattle restoration heals fainted party members, PP, statuses and temporary state', () => {
  const team = [makePokemon(1), { ...makePokemon(2), currentHp: 33 }];
  const restored = restoreFactoryParty(team);
  assert.deepEqual(restored.map((pokemon) => pokemon.currentHp), [125, 125]);
  assert.deepEqual(restored[0].selectedMoves.map((move) => move.currentPp), [40, 40]);
  assert.equal(restored[0].nonVolatileStatus, undefined);
  assert.deepEqual(restored[0].volatileStatuses, {});
  assert.deepEqual(Object.values(restored[0].statStages), [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(restored[0].factoryChoiceLockedMoveName, null);
  assert.equal(restored[0].factoryLastUsedMoveName, null);
  assert.equal(restored[0].factoryConsecutiveMoveCount, 0);
  assert.equal(restored[0].factoryStockpileCount, 0);
  assert.equal(restored[0].factoryHeldItemId, 'leftovers');
  assert.equal(team[0].currentHp, 0);
  assert.equal(team[0].selectedMoves[0].currentPp, 1);
});

test('postbattle restoration reverts temporary transformation stats and type', () => {
  const transformed = {
    ...makePokemon(3),
    types: [{ type: { name: 'fairy' } }],
    maxHp: 160,
    specialBoostActive: true,
    specialBoostMode: 'MEGA' as const,
    dynamaxTurnsLeft: 2,
  };
  const restored = restoreFactoryPokemon(transformed);
  assert.equal(restored.maxHp, 125);
  assert.equal(restored.currentHp, 125);
  assert.equal(restored.calculatedStats.attack, 70);
  assert.equal(restored.types[0].type.name, 'normal');
  assert.equal(restored.specialBoostActive, false);
  assert.equal(restored.specialBoostMode, undefined);
  assert.equal(restored.dynamaxTurnsLeft, undefined);
});

test('postbattle restoration corrects rounded stats after Dynamax expires naturally', () => {
  const expiredDynamax = {
    ...makePokemon(5),
    maxHp: 124,
    calculatedStats: { hp: 124, attack: 69, defense: 69, spAtk: 69, spDef: 69, speed: 69 },
    specialBoostActive: false,
    specialBoostMode: undefined,
    dynamaxTurnsLeft: undefined,
  };
  const restored = restoreFactoryPokemon(expiredDynamax);
  assert.equal(restored.maxHp, 125);
  assert.equal(restored.currentHp, 125);
  assert.equal(restored.calculatedStats.attack, 70);
});

test('restoration is repeatable and does not invent PP when a move has no maximum', () => {
  const pokemon = {
    ...makePokemon(4),
    selectedMoves: [
      ...makePokemon(4).selectedMoves,
      { name: 'unknown', power: null, accuracy: null, type: 'normal', damage_class: 'status', currentPp: 3 },
    ],
  };
  const once = restoreFactoryPokemon(pokemon);
  const twice = restoreFactoryPokemon(once);
  assert.deepEqual(twice, once);
  assert.equal(once.selectedMoves[2].currentPp, 3);
});

test('result restoration preserves consumed items until next battle, including a swapped enemy', () => {
  const consumed = { ...makePokemon(1), factoryOriginalHeldItemId: 'sitrus-berry', factoryHeldItemId: undefined };
  const knockedOff = { ...makePokemon(2), factoryOriginalHeldItemId: 'white-herb', factoryHeldItemId: undefined };
  const noItem = { ...makePokemon(3), factoryOriginalHeldItemId: null, factoryHeldItemId: 'sitrus-berry' };
  const enemyConsumed = { ...makePokemon(4), factoryOriginalHeldItemId: 'leppa-berry', factoryHeldItemId: undefined };
  const replaced = { ...makePokemon(5), factoryOriginalHeldItemId: 'pecha-berry', factoryHeldItemId: 'sitrus-berry' };

  const restored = restoreFactoryParty([consumed, knockedOff, noItem, replaced]);
  assert.deepEqual(restored.map((pokemon) => pokemon.factoryHeldItemId), [undefined, undefined, 'sitrus-berry', 'sitrus-berry']);
  assert.deepEqual(restoreFactoryParty(restored), restored);
  assert.equal(consumed.factoryHeldItemId, undefined);

  const swapped = swapDefeatedPokemon(restored, [enemyConsumed], 1, 0);
  assert.ok(swapped);
  const nextTeam = prepareFactoryPartyForBattle(swapped);
  assert.deepEqual(nextTeam.map((pokemon) => pokemon.id), [1, 4, 3, 5]);
  assert.deepEqual(nextTeam.map((pokemon) => pokemon.factoryHeldItemId), ['sitrus-berry', 'leppa-berry', undefined, 'pecha-berry']);
  assert.deepEqual(prepareFactoryPartyForBattle(nextTeam), nextTeam);
});
