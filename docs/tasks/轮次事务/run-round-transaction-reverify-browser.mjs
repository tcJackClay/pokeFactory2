// 轮次事务验收 PRD 强制重验 #7/#8/#9：顺风行动顺序与四回合计时、毒菱敌方一次行动不重复铺层、隐形岩连续入场补位
// 手段：隔离来源 127.0.0.x:4300 + 隔离 Playwright Chromium 手机模拟视口 + 受控存档注入（基准来自自然新档 base-save.json）。
// 不使用 DEV Win。不修改实现代码。既有旧样本（修复前取得）作废，本脚本产出新样本。
import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const taskDir = 'D:/Games/pokeFactory2/docs/tasks/轮次事务';
const out = `${taskDir}/evidence/reverify`;
await mkdir(out, { recursive: true });
const baseRaw = await readFile(`${taskDir}/evidence/base-save.json`, 'utf8');

const makeMove = (name, zhName, { power = null, accuracy = null, type = 'normal', damage_class = 'status', effectId = 'NONE', target = 'selected-pokemon' } = {}) => ({
  name, zhName, power, accuracy, type, damage_class, pp: 20, currentPp: 20, maxPp: 20,
  battleData: {
    effectId, priority: 0, target, flags: [], critStage: 0, drainPercent: 0, recoilPercent: 0, healingPercent: 0,
    strikeMode: 'single', minHits: 1, maxHits: 1, secondaryEffects: [], substituteInteraction: 'blocked',
    makesContact: false, soundMove: false, powderMove: false, ballisticMove: false, punchMove: false,
    bypassProtect: false, ignoreAccuracyCheck: false,
  },
});
const tackle = makeMove('tackle', '撞击', { power: 40, accuracy: 100, damage_class: 'physical' });
const scratch = makeMove('scratch', '抓', { power: 40, accuracy: 100, damage_class: 'physical' });
const pound = makeMove('pound', '拍击', { power: 40, accuracy: 100, damage_class: 'physical' });
const headbutt = makeMove('headbutt', '头锤', { power: 40, accuracy: 100, damage_class: 'physical' });
const splash = makeMove('splash', '跃起', { target: 'user' });
const tailwind = makeMove('tailwind', '顺风', { effectId: 'TAILWIND', type: 'flying', target: 'user' });
const toxicSpikes = makeMove('toxic-spikes', '毒菱', { effectId: 'TOXIC_SPIKES', type: 'poison', target: 'opponents-field' });

const isEnemyAction = l => l.includes('对手的') && l.includes('使用了');
const isPlayerAction = l => !l.includes('对手的') && l.includes('使用了');

const browser = await chromium.launch({ headless: true });
const options = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const results = { task: 'reverify', cases: {}, errors: [] };

const attach = (page, record) => {
  page.on('pageerror', e => record.errors.push(`pageerror ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') record.errors.push(`console ${m.text()}`); });
  page.on('response', r => { if (r.status() >= 400) record.errors.push(`http ${r.status()} ${r.url()}`); });
};
const waitReady = async page => {
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.pf-battle-interaction-panel[data-enabled="true"]').count()) return;
    const b = page.locator('[data-awaiting-continue="true"]');
    if (await b.count()) await b.tap();
    await page.waitForTimeout(500);
  }
  throw new Error('battle not ready');
};
const readStable = page => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('pokefactory_save_v1'));
  const b = s.factory.battleResume;
  const brief = p => p && ({ id: p.id, hp: p.currentHp, maxHp: p.maxHp, status: p.nonVolatileStatus?.id ?? null, pp: p.selectedMoves?.map(m => `${m.name}:${m.currentPp ?? m.pp}`) });
  return {
    phase: b.phase, turn: b.turn, logLen: b.battleLog?.length ?? 0,
    weather: b.weather, weatherTurns: b.weatherTurns, tailwindTurns: b.tailwindTurns,
    fieldState: b.fieldState, fieldTurns: b.fieldTurns, hazards: b.hazards,
    player: b.playerTeam?.map(brief), enemy: b.enemyTeam?.map(brief),
    panelEnabled: document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled ?? null,
    viewport: [innerWidth, innerHeight], scrollWidth: document.documentElement.scrollWidth,
  };
});
const snap = async (page, record, name) => {
  const state = await readStable(page);
  record.steps.push({ name, state });
  await page.screenshot({ path: `${out}/${record.name}-${name}.png` });
  return state;
};
const readLog = (page, n) => page.evaluate((count) => JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume.battleLog.slice(-count), n);

const buildFixture = (raw, mutate) => {
  const save = JSON.parse(raw);
  const b = save.factory.battleResume;
  const player = b.playerTeam[0];
  const enemy = b.enemyTeam[0];
  const setup = (mon, { speed, attack = 50, defense = 100, hp = 300 }) => {
    mon.currentHp = mon.maxHp = hp;
    mon.calculatedStats.hp = hp;
    mon.calculatedStats.attack = attack;
    mon.calculatedStats.defense = defense;
    mon.calculatedStats.speed = speed;
    mon.types = [{ slot: 1, type: { name: 'normal', url: '' } }];
    mon.baseTypes = mon.types;
    mon.factoryOriginalHeldItemId = null;
    delete mon.factoryHeldItemId;
    mon.abilities = [{ ability: { name: 'run-away', url: '' } }];
    mon.statStages = { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0, evasion: 0 };
    delete mon.nonVolatileStatus;
  };
  b.hazards = { player: { stealthRock: false, toxicSpikesLayers: 0 }, enemy: { stealthRock: false, toxicSpikesLayers: 0 } };
  b.weather = 'none'; b.weatherTurns = 0; b.tailwindTurns = { player: 0, enemy: 0 };
  b.fieldState = []; b.fieldTurns = {}; b.battleLog = []; b.turn = 'PLAYER'; b.battleMenuTab = 'MAIN';
  b.playerTeam.forEach(p => { p.factoryOriginalHeldItemId = null; delete p.factoryHeldItemId; p.abilities = [{ ability: { name: 'run-away', url: '' } }]; delete p.nonVolatileStatus; });
  b.enemyTeam.forEach(p => { p.factoryOriginalHeldItemId = null; delete p.factoryHeldItemId; p.abilities = [{ ability: { name: 'run-away', url: '' } }]; delete p.nonVolatileStatus; });
  mutate({ save, b, player, enemy, setup });
  player.baseTypes = player.types;
  enemy.baseTypes = enemy.types;
  b.checkpointAt = new Date().toISOString();
  return JSON.stringify(save);
};

const newCase = async (name, octet, raw) => {
  const origin = `http://127.0.0.${octet}:4300`;
  const record = { name, origin, steps: [], errors: [], rounds: [] };
  results.cases[name] = record;
  const context = await browser.newContext({ ...options, storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'pokefactory_save_v1', value: raw }] }] } });
  const page = await context.newPage();
  attach(page, record);
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  return { record, page, context };
};

// ---------- #7 顺风行动顺序 + 四回合计时 ----------
try {
  const raw = buildFixture(baseRaw, ({ b, player, enemy, setup }) => {
    setup(player, { speed: 60, hp: 400 });
    setup(enemy, { speed: 100, hp: 400, attack: 30 });
    player.selectedMoves = [tailwind, tackle];
    enemy.selectedMoves = [tackle, scratch, pound, headbutt];
  });
  const { record, page, context } = await newCase('tailwind-order-four-turns', 71, raw);
  try {
    await snap(page, record, 'fixture-ready-390');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);
    await snap(page, record, 'fixture-ready-844x390');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    for (let round = 1; round <= 4; round++) {
      const prev = record.steps[record.steps.length - 1].state;
      await page.getByRole('button', { name: '战斗', exact: true }).tap();
      await page.locator('.pf-battle-move-button').nth(round === 1 ? 0 : 1).tap();
      await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 45000 });
      await page.waitForTimeout(700);
      const after = await snap(page, record, `round${round}-390`);
      const logDelta = (after.logLen ?? 0) - (prev.logLen ?? 0);
      const newLog = logDelta > 0 ? await readLog(page, logDelta) : [];
      const order = newLog.filter(l => isEnemyAction(l) || isPlayerAction(l)).map(l => (isEnemyAction(l) ? 'ENEMY' : 'PLAYER'));
      record.rounds.push({
        round, logDelta, newLog, order,
        tailwindBefore: prev.tailwindTurns, tailwindAfter: after.tailwindTurns,
        playerHpAfter: after.player?.[0]?.hp, enemyHpAfter: after.enemy?.[0]?.hp,
        enemyActions: newLog.filter(isEnemyAction).length, playerActions: newLog.filter(isPlayerAction).length,
      });
    }
  } catch (e) { record.failure = String(e); await page.screenshot({ path: `${out}/tailwind-failure.png` }).catch(() => {}); }
  finally { await context.close(); }
} catch (e) { results.errors.push(`tailwind setup ${e}`); }

// ---------- #8 毒菱：敌方一次行动不再重复铺层 ----------
try {
  const raw = buildFixture(baseRaw, ({ b, player, enemy, setup }) => {
    setup(player, { speed: 1, hp: 400 });
    setup(enemy, { speed: 500, hp: 400 });
    player.selectedMoves = [splash];
    enemy.selectedMoves = [toxicSpikes];
    b.hazards.enemy.toxicSpikesLayers = 0;
  });
  const { record, page, context } = await newCase('toxic-spikes-single-layer', 72, raw);
  try {
    await snap(page, record, 'fixture-ready-390');
    for (let round = 1; round <= 3; round++) {
      const prev = record.steps[record.steps.length - 1].state;
      await page.getByRole('button', { name: '战斗', exact: true }).tap();
      await page.locator('.pf-battle-move-button').first().tap();
      await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 45000 });
      await page.waitForTimeout(700);
      const after = await snap(page, record, `round${round}-390`);
      const logDelta = (after.logLen ?? 0) - (prev.logLen ?? 0);
      const newLog = logDelta > 0 ? await readLog(page, logDelta) : [];
      record.rounds.push({
        round, logDelta, newLog,
        layersBefore: prev.hazards.player.toxicSpikesLayers, layersAfter: after.hazards.player.toxicSpikesLayers,
        playerSideLayersAfter: after.hazards.player.toxicSpikesLayers, enemySideLayersAfter: after.hazards.enemy.toxicSpikesLayers,
        enemyLayLines: newLog.filter(l => l.includes('毒菱') || l.includes('Toxic Spikes')).length,
        enemyActions: newLog.filter(isEnemyAction).length, playerActions: newLog.filter(isPlayerAction).length,
        enemyPp: after.enemy?.[0]?.pp,
      });
    }
  } catch (e) { record.failure = String(e); await page.screenshot({ path: `${out}/toxic-spikes-failure.png` }).catch(() => {}); }
  finally { await context.close(); }
} catch (e) { results.errors.push(`toxic spikes setup ${e}`); }

// ---------- #9 隐形岩连续入场补位 ----------
try {
  const raw = buildFixture(baseRaw, ({ b, player, enemy, setup }) => {
    setup(player, { speed: 1, hp: 300 });
    setup(enemy, { speed: 500, hp: 400 });
    player.selectedMoves = [tackle];
    enemy.selectedMoves = [tackle, scratch, pound, headbutt];
    b.hazards.player.stealthRock = true;
    b.playerTeam.forEach(p => {
      p.types = [{ slot: 1, type: { name: 'normal', url: '' } }];
      p.baseTypes = p.types;
    });
    b.playerTeam[1].currentHp = 1;
    b.playerTeam[2].currentHp = 1;
  });
  const { record, page, context } = await newCase('stealth-rock-chain', 73, raw);
  try {
    record.fixture = { stealthRockOnPlayerSide: true, reserveHp: [1, 1] };
    const ready = await snap(page, record, 'fixture-ready-390');
    record.fixture.leadId = ready.player?.[0]?.id;
    record.fixture.reserveIds = ready.player?.slice(1).map(p => p.id);
    record.fixture.leadMaxHp = ready.player?.[0]?.maxHp;
    await page.getByRole('button', { name: '宝可梦', exact: true }).tap();
    await snap(page, record, 'switch-list-390');
    const btnTexts = await page.locator('.pf-battle-pokemon-grid button').allInnerTexts();
    record.switchButtons = btnTexts;
    const picks = [];
    const pickLowestHpSwitch = () => page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.pf-battle-pokemon-grid > div'));
      let best = -1; let bestHp = Infinity;
      cards.forEach((card, i) => {
        const btn = card.querySelector('button');
        if (!btn || btn.disabled) return;
        const m = card.innerText.match(/HP\s*(\d+)\/(\d+)/);
        if (!m) return;
        const hp = Number(m[1]);
        if (hp > 0 && hp < bestHp) { bestHp = hp; best = i; }
      });
      if (best < 0) return -1;
      cards[best].querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return best;
    });
    for (let step = 0; step < 4; step++) {
      const grid = await page.evaluate(() => Array.from(document.querySelectorAll('.pf-battle-pokemon-grid > div')).map(card => ({ text: card.innerText.replace(/\s+/g, ' ').trim().slice(0, 70), switchDisabled: card.querySelector('button')?.disabled ?? null })));
      const idx = await pickLowestHpSwitch();
      if (idx < 0) { picks.push({ step: step + 1, grid, pickIndex: -1, note: 'no enabled 出战 button' }); break; }
      await page.waitForTimeout(4200);
      const s = await snap(page, record, `after-switch${step + 1}-390`);
      picks.push({ step: step + 1, grid, pickIndex: idx, pickedText: grid[idx]?.text ?? null, player: s.player?.map(p => ({ id: p.id, hp: p.hp })), panelEnabled: s.panelEnabled });
      await page.waitForFunction(() => document.querySelector('.pf-battle-interaction-panel')?.dataset.enabled === 'true', null, { timeout: 30000 }).catch(() => {});
    }
    record.picks = picks;
    await page.waitForTimeout(2500);
    const final = await snap(page, record, 'round-complete-390');
    const logDelta = (final.logLen ?? 0) - (ready.logLen ?? 0);
    record.roundLog = logDelta > 0 ? await readLog(page, logDelta) : [];
    record.enemyActions = record.roundLog.filter(isEnemyAction).length;
    record.playerActions = record.roundLog.filter(isPlayerAction).length;
    record.finalPlayer = final.player?.map(p => ({ id: p.id, hp: p.hp, maxHp: p.maxHp }));
    record.stealthRockLines = record.roundLog.filter(l => l.includes('隐形岩') || l.includes('Stealth Rock')).length;
    record.faintLines = record.roundLog.filter(l => l.includes('倒下') || l.includes('fainted')).length;
  } catch (e) { record.failure = String(e); await page.screenshot({ path: `${out}/stealth-rock-chain-failure.png` }).catch(() => {}); }
  finally { await context.close(); }
} catch (e) { results.errors.push(`stealth rock setup ${e}`); }

await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2), 'utf8');
await browser.close();
const brief = {};
for (const [k, r] of Object.entries(results.cases)) {
  brief[k] = {
    failure: r.failure,
    rounds: r.rounds.map(x => ({ round: x.round, logDelta: x.logDelta, order: x.order, newLog: x.newLog, tailwindBefore: x.tailwindBefore, tailwindAfter: x.tailwindAfter, layersBefore: x.layersBefore, layersAfter: x.layersAfter, enemyActions: x.enemyActions, playerActions: x.playerActions, enemyLayLines: x.enemyLayLines, enemyPp: x.enemyPp })),
    picks: r.picks, switchButtons: r.switchButtons, roundLog: r.roundLog, enemyActions: r.enemyActions, playerActions: r.playerActions, stealthRockLines: r.stealthRockLines, faintLines: r.faintLines, finalPlayer: r.finalPlayer,
    errors: r.errors.slice(-4),
  };
}
console.log(JSON.stringify(brief, null, 2));
