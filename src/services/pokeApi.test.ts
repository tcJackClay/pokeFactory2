import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAbilityNames, getSpeciesBaseFriendship } from './pokeApi';

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
