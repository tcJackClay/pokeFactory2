import test from 'node:test';
import assert from 'node:assert/strict';
import { ROGUE_MOVE_ITEM_FLAGS as flags, ROGUE_MOVE_ITEM_FLAGS_SOURCE as source } from './rogueMoveItemFlags';

test('fixed ordinary source distinguishes contact, secondary boosts and recovery restrictions', () => {
  // Independently checked ordinary source records, not expected values built by the extractor.
  assert.deepEqual(flags['dark-pulse'], { makesContact: false, ignoresKingsRock: false, sheerForceBoost: true, healBlockBanned: false });
  assert.deepEqual(flags['iron-head'], { makesContact: true, ignoresKingsRock: false, sheerForceBoost: true, healBlockBanned: false });
  assert.deepEqual(flags['rapid-spin'], { makesContact: true, ignoresKingsRock: false, sheerForceBoost: false, healBlockBanned: false });
  assert.equal(flags.tackle.makesContact, true);
  assert.equal(flags.earthquake.makesContact, false);
  assert.equal(flags['aqua-jet'].makesContact, true);
  assert.equal(flags.struggle.makesContact, true);
  assert.equal(flags.absorb.healBlockBanned, true);
  assert.equal(flags.rest.healBlockBanned, true);
  assert.equal(flags['heal-pulse'].healBlockBanned, true);
  assert.equal(flags['floral-healing'].healBlockBanned, true);
  assert.equal(flags['pain-split'].healBlockBanned, false);
  assert.equal(flags.present.healBlockBanned, false);
});

test('unknown identities remain absent and PokeAPI alias spelling is retained', () => {
  for (const name of ['unknown', 'none', 'swirling-blade', 'g-max-wildfire', 'vise-grip', 'breakneck-blitz']) assert.equal(flags[name], undefined);
  assert.equal(flags['vice-grip'].makesContact, true);
  assert.deepEqual(flags['breakneck-blitz--physical'], flags['breakneck-blitz--special']);
  assert.ok(flags['10-000-000-volt-thunderbolt']);
});

test('coverage and provenance freeze the selected normal GEN9 profile', () => {
  assert.equal(source.sha, 'a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014');
  assert.equal(source.profile, 'normal');
  assert.equal(source.generations.GEN_LATEST, source.generations.GEN_9);
  assert.equal(source.generations.B_UPDATED_MOVE_FLAGS, source.generations.GEN_9);
  assert.equal(source.generations.B_HEAL_BLOCKING, source.generations.GEN_9);
  assert.equal(Object.keys(flags).length, 919);
  assert.equal(Object.values(flags).filter((row) => row.ignoresKingsRock).length, 0);
  assert.equal(Object.values(flags).filter((row) => row.makesContact).length, 271);
  assert.equal(Object.values(flags).filter((row) => row.sheerForceBoost).length, 193);
  assert.equal(Object.values(flags).filter((row) => row.healBlockBanned).length, 36);
});
