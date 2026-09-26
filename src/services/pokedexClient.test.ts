import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeDexMoveNameFallback } from './pokedexClient';

test('CSV move names prefer simplified Chinese regardless of row order', () => {
  const traditionalFirst = mergeDexMoveNameFallback(
    mergeDexMoveNameFallback({}, 'zh-hant', '十萬伏特'),
    'zh-hans',
    '十万伏特',
  );
  const simplifiedFirst = mergeDexMoveNameFallback(
    mergeDexMoveNameFallback({}, 'zh-hans', '十万伏特'),
    'zh-hant',
    '十萬伏特',
  );
  assert.equal(traditionalFirst.zh, '十万伏特');
  assert.equal(simplifiedFirst.zh, '十万伏特');
  assert.equal(mergeDexMoveNameFallback({}, 'zh-hant', '十萬伏特').zh, '十萬伏特');
});
