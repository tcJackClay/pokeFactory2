import test from 'node:test';
import assert from 'node:assert/strict';
import type { GamePokemon } from '../../../../types';
import { findNextLivingReserveIndex } from '../../lib/battleResolution';
import { createEmptyBattleHazards, resolveEntryHazards, resolveStealthRockUse } from './resolveEntryHazards';

function pokemon(types: string[], overrides: Partial<GamePokemon> = {}): GamePokemon {
  return {
    id: 1,
    name: 'entrant',
    types: types.map((name) => ({ type: { name } })),
    abilities: [{ ability: { name: 'run-away', url: '' } }],
    currentHp: 100,
    maxHp: 100,
    ...overrides,
  } as GamePokemon;
}

test('Stealth Rock targets only the opposing side and cannot stack', () => {
  const empty = createEmptyBattleHazards();
  const playerCast = resolveStealthRockUse(empty, 'player');
  assert.equal(playerCast.succeeded, true);
  assert.equal(playerCast.hazards.enemy.stealthRock, true);
  assert.equal(playerCast.hazards.player.stealthRock, false);
  assert.equal(resolveEntryHazards(pokemon(['fire']), 'player', playerCast.hazards).damage, 0);
  assert.equal(resolveEntryHazards(pokemon(['fire']), 'enemy', playerCast.hazards).damage, 25);
  assert.deepEqual(resolveStealthRockUse(playerCast.hazards, 'player'), { succeeded: false, hazards: playerCast.hazards });
  assert.equal(resolveStealthRockUse(playerCast.hazards, 'enemy').hazards.player.stealthRock, true);
  assert.deepEqual(empty, createEmptyBattleHazards(), 'pure use must not mutate the source state');
});

test('Stealth Rock uses Rock effectiveness and integer max-HP fractions on entry', () => {
  const hazards = resolveStealthRockUse(createEmptyBattleHazards(), 'enemy').hazards;
  assert.equal(resolveEntryHazards(pokemon(['fire']), 'player', hazards).damage, 25);
  assert.equal(resolveEntryHazards(pokemon(['ground']), 'player', hazards).damage, 6);
  assert.equal(resolveEntryHazards(pokemon(['fighting', 'ground']), 'player', hazards).damage, 3);
  const frail = resolveEntryHazards(pokemon(['fire'], { currentHp: 10 }), 'player', hazards);
  assert.equal(frail.damage, 10);
  assert.equal(frail.pokemon.currentHp, 0);
  assert.equal(frail.fainted, true);
});

test('Heavy-Duty Boots and Magic Guard prevent entry Rock damage', () => {
  const hazards = resolveStealthRockUse(createEmptyBattleHazards(), 'player').hazards;
  const boots = pokemon(['fire'], { factoryHeldItemId: 'heavy-duty-boots' });
  const magicGuard = pokemon(['fire'], { abilities: [{ ability: { name: 'magic-guard', url: '' } }] });
  assert.equal(resolveEntryHazards(boots, 'enemy', hazards).damage, 0);
  assert.equal(resolveEntryHazards(magicGuard, 'enemy', hazards).damage, 0);
});

test('hazard-fainted enemy chooses a living reserve slot even when species IDs repeat', () => {
  const team = [
    pokemon(['fire'], { id: 7, currentHp: 0 }),
    pokemon(['water'], { id: 7, currentHp: 40 }),
    pokemon(['grass'], { id: 9, currentHp: 80 }),
  ];
  assert.equal(findNextLivingReserveIndex(team), 1);
  team[1] = { ...team[1], currentHp: 0 };
  assert.equal(findNextLivingReserveIndex(team), 2);
  team[2] = { ...team[2], currentHp: 0 };
  assert.equal(findNextLivingReserveIndex(team), -1);
});
