// 轮次事务验收 P1#4：早退分支（未命中 / 守住 / 免疫）——该侧记为已行动或跳过、剩余行动照常、无空轮无重演
// 手段：隔离来源 127.0.0.x:4300 + 隔离 Playwright Chromium 手机模拟视口 + 受控存档注入（基准来自自然新档 base-save.json）。
// 不使用 DEV Win。不修改实现代码。
import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const taskDir = 'D:/Games/pokeFactory2/docs/tasks/轮次事务';
const out = `${taskDir}/evidence/early-exit`;
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

const browser = await chromium.launch({ headless: true });
const options = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const results = { task: 'early-exit', cases: {}, errors: [] };

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
      phase: b.phase, turn: b.turn, logLen: b.battleLog?.length ?? 0,
      player: b.playerTeam?.map(brief), enemy: b.enemyTeam?.map(brief),
      domPlayerHp: document.querySelector('.pf-battle-player-hud .pf-factory-hp-value')?.textContent?.trim() ?? null,
      viewport: [innerWidth, innerHeight], scrollWidth: document.documentElement.scrollWidth,
    };
  });
  record.steps.push({ name, state });
  await page.screenshot({ path: `${out}/${record.name}-${name}.png` });
  return state;
};
const readLog = (page, n) => page.evaluate((count) => JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.battleLog.slice(-count), n);

const buildFixture = (variant, raw) => {
  const save = JSON.parse(raw);
  const b = save.factory.battleResume;
  const player = b.playerTeam[0];
  const enemy = b.enemyTeam[0];
  const missMove = makeMove('tackle', '撞击', { power: 40, accuracy: 0, damage_class: 'physical' });
  const tackle = makeMove('tackle', '撞击', { power: 40, accuracy: 100, damage_class: 'physical' });
  const protect = makeMove('protect', '守住', { effectId: 'PROTECT', target: 'user' });

  const setup = (mon) => {
    mon.currentHp = mon.maxHp = 300;
    mon.calculatedStats.hp = 300;
    mon.calculatedStats.attack = 50;
    mon.calculatedStats.defense = 100;
    mon.baseTypes = mon.types;
    mon.factoryOriginalHeldItemId = null;
    delete mon.factoryHeldItemId;
    mon.abilities = [{ ability: { name: 'run-away', url: '' } }];
    mon.statStages = { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0, evasion: 0 };
  };
  setup(player);
  setup(enemy);
  b.hazards = { player: { stealthRock: false, toxicSpikesLayers: 0 }, enemy: { stealthRock: false, toxicSpikesLayers: 0 } };
  b.weather = 'none'; b.weatherTurns = 0; b.tailwindTurns = { player: 0, enemy: 0 };
  b.fieldState = []; b.fieldTurns = {}; b.battleLog = []; b.turn = 'PLAYER'; b.battleMenuTab = 'MAIN';

  if (variant === 'enemy-miss') {
    // 敌方先手（更快）且唯一招式命中率 0 → 必定未命中；我方随后照常出招
    player.calculatedStats.speed = 1;
    enemy.calculatedStats.speed = 500;
    player.types = [{ slot: 1, type: { name: 'normal', url: '' } }];
    enemy.types = [{ slot: 1, type: { name: 'normal', url: '' } }];
    player.selectedMoves = [tackle];
    enemy.selectedMoves = [missMove];
  } else if (variant === 'player-immune') {
    // 我方先手（更快）用一般属性招式打幽灵系 → 免疫；敌方随后照常出招
    player.calculatedStats.speed = 500;
    enemy.calculatedStats.speed = 1;
    player.types = [{ slot: 1, type: { name: 'normal', url: '' } }];
    enemy.types = [{ slot: 1, type: { name: 'ghost', url: '' } }];
    player.selectedMoves = [tackle];
    enemy.selectedMoves = [tackle];
  } else if (variant === 'enemy-protect') {
    // 敌方先手（更快）守住 → 该侧行动早退；我方随后照常出招但被挡下
    player.calculatedStats.speed = 1;
    enemy.calculatedStats.speed = 500;
    player.types = [{ slot: 1, type: { name: 'normal', url: '' } }];
    enemy.types = [{ slot: 1, type: { name: 'normal', url: '' } }];
    player.selectedMoves = [tackle];
    enemy.selectedMoves = [protect];
  }
  player.baseTypes = player.types;
  enemy.baseTypes = enemy.types;
  b.checkpointAt = new Date().toISOString();
  return { raw: JSON.stringify(save), fixture: { variant, playerSpeed: player.calculatedStats.speed, enemySpeed: enemy.calculatedStats.speed, playerMove: player.selectedMoves.map(m => m.name), enemyMove: enemy.selectedMoves.map(m => m.name), playerTypes: player.types.map(t => t.type.name), enemyTypes: enemy.types.map(t => t.type.name) } };
};

for (const [variant, octet] of [['enemy-miss', 63], ['player-immune', 64], ['enemy-protect', 65]]) {
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
    await snap(page, record, 'fixture-ready-390');
    for (let round = 1; round <= 2; round++) {
      const prev = record.steps[record.steps.length - 1].state;
      await page.getByRole('button', { name: '战斗', exact: true }).tap();
      await page.locator('.pf-battle-move-button').first().tap();
      await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 45000 });
      await page.waitForTimeout(700);
      const after = await snap(page, record, `round${round}-390`);
      const logDelta = (after.logLen ?? 0) - (prev.logLen ?? 0);
      const newLogLines = logDelta > 0 ? await readLog(page, logDelta) : [];
      record.rounds.push({
        round, logDelta, newLogLines,
        before: { playerHp: prev.player?.[0]?.hp, enemyHp: prev.enemy?.[0]?.hp, playerPp: prev.player?.[0]?.pp, enemyPp: prev.enemy?.[0]?.pp },
        after: { playerHp: after.player?.[0]?.hp, enemyHp: after.enemy?.[0]?.hp, playerPp: after.player?.[0]?.pp, enemyPp: after.enemy?.[0]?.pp },
      });
    }
  } catch (e) {
    record.failure = String(e);
    record.lastBody = await page.locator('body').innerText().catch(() => '');
    await page.screenshot({ path: `${out}/${variant}-failure.png` }).catch(() => {});
  } finally { await context.close(); }
}

await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2), 'utf8');
await browser.close();
console.log(JSON.stringify(Object.fromEntries(Object.entries(results.cases).map(([k, r]) => [k, { failure: r.failure, fixture: r.fixture, rounds: r.rounds, errors: r.errors.slice(-4) }])), null, 2));
