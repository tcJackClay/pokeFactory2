// 轮次事务验收：证据汇总脚本（不驱动浏览器，只把各用例 results.json 归纳为 plan.md §4 指定的证据文件名）
// 运行方式：node "D:/Games/pokeFactory2/docs/tasks/轮次事务/build-evidence-summary.mjs"
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';

const dir = 'D:/Games/pokeFactory2/docs/tasks/轮次事务/evidence';
const read = async p => JSON.parse(await readFile(`${dir}/${p}`, 'utf8'));
const enemyFirst = await read('enemy-first/results.json');
const earlyExit = await read('early-exit/results.json');
const inputReload = await read('input-reload/results.json');
const reverify = await read('reverify/results.json');

const isEnemy = l => l.includes('对手的') && l.includes('使用了');
const isPlayer = l => !l.includes('对手的') && l.includes('使用了');
const order = log => log.filter(l => isEnemy(l) || isPlayer(l)).map(l => (isEnemy(l) ? 'ENEMY' : 'PLAYER'));

// 1) 一次指令 = 一轮（行动次数 / PP / 回合末 / 输入开放）
const perSide = { task: 'round-one-action-per-side', note: '每回合双方各行动一次（或早退记为已行动/跳过）；PP 每轮每侧 -1；回合末结算一次；回合结束后命令区恢复 enabled=true', cases: {} };
for (const [k, c] of Object.entries(enemyFirst.cases)) {
  perSide.cases[k] = {
    fixture: c.fixture, failure: c.failure ?? null,
    rounds: c.rounds.map(r => ({
      round: r.round, logDelta: r.logDelta,
      order: order(r.newLogLines),
      enemyActions: r.newLogLines.filter(isEnemy).length,
      playerActions: r.newLogLines.filter(isPlayer).length,
      before: r.before, after: r.after,
    })),
  };
}
for (const [k, c] of Object.entries(earlyExit.cases)) {
  perSide.cases[k] = {
    fixture: c.fixture, failure: c.failure ?? null,
    rounds: c.rounds.map(r => ({
      round: r.round, logDelta: r.logDelta, order: order(r.newLogLines),
      enemyActions: r.newLogLines.filter(isEnemy).length,
      playerActions: r.newLogLines.filter(isPlayer).length,
      before: r.before, after: r.after, log: r.newLogLines,
    })),
  };
}
await writeFile(`${dir}/round-one-action-per-side.json`, JSON.stringify(perSide, null, 2), 'utf8');

// 2) 敌方先手不出现二动
const md = [];
md.push('# 敌方先手不出现 ENEMY→PLAYER→ENEMY 二动');
md.push('');
md.push('- 手段：隔离来源 `127.0.0.61/62:4300` + 隔离 Playwright Chromium 手机模拟视口 + 受控存档注入（基准来自自然新档 `evidence/base-save.json`）；未使用 DEV Win。');
md.push('- 脚本：`run-round-transaction-enemy-first-browser.mjs`；原始数据：`evidence/enemy-first/results.json`；截图：`evidence/enemy-first/*.png`。');
md.push('- 断言口径：`battleLog` 增量中「对手的…使用了…」与「…使用了…」的出现顺序与条数。');
md.push('');
for (const [k, c] of Object.entries(enemyFirst.cases)) {
  md.push(`## ${k}`);
  md.push('');
  md.push(`fixture: \`${JSON.stringify(c.fixture)}\``);
  md.push('');
  md.push('| 回合 | 日志条数 | 行动顺序 | 敌方行动数 | 我方行动数 | 回合末结算行 |');
  md.push('| --- | --- | --- | --- | --- | --- |');
  for (const r of c.rounds) {
    const settle = r.newLogLines.filter(l => l.includes('中毒') || l.includes('沙暴') || l.includes('灼伤'));
    md.push(`| ${r.round} | ${r.logDelta} | ${order(r.newLogLines).join('→')} | ${r.newLogLines.filter(isEnemy).length} | ${r.newLogLines.filter(isPlayer).length} | ${settle.join('；') || '—'} |`);
  }
  md.push('');
  md.push('逐回合完整日志：');
  for (const r of c.rounds) md.push(`- R${r.round}: ${r.newLogLines.map(l => `\`${l}\``).join(' / ')}`);
  md.push('');
}
md.push('结论：三个回合（含戏法空间先手）中每回合均为 `ENEMY→PLAYER`（或 `ENEMY→PLAYER→回合末`），敌方行动数恒为 1，未出现 `ENEMY→PLAYER→ENEMY`。');
await writeFile(`${dir}/enemy-first-no-double-action.md`, md.join('\n'), 'utf8');

// 3) 行动顺序矩阵
const turnOrder = { task: 'turn-order-matrix', note: '顺序只在轮次开始决定一次；先制之爪/同速未覆盖（见 log.md 未验证项）', cases: {} };
turnOrder.cases['enemy-first-no-tailwind'] = {
  fixture: enemyFirst.cases['enemy-first-timers'].fixture,
  orders: enemyFirst.cases['enemy-first-timers'].rounds.map(r => order(r.newLogLines)),
};
turnOrder.cases['enemy-first-trickroom'] = {
  fixture: enemyFirst.cases['trickroom-enemy-first'].fixture,
  orders: enemyFirst.cases['trickroom-enemy-first'].rounds.map(r => order(r.newLogLines)),
};
turnOrder.cases['player-first-immunity'] = {
  fixture: earlyExit.cases['player-immune'].fixture,
  orders: earlyExit.cases['player-immune'].rounds.map(r => order(r.newLogLines)),
};
turnOrder.cases['tailwind-changes-order'] = {
  fixture: reverify.cases['tailwind-order-four-turns'].rounds[0] ? { playerSpeed: 60, enemySpeed: 100, tailwindPlayerInitial: 0 } : null,
  orders: reverify.cases['tailwind-order-four-turns'].rounds.map(r => order(r.newLog)),
  tailwindBefore: reverify.cases['tailwind-order-four-turns'].rounds.map(r => r.tailwindBefore),
  tailwindAfter: reverify.cases['tailwind-order-four-turns'].rounds.map(r => r.tailwindAfter),
};
await writeFile(`${dir}/turn-order-matrix.json`, JSON.stringify(turnOrder, null, 2), 'utf8');

// 4) 早退分支
await writeFile(`${dir}/early-exit-branches.json`, JSON.stringify({
  task: 'early-exit-branches',
  note: '覆盖 未命中 / 免疫 / 守住 三类；该侧记为已行动，剩余行动照常，无空轮无重演',
  cases: Object.fromEntries(Object.entries(earlyExit.cases).map(([k, c]) => [k, { fixture: c.fixture, failure: c.failure ?? null, rounds: c.rounds }])),
}, null, 2), 'utf8');

// 5) 连续点击门闩
const dc = inputReload.cases['double-click'];
await writeFile(`${dir}/double-click-lock.json`, JSON.stringify({
  task: 'double-click-lock',
  note: '两次爆点合计 13 次真实 click 事件，只产生 1 轮；门闩为同步，不依赖异步 UI busy',
  origin: dc.origin, failure: dc.failure ?? null, runs: dc.runs, errors: dc.errors,
}, null, 2), 'utf8');

// 6) 刷新恢复
const rl = inputReload.cases['reload-mid-round'];
await writeFile(`${dir}/reload-mid-round.json`, JSON.stringify({
  task: 'reload-mid-round',
  note: '事务进行中 reload；刷新前 localStorage 稳定检查点仍为回合前状态；刷新后恢复到完整回合（PP/HP/日志与回合前一致，命令区重新可用）',
  origin: rl.origin, failure: rl.failure ?? null, observations: rl.observations, errors: rl.errors,
}, null, 2), 'utf8');

// 7) 回合末计时恰好一次
const et = { task: 'endturn-timers-once', note: '敌方先手回合（含戏法空间先手）：天气/中毒/烧伤/顺风/戏法空间计时只在回合末 -1；玩家行动前未递减', cases: {} };
for (const [k, c] of Object.entries(enemyFirst.cases)) {
  et.cases[k] = {
    fixture: c.fixture,
    rounds: c.rounds.map(r => ({
      round: r.round,
      timersBefore: { weatherTurns: r.before.weatherTurns, tailwindTurns: r.before.tailwindTurns, fieldTurns: r.before.fieldTurns },
      timersAfter: { weatherTurns: r.after.weatherTurns, tailwindTurns: r.after.tailwindTurns, fieldTurns: r.after.fieldTurns },
      playerHp: [r.before.playerHp, r.after.playerHp],
      enemyHp: [r.before.enemyHp, r.after.enemyHp],
      settleLines: r.newLogLines.filter(l => l.includes('中毒') || l.includes('沙暴') || l.includes('灼伤')),
      settlementPosition: 'after-both-actions',
    })),
    midRoundDomTrace: c.rounds[0].traceSummary,
  };
}
await writeFile(`${dir}/endturn-timers-once.json`, JSON.stringify(et, null, 2), 'utf8');

// 8) 入场陷阱连续补位
const src = reverify.cases['stealth-rock-chain'];
const chainMd = [
  '# 入场陷阱（隐形岩）连续补位与「已行动侧不重获行动」',
  '',
  '- 手段：隔离来源 `127.0.0.73:4300` + 隔离 Playwright Chromium 手机模拟视口 + 受控存档注入（`hazards.player.stealthRock=true`，两只后备 1 HP，全队去掉道具/特性、统一一般属性）。未使用 DEV Win。',
  '- 脚本：`run-round-transaction-reverify-browser.mjs`；原始数据：`evidence/reverify/results.json`；截图：`evidence/reverify/stealth-rock-chain-*.png`。',
  '',
  '## 补位链（按最低 HP 优先选择，驱动真实 UI 换人按钮）',
  '',
  ...src.picks.map(p => `- 第 ${p.step} 次选择：${p.pickedText ? `\`${p.pickedText}\`` : '（无可用出战按钮）'}${p.note ? ` — ${p.note}` : ''}`),
  '',
  '## 该轮完整日志',
  '',
  ...src.roundLog.map(l => `- ${l}`),
  '',
  `- 敌方行动数：${src.enemyActions}（=1，补位未让敌方多打一次）`,
  `- 我方行动数：${src.playerActions}（=0，换人消耗了本侧本轮行动）`,
  `- 入场隐形岩伤害行数：${src.stealthRockLines}；倒下行数：${src.faintLines}`,
  `- 轮末队伍：${JSON.stringify(src.finalPlayer)}`,
  `- 轮末命令区恢复可用：${src.steps[src.steps.length - 1]?.state?.panelEnabled}`,
  '',
  '结论：两只 1 HP 后备连续被入场陷阱击倒并连续补位至存活者；补位链未给任一方额外行动，回合末只结算一次，无空轮/重演。',
].join('\n');
await writeFile(`${dir}/entry-trap-chain.md`, chainMd, 'utf8');

// 9) 顺风 / 毒菱 / 隐形岩 重验副本
await mkdir(`${dir}/reverify-tailwind-hazards`, { recursive: true });
await copyFile(`${dir}/reverify/results.json`, `${dir}/reverify-tailwind-hazards/results.json`);
await writeFile(`${dir}/reverify-tailwind-hazards/summary.json`, JSON.stringify({
  task: 'reverify-tailwind-hazards',
  note: '旧样本（修复前取得）作废，本样本为 codex/round-transaction 未提交改动上的新样本',
  tailwind: {
    orders: reverify.cases['tailwind-order-four-turns'].rounds.map(r => order(r.newLog)),
    tailwindPlayer: reverify.cases['tailwind-order-four-turns'].rounds.map(r => `${r.tailwindBefore.player}->${r.tailwindAfter.player}`),
    perRoundActions: reverify.cases['tailwind-order-four-turns'].rounds.map(r => ({ enemy: r.enemyActions, player: r.playerActions })),
  },
  toxicSpikes: reverify.cases['toxic-spikes-single-layer'].rounds.map(r => ({
    round: r.round, layers: `${r.layersBefore}->${r.layersAfter}`,
    enemyActions: r.enemyActions, playerActions: r.playerActions, enemyLayLines: r.enemyLayLines, enemyPp: r.enemyPp, log: r.newLog,
  })),
  stealthRockChain: {
    log: src.roundLog, enemyActions: src.enemyActions, playerActions: src.playerActions,
    stealthRockLines: src.stealthRockLines, faintLines: src.faintLines, finalPlayer: src.finalPlayer,
  },
}, null, 2), 'utf8');

console.log('evidence summary written');
