import test from 'node:test';
import assert from 'node:assert/strict';
import { choosePoolCandidates, emptyPoolRejectCounts, normalizePoolItemId, type PoolCandidate } from './factoryOpponentCandidates';

function candidate(pokemonId: number, source: PoolCandidate['source'], itemId: string, gen = 1): PoolCandidate {
  return { pokemonId, speciesId: pokemonId, source, itemId, gen, quality: 400, stage: 'BASE' };
}

function buildWithSources(sources: (slot: number, attempt: number) => [PoolCandidate[], PoolCandidate[], PoolCandidate[]], blockedSpecies = new Set<number>()) {
  const pickedSpecies = new Set(blockedSpecies);
  const pickedItems = new Set<string>();
  const rejected = emptyPoolRejectCounts();
  const team: PoolCandidate[] = [];
  let attempts = 0;
  while (team.length < 3 && attempts < 75) {
    attempts += 1;
    const sourceGroups = sources(team.length, attempts);
    for (const group of sourceGroups) {
      const viable = choosePoolCandidates(group, {
        selectedGeneration: 1, pickedSpecies, pickedItems, bannedSpecies: new Set([201]),
        requiredStage: 'BASE', minQuality: 300, maxQuality: 500,
      }, rejected);
      if (viable.length === 0) continue;
      const selected = viable[0]; // Controlled selection: first viable candidate.
      team.push(selected);
      pickedSpecies.add(selected.speciesId);
      pickedItems.add(normalizePoolItemId(selected.itemId));
      break;
    }
  }
  return { team, attempts, rejected };
}

test('reference held-item conflicts and cross-generation trainer hints fall back within the same attempt', () => {
  const result = buildWithSources((slot) => [
    [candidate(100 + slot, 'reference', 'choice-band')],
    [candidate(200 + slot, 'trainer-pool', 'scope_lens', 2)],
    [candidate(300 + slot, 'global-pool', ['leftovers', 'quick_claw', 'white_herb'][slot])],
  ], new Set([300]));
  assert.deepEqual(result.team.map((member) => member.source), ['reference', 'global-pool', 'global-pool']);
  assert.equal(result.attempts, 3);
  assert.ok(result.rejected['item-conflict'] > 0);
  assert.ok(result.rejected.generation > 0);
  assert.equal(new Set(result.team.map((member) => member.speciesId)).size, 3);
  assert.equal(new Set(result.team.map((member) => normalizePoolItemId(member.itemId))).size, 3);
  assert.ok(result.team.every((member) => member.gen === 1));
});

test('cross-generation and unknown-generation hints cannot become opponents', () => {
  const rejected = emptyPoolRejectCounts();
  const options = { selectedGeneration: 1, pickedSpecies: new Set<number>(), pickedItems: new Set<string>(), bannedSpecies: new Set<number>() };
  const viable = choosePoolCandidates([
    candidate(25, 'trainer-pool', 'leftovers', 9),
    candidate(26, 'trainer-pool', 'white_herb', 0),
    candidate(27, 'global-pool', 'quick_claw', 1),
  ], options, rejected);
  assert.deepEqual(viable.map((entry) => entry.pokemonId), [27]);
  assert.equal(rejected.generation, 2);
});

test('global source can assemble a legal single-generation team after reference and hint conflicts', () => {
  const result = buildWithSources((slot) => [
    [candidate(25, 'reference', 'leftovers')],
    [candidate(26, 'trainer-pool', 'choice-band', 9)],
    [candidate(100 + slot, 'global-pool', ['scope_lens', 'white_herb', 'quick_claw'][slot])],
  ], new Set([25]));
  assert.equal(result.team.length, 3);
  assert.ok(result.team.every((member) => member.source === 'global-pool'));
  assert.equal(result.attempts, 3);
  assert.ok(result.rejected['species-conflict'] > 0);
  assert.ok(result.rejected.generation > 0);
});

test('unsatisfiable global pool remains bounded at 75 attempts with classified rejection counts', () => {
  const result = buildWithSources(() => [
    [candidate(25, 'reference', 'leftovers')],
    [candidate(900, 'trainer-pool', 'quick_claw', 9)],
    [candidate(201, 'global-pool', 'scope_lens')],
  ], new Set([25]));
  assert.equal(result.team.length, 0);
  assert.equal(result.attempts, 75);
  assert.equal(result.rejected['species-conflict'], 75);
  assert.equal(result.rejected.generation, 75);
  assert.equal(result.rejected.banned, 75);
});

test('equipment aliases, evolution stage and quality band are rejected before selection', () => {
  const rejected = emptyPoolRejectCounts();
  const viable = choosePoolCandidates([
    candidate(1, 'reference', 'choice-band'),
    { ...candidate(2, 'reference', 'scope_lens'), stage: 'FINAL' },
    { ...candidate(3, 'reference', 'quick_claw'), quality: 200 },
    candidate(4, 'global-pool', 'white_herb'),
  ], {
    selectedGeneration: 1, pickedSpecies: new Set<number>(), pickedItems: new Set(['choice_band']),
    bannedSpecies: new Set<number>(), requiredStage: 'BASE', minQuality: 300, maxQuality: 500,
  }, rejected);
  assert.deepEqual(viable.map((entry) => entry.pokemonId), [4]);
  assert.equal(rejected['item-conflict'], 1);
  assert.equal(rejected['evolution-stage'], 1);
  assert.equal(rejected['quality-band'], 1);
});
