import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMove } from './audit_rogue_tm_effects.mts';

const base = {
  id: 1,
  name: 'quiver-dance',
  type: { name: 'bug' },
  damage_class: { name: 'status' },
  target: { name: 'user' },
  meta: { ailment: { name: 'none' } },
  flags: [],
  stat_changes: [
    { stat: { name: 'special-attack' }, change: 1 },
    { stat: { name: 'special-defense' }, change: 1 },
    { stat: { name: 'speed' }, change: 1 },
  ],
};

test('cache absence keeps Freeze-Dry and Quiver Dance unassessed', () => {
  for (const [tm, symbol, expectedPath] of [['TM17', 'MOVE_FREEZE_DRY', 'dedicated-override-unloaded'], ['TM33', 'MOVE_QUIVER_DANCE', 'generic-unloaded']]) {
    const row = classifyMove(tm, symbol);
    assert.equal(row.localCache, 'missing');
    assert.equal(row.battleResolution, expectedPath);
    assert.equal(row.idMappingVerified, false);
    assert.ok((row.obviousMechanismGaps as string[]).length > 0);
  }
});

test('Quiver Dance synthetic payload converts to three generic stat effects', () => {
  const row = classifyMove('TM33', 'MOVE_QUIVER_DANCE', { raw: base, bodySha256: 'test' });
  assert.equal(row.localLoader, 'buildMoveBattleDataFromPokeApiMove-ok');
  assert.equal(row.battleResolution, 'generic-damage-or-secondary-effects');
  const effects = row.secondaryEffects as { kind: string; stat: string; change: number }[];
  assert.deepEqual(effects.map(({ kind, stat, change }) => [kind, stat, change]), [
    ['stat-stage', 'spAtk', 1],
    ['stat-stage', 'spDef', 1],
    ['stat-stage', 'speed', 1],
  ]);
});

test('Freeze-Dry synthetic payload selects its dedicated effect ID', () => {
  const raw = { ...base, id: 573, name: 'freeze-dry', type: { name: 'ice' }, damage_class: { name: 'special' }, stat_changes: [] };
  const row = classifyMove('TM17', 'MOVE_FREEZE_DRY', { raw, bodySha256: 'test' });
  assert.equal(row.effectId, 'FREEZE_DRY');
  assert.equal(row.battleResolution, 'dedicated-effect-or-field-override');
  assert.equal(row.idMappingVerified, false);
});
