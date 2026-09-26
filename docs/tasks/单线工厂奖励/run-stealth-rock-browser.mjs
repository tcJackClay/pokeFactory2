import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const out = 'docs/tasks/单线工厂奖励/evidence/stealth-rock';
const origin = 'http://127.0.0.166:4300';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const options = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
let context = await browser.newContext(options);
let page = await context.newPage();
const result = { origin, steps: [], errors: [] };
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
    return { phase: b.phase, stage: b.stage, hazards: b.hazards, player: b.playerTeam?.map(p => ({ id: p.id, name: p.name, hp: p.currentHp, maxHp: p.maxHp })), body: document.body.innerText.slice(-1300), width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth };
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
  const fixture = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pokefactory_save_v1'));
    const b = s.factory.battleResume;
    b.hazards.player.stealthRock = true;
    b.playerTeam[1].currentHp = 1;
    b.playerTeam[2].currentHp = 1;
    b.enemyTeam[0].nonVolatileStatus = { id: 'sleep', turnsRemaining: 10 };
    b.checkpointAt = new Date().toISOString();
    return JSON.stringify(s);
  });
  await context.close();
  context = await browser.newContext({ ...options, storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'pokefactory_save_v1', value: fixture }] }] } });
  page = await context.newPage();
  attach(page);
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 30000 });
  await snap('fixture-ready-390');
  await page.setViewportSize({ width: 320, height: 568 });
  await snap('fixture-ready-320');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '宝可梦', exact: true }).tap();
  await snap('switch-list');
  result.switchButtons = await page.locator('.pf-battle-pokemon-grid button').allInnerTexts();
  await page.locator('.pf-battle-pokemon-grid button:not([disabled])').filter({ hasText: '出战' }).first().tap();
  await page.waitForTimeout(4200);
  await snap('first-hazard-faint-390');
  await page.setViewportSize({ width: 320, height: 568 });
  await snap('first-hazard-faint-320');
  await page.setViewportSize({ width: 390, height: 844 });
  const forced = page.locator('.pf-battle-pokemon-grid button:not([disabled])').filter({ hasText: '出战' });
  if (await forced.count()) {
    await forced.last().tap();
    await page.waitForTimeout(4200);
    await snap('second-hazard-faint-390');
    const finalSwitch = page.locator('.pf-battle-pokemon-grid button:not([disabled])').filter({ hasText: '出战' });
    if (await finalSwitch.count()) {
      await finalSwitch.first().tap();
      await page.waitForTimeout(4200);
      await snap('third-switch-390');
    }
  }
} catch (e) {
  result.failure = String(e);
  result.lastBody = await page.locator('body').innerText().catch(() => '');
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(result, null, 2), 'utf8');
  await browser.close();
}
console.log(JSON.stringify({ failure: result.failure, switchButtons: result.switchButtons, steps: result.steps.map(x => ({ name: x.name, player: x.state.player, hazards: x.state.hazards, tail: x.state.body.slice(-400) })), errors: result.errors }, null, 2));
