// 探针：追查「导入冻结存档后落盘被覆盖」的调用方（不修改实现代码）
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { launch, attach, makeContext, waitAppBoot } from './four-card-harness.mjs';

const TASK = 'D:/Games/pokeFactory2/docs/tasks/四卡生成';
const frozen = await readFile(TASK + '/evidence/same-version-import-export/import-source-ready-save.json', 'utf8');
const baseRaw = await readFile(TASK + '/evidence/fixtures/base-save-v14.json', 'utf8');
const cleanSave = (() => {
  const s = JSON.parse(baseRaw);
  s.wallet.currentRunId = null;
  s.runSupply = { runId: null, tickets: 0, lastCreditedStage: 0 };
  s.factory.battleResume = { status: 'EMPTY' };
  s.factory.challengeStatus = 0;
  s.factory.challengePaused = false;
  s.factory.curChallengeBattleNum = 0;
  s.settings.developerMode = false;
  return JSON.stringify(s);
})();

const browser = await launch();
const rec = { errors: [], httpErrors: [] };
const { context } = await makeContext(browser, { octet: 63, viewport: { width: 390, height: 844 }, saveText: cleanSave });
const page = await context.newPage();
attach(page, rec);
await page.goto('http://127.0.0.63:4300', { waitUntil: 'domcontentloaded' });
await waitAppBoot(page);
await page.getByRole('button', { name: '设置' }).tap();
await page.waitForTimeout(800);

await page.evaluate(() => {
  const proto = Object.getPrototypeOf(window.localStorage);
  window.__origSetItem = proto.setItem;
  try { sessionStorage.setItem('__tr', '[]'); } catch (e) { /* ignore */ }
  proto.setItem = function (key, value) {
    const text = String(value);
    let phase = null; let cp = null; let runId = null;
    try {
      const s = JSON.parse(text);
      phase = s.factory.battleResume.phase ?? s.factory.battleResume.status;
      runId = s.wallet.currentRunId;
      cp = s.factory.battleResume.rewardCheckpoint?.status ?? null;
    } catch (e) { /* ignore */ }
    let stack = '';
    try { throw new Error('write-probe'); } catch (e) { stack = String(e.stack || '').split('\n').slice(2, 9).join(' | '); }
    try {
      const p = JSON.parse(sessionStorage.getItem('__tr') || '[]');
      p.push({ t: Date.now(), bytes: text.length, phase, runId, checkpoint: cp, stack });
      sessionStorage.setItem('__tr', JSON.stringify(p));
    } catch (e) { /* ignore */ }
    return window.__origSetItem.call(this, key, value);
  };
  try {
    const origReload = window.location.reload.bind(window.location);
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      value: () => {
        try {
          const p = JSON.parse(sessionStorage.getItem('__tr') || '[]');
          p.push({ t: Date.now(), mark: 'RELOAD' });
          sessionStorage.setItem('__tr', JSON.stringify(p));
        } catch (e) { /* ignore */ }
        return origReload();
      },
    });
  } catch (e) { /* ignore */ }
});

await page.locator('input[type="file"]').setInputFiles({ name: 'ready.json', mimeType: 'application/json', buffer: Buffer.from(frozen, 'utf8') });
await page.waitForTimeout(6000);

const diag = await page.evaluate(() => {
  const raw = localStorage.getItem('pokefactory_save_v1');
  let phase = null; let cp = null; let stage = null;
  try {
    const s = JSON.parse(raw);
    phase = s.factory.battleResume.phase ?? s.factory.battleResume.status;
    cp = s.factory.battleResume.rewardCheckpoint ?? null;
    stage = s.factory.battleResume.stage;
  } catch (e) { /* ignore */ }
  return {
    trace: JSON.parse(sessionStorage.getItem('__tr') || '[]'),
    phase, cp, stage, bytes: raw ? raw.length : 0,
    navType: (performance.getEntriesByType('navigation')[0] || {}).type,
    body: document.body.innerText.replace(/\s+/g, ' ').slice(-400),
    statusTexts: Array.from(document.querySelectorAll('[role="status"],[role="alert"]')).map((n) => n.innerText.replace(/\s+/g, ' ').trim()),
  };
});
console.log(JSON.stringify(diag, null, 1));
console.log('errors', JSON.stringify(rec.errors.slice(-5)), 'httpErrors', JSON.stringify(rec.httpErrors.slice(-5)));
await context.close();
await browser.close();
