// 四卡生成验收 · 端到端链路（PRD 验收 9）+ 替换后回池（PRD 验收 5）
// 手段声明：隔离来源 127.0.0.<octet>:4300 + 隔离 Playwright Chromium 手机模拟视口 390×844 / 844×390
//          + 受控存档注入（把队伍摆到第 3 战胜后的边界）+ 真实 UI 触控全链路（出招取胜 → 换怪跳过 → 四卡 →
//          选卡 → 选队员 → 替换确认 → 继续 → 第 4 战开战前）。未使用 DEV Win。
// 不修改实现代码。
import {
  ZH, COMBO_A, rest, launch, loadFixture, attach, makeContext, readState, readRewardDom, snap,
  waitAppBoot, waitBattleReady, winBattleByMoves, waitPhase, waitRewardReady, tapSkipSwap,
  tapContinueRoundResult, writeRecord, ensureDirs, settleImages, waitRewardReady as waitReady,
} from './four-card-harness.mjs';

const results = { commit: '0394e9d (codex/four-card-reward, worktree dirty)', cases: {}, errors: [] };
const browser = await launch();

const cardButtons = (page) => page.locator('[role="group"][aria-label="奖励卡"] button');
const teammateButtons = (page) => page.locator('.pf-panel', { has: page.getByRole('heading', { name: '选择装备队员' }) }).locator('button');

for (const [name, octet, viewport] of [
  ['e2e-390x844', 51, { width: 390, height: 844 }],
  ['e2e-844x390', 52, { width: 844, height: 390 }],
]) {
  const record = {
    name, octet, viewport, fixture: 'fx-comboA-stage3-battle.json',
    means: '受控存档注入（第 3 战边界）+ 真实 UI 全链路 + 模拟视口',
    steps: [], errors: [], httpErrors: [],
  };
  results.cases[name] = record;
  const dir = await ensureDirs(name);
  const { context } = await makeContext(browser, { octet, viewport, saveText: await loadFixture('fx-comboA-stage3-battle.json') });
  const page = await context.newPage();
  attach(page, record);
  const claimed = { item: null, targetIndex: 0 };
  try {
    await page.goto(`http://127.0.0.${octet}:4300`, { waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    if (!(await waitBattleReady(page))) throw new Error('battle not ready');
    const s0 = await snap(page, record, dir, '01-stage3-battle-ready');
    record.start = { stage: s0.stage, phase: s0.phase, player: s0.player, runSupply: s0.runSupply };

    // 1) 胜第 3 场（真实出招）
    const win = await winBattleByMoves(page, record);
    record.win = win;
    if (!win.ok) throw new Error(`battle not won: ${JSON.stringify(win).slice(0, 200)}`);
    record.step1 = await snap(page, record, dir, '02-stage3-won');

    // 2) 换怪/跳过
    await tapContinueRoundResult(page);
    await waitPhase(page, 'FACTORY_SWAP');
    await snap(page, record, dir, '03-swap-screen');
    await tapSkipSwap(page);

    // 3) 四卡（PENDING → READY）
    await waitRewardReady(page);
    await settleImages(page);
    const reward = await snap(page, record, dir, '04-four-cards');
    record.cards = reward.rewardCheckpoint?.cardItemIds ?? [];
    record.rewardDom = await readRewardDom(page);
    record.step3 = { cards: record.cards, status: reward.rewardCheckpoint?.status };

    // 4) 选卡 + 选队员 + 替换确认
    const target = record.cards[0];
    claimed.item = target;
    record.claimedItem = target;
    await cardButtons(page).filter({ hasText: ZH[target] }).first().tap();
    await page.waitForTimeout(300);
    await teammateButtons(page).nth(0).tap();
    await page.waitForTimeout(300);
    record.step4 = { selectedCard: target, selectedTargetIndex: 0, teammateTexts: await teammateButtons(page).evaluateAll((n) => n.map((x) => x.innerText.replace(/\s+/g, ' ').trim())) };
    await page.getByRole('button', { name: '查看替换内容' }).tap();
    await page.waitForSelector('[role="group"][aria-label="确认替换持有物"]', { timeout: 15000 });
    await snap(page, record, dir, '05-replace-confirm');
    const replacedOld = (await readState(page)).player[0].equipped;

    // 5) 确认领取
    const claimedBefore = await readState(page);
    await page.getByRole('button', { name: '确认替换并领取' }).tap();
    await page.waitForFunction(() => {
      try { return JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.rewardCheckpoint?.status === 'CLAIMED'; } catch { return false; }
    }, null, { timeout: 20000 });
    const s5 = await snap(page, record, dir, '06-claimed');
    record.step5 = {
      checkpoint: s5.rewardCheckpoint, player: s5.player,
      inventoryBefore: claimedBefore.inventoryItemIds, inventoryAfter: s5.inventoryItemIds,
    };
    record.claimAssertions = {
      claimedOnce: s5.rewardCheckpoint?.status === 'CLAIMED' && s5.rewardCheckpoint.claim?.itemId === target,
      equippedIsClaimed: s5.player[0].equipped === target && s5.player[0].current === target,
      replacedOldWas: replacedOld,
      oldItemLeftTeam: !s5.player.some((p) => p.equipped === replacedOld),
      oldItemNotBagged: !s5.inventoryItemIds.includes(replacedOld),
      inventoryUnchanged: JSON.stringify(s5.inventoryItemIds) === JSON.stringify(claimedBefore.inventoryItemIds),
      baselinesUnique: new Set(s5.player.map((p) => p.equipped).filter(Boolean)).size === 3,
    };

    // 6) 继续挑战 → 第 4 战开战前返还
    await page.getByRole('button', { name: '继续挑战' }).tap();
    // 第 4 战开战前会播放训练家入场台词（需真实点掉），随后才落盘 stage 4 起战
    await waitBattleReady(page, 60);
    await page.waitForFunction(() => {
      try {
        const b = JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume;
        return b.phase === 'BATTLE' && b.stage === 4;
      } catch { return false; }
    }, null, { timeout: 40000 });
    if (!(await waitBattleReady(page, 40))) throw new Error('stage 4 battle not ready');
    const s6 = await snap(page, record, dir, '07-stage4-battle-ready');
    record.step6 = { stage: s6.stage, phase: s6.phase, player: s6.player };
    record.returnTiming = {
      // 领取的新物必须成为该队员「第 4 战开战前」的返还基准（即开战前已按新基准返还）
      equippedBaseline: s6.player[0].equipped,
      currentItemAtBattleStart: s6.player[0].current,
      returnedBeforeBattle4: s6.player[0].equipped === target && s6.player[0].current === target,
      baselinesUnique: new Set(s6.player.map((p) => p.equipped).filter(Boolean)).size === 3,
      noRewardCheckpointLeak: s6.rewardCheckpoint === null,
    };

    // 7) 替换后回池：把这份「真实领取后」的存档推进到第 6 胜后的奖励节点，确认被替换掉的旧物重新出现在候选池
    const live = await page.evaluate(() => localStorage.getItem('pokefactory_save_v1'));
    const rewritten = await page.evaluate((raw) => {
      const save = JSON.parse(raw);
      const b = save.factory.battleResume;
      b.stage = 6;
      b.phase = 'REWARD';
      b.roundResult = 'WIN';
      b.streak = 5;
      b.swapCount = 0;
      b.turn = 'PLAYER';
      b.battleMenuTab = 'MAIN';
      b.battleLog = [];
      b.checkpointAt = new Date().toISOString();
      b.rewardCheckpoint = { runId: save.wallet.currentRunId, stage: 6, status: 'PENDING' };
      b.enemyTeam.forEach((p) => { p.currentHp = p.maxHp; delete p.nonVolatileStatus; });
      b.playerTeam.forEach((p) => { p.currentHp = p.maxHp; delete p.nonVolatileStatus; });
      save.runSupply = { runId: save.wallet.currentRunId, tickets: 6, lastCreditedStage: 6 };
      save.factory.curChallengeBattleNum = 5;
      localStorage.setItem('pokefactory_save_v1', JSON.stringify(save));
      return true;
    }, live);
    record.poolReturnRewrite = rewritten;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    await waitReady(page);
    await settleImages(page);
    const s7 = await snap(page, record, dir, '08-stage6-reward-from-real-claim');
    const cards6 = s7.rewardCheckpoint?.cardItemIds ?? [];
    record.poolReturn = {
      stage: s7.stage,
      cards: cards6,
      expectedCandidates: rest([target, 'quick_claw', 'kings_rock']),
      replacedItemBackInPool: cards6.includes(replacedOld),
      replacedOldItem: replacedOld,
      claimedItemNotInPool: !cards6.includes(target),
      fourDistinct: cards6.length === 4 && new Set(cards6).size === 4,
      baselinesUnique: new Set(s7.player.map((p) => p.equipped).filter(Boolean)).size === 3,
      player: s7.player,
    };
    record.assertions = {
      e2eChainComplete: record.step6.stage === 4 && record.returnTiming.returnedBeforeBattle4,
      ...record.claimAssertions,
      replacedItemReturnedToPool: record.poolReturn.replacedItemBackInPool,
    };
  } catch (e) {
    record.failure = String(e);
    record.failureState = await readState(page).catch(() => null);
    await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
    record.bodyTail = await page.locator('body').innerText().catch(() => '');
  } finally {
    await context.close();
    await writeRecord(name, record);
  }
}

await browser.close();
const brief = {};
for (const [k, r] of Object.entries(results.cases)) {
  brief[k] = {
    failure: r.failure, assertions: r.assertions, cards: r.cards, poolReturn: r.poolReturn && { cards: r.poolReturn.cards, replacedOldItem: r.poolReturn.replacedOldItem, back: r.poolReturn.replacedItemBackInPool, distinct: r.poolReturn.fourDistinct },
    returnTiming: r.returnTiming, claimAssertions: r.claimAssertions, failureState: r.failureState && { phase: r.failureState.phase, stage: r.failureState.stage, checkpoint: r.failureState.rewardCheckpoint, player: r.failureState.player },
    errors: r.errors.slice(-3), httpErrors: r.httpErrors.slice(-3), bodyTail: r.bodyTail?.slice(-300),
  };
}
console.log(JSON.stringify(brief, null, 2));
