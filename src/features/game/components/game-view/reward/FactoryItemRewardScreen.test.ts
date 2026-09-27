import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GamePokemon, MoveBattleData } from '../../../../../types';
import type { GameViewModel } from '../../../view-model';
import { FactoryItemRewardScreen } from './FactoryItemRewardScreen';
import { RewardScreen } from '../RewardScreen';

const SHELF = ['scope_lens', 'quick_claw', 'choice_band', 'heavy_duty_boots', 'loaded_dice', 'white_herb'] as const;

function makeMove(name: string, minHits: number, maxHits: number): GamePokemon['selectedMoves'][number] {
  const battleData: MoveBattleData = {
    effectId: 'NONE',
    priority: 0,
    target: 'selected-pokemon',
    flags: [],
    critStage: 0,
    drainPercent: 0,
    recoilPercent: 0,
    healingPercent: 0,
    strikeMode: 'multi-hit',
    minHits,
    maxHits,
    secondaryEffects: [],
    substituteInteraction: 'blocked',
    makesContact: true,
    soundMove: false,
    powderMove: false,
    ballisticMove: false,
    punchMove: false,
    bypassProtect: false,
    ignoreAccuracyCheck: false,
  };
  return { name, power: 25, accuracy: 90, type: 'normal', damage_class: 'physical', battleData };
}

function makePokemon(id: number, name: string, itemId: string | null, moves: GamePokemon['selectedMoves'] = []): GamePokemon {
  const stats = { hp: 60, attack: 60, defense: 60, spAtk: 60, spDef: 60, speed: 60 };
  return {
    id,
    name,
    sprites: { front_default: '', back_default: '' },
    stats: [],
    types: [{ type: { name: 'normal' } }],
    abilities: [],
    moves: [],
    currentHp: 100,
    maxHp: 100,
    selectedMoves: moves,
    level: 50,
    nature: { name: 'hardy', zhName: '勤奋', plus: '', minus: '' },
    ivs: stats,
    evs: stats,
    baseStats: stats,
    calculatedStats: stats,
    statStages: { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0, evasion: 0 },
    factoryOriginalHeldItemId: itemId,
    factoryEquippedHeldItemId: itemId,
    factoryHeldItemId: itemId ?? undefined,
  };
}

interface RenderOptions {
  purchases?: Array<{ itemId: string; targetIndex: number; ticketsSpent: number }>;
  tickets?: number;
  continueRequested?: boolean;
  continueError?: string;
  prepareError?: string;
  loadedDiceTeammateMoves?: GamePokemon['selectedMoves'];
  withCheckpoint?: boolean;
}

function renderReward(
  status: 'PENDING' | 'READY' | 'CLAIMED',
  options: RenderOptions = {},
) {
  const purchases = options.purchases ?? [];
  const rewardCheckpoint = status === 'PENDING'
    ? { runId: 'run:ui', stage: 3, status }
    : {
        runId: 'run:ui',
        stage: 3,
        status,
        shelf: SHELF.map((itemId) => ({ kind: 'HELD_ITEM', itemId })),
        purchases,
        ...(status === 'CLAIMED' && options.continueRequested ? { continueRequested: true as const } : {}),
      };
  const viewModel = {
    rewardCheckpoint: options.withCheckpoint === false ? null : rewardCheckpoint,
    rewardCheckpointStatus: options.withCheckpoint === false ? null : status,
    rewardClaimError: null,
    rewardClaimBusy: false,
    rewardContinueError: options.continueError ?? null,
    rewardContinueBusy: false,
    rewardPrepareError: options.prepareError ?? null,
    supplyTickets: options.tickets ?? 3,
    currentLanguage: 'zh-hans',
    getLocalized: (pokemon: { name: string }) => pokemon.name,
    purchaseFactoryShopItem: async () => true,
    continueAfterFactoryReward: async () => {},
    clearFactoryItemRewardError: () => {},
    retryFactoryItemRewardPrepare: () => {},
    playerTeam: [
      makePokemon(25, '皮卡丘', 'sitrus_berry', options.loadedDiceTeammateMoves ?? []),
      makePokemon(133, '伊布', 'lum_berry'),
      makePokemon(175, '波克比', 'leftovers'),
    ],
  } as unknown as GameViewModel;
  return renderToStaticMarkup(createElement(FactoryItemRewardScreen, { viewModel }));
}

test('pending reward screen keeps the player at the checkpoint without old reward actions', () => {
  const html = renderReward('PENDING');
  assert.match(html, /奖励待准备/);
  assert.doesNotMatch(html, /继续挑战|重抽|确认领取|兑换/);
});

test('a failed preparation is reported as a defect with a retry, never padded', () => {
  const html = renderReward('PENDING', { prepareError: '货架候选不足（5/6），已按缺陷记录，不会补位或重复上架。请重试或上报。' });
  assert.match(html, /奖励待准备/);
  assert.match(html, /货架候选不足（5\/6）/);
  assert.match(html, /不会补位或重复上架/);
  assert.match(html, /重新准备货架/);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /重抽|扩容许可/);
});

test('reward route without a durable checkpoint cannot display legacy cards', () => {
  const viewModel = {
    rewardCheckpoint: null,
    rewardCheckpointStatus: null,
    rewardClaimError: null,
    rewardClaimBusy: false,
    rewardContinueError: null,
    rewardContinueBusy: false,
    currentLanguage: 'zh-hans',
    supplyTickets: 3,
    playerTeam: [],
  } as unknown as GameViewModel;
  const html = renderToStaticMarkup(createElement(RewardScreen, { viewModel }));
  assert.match(html, /奖励待准备/);
  assert.doesNotMatch(html, /重抽|确认领取|扩容许可/);
});

test('ready shop shows six products with prices, ticket balance, redeem buttons and teammates', () => {
  const html = renderReward('READY', { tickets: 3 });
  for (const label of ['焦点镜', '先制之爪', '讲究头带', '厚底靴', '机变骰子', '白色香草', '皮卡丘', '伊布', '波克比']) {
    assert.match(html, new RegExp(label));
  }
  // 券余额显示。
  assert.match(html, /兑换券余额：3 张/);
  // 每件商品都有价格（1/2/3 券，由配置驱动）。
  assert.match(html, /2 券/);
  assert.match(html, /3 券/);
  assert.match(html, /1 券/);
  // 有「兑换」按钮与「离开商店」。
  assert.match(html, /兑换/);
  assert.match(html, /离开商店/);
  assert.doesNotMatch(html, /重抽|扩容许可|确认领取/);
});

test('insufficient tickets disable the redeem button with a visually distinct state', () => {
  const html = renderReward('READY', { tickets: 1 });
  // 讲究头带（3 券）/ 焦点镜（2 券）券不足：按钮点不动 + 券不足文案。
  assert.match(html, /券不足/);
  assert.match(html, /disabled/);
  // 先制之爪 / 厚底靴 / 白色香草（1 券）仍可兑换。
  assert.match(html, /兑换/);
});

test('purchased products stay on the shelf marked as purchased and cannot be redeemed again', () => {
  const html = renderReward('READY', {
    tickets: 1,
    purchases: [{ itemId: 'quick_claw', targetIndex: 1, ticketsSpent: 1 }],
  });
  assert.match(html, /已兑换/);
  // 已购商品不再出现「兑换」按钮文案的重复可购态：先制之爪已兑换。
  assert.match(html, /先制之爪/);
});

test('product honesty: heavy-duty boots only claims entry hazards, never unimplemented ones', () => {
  const html = renderReward('READY');
  assert.match(html, /隐形岩/);
  assert.match(html, /毒菱/);
  assert.match(html, /接地毒属性仍吸收毒菱/);
  assert.doesNotMatch(html, /尖刺/);
  assert.doesNotMatch(html, /黏黏网/);
  assert.doesNotMatch(html, /本场必然有效|必然有效/);
});

test('product honesty: loaded dice admits there is nothing to trigger without a 2-5 hit move', () => {
  const html = renderReward('READY');
  assert.match(html, /可装备，但当前无对应触发场景/);
  assert.match(html, /队伍中没有 2–5 次连续攻击招式/);
  assert.doesNotMatch(html, /本场必然有效/);
});

test('product honesty: loaded dice names the teammates that can actually trigger it', () => {
  const html = renderReward('READY', { loadedDiceTeammateMoves: [makeMove('double-slap', 2, 5)] });
  assert.match(html, /仅对持有 2–5 次连续攻击招式的队员改变命中次数：皮卡丘。/);
  assert.doesNotMatch(html, /可装备，但当前无对应触发场景/);
  assert.doesNotMatch(html, /本场必然有效/);
});

test('product honesty: both herbs are CONDITIONAL and never claim unconditional value', () => {
  const html = renderReward('READY');
  // 白色香草：条件性说明（对手降低过能力等级才有收益）。
  assert.match(html, /条件性：只有对手降低过持有者的能力等级才有收益/);
  // 心灵香草不在本货架夹具里，改由 factoryRewardPool.test.ts 的三态判定覆盖。
  assert.doesNotMatch(html, /白色香草[^<]*无条件/);
});

test('closed shop restores the purchase summary and offers a retry after refresh', () => {
  const html = renderReward('CLAIMED', {
    purchases: [{ itemId: 'scope_lens', targetIndex: 0, ticketsSpent: 2 }],
  });
  assert.match(html, /商店已关闭/);
  assert.match(html, /焦点镜已装备给皮卡丘（花费 2 券）/);
  assert.match(html, /继续挑战/);
  assert.doesNotMatch(html, /离开商店|重试兑换/);
});

test('closed shop without purchases states that nothing was bought and tickets carry to settlement', () => {
  const html = renderReward('CLAIMED');
  assert.match(html, /商店已关闭/);
  assert.match(html, /本次没有兑换任何商品/);
  assert.match(html, /1 券 = 1 BP/);
});

test('closed shop with a saved continuation intent offers a retry after refresh', () => {
  const html = renderReward('CLAIMED', { continueRequested: true, continueError: '下一场战斗加载失败，请重试。' });
  assert.match(html, /重试进入下一战/);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /离开商店/);
});

test('icon-less held items never render an image tag', () => {
  const html = renderReward('READY');
  // 厚底靴 / 机变骰子的精灵图实测 404：不得产出 <img>，降级为文字徽标。
  assert.doesNotMatch(html, /heavy-duty-boots\.png/);
  assert.doesNotMatch(html, /loaded-dice\.png/);
  assert.match(html, /<img[^>]*scope-lens\.png/);
  assert.match(html, /厚底靴/);
  assert.match(html, /机变骰子/);
});
