import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchDexMoveNameFallbacks } from './pokedexClient';

test('move name lookup reads CSV translations without waiting for move detail requests', async () => {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  const csvByFile: Record<string, string> = {
    'languages.csv': 'id,identifier\n9,en\n12,zh-hans\n',
    'moves.csv': 'id,identifier\n1,thunderbolt\n',
    'move_names.csv': 'move_id,local_language_id,name\n1,9,Thunderbolt\n1,12,十万伏特\n',
  };
  try {
    globalThis.fetch = (async (input) => {
      const url = String(input);
      requested.push(url);
      const filename = url.split('/').pop() ?? '';
      return { ok: true, text: async () => csvByFile[filename] } as Response;
    }) as typeof fetch;
    const names = await fetchDexMoveNameFallbacks(['THUNDERBOLT', 'missing']);
    assert.deepEqual(names, { thunderbolt: { zh: '十万伏特', en: 'Thunderbolt' } });
    assert.equal(requested.length, 3);
    assert.ok(requested.every((url) => url.includes('/api/pokedex-csv/')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
