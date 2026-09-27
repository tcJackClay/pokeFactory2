// 奖励商店验收 · 浏览器运行时验证（AC-1~5 / AC-10 / AC-11 / AC-13 + F3 失败语义补充）
// 手段声明：隔离来源 127.0.0.<octet>:4300 + 隔离 Playwright Chromium 手机模拟视口（390×844 与 844×390 双视口取证）
//          + 受控存档注入（团队摆到节点边界；夹具由 probe-shop-fixtures.mjs 从四卡任务基档派生）
//          + 真实 UI 触控（出招取胜 / 换怪跳过 / 商品 → 队员 → 确认兑换 / 离开商店 / 逃跑认输）
//          + 受控故障注入（failNextWrite）+ purchases 严格增长计数器（双击/连点只扣一次券）。
// 不修改实现代码。未使用 DEV Win（与四卡任务同口径）。
// 运行前置：后端 PORT=3001 go run ./backend/cmd/server；前端 npm run dev（4300）。
import {
  ZH, PRICE, idOfZh, BASE_HELD, expectedShelfOf,
  launch, loadFixture, attach, makeContext, readState, readShopDom, snap, settleImages,
  waitAppBoot, waitBattleReady, winBattleByMoves, waitPhase, waitRewardReady, waitMigratedShopReady, tapSkipSwap, tapContinueRoundResult,
  armPurchaseCounter, purchaseCommits, armFailWrite, failWriteStats, disarmFailWrite, burstClick,
  writeRecord, ensureDirs, buyInShop,
} from './shop-harness.mjs';

const results = { cases: {}, errors: [] };
const browser = await launch();

const shelfIds = (state) => (state.rewardCheckpoint?.shelf ?? []).map((p) => p.itemId);
const expectedShelf = expectedShelfOf(BASE_HELD).sort().join(',');

/** 公共：注入战斗夹具 → 真实出招取胜 → 换怪屏跳过 → 奖励节点 READY（第 3 胜后进商店） */
const playToShop = async (record, page, dir) => {
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
  await snap(page, record, dir, '04-shop-ready');
  return readShopDom(page);
};

/** 商店商品断言公共块：恰好 6 件、互不重复、价格=档位表、有功能说明、无破图 */
const shelfAssertions = (dom) => {
  const products = dom.products;
  const labels = products.map((p) => p.label);
  const priceOk = products.every((p) => {
    const id = idOfZh(p.label);
    return id !== null && p.price === `${PRICE[id]} 券`;
  });
  return {
    exactlySix: products.length === 6,
    distinct: new Set(labels).size === labels.length,
    matchesExpectedSet: [...labels.map((l) => idOfZh(l))].sort().join(',') === expectedShelf,
    pricesMatchTierTable: priceOk,
    everyProductHasEffect: products.every((p) => (p.effect ?? '').length >= 8),
    ticketBalanceVisible: /兑换券余额：\d+ 张|Tickets: \d+/.test(dom.ticketBalance ?? ''),
    redeemButtonsPresent: products.every((p) => p.purchased || p.buttonText !== null),
    leaveButtonVisible: dom.hasLeaveButton,
    noBrokenImages: dom.brokenImgs.length === 0,
    headingIsShop: /交换商店|Exchange shop/.test(dom.heading ?? ''),
  };
};

const runCase = async (name, { octet, fixture, viewport = { width: 390, height: 844 }, initPage, body }) => {
  const record = { name, octet, fixture, viewport, means: '受控存档注入 + 真实 UI 触控 + 存档断言', steps: [], errors: [], httpErrors: [] };
  results.cases[name] = record;
  const dir = await ensureDirs(name);
  const saveText = fixture ? await loadFixture(fixture) : undefined;
  const { context } = await makeContext(browser, { octet, viewport, saveText });
  const page = await context.newPage();
  attach(page, record);
  try {
    if (initPage) await initPage(page);
    await page.goto(`http://127.0.0.${octet}:4300`, { waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    await body(record, page, dir);
  } catch (e) {
    record.failure = String(e);
    await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
    record.bodyTail = (await readState(page)).bodyTail;
  } finally {
    await context.close();
    await writeRecord(name, record);
  }
  return record;
};

// ============ 用例 1 · shop-ready（AC-1 / AC-2 / AC-12 文案诚实）：商店开张 + 券余额 + 价格 ============
await runCase('shop-ready-t2', {
  octet: 41, fixture: 'fx-shop-pending-t2.json',
  body: async (record, page, dir) => {
    await waitRewardReady(page);
    await settleImages(page);
    const dom = await readShopDom(page);
    const state = await readState(page);
    record.dom = dom;
    record.assertions = {
      ...shelfAssertions(dom),
      ticketBalanceIsTwo: /兑换券余额：2 张/.test(dom.ticketBalance ?? ''),
      choiceBandInsufficient: dom.products.find((p) => p.label === ZH.choice_band)?.state === 'insufficient',
      choiceBandButtonDisabled: dom.products.find((p) => p.label === ZH.choice_band)?.buttonDisabled === true,
      choiceBandPriceStruckThrough: dom.products.find((p) => p.label === ZH.choice_band)?.priceLineThrough === true,
      choiceBandButtonGrayscale: dom.products.find((p) => p.label === ZH.choice_band)?.buttonGrayscale === true,
      affordableButtonsEnabled: dom.products.filter((p) => p.label !== ZH.choice_band).every((p) => p.buttonDisabled === false),
      checkpointReady: state.rewardCheckpoint?.status === 'READY',
      // F5 商品说明诚实：两件香草必须带「条件性」说明，不得标成无条件有效
      whiteHerbConditionalNote: /条件性/.test(dom.products.find((p) => p.label === ZH.white_herb)?.note ?? ''),
      mentalHerbConditionalNote: /条件性/.test(dom.products.find((p) => p.label === ZH.mental_herb)?.note ?? ''),
    };
    await snap(page, record, dir, '01-shop-390x844');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    await snap(page, record, dir, '02-shop-844x390');
  },
});

// ============ 用例 2 · shop-no-tickets（AC-2 极端对比）：0 券全货架点不动 ============
await runCase('shop-no-tickets', {
  octet: 42, fixture: 'fx-shop-pending-t0.json',
  body: async (record, page, dir) => {
    await waitRewardReady(page);
    const dom = await readShopDom(page);
    record.dom = dom;
    record.assertions = {
      ticketBalanceIsZero: /兑换券余额：0 张/.test(dom.ticketBalance ?? ''),
      allProductsInsufficient: dom.products.every((p) => p.state === 'insufficient'),
      allButtonsDisabled: dom.products.every((p) => p.buttonDisabled === true),
      allButtonsSayInsufficient: dom.products.every((p) => p.buttonText === '券不足'),
      allPricesStruckThrough: dom.products.every((p) => p.priceLineThrough === true),
      ...shelfAssertions(dom),
    };
    await snap(page, record, dir, '01-zero-tickets-390x844');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    await snap(page, record, dir, '02-zero-tickets-844x390');
  },
});

// ============ 用例 3 · freeze（AC-5）：PENDING→READY 冻结（刷新 / 同版存档冷重开）============
await runCase('shelf-freeze', {
  octet: 43, fixture: 'fx-shop-pending-t2.json',
  body: async (record, page, dir) => {
    await waitRewardReady(page);
    const s1 = await snap(page, record, dir, '01-ready');
    const shelf1 = shelfIds(s1);
    const storedAfterReady = await page.evaluate(() => localStorage.getItem('pokefactory_save_v1'));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    await page.waitForTimeout(1500);
    const s2 = await snap(page, record, dir, '02-after-reload');
    const shelf2 = shelfIds(s2);

    // 同版「导入」等价路径（与四卡任务同口径：本构建无导入 UI 入口，用应用自身落盘的存档逐字节写回 + 冷重开）
    await page.context().close();
    const { context } = await makeContext(browser, { octet: 43, viewport: { width: 390, height: 844 }, saveText: storedAfterReady });
    const page2 = await context.newPage();
    attach(page2, record);
    await page2.goto('http://127.0.0.43:4300', { waitUntil: 'domcontentloaded' });
    await waitAppBoot(page2);
    await page2.waitForTimeout(1500);
    const s3 = await snap(page2, record, dir, '03-cold-reopen');
    const shelf3 = shelfIds(s3);
    record.shelves = { ready: shelf1, reload: shelf2, coldReopen: shelf3 };
    record.assertions = {
      readyHasSixDistinct: shelf1.length === 6 && new Set(shelf1).size === 6,
      reloadIdentical: JSON.stringify(shelf1) === JSON.stringify(shelf2),
      coldReopenIdentical: JSON.stringify(shelf1) === JSON.stringify(shelf3),
      reloadKeptReady: s2.rewardCheckpoint?.status === 'READY',
      coldReopenKeptReady: s3.rewardCheckpoint?.status === 'READY',
      noRedrawAnyPath: JSON.stringify(shelf1) === JSON.stringify(shelf2) && JSON.stringify(shelf2) === JSON.stringify(shelf3),
    };
    await context.close();
  },
});

// ============ 用例 4 · full-flow-purchase（AC-1 真实入口 / AC-3 恰好扣 / AC-4 买多件+离开+战次推进）============
await runCase('full-flow-purchase', {
  octet: 44, fixture: 'fx-shop-stage3-battle.json',
  body: async (record, page, dir) => {
    const beforeBattle = await readState(page);
    record.beforeBattle = { tickets: beforeBattle.runSupply.tickets, player: beforeBattle.player };
    await playToShop(record, page, dir);
    const afterShop = await readState(page);
    // 第 3 胜结算：券 +1（2 → 3）
    record.assertions = { ticketCreditedOnWin: afterShop.runSupply.tickets === 3 };
    const domReady = await readShopDom(page);
    record.domReady = { ticketBalance: domReady.ticketBalance, products: domReady.products.map((p) => ({ label: p.label, state: p.state })) };
    Object.assign(record.assertions, shelfAssertions(domReady), {
      realEntryAfterThirdWin: /兑换券余额：3 张/.test(domReady.ticketBalance ?? ''),
    });

    await armPurchaseCounter(page);
    // 买两件：白色香草(1 券) → 焦点镜(2 券)＝恰好 3 券扣完
    await buyInShop(page, ZH.white_herb, 0);
    await page.waitForTimeout(500);
    const afterFirst = await readState(page);
    await snap(page, record, dir, '05-after-first-purchase');
    await buyInShop(page, ZH.scope_lens, 1);
    await page.waitForTimeout(800);
    const afterSecond = await readState(page);
    record.purchaseCommits = await purchaseCommits(page);
    record.purchases = afterSecond.rewardCheckpoint?.purchases ?? [];
    const domAfter = await readShopDom(page);
    record.domAfter = domAfter;

    Object.assign(record.assertions, {
      purchasesExact: JSON.stringify(afterSecond.rewardCheckpoint?.purchases) === JSON.stringify([
        { itemId: 'white_herb', targetIndex: 0, ticketsSpent: 1 },
        { itemId: 'scope_lens', targetIndex: 1, ticketsSpent: 2 },
      ]),
      ticketsExactlyDeducted: afterSecond.runSupply.tickets === 0,
      ticketsNeverNegative: afterSecond.runSupply.tickets >= 0,
      singleCommitPerPurchase: record.purchaseCommits === 2,
      baselinesDistinct: new Set(afterSecond.player.map((p) => p.equipped).filter(Boolean)).size === 3,
      equippedCorrectly: afterSecond.player[0].equipped === 'white_herb' && afterSecond.player[1].equipped === 'scope_lens',
      oldItemsNotBagged: JSON.stringify(afterSecond.inventoryItemIds) === '[]',
      shelfUnchangedAfterPurchases: JSON.stringify(shelfIds(afterSecond)) === JSON.stringify(shelfIds(afterShop)),
      purchasedMarked: domAfter.products.filter((p) => p.label === ZH.white_herb || p.label === ZH.scope_lens).every((p) => p.purchased),
      remainingAllInsufficient: domAfter.products.filter((p) => !p.purchased).every((p) => p.state === 'insufficient' && p.buttonDisabled === true),
    });
    await snap(page, record, dir, '06-after-second-purchase-390x844');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    await snap(page, record, dir, '07-after-purchases-844x390');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);

    // 离开商店：提交 CLAIMED（关闭）后**同一动作直接起下一战**（关闭屏仅在中途刷新/继续失败时出现）。
    // AC-4「离开后战次正常推进」＝离开按钮 → 训练家开场白 → 第 4 战开打。
    await page.locator('[data-testid="shop-leave-button"]').tap();
    await waitBattleReady(page); // 开场白「点击继续」由 waitBattleReady 自动点掉
    await waitPhase(page, 'BATTLE');
    const next = await readState(page);
    await snap(page, record, dir, '08-stage4-battle');
    Object.assign(record.assertions, {
      leaveWentStraightToNextBattle: next.phase === 'BATTLE',
      stageAdvancedToFour: next.stage === 4,
      checkpointClearedOnBattleStart: next.rewardCheckpoint === null || next.rewardCheckpoint === undefined,
    });
  },
});

// ============ 用例 5 · rapid-click（AC-3）：同一确认按钮 DOM 级连点 8 次只扣一次券 ============
await runCase('rapid-click-purchase', {
  octet: 45, fixture: 'fx-shop-pending-t3.json',
  body: async (record, page, dir) => {
    await waitRewardReady(page);
    await armPurchaseCounter(page);
    const before = await readState(page);
    record.before = { tickets: before.runSupply.tickets };
    await page.locator(`[data-testid="shop-product"][aria-label="${ZH.choice_band}"] [data-testid="shop-redeem-button"]`).tap();
    await page.waitForTimeout(250);
    await page.locator('.pf-panel', { has: page.getByRole('heading', { name: '选择装备队员' }) }).locator('button').nth(0).tap();
    await page.waitForSelector('[role="group"][aria-label="确认兑换"]', { timeout: 10000 });
    await snap(page, record, dir, '01-confirm-armed');
    record.burst = await burstClick(page, '[role="group"][aria-label="确认兑换"] button[data-tone="primary"]', 8);
    await page.waitForTimeout(2500);
    const after = await snap(page, record, dir, '02-after-burst');
    record.purchaseCommits = await purchaseCommits(page);
    record.after = { tickets: after.runSupply.tickets, purchases: after.rewardCheckpoint?.purchases ?? [], equipped: after.player.map((p) => p.equipped) };
    record.assertions = {
      burstDispatchedEight: record.burst.clicked === 8,
      singleCommit: record.purchaseCommits === 1,
      chargedOnce: JSON.stringify(after.rewardCheckpoint?.purchases) === JSON.stringify([
        { itemId: 'choice_band', targetIndex: 0, ticketsSpent: 3 },
      ]),
      ticketsExactlyThree: after.runSupply.tickets === 0,
      equippedOnce: after.player[0].equipped === 'choice_band',
      othersUntouched: after.player[1].equipped === before.player[1].equipped && after.player[2].equipped === before.player[2].equipped,
      stillInShop: after.rewardCheckpoint?.status === 'READY' && after.phase === 'REWARD',
      stageNotAdvanced: after.stage === 3,
    };
  },
});

// ============ 用例 6 · double-tap（AC-3）：确认按钮真实触控双击只扣一次券 ============
await runCase('double-tap-purchase', {
  octet: 46, fixture: 'fx-shop-pending-t3.json',
  body: async (record, page, dir) => {
    await waitRewardReady(page);
    await armPurchaseCounter(page);
    const before = await readState(page);
    record.before = { tickets: before.runSupply.tickets };
    await page.locator(`[data-testid="shop-product"][aria-label="${ZH.mental_herb}"] [data-testid="shop-redeem-button"]`).tap();
    await page.waitForTimeout(250);
    await page.locator('.pf-panel', { has: page.getByRole('heading', { name: '选择装备队员' }) }).locator('button').nth(2).tap();
    await page.waitForSelector('[role="group"][aria-label="确认兑换"]', { timeout: 10000 });
    await snap(page, record, dir, '01-confirm-armed');
    const confirm = page.locator('[role="group"][aria-label="确认兑换"] button[data-tone="primary"]').first();
    const taps = [];
    const first = confirm.tap({ timeout: 4000 }).then(() => taps.push('tap1-ok')).catch((e) => taps.push(`tap1-fail ${String(e).slice(0, 60)}`));
    const second = confirm.tap({ timeout: 4000 }).then(() => taps.push('tap2-ok')).catch((e) => taps.push(`tap2-fail ${String(e).slice(0, 60)}`));
    await Promise.allSettled([first, second]);
    record.taps = taps;
    await page.waitForTimeout(2000);
    const after = await snap(page, record, dir, '02-after-double-tap');
    record.purchaseCommits = await purchaseCommits(page);
    record.after = { tickets: after.runSupply.tickets, purchases: after.rewardCheckpoint?.purchases ?? [] };
    record.assertions = {
      singleCommit: record.purchaseCommits === 1,
      chargedOnce: (after.rewardCheckpoint?.purchases ?? []).length === 1 && after.rewardCheckpoint.purchases[0].ticketsSpent === 2,
      ticketsExactlyTwo: after.runSupply.tickets === 1,
      stillInShop: after.rewardCheckpoint?.status === 'READY',
    };
  },
});

// ============ 用例 7 · refresh-import（AC-3 刷新/导入 + AC-5 冻结含已购记录）============
await runCase('refresh-import-purchase', {
  octet: 47, fixture: 'fx-shop-pending-t3.json',
  body: async (record, page, dir) => {
    await waitRewardReady(page);
    const ready = await readState(page);
    const shelfBefore = shelfIds(ready);
    await buyInShop(page, ZH.white_herb, 0);
    await page.waitForTimeout(500);
    const bought = await snap(page, record, dir, '01-after-purchase');
    record.afterPurchase = { tickets: bought.runSupply.tickets, purchases: bought.rewardCheckpoint?.purchases ?? [] };
    const storedAfterPurchase = await page.evaluate(() => localStorage.getItem('pokefactory_save_v1'));

    // 刷新：仍在商店，已购保留、券已扣、货架逐件不变、不重复扣
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    await page.waitForTimeout(1500);
    const reloaded = await snap(page, record, dir, '02-after-reload');
    // 同版存档冷重开（导入等价路径）
    await page.context().close();
    const { context } = await makeContext(browser, { octet: 47, viewport: { width: 390, height: 844 }, saveText: storedAfterPurchase });
    const page2 = await context.newPage();
    attach(page2, record);
    await page2.goto('http://127.0.0.47:4300', { waitUntil: 'domcontentloaded' });
    await waitAppBoot(page2);
    await page2.waitForTimeout(1500);
    const reopened = await snap(page2, record, dir, '03-cold-reopen');
    const domReopened = await readShopDom(page2);

    record.assertions = {
      reloadKeptPurchase: JSON.stringify(reloaded.rewardCheckpoint?.purchases) === JSON.stringify(bought.rewardCheckpoint?.purchases),
      reloadTicketsNotRededucted: reloaded.runSupply.tickets === 2,
      reloadShelfFrozen: JSON.stringify(shelfIds(reloaded)) === JSON.stringify(shelfBefore),
      coldReopenKeptPurchase: JSON.stringify(reopened.rewardCheckpoint?.purchases) === JSON.stringify(bought.rewardCheckpoint?.purchases),
      coldReopenTicketsNotRededucted: reopened.runSupply.tickets === 2,
      coldReopenShelfFrozen: JSON.stringify(shelfIds(reopened)) === JSON.stringify(shelfBefore),
      purchasedMarkedAfterReload: domReopened.products.find((p) => p.label === ZH.white_herb)?.purchased === true,
      stillReadyAfterReload: reloaded.rewardCheckpoint?.status === 'READY',
    };
    await context.close();
  },
});

// ============ 用例 8 · settle-7win（AC-10）：七战全胜 → 组奖励 3 + 券折算 7 = 10 BP，券清零 ============
await runCase('settle-7win-ticket-bp', {
  octet: 48, fixture: 'fx-shop-stage7-battle.json',
  body: async (record, page, dir) => {
    if (!(await waitBattleReady(page))) throw new Error('battle not ready');
    const before = await readState(page);
    record.before = { tickets: before.runSupply.tickets, balance: before.wallet.balance };
    const win = await winBattleByMoves(page, record);
    record.win = win;
    if (!win.ok) throw new Error('stage7 not won');
    await page.waitForTimeout(1500);
    const settled = await snap(page, record, dir, '01-settle-result');
    record.settlement = settled.wallet.lastSettlement;
    record.assertions = {
      settlementRecorded: settled.wallet.lastSettlement?.result === 'WIN' && settled.wallet.lastSettlement?.stage === 7,
      nominalBpIsThree: settled.wallet.lastSettlement?.nominalBp === 3,
      ticketBpIsSeven: settled.wallet.lastSettlement?.ticketBp === 7,
      amountIsTen: settled.wallet.lastSettlement?.amount === 10,
      balanceIsTen: settled.wallet.balance === 10,
      ticketsCleared: settled.runSupply.tickets === 0,
      settledThroughOne: settled.wallet.settledThrough === 1,
      screenShowsTen: /本组实际获得 BP：\+10/.test(settled.bodyTail),
    };
    await tapContinueRoundResult(page);
    await page.waitForTimeout(2500);
    const base = await snap(page, record, dir, '02-after-continue');
    Object.assign(record.assertions, {
      phaseIsBase: base.phase === 'BASE',
      ticketsStayZero: base.runSupply.tickets === 0,
    });
  },
});

// ============ 用例 9 · settle-cap（AC-10）：余额 9995 → 钳位 9999，折算仍可区分 ============
await runCase('settle-9999-cap', {
  octet: 53, fixture: 'fx-shop-stage7-battle-cap.json',
  body: async (record, page, dir) => {
    if (!(await waitBattleReady(page))) throw new Error('battle not ready');
    const before = await readState(page);
    record.before = { tickets: before.runSupply.tickets, balance: before.wallet.balance };
    const win = await winBattleByMoves(page, record);
    record.win = win;
    if (!win.ok) throw new Error('stage7 (cap) not won');
    await page.waitForTimeout(1500);
    const settled = await snap(page, record, dir, '01-settle-capped');
    record.settlement = settled.wallet.lastSettlement;
    record.assertions = {
      balanceClampedTo9999: settled.wallet.balance === 9999,
      nominalBpIsThree: settled.wallet.lastSettlement?.nominalBp === 3,
      ticketBpStillSeven: settled.wallet.lastSettlement?.ticketBp === 7,
      amountClampedToFour: settled.wallet.lastSettlement?.amount === 4,
      ticketsCleared: settled.runSupply.tickets === 0,
    };
  },
});

// ============ 用例 10 · mid-loss（AC-11）：中途逃跑认输 → 券清零、不折算、不给 BP ============
await runCase('mid-run-loss', {
  octet: 49, fixture: 'fx-shop-stage3-battle.json',
  body: async (record, page, dir) => {
    if (!(await waitBattleReady(page))) throw new Error('battle not ready');
    const before = await readState(page);
    record.before = { tickets: before.runSupply.tickets, balance: before.wallet.balance };
    await snap(page, record, dir, '01-battle-ready');
    await page.getByRole('button', { name: '逃跑' }).tap();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: '确认', exact: true }).tap();
    await waitPhase(page, 'ROUND_RESULT');
    const after = await snap(page, record, dir, '02-loss-settle');
    record.settlement = after.wallet.lastSettlement;
    record.assertions = {
      lossRecorded: after.roundResult === 'LOSS',
      ticketBpIsZero: after.wallet.lastSettlement?.ticketBp === 0,
      amountIsZero: after.wallet.lastSettlement?.amount === 0,
      noBpGranted: after.wallet.balance === before.wallet.balance,
      ticketsCleared: after.runSupply.tickets === 0,
      settledThroughAdvanced: after.wallet.settledThrough === 1,
      settlementResultLoss: after.wallet.lastSettlement?.result === 'LOSS',
    };
  },
});

// ============ 用例 11/12 · legacy-import（AC-13）：旧四卡检查点存档读入不崩溃 ============
for (const [name, fixture, octet] of [
  ['legacy-ready-import', 'fx-shop-legacy-ready.json', 50],
  ['legacy-claimed-import', 'fx-shop-legacy-claimed.json', 51],
]) {
  await runCase(name, {
    octet, fixture,
    body: async (record, page, dir) => {
      const state = await readState(page);
      record.bootState = { phase: state.phase, status: state.rewardCheckpoint?.status ?? null, rawIsLegacy: Boolean(state.rewardCheckpoint?.cardItemIds) };
      // 期望货架从队伍当前返还基准动态推导（9 种 − 3 基准，顺序无关）
      const held = state.player.map((p) => p.equipped).filter(Boolean);
      record.teamBaselines = held;
      const expected = expectedShelfOf(held).sort().join(',');
      // 等待**迁移后**的新格式 READY 落盘（raw localStorage 里注入的旧档本身是 READY/CLAIMED，
      // 不能用 waitRewardReady——它会被陈旧旧档误判为就绪）。
      await waitMigratedShopReady(page);
      await settleImages(page);
      const ready = await readState(page);
      const dom = await readShopDom(page);
      record.dom = { ticketBalance: dom.ticketBalance, products: dom.products.map((p) => ({ label: p.label, state: p.state })) };
      record.migratedCheckpoint = { status: ready.rewardCheckpoint?.status, shelf: shelfIds(ready) };
      const shelfCheck = shelfAssertions(dom);
      const domSet = [...dom.products.map((p) => idOfZh(p.label))].sort().join(',');
      const stateSet = [...shelfIds(ready)].sort().join(',');
      record.assertions = {
        noCrash: (record.errors ?? []).length === 0,
        noIncompatibleScreen: !/旧规则存档不兼容|存档无法读取/.test(ready.bodyTail),
        migratedToPendingThenReady: ready.rewardCheckpoint?.status === 'READY',
        noLegacyCardIds: ready.rewardCheckpoint?.cardItemIds === undefined,
        hasNewShelf: Array.isArray(ready.rewardCheckpoint?.shelf),
        sixDistinctAfterMigration: shelfCheck.exactlySix && shelfCheck.distinct,
        matchesExpectedSet: domSet === expected && stateSet === expected,
        pricesMatchTierTable: shelfCheck.pricesMatchTierTable,
        everyProductHasEffect: shelfCheck.everyProductHasEffect,
        noBrokenImages: shelfCheck.noBrokenImages,
      };
      await snap(page, record, dir, '01-migrated-shop-390x844');
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(400);
      await snap(page, record, dir, '02-migrated-shop-844x390');
    },
  });
}

// ============ 用例 13 · failure-semantics（F3 原子性补充）：写入失败不扣券、可恢复 ============
await runCase('failure-semantics-shop', {
  octet: 52, fixture: 'fx-shop-pending-t2.json',
  // (a) 首启前武装：命中「rewardCheckpoint.status=READY」的配货写入即抛错（与四卡任务同范式）
  initPage: (page) => page.addInitScript(() => {
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
  }),
  body: async (record, page, dir) => {
    await page.waitForTimeout(2500);
    const s1 = await snap(page, record, dir, '01-prepare-write-failed');
    record.prepareFailure = {
      status: s1.rewardCheckpoint?.status ?? null, stage: s1.stage,
      prepareFailures: await page.evaluate(() => window.__prepareFailures ?? 0),
      errorVisible: /货架保存失败|货架候选不足/.test(s1.bodyTail),
      bodyTail: s1.bodyTail,
    };
    // 解除故障注入 → 重试配货
    await page.evaluate(() => { window.__armPrepareFailure = false; });
    await page.getByRole('button', { name: '重新准备货架' }).tap();
    await waitRewardReady(page);
    const s2 = await snap(page, record, dir, '02-retry-prepared');
    record.prepareRecovered = { status: s2.rewardCheckpoint?.status, shelf: shelfIds(s2), tickets: s2.runSupply.tickets };
    const domReady = await readShopDom(page);
    Object.assign(record.prepareRecovered, { domProducts: domReady.products.map((p) => p.label) });

    // (b) 兑换写入失败：不扣券、不装备、如实报错、可重试
    await armFailWrite(page, '"purchases":\\[\\{');
    await buyInShop(page, ZH.scope_lens, 0);
    await page.waitForTimeout(1500);
    const s3 = await snap(page, record, dir, '03-purchase-write-failed');
    record.purchaseFailure = {
      status: s3.rewardCheckpoint?.status ?? null,
      ticketsUnchanged: s3.runSupply.tickets === 2,
      purchasesEmpty: (s3.rewardCheckpoint?.purchases ?? []).length === 0,
      equipUnchanged: s3.player[0].equipped === BASE_HELD[0],
      errorVisible: /兑换失败/.test(s3.bodyTail),
      failWriteStats: await failWriteStats(page),
      bodyTail: s3.bodyTail,
    };
    // 解除 → 重试兑换成功
    await disarmFailWrite(page);
    const retryBtn = page.locator('[role="group"][aria-label="确认兑换"] button[data-tone="primary"]').first();
    await retryBtn.tap();
    await page.waitForTimeout(1200);
    const s4 = await snap(page, record, dir, '04-purchase-retried');
    record.purchaseRecovered = {
      status: s4.rewardCheckpoint?.status ?? null,
      tickets: s4.runSupply.tickets,
      purchases: s4.rewardCheckpoint?.purchases ?? [],
      equipped: s4.player[0].equipped,
    };
    record.assertions = {
      prepareFailureStayedPending: record.prepareFailure.status === 'PENDING',
      prepareFailureHonestError: record.prepareFailure.errorVisible === true,
      retryProducedSixDistinct: record.prepareRecovered.shelf.length === 6 && new Set(record.prepareRecovered.shelf).size === 6,
      purchaseFailureStayedReady: record.purchaseFailure.status === 'READY',
      purchaseFailureNoDeduction: record.purchaseFailure.ticketsUnchanged === true,
      purchaseFailureNoDelivery: record.purchaseFailure.purchasesEmpty === true && record.purchaseFailure.equipUnchanged === true,
      purchaseFailureHonestError: record.purchaseFailure.errorVisible === true,
      purchaseRetrySucceeded: record.purchaseRecovered.tickets === 0
        && record.purchaseRecovered.purchases.length === 1
        && record.purchaseRecovered.purchases[0].ticketsSpent === 2
        && record.purchaseRecovered.equipped === 'scope_lens',
      stageNotAdvanced: s4.stage === 3,
    };
  },
});

// ============ 用例 14 · shop-closed-resume（AC-4 补充）：CLAIMED 关闭屏列出逐笔兑换，可继续推进战次 ============
await runCase('shop-closed-resume', {
  octet: 54, fixture: 'fx-shop-claimed-purchases.json',
  body: async (record, page, dir) => {
    const state = await readState(page);
    record.bootState = { phase: state.phase, status: state.rewardCheckpoint?.status ?? null };
    await page.waitForTimeout(800);
    const closed = await readState(page);
    const body = closed.bodyTail;
    record.closedScreenText = body;
    await snap(page, record, dir, '01-closed-screen-390x844');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    await snap(page, record, dir, '02-closed-screen-844x390');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    record.assertions = {
      closedIsClaimed: closed.rewardCheckpoint?.status === 'CLAIMED',
      screenSaysClosed: /商店已关闭/.test(body),
      listsWhiteHerbPurchase: /白色香草已装备给/.test(body) && /花费 1 券/.test(body),
      listsScopeLensPurchase: /焦点镜已装备给/.test(body) && /花费 2 券/.test(body),
      purchasesPreserved: JSON.stringify(closed.rewardCheckpoint?.purchases) === JSON.stringify([
        { itemId: 'white_herb', targetIndex: 0, ticketsSpent: 1 },
        { itemId: 'scope_lens', targetIndex: 1, ticketsSpent: 2 },
      ]),
      continueButtonVisible: await page.getByRole('button', { name: '继续挑战' }).count() > 0,
      noCrash: (record.errors ?? []).length === 0,
    };
    await page.getByRole('button', { name: '继续挑战' }).tap();
    await waitBattleReady(page); // 训练家开场白「点击继续」由 waitBattleReady 自动点掉
    await waitPhase(page, 'BATTLE');
    const next = await readState(page);
    await snap(page, record, dir, '03-stage4-battle');
    Object.assign(record.assertions, {
      stageAdvancedToFour: next.stage === 4,
      checkpointClearedOnBattleStart: next.rewardCheckpoint === null || next.rewardCheckpoint === undefined,
    });
  },
});

await browser.close();

const brief = {};
for (const [k, r] of Object.entries(results.cases)) {
  brief[k] = {
    failure: r.failure ?? null,
    assertions: r.assertions ?? null,
    errors: r.errors.slice(-3),
    httpErrors: r.httpErrors.slice(-3),
  };
}
console.log(JSON.stringify(brief, null, 2));
