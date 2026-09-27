import test from 'node:test';
import assert from 'node:assert/strict';
import type { GamePokemon } from '../../../types';
import {
  findFactoryHeldItemDuplicates,
  getFactoryHeldItemBaselines,
  getFactoryHeldItemInTeamIds,
  isFactoryHeldItemTeamUnique,
  repairFactoryHeldItemBaselines,
} from './factoryHeldItemRules';

/** 只关心持有物三字段的轻量夹具。 */
function member(baseline: string | null, original: string | null = baseline, current?: string | null): GamePokemon {
  return {
    factoryEquippedHeldItemId: baseline,
    factoryOriginalHeldItemId: original,
    factoryHeldItemId: current === undefined ? baseline ?? undefined : current ?? undefined,
  } as unknown as GamePokemon;
}

test('detection reads only the run baseline, never the spent current item', () => {
  // 本场当前持有物被消耗/拍落（undefined）不影响「在队」判定。
  const spent = [member('scope_lens', 'scope_lens', null), member(null, null, null), member(null, null, null)];
  assert.deepEqual(getFactoryHeldItemBaselines(spent), ['scope_lens', null, null]);
  assert.deepEqual(getFactoryHeldItemInTeamIds(spent), ['scope_lens']);
  assert.equal(isFactoryHeldItemTeamUnique(spent), true);

  const duplicated = [member('scope_lens'), member('quick_claw'), member('scope_lens')];
  assert.deepEqual(findFactoryHeldItemDuplicates(duplicated), [{ itemId: 'scope_lens', indices: [0, 2] }]);
  assert.equal(isFactoryHeldItemTeamUnique(duplicated), false);
});

test('detection normalizes dashes, underscores and case before comparing', () => {
  const team = [member('scope-lens'), member('SCOPE_LENS'), member(' quick_claw ')];
  assert.deepEqual(findFactoryHeldItemDuplicates(team), [{ itemId: 'scope_lens', indices: [0, 1] }]);
});

test('repair falls a duplicate back to its rental original without touching the original field', () => {
  const team = [member('scope_lens', 'leftovers'), member('scope_lens', 'quick_claw'), member(null, 'kings_rock')];
  const repair = repairFactoryHeldItemBaselines(team);
  assert.equal(repair.repaired, true);
  assert.deepEqual(getFactoryHeldItemBaselines(repair.team), ['scope_lens', 'quick_claw', null]);
  assert.deepEqual(repair.repairedIndices, [1]);
  assert.deepEqual(repair.clearedIndices, []);
  // 原配字段一字不动、且从未被丢弃。
  assert.deepEqual(repair.team.map((entry) => entry.factoryOriginalHeldItemId), ['leftovers', 'quick_claw', 'kings_rock']);
});

test('repair clears the baseline only when the rental original is also held in team', () => {
  const team = [member('scope_lens', 'scope_lens'), member('scope_lens', 'scope_lens'), member('scope_lens', 'scope_lens')];
  const repair = repairFactoryHeldItemBaselines(team);
  assert.deepEqual(getFactoryHeldItemBaselines(repair.team), ['scope_lens', null, null]);
  assert.deepEqual(repair.repairedIndices, [1, 2]);
  assert.deepEqual(repair.clearedIndices, [1, 2]);
  assert.equal(isFactoryHeldItemTeamUnique(repair.team), true);
  // 原配仍是租借原配，未被改写。
  assert.deepEqual(repair.team.map((entry) => entry.factoryOriginalHeldItemId), ['scope_lens', 'scope_lens', 'scope_lens']);
});

test('kept indices win over the lowest-index holder', () => {
  const team = [member('scope_lens', 'leftovers'), member('scope_lens', 'quick_claw'), member(null, null)];
  const repair = repairFactoryHeldItemBaselines(team, { keepIndices: [1] });
  assert.deepEqual(getFactoryHeldItemBaselines(repair.team), ['leftovers', 'scope_lens', null]);
  assert.deepEqual(repair.repairedIndices, [0]);
});

test('a unique team is returned untouched and reports no repair', () => {
  const team = [member('scope_lens'), member('quick_claw'), member(null)];
  const repair = repairFactoryHeldItemBaselines(team);
  assert.equal(repair.repaired, false);
  assert.deepEqual(repair.repairedIndices, []);
  assert.deepEqual(repair.duplicates, []);
  assert.equal(repair.team[0], team[0]);
  assert.equal(repair.team[1], team[1]);
  assert.equal(repair.team[2], team[2]);
});

test('repair is idempotent: re-running on its own output changes nothing', () => {
  const team = [member('scope_lens', 'scope_lens'), member('scope_lens', 'scope_lens'), member('scope_lens', 'kings_rock')];
  const once = repairFactoryHeldItemBaselines(team);
  const twice = repairFactoryHeldItemBaselines(once.team);
  assert.equal(twice.repaired, false);
  assert.deepEqual(getFactoryHeldItemBaselines(twice.team), getFactoryHeldItemBaselines(once.team));
});
