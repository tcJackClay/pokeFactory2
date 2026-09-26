import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPokeApiUrl,
  fetchPokeApiJsonByResourceUrl,
  getPokemonHomeSpriteUrl,
  getPokemonOfficialArtworkUrl,
  getPokemonSpriteUrl,
  proxyExternalResourceUrl,
  proxyExternalResourceUrls,
} from './pokeApiEndpoint';

test('PokeAPI 与精灵资源默认使用同源服务器路由', () => {
  assert.equal(buildPokeApiUrl('pokemon/25'), '/api/pokeapi/pokemon/25/');
  assert.equal(getPokemonSpriteUrl(25), '/api/pokeapi-sprites/pokemon/25.png');
  assert.equal(getPokemonHomeSpriteUrl(25), '/api/pokeapi-sprites/pokemon/other/home/25.png');
  assert.equal(getPokemonOfficialArtworkUrl(25), '/api/pokeapi-sprites/pokemon/other/official-artwork/25.png');
});

test('外部 PokeAPI 与 GitHub Raw 地址被收敛到服务器代理', () => {
  assert.equal(
    proxyExternalResourceUrl('https://pokeapi.co/api/v2/pokemon-species/25/'),
    '/api/pokeapi/pokemon-species/25/',
  );
  assert.equal(
    proxyExternalResourceUrl('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png'),
    '/api/pokeapi-sprites/pokemon/25.png',
  );
  assert.equal(
    proxyExternalResourceUrl('https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv/moves.csv'),
    '/api/pokedex-csv/moves.csv',
  );
  assert.equal(
    proxyExternalResourceUrl('https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/25.ogg'),
    '/api/pokeapi-cries/pokemon/latest/25.ogg',
  );
});

test('PokeAPI 响应中的嵌套外部资源地址会被递归改写', () => {
  const rewritten = proxyExternalResourceUrls({
    species: { url: 'https://pokeapi.co/api/v2/pokemon-species/25/' },
    sprites: [
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png',
    ],
  });

  assert.deepEqual(rewritten, {
    species: { url: '/api/pokeapi/pokemon-species/25/' },
    sprites: ['/api/pokeapi-sprites/pokemon/25.png'],
  });
});

test('resource JSON body timeout aborts and a later retry can succeed', async () => {
  const originalFetch = globalThis.fetch;
  let signal: AbortSignal | undefined;
  try {
    globalThis.fetch = (async (_url, init) => {
      signal = init?.signal as AbortSignal;
      return { ok: true, json: async () => new Promise(() => {}) } as Response;
    }) as typeof fetch;
    await assert.rejects(fetchPokeApiJsonByResourceUrl('https://example.test/data', 25), /timed out/);
    assert.equal(signal?.aborted, true);

    globalThis.fetch = (async () => ({ ok: true, json: async () => ({ name: 'retry-ok' }) }) as Response) as typeof fetch;
    assert.deepEqual(await fetchPokeApiJsonByResourceUrl('https://example.test/data', 100), { name: 'retry-ok' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('one caller timeout does not abort another caller sharing a PokeAPI resource', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  let sharedSignal: AbortSignal | undefined;
  try {
    globalThis.fetch = (async (_url, init) => {
      requestCount += 1;
      sharedSignal = init?.signal as AbortSignal;
      return {
        ok: true,
        json: async () => new Promise((resolve) => setTimeout(() => resolve({ name: 'shared-ok' }), 60)),
      } as Response;
    }) as typeof fetch;
    const shortWait = fetchPokeApiJsonByResourceUrl('/api/pokeapi/pokemon/999991/', 10);
    const longWait = fetchPokeApiJsonByResourceUrl('/api/pokeapi/pokemon/999991/', 200);
    await assert.rejects(shortWait, /timed out/);
    assert.deepEqual(await longWait, { name: 'shared-ok' });
    assert.equal(requestCount, 1);
    assert.equal(sharedSignal?.aborted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
