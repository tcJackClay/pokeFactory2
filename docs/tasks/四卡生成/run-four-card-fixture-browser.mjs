// 四卡生成 · 受控夹具构建
// 步骤 1（真实 UI）：在隔离来源 127.0.0.21:4300 用真实触控创建自然新档，进入第 1 战就绪态，落盘为 base-save-v14.json。
// 步骤 2（Node 纯变换）：由自然档派生出各节点边界的注入夹具（受控存档注入）。
// 手段声明：模拟视口 390×844 + 真实 UI 触控（建自然档）+ 受控存档注入（派生夹具）。未使用 DEV Win。
// 不修改实现代码。
import { chromium } from 'file:///C:/Users/45186/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const taskDir = 'D:/Games/pokeFactory2/docs/tasks/四卡生成';
const out = `${taskDir}/evidence`;
const fixtureDir = `${out}/fixtures`;
await mkdir(fixtureDir, { recursive: true });
const origin = 'http://127.0.0.21:4300';

const result = { origin, means: '真实 UI 建自然档（模拟视口 390×844）+ 受控存档注入派生夹具', steps: [], errors: [], httpErrors: [] };

// ---------- 步骤 1：自然档 ----------
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await context.newPage();
page.on('pageerror', (e) => result.errors.push(`pageerror ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') result.errors.push(`console ${m.text()}`); });
page.on('response', (r) => { if (r.status() >= 400) result.httpErrors.push(`${r.status()} ${r.url()}`); });

const readSave = () => page.evaluate(() => localStorage.getItem('pokefactory_save_v1'));
const state = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('pokefactory_save_v1'));
  const b = s.factory.battleResume;
  return { schema: s.schemaVersion, phase: b.phase, stage: b.stage, runId: s.wallet.currentRunId, runSupply: s.runSupply, trainer: b.currentEnemyTrainerId };
});
const waitBattleReady = async () => {
  for (let i = 0; i < 60; i++) {
    if (await page.locator('.pf-battle-interaction-panel[data-enabled="true"]').count()) return true;
    const cont = page.locator('[data-awaiting-continue="true"]');
    if (await cont.count()) await cont.tap().catch(() => {});
    await page.waitForTimeout(500);
  }
  return false;
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
  if (!(await waitBattleReady())) throw new Error('stage 1 battle not ready');
  const raw = await readSave();
  result.base = await state();
  await page.screenshot({ path: `${out}/fixture-base-stage1-390x844.png` });
  await writeFile(`${fixtureDir}/base-save-v14.json`, raw, 'utf8');
  result.ok = true;
} catch (error) {
  result.failure = String(error);
  result.lastBody = await page.locator('body').innerText().catch(() => '');
  await page.screenshot({ path: `${out}/fixture-bootstrap-failure.png` }).catch(() => {});
} finally {
  await browser.close();
}

// ---------- 步骤 2：派生夹具 ----------
const SEVEN = ['scope_lens', 'quick_claw', 'kings_rock', 'choice_band', 'focus_band', 'heavy_duty_boots', 'loaded_dice'];
if (result.ok) {
  const base = JSON.parse(await readFile(`${fixtureDir}/base-save-v14.json`, 'utf8'));
  const runId = base.wallet.currentRunId;

  // 受控夹具：给玩家首位一只确定可用的普通系物理攻击招式（真实招式对象形状取自既有隔离脚本范式），
  // 只为让「真实出招取胜」这条路一定可达，不改变回合语义。
  const SYNTH_TACKLE = {
    name: 'tackle', zhName: '撞击', power: 150, accuracy: 100, type: 'normal', damage_class: 'physical',
    pp: 20, currentPp: 20, maxPp: 20,
    battleData: {
      effectId: 'NONE', priority: 0, target: 'selected-pokemon', flags: [], critStage: 0, drainPercent: 0,
      recoilPercent: 0, healingPercent: 0, strikeMode: 'single', minHits: 1, maxHits: 1, secondaryEffects: [],
      substituteInteraction: 'blocked', makesContact: true, soundMove: false, powderMove: false, ballisticMove: false,
      punchMove: false, bypassProtect: false, ignoreAccuracyCheck: false,
    },
  };

  const singleHitMove = (move) => ({
    ...move,
    battleData: {
      ...move.battleData,
      strikeMode: 'single', minHits: 1, maxHits: 1, guaranteedHits: undefined,
    },
  });

  // items: [{ equipped, current }] 长度 3；current === 'CONSUMED' 表示战斗中已消耗/被拍落
  const build = (name, cfg) => {
    const save = JSON.parse(JSON.stringify(base));
    const b = save.factory.battleResume;
    const stage = cfg.stage;
    const phase = cfg.phase;
    b.stage = stage;
    b.phase = phase;
    b.roundResult = cfg.roundResult ?? null;
    b.streak = Math.max(0, stage - 1);
    b.swapCount = cfg.swapCount ?? 0;
    b.turn = 'PLAYER';
    b.battleMenuTab = 'MAIN';
    b.weather = 'none'; b.weatherTurns = 0;
    b.fieldState = []; b.fieldTurns = {};
    b.tailwindTurns = { player: 0, enemy: 0 };
    b.hazards = { player: { stealthRock: false, toxicSpikesLayers: 0 }, enemy: { stealthRock: false, toxicSpikesLayers: 0 } };
    b.activeBuffs = { atk: false, def: false };
    b.enemyBuffs = { atk: false, def: false };
    b.battleLog = [];
    b.checkpointAt = new Date().toISOString();
    b.heldItemBaselineRepaired = undefined;
    b.rewardCheckpoint = cfg.checkpoint ? { runId, stage, ...cfg.checkpoint } : undefined;

    b.playerTeam.forEach((p, i) => {
      const spec = cfg.playerItems[i];
      p.factoryOriginalHeldItemId = spec.original ?? p.factoryOriginalHeldItemId;
      p.factoryEquippedHeldItemId = spec.equipped;
      if (spec.current === 'CONSUMED') delete p.factoryHeldItemId;
      else p.factoryHeldItemId = spec.current ?? spec.equipped;
      // 受控夹具：让玩家队足够耐打，保证「真实出招取胜」不会因对手反击而失败（不改变回合语义）
      if (cfg.playerBulk) {
        p.maxHp = 400; p.currentHp = 400;
        p.calculatedStats = { ...p.calculatedStats, hp: 400, attack: 130, defense: 300, spDef: 300, speed: 220 };
      } else {
        p.currentHp = p.maxHp;
      }
      delete p.nonVolatileStatus;
      if (cfg.singleHitMoves) p.selectedMoves = p.selectedMoves.map(singleHitMove);
      if (cfg.giveTackle && i === 0) p.selectedMoves = [SYNTH_TACKLE, ...p.selectedMoves.slice(0, 3)];
    });
    b.enemyTeam.forEach((p, i) => {
      const spec = (cfg.enemyItems ?? [])[i];
      if (spec) {
        p.factoryEquippedHeldItemId = spec;
        p.factoryHeldItemId = spec;
      }
      p.currentHp = cfg.enemyHp ?? p.maxHp;
      if (cfg.enemyWeak) {
        p.maxHp = Math.max(1, cfg.enemyHp ?? 1);
        p.calculatedStats = { ...p.calculatedStats, hp: p.maxHp, attack: 2, defense: 1, spDef: 1, speed: 5 };
      }
      delete p.nonVolatileStatus;
    });

    const expectedCreditedStage = phase === 'BATTLE' ? stage - 1 : stage;
    save.runSupply = { runId, tickets: Math.max(0, expectedCreditedStage), lastCreditedStage: expectedCreditedStage };
    save.factory.challengeStatus = 1;
    save.factory.challengePaused = false;
    save.factory.curChallengeBattleNum = ((stage - 1) % 7);
    save.updatedAt = new Date().toISOString();
    return { name, text: JSON.stringify(save) };
  };

  const A = [ { equipped: 'heavy_duty_boots' }, { equipped: 'quick_claw' }, { equipped: 'kings_rock' } ];
  const B = [ { equipped: 'loaded_dice' }, { equipped: 'scope_lens' }, { equipped: 'focus_band' } ];

  const fixtures = [
    // 验收1-A：三人持 heavy_duty_boots / quick_claw / kings_rock；招式统一为单体（loaded_dice 无触发场景，确定性）
    build('fx-comboA-stage3-battle.json', { stage: 3, phase: 'BATTLE', playerItems: A, enemyHp: 1, enemyWeak: true, playerBulk: true, singleHitMoves: true, giveTackle: true }),
    // 验收1-B：三人持 loaded_dice / scope_lens / focus_band
    build('fx-comboB-stage3-battle.json', { stage: 3, phase: 'BATTLE', playerItems: B, enemyHp: 1, enemyWeak: true, playerBulk: true, singleHitMoves: true, giveTackle: true }),
    // 验收2：idx0 的 scope_lens 战斗中已消耗（current 缺失），但返还基准仍在队 ⇒ 该 ID 仍不得出卡
    build('fx-consumed-stage3-battle.json', { stage: 3, phase: 'BATTLE', playerItems: [ { equipped: 'scope_lens', current: 'CONSUMED' }, { equipped: 'quick_claw' }, { equipped: 'kings_rock' } ], enemyHp: 1, enemyWeak: true, playerBulk: true, singleHitMoves: true, giveTackle: true }),
    // 验收3：直接落在奖励节点 PENDING（刷新/重开冻结用）
    build('fx-stage3-reward-pending.json', { stage: 3, phase: 'REWARD', roundResult: 'WIN', checkpoint: { status: 'PENDING' }, playerItems: A, singleHitMoves: true }),
    // 补遗11：第 1 胜后换怪屏，敌方 idx2 的基准与留下队员 idx2 重复
    build('fx-stage1-swap-conflict.json', { stage: 1, phase: 'FACTORY_SWAP', roundResult: 'WIN', playerItems: [ { equipped: 'scope_lens' }, { equipped: 'quick_claw' }, { equipped: 'kings_rock' } ], enemyItems: ['focus_band', 'choice_band', 'kings_rock'] }),
    // 验收6b：第 7 战（组内最后一战），idx0 已消耗态 ⇒ 第 7 胜后不得提前返还
    build('fx-stage7-battle.json', { stage: 7, phase: 'BATTLE', playerItems: [ { equipped: 'scope_lens', current: 'CONSUMED' }, { equipped: 'quick_claw' }, { equipped: 'kings_rock' } ], enemyHp: 1, enemyWeak: true, playerBulk: true, singleHitMoves: true, giveTackle: true }),
    // 补遗12：注入「三人基准重复」的存档（idx0/idx1 同为 scope_lens）
    build('fx-duplicate-baselines.json', { stage: 3, phase: 'REWARD', roundResult: 'WIN', checkpoint: { status: 'PENDING' }, playerItems: [ { equipped: 'scope_lens' }, { equipped: 'scope_lens' }, { equipped: 'kings_rock' } ], singleHitMoves: true }),
  ];

  const manifest = { origin, runId, seven: SEVEN, base: result.base, fixtures: [] };
  for (const fixture of fixtures) {
    await writeFile(`${fixtureDir}/${fixture.name}`, fixture.text, 'utf8');
    const parsed = JSON.parse(fixture.text);
    const b = parsed.factory.battleResume;
    manifest.fixtures.push({
      file: fixture.name, bytes: fixture.text.length,
      stage: b.stage, phase: b.phase, roundResult: b.roundResult,
      checkpoint: b.rewardCheckpoint ?? null,
      player: b.playerTeam.map((p) => ({ id: p.id, name: p.name, original: p.factoryOriginalHeldItemId, equipped: p.factoryEquippedHeldItemId, current: p.factoryHeldItemId ?? null })),
      enemy: b.enemyTeam.map((p) => ({ id: p.id, equipped: p.factoryEquippedHeldItemId, hp: p.currentHp })),
      runSupply: parsed.runSupply,
    });
  }
  result.manifest = manifest;
  await writeFile(`${out}/fixture-build.json`, JSON.stringify(result, null, 2), 'utf8');
}
await writeFile(`${out}/fixture-build.json`, JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify({ ok: result.ok, failure: result.failure, base: result.base, counts: result.manifest?.fixtures?.length, fixtures: result.manifest?.fixtures?.map((f) => `${f.file} stage=${f.stage} ${f.phase} player=${f.player.map((p) => `${p.equipped}${p.current === null ? '(consumed)' : ''}`).join(',')}`), errors: result.errors.slice(-5), httpErrors: result.httpErrors.slice(-5), lastBody: result.lastBody?.slice(-400) }, null, 2));
