# 轮次事务 运行时验收记录（player）

## 0. 运行环境

| 项 | 值 |
| --- | --- |
| 提交号 | `50fece7c66a8fecf4827957fc3f6db1b02416568`（基线 `50fece7`，**工作树未提交改动**即被验代码） |
| 改动指纹 | `git diff \| sha1` = `8dab81f9fe8d`；未跟踪 `roundTransaction.ts` + `roundTransaction.test.ts` 合并 sha1 = `049e2adec899` |
| 环境 | Windows 11，Node `v22.22.2`，Playwright `1.62.1`（`C:\Users\45186\.codex\skills\develop-web-game\node_modules\playwright`）|
| 后端 | `PORT=3001 go run ./backend/cmd/server`，`GET /api/health` → `{"runtime":"go","status":"ok"}` |
| 前端 | `npm run dev`（Vite 6.4.1，`--host=0.0.0.0`，端口 4300）|
| 存档 schema | `schemaVersion = 13` |
| 服务错误 | 后端日志无 4xx/5xx；所有用例 `errors: []`（无 pageerror / console error / http≥400）|
| 视口矩阵 | `390×844`（isMobile, hasTouch, dsf2）、`844×390`、`320×568`（基准采集时）|

**手段声明（强制）**

- 全部样本使用 **隔离来源**（`http://127.0.0.60~73:4300`）+ **隔离 Playwright Chromium（手机模拟视口）**，未触碰用户 `127.0.0.1` 存档。
- 所有用例的宝可梦/招式/HP/PP/场地/危害/异常状态均为 **受控存档注入**（基准 `evidence/base-save.json` 来自 `run-round-transaction-fixture-browser.mjs` 的**自然新档**：新档 → 选伊布 → 开始挑战 → 六选三 → 第一战 READY）。
- **未使用开发者 Win 辅助（未点 DEV Win）**；**未使用 DEV 面板/`devSetWeather` 等任何 DEV 写状态接口**；**未使用 eval 绕过游戏循环**（页面内注入的只有 DOM 只读轮询器与真实 DOM click/事件派发）。
- 所有驱动均为真实 UI 点击（`tap()` / 派发真实 `MouseEvent('click')` 给真实按钮）。

---

## 1. 基准存档采集

- 脚本：`run-round-transaction-fixture-browser.mjs`
- 结果：`evidence/fixture-results.json`；截图 `evidence/fixture-390x844.png`、`evidence/fixture-844x390.png`、`evidence/fixture-320x568.png`
- 产出：`evidence/base-save.json`（3,751,478 字节，schema 13）
- 起点：自然新档第一战，`stage=1`，我方 `[地鼠(50), 腕力(66), 小火龙(4)]`，敌方 `[大钳蟹(98), ?, ?]`
- 预期/实际：命令区 `data-enabled="true"` / 一致；三视口均无横向溢出（`scrollWidth == innerWidth`）；控制台与 HTTP 均无错误。

---

## 2. P1#1 敌方先手不出现二动

- 脚本：`run-round-transaction-enemy-first-browser.mjs`；数据 `evidence/enemy-first/results.json`；摘要 `evidence/enemy-first-no-double-action.md`；截图 `evidence/enemy-first/*-round{1,2,3}-390.png` 与 `*-fixture-ready-844x390.png`
- 起点（注入）：`enemy-first-timers` 我方速度 1 / 敌方速度 500，沙暴 `weatherTurns=5`，顺风 `{player:4,enemy:4}`，我方中毒；`trickroom-enemy-first` 我方速度 500 / 敌方速度 1 + `trick_room` 5 回合 + 我方烧伤。
- 操作：每回合点「战斗」→ 点第 1 个招式按钮（`enemy-first-timers` 固定「撞击」）。
- 断言口径：`battleLog` 增量中「对手的 X 使用了 Y！/…造成了 N 点伤害。」与「我方 X 使用了 Y！」的出现**顺序与条数**。

| 用例 / 回合 | 日志条数 | 行动顺序 | 敌方行动数 | 我方行动数 | 结论 |
| --- | --- | --- | --- | --- | --- |
| enemy-first-timers R1 | 7 | ENEMY→PLAYER→回合末 | 1 | 1 | 通过 |
| enemy-first-timers R2 | 7 | ENEMY→PLAYER→回合末 | 1 | 1 | 通过 |
| enemy-first-timers R3 | 7 | ENEMY→PLAYER→回合末 | 1 | 1 | 通过 |
| trickroom-enemy-first R1 | 5 | ENEMY→PLAYER→回合末 | 1 | 1 | 通过 |
| trickroom-enemy-first R2 | 5 | ENEMY→PLAYER→回合末 | 1 | 1 | 通过 |
| trickroom-enemy-first R3 | 5 | ENEMY→PLAYER→回合末 | 1 | 1 | 通过 |

R1 原始日志（`enemy-first-timers`）：`对手的 大钳蟹 使用了 抓！` / `对手的 大钳蟹 造成了 16 点伤害。` / `地鼠 使用了 撞击！` / `地鼠 造成了 8 点伤害。` / `地鼠受到了中毒伤害！` / `地鼠受到了沙暴的伤害！` / `大钳蟹受到了沙暴的伤害！`

**结论：通过。** 两个先手变体各 3 回合，敌方行动数恒为 1，未见 `ENEMY→PLAYER→ENEMY`；回合末结算行全部落在**双方行动之后**。

---

## 3. P1#2 回合末恰好结算一次（含不提前递减）

### 3.1 计时字段逐回合前后值（稳定检查点）

| 用例 | 字段 | R1 | R2 | R3 | 每轮变化 |
| --- | --- | --- | --- | --- | --- |
| enemy-first-timers | `weatherTurns` | 5→4 | 4→3 | 3→2 | −1 |
| enemy-first-timers | `tailwindTurns.player` | 4→3 | 3→2 | 2→1 | −1 |
| enemy-first-timers | `tailwindTurns.enemy` | 4→3 | 3→2 | 2→1 | −1 |
| trickroom-enemy-first | `fieldTurns.trick_room` | 5→4 | 4→3 | 3→2 | −1 |

残余伤害行数（`battleLog`）：中毒 1 行/轮、沙暴 2 行/轮（双方各 1）、烧伤 1 行/轮 —— 均为**恰好一次**。

HP 对账（证明只结算一次）：

- `enemy-first-timers` R1 我方 300→229 = 敌方 16（抓）+ 中毒 37（300/8）+ 沙暴 18（300/16）；敌方 300→274 = 我方 8 + 沙暴 18。
- `trickroom-enemy-first` R1 我方 300→267 = 敌方 15 + 烧伤 18（300/16）；R2 267→236 = 13+18；R3 236→203 = 15+18。

### 3.2 玩家行动前不提前递减（事务中途 DOM 时间线）

`enemy-first-timers` R1 页面内 DOM 只读轮询（120ms 间隔，命令行区 + HP + 消息面板文字）：

| t(ms) | 我方 HP | 消息面板 | 解读 |
| --- | --- | --- | --- |
| 4482 | 300/300 | 对手的 大钳蟹 使用了 撞击！ | 敌方出手 |
| 5802 | 287/300 | …造成了 13 点伤害。 | 只有招式伤害 |
| 7363 | **287/300** | …造成了 13 点伤害。 // 地鼠 使用了 撞击！ | **玩家尚未行动时：无中毒、无沙暴** |
| 10365 | 232/300 | 地鼠 造成了 8 点伤害。 // 地鼠受到了中毒伤害！ | 回合末结算才开始 |
| 13365 | 232/300 | …沙暴 // 大钳蟹受到了沙暴的伤害！ | 结算结束 |

**结论：通过。** 计时/残余只在回合末 −1，且玩家行动前**未**递减；截图为同一轮 `evidence/enemy-first/enemy-first-timers-round1-390.png`（我方 229/300，日志尾部为沙暴两行）。

---

## 4. P1#3 一次指令 PP 只扣一次

| 用例 | 我方 PP（撞击） | 敌方 PP（被使用者） |
| --- | --- | --- |
| enemy-first-timers R1/R2/R3 | 20→19→18→17 | 抓 20→19；头锤 20→19；抓 19→18（每轮仅该招 −1） |
| trickroom-enemy-first R1/R2/R3 | 20→19→18→17 | 撞击 20→19；抓 20→19；抓 19→18 |
| early-exit（3 变体）| 20→19→18 | 20→19→18 |
| double-click（8 连点 + 5 连点）| 20→19（两次爆点各 −1）| 头锤 20→19；再次 19→18 |

**结论：通过。** 每轮每侧参与行动的招式 PP 恰好 −1，未出现同轮 −2。

---

## 5. P1#4 早退分支

- 脚本：`run-round-transaction-early-exit-browser.mjs`；数据 `evidence/early-exit/results.json`；摘要 `evidence/early-exit-branches.json`；截图 `evidence/early-exit/*.png`

| 变体 | 该侧早退形式 | R1 日志 | 该侧是否记已行动 | 剩余行动 | 空轮/重演 |
| --- | --- | --- | --- | --- | --- |
| `enemy-miss` | 敌方命中率 0 → 未命中 | `对手的 大钳蟹 使用了 撞击！`/`对手大钳蟹的攻击没有命中！`/`地鼠 使用了 撞击！`/`地鼠 造成了 16 点伤害。` | 是（敌方 PP −1）| 我方照常出招并可命中 | 无 |
| `player-immune` | 我方一般属性打幽灵 → 免疫 | `地鼠 使用了 撞击！`/`似乎没有效果...`/`对手的 大钳蟹 使用了 撞击！`/`对手的 大钳蟹 造成了 10 点伤害。` | 是（我方 PP −1）| 敌方照常出招 | 无 |
| `enemy-protect` | 敌方守住（R2 守住失败）| R1 `…使用了 守住！`/`对手大钳蟹保护了自己！`/`地鼠 使用了 撞击！`/`大钳蟹保护了自己！` | 是（敌方 PP −1）| 我方照常出招（被挡下，PP 仍消耗）| 无 |

三个变体每回合 `logDelta` 恒为 4（两次出手 + 两条结果/伤害），无额外日志、无缺行。

**结论：通过。** 覆盖「未命中 / 免疫 / 守住」三类；早退侧一律记为已行动（消耗 PP），对侧行动照常，无空轮、无重演、无提前天气/中毒伤害（本轮未注入场地计时，见 §3 该结论由敌方先手用例独立给出）。

---

## 6. P1#5 连续点击只产生一轮（不依赖 UI busy）

- 脚本：`run-round-transaction-input-browser.mjs`；数据 `evidence/input-reload/results.json`；摘要 `evidence/double-click-lock.json`；截图 `evidence/input-reload/double-click-*.png`
- 起点：我方速度 1 / 敌方速度 500（敌方先手，单轮含 4 条日志、约 10s，窗口足够宽）

| 爆点 | 事件数 | 门闩时刻 `data-enabled` | 结果日志条数 | 敌方行动 | 我方行动 | PP 变化 |
| --- | --- | --- | --- | --- | --- | --- |
| 同步 burst（同一任务内 `dispatchEvent` ×8） | 8 | `true`（点击时 UI 尚未 busy）| 4 | 1 | 1 | 撞击 20→19 |
| 跨宏任务 burst（`setInterval` 25ms ×5，实际跨度 260ms） | 5 | 结束时 `false` | 4 | 1 | 1 | 撞击 19→18 |

13 次真实 `click` 事件合计只产出 **1 轮**（每轮 1 敌 1 我）。

**结论：通过。** 同步门闩 `roundActionLockedRef` 生效，在 UI `disabled` 尚未渲染时就已拦截重复指令；不依赖异步 busy。

---

## 7. P1#6 事务进行中刷新恢复到完整回合

- 数据：`evidence/input-reload/results.json` → `cases['reload-mid-round'].observations`；摘要 `evidence/reload-mid-round.json`；截图 `evidence/input-reload/reload-mid-round-*.png`

| 时刻 | 日志条数 | 我方 PP | 我方 HP | 敌方 HP | turn | 命令区 |
| --- | --- | --- | --- | --- | --- | --- |
| 回合前（稳定）| 0 | 撞击 20 / 跃起 20 | 300 | 300 | PLAYER | true |
| 事务进行中（刷新前 DOM）| — | — | 300/300 | 100% | — | **false** |
| 刷新后 | 0 | 撞击 20 / 跃起 20 | 300 | 300 | PLAYER | true |

事务进行中 DOM 已出现 `对手的 大钳蟹 使用了 拍击！`、命令区禁用、PP 面板仍 `20/20`（见截图 `reload-mid-round-mid-round-before-reload-390.png`）；**localStorage 稳定检查点仍为回合前值**（这是设计口径：`buildStableFactoryBattleResume` 在 `roundTransactionActive` 时恒返回 `null`，`getPersistableBattleResume` 回退到上一稳定快照）。

- 判定：`ppRestored=true`、`hpRestored=true`、`logRestored=true`、`enemyHpRestored=true`

**结论：通过。** 刷新恢复到**完整**回合起点，无半轮 PP/HP 漂移，刷新后命令区重新可用。

---

## 8. PRD 强制重验 #7 顺风行动顺序与四回合计时

- 脚本：`run-round-transaction-reverify-browser.mjs`；数据 `evidence/reverify/results.json`；摘要 `evidence/reverify-tailwind-hazards/summary.json`；截图 `evidence/reverify/tailwind-order-four-turns-round{1..4}-390.png` + `-fixture-ready-844x390.png`
- 起点：我方速度 60 / 敌方速度 100（**无顺风时敌方先手**），我方招式 `[顺风, 撞击]`

| 回合 | 行动顺序 | 顺风(我方) 前→后 | 敌方行动 | 我方行动 | 日志 |
| --- | --- | --- | --- | --- | --- |
| R1 | ENEMY→PLAYER | 0→3 | 1 | 1 | `对手的 大钳蟹 使用了 头锤！`/`击中要害！`/`造成了 15 点伤害。`/`地鼠 使用了 顺风！`/`地鼠一方吹起了顺风！` |
| R2 | **PLAYER→ENEMY** | 3→2 | 1 | 1 | 我方先手（顺风令速度 60→120 > 100）|
| R3 | PLAYER→ENEMY | 2→1 | 1 | 1 | — |
| R4 | PLAYER→ENEMY | 1→0 | 1 | 1 | 顺风在此回合结束后到期 |

**结论：通过。** 顺风施放后确实改变行动顺序（R1 敌方先手 → R2 起我方先手），计时 4→3→2→1→0，每回合仅 −1，四回合结束到期；每回合双方各行动一次。旧样本已作废，本样本在未提交改动上重取。

---

## 9. PRD 强制重验 #8 毒菱铺层（敌方一次行动不重复铺层）

- 起点：我方速度 1 / 敌方速度 500（敌方先手），**敌方唯一招式 = 毒菱**，我方只「跃起」

| 回合 | 我方场地层数 | 敌方行动 | 我方行动 | 敌方撒菱日志行 | 敌方 PP | 日志 |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | 0→**1** | 1 | 1 | 1 | 19 | `对手的 大钳蟹 使用了 毒菱！`/`对手大钳蟹在对手一方撒下了毒菱！`/`地鼠 使用了 跃起！` |
| R2 | 1→2 | 1 | 1 | 1 | 18 | 同上结构 |
| R3 | 2→2（上限）| 1 | 1 | 1 | 17 | `…使用了 毒菱！`/`但是失败了！`/`地鼠 使用了 跃起！` |

**结论：通过。** 敌方一次行动只铺 **1** 层（R1 = 1 层），未复现修复前「同回合 2 层」的重复行动/重复铺层；第三层按规则失败且 PP 仍只 −1。

---

## 10. PRD 强制重验 #9 隐形岩连续入场补位

- 脚本/数据同 §8；摘要 `evidence/entry-trap-chain.md`；截图 `evidence/reverify/stealth-rock-chain-{switch-list,after-switch1,after-switch2,after-switch3,round-complete}-390.png`
- 起点：`hazards.player.stealthRock = true`；两只后备各 1 HP；全队统一一般属性、无道具/特性（消除干扰）；我方速度 1 / 敌方速度 500
- 操作：点「宝可梦」→ 真实点击「出战」按钮换人（每次选**当前 HP 最低**的可出战者）

该轮完整日志：

```
你收回了 地鼠！
你派出了 腕力！
腕力受到了隐形岩的伤害！
腕力 倒下了！
你派出了 小火龙！
小火龙受到了隐形岩的伤害！
小火龙 倒下了！
你派出了 地鼠！
地鼠受到了隐形岩的伤害！
对手的 大钳蟹 使用了 撞击！
对手的 大钳蟹 造成了 13 点伤害。
```

- 敌方行动数 **1**（补位链未让敌方多打一次）
- 我方行动数 **0**（换人消耗了本侧本轮行动，**已行动侧不因补位重获行动**）
- 入场隐形岩伤害 3 行、倒下 2 行、连续补位 2 次至存活者（地鼠 300→250）
- 轮末命令区恢复 `data-enabled="true"`

**结论：通过。** 连续补位链完整（两次入场陷阱击倒 → 强制补位 → 存活者），无空轮、无重演、无额外行动。

---

## 11. 汇总产物

| 文件 | 内容 |
| --- | --- |
| `evidence/round-one-action-per-side.json` | 一次指令=一轮：逐回合行动顺序/计数/PP/计时 |
| `evidence/enemy-first-no-double-action.md` | 敌方先手不二动（含逐回合原始日志）|
| `evidence/turn-order-matrix.json` | 行动顺序矩阵（敌方先手 / 戏法空间先手 / 我方先手 / 顺风改序）|
| `evidence/early-exit-branches.json` | 未命中 / 免疫 / 守住 |
| `evidence/double-click-lock.json` | 连续点击门闩 |
| `evidence/reload-mid-round.json` | 刷新恢复 |
| `evidence/endturn-timers-once.json` | 回合末计时恰好一次（含事务中途 DOM 轨迹）|
| `evidence/entry-trap-chain.md` | 隐形岩连续入场补位 |
| `evidence/reverify-tailwind-hazards/{results,summary}.json` | 顺风 / 毒菱 / 隐形岩 重验新样本 |
| `evidence/base-save.json` | 自然新档基准存档（注入源）|

汇总命令（不驱动浏览器，仅归纳已采集 JSON）：

```bash
cd D:/Games/pokeFactory2-worktrees/round-transaction
node "D:/Games/pokeFactory2/docs/tasks/轮次事务/build-evidence-summary.mjs"
```

## 12. 未验证项（明确）

1. **统一速度/先制之爪改变顺序**：未注入同速与先制之爪样本；仅覆盖「敌方更快→敌方先手」「戏法空间→慢者先手」「顺风翻序」「我方更快→我方先手」。
2. **睡眠/冰冻/畏缩/混乱自伤** 的「妨碍检查只在该侧真正行动机会执行一次」：未构造该批状态样本。
3. **第一行动击倒对手后打新目标**（`faint-first-action-retarget`）与 **双方同时濒死**（`double-faint`）：未构造样本。
4. **长日志 epoch 失效 / 关卡切换或卸载**（`long-log-epoch`、`epoch-invalidation`）：未构造换关/卸载样本。
5. **持有物被消耗/拍落后的返还基准字段**（`held-item-baseline`）：未构造样本。
6. **敌方主动换人视为先手**：未构造敌方换人样本（只验证了敌方出招先手）。
7. **风险 4 的 `failed` 可恢复路径**（异常回滚后 UI 恢复）：未能人为触发事务异常路径，仅静态证据（Auditor 段）覆盖。
8. **实体手机触控**：未做，全部为桌面浏览器手机模拟视口。
9. **静态门禁**（`npm run lint/test/build`）未由 player 重复执行，以 `# Programmer` / `# Auditor` 段为准。
