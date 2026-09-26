// 轮次事务验收：基准存档采集脚本（自然新档 → 第一战 READY）
// 手段：隔离来源 127.0.0.60:4300 + 隔离 Playwright Chromium（手机模拟视口）。不使用 DEV Win、不注入存档。
// 产物：<taskdir>/evidence/base-save.json（供后续用例做受控存档注入）
import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const out = 'D:/Games/pokeFactory2/docs/tasks/轮次事务/evidence';
await mkdir(out, { recursive: true });
const origin = 'http://127.0.0.60:4300';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await context.newPage();
const record = { origin, errors: [], httpErrors: [], steps: [] };
page.on('pageerror', e => record.errors.push(`pageerror ${e.message}`));
page.on('console', m => { if (m.type() === 'error') record.errors.push(`console ${m.text()}`); });
page.on('response', r => { if (r.status() >= 400) record.httpErrors.push(`${r.status()} ${r.url()}`); });
const snap = async name => {
  const state = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('pokefactory_save_v1'));
    const b = s.factory.battleResume;
    return {
      schema: s.schemaVersion,
      phase: b.phase,
      stage: b.stage,
      turn: b.turn,
      battleMenuTab: b.battleMenuTab,
      playerLead: b.playerTeam?.[0] && { id: b.playerTeam[0].id, name: b.playerTeam[0].name, hp: b.playerTeam[0].currentHp, maxHp: b.playerTeam[0].maxHp },
      enemyLead: b.enemyTeam?.[0] && { id: b.enemyTeam[0].id, name: b.enemyTeam[0].name, hp: b.enemyTeam[0].currentHp, maxHp: b.enemyTeam[0].maxHp },
      body: document.body.innerText.slice(-600),
      viewport: [innerWidth, innerHeight],
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  record.steps.push({ name, state });
  await page.screenshot({ path: `${out}/fixture-${name}.png` });
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
  for (let i = 0; i < 45; i++) {
    if (await page.locator('.pf-battle-interaction-panel[data-enabled="true"]').count()) break;
    const b = page.locator('[data-awaiting-continue="true"]');
    if (await b.count()) await b.tap();
    await page.waitForTimeout(500);
  }
  await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 30000 });
  await snap('390x844');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  await snap('844x390');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(300);
  await snap('320x568');
  await page.setViewportSize({ width: 390, height: 844 });
  const raw = await page.evaluate(() => localStorage.getItem('pokefactory_save_v1'));
  await writeFile(`${out}/base-save.json`, raw, 'utf8');
  record.baseSaveBytes = raw.length;
  const parsed = JSON.parse(raw);
  record.fixture = {
    playerIds: parsed.factory.battleResume.playerTeam.map(p => p.id),
    enemyIds: parsed.factory.battleResume.enemyTeam.map(p => p.id),
    stage: parsed.factory.battleResume.stage,
  };
} catch (e) {
  record.failure = String(e);
  await page.screenshot({ path: `${out}/fixture-failure.png` }).catch(() => {});
} finally {
  await writeFile(`${out}/fixture-results.json`, JSON.stringify(record, null, 2), 'utf8');
  await context.close();
  await browser.close();
}
console.log(JSON.stringify({ failure: record.failure, fixture: record.fixture, bytes: record.baseSaveBytes, errors: record.errors.slice(-5), http: record.httpErrors.slice(-5) }, null, 2));
