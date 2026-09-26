import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const out = 'docs/tasks/单线工厂奖励/evidence/toxic-spikes-boundaries';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const options = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const result = { sourceOrigin: 'http://127.0.0.195:4300', cases: {}, errors: [] };
const makeMove = (name, zhName, effectId, target) => ({ name, zhName, power: null, accuracy: null, type: name === 'toxic-spikes' ? 'poison' : 'normal', damage_class: 'status', pp: 20, currentPp: 20, maxPp: 20, battleData: { effectId, priority: 0, target, flags: [], critStage: 0, drainPercent: 0, recoilPercent: 0, healingPercent: 0, strikeMode: 'single', minHits: 1, maxHits: 1, secondaryEffects: [], substituteInteraction: 'blocked', makesContact: false, soundMove: false, powderMove: false, ballisticMove: false, punchMove: false, bypassProtect: false, ignoreAccuracyCheck: false } });
const toxic = makeMove('toxic-spikes', '毒菱', 'TOXIC_SPIKES', 'opponents-field');
const splash = makeMove('splash', '跃起', 'NONE', 'user');
const attach = (page, record) => {
  page.on('pageerror', e => record.errors.push(`pageerror ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') record.errors.push(`console ${m.text()}`); });
  page.on('response', r => { if (r.status() >= 400) record.errors.push(`http ${r.status()} ${r.url()}`); });
};
const waitReady = async page => {
  for (let i = 0; i < 45; i++) {
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
    return { schema: s.schemaVersion, stage: b.stage, phase: b.phase, hazards: b.hazards, player: b.playerTeam?.map(p => ({ id: p.id, hp: p.currentHp, types: p.types.map(t => t.type.name), status: p.nonVolatileStatus?.id ?? null, firstPp: p.selectedMoves?.[0]?.currentPp })), body: document.body.innerText.slice(-1000), width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  record.steps.push({ name, state });
  await page.screenshot({ path: `${out}/${record.name}-${name}.png` });
  return state;
};
let sourceContext = await browser.newContext(options);
let sourcePage = await sourceContext.newPage();
const source = { name: 'source', errors: [], steps: [] };
attach(sourcePage, source);
try {
  await sourcePage.goto(result.sourceOrigin, { waitUntil: 'domcontentloaded' });
  await sourcePage.getByRole('heading', { name: '初遇伙伴' }).waitFor({ timeout: 60000 });
  await sourcePage.getByRole('group', { name: '选择基地伙伴' }).getByRole('button', { name: /伊布/ }).tap();
  await sourcePage.getByRole('button', { name: '确认伙伴并进入基地' }).tap();
  await sourcePage.getByRole('button', { name: '开始挑战', exact: true }).tap();
  await sourcePage.locator('.pf-battle-card').nth(5).waitFor({ timeout: 90000 });
  for (let i = 0; i < 3; i++) await sourcePage.locator('.pf-battle-card').nth(i).tap();
  await sourcePage.getByRole('button', { name: /确认选择/ }).tap();
  await waitReady(sourcePage);
  await snap(sourcePage, source, 'normal-ready');
  const baseSave = await sourcePage.evaluate(() => localStorage.getItem('pokefactory_save_v1'));
  result.source = source;
  await sourceContext.close();

  for (const [name, octet] of [['one-layer', 196], ['third-use-flying', 197]]) {
    const record = { name, origin: `http://127.0.0.${octet}:4300`, steps: [], errors: [] };
    result.cases[name] = record;
    const save = JSON.parse(baseSave);
    const b = save.factory.battleResume;
    b.playerTeam[0].selectedMoves = [toxic, splash];
    b.playerTeam[0].currentHp = b.playerTeam[0].maxHp = 300;
    b.playerTeam[0].factoryOriginalHeldItemId = null;
    delete b.playerTeam[0].factoryHeldItemId;
    b.playerTeam[0].abilities = [{ ability: { name: 'run-away', url: '' } }];
    b.playerTeam[1].types = [{ type: { name: 'normal' } }];
    b.playerTeam[1].baseTypes = b.playerTeam[1].types;
    b.playerTeam[1].factoryOriginalHeldItemId = null;
    delete b.playerTeam[1].factoryHeldItemId;
    b.playerTeam[1].abilities = [{ ability: { name: 'run-away', url: '' } }];
    b.playerTeam[2].types = [{ type: { name: 'flying' } }];
    b.playerTeam[2].baseTypes = b.playerTeam[2].types;
    b.playerTeam[2].factoryOriginalHeldItemId = null;
    delete b.playerTeam[2].factoryHeldItemId;
    b.playerTeam[2].abilities = [{ ability: { name: 'run-away', url: '' } }];
    b.enemyTeam.forEach(p => { p.selectedMoves = [splash, splash, splash, splash]; p.factoryOriginalHeldItemId = null; delete p.factoryHeldItemId; p.abilities = [{ ability: { name: 'run-away', url: '' } }]; });
    if (name === 'one-layer') b.enemyTeam[0].selectedMoves = [{ ...toxic, pp: 1, currentPp: 1, maxPp: 1 }];
    b.checkpointAt = new Date().toISOString();
    record.fixture = { playerIds: b.playerTeam.map(p => p.id), enemyIds: b.enemyTeam.map(p => p.id), injected: 'toxic-spikes, splash, normal and flying type, no items/abilities' };
    const context = await browser.newContext({ ...options, storageState: { cookies: [], origins: [{ origin: record.origin, localStorage: [{ name: 'pokefactory_save_v1', value: JSON.stringify(save) }] }] } });
    const page = await context.newPage();
    attach(page, record);
    try {
      await page.goto(record.origin, { waitUntil: 'domcontentloaded' });
      await waitReady(page);
      await snap(page, record, 'fixture-ready');
      const uses = name === 'one-layer' ? 1 : 3;
      for (let use = 1; use <= uses; use++) {
        await page.getByRole('button', { name: '战斗', exact: true }).tap();
        await page.locator('.pf-battle-move-button').first().tap();
        if (use === 3) {
          await page.getByText('但是失败了！').waitFor({ timeout: 15000 });
          await snap(page, record, 'third-use-failed-visible');
        }
        await page.waitForFunction(expected => {
          const b = JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume;
          return b.hazards.enemy.toxicSpikesLayers === Math.min(expected, 2) && b.playerTeam[0].selectedMoves[0].currentPp === 20 - expected;
        }, use, { timeout: 25000 });
        await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 20000 });
        await snap(page, record, `after-use${use}`);
      }
      await page.getByRole('button', { name: '宝可梦', exact: true }).tap();
      const switches = page.locator('.pf-battle-pokemon-grid button:not([disabled])').filter({ hasText: '出战' });
      await (name === 'one-layer' ? switches.first() : switches.last()).tap();
      const expectedId = record.fixture.playerIds[name === 'one-layer' ? 1 : 2];
      await page.waitForFunction(id => JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.playerTeam[0].id === id, expectedId, { timeout: 25000 });
      await snap(page, record, 'after-switch');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitReady(page);
      await snap(page, record, 'after-switch-reload');
    } catch (e) {
      record.failure = String(e);
      record.lastBody = await page.locator('body').innerText().catch(() => '');
      await page.screenshot({ path: `${out}/${name}-failure.png` }).catch(() => {});
    } finally { await context.close(); }
  }
} catch (e) {
  result.failure = String(e);
  await sourcePage.screenshot({ path: `${out}/source-failure.png` }).catch(() => {});
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(result, null, 2), 'utf8');
  await browser.close();
}
console.log(JSON.stringify({ failure: result.failure, cases: Object.fromEntries(Object.entries(result.cases).map(([name, r]) => [name, { failure: r.failure, steps: r.steps.map(x => ({ name: x.name, layer: x.state.hazards.enemy.toxicSpikesLayers, lead: x.state.player?.[0] })), errors: r.errors }])) }, null, 2));
