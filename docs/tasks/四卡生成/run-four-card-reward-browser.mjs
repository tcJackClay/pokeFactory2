// 四卡生成验收 · 奖励节点运行时验证（PRD 验收 1/2/3/4/8/10 + 补遗 12 + 第 7 胜不提前返还）
// 手段声明：隔离来源 127.0.0.<octet>:4300 + 隔离 Playwright Chromium 手机模拟视口 + 受控存档注入（团队摆到节点边界）
//          + 真实 UI 触控（出招取胜 / 换怪跳过 / 选卡 / 选队员 / 确认）+ 受控故障注入（failNextWrite）。
// 未使用 DEV Win（本构建 START/SETTINGS 不可达，DEV 面板无法开启 —— 见 runtime.md 缺陷记录）。
// 不修改实现代码。
import {
  EVIDENCE_DIR, ZH, COMBO_A, COMBO_B, rest,
  launch, loadFixture, attach, makeContext, readState, readRewardDom, snap, waitAppBoot,
  waitBattleReady, winBattleByMoves, waitPhase, waitRewardReady, tapSkipSwap, tapContinueRoundResult,
  armFailWrite, failWriteStats, disarmFailWrite, armClaimTransitionCounter, claimTransitionStats,
  burstClick, writeRecord, ensureDirs, settleImages,
} from './four-card-harness.mjs';

const results = { commit: '0394e9d (codex/four-card-reward, 17 modified + 8 untracked)', cases: {}, errors: [] };
const browser = await launch();

/** 公共：注入 BATTLE 夹具 → 真实出招取胜 → 换怪屏跳过 → 奖励节点 READY */
const playToReward = async (record, page, dir) => {
  if (!(await waitBattleReady(page))) throw new Error('battle not ready');
  await snap(page, record, dir, '01-battle-ready');
  const win = await winBattleByMoves(page, record);
  record.win = win;
  if (!win.ok) throw new Error(`battle not won: ${JSON.stringify(win).slice(0, 300)}`);
  await snap(page, record, dir, '02-round-result');
  await tapContinueRoundResult(page);
  await waitPhase(page, 'FACTORY_SWAP');
  await snap(page, record, dir, '03-factory-swap');
  await tapSkipSwap(page);
  await waitRewardReady(page);
  await settleImages(page);
  await snap(page, record, dir, '04-reward-ready');
  record.rewardDom = await readRewardDom(page);
  return record.rewardDom;
};

const cardButtons = (page) => page.locator('[role="group"][aria-label="奖励卡"] button');
const teammateButtons = (page) => page.locator('.pf-panel', { has: page.getByRole('heading', { name: '选择装备队员' }) }).locator('button');

/** 逐张卡检查「至少一个合法队员」：选中该卡后统计可点击的队员按钮 */
const checkLegalTargets = async (page, cardIds) => {
  const out = [];
  for (const itemId of cardIds) {
    const btn = cardButtons(page).filter({ hasText: ZH[itemId] }).first();
    if (!(await btn.count())) { out.push({ itemId, error: 'card-button-not-found' }); continue; }
    await btn.tap();
    await page.waitForTimeout(250);
    const teammates = await teammateButtons(page).evaluateAll((nodes) => nodes.map((n) => ({ text: n.innerText.replace(/\s+/g, ' ').trim(), disabled: n.disabled })));
    out.push({ itemId, zh: ZH[itemId], teammates, eligibleCount: teammates.filter((t) => !t.disabled).length });
  }
  return out;
};

// ============ 用例 EQ-A / EQ-B：四卡保底 2 组组合 + 卡面诚实 + 图标 ============
for (const [name, fixture, held, octet] of [
  ['guarantee-comboA', 'fx-comboA-stage3-battle.json', COMBO_A, 41],
  ['guarantee-comboB', 'fx-comboB-stage3-battle.json', COMBO_B, 42],
]) {
  const record = { name, octet, fixture, held, means: '受控存档注入 + 真实出招取胜 + 真实换怪跳过 + 真实 UI 读屏', steps: [], errors: [], httpErrors: [] };
  results.cases[name] = record;
  const dir = await ensureDirs(name);
  const saveText = await loadFixture(fixture);
  const { context } = await makeContext(browser, { octet, viewport: { width: 390, height: 844 }, saveText });
  const page = await context.newPage();
  attach(page, record);
  try {
    await page.goto(`http://127.0.0.${octet}:4300`, { waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    const dom = await playToReward(record, page, dir);
    const state = await readState(page);
    const cards = state.rewardCheckpoint?.cardItemIds ?? [];
    record.cards = cards;
    record.expectedCandidates = rest(held);
    record.assertions = {
      fourCards: cards.length === 4,
      distinct: new Set(cards).size === cards.length,
      matchesExpectedSet: [...cards].sort().join(',') === [...rest(held)].sort().join(','),
      noHeldItemInCards: cards.every((id) => !held.includes(id)),
      cardIdsInSeven: cards.every((id) => [...COMBO_A, ...rest(COMBO_A)].includes(id)),
      checkpointStage: state.rewardCheckpoint?.stage,
      checkpointStatus: state.rewardCheckpoint?.status,
      runIdMatches: state.rewardCheckpoint?.runId === state.runId,
    };
    record.legalTargets = await checkLegalTargets(page, cards);
    record.assertions.everyCardHasLegalTeammate = record.legalTargets.every((x) => x.eligibleCount >= 1);
    record.cardTexts = dom.cards;
    record.imgs = dom.imgs;
    record.brokenImgs = dom.brokenImgs;
    record.assertions.noBrokenImages = dom.brokenImgs.length === 0;
    // 卡面诚实：文案原文
    record.honesty = {
      loaded_dice_card_text: dom.cards.find((c) => c.text.includes(ZH.loaded_dice))?.text ?? null,
      heavy_duty_boots_card_text: dom.cards.find((c) => c.text.includes(ZH.heavy_duty_boots))?.text ?? null,
      claimsGuaranteedEffective: /本场必然有效|必然有效|当局一定有效|guaranteed effective/.test(dom.body),
      mentionsHardFalseHazards: /尖刺|黏黏网|Spikes|Sticky Web/.test(dom.body),
    };
    record.assertions.loadedDiceNoTriggerHonest = dom.cards.some((c) => c.text.includes(ZH.loaded_dice) && c.text.includes('当前无对应触发场景'));
    record.assertions.bootsConditionalHonest = dom.cards.some((c) => c.text.includes(ZH.heavy_duty_boots) && c.text.includes('隐形岩') && c.text.includes('毒菱') && c.text.includes('接地毒属性'));
    await snap(page, record, dir, '05-card-details-390x844');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    await snap(page, record, dir, '06-card-details-844x390');
    record.stateAfter = await readState(page);
  } catch (e) {
    record.failure = String(e);
    await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
    record.bodyTail = await page.locator('body').innerText().catch(() => '');
  } finally {
    await context.close();
    await writeRecord(name, record);
  }
}

// ============ 用例 CONSUMED：返还基准口径（战斗中已消耗的持有物仍不得出卡）============
{
  const name = 'consumed-baseline';
  const record = { name, octet: 43, fixture: 'fx-consumed-stage3-battle.json', steps: [], errors: [], httpErrors: [] };
  results.cases[name] = record;
  const dir = await ensureDirs(name);
  const { context } = await makeContext(browser, { octet: 43, viewport: { width: 390, height: 844 }, saveText: await loadFixture('fx-consumed-stage3-battle.json') });
  const page = await context.newPage();
  attach(page, record);
  try {
    await page.goto('http://127.0.0.43:4300', { waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    record.beforeBattle = await readState(page);
    const dom = await playToReward(record, page, dir);
    const state = await readState(page);
    const cards = state.rewardCheckpoint?.cardItemIds ?? [];
    record.cards = cards;
    record.assertions = {
      // idx0 的「本场当前持有物」在战斗中被清空（夹具即消耗态），但返还基准仍是 scope_lens ⇒ 该 ID 仍不得出卡
      consumedslotCurrentIsNull: record.beforeBattle.player[0].current === null,
      consumedslotBaselineIsScopeLens: record.beforeBattle.player[0].equipped === 'scope_lens',
      scopeLensNotInCards: !cards.includes('scope_lens'),
      fourCards: cards.length === 4,
      distinct: new Set(cards).size === 4,
      matchesExpectedSet: [...cards].sort().join(',') === rest(['scope_lens', 'quick_claw', 'kings_rock']).sort().join(','),
    };
    record.cardTexts = dom.cards;
    await snap(page, record, dir, '05-cards-after-consumed');
    record.stateAfter = state;
  } catch (e) {
    record.failure = String(e);
    await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
    record.bodyTail = await page.locator('body').innerText().catch(() => '');
  } finally {
    await context.close();
    await writeRecord(name, record);
  }
}

// ============ 用例 FREEZE：PENDING→READY 冻结（刷新 / 冷重开 / 同版存档回写）============
{
  const name = 'freeze';
  const record = { name, octet: 44, fixture: 'fx-stage3-reward-pending.json', steps: [], errors: [], httpErrors: [] };
  results.cases[name] = record;
  const dir = await ensureDirs(name);
  const { context } = await makeContext(browser, { octet: 44, viewport: { width: 390, height: 844 }, saveText: await loadFixture('fx-stage3-reward-pending.json') });
  const page = await context.newPage();
  attach(page, record);
  try {
    await page.goto('http://127.0.0.44:4300', { waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    await waitRewardReady(page);
    const s1 = await snap(page, record, dir, '01-ready-390x844');
    const cards1 = s1.rewardCheckpoint?.cardItemIds ?? [];
    record.cardsReady = cards1;
    const storedAfterReady = await page.evaluate(() => localStorage.getItem('pokefactory_save_v1'));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    await page.waitForTimeout(1500);
    const s2 = await snap(page, record, dir, '02-after-reload-390x844');
    const cards2 = s2.rewardCheckpoint?.cardItemIds ?? [];

    // 同版「导入」等价路径说明：本构建无导入 UI 入口（START/SETTINGS 不可达），
    // 故用「导出文本（localStorage 中应用自身落盘的存档，逐字节）写回 + 冷重开」覆盖 parse/sanitize/校验路径。
    await context.close();
    const { context: context2 } = await makeContext(browser, { octet: 44, viewport: { width: 390, height: 844 }, saveText: storedAfterReady });
    const page2 = await context2.newPage();
    attach(page2, record);
    await page2.goto('http://127.0.0.44:4300', { waitUntil: 'domcontentloaded' });
    await waitAppBoot(page2);
    await page2.waitForTimeout(1500);
    const s3 = await snap(page2, record, dir, '03-cold-reopen-390x844');
    const cards3 = s3.rewardCheckpoint?.cardItemIds ?? [];
    record.cardsReload = cards2;
    record.cardsColdReopen = cards3;
    record.assertions = {
      readyHasFourDistinct: cards1.length === 4 && new Set(cards1).size === 4,
      reloadIdentical: JSON.stringify(cards1) === JSON.stringify(cards2),
      coldReopenIdentical: JSON.stringify(cards1) === JSON.stringify(cards3),
      reloadKeptStatus: s2.rewardCheckpoint?.status === 'READY',
      coldReopenKeptStatus: s3.rewardCheckpoint?.status === 'READY',
      reloadDidNotRedraw: cards2.length === 4,
    };
    record.savedExportTextLength = storedAfterReady.length;
    await context2.close();
  } catch (e) {
    record.failure = String(e);
    await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
    record.bodyTail = await page.locator('body').innerText().catch(() => '');
  } finally {
    await writeRecord(name, record);
  }
}

// ============ 用例 CLAIM-RAPID / CLAIM-DBL：唯一领取 ============
for (const [name, octet, mode] of [['claim-rapid-click', 45, 'rapid'], ['claim-double-tap', 46, 'double']]) {
  const record = { name, octet, mode, fixture: 'fx-stage3-reward-pending.json', steps: [], errors: [], httpErrors: [] };
  results.cases[name] = record;
  const dir = await ensureDirs(name);
  const { context } = await makeContext(browser, { octet, viewport: { width: 390, height: 844 }, saveText: await loadFixture('fx-stage3-reward-pending.json') });
  const page = await context.newPage();
  attach(page, record);
  try {
    await page.goto(`http://127.0.0.${octet}:4300`, { waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    await waitRewardReady(page);
    const before = await snap(page, record, dir, '01-ready-before-claim');
    const cards = before.rewardCheckpoint?.cardItemIds ?? [];
    const target = cards[0];
    record.claimedItem = target;
    record.before = { player: before.player, inventory: before.inventoryItemIds, checkpoint: before.rewardCheckpoint };

    await cardButtons(page).filter({ hasText: ZH[target] }).first().tap();
    await page.waitForTimeout(250);
    const teammates = await teammateButtons(page);
    await teammates.nth(0).tap();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '查看替换内容' }).tap();
    await page.waitForSelector('[role="group"][aria-label="确认替换持有物"]', { timeout: 10000 });
    await snap(page, record, dir, '02-confirm-panel');
    await armClaimTransitionCounter(page);

    record.targetIndex = 0;
    record.oldItem = before.player[0].equipped;

    if (mode === 'rapid') {
      // DOM 级连点：在同一个 JS 任务内派发 8 次真实 click（不绕过 React 事件与游戏循环）
      record.burst = await burstClick(page, '[role="group"][aria-label="确认替换持有物"] button[data-tone="primary"]', 8);
    } else {
      const confirm = page.locator('[role="group"][aria-label="确认替换持有物"] button[data-tone="primary"]').first();
      const taps = [];
      // 真实触控双击：两次 tap 连续排队（不等待第一次的 UI 结果）
      const first = confirm.tap({ timeout: 4000 }).then(() => taps.push('tap1-ok')).catch((e) => taps.push(`tap1-fail ${String(e).slice(0, 60)}`));
      const second = confirm.tap({ timeout: 4000 }).then(() => taps.push('tap2-ok')).catch((e) => taps.push(`tap2-fail ${String(e).slice(0, 60)}`));
      await Promise.allSettled([first, second]);
      record.taps = taps;
    }
    await page.waitForTimeout(2500);
    const after = await snap(page, record, dir, '03-after-claim');
    record.claimTransitions = await claimTransitionStats(page);
    record.after = { player: after.player, inventory: after.inventoryItemIds, checkpoint: after.rewardCheckpoint, stage: after.stage };
    record.assertions = {
      statusIsClaimed: after.rewardCheckpoint?.status === 'CLAIMED',
      singleClaimTransition: record.claimTransitions.count === 1,
      claimRecordedOnce: Boolean(after.rewardCheckpoint?.claim) && after.rewardCheckpoint.claim.itemId === target && after.rewardCheckpoint.claim.targetIndex === 0,
      equippedChangedOnce: after.player[0].equipped === target && after.player[0].current === target,
      otherSlotsUntouched: after.player[1].equipped === before.player[1].equipped && after.player[2].equipped === before.player[2].equipped,
      baselinesUnique: new Set(after.player.map((p) => p.equipped).filter(Boolean)).size === 3,
      inventoryUnchanged: JSON.stringify(after.inventoryItemIds) === JSON.stringify(before.inventoryItemIds),
      oldItemNotInBag: !after.inventoryItemIds.includes(before.player[0].equipped),
      oldItemLeftTheTeam: !after.player.some((p) => p.equipped === before.player[0].equipped),
      stageNotAdvanced: after.stage === 3,
      continueNotTriggered: after.rewardCheckpoint?.continueRequested !== true,
    };
    await page.screenshot({ path: `${dir}/04-claimed-state.png` });
  } catch (e) {
    record.failure = String(e);
    await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
    record.bodyTail = await page.locator('body').innerText().catch(() => '');
  } finally {
    await context.close();
    await writeRecord(name, record);
  }
}

// ============ 用例 REPAIR：注入「三人基准重复」存档 → 可恢复 + 如实提示 ============
{
  const name = 'repair-notice';
  const record = { name, octet: 47, fixture: 'fx-duplicate-baselines.json', steps: [], errors: [], httpErrors: [] };
  results.cases[name] = record;
  const dir = await ensureDirs(name);
  const { context } = await makeContext(browser, { octet: 47, viewport: { width: 390, height: 844 }, saveText: await loadFixture('fx-duplicate-baselines.json') });
  const page = await context.newPage();
  attach(page, record);
  try {
    await page.goto('http://127.0.0.47:4300', { waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    await waitRewardReady(page);
    const state = await snap(page, record, dir, '01-repaired-reward-390x844');
    record.notice = state.repairNotice;
    record.repairedFlag = state.heldItemBaselineRepaired;
    record.cards = state.rewardCheckpoint?.cardItemIds ?? [];
    record.teammates = state.player;
    record.assertions = {
      noInvalidSaveScreen: !/旧规则存档不兼容|存档无法读取/.test(state.bodyTail),
      repairedFlagTrue: state.heldItemBaselineRepaired === true,
      noticeVisible: Boolean(state.repairNotice),
      noticeMentionsOriginalKept: /没有.{0,4}丢弃|未进入背包|回落/.test(state.repairNotice ?? ''),
      teamNowUnique: new Set(state.player.map((p) => p.equipped).filter(Boolean)).size === 3,
      originalFieldUntouched: state.player[0].original === 'leftovers' && state.player[1].original === 'choice_band',
      fourCardsStillProduced: record.cards.length === 4 && new Set(record.cards).size === 4,
      noDeadEnd: state.phase === 'REWARD' && state.rewardCheckpoint?.status === 'READY',
    };
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    await snap(page, record, dir, '02-repaired-reward-844x390');
  } catch (e) {
    record.failure = String(e);
    await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
    record.bodyTail = await page.locator('body').innerText().catch(() => '');
  } finally {
    await context.close();
    await writeRecord(name, record);
  }
}

// ============ 用例 STAGE7：第 7 胜后无下一战，不提前返还 ============
{
  const name = 'stage7-no-early-return';
  const record = { name, octet: 48, fixture: 'fx-stage7-battle.json', steps: [], errors: [], httpErrors: [] };
  results.cases[name] = record;
  const dir = await ensureDirs(name);
  const { context } = await makeContext(browser, { octet: 48, viewport: { width: 390, height: 844 }, saveText: await loadFixture('fx-stage7-battle.json') });
  const page = await context.newPage();
  attach(page, record);
  try {
    await page.goto('http://127.0.0.48:4300', { waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    if (!(await waitBattleReady(page))) throw new Error('battle not ready');
    record.beforeBattle = await readState(page);
    const win = await winBattleByMoves(page, record);
    record.win = win;
    if (!win.ok) throw new Error('stage7 not won');
    await snap(page, record, dir, '01-stage7-round-result');
    await tapContinueRoundResult(page);
    await page.waitForTimeout(2500);
    const state = await snap(page, record, dir, '02-after-set-completed');
    record.after = { phase: state.phase, stage: state.stage, player: state.player, roundResult: state.roundResult, bodyTail: state.bodyTail };
    record.assertions = {
      phaseIsBase: state.phase === 'BASE',
      stageStillSeven: state.stage === 7,
      noRewardNode: state.rewardCheckpoint === null,
      // 消耗态不得被提前返还
      consumedSlotStillConsumed: state.player[0].current === null && state.player[0].equipped === 'scope_lens',
      otherSlotsUnchanged: state.player[1].equipped === 'quick_claw' && state.player[2].equipped === 'kings_rock',
    };
  } catch (e) {
    record.failure = String(e);
    await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
    record.bodyTail = await page.locator('body').innerText().catch(() => '');
  } finally {
    await context.close();
    await writeRecord(name, record);
  }
}

// ============ 用例 FAIL-PREPARE / FAIL-CLAIM：写入失败语义 ============
{
  const name = 'failure-semantics-reward';
  const record = { name, octet: 49, steps: [], errors: [], httpErrors: [] };
  results.cases[name] = record;
  const dir = await ensureDirs(name);
  // (a) PENDING → READY 写入失败：在 boot 前武装「命中 rewardCheckpoint.status=READY 的写入即抛错」
  const { context } = await makeContext(browser, { octet: 49, viewport: { width: 390, height: 844 }, saveText: await loadFixture('fx-stage3-reward-pending.json') });
  const page = await context.newPage();
  attach(page, record);
  try {
    await page.addInitScript(() => {
      const proto = Object.getPrototypeOf(window.localStorage);
      const orig = proto.setItem;
      window.__origSetItem = orig;
      proto.setItem = function (key, value) {
        if (window.__armPrepareFailure !== false && /"rewardCheckpoint":\{[^}]*"status":"READY"/.test(String(value))) {
          window.__armPrepareFailure = false;
          window.__prepareFailures = (window.__prepareFailures ?? 0) + 1;
          throw new Error('injected quota failure (prepare)');
        }
        return orig.call(this, key, value);
      };
    });
    await page.goto('http://127.0.0.49:4300', { waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    await page.waitForTimeout(2500);
    const s1 = await snap(page, record, dir, '01-prepare-write-failed');
    record.prepareFailure = {
      checkpointStatus: s1.rewardCheckpoint?.status ?? null,
      phase: s1.phase, stage: s1.stage,
      prepareFailures: await page.evaluate(() => window.__prepareFailures ?? 0),
      errorVisible: /奖励卡保存失败|奖励候选不足/.test(s1.bodyTail),
      bodyTail: s1.bodyTail,
    };
    // 解除故障注入 → 重试
    await page.evaluate(() => { window.__armPrepareFailure = false; });
    await page.getByRole('button', { name: '重新准备奖励卡' }).tap();
    await waitRewardReady(page);
    const s2 = await snap(page, record, dir, '02-retry-prepared');
    record.prepareRecovered = {
      checkpointStatus: s2.rewardCheckpoint?.status ?? null,
      cards: s2.rewardCheckpoint?.cardItemIds ?? [],
      cardCount: (s2.rewardCheckpoint?.cardItemIds ?? []).length,
      distinct: new Set(s2.rewardCheckpoint?.cardItemIds ?? []).size,
      duplicates: (s2.rewardCheckpoint?.cardItemIds ?? []).length !== new Set(s2.rewardCheckpoint?.cardItemIds ?? []).size,
      stage: s2.stage,
    };
    // (b) READY → CLAIM 写入失败
    const cards = s2.rewardCheckpoint?.cardItemIds ?? [];
    const target = cards[0];
    record.claimTarget = target;
    const beforeClaim = s2;
    await cardButtons(page).filter({ hasText: ZH[target] }).first().tap();
    await page.waitForTimeout(250);
    await teammateButtons(page).nth(0).tap();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '查看替换内容' }).tap();
    await page.waitForSelector('[role="group"][aria-label="确认替换持有物"]', { timeout: 10000 });
    await armFailWrite(page, '"claim":\\{"itemId"');
    await page.getByRole('button', { name: '确认替换并领取' }).tap();
    await page.waitForTimeout(2000);
    const s3 = await snap(page, record, dir, '03-claim-write-failed');
    record.claimFailure = {
      checkpointStatus: s3.rewardCheckpoint?.status ?? null,
      equipUnchanged: s3.player[0].equipped === beforeClaim.player[0].equipped,
      errorVisible: /奖励保存失败/.test(s3.bodyTail),
      failWriteStats: await failWriteStats(page),
      bodyTail: s3.bodyTail,
    };
    await disarmFailWrite(page);
    const retry = page.getByRole('button', { name: '重试保存' });
    await (await retry.count() ? retry : page.getByRole('button', { name: '确认替换并领取' })).first().tap();
    await page.waitForTimeout(2500);
    const s4 = await snap(page, record, dir, '04-claim-retried');
    record.claimRecovered = {
      checkpointStatus: s4.rewardCheckpoint?.status ?? null,
      claim: s4.rewardCheckpoint?.claim ?? null,
      equip: s4.player[0].equipped,
      stage: s4.stage,
    };
    record.assertions = {
      prepareFailureStayedPending: record.prepareFailure.checkpointStatus === 'PENDING',
      prepareFailureStageUnchanged: record.prepareFailure.stage === 3,
      prepareFailureHonestError: record.prepareFailure.errorVisible === true,
      retryProducedFourDistinct: record.prepareRecovered.cardCount === 4 && record.prepareRecovered.distinct === 4,
      noPaddingOnRetry: record.prepareRecovered.duplicates === false,
      claimFailureStayedReady: record.claimFailure.checkpointStatus === 'READY',
      claimFailureEquipUnchanged: record.claimFailure.equipUnchanged === true,
      claimFailureHonestError: record.claimFailure.errorVisible === true,
      claimRetrySucceeded: record.claimRecovered.checkpointStatus === 'CLAIMED',
      claimRetryStageUnchanged: record.claimRecovered.stage === 3,
    };
  } catch (e) {
    record.failure = String(e);
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
  brief[k] = { failure: r.failure, assertions: r.assertions, cards: r.cards, win: r.win?.turns?.length, errors: r.errors.slice(-3), httpErrors: r.httpErrors.slice(-3), bodyTail: r.bodyTail?.slice(-260) };
}
console.log(JSON.stringify(brief, null, 2));
