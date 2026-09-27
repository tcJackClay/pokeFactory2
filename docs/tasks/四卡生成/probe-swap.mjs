import { launch, loadFixture, attach, makeContext, waitAppBoot, waitPhase } from './four-card-harness.mjs';
const browser = await launch();
const base = JSON.parse(await loadFixture('fx-stage1-swap-conflict.json'));
const s = JSON.parse(JSON.stringify(base)); const b = s.factory.battleResume;
b.stage = 1; b.streak = 0; b.rewardCheckpoint = undefined;
s.runSupply = { runId: s.wallet.currentRunId, tickets: 1, lastCreditedStage: 1 };
s.factory.curChallengeBattleNum = 0;
const { context } = await makeContext(browser, { octet: 61, viewport: { width: 390, height: 844 }, saveText: JSON.stringify(s) });
const page = await context.newPage(); attach(page, { errors: [], httpErrors: [] });
await page.goto('http://127.0.0.61:4300', { waitUntil: 'domcontentloaded' });
await waitAppBoot(page); await waitPhase(page, 'FACTORY_SWAP');
const dump = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('.pf-battle-card'));
  const panels = Array.from(document.querySelectorAll('.pf-panel')).map((p) => (p.querySelector('h3')?.innerText || '').trim());
  return {
    count: cards.length,
    panels,
    cards: cards.map((c, i) => ({ i, text: c.innerText.replace(/\s+/g, ' ').trim(),
      selected: c.getAttribute('data-selected') ?? c.getAttribute('aria-pressed') ?? null,
      cls: c.className.split(' ').filter((x) => /ring|border-blue|border-red|opacity/.test(x)).join(' ') })),
    confirmDisabled: document.querySelector('button[aria-describedby], button') ? Array.from(document.querySelectorAll('button')).filter((x) => x.innerText.includes('确认交换')).map((x) => ({ disabled: x.disabled, describedby: x.getAttribute('aria-describedby') })) : [],
    conflict: document.querySelector('#factory-swap-item-conflict')?.innerText ?? null,
    pick: document.body.innerText.replace(/\s+/g, ' ').match(/当前选择[^交]*交换目标[^跳]*/)?.[0] ?? null,
  };
});
console.log(JSON.stringify(dump, null, 2));
await context.close(); await browser.close();
