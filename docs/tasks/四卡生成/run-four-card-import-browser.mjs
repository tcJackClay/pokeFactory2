// 四卡生成验收 · 存档导出 / 同版导入（PRD 验收 3 的第二、三条路径）
// 手段声明：隔离来源 127.0.0.62:4300 + 隔离 Playwright Chromium 手机模拟视口 + 受控存档注入
//          + 真实 UI 触控（设置 → 导出存档 / 导入存档 的 <input type=file>）。
// 说明：START/SETTINGS 只能从「基地屏」（= StartScreen 复用）进入；本脚本先用受控注入把存档置为
//       「已绑定伙伴、无进行中挑战」，使真实 UI 可达设置屏，再走真实的导出/导入链路。
// 不修改实现代码。
import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import {
  ZH, launch, loadFixture, attach, makeContext, readState, readRewardDom, snap, waitAppBoot,
  waitRewardReady, writeRecord, ensureDirs, settleImages,
} from './four-card-harness.mjs';

const results = { commit: '0394e9d (codex/four-card-reward, worktree dirty)', cases: {}, errors: [] };
const browser = await launch();

// 由自然档派生「已绑定伙伴、无进行中挑战」的干净存档（使 BASE/StartScreen 可达 ⇒ 设置屏可达）
const baseRaw = await readFile('D:/Games/pokeFactory2/docs/tasks/四卡生成/evidence/fixtures/base-save-v14.json', 'utf8');
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

const name = 'same-version-import-export';
const record = { name, octet: 62, steps: [], errors: [], httpErrors: [] };
results.cases[name] = record;
const dir = await ensureDirs(name);
// 第一步（隔离上下文 A）：先建立一份「已冻结的四卡 READY 存档」作为导入源
let importText = '';
const frozenCards = [];
{
  const { context: ctxA } = await makeContext(browser, { octet: 62, viewport: { width: 390, height: 844 }, saveText: await loadFixture('fx-stage3-reward-pending.json') });
  const pageA = await ctxA.newPage();
  attach(pageA, record);
  await pageA.goto('http://127.0.0.62:4300', { waitUntil: 'domcontentloaded' });
  await waitAppBoot(pageA);
  await waitRewardReady(pageA);
  await settleImages(pageA);
  const frozen = await snap(pageA, record, dir, '01-frozen-ready-source');
  frozenCards.push(...(frozen.rewardCheckpoint?.cardItemIds ?? []));
  record.frozenCards = frozenCards;
  record.frozenStage = frozen.stage;
  importText = await pageA.evaluate(() => localStorage.getItem('pokefactory_save_v1'));
  await writeFile(`${dir}/import-source-ready-save.json`, importText, 'utf8');
  record.importSource = { stage: frozen.stage, status: frozen.rewardCheckpoint?.status, cards: frozenCards, bytes: importText.length };
  await ctxA.close();
}

// 第二步（隔离上下文 B）：用「无进行中挑战」的干净存档进入基地屏（= StartScreen 复用），走真实设置屏导出 / 导入
const { context } = await makeContext(browser, { octet: 62, viewport: { width: 390, height: 844 }, saveText: cleanSave });
const page = await context.newPage();
attach(page, record);

try {
  await page.goto('http://127.0.0.62:4300', { waitUntil: 'domcontentloaded' });
  await waitAppBoot(page);
  const boot = await snap(page, record, dir, '02-clean-base-screen');
  record.cleanBootScreen = { hasSettingsDock: boot.bodyTail.includes('设置'), bodyTail: boot.bodyTail.slice(-200) };

  // 进入真实设置屏（基地屏底部 dock 的「设置」）
  await page.getByRole('button', { name: '设置' }).tap();
  await page.waitForTimeout(800);
  const settings = await snap(page, record, dir, '03-settings-screen');
  record.settingsReachable = /设置/.test(settings.bodyTail) && (/导出存档/.test(settings.bodyTail) || /导入存档/.test(settings.bodyTail));

  // 真实「导出存档」：捕获下载文件
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.getByRole('button', { name: '导出存档' }).tap(),
  ]);
  const downloadPath = await download.path();
  const exportedText = await readFile(downloadPath, 'utf8');
  const exported = JSON.parse(exportedText);
  record.export = {
    filename: download.suggestedFilename(),
    bytes: exportedText.length,
    schemaVersion: exported.schemaVersion,
    companionSpeciesId: exported.progress?.companionSpeciesId,
    runId: exported.wallet?.currentRunId,
    battleResumeStatus: exported.factory?.battleResume?.status,
  };
  record.assertions = record.assertions ?? {};
  record.assertions.exportIsValidCurrentSchema = exported.schemaVersion === 14;
  record.assertions.exportMatchesLiveSave = exported.wallet?.currentRunId === null && exported.factory?.battleResume?.status === 'EMPTY';
  await snap(page, record, dir, '04-after-export');

  // 真实「导入存档」：走 <input type=file>，导入上面冻结的 READY 存档（逐字节同版本）。
  // 先把 localStorage 的每一次写入记入 trace（逐字节长度 / phase / runId），用于查明导入是否真正落盘。
  await page.evaluate(() => {
    const proto = Object.getPrototypeOf(window.localStorage);
    if (!window.__origSetItem) window.__origSetItem = proto.setItem;
    // trace 写入 sessionStorage：跨 reload 仍可读（reload 会清空 window）
    try { window.sessionStorage.setItem('__writeTrace', '[]'); } catch (e) { /* ignore */ }
    proto.setItem = function (key, value) {
      const text = String(value);
      let phase = null; let runId = null; let cp = null;
      try { const s = JSON.parse(text); phase = s.factory.battleResume.phase ?? s.factory.battleResume.status; runId = s.wallet.currentRunId; cp = s.factory.battleResume.rewardCheckpoint?.status ?? null; } catch { /* ignore */ }
      try {
        const prev = JSON.parse(window.sessionStorage.getItem('__writeTrace') || '[]');
        prev.push({ t: Date.now(), key: String(key), bytes: text.length, phase, runId, checkpoint: cp });
        window.sessionStorage.setItem('__writeTrace', JSON.stringify(prev));
      } catch (e) { /* ignore */ }
      return window.__origSetItem.call(this, key, value);
    };
  });
  await page.locator('input[type="file"]').setInputFiles({ name: 'four-card-ready-save.json', mimeType: 'application/json', buffer: Buffer.from(importText, 'utf8') });
  await page.waitForTimeout(4000);
  record.writeTrace = await page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('__writeTrace') || '[]'); } catch (e) { return []; } });
  record.reloadedAfterImport = await page.evaluate(() => (performance.getEntriesByType('navigation')[0] || {}).type ?? null);
  record.importDiagnostics = await page.evaluate(() => {
    const raw = localStorage.getItem('pokefactory_save_v1');
    let phase = null; let cp = null; const bytes = raw ? raw.length : 0; let runId = null;
    try { const s = JSON.parse(raw); phase = s.factory.battleResume.phase ?? s.factory.battleResume.status; cp = s.factory.battleResume.rewardCheckpoint ?? null; runId = s.wallet.currentRunId; } catch { /* ignore */ }
    const status = Array.from(document.querySelectorAll('[role="status"],[role="alert"]')).map((n) => n.innerText.replace(/\s+/g, ' ').trim());
    return { phase, checkpoint: cp, bytes, runId, statusTexts: status, url: location.href, body: document.body.innerText.replace(/\s+/g, ' ').slice(-300) };
  });
  await waitAppBoot(page);
  await page.waitForTimeout(2000);
  await settleImages(page);
  const imported = await snap(page, record, dir, '05-after-import');
  const cards = imported.rewardCheckpoint?.cardItemIds ?? [];
  record.importedState = { phase: imported.phase, stage: imported.stage, status: imported.rewardCheckpoint?.status, cards, player: imported.player };
  record.assertions.importReachedRewardNode = imported.phase === 'REWARD' && imported.rewardCheckpoint?.status === 'READY';
  record.assertions.cardsIdenticalAfterImport = JSON.stringify(cards) === JSON.stringify(record.frozenCards);
  record.assertions.stageUnchangedAfterImport = imported.stage === record.frozenStage;
  // 诊断结论：导入写入是否被随后的自动保存覆盖（导入后落盘序列）
  const trace = record.writeTrace;
  record.importOverwriteDiagnosis = {
    writes: trace.length,
    importedWriteIndex: trace.findIndex((w) => w.bytes > 1000000),
    writeAfterImportedSave: trace.slice(trace.findIndex((w) => w.bytes > 1000000) + 1),
  };
} catch (e) {
  record.failure = String(e);
  await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
  record.bodyTail = await page.locator('body').innerText().catch(() => '');
} finally {
  await context.close();
  await writeRecord(name, record);
  await browser.close();
}

console.log(JSON.stringify({ failure: record.failure, assertions: record.assertions, export: record.export, importSource: record.importSource, importedState: record.importedState, importDiagnostics: record.importDiagnostics, importOverwriteDiagnosis: record.importOverwriteDiagnosis, cleanBootScreen: record.cleanBootScreen, settingsReachable: record.settingsReachable, errors: record.errors.slice(-4), httpErrors: record.httpErrors.slice(-4), bodyTail: record.bodyTail?.slice(-300) }, null, 2));
