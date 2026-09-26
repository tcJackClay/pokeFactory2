import test from 'node:test';
import assert from 'node:assert/strict';
import { getDexMoveDisplayName } from './dexMoveName';

test('Chinese move names use API then CSV translation before an English fallback', () => {
  const fallback = { zh: '十万伏特', en: 'Thunderbolt' };
  assert.equal(getDexMoveDisplayName('thunderbolt', { name: 'thunderbolt', zhName: '十万伏特', enName: 'Thunderbolt', type: 'electric', damageClass: 'special', power: 90 }, fallback, 'zh-hans'), '十万伏特');
  assert.equal(getDexMoveDisplayName('thunderbolt', undefined, fallback, 'zh-hans'), '十万伏特');
  assert.equal(getDexMoveDisplayName('thunderbolt', undefined, { en: 'Thunderbolt' }, 'zh-hans'), 'Thunderbolt');
});

test('English move names remain English and unknown names remain readable', () => {
  const fallback = { zh: '十万伏特', en: 'Thunderbolt' };
  assert.equal(getDexMoveDisplayName('thunderbolt', undefined, fallback, 'en'), 'Thunderbolt');
  assert.equal(getDexMoveDisplayName('double-kick', undefined, undefined, 'en'), 'Double Kick');
  assert.equal(getDexMoveDisplayName('double-kick', undefined, undefined, 'zh-hans'), 'Double Kick');
});
