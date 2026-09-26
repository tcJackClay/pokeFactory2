import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAbilityNames } from './pokeApi';

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
