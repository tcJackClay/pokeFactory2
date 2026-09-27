// 奖励商店验收 · 共享夹具/驱动库（player 角色使用；不属于实现代码）。
// 范式照 docs/tasks/四卡生成/four-card-harness.mjs：隔离来源 127.0.0.<octet>:4300 + 隔离 Playwright Chromium
// 手机模拟视口 + 受控存档注入（团队摆到节点边界）+ 真实 UI 触控。
import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

export const TASK_DIR = 'D:/Games/pokeFactory2-worktrees/reward-shop/docs/tasks/奖励商店';
export const EVIDENCE_DIR = `${TASK_DIR}/evidence`;
export const FIXTURE_DIR = `${EVIDENCE_DIR}/fixtures`;

// 数值源为 src/features/game/config/factoryRewardPool.ts 的档位表（唯一真值源；单测已断言一致）。
export const ZH = {
  scope_lens: '焦点镜', quick_claw: '先制之爪', kings_rock: '王者之证',
  choice_band: '讲究头带', focus_band: '气势头带', heavy_duty_boots: '厚底靴',
  loaded_dice: '机变骰子', white_herb: '白色香草', mental_herb: '心灵香草',
};
export const PRICE = {
  scope_lens: 2, quick_claw: 1, kings_rock: 2, choice_band: 3, focus_band: 2,
  heavy_duty_boots: 1, loaded_dice: 2, white_herb: 1, mental_herb: 2,
};
export const idOfZh = (zh) => Object.entries(ZH).find(([, name]) => name === zh)?.[0] ?? null;

// 夹具队伍返还基准：slowpoke=heavy_duty_boots, rhyhorn=quick_claw, tentacool=kings_rock
// ⇒ 货架必然 = 9 种持有道具 − 3 基准（恰好 6 件、互不重复）。
export const BASE_HELD = ['heavy_duty_boots', 'quick_claw', 'kings_rock'];
export const expectedShelfOf = (held) => Object.keys(ZH).filter((id) => !held.includes(id));

export const launch = () => chromium.launch({ headless: true, args: ['--no-proxy-server'] });

export const loadFixture = async (name) => readFile(`${FIXTURE_DIR}/${name}`, 'utf8');

export const attach = (page, record) => {
  page.on('pageerror', (e) => record.errors.push(`pageerror ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') record.errors.push(`console ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) record.httpErrors.push(`${r.status()} ${r.url()}`); });
};

export const makeContext = async (browser, { octet, viewport, saveText }) => {
  const origin = `http://127.0.0.${octet}:4300`;
  const context = await browser.newContext({
    viewport,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    ...(saveText ? { storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'pokefactory_save_v1', value: saveText }] }] } } : {}),
  });
  return { origin, context };
};

export const readState = (page) => page.evaluate(() => {
  const raw = localStorage.getItem('pokefactory_save_v1');
  const s = raw ? JSON.parse(raw) : null;
  if (!s) return { empty: true, body: document.body.innerText.slice(-600) };
  const b = s.factory.battleResume ?? { status: 'EMPTY' };
  const brief = (p) => p && ({
    name: p.name,
    original: p.factoryOriginalHeldItemId ?? null,
    equipped: p.factoryEquippedHeldItemId ?? null,
    current: p.factoryHeldItemId ?? null,
  });
  return {
    schema: s.schemaVersion,
    phase: b.phase ?? null, stage: b.stage ?? null, status: b.status ?? null,
    roundResult: b.roundResult ?? null, streak: b.streak ?? null, lastBpGain: b.lastBpGain ?? null,
    runId: s.wallet.currentRunId,
    runSupply: s.runSupply,
    wallet: {
      balance: s.wallet.balance, settledThrough: s.wallet.settledThrough,
      brainSymbols: s.wallet.brainSymbols, lastSettlement: s.wallet.lastSettlement ?? null,
    },
    rewardCheckpoint: b.rewardCheckpoint ?? null,
    player: Array.isArray(b.playerTeam) ? b.playerTeam.map(brief) : [],
    inventoryItemIds: b.inventoryItemIds ?? s.inventoryItemIds ?? [],
    bodyTail: document.body.innerText.replace(/\s+/g, ' ').slice(-700),
    viewport: [innerWidth, innerHeight],
    docSize: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
  };
});

/** 商店 DOM：商品（名称/价格/功能说明/按钮态/已购标记）+ 券余额 + 破图检查 */
export const readShopDom = (page) => page.evaluate(() => {
  const text = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : null);
  const products = Array.from(document.querySelectorAll('[data-testid="shop-product"]')).map((el) => {
    const priceEl = Array.from(el.querySelectorAll('p')).find((p) => /^\d+\s*券$/.test(p.innerText.trim()));
    const effectEl = Array.from(el.querySelectorAll('p')).find((p) => p.innerText.length > 12 && !/^\d+\s*券$/.test(p.innerText.trim()));
    const noteEl = Array.from(el.querySelectorAll('p')).find((p) => /条件性|无对应触发场景/.test(p.innerText));
    const btn = el.querySelector('[data-testid="shop-redeem-button"]');
    const priceLineThrough = priceEl ? (getComputedStyle(priceEl).textDecorationLine || '').includes('line-through') : false;
    return {
      label: el.getAttribute('aria-label'),
      state: el.getAttribute('data-state'),
      price: priceEl ? priceEl.innerText.trim() : null,
      priceLineThrough,
      effect: effectEl ? effectEl.innerText.trim() : null,
      note: noteEl ? noteEl.innerText.trim() : null,
      purchased: Boolean(el.querySelector('[data-testid="shop-product-purchased"]')),
      buttonText: btn ? text(btn) : null,
      buttonDisabled: btn ? btn.disabled : null,
      buttonGrayscale: btn ? (getComputedStyle(btn).filter || '').includes('grayscale') : false,
    };
  });
  const teammatePanel = Array.from(document.querySelectorAll('.pf-panel'))
    .find((panel) => panel.querySelector('h3')?.innerText.includes('选择装备队员'));
  const imgs = Array.from(document.querySelectorAll('img')).map((img) => ({
    src: img.getAttribute('src'), naturalWidth: img.naturalWidth, complete: img.complete,
  }));
  const confirmGroup = document.querySelector('[role="group"][aria-label="确认兑换"]');
  return {
    heading: text(document.querySelector('#factory-reward-title')),
    ticketBalance: text(document.querySelector('[data-testid="shop-ticket-balance"]')),
    products,
    teammateButtons: teammatePanel ? Array.from(teammatePanel.querySelectorAll('button')).map((btn) => ({
      text: text(btn), disabled: btn.disabled,
    })) : [],
    confirmText: text(confirmGroup),
    hasConfirm: Boolean(confirmGroup),
    leaveButtonText: text(document.querySelector('[data-testid="shop-leave-button"]')),
    hasLeaveButton: Boolean(document.querySelector('[data-testid="shop-leave-button"]')),
    brokenImgs: imgs.filter((i) => i.complete && i.naturalWidth === 0),
    body: document.body.innerText.replace(/\s+/g, ' ').slice(-2400),
  };
});

export const snap = async (page, record, dir, name) => {
  const state = await readState(page);
  record.steps.push({ name, phase: state.phase, stage: state.stage, tickets: state.runSupply?.tickets ?? null, status: state.rewardCheckpoint?.status ?? null });
  await page.screenshot({ path: `${dir}/${name}.png` });
  return state;
};

export const settleImages = async (page, timeout = 15000) => {
  await page.waitForFunction(() => Array.from(document.querySelectorAll('img')).every((img) => img.complete), null, { timeout }).catch(() => {});
  await page.waitForTimeout(400);
};

export const waitAppBoot = async (page) => {
  await page.waitForFunction(() => {
    const body = document.body.innerText;
    return !body.includes('正在载入') && document.querySelectorAll('button').length > 0;
  }, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(800);
};

export const waitBattleReady = async (page, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (await page.locator('.pf-battle-interaction-panel[data-enabled="true"]').count()) return true;
    const cont = page.locator('[data-awaiting-continue="true"]');
    if (await cont.count()) await cont.tap().catch(() => {});
    await page.waitForTimeout(500);
  }
  return false;
};

/** 真实出招取胜：只点「战斗」+ 招式按钮，直到出现结算屏。 */
export const winBattleByMoves = async (page, record, maxTurns = 14) => {
  const turns = [];
  for (let turn = 0; turn < maxTurns; turn++) {
    if (await page.locator('.pf-result-shell').count()) return { ok: true, turns };
    const ready = await waitBattleReady(page, 20);
    if (!ready) {
      const switchBtn = page.locator('.pf-battle-pokemon-grid button:not([disabled])').filter({ hasText: '出战' }).first();
      if (await switchBtn.count()) {
        await switchBtn.tap().catch(() => {});
        turns.push({ turn, action: 'forced-switch' });
        await page.waitForTimeout(1500);
        continue;
      }
      turns.push({ turn, action: 'not-ready' });
      await page.waitForTimeout(800);
      continue;
    }
    const switchBtn = page.locator('.pf-battle-pokemon-grid button:not([disabled])').filter({ hasText: '出战' }).first();
    if (await switchBtn.count()) {
      await switchBtn.tap().catch(() => {});
      turns.push({ turn, action: 'forced-switch' });
      await page.waitForTimeout(1500);
      continue;
    }
    const battleTab = page.getByRole('button', { name: '战斗', exact: true });
    if (await battleTab.count()) await battleTab.tap().catch(() => {});
    const moves = page.locator('.pf-battle-move-button');
    const count = await moves.count();
    let pick = -1;
    for (let i = 0; i < count; i++) {
      const t = await moves.nth(i).innerText().catch(() => '');
      if (/威力\s*\d/.test(t) && !/PP\s*0\/0/.test(t)) { pick = i; break; }
    }
    if (pick < 0) { turns.push({ turn, action: 'no-damaging-move' }); await page.waitForTimeout(600); continue; }
    const moveText = (await moves.nth(pick).innerText()).replace(/\s+/g, ' ').trim().slice(0, 40);
    await moves.nth(pick).tap().catch(() => {});
    turns.push({ turn, action: 'move', pick, moveText });
    await page.waitForTimeout(1200);
  }
  const ok = Boolean(await page.locator('.pf-result-shell').count());
  return { ok, turns, tail: (await page.locator('body').innerText()).slice(-300) };
};

export const waitPhase = async (page, phase, timeout = 45000) => {
  await page.waitForFunction((p) => {
    try { return JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.phase === p; } catch { return false; }
  }, phase, { timeout });
  await page.waitForTimeout(400);
};

export const waitRewardReady = async (page, timeout = 45000) => {
  await page.waitForFunction(() => {
    try {
      const cp = JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.rewardCheckpoint;
      return cp && cp.status !== 'PENDING';
    } catch { return false; }
  }, null, { timeout });
  await page.waitForTimeout(400);
};

/**
 * 等待**新格式** READY 落盘（shelf 6 件 + 无 legacy 字段）。
 * 用于 legacy 迁移用例：注入的旧档 raw localStorage 本身就是 status:'READY'/'CLAIMED'，
 * waitRewardReady 会在应用尚未持久化迁移结果时误判就绪（读到的是陈旧旧档）。
 */
export const waitMigratedShopReady = async (page, timeout = 45000) => {
  await page.waitForFunction(() => {
    try {
      const cp = JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.rewardCheckpoint;
      return cp && cp.status === 'READY' && Array.isArray(cp.shelf) && cp.shelf.length === 6
        && cp.cardItemIds === undefined && Array.isArray(cp.purchases);
    } catch { return false; }
  }, null, { timeout });
  await page.waitForTimeout(400);
};

export const tapSkipSwap = async (page) => page.getByRole('button', { name: '跳过交换' }).tap();
export const tapContinueRoundResult = async (page) => page.locator('.pf-result-shell button[data-tone="primary"]').tap();

/** 商店购买：选商品 → 选队员 → 确认兑换（真实触控全程）。 */
export const buyInShop = async (page, zhName, teammateIndex) => {
  await page.locator(`[data-testid="shop-product"][aria-label="${zhName}"] [data-testid="shop-redeem-button"]`).tap();
  await page.waitForTimeout(250);
  const teammatePanel = page.locator('.pf-panel', { has: page.getByRole('heading', { name: '选择装备队员' }) });
  await teammatePanel.locator('button').nth(teammateIndex).tap();
  await page.waitForSelector('[role="group"][aria-label="确认兑换"]', { timeout: 10000 });
  await page.locator('[role="group"][aria-label="确认兑换"] button[data-tone="primary"]').tap();
  await page.waitForTimeout(700);
};

/**
 * 统计「兑换成功落盘」次数（purchases 数组严格增长才计一次；自动存档不计数）。
 * 与四卡任务的 claimTransitionCounter 同范式，用于双击/连点只扣一次券的判定。
 */
export const armPurchaseCounter = (page) => page.evaluate(() => {
  const proto = Object.getPrototypeOf(window.localStorage);
  if (!window.__origSetItem) window.__origSetItem = proto.setItem;
  if (!window.__origGetItem) window.__origGetItem = proto.getItem;
  window.__purchaseCommits = 0;
  proto.setItem = function (key, value) {
    try {
      let before = null;
      const prevRaw = window.__origGetItem.call(this, key);
      if (prevRaw) { try { before = JSON.parse(prevRaw); } catch { before = null; } }
      const after = JSON.parse(String(value));
      const bl = before?.factory?.battleResume?.rewardCheckpoint?.purchases?.length ?? 0;
      const al = after?.factory?.battleResume?.rewardCheckpoint?.purchases?.length ?? 0;
      if (al > bl) window.__purchaseCommits += 1;
    } catch { /* 计数失败不影响写入 */ }
    return window.__origSetItem.call(this, key, value);
  };
  return true;
});

export const purchaseCommits = (page) => page.evaluate(() => window.__purchaseCommits ?? null);

/** 受控故障注入：让符合条件的下一次 localStorage.setItem 抛错。 */
export const armFailWrite = async (page, matchSource) => {
  await page.evaluate((src) => {
    const proto = Object.getPrototypeOf(window.localStorage);
    if (!window.__origSetItem) window.__origSetItem = proto.setItem;
    window.__failNextWriteArmed = true;
    window.__failNextWriteHits = 0;
    proto.setItem = function (key, value) {
      const matches = new RegExp(src).test(String(value));
      if (window.__failNextWriteArmed && matches) {
        window.__failNextWriteArmed = false;
        window.__failNextWriteHits += 1;
        throw new Error('injected quota failure (failNextWrite)');
      }
      return window.__origSetItem.call(this, key, value);
    };
  }, matchSource);
};

export const failWriteStats = (page) => page.evaluate(() => ({ armed: window.__failNextWriteArmed ?? null, hits: window.__failNextWriteHits ?? null }));

export const disarmFailWrite = (page) => page.evaluate(() => {
  const proto = Object.getPrototypeOf(window.localStorage);
  if (window.__origSetItem) proto.setItem = window.__origSetItem;
  window.__failNextWriteArmed = false;
  return true;
});

/** 在单个 JS 任务内对同一按钮派发 N 次真实 DOM 点击（DOM 级连点；不绕过游戏循环/React 事件）。 */
export const burstClick = (page, selector, times) => page.evaluate(({ sel, n }) => {
  const btn = document.querySelector(sel);
  if (!btn) return { clicked: 0, reason: 'button-not-found' };
  let clicked = 0;
  for (let i = 0; i < n; i++) {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    clicked += 1;
  }
  return { clicked, disabled: btn.disabled };
}, { sel: selector, n: times });

export const writeRecord = async (name, record) => {
  await mkdir(`${EVIDENCE_DIR}/${name}`, { recursive: true });
  await writeFile(`${EVIDENCE_DIR}/${name}/result.json`, JSON.stringify(record, null, 2), 'utf8');
};

export const ensureDirs = async (name) => {
  const dir = `${EVIDENCE_DIR}/${name}`;
  await mkdir(dir, { recursive: true });
  return dir;
};
