// 四卡生成验收 · 换怪唯一性守卫（裁决补遗 11）+ 存档写入失败语义（PRD 验收 7 的换怪落盘分支）
// 手段声明：隔离来源 127.0.0.<octet>:4300 + 隔离 Playwright Chromium 手机模拟视口 + 受控存档注入 + 真实 UI 触控
//          + 受控故障注入（failNextWrite）。未使用 DEV Win。不修改实现代码。
import {
  COMBO_A, rest, launch, loadFixture, attach, makeContext, readState, readRewardDom, snap,
  waitAppBoot, waitBattleReady, winBattleByMoves, waitPhase, waitRewardReady, tapSkipSwap,
  tapContinueRoundResult, armFailWrite, failWriteStats, disarmFailWrite, writeRecord, ensureDirs, settleImages,
  selectSwapCard,
} from './four-card-harness.mjs';

const results = { commit: '0394e9d (codex/four-card-reward, worktree dirty)', cases: {}, errors: [] };
const browser = await launch();

const baseSwapFixture = JSON.parse(await loadFixture('fx-stage1-swap-conflict.json'));
const swapVariant = (stage) => {
  const s = JSON.parse(JSON.stringify(baseSwapFixture));
  const b = s.factory.battleResume;
  b.stage = stage;
  b.streak = stage - 1;
  b.rewardCheckpoint = undefined;
  s.runSupply = { runId: s.wallet.currentRunId, tickets: stage, lastCreditedStage: stage };
  s.factory.curChallengeBattleNum = (stage - 1) % 7;
  s.updatedAt = new Date().toISOString();
  return JSON.stringify(s);
};

const swapCards = (page) => page.locator('.pf-battle-card');
const conflictNote = (page) => page.locator('#factory-swap-item-conflict');

// ============ 用例 SWAP-GUARD：第 1/2/4/5 胜后的换怪守卫 ============
for (const stage of [1, 2, 4, 5]) {
  const name = `swap-guard-win${stage}`;
  const octet = 54 + stage;
  const record = { name, octet, stage, steps: [], errors: [], httpErrors: [] };
  results.cases[name] = record;
  const dir = await ensureDirs(name);
  const { context } = await makeContext(browser, { octet, viewport: { width: 390, height: 844 }, saveText: swapVariant(stage) });
  const page = await context.newPage();
  attach(page, record);
  try {
    await page.goto(`http://127.0.0.${octet}:4300`, { waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    await waitPhase(page, 'FACTORY_SWAP');
    const s0 = await snap(page, record, dir, '01-swap-screen');
    record.before = { stage: s0.stage, phase: s0.phase, player: s0.player, enemy: s0.enemy, swapCount: s0.swapCount };

    const confirm = page.getByRole('button', { name: '确认交换' });
    // 组合 A：我方 idx0（基准 scope_lens）↔ 敌方 idx2（基准 kings_rock，与留下的我方 idx2 重复）
    const selMy0 = await selectSwapCard(page, 0);
    const selEnemy2 = await selectSwapCard(page, 5);
    await page.waitForTimeout(400);
    record.selection = { my0Selected: selMy0, enemy2Selected: selEnemy2 };
    const noteVisible = await conflictNote(page).count();
    const noteText = noteVisible ? (await conflictNote(page).innerText()).replace(/\s+/g, ' ').trim() : null;
    const confirmDisabled = await confirm.isDisabled();
    const describedBy = await confirm.getAttribute('aria-describedby');
    await snap(page, record, dir, '02-conflicting-swap-blocked');
    record.conflictOption = { visible: Boolean(noteVisible), text: noteText, confirmDisabled, ariaDescribedBy: describedBy };

    // 组合 B：我方 idx0 ↔ 敌方 idx0（基准 focus_band，不与他人重复）⇒ 应当可选
    record.selection.enemy0Selected = await selectSwapCard(page, 3);
    await page.waitForTimeout(400);
    const noteAfterLegal = await conflictNote(page).count();
    const confirmEnabledAfterLegal = !(await confirm.isDisabled());
    await snap(page, record, dir, '03-legal-swap-allowed');
    record.legalOption = { conflictVisible: Boolean(noteAfterLegal), confirmEnabled: confirmEnabledAfterLegal };

    record.assertions = {
      guardCoversThisWin: stage <= 6,
      isNotRewardAnchor: ![3, 6].includes(stage),
      conflictingOptionDisabledAndExplained: Boolean(noteVisible) && confirmDisabled === true && Boolean(noteText),
      ariaDescribedByWired: describedBy === 'factory-swap-item-conflict',
      legalOptionStillAllowed: confirmEnabledAfterLegal && !noteAfterLegal,
    };

    // 仅在 stage 1 上继续：做一次真实合法换怪，再从换后的队伍推进到第 3 胜奖励节点，验证「不死路」
    if (stage === 1) {
      await confirm.tap();
      await waitBattleReady(page, 60);
      await page.waitForFunction(() => {
        try {
          const b = JSON.parse(localStorage.getItem('pokefactory_save_v1')).factory.battleResume;
          return b.phase === 'BATTLE' && b.stage === 2;
        } catch { return false; }
      }, null, { timeout: 40000 });
      const s1 = await snap(page, record, dir, '04-after-legal-swap-stage2');
      record.afterSwap = { stage: s1.stage, phase: s1.phase, player: s1.player, swapCount: s1.swapCount };
      record.assertions.swapWrittenUniqueBaselines = new Set(s1.player.map((p) => p.equipped).filter(Boolean)).size === 3;
      record.assertions.swapCountIncremented = s1.swapCount === 1;
      record.assertions.incomingBaseline = s1.player[0].equipped;

      // 由「真实换怪后的队伍」派生第 3 战边界：只改战次/补给/敌方强弱，并给首位一个确定可用的攻击招式
      const tackle = JSON.parse(await loadFixture('fx-comboA-stage3-battle.json')).factory.battleResume.playerTeam[0].selectedMoves[0];
      await page.evaluate((t) => {
        const raw = localStorage.getItem('pokefactory_save_v1');
        const save = JSON.parse(raw);
        const b = save.factory.battleResume;
        b.stage = 3;
        b.phase = 'BATTLE';
        b.roundResult = null;
        b.streak = 2;
        b.turn = 'PLAYER';
        b.battleMenuTab = 'MAIN';
        b.battleLog = [];
        b.weather = 'none'; b.weatherTurns = 0;
        b.fieldState = []; b.fieldTurns = {};
        b.tailwindTurns = { player: 0, enemy: 0 };
        b.hazards = { player: { stealthRock: false, toxicSpikesLayers: 0 }, enemy: { stealthRock: false, toxicSpikesLayers: 0 } };
        b.checkpointAt = new Date().toISOString();
        b.rewardCheckpoint = undefined;
        b.playerTeam.forEach((p) => {
          p.currentHp = 400; p.maxHp = 400;
          p.calculatedStats = { ...p.calculatedStats, hp: 400, attack: 130, defense: 300, spDef: 300, speed: 220 };
          p.selectedMoves = [t, ...p.selectedMoves.slice(0, 3)];
          delete p.nonVolatileStatus;
        });
        b.enemyTeam.forEach((p) => {
          p.currentHp = 1; p.maxHp = 1;
          p.calculatedStats = { ...p.calculatedStats, hp: 1, attack: 2, defense: 1, spDef: 1, speed: 5 };
          delete p.nonVolatileStatus;
        });
        save.runSupply = { runId: save.wallet.currentRunId, tickets: 2, lastCreditedStage: 2 };
        save.factory.curChallengeBattleNum = 2;
        localStorage.setItem('pokefactory_save_v1', JSON.stringify(save));
      }, tackle);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitAppBoot(page);
      if (!(await waitBattleReady(page))) throw new Error('derived stage 3 battle not ready');
      await snap(page, record, dir, '05-derived-stage3-battle');
      const win = await winBattleByMoves(page, record);
      record.derivedWin = win;
      if (!win.ok) throw new Error('derived stage 3 not won');
      await tapContinueRoundResult(page);
      await waitPhase(page, 'FACTORY_SWAP');
      await tapSkipSwap(page);
      await waitRewardReady(page);
      await settleImages(page);
      const reward = await snap(page, record, dir, '06-reward-after-earlier-legal-swap');
      const cards = reward.rewardCheckpoint?.cardItemIds ?? [];
      record.rewardAfterSwap = {
        stage: reward.stage, cards, status: reward.rewardCheckpoint?.status,
        player: reward.player,
        expected: rest(reward.player.map((p) => p.equipped)),
        fourDistinct: cards.length === 4 && new Set(cards).size === 4,
        everyCardHasLegalTarget: (await readRewardDom(page)).cards.every((c) => !c.disabled),
        noDuplicateBaselines: new Set(reward.player.map((p) => p.equipped).filter(Boolean)).size === 3,
      };
      record.assertions.noDeadEndAfterEarlierSwap =
        cards.length === 4 && new Set(cards).size === 4 && JSON.stringify([...cards].sort()) === JSON.stringify([...rest(reward.player.map((p) => p.equipped))].sort());
    }
  } catch (e) {
    record.failure = String(e);
    await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
    record.bodyTail = await page.locator('body').innerText().catch(() => '');
  } finally {
    await context.close();
    await writeRecord(name, record);
  }
}

// ============ 用例 FAIL-SWAP：换怪 → 奖励 PENDING 落盘失败 ============
{
  const name = 'failure-semantics-swap-commit';
  const record = { name, octet: 60, fixture: 'fx-comboA-stage3-battle.json', steps: [], errors: [], httpErrors: [] };
  results.cases[name] = record;
  const dir = await ensureDirs(name);
  const { context } = await makeContext(browser, { octet: 60, viewport: { width: 390, height: 844 }, saveText: await loadFixture('fx-comboA-stage3-battle.json') });
  const page = await context.newPage();
  attach(page, record);
  try {
    await page.goto('http://127.0.0.60:4300', { waitUntil: 'domcontentloaded' });
    await waitAppBoot(page);
    if (!(await waitBattleReady(page))) throw new Error('battle not ready');
    const win = await winBattleByMoves(page, record);
    if (!win.ok) throw new Error('not won');
    await tapContinueRoundResult(page);
    await waitPhase(page, 'FACTORY_SWAP');
    const before = await readState(page);
    record.before = { stage: before.stage, phase: before.phase, checkpoint: before.rewardCheckpoint, player: before.player, roundResult: before.roundResult };

    await armFailWrite(page, '"rewardCheckpoint":\\{[^}]*"status":"PENDING"');
    await tapSkipSwap(page);
    await page.waitForTimeout(2500);
    const failed = await snap(page, record, dir, '01-swap-commit-failed');
    record.afterFailure = {
      stage: failed.stage, phase: failed.phase, checkpoint: failed.rewardCheckpoint,
      player: failed.player, swapCount: failed.swapCount,
      errorVisible: /奖励进度保存失败|保存失败/.test(failed.bodyTail),
      bodyTail: failed.bodyTail,
      failWriteStats: await failWriteStats(page),
    };
    await disarmFailWrite(page);
    await tapSkipSwap(page);
    await waitRewardReady(page);
    await settleImages(page);
    const recovered = await snap(page, record, dir, '02-retry-succeeded');
    const cards = recovered.rewardCheckpoint?.cardItemIds ?? [];
    record.recovered = { stage: recovered.stage, status: recovered.rewardCheckpoint?.status, cards };
    record.assertions = {
      stayedOnSwapScreen: record.afterFailure.phase === 'FACTORY_SWAP',
      stageNotAdvanced: record.afterFailure.stage === 3,
      noRewardCheckpointWritten: (record.afterFailure.checkpoint ?? null) === null,
      playerUntouched: JSON.stringify(record.afterFailure.player.map((p) => p.equipped)) === JSON.stringify(before.player.map((p) => p.equipped)),
      honestErrorShown: record.afterFailure.errorVisible === true,
      injectedFailureActuallyFired: (record.afterFailure.failWriteStats.hits ?? 0) >= 1,
      retryReachedReward: record.recovered.status === 'READY',
      retryProducedFourDistinct: cards.length === 4 && new Set(cards).size === 4,
      noDuplicateCards: cards.length === new Set(cards).size,
    };
  } catch (e) {
    record.failure = String(e);
    await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
    record.bodyTail = await page.locator('body').innerText().catch(() => '');
  } finally {
    await context.close();
    await writeRecord(name, record);
  }
}

await browser.close();
const brief = {};
for (const [k, r] of Object.entries(results.cases)) {
  brief[k] = { failure: r.failure, assertions: r.assertions, conflictOption: r.conflictOption, legalOption: r.legalOption, afterSwap: r.afterSwap, rewardAfterSwap: r.rewardAfterSwap, afterFailure: r.afterFailure && { stage: r.afterFailure.stage, phase: r.afterFailure.phase, checkpoint: r.afterFailure.checkpoint, errorVisible: r.afterFailure.errorVisible, hits: r.afterFailure.failWriteStats }, recovered: r.recovered, errors: r.errors.slice(-3), httpErrors: r.httpErrors.slice(-3), bodyTail: r.bodyTail?.slice(-260) };
}
console.log(JSON.stringify(brief, null, 2));
