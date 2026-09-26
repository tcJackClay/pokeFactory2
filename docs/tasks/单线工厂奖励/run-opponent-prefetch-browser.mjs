import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const out = 'docs/tasks/单线工厂奖励/evidence/opponent-prefetch';
const origin = 'http://127.0.0.167:4300';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const options = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
let context = await browser.newContext(options);
let page = await context.newPage();
const result = { origin, steps: [], errors: [], requests: [], injectedFailures: 0 };
const attach = p => {
  p.on('pageerror', e => result.errors.push(`pageerror ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') result.errors.push(`${m.type()} ${m.text()}`); });
  p.on('response', r => { if (r.url().includes('/api/pokeapi/')) result.requests.push({ status: r.status(), path: new URL(r.url()).pathname }); });
};
attach(page);
const snap = async name => {
  const state = await page.evaluate(() => {
    const raw = localStorage.getItem('pokefactory_save_v1');
    const s = raw ? JSON.parse(raw) : null;
    const b = s?.factory?.battleResume;
    return { schema: s?.schemaVersion, phase: b?.phase, stage: b?.stage, roundResult: b?.roundResult, runId: s?.wallet?.currentRunId, wallet: s?.wallet?.balance, tickets: s?.runSupply?.tickets, body: document.body.innerText.slice(-1300), viewport: [innerWidth, innerHeight], scrollWidth: document.documentElement.scrollWidth };
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
  await snap('six-rentals');
  for (let i = 0; i < 3; i++) await page.locator('.pf-battle-card').nth(i).tap();
  await page.getByRole('button', { name: /确认选择/ }).tap();
  for (let i = 0; i < 35; i++) {
    if (await page.locator('.pf-battle-interaction-panel[data-enabled="true"]').count()) break;
    const button = page.locator('[data-awaiting-continue="true"]');
    if (await button.count()) await button.tap();
    await page.waitForTimeout(700);
  }
  await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 30000 });
  await snap('stage1-ready');
  await page.getByRole('button', { name: 'DEV', exact: true }).tap();
  await page.getByRole('button', { name: 'Win', exact: true }).tap();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.phase === 'ROUND_RESULT', null, { timeout: 30000 });
  await snap('stage1-result-dev-win');
  const saved = await page.evaluate(() => localStorage.getItem('pokefactory_save_v1'));
  await context.close();

  context = await browser.newContext({ ...options, storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'pokefactory_save_v1', value: saved }] }] } });
  page = await context.newPage();
  attach(page);
  await page.route('**/api/pokeapi/**', route => {
    result.injectedFailures += 1;
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"injected test failure"}' });
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '前往换怪' }).waitFor({ timeout: 10000 });
  await snap('result-isolated');
  await page.getByRole('button', { name: '前往换怪' }).tap();
  await page.getByRole('button', { name: '跳过交换' }).waitFor({ timeout: 10000 });
  await snap('swap-before-failure');
  await page.getByRole('button', { name: '跳过交换' }).tap();
  await page.getByRole('alert').filter({ hasText: '对手队伍暂时无法生成' }).waitFor({ timeout: 90000 });
  await snap('failure-alert');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '跳过交换' }).waitFor({ timeout: 10000 });
  await snap('failure-reload');
  await page.unroute('**/api/pokeapi/**');
  await page.getByRole('button', { name: '跳过交换' }).tap();
  for (let i = 0; i < 35; i++) {
    if (await page.locator('.pf-battle-interaction-panel[data-enabled="true"]').count()) break;
    const button = page.locator('[data-awaiting-continue="true"]');
    if (await button.count()) await button.tap();
    await page.waitForTimeout(700);
  }
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.stage === 2, null, { timeout: 30000 });
  await snap('stage2-ready-after-retry');
} catch (error) {
  result.failure = String(error);
  result.lastBody = await page.locator('body').innerText().catch(() => '');
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(result, null, 2), 'utf8');
  await browser.close();
}
console.log(JSON.stringify({ failure: result.failure, injectedFailures: result.injectedFailures, steps: result.steps.map(x => ({ name: x.name, phase: x.state.phase, stage: x.state.stage, tickets: x.state.tickets, wallet: x.state.wallet, alert: x.state.body.includes('对手队伍暂时无法生成') })), requestCount: result.requests.length, requestErrors: result.requests.filter(x => x.status >= 400).length, errors: result.errors.slice(-8) }, null, 2));
