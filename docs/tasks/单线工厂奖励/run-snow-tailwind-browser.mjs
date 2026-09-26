import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const out = 'docs/tasks/单线工厂奖励/evidence/snow-tailwind-four-turns';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const options = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const results = { source: {}, cases: {}, errors: [] };
const makeMove = (name, zhName, power, type, damageClass, { effectId = 'NONE', weather, target = 'selected-pokemon' } = {}) => ({
  name, zhName, power, accuracy: power === null ? null : 100, type, damage_class: damageClass, pp: 20, currentPp: 20, maxPp: 20,
  battleData: { effectId, priority: 0, target, flags: [], critStage: 0, drainPercent: 0, recoilPercent: 0, healingPercent: 0, strikeMode: 'single', minHits: 1, maxHits: 1, secondaryEffects: [], substituteInteraction: 'blocked', makesContact: false, soundMove: false, powderMove: false, ballisticMove: false, punchMove: false, bypassProtect: false, ignoreAccuracyCheck: false, ...(weather ? { weather } : {}) },
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const attach = (page, record) => {
  page.on('pageerror', e => record.errors.push(`pageerror ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') record.errors.push(`console ${m.text()}`); });
  page.on('response', r => { if (r.status() >= 400) record.errors.push(`http ${r.status()} ${r.url()}`); });
};
const waitReady = async page => {
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.pf-battle-interaction-panel[data-enabled="true"]').count()) return;
    const button = page.locator('[data-awaiting-continue="true"]');
    if (await button.count()) await button.tap();
    await page.waitForTimeout(500);
  }
  throw new Error('Battle did not become READY');
};
const snap = async (page, record, name) => {
  const state = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pokefactory_save_v1'));
    const b = s.factory.battleResume;
    return { phase: b.phase, stage: b.stage, weather: b.weather, weatherTurns: b.weatherTurns, tailwindTurns: b.tailwindTurns, player: b.playerTeam?.slice(0, 1).map(p => ({ id: p.id, hp: p.currentHp, maxHp: p.maxHp, types: p.types, speed: p.calculatedStats?.speed, defense: p.calculatedStats?.defense, moves: p.selectedMoves?.map(m => ({ name: m.name, pp: m.currentPp })) })), enemy: b.enemyTeam?.slice(0, 1).map(p => ({ id: p.id, hp: p.currentHp, maxHp: p.maxHp, speed: p.calculatedStats?.speed, attack: p.calculatedStats?.attack })), body: document.body.innerText.slice(-1400), viewport: [innerWidth, innerHeight], scrollWidth: document.documentElement.scrollWidth };
  });
  record.steps.push({ name, state });
  await page.screenshot({ path: `${out}/${record.name}-${name}.png` });
  return state;
};
let sourceContext = await browser.newContext(options);
let sourcePage = await sourceContext.newPage();
attach(sourcePage, results.source);
results.source.errors = [];
try {
  await sourcePage.goto('http://127.0.0.176:4300/', { waitUntil: 'domcontentloaded' });
  await sourcePage.getByRole('heading', { name: '初遇伙伴' }).waitFor({ timeout: 60000 });
  await sourcePage.getByRole('group', { name: '选择基地伙伴' }).getByRole('button', { name: /伊布/ }).tap();
  await sourcePage.getByRole('button', { name: '确认伙伴并进入基地' }).tap();
  await sourcePage.getByRole('button', { name: '开始挑战', exact: true }).tap();
  await sourcePage.locator('.pf-battle-card').nth(5).waitFor({ timeout: 90000 });
  for (let i = 0; i < 3; i++) await sourcePage.locator('.pf-battle-card').nth(i).tap();
  await sourcePage.getByRole('button', { name: /确认选择/ }).tap();
  await waitReady(sourcePage);
  results.source.ready = await sourcePage.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pokefactory_save_v1'));
    return { schema: s.schemaVersion, stage: s.factory.battleResume.stage, phase: s.factory.battleResume.phase, player: s.factory.battleResume.playerTeam[0].name, enemy: s.factory.battleResume.enemyTeam[0].name };
  });
  await sourcePage.screenshot({ path: `${out}/normal-ready.png` });
  const sourceSave = await sourcePage.evaluate(() => localStorage.getItem('pokefactory_save_v1'));
  await sourceContext.close();

  for (const [name, octet] of [['tailwind', 179]]) {
    const record = { name, origin: `http://127.0.0.${octet}:4300`, steps: [], errors: [] };
    results.cases[name] = record;
    const save = JSON.parse(sourceSave);
    const b = save.factory.battleResume;
    const player = b.playerTeam[0];
    const enemy = b.enemyTeam[0];
    player.types = [{ type: { name: 'ice' } }];
    player.baseTypes = player.types;
    player.currentHp = player.maxHp = 300;
    player.calculatedStats.defense = 100;
    player.calculatedStats.speed = name === 'tailwind' ? 70 : 150;
    player.factoryOriginalHeldItemId = null;
    delete player.factoryHeldItemId;
    player.abilities = [{ ability: { name: 'run-away', url: '' } }];
    player.selectedMoves = [
      name === 'snow' ? makeMove('snowscape', '雪景', null, 'ice', 'status', { weather: 'snow', target: 'entire-field' })
        : name === 'tailwind' ? makeMove('tailwind', '顺风', null, 'flying', 'status', { effectId: 'TAILWIND', target: 'user' })
          : makeMove('splash', '跃起', null, 'normal', 'status', { target: 'user' }),
      makeMove('tackle', '撞击', 5, 'normal', 'physical'),
    ];
    enemy.currentHp = enemy.maxHp = 300;
    enemy.calculatedStats.attack = 100;
    enemy.calculatedStats.speed = 100;
    enemy.factoryOriginalHeldItemId = null;
    delete enemy.factoryHeldItemId;
    enemy.abilities = [{ ability: { name: 'run-away', url: '' } }];
    enemy.selectedMoves = Array.from({ length: 4 }, () => makeMove('tackle', '撞击', 20, 'normal', 'physical'));
    b.weather = 'none';
    b.weatherTurns = 0;
    b.tailwindTurns = { player: 0, enemy: 0 };
    b.checkpointAt = new Date().toISOString();
    const context = await browser.newContext({ ...options, storageState: { cookies: [], origins: [{ origin: record.origin, localStorage: [{ name: 'pokefactory_save_v1', value: JSON.stringify(save) }] }] } });
    const page = await context.newPage();
    attach(page, record);
    try {
      await page.goto(record.origin, { waitUntil: 'domcontentloaded' });
      await waitReady(page);
      await snap(page, record, 'fixture-ready-390');
      await page.setViewportSize({ width: 320, height: 568 });
      await snap(page, record, 'fixture-ready-320');
      await page.setViewportSize({ width: 390, height: 844 });
      const rounds = name === 'tailwind' ? 4 : 1;
      for (let turn = 1; turn <= rounds; turn++) {
        await page.getByRole('button', { name: '战斗', exact: true }).tap();
        await page.locator('.pf-battle-move-button').nth(turn === 1 ? 0 : 1).tap();
        await page.waitForFunction(expected => JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.tailwindTurns?.player === expected, 4 - turn, { timeout: 20000 });
        await page.waitForTimeout(500);
        await snap(page, record, `turn${turn}-390`);
        if (turn === 1) {
          await page.getByRole('button', { name: '变化', exact: true }).tap();
          await snap(page, record, 'status-390');
          await page.setViewportSize({ width: 320, height: 568 });
          await snap(page, record, 'status-320');
          await page.setViewportSize({ width: 390, height: 844 });
          await page.getByRole('button', { name: '战斗', exact: true }).tap();
        }
        await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 20000 });
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitReady(page);
      await snap(page, record, 'reload-checkpoint');
    } catch (error) {
      record.failure = String(error);
      record.lastBody = await page.locator('body').innerText().catch(() => '');
      await page.screenshot({ path: `${out}/${name}-failure.png` }).catch(() => {});
    } finally { await context.close(); }
  }
} catch (error) {
  results.failure = String(error);
  await sourcePage.screenshot({ path: `${out}/source-failure.png` }).catch(() => {});
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2), 'utf8');
  await browser.close();
}
console.log(JSON.stringify({ failure: results.failure, source: results.source.ready, cases: Object.fromEntries(Object.entries(results.cases).map(([name, r]) => [name, { failure: r.failure, steps: r.steps.map(x => ({ name: x.name, weather: x.state.weather, weatherTurns: x.state.weatherTurns, tailwindTurns: x.state.tailwindTurns, hp: x.state.player?.[0]?.hp, tail: x.state.body.slice(-200) })), errors: r.errors.slice(-3) }])) }, null, 2));
