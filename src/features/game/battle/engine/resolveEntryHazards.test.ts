import test from 'node:test';
import assert from 'node:assert/strict';
import type { GamePokemon } from '../../../../types';
import { findNextLivingReserveIndex } from '../../lib/battleResolution';
import { setNonVolatileStatus, setVolatileStatus } from '../../utils/battleStatus';
import { createEmptyBattleHazards, resolveEntryHazards, resolveStealthRockUse, resolveToxicSpikesUse } from './resolveEntryHazards';

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

test('Toxic Spikes target the opposite side, stack twice and fail on the third cast', () => {
  const empty = createEmptyBattleHazards();
  const first = resolveToxicSpikesUse(empty, 'player');
  const second = resolveToxicSpikesUse(first.hazards, 'player');
  const third = resolveToxicSpikesUse(second.hazards, 'player');
  assert.equal(first.succeeded, true);
  assert.equal(first.hazards.enemy.toxicSpikesLayers, 1);
  assert.equal(second.hazards.enemy.toxicSpikesLayers, 2);
  assert.deepEqual(third, { succeeded: false, hazards: second.hazards });
  assert.equal(resolveToxicSpikesUse(second.hazards, 'enemy').hazards.player.toxicSpikesLayers, 1);
  assert.equal(empty.enemy.toxicSpikesLayers, 0);
});

test('Rock damage is reported before poison, and a Rock KO prevents poison', () => {
  const hazards = resolveToxicSpikesUse(resolveStealthRockUse(createEmptyBattleHazards(), 'enemy').hazards, 'enemy').hazards;
  const survived = resolveEntryHazards(pokemon(['fire']), 'player', hazards);
  assert.equal(survived.pokemon.currentHp, 75);
  assert.equal(survived.pokemon.nonVolatileStatus?.id, 'poison');
  assert.deepEqual(survived.events, ['stealth-rock', 'poison']);
  const fainted = resolveEntryHazards(pokemon(['fire'], { currentHp: 10 }), 'player', hazards);
  assert.equal(fainted.pokemon.currentHp, 0);
  assert.equal(fainted.pokemon.nonVolatileStatus, undefined);
  assert.deepEqual(fainted.events, ['stealth-rock', 'fainted']);
  assert.equal(fainted.hazards.player.toxicSpikesLayers, 1);
});

test('grounding and Gravity control absorption and poisoning', () => {
  const hazards = resolveToxicSpikesUse(createEmptyBattleHazards(), 'enemy').hazards;
  const flyingPoison = pokemon(['flying', 'poison']);
  const levitating = pokemon(['normal'], { abilities: [{ ability: { name: 'levitate', url: '' } }] });
  assert.deepEqual(resolveEntryHazards(flyingPoison, 'player', hazards).events, []);
  assert.equal(resolveEntryHazards(flyingPoison, 'player', hazards).hazards.player.toxicSpikesLayers, 1);
  assert.equal(resolveEntryHazards(levitating, 'player', hazards).pokemon.nonVolatileStatus, undefined);
  const groundedPoison = resolveEntryHazards(flyingPoison, 'player', hazards, ['gravity']);
  assert.deepEqual(groundedPoison.events, ['toxic-spikes-absorbed']);
  assert.equal(groundedPoison.hazards.player.toxicSpikesLayers, 0);
  assert.equal(resolveEntryHazards(levitating, 'player', hazards, ['gravity']).pokemon.nonVolatileStatus?.id, 'poison');
});

test('grounded Poison absorbs both layers even with boots; the next entrant sees cleared hazards', () => {
  const one = resolveToxicSpikesUse(createEmptyBattleHazards(), 'enemy').hazards;
  const two = resolveToxicSpikesUse(one, 'enemy').hazards;
  const absorbed = resolveEntryHazards(pokemon(['poison'], { factoryHeldItemId: 'heavy-duty-boots' }), 'player', two);
  assert.deepEqual(absorbed.events, ['toxic-spikes-absorbed']);
  assert.equal(absorbed.pokemon.nonVolatileStatus, undefined);
  assert.equal(absorbed.hazards.player.toxicSpikesLayers, 0);
  assert.equal(absorbed.hazards.enemy.toxicSpikesLayers, 0);
  assert.equal(resolveEntryHazards(pokemon(['normal']), 'player', absorbed.hazards).pokemon.nonVolatileStatus, undefined);
});

test('two layers give toxic counter one; boots block poison while Magic Guard does not', () => {
  const one = resolveToxicSpikesUse(createEmptyBattleHazards(), 'enemy').hazards;
  const two = resolveToxicSpikesUse(one, 'enemy').hazards;
  const toxic = resolveEntryHazards(pokemon(['normal']), 'player', two);
  assert.equal(toxic.pokemon.nonVolatileStatus?.id, 'bad_poison');
  assert.equal(toxic.pokemon.nonVolatileStatus?.toxicCounter, 1);
  assert.deepEqual(toxic.events, ['bad-poison']);
  assert.equal(resolveEntryHazards(pokemon(['normal'], { factoryHeldItemId: 'heavy-duty-boots' }), 'player', two).pokemon.nonVolatileStatus, undefined);
  const magicGuard = pokemon(['normal'], { abilities: [{ ability: { name: 'magic-guard', url: '' } }] });
  assert.equal(resolveEntryHazards(magicGuard, 'player', one).pokemon.nonVolatileStatus?.id, 'poison');
});

test('Steel, prior status, immunity, Safeguard, Misty Terrain and Pastel Veil block poisoning', () => {
  const hazards = resolveToxicSpikesUse(createEmptyBattleHazards(), 'enemy').hazards;
  const fixtures = [
    pokemon(['steel']),
    setNonVolatileStatus(pokemon(['normal']), 'burn'),
    pokemon(['normal'], { abilities: [{ ability: { name: 'immunity', url: '' } }] }),
    setVolatileStatus(pokemon(['normal']), 'safeguard'),
    pokemon(['normal'], { abilities: [{ ability: { name: 'pastel-veil', url: '' } }] }),
    pokemon(['normal'], { abilities: [{ ability: { name: 'purifying-salt', url: '' } }] }),
  ];
  for (const entrant of fixtures) {
    const result = resolveEntryHazards(entrant, 'player', hazards);
    assert.deepEqual(result.events, []);
    assert.equal(result.hazards.player.toxicSpikesLayers, 1);
    assert.equal(result.pokemon.nonVolatileStatus?.id, entrant.nonVolatileStatus?.id);
  }
  assert.equal(resolveEntryHazards(pokemon(['normal']), 'player', hazards, ['misty_terrain']).pokemon.nonVolatileStatus, undefined);
});
