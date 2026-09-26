// 轮次事务验收 P1#5/#6：连续点击只产生一轮（不依赖 UI busy）；事务进行中刷新恢复到完整回合、无半轮漂移
// 手段：隔离来源 127.0.0.x:4300 + 隔离 Playwright Chromium 手机模拟视口 + 受控存档注入（基准来自自然新档 base-save.json）。
// 不使用 DEV Win。不修改实现代码。连续点击用真实 DOM click 事件（同一次任务内同步连发）。
import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const taskDir = 'D:/Games/pokeFactory2/docs/tasks/轮次事务';
const out = `${taskDir}/evidence/input-reload`;
await mkdir(out, { recursive: true });
const baseRaw = await readFile(`${taskDir}/evidence/base-save.json`, 'utf8');

const makeMove = (name, zhName, { power = null, accuracy = null, type = 'normal', damage_class = 'status', effectId = 'NONE', target = 'selected-pokemon' } = {}) => ({
  name, zhName, power, accuracy, type, damage_class, pp: 20, currentPp: 20, maxPp: 20,
  battleData: {
    effectId, priority: 0, target, flags: [], critStage: 0, drainPercent: 0, recoilPercent: 0, healingPercent: 0,
    strikeMode: 'single', minHits: 1, maxHits: 1, secondaryEffects: [], substituteInteraction: 'blocked',
    makesContact: false, soundMove: false, powderMove: false, ballisticMove: false, punchMove: false,
    bypassProtect: false, ignoreAccuracyCheck: false,
  },
});
const tackle = makeMove('tackle', '撞击', { power: 40, accuracy: 100, damage_class: 'physical' });
const scratch = makeMove('scratch', '抓', { power: 40, accuracy: 100, damage_class: 'physical' });
const pound = makeMove('pound', '拍击', { power: 40, accuracy: 100, damage_class: 'physical' });
const headbutt = makeMove('headbutt', '头锤', { power: 40, accuracy: 100, damage_class: 'physical' });
const splash = makeMove('splash', '跃起', { target: 'user' });

const browser = await chromium.launch({ headless: true });
const options = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const results = { task: 'input-reload', cases: {}, errors: [] };

const attach = (page, record) => {
  page.on('pageerror', e => record.errors.push(`pageerror ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') record.errors.push(`console ${m.text()}`); });
  page.on('response', r => { if (r.status() >= 400) record.errors.push(`http ${r.status()} ${r.url()}`); });
};
const waitReady = async page => {
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.pf-battle-interaction-panel[data-enabled="true"]').count()) return;
    const b = page.locator('[data-awaiting-continue="true"]');
    if (await b.count()) await b.tap();
    await page.waitForTimeout(500);
  }
  throw new Error('battle not ready');
};
const readStable = page => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('pokefactory_save_v1'));
  const b = s.factory.battleResume;
  const brief = p => p && ({ id: p.id, hp: p.currentHp, maxHp: p.maxHp, pp: p.selectedMoves?.map(m => `${m.name}:${m.currentPp ?? m.pp}`) });
  return {
    phase: b.phase, turn: b.turn, logLen: b.battleLog?.length ?? 0, logTail: (b.battleLog ?? []).slice(-12),
    player: b.playerTeam?.map(brief), enemy: b.enemyTeam?.map(brief),
    weatherTurns: b.weatherTurns, tailwindTurns: b.tailwindTurns,
    panelEnabled: document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled ?? null,
    domPlayerHp: document.querySelector('.pf-battle-player-hud .pf-factory-hp-value')?.textContent?.trim() ?? null,
    domLines: Array.from(document.querySelectorAll('.pf-battle-message-panel p')).map(p => p.textContent.trim()),
    viewport: [innerWidth, innerHeight], scrollWidth: document.documentElement.scrollWidth,
  };
});
const snap = async (page, record, name) => {
  const state = await readStable(page);
  record.steps.push({ name, state });
  await page.screenshot({ path: `${out}/${record.name}-${name}.png` });
  return state;
};

const buildFixture = (raw, { speedPlayer = 1, speedEnemy = 500 } = {}) => {
  const save = JSON.parse(raw);
  const b = save.factory.battleResume;
  const player = b.playerTeam[0];
  const enemy = b.enemyTeam[0];
  const setup = (mon, speed) => {
    mon.currentHp = mon.maxHp = 300;
    mon.calculatedStats.hp = 300;
    mon.calculatedStats.attack = 50;
    mon.calculatedStats.defense = 100;
    mon.calculatedStats.speed = speed;
    mon.types = [{ slot: 1, type: { name: 'normal', url: '' } }];
    mon.baseTypes = mon.types;
    mon.factoryOriginalHeldItemId = null;
    delete mon.factoryHeldItemId;
    mon.abilities = [{ ability: { name: 'run-away', url: '' } }];
    mon.statStages = { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0, evasion: 0 };
  };
  setup(player, speedPlayer);
  setup(enemy, speedEnemy);
  player.selectedMoves = [tackle, splash];
  enemy.selectedMoves = [tackle, scratch, pound, headbutt];
  b.hazards = { player: { stealthRock: false, toxicSpikesLayers: 0 }, enemy: { stealthRock: false, toxicSpikesLayers: 0 } };
  b.weather = 'none'; b.weatherTurns = 0; b.tailwindTurns = { player: 0, enemy: 0 };
  b.fieldState = []; b.fieldTurns = {}; b.battleLog = []; b.turn = 'PLAYER'; b.battleMenuTab = 'MAIN';
  b.checkpointAt = new Date().toISOString();
  return JSON.stringify(save);
};

// ---------- Case 1: 连续点击 ----------
{
  const origin = 'http://127.0.0.66:4300';
  const record = { name: 'double-click', origin, steps: [], errors: [], runs: [] };
  results.cases['double-click'] = record;
  const raw = buildFixture(baseRaw);
  const context = await browser.newContext({ ...options, storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'pokefactory_save_v1', value: raw }] }] } });
  const page = await context.newPage();
  attach(page, record);
  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await waitReady(page);
    const before = await snap(page, record, 'ready-390');
    // 同一次任务内对同一指令按钮同步连发 8 次真实 click 事件
    const burst = await page.evaluate(() => {
      const btn = document.querySelector('.pf-battle-move-button');
      if (!btn) return { dispatched: 0 };
      let n = 0;
      for (let i = 0; i < 8; i++) { btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); n++; }
      return { dispatched: n, enabledAtBurst: document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled ?? null };
    });
    record.runs.push({ kind: 'sync-burst-8', burst, before: { logLen: before.logLen, playerPp: before.player?.[0]?.pp, enemyPp: before.enemy?.[0]?.pp, playerHp: before.player?.[0]?.hp } });
    await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 45000 });
    await page.waitForTimeout(800);
    const after = await snap(page, record, 'after-burst-390');
    const logDelta = (after.logLen ?? 0) - (before.logLen ?? 0);
    const newLog = logDelta > 0 ? await page.evaluate(n => JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.battleLog.slice(-n), logDelta) : [];
    record.runs.push({
      kind: 'sync-burst-8-result', logDelta, newLog,
      enemyActionLines: newLog.filter(l => l.includes('对手的') && l.includes('使用了')).length,
      playerActionLines: newLog.filter(l => !l.includes('对手的') && l.includes('使用了')).length,
      after: { playerPp: after.player?.[0]?.pp, enemyPp: after.enemy?.[0]?.pp, playerHp: after.player?.[0]?.hp },
    });
    await page.waitForTimeout(1200);
    // 跨宏任务连点（25ms 间隔，落在下一次 React 渲染置 disabled 之前）
    const before2 = await snap(page, record, 'ready2-390');
    const spaced = await page.evaluate(() => new Promise(resolve => {
      const btn = document.querySelector('.pf-battle-move-button');
      const stamps = [];
      let n = 0;
      const timer = setInterval(() => {
        stamps.push(Math.round(performance.now()));
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        if (++n >= 5) { clearInterval(timer); resolve({ fired: n, stamps, enabledNow: document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled ?? null }); }
      }, 25);
    }));
    await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 45000 });
    await page.waitForTimeout(800);
    const after2 = await snap(page, record, 'after-spaced-burst-390');
    const logDelta2 = (after2.logLen ?? 0) - (before2.logLen ?? 0);
    const newLog2 = logDelta2 > 0 ? await page.evaluate(n => JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.battleLog.slice(-n), logDelta2) : [];
    record.runs.push({
      kind: 'spaced-burst-5-result', spaced, logDelta: logDelta2, newLog: newLog2,
      enemyActionLines: newLog2.filter(l => l.includes('对手的') && l.includes('使用了')).length,
      playerActionLines: newLog2.filter(l => !l.includes('对手的') && l.includes('使用了')).length,
      after: { playerPp: after2.player?.[0]?.pp, enemyPp: after2.enemy?.[0]?.pp },
    });
  } catch (e) {
    record.failure = String(e);
    await page.screenshot({ path: `${out}/double-click-failure.png` }).catch(() => {});
  } finally { await context.close(); }
}

// ---------- Case 2: 事务进行中刷新 ----------
{
  const origin = 'http://127.0.0.67:4300';
  const record = { name: 'reload-mid-round', origin, steps: [], errors: [], observations: {} };
  results.cases['reload-mid-round'] = record;
  const raw = buildFixture(baseRaw);
  const context = await browser.newContext({ ...options, storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'pokefactory_save_v1', value: raw }] }] } });
  const page = await context.newPage();
  attach(page, record);
  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await waitReady(page);
    const preRound = await snap(page, record, 'pre-round-390');
    await page.getByRole('button', { name: '战斗', exact: true }).tap();
    await page.locator('.pf-battle-move-button').first().tap();
    // 等待事务确实进行中（命令区禁用 + 敌方已出手日志出现），再刷新
    await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'false', null, { timeout: 20000 });
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.pf-battle-message-panel p')).some(p => p.textContent.includes('对手的')), null, { timeout: 20000 });
    const midRound = await snap(page, record, 'mid-round-before-reload-390');
    record.observations.midRound = { panelEnabled: midRound.panelEnabled, domPlayerHp: midRound.domPlayerHp, domLines: midRound.domLines, stableLogLen: midRound.logLen, stablePlayerPp: midRound.player?.[0]?.pp, stablePlayerHp: midRound.player?.[0]?.hp };
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitReady(page);
    await page.waitForTimeout(1200);
    const postReload = await snap(page, record, 'post-reload-390');
    record.observations.preRound = { logLen: preRound.logLen, playerPp: preRound.player?.[0]?.pp, enemyPp: preRound.enemy?.[0]?.pp, playerHp: preRound.player?.[0]?.hp, enemyHp: preRound.enemy?.[0]?.hp, turn: preRound.turn, panelEnabled: preRound.panelEnabled };
    record.observations.postReload = { logLen: postReload.logLen, playerPp: postReload.player?.[0]?.pp, enemyPp: postReload.enemy?.[0]?.pp, playerHp: postReload.player?.[0]?.hp, enemyHp: postReload.enemy?.[0]?.hp, turn: postReload.turn, panelEnabled: postReload.panelEnabled };
    record.observations.verdict = {
      ppRestored: JSON.stringify(preRound.player?.[0]?.pp) === JSON.stringify(postReload.player?.[0]?.pp),
      hpRestored: preRound.player?.[0]?.hp === postReload.player?.[0]?.hp,
      logRestored: preRound.logLen === postReload.logLen,
      enemyHpRestored: preRound.enemy?.[0]?.hp === postReload.enemy?.[0]?.hp,
    };
  } catch (e) {
    record.failure = String(e);
    await page.screenshot({ path: `${out}/reload-mid-round-failure.png` }).catch(() => {});
  } finally { await context.close(); }
}

await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2), 'utf8');
await browser.close();
console.log(JSON.stringify({
  doubleClick: results.cases['double-click'] && { failure: results.cases['double-click'].failure, runs: results.cases['double-click'].runs, errors: results.cases['double-click'].errors.slice(-4) },
  reload: results.cases['reload-mid-round'] && { failure: results.cases['reload-mid-round'].failure, observations: results.cases['reload-mid-round'].observations, errors: results.cases['reload-mid-round'].errors.slice(-4) },
}, null, 2));
