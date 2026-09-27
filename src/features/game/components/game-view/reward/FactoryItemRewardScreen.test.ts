import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GamePokemon, MoveBattleData } from '../../../../../types';
import type { GameViewModel } from '../../../view-model';
import { FactoryItemRewardScreen } from './FactoryItemRewardScreen';
import { RewardScreen } from '../RewardScreen';

const CARDS = ['scope_lens', 'quick_claw', 'heavy_duty_boots', 'loaded_dice'] as const;

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

function renderReward(
  status: 'PENDING' | 'READY' | 'CLAIMED',
  options: {
    continueRequested?: boolean;
    continueError?: string;
    prepareError?: string;
    loadedDiceTeammateMoves?: GamePokemon['selectedMoves'];
    withCheckpoint?: boolean;
  } = {},
) {
  const rewardCheckpoint = status === 'PENDING'
    ? { runId: 'run:ui', stage: 3, status }
    : status === 'READY'
      ? { runId: 'run:ui', stage: 3, status, cardItemIds: [...CARDS] }
      : {
          runId: 'run:ui',
          stage: 3,
          status,
          cardItemIds: [...CARDS],
          claim: { itemId: 'scope_lens', targetIndex: 0 },
          ...(options.continueRequested ? { continueRequested: true as const } : {}),
        };
  const viewModel = {
    rewardCheckpoint: options.withCheckpoint === false ? null : rewardCheckpoint,
    rewardCheckpointStatus: options.withCheckpoint === false ? null : status,
    rewardClaimError: null,
    rewardClaimBusy: false,
    rewardContinueError: options.continueError ?? null,
    rewardContinueBusy: false,
    rewardPrepareError: options.prepareError ?? null,
    currentLanguage: 'zh-hans',
    getLocalized: (pokemon: { name: string }) => pokemon.name,
    claimFactoryItemReward: async () => true,
    continueAfterFactoryReward: async () => {},
    clearFactoryItemRewardError: () => {},
    retryFactoryItemRewardPrepare: () => {},
    playerTeam: [
      makePokemon(25, '皮卡丘', status === 'CLAIMED' ? 'scope_lens' : 'sitrus_berry', options.loadedDiceTeammateMoves ?? []),
      makePokemon(133, '伊布', 'white_herb'),
      makePokemon(175, '波克比', 'leftovers'),
    ],
  } as unknown as GameViewModel;
  return renderToStaticMarkup(createElement(FactoryItemRewardScreen, { viewModel }));
}

test('pending reward screen keeps the player at the checkpoint without old reward actions', () => {
  const html = renderReward('PENDING');
  assert.match(html, /奖励待准备/);
  assert.doesNotMatch(html, /继续挑战|重抽|确认替换并领取|扩容许可|确认领取/);
});

test('a failed preparation is reported as a defect with a retry, never padded', () => {
  const html = renderReward('PENDING', { prepareError: '奖励候选不足（2/4），已按缺陷记录，不会补位或重复出卡。请重试或上报。' });
  assert.match(html, /奖励待准备/);
  assert.match(html, /奖励候选不足（2\/4）/);
  assert.match(html, /不会补位或重复出卡/);
  assert.match(html, /重新准备奖励卡/);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /重抽|扩容许可/);
});

test('reward route without a durable checkpoint cannot display legacy cards', () => {
  const viewModel = {
    rewardCheckpoint: null,
    rewardCheckpointStatus: null,
    rewardClaimError: null,
    rewardClaimBusy: false,
    currentLanguage: 'zh-hans',
    playerTeam: [],
  } as unknown as GameViewModel;
  const html = renderToStaticMarkup(createElement(RewardScreen, { viewModel }));
  assert.match(html, /奖励待准备/);
  assert.doesNotMatch(html, /重抽|确认领取|扩容许可/);
});

test('ready reward screen shows four approved cards, teammate selection and no legacy reroll', () => {
  const html = renderReward('READY');
  for (const label of ['焦点镜', '先制之爪', '厚底靴', '机变骰子', '皮卡丘', '伊布', '波克比']) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /查看替换内容/);
  assert.doesNotMatch(html, /重抽|扩容许可|确认领取/);
});

test('card honesty: heavy-duty boots only claims entry hazards, never unimplemented ones', () => {
  const html = renderReward('READY');
  assert.match(html, /隐形岩/);
  assert.match(html, /毒菱/);
  assert.match(html, /接地毒属性仍吸收毒菱/);
  assert.doesNotMatch(html, /尖刺/);
  assert.doesNotMatch(html, /黏黏网/);
  assert.doesNotMatch(html, /本场必然有效|必然有效/);
});

test('card honesty: loaded dice admits there is nothing to trigger without a 2-5 hit move', () => {
  const html = renderReward('READY');
  assert.match(html, /可装备，但当前无对应触发场景/);
  assert.match(html, /队伍中没有 2–5 次连续攻击招式/);
  assert.match(html, /无对应触发场景/);
  assert.doesNotMatch(html, /本场必然有效/);
});

test('card honesty: loaded dice names the teammates that can actually trigger it', () => {
  const html = renderReward('READY', { loadedDiceTeammateMoves: [makeMove('double-slap', 2, 5)] });
  assert.match(html, /仅对持有 2–5 次连续攻击招式的队员改变命中次数：皮卡丘。/);
  assert.doesNotMatch(html, /可装备，但当前无对应触发场景/);
  assert.doesNotMatch(html, /本场必然有效/);
});

test('claimed reward screen restores the saved recipient without reopening a choice', () => {
  const html = renderReward('CLAIMED');
  assert.match(html, /奖励已领取/);
  assert.match(html, /焦点镜已装备给皮卡丘/);
  assert.match(html, /继续挑战/);
  assert.doesNotMatch(html, /查看替换内容|重试保存/);
});

test('claimed reward with a saved continuation intent offers a retry after refresh', () => {
  const html = renderReward('CLAIMED', { continueRequested: true, continueError: '下一场战斗加载失败，请重试。' });
  assert.match(html, /重试进入下一战/);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /查看替换内容/);
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
