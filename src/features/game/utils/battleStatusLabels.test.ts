import test from 'node:test';
import assert from 'node:assert/strict';

import { getBattleStatusLabel } from './battleStatusLabels';

test('battle HUD labels localize active status IDs in both languages', () => {
  assert.equal(getBattleStatusLabel('uproar', 'zh-hans'), '大闹');
  assert.equal(getBattleStatusLabel('uproar', 'en'), 'Uproar');
  assert.equal(getBattleStatusLabel('bad_poison', 'zh-hans'), '剧毒');
  assert.equal(getBattleStatusLabel('bad_poison', 'en'), 'Badly Poisoned');
  assert.equal(getBattleStatusLabel('light-screen', 'zh-hans'), '光墙');
  assert.equal(getBattleStatusLabel('flash_fire', 'en'), 'Flash Fire');
});

test('unknown status IDs never leak snake_case into the HUD', () => {
  assert.equal(getBattleStatusLabel('future_effect', 'zh-hans'), '特殊状态');
  assert.equal(getBattleStatusLabel('future_effect', 'en'), 'Future Effect');
});
