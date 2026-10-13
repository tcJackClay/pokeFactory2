import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAbilityNames, fetchPokemonLite, getSpeciesBaseFriendship } from './pokeApi';

test('form-only evolution target resolves its exact form and base Pokemon resource', async () => {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  try {
    globalThis.fetch = (async (input) => {
      const url = String(input);
      requested.push(url);
      const resourceUrl = url.replace(/\/$/, '');
      const payload = resourceUrl.endsWith('/pokemon-form/polteageist-antique')
        ? { name: 'polteageist-antique', pokemon: { name: 'polteageist' }, sprites: { front_default: '/antique.png' } }
        : resourceUrl.endsWith('/pokemon/polteageist')
          ? { id: 855, name: 'polteageist', species: { url: '/api/pokeapi/pokemon-species/855/' }, sprites: { front_default: '/base.png', back_default: '/back.png' }, stats: [], types: [], abilities: [], moves: [] }
          : null;
      return { ok: Boolean(payload), status: payload ? 200 : 404, json: async () => payload } as Response;
    }) as typeof fetch;
    const result = await fetchPokemonLite('polteageist-antique');
    assert.equal(result.name, 'polteageist-antique');
    assert.equal(result.sprites.front_default, '/antique.png');
    assert.equal(result.sprites.back_default, '/back.png');
    assert.deepEqual(requested.map((url) => url.replace(/\/$/, '')), ['/api/pokeapi/pokemon-form/polteageist-antique', '/api/pokeapi/pokemon/polteageist']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rental and reference-set friendship starts at species base happiness', () => {
  assert.equal(getSpeciesBaseFriendship({ base_happiness: 0 }), 0);
  assert.equal(getSpeciesBaseFriendship({ base_happiness: 70 }), 70);
  assert.equal(getSpeciesBaseFriendship({ base_happiness: 255 }), 255);
  assert.equal(getSpeciesBaseFriendship(null), 70);
});

test('missing ability names are not cached and can be retried after content recovery', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  const url = 'https://ability-retry.example.test/ability/unique-retry';
  try {
    globalThis.fetch = (async () => {
      requestCount += 1;
      return {
        ok: true,
        json: async () => ({ names: requestCount === 1 ? [] : [{ name: '叶绿素', language: { name: 'zh-Hans' } }] }),
      } as Response;
    }) as typeof fetch;
    assert.deepEqual(await fetchAbilityNames(url), []);
    assert.equal((await fetchAbilityNames(url))[0]?.name, '叶绿素');
    assert.equal(requestCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
