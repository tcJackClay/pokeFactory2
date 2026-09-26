import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const out = 'docs/tasks/战后恢复/evidence/white-herb-fixed';
const origin = 'http://127.0.0.165:4300';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const options = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
let context = await browser.newContext(options);
let page = await context.newPage();
const result = { origin, commit: '', fixture: {}, steps: [], errors: [] };
const attach = p => {
  p.on('pageerror', e => result.errors.push(`pageerror ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') result.errors.push(`console ${m.text()}`); });
  p.on('response', r => { if (r.status() >= 400) result.errors.push(`http ${r.status()} ${r.url()}`); });
};
attach(page);
const snap = async name => {
  const state = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pokefactory_save_v1'));
    const b = s.factory.battleResume;
    const brief = p => p && ({ id: p.id, name: p.name, hp: p.currentHp, held: p.factoryHeldItemId ?? null, original: p.factoryOriginalHeldItemId ?? null, stages: p.statStages, moves: p.selectedMoves?.map(m => ({ name: m.name, currentPp: m.currentPp })) });
    return { schema: s.schemaVersion, phase: b.phase, stage: b.stage, player: b.playerTeam?.map(brief), enemy: b.enemyTeam?.map(brief), body: document.body.innerText.slice(-1100), viewport: [innerWidth, innerHeight], panel: document.querySelector('.pf-battle-interaction-panel')?.getAttribute('data-enabled') };
  });
  result.steps.push({ name, state });
  await page.screenshot({ path: `${out}/${name}.png` });
  return state;
};
try {
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '初遇伙伴' }).waitFor({ timeout: 60000 });
  await page.getByRole('group', { name: '选择基地伙伴' }).getByRole('button', { name: /伊布/ }).tap();
  await page.getByRole('button', { name: '确认伙伴并进入基地' }).tap();
  await page.getByRole('button', { name: '设置' }).tap();
  await page.getByRole('button', { name: '开启' }).tap();
  await page.getByRole('button', { name: '返回' }).tap();
  await page.getByRole('button', { name: '开始挑战', exact: true }).tap();
  await page.locator('.pf-battle-card').nth(5).waitFor({ timeout: 90000 });
  for (let i = 0; i < 3; i++) await page.locator('.pf-battle-card').nth(i).tap();
  await page.getByRole('button', { name: /确认选择/ }).tap();
  for (let i = 0; i < 35; i++) {
    if (await page.locator('.pf-battle-interaction-panel[data-enabled="true"]').count()) break;
    const button = page.locator('[data-awaiting-continue="true"]');
    if (await button.count()) await button.tap();
    await page.waitForTimeout(700);
  }
  await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 30000 });
  await snap('natural-ready');
  const fixtureData = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pokefactory_save_v1'));
    const b = s.factory.battleResume;
    const candidates = [...b.factoryRentals, ...b.playerTeam, ...b.enemyTeam].flatMap(p => p.selectedMoves.map(m => ({ pokemon: p.name, move: m })));
    const selfLowering = candidates.filter(({ move }) => move.battleData?.secondaryEffects?.some(e => e.kind === 'stat-stage' && e.appliesTo === 'user' && e.change < 0));
    const preferred = selfLowering.find(x => x.move.accuracy === null || x.move.accuracy === 100) ?? selfLowering[0];
    const move = preferred?.move ?? {
      name: 'overheat', zhName: '过热', power: 130, accuracy: 100, type: 'fire', damage_class: 'special', pp: 5, currentPp: 5, maxPp: 5,
      battleData: { effectId: 'NONE', priority: 0, target: 'selected-pokemon', flags: [], critStage: 0, drainPercent: 0, recoilPercent: 0, healingPercent: 0, strikeMode: 'single', minHits: 1, maxHits: 1, secondaryEffects: [{ kind: 'stat-stage', chance: 100, appliesTo: 'user', isPrimary: true, stat: 'spAtk', change: -2 }], substituteInteraction: 'blocked', makesContact: false, soundMove: false, powderMove: false, ballisticMove: false, punchMove: false, bypassProtect: false, ignoreAccuracyCheck: false }
    };
    const p = b.playerTeam[0];
    p.factoryOriginalHeldItemId = 'white_herb';
    p.factoryHeldItemId = 'white_herb';
    p.selectedMoves[0] = move;
    b.enemyTeam[0].nonVolatileStatus = { id: 'sleep', turnsRemaining: 10 };
    b.enemyTeam[0].currentHp = b.enemyTeam[0].maxHp;
    b.checkpointAt = new Date().toISOString();
    return { raw: JSON.stringify(s), fixture: { source: preferred ? `generated ${preferred.pokemon}` : 'manual move metadata', move: move.name, effect: move.battleData?.secondaryEffects, lead: p.name, enemySleep: true, originalHeld: p.factoryOriginalHeldItemId } };
  });
  result.fixture = fixtureData.fixture;
  await context.close();
  context = await browser.newContext({ ...options, storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'pokefactory_save_v1', value: fixtureData.raw }] }] } });
  page = await context.newPage();
  attach(page);
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 30000 });
  await snap('fixture-ready');
  await page.getByRole('button', { name: '战斗', exact: true }).tap();
  await page.locator('.pf-battle-move-button').first().tap();
  await page.waitForTimeout(5000);
  await snap('after-real-move');
  await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 20000 });
  await snap('stable-after-real-move');
  await page.getByRole('button', { name: 'DEV', exact: true }).tap();
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.waitForTimeout(3500);
    await page.getByRole('button', { name: 'Win', exact: true }).tap();
    await page.waitForTimeout(2500);
    if (await page.evaluate(() => JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.phase === 'ROUND_RESULT')) break;
  }
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.phase === 'ROUND_RESULT', null, { timeout: 15000 });
  await snap('result-dev-win');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '前往换怪' }).waitFor({ timeout: 10000 });
  await snap('result-reload');
  await page.getByRole('button', { name: '前往换怪' }).tap();
  await snap('swap');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '跳过交换' }).waitFor({ timeout: 10000 });
  await snap('swap-reload');
  await page.getByRole('button', { name: '跳过交换' }).tap();
  for (let i = 0; i < 35; i++) {
    if (await page.locator('.pf-battle-interaction-panel[data-enabled="true"]').count()) break;
    const button = page.locator('[data-awaiting-continue="true"]');
    if (await button.count()) await button.tap();
    await page.waitForTimeout(700);
  }
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.stage === 2, null, { timeout: 30000 });
  await snap('stage2-ready');
} catch (error) {
  result.failure = String(error);
  result.lastBody = await page.locator('body').innerText().catch(() => '');
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(result, null, 2), 'utf8');
  await browser.close();
}
console.log(JSON.stringify({ failure: result.failure, fixture: result.fixture, steps: result.steps.map(x => ({ name: x.name, phase: x.state.phase, stage: x.state.stage, held: x.state.player?.[0]?.held, original: x.state.player?.[0]?.original, tail: x.state.body.slice(-220) })), errors: result.errors }, null, 2));
