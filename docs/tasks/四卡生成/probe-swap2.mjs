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
const dump = (tag) => page.evaluate((t) => ({
  tag: t,
  pressed: Array.from(document.querySelectorAll('.pf-battle-card')).map((c) => c.getAttribute('aria-pressed')),
  conflict: document.querySelector('#factory-swap-item-conflict')?.innerText?.replace(/\s+/g,' ').trim() ?? null,
  confirm: Array.from(document.querySelectorAll('button')).filter((x)=>x.innerText.includes('确认交换')).map((x)=>({d:x.disabled,db:x.getAttribute('aria-describedby')})),
  pick: document.body.innerText.replace(/\s+/g,' ').match(/当前选择[^跳]*/)?.[0]?.trim() ?? null,
}), tag);
const cards = page.locator('.pf-battle-card');
console.log(JSON.stringify(await dump('initial'), null, 1));
await cards.nth(0).tap({ position: { x: 60, y: 70 } }); await page.waitForTimeout(300);
console.log(JSON.stringify(await dump('after tap nth0'), null, 1));
await cards.nth(5).tap({ position: { x: 60, y: 70 } }); await page.waitForTimeout(400);
console.log(JSON.stringify(await dump('after tap nth5'), null, 1));
await cards.nth(0).tap({ position: { x: 60, y: 70 } }); await page.waitForTimeout(300);
console.log(JSON.stringify(await dump('after re-tap nth0'), null, 1));
await cards.nth(3).tap({ position: { x: 60, y: 70 } }); await page.waitForTimeout(400);
console.log(JSON.stringify(await dump('after tap nth3 (enemy0)'), null, 1));
await context.close(); await browser.close();
