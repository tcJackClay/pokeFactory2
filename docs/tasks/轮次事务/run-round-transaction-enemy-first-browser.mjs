// 轮次事务验收 P1#1/#2/#3：敌方先手不二动、回合末恰好一次、PP 只扣一次
// 手段：隔离来源 127.0.0.x:4300 + 隔离 Playwright Chromium 手机模拟视口 + 受控存档注入（基准来自自然新档 base-save.json）。
// 不使用 DEV Win。不修改实现代码。
import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const taskDir = 'D:/Games/pokeFactory2/docs/tasks/轮次事务';
const out = `${taskDir}/evidence/enemy-first`;
await mkdir(out, { recursive: true });
const baseRaw = await readFile(`${taskDir}/evidence/base-save.json`, 'utf8');

const makeMove = (name, zhName, { power = null, type = 'normal', damage_class = 'status', effectId = 'NONE', target = 'selected-pokemon' } = {}) => ({
  name, zhName, power, accuracy: power === null ? null : 100, type, damage_class, pp: 20, currentPp: 20, maxPp: 20,
  battleData: {
    effectId, priority: 0, target, flags: [], critStage: 0, drainPercent: 0, recoilPercent: 0, healingPercent: 0,
    strikeMode: 'single', minHits: 1, maxHits: 1, secondaryEffects: [], substituteInteraction: 'blocked',
    makesContact: false, soundMove: false, powderMove: false, ballisticMove: false, punchMove: false,
    bypassProtect: false, ignoreAccuracyCheck: false,
  },
});
const tackle = makeMove('tackle', '撞击', { power: 40, damage_class: 'physical' });
const scratch = makeMove('scratch', '抓', { power: 40, damage_class: 'physical' });
const pound = makeMove('pound', '拍击', { power: 40, damage_class: 'physical' });
const headbutt = makeMove('headbutt', '头锤', { power: 40, damage_class: 'physical' });

const browser = await chromium.launch({ headless: true });
const options = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const results = { task: 'enemy-first', baseOrigin: '127.0.0.60', cases: {}, errors: [] };

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
const snap = async (page, record, name) => {
  const state = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pokefactory_save_v1'));
    const b = s.factory.battleResume;
    const brief = p => p && ({ id: p.id, hp: p.currentHp, maxHp: p.maxHp, status: p.nonVolatileStatus?.id ?? null, pp: p.selectedMoves?.map(m => `${m.name}:${m.currentPp ?? m.pp}`) });
    return {
      phase: b.phase, stage: b.stage, turn: b.turn,
      weather: b.weather, weatherTurns: b.weatherTurns,
      tailwindTurns: b.tailwindTurns, fieldState: b.fieldState, fieldTurns: b.fieldTurns,
      hazards: b.hazards,
      player: b.playerTeam?.map(brief), enemy: b.enemyTeam?.map(brief),
      logLen: b.battleLog?.length ?? 0, logTail: (b.battleLog ?? []).slice(-14),
      domPlayerHp: document.querySelector('.pf-battle-player-hud .pf-factory-hp-value')?.textContent?.trim() ?? null,
      domEnemyHp: document.querySelector('.pf-battle-enemy-hud .pf-factory-hp-value')?.textContent?.trim() ?? null,
      domPp: Array.from(document.querySelectorAll('.pf-battle-move-button')).map(b => b.textContent.replace(/\s+/g, ' ').trim().slice(-30)),
      viewport: [innerWidth, innerHeight], scrollWidth: document.documentElement.scrollWidth,
    };
  });
  record.steps.push({ name, state });
  await page.screenshot({ path: `${out}/${record.name}-${name}.png` });
  return state;
};
const startTrace = page => page.evaluate(() => {
  window.__trace = [];
  window.__traceTimer = setInterval(() => {
    const q = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;
    window.__trace.push({
      t: Math.round(performance.now()),
      php: q('.pf-battle-player-hud .pf-factory-hp-value'),
      ehp: q('.pf-battle-enemy-hud .pf-factory-hp-value'),
      lines: Array.from(document.querySelectorAll('.pf-battle-message-panel p')).map(p => p.textContent.trim()),
      enabled: document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled ?? null,
    });
  }, 120);
});
const stopTrace = page => page.evaluate(() => {
  clearInterval(window.__traceTimer);
  const t = window.__trace;
  window.__trace = [];
  return t;
});

const buildFixture = (variant, raw) => {
  const save = JSON.parse(raw);
  const b = save.factory.battleResume;
  const player = b.playerTeam[0];
  const enemy = b.enemyTeam[0];
  player.selectedMoves = [tackle, makeMove('splash', '跃起', { target: 'user' })];
  player.currentHp = player.maxHp = 300;
  player.calculatedStats.hp = 300;
  player.calculatedStats.attack = 50;
  player.calculatedStats.defense = 100;
  player.calculatedStats.speed = variant === 'trickroom-enemy-first' ? 500 : 1;
  player.types = [{ slot: 1, type: { name: 'normal', url: '' } }];
  player.baseTypes = player.types;
  player.factoryOriginalHeldItemId = null;
  delete player.factoryHeldItemId;
  player.abilities = [{ ability: { name: 'run-away', url: '' } }];
  player.statStages = { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0, evasion: 0 };

  enemy.currentHp = enemy.maxHp = 300;
  enemy.calculatedStats.hp = 300;
  enemy.calculatedStats.attack = 50;
  enemy.calculatedStats.defense = 200;
  enemy.calculatedStats.speed = variant === 'trickroom-enemy-first' ? 1 : 500;
  enemy.types = [{ slot: 1, type: { name: 'normal', url: '' } }];
  enemy.baseTypes = enemy.types;
  enemy.factoryOriginalHeldItemId = null;
  delete enemy.factoryHeldItemId;
  enemy.abilities = [{ ability: { name: 'run-away', url: '' } }];
  enemy.selectedMoves = [tackle, scratch, pound, headbutt];
  b.enemyTeam.forEach(p => { p.currentHp = Math.max(1, p.currentHp); });

  b.hazards = { player: { stealthRock: false, toxicSpikesLayers: 0 }, enemy: { stealthRock: false, toxicSpikesLayers: 0 } };
  b.weather = 'none';
  b.weatherTurns = 0;
  b.tailwindTurns = { player: 0, enemy: 0 };
  b.fieldState = [];
  b.fieldTurns = {};
  b.battleLog = [];
  b.turn = 'PLAYER';
  b.battleMenuTab = 'MAIN';
  if (variant === 'enemy-first-timers') {
    b.weather = 'sandstorm';
    b.weatherTurns = 5;
    b.tailwindTurns = { player: 4, enemy: 4 };
    player.nonVolatileStatus = { id: 'poison' };
  } else {
    b.fieldState = ['trick_room'];
    b.fieldTurns = { trick_room: 5 };
    player.nonVolatileStatus = { id: 'burn' };
  }
  b.checkpointAt = new Date().toISOString();
  return { raw: JSON.stringify(save), fixture: { variant, playerSpeed: player.calculatedStats.speed, enemySpeed: enemy.calculatedStats.speed, weather: b.weather, weatherTurns: b.weatherTurns, tailwindTurns: b.tailwindTurns, fieldState: b.fieldState, fieldTurns: b.fieldTurns, playerStatus: player.nonVolatileStatus ?? null } };
};

for (const [variant, octet] of [['enemy-first-timers', 61], ['trickroom-enemy-first', 62]]) {
  const origin = `http://127.0.0.${octet}:4300`;
  const record = { name: variant, origin, steps: [], errors: [], rounds: [] };
  results.cases[variant] = record;
  const { raw, fixture } = buildFixture(variant, baseRaw);
  record.fixture = fixture;
  const context = await browser.newContext({ ...options, storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'pokefactory_save_v1', value: raw }] }] } });
  const page = await context.newPage();
  attach(page, record);
  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await waitReady(page);
    const before = await snap(page, record, 'fixture-ready-390');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);
    await snap(page, record, 'fixture-ready-844x390');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    for (let round = 1; round <= 3; round++) {
      const prev = record.steps[record.steps.length - 1].state;
      await startTrace(page);
      await page.getByRole('button', { name: '战斗', exact: true }).tap();
      await page.locator('.pf-battle-move-button').first().tap();
      await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 45000 });
      await page.waitForTimeout(700);
      const trace = await stopTrace(page);
      const after = await snap(page, record, `round${round}-390`);
      const newLog = (after.logTail ?? []).slice(0, 0);
      const logDelta = (after.logLen ?? 0) - (prev.logLen ?? 0);
      const poisonedLines = (after.logTail ?? []).filter(l => l.includes('中毒') || l.includes('poison'));
      record.rounds.push({
        round,
        logDelta,
        newLogLines: logDelta > 0 ? (await page.evaluate((n) => JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.battleLog.slice(-n), logDelta)) : [],
        before: { playerHp: prev.player?.[0]?.hp, enemyHp: prev.enemy?.[0]?.hp, playerPp: prev.player?.[0]?.pp, enemyPp: prev.enemy?.[0]?.pp, weatherTurns: prev.weatherTurns, tailwindTurns: prev.tailwindTurns, fieldTurns: prev.fieldTurns },
        after: { playerHp: after.player?.[0]?.hp, enemyHp: after.enemy?.[0]?.hp, playerPp: after.player?.[0]?.pp, enemyPp: after.enemy?.[0]?.pp, weatherTurns: after.weatherTurns, tailwindTurns: after.tailwindTurns, fieldTurns: after.fieldTurns },
        traceSummary: summarizeTrace(trace),
        trace,
      });
      record.rounds[record.rounds.length - 1].poisonOrWeatherLines = poisonedLines;
    }
  } catch (e) {
    record.failure = String(e);
    record.lastBody = await page.locator('body').innerText().catch(() => '');
    await page.screenshot({ path: `${out}/${variant}-failure.png` }).catch(() => {});
  } finally { await context.close(); }
}

function summarizeTrace(trace) {
  const seen = [];
  let last = null;
  for (const s of trace) {
    const key = `${s.ehp}|${s.lines.join(' / ')}`;
    if (key !== last) { seen.push({ t: s.t, php: s.php, ehp: s.ehp, lines: s.lines }); last = key; }
  }
  return seen;
}

await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2), 'utf8');
await browser.close();
console.log(JSON.stringify({
  cases: Object.fromEntries(Object.entries(results.cases).map(([k, r]) => [k, {
    failure: r.failure, fixture: r.fixture,
    rounds: r.rounds.map(x => ({ round: x.round, logDelta: x.logDelta, newLogLines: x.newLogLines, before: x.before, after: x.after, keys: x.traceSummary.map(s => s.lines.join(' | ')).filter(Boolean) })),
    errors: r.errors.slice(-4),
  }])),
}, null, 2));
