import assert from 'node:assert/strict';
import test from 'node:test';
import { TYPE_ZH } from '../constants';
import { getTypeBadgeLabel } from './typeBadgeLabels';

test('all known type badges follow the selected language', () => {
  for (const [type, chinese] of Object.entries(TYPE_ZH)) {
    assert.equal(getTypeBadgeLabel(type, 'zh-hans'), chinese, type);
    assert.equal(getTypeBadgeLabel(type, 'en'), type[0].toUpperCase() + type.slice(1), type);
  }
});

test('type labels remain readable for composite or unknown IDs', () => {
  assert.equal(getTypeBadgeLabel('stellar_type', 'en'), 'Stellar Type');
  assert.equal(getTypeBadgeLabel('stellar_type', 'zh-hans'), 'stellar_type');
});
