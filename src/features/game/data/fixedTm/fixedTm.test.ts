import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { identities } from './generated';
import {
  catalog, getFixedTmAdmission, getFixedTmEligibility, getFixedTmSaleReadiness,
  getTeamFixedTmEligibility, listLearnableFixedTms, resolveFixedTmIdentity,
} from './query';
import { loadFixedTmCatalog } from './index';

const pikachu = { pokemonId: 25, speciesId: 25 };

test('fixed catalog retains 50 unique project identities and pinned ordinary source', () => {
  assert.deepEqual(catalog.tms.map((tm) => tm.number), Array.from({ length: 50 }, (_, i) => i + 1));
  assert.equal(new Set(catalog.tms.map((tm) => tm.moveName)).size, 50);
  assert.equal(catalog.tms[16].moveName, 'freeze-dry');
  assert.equal(catalog.tms[32].moveName, 'quiver-dance');
  assert.equal(catalog.source.commit, 'a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014');
  assert.equal(catalog.source.profileMode, 'ordinary');
  assert.equal(identities.length, 1076);
});

test('every shipped mapping and compatibility entry is represented in runtime queries', () => {
  for (const row of identities) {
    const resolved = resolveFixedTmIdentity(row);
    assert.equal(resolved.status, 'resolved');
    assert.deepEqual(listLearnableFixedTms(row, []).map((tm) => tm.number), row.tmNumbers);
    for (const tm of catalog.tms) {
      assert.equal(getFixedTmEligibility(row, tm.moveName, []).compatible, row.tmNumbers.includes(tm.number));
    }
  }
});

test('dex boundaries and all ten explicit form exceptions resolve exact source aliases', () => {
  const expectations = {
    '1': 'SPECIES_BULBASAUR', '1025': 'SPECIES_PECHARUNT',
    'wormadam-sandy': 'SPECIES_WORMADAM_SANDY_CLOAK',
    'wormadam-trash': 'SPECIES_WORMADAM_TRASH_CLOAK',
    'zacian-crowned': 'SPECIES_ZACIAN_CROWNED_SWORD',
    'zamazenta-crowned': 'SPECIES_ZAMAZENTA_CROWNED_SHIELD',
    'urshifu-rapid-strike': 'SPECIES_URSHIFU_RAPID_STRIKE_STYLE',
    'tauros-paldea-combat-breed': 'SPECIES_TAUROS_PALDEAN_COMBAT_BREED',
    'tauros-paldea-blaze-breed': 'SPECIES_TAUROS_PALDEAN_BLAZE_BREED',
    'tauros-paldea-aqua-breed': 'SPECIES_TAUROS_PALDEAN_AQUA_BREED',
    'wooper-paldea': 'SPECIES_WOOPER_PALDEAN',
    'maushold-family-of-three': 'SPECIES_MAUSHOLD',
  };
  for (const [identifier, alias] of Object.entries(expectations)) {
    const row = identities.find((entry) => entry.identifier === identifier)!;
    const resolved = resolveFixedTmIdentity(row);
    assert.equal(resolved.status, 'resolved');
    if (resolved.status === 'resolved') assert.equal(resolved.identity.sourceAlias, alias);
  }
  assert.equal(getFixedTmEligibility({ pokemonId: 10008, speciesId: 479, identifier: 'rotom-heat' }, 'overheat', []).status, 'eligible');
  assert.equal(getFixedTmEligibility({ pokemonId: 479, speciesId: 479 }, 'overheat', []).status, 'incompatible');
});

test('unknown and conflicting identities never fall back to a known base species', () => {
  assert.equal(resolveFixedTmIdentity({ pokemonId: 99999, speciesId: 25 }).status, 'unknown-identity');
  assert.equal(resolveFixedTmIdentity({ pokemonId: 10008, speciesId: 25 }).status, 'identity-conflict');
  assert.equal(resolveFixedTmIdentity({ pokemonId: 10008, speciesId: 479, identifier: '479' }).status, 'identity-conflict');
  assert.equal(resolveFixedTmIdentity({ ...pikachu, identifier: 'pikachu-unverified-form' }).status, 'identity-conflict');
  for (const value of [0, -1, 1.5, NaN, Infinity, undefined, '25']) {
    assert.equal(resolveFixedTmIdentity({ pokemonId: value as number, speciesId: 25 }).status, 'unknown-identity');
    assert.equal(resolveFixedTmIdentity({ pokemonId: 25, speciesId: value as number }).status, 'unknown-identity');
  }
  assert.deepEqual(listLearnableFixedTms({ pokemonId: 99999, speciesId: 25 }, []), []);
});

test('source compatibility, known move and unknown TM diagnostics are distinct', () => {
  assert.equal(getFixedTmEligibility(pikachu, 'thunder-wave', []).status, 'eligible');
  assert.equal(getFixedTmEligibility(pikachu, 'earthquake', []).status, 'incompatible');
  const alreadyKnown = getFixedTmEligibility(pikachu, 'thunder-wave', ['thunder-wave']);
  assert.equal(alreadyKnown.status, 'already-known');
  assert.equal(alreadyKnown.compatible, true);
  assert.equal(alreadyKnown.alreadyKnown, true);
  assert.ok(!listLearnableFixedTms(pikachu, ['thunder-wave']).some((tm) => tm.moveName === 'thunder-wave'));
  for (const id of [132, 201]) {
    assert.equal(resolveFixedTmIdentity({ pokemonId: id, speciesId: id }).status, 'resolved');
    assert.equal(getFixedTmEligibility({ pokemonId: id, speciesId: id }, 'thunder-wave', []).status, 'incompatible');
    assert.deepEqual(listLearnableFixedTms({ pokemonId: id, speciesId: id }, []), []);
  }
  assert.equal(getFixedTmEligibility(pikachu, 'tackle', []).status, 'unknown-tm');
});

test('team learning candidates identify only members compatible and not already knowing the move', () => {
  const members = [
    { identity: pikachu, knownMoveNames: ['thunder-wave'] },
    { identity: pikachu, knownMoveNames: [] },
    { identity: { pokemonId: 132, speciesId: 132 }, knownMoveNames: [] },
  ];
  assert.deepEqual(getTeamFixedTmEligibility(members).tms.find((row) => row.tm.moveName === 'thunder-wave')?.memberIndexes, [1]);
  const allKnown = catalog.tms.map((tm) => tm.moveName);
  const noCandidates = getTeamFixedTmEligibility([
    { identity: pikachu, knownMoveNames: allKnown }, members[2],
    { identity: { pokemonId: 99999, speciesId: 25 }, knownMoveNames: [] },
  ]);
  assert.deepEqual(noCandidates.tms, []);
  assert.equal(noCandidates.members[2].status, 'unknown-identity');
  assert.deepEqual(getTeamFixedTmEligibility([]), { members: [], tms: [] });
});

test('all 50 TMs remain unsaleable regardless of compatible members', () => {
  for (const tm of catalog.tms) {
    const admission = getFixedTmAdmission(tm.moveName)!;
    assert.equal(admission.status, 'pending');
    assert.equal(admission.fixedContentEvidence, null);
    assert.equal(admission.battleEvidence, null);
    assert.equal(admission.price, null);
    const sale = getFixedTmSaleReadiness(tm.moveName, identities.map((identity) => ({ identity, knownMoveNames: [] })));
    assert.equal(sale.saleEligible, false);
    assert.ok(sale.blockers.includes('not-admitted'));
    assert.ok(sale.blockers.includes('fixed-content-unverified'));
    assert.ok(sale.blockers.includes('battle-unverified'));
    assert.ok(sale.blockers.includes('price-unapproved'));
  }
  assert.deepEqual(getFixedTmSaleReadiness('tackle', []).blockers, ['unknown-tm']);
  assert.ok(getFixedTmSaleReadiness('thunder-wave', []).blockers.includes('no-eligible-member'));
  assert.deepEqual(getFixedTmSaleReadiness('thunder-wave', [{ identity: pikachu, knownMoveNames: [] }]).eligibleMemberIndexes, [0]);
});

test('consumer-facing catalog and mapped qualification data cannot be changed', () => {
  assert.ok(Object.isFrozen(catalog));
  assert.ok(Object.isFrozen(catalog.tms));
  assert.ok(Object.isFrozen(catalog.tms[0]));
  const resolved = resolveFixedTmIdentity(pikachu);
  assert.equal(resolved.status, 'resolved');
  if (resolved.status === 'resolved') {
    assert.ok(Object.isFrozen(resolved.identity));
    assert.ok(Object.isFrozen(resolved.identity.tmNumbers));
  }
  assert.ok(Object.isFrozen(getFixedTmAdmission('thunder-wave')));
});

test('lazy entry shares load promise and requires no fetch or research output at runtime', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error('Unexpected remote request'); }) as typeof fetch;
  try {
    const first = loadFixedTmCatalog();
    assert.equal(first, loadFixedTmCatalog());
    const loaded = await first;
    assert.equal(loaded.getFixedTmEligibility(pikachu, 'thunder-wave', []).status, 'eligible');
    assert.equal(loaded.catalog.tms.length, 50);
    assert.equal(first, loadFixedTmCatalog());
  } finally {
    globalThis.fetch = originalFetch;
  }
  for (const name of ['index.ts', 'query.ts', 'generated.ts', 'admission.ts']) {
    const sourceText = fs.readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
    assert.ok(!/from\s+['"][^'"]*(?:output|[A-Z]:\/)/i.test(sourceText));
    assert.ok(!/\bfetch\s*\(/.test(sourceText));
  }
});
