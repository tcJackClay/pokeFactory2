import test from 'node:test';
import assert from 'node:assert/strict';
import { getFactorySpeciesIndexEntry, preloadFactorySpeciesIndex } from './factorySpeciesIndex';

test('stalled species index times out, clears its shared request, and can be retried', async () => {
  const originalFetch = globalThis.fetch;
  let signal: AbortSignal | undefined;
  try {
    globalThis.fetch = (async (_url, init) => {
      signal = init?.signal as AbortSignal;
      return new Promise<Response>(() => {});
    }) as typeof fetch;
    await assert.rejects(preloadFactorySpeciesIndex(25), /timed out/);
    assert.equal(signal?.aborted, true);

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => [{ identifier: '1', speciesId: 1, pokemonId: 1, gen: 1, bst: 318, evolutionStage: 'BASE' }],
    }) as Response) as typeof fetch;
    await preloadFactorySpeciesIndex(100);
    assert.equal((await getFactorySpeciesIndexEntry(1))?.pokemonId, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
