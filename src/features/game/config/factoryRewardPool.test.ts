import test from 'node:test';
import assert from 'node:assert/strict';
import type { GamePokemon, Move, MoveBattleData } from '../../../types';
import { ITEM_BATTLE_DATA } from '../data/battle/itemEffects';
import {
  FACTORY_REWARD_HELD_ITEM_IDS,
  FACTORY_HELD_ITEM_SHOP_RARITY,
  canEquipFactoryRewardItem,
  drawFactoryShopShelf,
  enumerateFactoryRewardCandidates,
  getFactoryHeldItemShopPrice,
  getFactoryRewardEquippedItemIds,
  getRewardApplicability,
  hasLoadedDiceTrigger,
  isFactoryRewardHeldItemId,
  isFactoryShopProduct,
  normalizeFactoryHeldItemId,
  type FactoryRewardHeldItemId,
} from './factoryRewardPool';
import {
  FACTORY_SHOP_RARITY_PRICES,
  FACTORY_TICKETS_TO_BP_RATE,
  getFactoryShelfSize,
  isFactoryRewardPreBattle,
  shouldEnterRewardAfterWinning,
} from './factoryRewards';

const ALL_ITEM_IDS = Object.keys(ITEM_BATTLE_DATA);
const UNIVERSE: (string | null)[] = [...ALL_ITEM_IDS, null];

function combinations<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  const walk = (start: number, picked: T[]) => {
    if (picked.length === size) {
      result.push([...picked]);
      return;
    }
    for (let index = start; index < values.length; index += 1) {
      picked.push(values[index]);
      walk(index + 1, picked);
      picked.pop();
    }
  };
  walk(0, []);
  return result;
}

function makePokemon(id: number, itemId: string | null): GamePokemon {
  const stats = { hp: 60, attack: 60, defense: 60, spAtk: 60, spDef: 60, speed: 60 };
  return {
    id,
    name: `pokemon-${id}`,
    sprites: { front_default: '', back_default: '' },
    stats: [],
    types: [{ type: { name: 'normal' } }],
    baseTypes: [{ type: { name: 'normal' } }],
    abilities: [],
    moves: [],
    currentHp: 100,
    maxHp: 100,
    selectedMoves: [],
    level: 50,
    nature: { name: 'hardy', zhName: '勤奋', plus: '', minus: '' },
    ivs: stats,
    evs: stats,
    baseStats: stats,
    calculatedStats: stats,
    statStages: { attack: 0, defense: 0, spDef: 0, spAtk: 0, speed: 0, accuracy: 0, evasion: 0 },
    factoryOriginalHeldItemId: itemId,
    factoryEquippedHeldItemId: itemId,
    factoryHeldItemId: itemId ?? undefined,
  };
}

function makeMove(name: string, battleData: Partial<MoveBattleData>): Move {
  return {
    name,
    power: 25,
    accuracy: 90,
    type: 'normal',
    damage_class: 'physical',
    battleData: {
      effectId: 'NONE',
      priority: 0,
      target: 'selected-pokemon',
      flags: [],
      critStage: 0,
      drainPercent: 0,
      recoilPercent: 0,
      healingPercent: 0,
      strikeMode: 'multi-hit',
      minHits: 2,
      maxHits: 5,
      secondaryEffects: [],
      substituteInteraction: 'blocked',
      makesContact: true,
      soundMove: false,
      powderMove: false,
      ballisticMove: false,
      punchMove: false,
      bypassProtect: false,
      ignoreAccuracyCheck: false,
      ...battleData,
    },
  };
}

/** 抽满货架的确定性夹具：不足即视为测试失败（货架必须恰好 6 件，不允许候选不足）。 */
function drawFullShelf(
  equippedItemIds: readonly (string | null | undefined)[],
  random: () => number,
): FactoryRewardHeldItemId[] {
  const result = drawFactoryShopShelf(equippedItemIds, getFactoryShelfSize(), random);
  if (result.ok === false) throw new Error(`Expected a full shelf but got ${result.candidateCount} candidates.`);
  return result.shelf.map((product) => {
    assert.equal(isFactoryShopProduct(product), true);
    assert.equal(product.kind, 'HELD_ITEM');
    return product.itemId;
  });
}

test('reward anchor is the single numeric source: battle 4/7 pre-battle == won battle 3/6', () => {
  for (let stage = 1; stage <= 21; stage += 1) {
    assert.equal(shouldEnterRewardAfterWinning(stage), isFactoryRewardPreBattle(stage + 1));
  }
  for (const stage of [3, 6, 10, 13, 17, 20]) assert.equal(shouldEnterRewardAfterWinning(stage), true);
  for (const stage of [1, 2, 4, 5, 7, 8, 9, 11, 12, 14, 0, -1, 3.5, NaN]) {
    assert.equal(shouldEnterRewardAfterWinning(stage), false);
  }
  for (const stage of [4, 7, 11, 14]) assert.equal(isFactoryRewardPreBattle(stage), true);
});

test('shelf size is 6 and ticket-to-BP conversion rate is 1:1 from config', () => {
  assert.equal(getFactoryShelfSize(), 6);
  assert.equal(FACTORY_TICKETS_TO_BP_RATE, 1);
  assert.deepEqual(FACTORY_SHOP_RARITY_PRICES, { 1: 1, 2: 2, 3: 3 });
});

test('nine approved held items are the only approved reward ids', () => {
  assert.equal(FACTORY_REWARD_HELD_ITEM_IDS.length, 9);
  const ordered = ['scope_lens', 'quick_claw', 'kings_rock', 'choice_band', 'focus_band', 'heavy_duty_boots', 'loaded_dice', 'white_herb', 'mental_herb'];
  assert.deepEqual([...FACTORY_REWARD_HELD_ITEM_IDS], ordered);
  for (const itemId of FACTORY_REWARD_HELD_ITEM_IDS) assert.equal(isFactoryRewardHeldItemId(itemId), true);
  // 光粉明确排除（decisions.md 第 5 条）。
  for (const itemId of ['leftovers', 'bright_powder', 'battle_atk', 'battle_def', '', 7, null]) {
    assert.equal(isFactoryRewardHeldItemId(itemId), false);
  }
});

test('rarity tiers match the PRD §2.3 finalized table and price = tier number', () => {
  const expected: Record<FactoryRewardHeldItemId, 1 | 2 | 3> = {
    scope_lens: 2,
    quick_claw: 1,
    kings_rock: 2,
    choice_band: 3,
    focus_band: 2,
    heavy_duty_boots: 1,
    loaded_dice: 2,
    white_herb: 1,
    mental_herb: 2,
  };
  assert.deepEqual(FACTORY_HELD_ITEM_SHOP_RARITY, expected);
  for (const itemId of FACTORY_REWARD_HELD_ITEM_IDS) {
    assert.equal(getFactoryHeldItemShopPrice(itemId), expected[itemId]);
  }
  // 未知道具不默认免费。
  assert.equal(getFactoryHeldItemShopPrice('leftovers'), null);
  assert.equal(getFactoryHeldItemShopPrice('bright_powder'), null);
});

test('equipped baseline ids normalize dashes and drop empty slots', () => {
  assert.deepEqual(getFactoryRewardEquippedItemIds(['scope-lens', 'SCOPE_LENS', null, '', undefined]), ['scope_lens']);
  assert.equal(normalizeFactoryHeldItemId('quick-claw'), 'quick_claw');
  assert.equal(normalizeFactoryHeldItemId(undefined), null);
  assert.equal(normalizeFactoryHeldItemId(''), null);
});

test('exhaustive: any three of the nine equipped items still yields a full six-item shelf', () => {
  const triples = combinations(FACTORY_REWARD_HELD_ITEM_IDS, 3);
  assert.equal(triples.length, 84);
  for (const equipped of triples) {
    const candidates = enumerateFactoryRewardCandidates(equipped);
    // 三人占九件中的三件 ⇒ |H \ E| = 6，持有道具一类自己就够摆满货架。
    assert.equal(candidates.length, 6, `${equipped.join(',')} -> ${candidates.join(',')}`);
    assert.deepEqual(
      [...candidates].sort(),
      FACTORY_REWARD_HELD_ITEM_IDS.filter((itemId) => !equipped.includes(itemId)).sort(),
    );
    assert.equal(new Set(candidates).size, 6);
    for (const itemId of candidates) {
      // PRD F2 代码断言：每件候选至少一个合法装备对象
      assert.ok(
        [0, 1, 2].some((index) => canEquipFactoryRewardItem(equipped, itemId, index)),
        `${itemId} has no legal teammate for ${equipped.join(',')}`,
      );
    }
    const shelf = drawFullShelf(equipped, () => 0);
    assert.equal(shelf.length, 6);
    assert.equal(new Set(shelf).size, 6);
    for (const itemId of shelf) {
      assert.ok([0, 1, 2].some((index) => canEquipFactoryRewardItem(equipped, itemId, index)));
    }
  }
});

test('sweep: every baseline combination from the whole item table keeps the six-item shelf full', () => {
  let checked = 0;
  for (const size of [1, 2, 3]) {
    for (const equipped of combinations(UNIVERSE, size)) {
      checked += 1;
      const candidates = enumerateFactoryRewardCandidates(equipped);
      const equippedInPool = equipped.filter((itemId) => isFactoryRewardHeldItemId(itemId));
      assert.equal(candidates.length, 9 - equippedInPool.length, equipped.join(','));
      assert.ok(candidates.length >= 6, `${equipped.join(',')} -> ${candidates.length}`);
      for (const itemId of candidates) {
        assert.ok(
          equipped.some((_, index) => canEquipFactoryRewardItem(equipped, itemId, index)),
          `${itemId} has no legal teammate for ${equipped.join(',')}`,
        );
      }
      const drawn = drawFullShelf(equipped, () => 0.999999);
      assert.equal(new Set(drawn).size, 6);
    }
  }
  assert.ok(checked >= 18400, `sweep covered ${checked} combinations`);
});

test('a purchased reward recycles the replaced item into the next candidate pool with unique baselines', () => {
  // 三人：sitrus_berry / lum_berry / leftovers（均不在九件内）⇒ 候选 = 九件全部
  const start = ['sitrus_berry', 'lum_berry', 'leftovers'];
  assert.equal(enumerateFactoryRewardCandidates(start).length, 9);
  // 购买 focus_band 装备给 0 号：旧物 sitrus_berry 未进入九件，但 0 号基准改为 focus_band
  const afterPurchase = ['focus_band', 'lum_berry', 'leftovers'];
  const candidates = enumerateFactoryRewardCandidates(afterPurchase);
  assert.equal(candidates.length, 8);
  assert.ok(!candidates.includes('focus_band'));
  assert.ok(candidates.includes('scope_lens'));
  // 再购买 scope_lens 给 1 号：focus_band 的候选立即回池
  const afterSecondPurchase = ['focus_band', 'scope_lens', 'leftovers'];
  const recycled = enumerateFactoryRewardCandidates(afterSecondPurchase);
  assert.ok(recycled.includes('quick_claw'));
  assert.equal(new Set(afterSecondPurchase).size, 3);
});

test('candidate shortage is reported instead of padded', () => {
  // 只有三名队员时结构上不可能发生；此处直接注入超员基准以证明「不补位」的边界语义。
  const overfull = ['scope_lens', 'quick_claw', 'kings_rock', 'choice_band'];
  const drawn = drawFactoryShopShelf(overfull, getFactoryShelfSize(), () => 0);
  if (drawn.ok !== false) throw new Error('Expected an INSUFFICIENT draw.');
  assert.equal(drawn.reason, 'INSUFFICIENT');
  assert.equal(drawn.candidateCount, 5);
});

test('the defensive "no legal teammate" assertion is reachable and rejects a three-way duplicate', () => {
  // 三名队员持同一件时，任何候选替换到任一位置都会留下重复 ⇒ 无合法装备对象。
  // 该分支是**代码断言**（PRD F2）而非默认假设，本用例直接构造入口证明它真的会抛错。
  assert.throws(
    () => enumerateFactoryRewardCandidates(['scope_lens', 'scope_lens', 'scope_lens']),
    /no legal teammate/,
  );
  // 两件重复时仍有合法对象（重复者可被改判），因此不抛错。
  assert.deepEqual(
    enumerateFactoryRewardCandidates(['scope_lens', 'scope_lens', null]).length,
    FACTORY_REWARD_HELD_ITEM_IDS.length - 1,
  );
});

test('sampling is uniform without replacement and honors the injected random source', () => {
  const equipped = ['sitrus_berry', 'lum_berry', 'leftovers'];
  const first = drawFullShelf(equipped, () => 0);
  const last = drawFullShelf(equipped, () => 0.999999);
  // random()=0 ⇒ 依次取候选前六件（可确定性复现）
  assert.deepEqual(first, [...FACTORY_REWARD_HELD_ITEM_IDS].slice(0, 6));
  assert.equal(new Set(last).size, 6);
  last.forEach((itemId) => assert.equal(isFactoryRewardHeldItemId(itemId), true));
  assert.notDeepEqual([...last].sort(), [...first].sort());
  for (let run = 0; run < 500; run += 1) {
    const drawn = drawFullShelf(equipped, Math.random);
    assert.equal(new Set(drawn).size, 6);
  }
  // 默认件数取自 shelfSize
  const defaults = drawFactoryShopShelf(equipped, undefined, () => 0);
  if (defaults.ok === false) throw new Error('Expected a full default draw.');
  assert.equal(defaults.shelf.length, 6);
});

test('loaded dice applicability stays isomorphic with the engine LOADED_DICE gate, including SKILL_LINK', () => {
  const qualifying = { ...makePokemon(1, null), selectedMoves: [makeMove('double-slap', {})] };
  const twoToThreeHits = { ...makePokemon(2, null), selectedMoves: [makeMove('fury-swipes', { minHits: 2, maxHits: 3 })] };
  const singleHit = { ...makePokemon(3, null), selectedMoves: [makeMove('tackle', { strikeMode: 'single', minHits: 1, maxHits: 1 })] };
  // 真实 data 里的固定命中招式（minHits === maxHits === guaranteedHits）⇒ 骰子无意义。
  const guaranteedThree = { ...makePokemon(4, null), selectedMoves: [makeMove('triple-kick', { minHits: 3, maxHits: 3, guaranteedHits: 3 })] };
  const noMoves = makePokemon(5, null);
  // 引擎里 SKILL_LINK 分支优先于 LOADED_DICE：持有连续攻击特性时骰子不改变命中次数。
  const skillLink = {
    ...makePokemon(6, null),
    abilities: [{ ability: { name: 'skill-link', url: '' } }],
    selectedMoves: [makeMove('double-slap', {})],
  };
  // 引擎 gate = `minHits === 2 && maxHits === 5`（无 guaranteedHits 前置）⇒ 同构即计入。
  const engineWideGate = { ...makePokemon(7, null), selectedMoves: [makeMove('synthetic-wide', { minHits: 2, maxHits: 5, guaranteedHits: 5 })] };

  assert.equal(hasLoadedDiceTrigger(qualifying), true);
  assert.equal(hasLoadedDiceTrigger(twoToThreeHits), false);
  assert.equal(hasLoadedDiceTrigger(singleHit), false);
  assert.equal(hasLoadedDiceTrigger(guaranteedThree), false);
  assert.equal(hasLoadedDiceTrigger(noMoves), false);
  assert.equal(hasLoadedDiceTrigger(skillLink), false);
  assert.equal(hasLoadedDiceTrigger(engineWideGate), true);

  assert.equal(getRewardApplicability(qualifying, 'loaded_dice'), 'APPLICABLE');
  assert.equal(getRewardApplicability(noMoves, 'loaded_dice'), 'NO_TRIGGER');
  assert.equal(getRewardApplicability(skillLink, 'loaded_dice'), 'NO_TRIGGER');
  // 厚底靴的收益取决于对手是否铺设入场陷阱 ⇒ 恒为条件性说明
  assert.equal(getRewardApplicability(qualifying, 'heavy_duty_boots'), 'CONDITIONAL');
  assert.equal(getRewardApplicability(qualifying, 'scope_lens'), 'APPLICABLE');
  assert.equal(getRewardApplicability(qualifying, 'scope-lens'), 'APPLICABLE');
});

test('white herb and mental herb are CONDITIONAL, never APPLICABLE (honesty)', () => {
  const pokemon = makePokemon(1, null);
  // 两件香草的收益取决于对手行为（降低能力 / 妨碍状态），奖励时刻不可判定 ⇒ 条件性，
  // 不得标成无条件有效（PRD F5）。
  assert.equal(getRewardApplicability(pokemon, 'white_herb'), 'CONDITIONAL');
  assert.equal(getRewardApplicability(pokemon, 'white-herb'), 'CONDITIONAL');
  assert.equal(getRewardApplicability(pokemon, 'mental_herb'), 'CONDITIONAL');
  assert.equal(getRewardApplicability(pokemon, 'mental-herb'), 'CONDITIONAL');
  assert.notEqual(getRewardApplicability(pokemon, 'white_herb'), 'APPLICABLE');
  assert.notEqual(getRewardApplicability(pokemon, 'mental_herb'), 'APPLICABLE');
});
