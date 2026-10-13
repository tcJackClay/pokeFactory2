import test from 'node:test';
import assert from 'node:assert/strict';
import type { StatStages } from '../../../../types';
import { hasItemBattleEffect, itemHasHook } from '../../data/battle';
import { RESTORABLE_STAT_STAGE_KEYS, planWhiteHerbActivation } from './resolveWhiteHerb';

function stages(overrides: Partial<StatStages> = {}): StatStages {
  return { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0, evasion: 0, ...overrides };
}

test('白色香草的生效条件由 itemEffects 的声明驱动（effectId + hook）', () => {
  assert.equal(hasItemBattleEffect('white_herb', 'WHITE_HERB'), true);
  assert.equal(itemHasHook('white_herb', 'restore-lowered-stats'), true);
  // 没有声明的道具一律不响应，逻辑里不出现道具 ID 字面量。
  assert.equal(planWhiteHerbActivation('mental_herb', stages({ attack: -1 })).shouldActivate, false);
  assert.equal(planWhiteHerbActivation('leftovers', stages({ attack: -1 })).shouldActivate, false);
  assert.equal(planWhiteHerbActivation(undefined, stages({ attack: -1 })).shouldActivate, false);
  assert.equal(planWhiteHerbActivation('', stages({ attack: -1 })).shouldActivate, false);
});

test('能力等级全为 0 或更高时不触发、不消耗', () => {
  assert.deepEqual(planWhiteHerbActivation('white_herb', stages()), {
    shouldActivate: false,
    statStages: stages(),
    restoredStatKeys: [],
  });
  assert.deepEqual(planWhiteHerbActivation('white_herb', stages({ attack: 2, speed: 6 })).restoredStatKeys, []);
});

test('被对手降低的能力等级复原为 0（而非还原到事件之前的值）', () => {
  const before = stages({ attack: -2, spAtk: -1 });
  const plan = planWhiteHerbActivation('white_herb', before);
  assert.equal(plan.shouldActivate, true);
  assert.deepEqual(plan.restoredStatKeys, ['attack', 'spAtk']);
  assert.deepEqual(plan.statStages, stages());
  // 输入不被就地改写（战斗状态按不可变方式更新）。
  assert.deepEqual(before, stages({ attack: -2, spAtk: -1 }));
});

test('复原范围覆盖全部能力等级：攻击/防御/特攻/特防/速度/命中/闪避', () => {
  assert.deepEqual([...RESTORABLE_STAT_STAGE_KEYS], ['attack', 'defense', 'spAtk', 'spDef', 'speed', 'accuracy', 'evasion']);
  const lowered: Partial<StatStages> = {
    attack: -1, defense: -3, spAtk: -2, spDef: -1, speed: -6, accuracy: -1, evasion: -1,
  };
  const plan = planWhiteHerbActivation('white_herb', stages(lowered));
  assert.equal(plan.shouldActivate, true);
  assert.deepEqual(plan.restoredStatKeys, [...RESTORABLE_STAT_STAGE_KEYS]);
  assert.deepEqual(plan.statStages, stages());
});

test('只复原低于 0 的能力等级，正值等级原样保留', () => {
  const plan = planWhiteHerbActivation('white_herb', stages({ attack: 3, defense: -2, speed: 6 }));
  assert.equal(plan.shouldActivate, true);
  assert.deepEqual(plan.restoredStatKeys, ['defense']);
  assert.deepEqual(plan.statStages, stages({ attack: 3, speed: 6 }));
});

test('参考实现口径：已经 -6 的极端等级也一并复原（不设下限裁剪）', () => {
  const plan = planWhiteHerbActivation('white_herb', stages({ defense: -6 }));
  assert.equal(plan.shouldActivate, true);
  assert.deepEqual(plan.statStages, stages());
});
