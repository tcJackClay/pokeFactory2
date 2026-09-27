// 四卡生成验收 · 共享夹具/驱动库（player 角色使用；不属于实现代码）
import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

export const TASK_DIR = 'D:/Games/pokeFactory2/docs/tasks/四卡生成';
export const EVIDENCE_DIR = `${TASK_DIR}/evidence`;
export const FIXTURE_DIR = `${EVIDENCE_DIR}/fixtures`;
export const SEVEN = ['scope_lens', 'quick_claw', 'kings_rock', 'choice_band', 'focus_band', 'heavy_duty_boots', 'loaded_dice'];
export const ZH = {
  scope_lens: '焦点镜', quick_claw: '先制之爪', kings_rock: '王者之证',
  choice_band: '讲究头带', focus_band: '气势头带', heavy_duty_boots: '厚底靴', loaded_dice: '机变骰子',
};

export const COMBO_A = ['heavy_duty_boots', 'quick_claw', 'kings_rock'];
export const COMBO_B = ['loaded_dice', 'scope_lens', 'focus_band'];
export const rest = (held) => SEVEN.filter((id) => !held.includes(id));

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

export const readStoredSave = (page) => page.evaluate(() => localStorage.getItem('pokefactory_save_v1'));

export const readState = (page) => page.evaluate(() => {
  const raw = localStorage.getItem('pokefactory_save_v1');
  const s = raw ? JSON.parse(raw) : null;
  if (!s) return { empty: true, body: document.body.innerText.slice(-600) };
  const b = s.factory.battleResume ?? { status: 'EMPTY' };
  if (!Array.isArray(b.playerTeam)) {
    const notice0 = document.querySelector('[data-testid="factory-held-item-repair-notice"]');
    return {
      schema: s.schemaVersion, runId: s.wallet.currentRunId, runSupply: s.runSupply,
      phase: b.status ?? 'EMPTY', stage: b.stage ?? null, roundResult: b.roundResult ?? null,
      rewardCheckpoint: b.rewardCheckpoint ?? null, player: [], enemy: [], inventoryItemIds: [],
      repairNotice: notice0 ? notice0.innerText.replace(/\s+/g, ' ').trim() : null,
      bodyTail: document.body.innerText.replace(/\s+/g, ' ').slice(-500),
      viewport: [innerWidth, innerHeight],
      docSize: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    };
  }
  const brief = (p) => p && ({
    id: p.id, name: p.name,
    original: p.factoryOriginalHeldItemId ?? null,
    equipped: p.factoryEquippedHeldItemId ?? null,
    current: p.factoryHeldItemId ?? null,
    hp: p.currentHp,
  });
  const notice = document.querySelector('[data-testid="factory-held-item-repair-notice"]');
  return {
    schema: s.schemaVersion,
    runId: s.wallet.currentRunId,
    runSupply: s.runSupply,
    challengeStatus: s.factory.challengeStatus,
    phase: b.phase, stage: b.stage, roundResult: b.roundResult, streak: b.streak, swapCount: b.swapCount,
    heldItemBaselineRepaired: b.heldItemBaselineRepaired ?? null,
    rewardCheckpoint: b.rewardCheckpoint ?? null,
    player: b.playerTeam.map(brief),
    enemy: b.enemyTeam.map(brief),
    inventoryItemIds: b.inventoryItemIds,
    totalRents: s.progress.totalRents,
    repairNotice: notice ? notice.innerText.replace(/\s+/g, ' ').trim() : null,
    bodyTail: document.body.innerText.replace(/\s+/g, ' ').slice(-500),
    viewport: [innerWidth, innerHeight],
    docSize: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
  };
});

/** 奖励屏 DOM：卡面文案 / 可装备队员 / 破图检查 */
export const readRewardDom = (page) => page.evaluate(() => {
  const text = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : null);
  const cardsGroup = document.querySelector('[role="group"][aria-label="奖励卡"]');
  const cards = cardsGroup ? Array.from(cardsGroup.querySelectorAll('button')).map((btn) => ({
    text: text(btn), pressed: btn.getAttribute('aria-pressed'), disabled: btn.disabled,
  })) : [];
  const teammatePanel = Array.from(document.querySelectorAll('.pf-panel'))
    .find((panel) => panel.querySelector('h3')?.innerText.includes('选择装备队员'));
  const teammates = teammatePanel ? Array.from(teammatePanel.querySelectorAll('button')).map((btn) => ({
    text: text(btn), disabled: btn.disabled,
  })) : [];
  const confirmGroup = document.querySelector('[role="group"][aria-label="确认替换持有物"]');
  const imgs = Array.from(document.querySelectorAll('img')).map((img) => ({
    src: img.getAttribute('src'), naturalWidth: img.naturalWidth, complete: img.complete,
    inReward: Boolean(img.closest('[aria-labelledby="factory-reward-title"]')),
  }));
  return {
    heading: text(document.querySelector('#factory-reward-title')),
    cards, teammates,
    confirm: text(confirmGroup),
    hasConfirmButton: Boolean(confirmGroup),
    imgs,
    brokenImgs: imgs.filter((i) => i.complete && i.naturalWidth === 0),
    body: document.body.innerText.replace(/\s+/g, ' ').slice(-1800),
  };
});

export const snap = async (page, record, dir, name) => {
  const state = await readState(page);
  record.steps.push({ name, state });
  await page.screenshot({ path: `${dir}/${name}.png` });
  return state;
};

/** 等页面内全部 <img> 结束加载（用于「无破图」判定，避免把「还没加载完」误判为破图） */
export const settleImages = async (page, timeout = 15000) => {
  await page.waitForFunction(() => Array.from(document.querySelectorAll('img')).every((img) => img.complete), null, { timeout }).catch(() => {});
  await page.waitForTimeout(400);
};

export const waitAppBoot = async (page) => {
  await page.waitForFunction(() => {
    const body = document.body.innerText;
    return !body.includes('正在载入') && document.querySelectorAll('button').length > 0;
  }, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(600);
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

export const tapSkipSwap = async (page) => page.getByRole('button', { name: '跳过交换' }).tap();
export const tapContinueRoundResult = async (page) => page.locator('.pf-result-shell button[data-tone="primary"]').tap();

/** 受控故障注入：让符合条件的下一次 localStorage.setItem 抛错（参考既有 failNextWrite 思路）。 */
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

/**
 * 统计「奖励检查点状态跃迁到 CLAIMED」的落盘次数（不抛错、只计数）。
 * 只有当写入前存储里的 rewardCheckpoint.status !== 'CLAIMED' 而写入后 === 'CLAIMED' 时才计一次，
 * 因此后续自动存档不会重复计数。
 */
export const armClaimTransitionCounter = (page) => page.evaluate(() => {
  const proto = Object.getPrototypeOf(window.localStorage);
  if (!window.__origSetItem) window.__origSetItem = proto.setItem;
  if (!window.__origGetItem) window.__origGetItem = proto.getItem;
  window.__claimTransitions = 0;
  window.__claimTransitionDetail = [];
  proto.setItem = function (key, value) {
    try {
      let before = null;
      const prevRaw = window.__origGetItem.call(this, key);
      if (prevRaw) { try { before = JSON.parse(prevRaw); } catch { before = null; } }
      const after = JSON.parse(String(value));
      const bs = before?.factory?.battleResume?.rewardCheckpoint?.status ?? null;
      const as = after?.factory?.battleResume?.rewardCheckpoint?.status ?? null;
      if (as === 'CLAIMED' && bs !== 'CLAIMED') {
        window.__claimTransitions += 1;
        window.__claimTransitionDetail.push({ from: bs, to: as, at: new Date().toISOString(), claim: after?.factory?.battleResume?.rewardCheckpoint?.claim ?? null });
      }
    } catch { /* 计数失败不影响写入 */ }
    return window.__origSetItem.call(this, key, value);
  };
  return true;
});

export const claimTransitionStats = (page) => page.evaluate(() => ({ count: window.__claimTransitions ?? null, detail: window.__claimTransitionDetail ?? [] }));

/** 在单个 JS 任务内对同一按钮派发 N 次真实 DOM 点击（DOM 级连点；不绕过游戏循环/React 事件） */
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

/**
 * 在换怪屏「确定地」选中 .pf-battle-card 下标 index 的卡片。
 * 说明：FactorySwapScreen 的我方 idx0 默认即为选中态，直接 tap 会把它切掉；
 *      故先读 aria-pressed，未选中才点，点后复核。
 */
export const selectSwapCard = async (page, index) => {
  const card = page.locator('.pf-battle-card').nth(index);
  for (let i = 0; i < 2; i++) {
    if ((await card.getAttribute('aria-pressed')) === 'true') return true;
    await card.tap({ position: { x: 60, y: 70 } });
    await page.waitForTimeout(300);
  }
  return (await card.getAttribute('aria-pressed')) === 'true';
};

export const writeRecord = async (name, record) => {
  await mkdir(`${EVIDENCE_DIR}/${name}`, { recursive: true });
  await writeFile(`${EVIDENCE_DIR}/${name}/result.json`, JSON.stringify(record, null, 2), 'utf8');
};

export const ensureDirs = async (name) => {
  const dir = `${EVIDENCE_DIR}/${name}`;
  await mkdir(dir, { recursive: true });
  return dir;
};
