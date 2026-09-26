import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const out = 'docs/tasks/单线工厂奖励/evidence/toxic-spikes-final2';
const sourceOrigin = 'http://127.0.0.187:4300';
const testOrigin = 'http://127.0.0.188:4300';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const options = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const result = { sourceOrigin, testOrigin, fixture: {}, steps: [], errors: [] };
const attach = p => {
  p.on('pageerror', e => result.errors.push(`pageerror ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') result.errors.push(`console ${m.text()}`); });
  p.on('response', r => { if (r.status() >= 400) result.errors.push(`http ${r.status()} ${r.url()}`); });
};
const move = (name, zhName, power, type, damageClass, effectId = 'NONE', target = 'selected-pokemon') => ({
  name, zhName, power, accuracy: power === null ? null : 100, type, damage_class: damageClass, pp: 20, currentPp: 20, maxPp: 20,
  battleData: { effectId, priority: 0, target, flags: [], critStage: 0, drainPercent: 0, recoilPercent: 0, healingPercent: 0, strikeMode: 'single', minHits: 1, maxHits: 1, secondaryEffects: [], substituteInteraction: 'blocked', makesContact: false, soundMove: false, powderMove: false, ballisticMove: false, punchMove: false, bypassProtect: false, ignoreAccuracyCheck: false },
});
const toxic = move('toxic-spikes', '毒菱', null, 'poison', 'status', 'TOXIC_SPIKES', 'opponents-field');
const tackle = move('tackle', '撞击', 80, 'normal', 'physical');
const splash = move('splash', '跃起', null, 'normal', 'status', 'NONE', 'user');
const waitReady = async page => {
  for (let i = 0; i < 45; i++) {
    if (await page.locator('.pf-battle-interaction-panel[data-enabled="true"]').count()) return;
    const button = page.locator('[data-awaiting-continue="true"]');
    if (await button.count()) await button.tap();
    await page.waitForTimeout(500);
  }
  throw new Error('Battle did not become READY');
};
const snap = async (page, name) => {
  const state = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pokefactory_save_v1'));
    const b = s.factory.battleResume;
    const p = x => x && ({ id: x.id, name: x.name, hp: x.currentHp, types: x.types?.map(t => t.type.name), status: x.nonVolatileStatus?.id ?? null });
    return { phase: b.phase, stage: b.stage, hazards: b.hazards, player: b.playerTeam?.map(p), enemy: b.enemyTeam?.map(p), body: document.body.innerText.slice(-1400), viewport: [innerWidth, innerHeight], scrollWidth: document.documentElement.scrollWidth };
  });
  result.steps.push({ name, state });
  await page.screenshot({ path: `${out}/${name}.png` });
  return state;
};
let context = await browser.newContext(options);
let page = await context.newPage();
attach(page);
try {
  await page.goto(sourceOrigin, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '初遇伙伴' }).waitFor({ timeout: 60000 });
  await page.getByRole('group', { name: '选择基地伙伴' }).getByRole('button', { name: /伊布/ }).tap();
  await page.getByRole('button', { name: '确认伙伴并进入基地' }).tap();
  await page.getByRole('button', { name: '开始挑战', exact: true }).tap();
  await page.locator('.pf-battle-card').nth(5).waitFor({ timeout: 90000 });
  for (let i = 0; i < 3; i++) await page.locator('.pf-battle-card').nth(i).tap();
  await page.getByRole('button', { name: /确认选择/ }).tap();
  await waitReady(page);
  await snap(page, 'natural-ready');
  const fixture = await page.evaluate(({ toxic, tackle, splash }) => {
    const s = JSON.parse(localStorage.getItem('pokefactory_save_v1'));
    const b = s.factory.battleResume;
    const clearItem = p => { p.factoryOriginalHeldItemId = null; delete p.factoryHeldItemId; p.abilities = [{ ability: { name: 'run-away', url: '' } }]; };
    b.playerTeam.forEach(clearItem);
    b.enemyTeam.forEach(clearItem);
    b.playerTeam[0].selectedMoves = [toxic, tackle];
    b.playerTeam[0].calculatedStats.speed = 130;
    b.playerTeam[0].currentHp = b.playerTeam[0].maxHp = 300;
    b.playerTeam[1].types = [{ type: { name: 'normal' } }];
    b.playerTeam[1].baseTypes = b.playerTeam[1].types;
    b.playerTeam[2].types = [{ type: { name: 'poison' } }];
    b.playerTeam[2].baseTypes = b.playerTeam[2].types;
    b.enemyTeam[0].selectedMoves = [toxic, toxic, toxic, toxic];
    b.enemyTeam[0].types = [{ type: { name: 'normal' } }];
    b.enemyTeam[0].baseTypes = b.enemyTeam[0].types;
    b.enemyTeam.slice(1).forEach(p => { p.selectedMoves = [splash, splash, splash, splash]; });
    b.enemyTeam[0].calculatedStats.speed = 50;
    b.enemyTeam[0].currentHp = 1;
    b.enemyTeam[1].types = [{ type: { name: 'normal' } }];
    b.enemyTeam[1].baseTypes = b.enemyTeam[1].types;
    b.enemyTeam[2].types = [{ type: { name: 'poison' } }];
    b.enemyTeam[2].baseTypes = b.enemyTeam[2].types;
    b.checkpointAt = new Date().toISOString();
    return { raw: JSON.stringify(s), ids: { player: b.playerTeam.map(p => p.id), enemy: b.enemyTeam.map(p => p.id) } };
  }, { toxic, tackle, splash });
  result.fixture = fixture.ids;
  await context.close();
  context = await browser.newContext({ ...options, storageState: { cookies: [], origins: [{ origin: testOrigin, localStorage: [{ name: 'pokefactory_save_v1', value: fixture.raw }] }] } });
  page = await context.newPage();
  attach(page);
  await page.goto(testOrigin, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await snap(page, 'fixture-ready-390');
  await page.setViewportSize({ width: 844, height: 390 });
  await snap(page, 'fixture-ready-844');
  await page.setViewportSize({ width: 390, height: 844 });
  for (let layer = 1; layer <= 2; layer++) {
    await page.getByRole('button', { name: '战斗', exact: true }).tap();
    await page.locator('.pf-battle-move-button').first().tap();
    await page.waitForFunction(expected => {
      const b = JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume;
      return b.hazards.player.toxicSpikesLayers === expected && b.hazards.enemy.toxicSpikesLayers === expected;
    }, layer, { timeout: 25000 });
    await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 20000 });
    await snap(page, `both-layer${layer}-390`);
    await page.getByRole('button', { name: '变化', exact: true }).tap();
    await snap(page, `both-layer${layer}-status-390`);
    if (layer === 2) {
      await page.setViewportSize({ width: 844, height: 390 });
      await snap(page, 'both-layer2-status-844');
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.getByRole('button', { name: '战斗', exact: true }).tap();
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await snap(page, 'both-layer2-reload');
  await page.getByRole('button', { name: '战斗', exact: true }).tap();
  await page.locator('.pf-battle-move-button').nth(1).tap();
  await page.waitForTimeout(6000);
  await snap(page, 'enemy-next-poison');
  await page.getByRole('button', { name: '宝可梦', exact: true }).tap();
  await page.locator('.pf-battle-pokemon-grid button:not([disabled])').filter({ hasText: '出战' }).first().tap();
  await page.waitForFunction(id => {
    const b = JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume;
    return b.playerTeam[0].id === id && b.playerTeam[0].nonVolatileStatus?.id === 'bad_poison';
  }, result.fixture.player[1], { timeout: 25000 });
  await snap(page, 'player-next-poison');
  await page.getByRole('button', { name: '宝可梦', exact: true }).tap();
  await page.locator('.pf-battle-pokemon-grid button:not([disabled])').filter({ hasText: '出战' }).last().tap();
  await page.waitForFunction(id => {
    const b = JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume;
    return b.playerTeam[0].id === id && b.hazards.player.toxicSpikesLayers === 0;
  }, result.fixture.player[2], { timeout: 25000 });
  await snap(page, 'player-poison-absorb');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await snap(page, 'absorb-reload');
} catch (e) {
  result.failure = String(e);
  result.lastBody = await page.locator('body').innerText().catch(() => '');
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(result, null, 2), 'utf8');
  await browser.close();
}
console.log(JSON.stringify({ failure: result.failure, fixture: result.fixture, steps: result.steps.map(x => ({ name: x.name, hazards: x.state.hazards, player: x.state.player?.map(p => ({ id: p.id, status: p.status })), enemy: x.state.enemy?.map(p => ({ id: p.id, status: p.status })), tail: x.state.body.slice(-180) })), errors: result.errors.slice(-5) }, null, 2));
