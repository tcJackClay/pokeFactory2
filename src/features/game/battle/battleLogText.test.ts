import test from 'node:test';
import assert from 'node:assert/strict';

import { battleAilmentName, battleHeldItemName, battleItemMessage, battleStatName } from './battleLogText';

test('controller item messages use complete Chinese sentences and localized names', () => {
  const item = battleHeldItemName('sitrus_berry', 'Sitrus Berry', 'zh-hans');
  const status = battleAilmentName('confusion', 'zh-hans');
  const stat = battleStatName('attack', 'zh-hans');
  const lines = [
    battleItemMessage('zh-hans', 'cure', '触手百合', item, status),
    battleItemMessage('zh-hans', 'heal', '触手百合', item),
    battleItemMessage('zh-hans', 'stat', '触手百合', item, stat),
    battleItemMessage('zh-hans', 'restoreStats', '触手百合', battleHeldItemName('white_herb', 'White Herb', 'zh-hans')),
    battleItemMessage('zh-hans', 'mentalCure', '触手百合', battleHeldItemName('mental_herb', 'Mental Herb', 'zh-hans'), battleAilmentName('taunt', 'zh-hans')),
  ];
  assert.ok(lines.every((line) => /！$/.test(line)));
  assert.ok(lines.every((line) => !/\b(?:with|rose|cured|restored|recovered)\b|\b[A-Z][a-z]+ Berry\b|'s/.test(line)));
  assert.match(lines[0], /木子果|文柚果/);
  assert.match(lines[2], /攻击提高了/);
  assert.match(lines[4], /挑衅/);
});

test('controller item messages remain readable in English', () => {
  const item = battleHeldItemName('sitrus_berry', 'Sitrus Berry', 'en');
  assert.equal(battleItemMessage('en', 'heal', 'Cradily', item), 'Cradily restored HP with Sitrus Berry!');
  assert.equal(battleItemMessage('en', 'stat', 'Cradily', item, battleStatName('attack', 'en')),
    "Cradily's Attack rose with Sitrus Berry!");
  assert.equal(battleItemMessage('en', 'cure', 'Cradily', item, battleAilmentName('confusion', 'en')),
    'Cradily cured its confusion with Sitrus Berry!');
});
