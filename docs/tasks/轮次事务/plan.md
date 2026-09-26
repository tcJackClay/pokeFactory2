# 技术方案: 轮次事务（战斗轮次 P1 阻断修复）

> architect 拥有。≤300 行。每条规则与验证断言必须追溯到 `prd.md`。
>
> 本任务把一次玩家指令收敛成**一个轮次事务**：顺序只决定一次，每侧至多行动一次，回合末恰好结算一次。
> 构建在既有代码上：`useBattleController.ts`（控制战斗）、`presentEndTurnResolution.ts`（回合末提交）、`battle/engine/roundTransaction.ts`（本轮新增纯状态机）。
> 前序技术计划 `docs/tasks/单线工厂奖励/round-transaction-plan.md`；失效链已由 `toxic-spikes-boundaries-runtime.md` 实测证实。

---

## 1. 改动面

| 文件 / 函数 | 当前职责 | 本任务改动 |
| --- | --- | --- |
| `src/features/game/battle/engine/roundTransaction.ts`（未跟踪新文件） | 无 | **新增** 纯轮次状态机：`RoundTransaction` 类型 + 阶段迁移纯函数 + `executeRoundTransaction` 驱动循环 |
| `src/features/game/battle/engine/roundTransaction.test.ts`（未跟踪新文件） | 无 | **新增** `node:test` 状态转移测试（6 例） |
| `useBattleController.ts` → `handleAttack` | 内联选招/比序/敌方先手/回合末 | 改为构造事务并 `await executeRoundTransaction`，顺序只在轮次开始决定一次 |
| `useBattleController.ts` → `runEnemyAutoAction` | 执行敌方一整轮并 `setMainBattleTurn` | 返回 `'ACTED' \| 'SKIPPED'`；新增 `enemyLeadForTurn/enemyTeamForTurn/switchIndexOverride/targetHasActedThisTurn`，敌方**不再**在轮次内重选招 |
| `useBattleController.ts` → `commitRoundEndTurn` | （原为 `handleRoundEnd` effect 内联） | **抽出**为回调，用 `endTurnCommitted` 幂等门闩保证同轮只结算一次 |
| `useBattleController.ts` → `runSimplePlayerRound` | 无 | **新增** 供换人/道具/极巨化复用的「玩家先手」简单轮次 |
| `useBattleController.ts` → 导出 `useItem/switchPokemon/triggerBattleSpecial` | 直接执行 | 包为 `*InRound`，先过 `roundActionLockedRef` 同步门闩 |
| `useBattleController.ts` → 删除 `enemyTurn` effect、`previousTurnRef` 回合末 effect、`createEnemyActionGate` 依赖 | 两条失效主链 | **删除**；敌方行动与回合末只经事务 |
| `useBattleController.ts` → `addMessagesSequentially` | 逐条打印日志 | 每条前后校验 `roundTransaction.battleEpoch`，过期抛 `StaleRoundError` |
| `usePokeFactoryGame.ts` | 组装 view-model | **接线** 新增 `roundTransactionActive` state；纳入 `buildStableFactoryBattleResume` 稳定性判定 |
| `view-model/state.ts` | 战斗视图状态类型 | 新增字段 `roundTransactionActive: boolean` |
| `components/game-view/battle/BattleActionPanel.tsx` | 指令面板可用性 | `commandsEnabled` 纳入 `roundTransactionActive`（事务进行中禁用，补位选择除外） |
| `components/game-view/battle/BattlePokemonPanel.tsx` | 后备换人按钮 | `canSwitch` 在事务进行中仅允许补位选择 |

**与既有代码的关系**：**替换** 两条 effect 驱动的隐式状态机（敌方自动行动 / `ENEMY→PLAYER` 回合末）为**显式事务**；`resolveEndTurn`、`completeEndTurnResolution`、`executeTurn`、`resolveBeforeMoveChecksStep` 等纯逻辑**继承不改**，只改调用方与终态交接。`turn` 降级为**展示状态**，不再是「敌方还有一次行动」「可做回合末」的事实来源。

---

## 2. 数据流与状态机

事务标识 `{battleEpoch, roundId}`。`battleEpoch` 复用既有 `battleInstanceRef.current.epoch`（游戏状态/运行 ID/关卡变化或卸载时自增）；`roundId` 为 `nextRoundIdRef` 单调自增。二者共同构成「旧轮次回调不得写入新战斗」的判据。

阶段枚举（`RoundPhase`）：`SELECTED → FIRST_ACTION → (WAIT_REPLACEMENT) → SECOND_ACTION → (WAIT_REPLACEMENT) → END_TURN → DONE`。
每侧行动状态（`RoundActionStatus`）：`PENDING / ACTED / SKIPPED`。

驱动函数 `executeRoundTransaction(initial, {isCurrent, runAction, runEndTurn, onTransition})`：
1. 取 `currentRoundSide` → `beginRoundAction`（非法相位返回 null，循环退出）；
2. `await runAction(side)` → 若 `battleEnded` 则 `abortRound` 并返回；否则 `finishRoundAction` 记录 `ACTED/SKIPPED`；
3. 若该侧返回 `replacement`，先 `waitForRoundReplacement` 挂起，`await` 补位完成后 `resumeRoundReplacement`；
4. 两侧均非 `PENDING` 进入 `END_TURN` → `claimRoundEndTurn`（幂等）→ `await runEndTurn()` → 可选回合末补位 → `completeRound`；
5. 每个 `await` 后与每个阶段迁移前都用 `isCurrent()` 校验 `epoch/roundId/mounted/gameState`，过期即 `break`，不写任何新状态。

数据来源：`liveBattleStateRef`（队伍/HP）、`liveFieldRef`（天气/场地/计时/危害）为**同步真值**；回合末快照在 `commitRoundEndTurn` 内一次性读取并交由 `commitSnapshot` 同步提交。日志等待期间事务阶段不变。

---

## 3. 状态契约

> 每个字段必须真实可观测，且被至少一行验证计划消费。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `roundTransactionRef.current` | `RoundTransaction \| null` | 当前轮次事务（`battleEpoch/roundId/firstSide/phase/player/enemy/endTurnCommitted/waitingAfter`）；`null` 表示无进行中轮次 |
| `viewModel.roundTransactionActive` | `boolean` | 事务是否进行中；消费于 `BattleActionPanel` 指令禁用、`BattlePokemonPanel` 换人禁用、存档快照稳定性 |
| `roundActionLockedRef.current` | `boolean` | 创建事务时置真的**同步**门闩，防连续点击；完整回合或明确中断才解除 |
| `endTurnCommitted` | `boolean`（事务内） | 回合末幂等标记；保证天气/残余伤害/计时同轮只提交一次 |
| `replacementWaitRef.current` | `{promise, release} \| null` | 玩家补位等待句柄；`markAwaitingPlayerReplacement` 建，`releasePlayerReplacement` 解 |
| `battleEpoch` | `number` | 战斗纪元；变化即令旧 `{epoch, roundId}` 与旧日志 continuation 失效 |
| `turn` | `BattleTurn` | **展示**状态；事务进行中不由内部自由改写作为事实来源 |
| `isMessageProcessing` | `boolean` | 日志播放中；仅作 UI busy，不承担「恰好一次」保证 |
| 双方 HP / PP / 天气 / `weatherTurns` / `fieldTurns` / `tailwindTurns` / `hazards` | 既有字段 | 逐轮断言「PP 只扣一次」「计时只递减一次」 |

---

## 4. 验证计划

> 证据路径根为 `docs/tasks/轮次事务/evidence/`；静态证据写入 `log.md` 门禁输出。

| 断言（来自 prd.md） | 验证方式 | 文件路径 | 证据类型 |
| --- | --- | --- | --- |
| 一次指令 = 一轮；双方各行动/跳过一次；PP 只扣一次；回合末仅一次；下一轮只开放一次输入 | 静态：纯函数测试两先手分支 + 集成实玩逐回合点数 | `evidence/round-one-action-per-side.json` | 状态快照 |
| 敌方先手不出现 `ENEMY→PLAYER→ENEMY` 二动 | 运行：敌方先手实玩，记录双方行动序列与日志条数 | `evidence/enemy-first-no-double-action.md` + 截图 | 状态快照 + 截图 |
| 玩家先手 / 同速 / 先制之爪改变顺序：顺序只定一次、提示与顺序一致 | 运行：关先制之爪提示与首个行动者比对；同速两侧各跑一次 | `evidence/turn-order-matrix.json` | 状态快照 |
| 早退分支（未命中/守住/免疫/招式失败）：该侧记已行动或跳过，剩余行动照常，无空轮/重演/提前天气伤害 | 静态：`runAction` 返回 `SKIPPED` 的分支测试 + 运行逐分支实玩 | `evidence/early-exit-branches.json` | 状态快照 |
| 睡眠/冰冻/畏缩/混乱自伤：妨碍检查在该侧真正行动机会执行一次，不被敌方先手提前/重复推进 | 运行：敌方先手 + 我方睡眠，核对睡眠回合数只减一次 | `evidence/status-block-enemy-first.json` | 状态快照 |
| 第一行动击倒对手：补位后存活且未行动的原成员打**当前新目标** | 静态：`runAction` 后重读 `live.playerTeam/enemyTeam[0]` + 运行实玩 | `evidence/faint-first-action-retarget.json` | 状态快照 |
| 双方同时濒死：按胜负结算，不继续第二行动、不重复回合末 | 静态：`battleEnded → abortRound` 测试 + 运行实玩 | `evidence/double-faint.json` | 状态快照 |
| 入场陷阱连续倒下：连续补位至有存活者或全灭；已行动侧不因补位重获行动 | 运行：注入两层毒菱/隐形岩 + 1HP 后备，连续入场循环 | `evidence/entry-trap-chain.md` | 状态快照 + 截图 |
| 主动换人（玩家/敌方）：换人是该侧一次行动；对方已选招式结算到新成员 | 运行：玩家换人后敌方照常出招；敌方换人当成其行动 | `evidence/active-switch.json` | 状态快照 |
| 长日志：每个 `await` 后重核轮次标识；日志等待期不启动新轮次 | 静态：`roundTransaction.test.ts` 长日志异步用例 + 运行放慢日志实玩 | `evidence/long-log-epoch.json` | 状态快照 |
| 连续点击：创建事务即加同步门闩，不依赖异步 busy | 静态：`roundActionLockedRef` 早退断言 + 运行快速连点 | `evidence/double-click-lock.json` | 状态快照 |
| 刷新：旧轮次回调不写入新战斗；恢复上一**完整**回合，无半轮 PP/HP 漂移 | 运行：事务进行中刷新，比对刷新前后 PP/HP/日志 | `evidence/reload-mid-round.json` | 状态快照 |
| 关卡切换/卸载：旧 epoch 失效 | 静态：`roundMatches` 失配测试 + 运行换关 | `evidence/epoch-invalidation.json` | 状态快照 |
| 天气/中毒/烧伤/顺风/戏法空间计时：不在敌方先手后玩家未行动时递减，完成轮次时恰好一次 | 运行：敌方先手回合逐条比对计时字段，仅回合末 -1 | `evidence/endturn-timers-once.json` | 状态快照 |
| 顺风 / 毒菱 / 隐形岩 / 天气计时修复后必须**重验**（旧样本作废） | 运行：复用隔离脚本重跑，产出新样本 | `evidence/reverify-tailwind-hazards/` | 截图 + 状态快照 |
| 战斗中持有物被消耗/拍落：返还基准字段不受影响 | 静态：确认查重/返还仍读「本局返还基准」字段 | `evidence/held-item-baseline.json` | 状态快照 |
| 静态门禁 | `npm run lint && npm test && npm run build` | `log.md`（# Programmer 段） | 人工判断（门禁输出） |

验证方式分工：纯状态机断言走 `npm test`（`node --import tsx --test "src/**/*.test.ts"`）；hook/集成与边界实玩在 390×844 与 844×390 手机模拟视口执行，记录双方行动次数、PP、HP、日志与计时。

---

## 5. 不可自动验证的断言

- **「玩家感知没有二动 / 没有提前结算」**：无法纯静态自动化，靠逐回合日志与状态快照人工判读（证据类型=人工判断），由 player 兜底。
- **刷新恢复「上一完整回合」的语义**：需真实浏览器 reload，静态只能证明 `buildStableFactoryBattleResume` 的守卫条件；兜底为刷新前后快照比对。

占比 < 30%，PRD 断言写法可保持。

---

## 6. 风险与隐含决策

> orchestrator 必须在 programmer 开始前逐条批准。

1. **追认规则来源等级**：本任务机制在 `docs/公开版规则定稿.md` **无逐条用户可见规则**；其依据是 `round-transaction-plan.md` + `toxic-spikes-boundaries-runtime.md` 实测失效链 + 主线性宝可梦战斗语义。PRD 已声明此来源，故不按「发明机制」处理，但 traceability 等级为**实现口径**而非设计定稿。若 orchestrator 认为不足，需先补规则定稿。
2. **敌方换人视为先手**：`enemyActsFirst = (chooseEnemySwitchIndex > 0) || shouldEnemyActFirst(...)` 是本次新增语义（换人优先）。基线仅有 `chooseEnemySwitchIndex`（阈值 `hp>0.35` 才考虑），**顺序规则是本轮新选定**，需批准。
3. **早退分支未收敛**：`executeTurn` / `resolvePreTurnStatus` / `switchPokemon` / `useItem` 内仍有约 30 处自由 `setMainBattleTurn`，未按前序计划第 2 条统一为单点 `finishAction`。功能上因两条 effect 已删而不再产生二动/提前结算，但**结构目标未达成**。请批准「先保证行为正确、收敛留作收尾」或要求本轮一并收敛。
4. **`failed` 为 fail-closed 死锁**：事务失败时 `finally` 早退**不**清 `roundActionLockedRef` 与 `roundTransactionActive`，UI 指令持续禁用，需刷新。属隐含决策（以刷新换「绝不写入半轮」），需批准或改为可恢复。
5. **`runSimplePlayerRound` 的 `!consumed → battleEnded: true` 语义过载**：换人被拦（大闹/踩影）、特殊触发道具提示、极巨化石不匹配等**合法失败**会返回 falsy，被误判为「战斗结束」而 abort 轮次。需批准按「SKIPPED 不结束战斗」修正。
6. **玩家侧讲究头带锁招拦截被删**：基线 `handleAttack` 的锁招提示/拦截（两处）被移除，且 `BattleMovesPanel` 无对应禁用 UI，锁招对玩家侧可能失效。属**行为回退**，需批准补回。
7. **死代码**：`enemyActionGate.ts` 及其测试已无引用。需批准删除或保留说明。
8. **epoch 变化强制 `setIsMessageProcessing(false)`**：新增 effect 在战斗切换时强制清 busy。若合法日志仍在进行，可能提前解锁 UI，需确认无副作用。

---

## 7. 当前实现进度盘点

> 基于隔离工作树 `codex/round-transaction`（基线 `50fece7`）实地核查：5 个已修改文件 + 2 个未跟踪新文件，`+399 / -241`。

### 逐文件状态

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `battle/engine/roundTransaction.ts` | **已完成** | 类型、阶段迁移纯函数、`executeRoundTransaction` 驱动循环、`isCurrent` 废弃、`battleEnded` 中止、`replacement` 挂起/恢复齐备 |
| `battle/engine/roundTransaction.test.ts` | **部分完成** | 覆盖两先手各一次、替换不吞行动、epoch/roundId 失效、长日志异步、击倒跳过+全灭、epoch 异步失效；缺 END_TURN 后补位、`claimRoundEndTurn` 双重提交、非法相位、连续两轮早退 |
| `useBattleController.ts` | **部分完成** | 已完成：删除 `enemyTurn`/回合末两条 effect（**二动与提前结算主链已断**）、`handleAttack` 单事务化、`runEnemyAutoAction` 结果化、`StaleRoundError` 日志校验、`commitRoundEndTurn` 幂等、同步门闩、补位等待句柄、setter 写回 `liveBattleStateRef`。未完成：早退分支未收敛（风险 3）、`failed` 死锁（风险 4）、`!consumed` 语义（风险 5）、锁招拦截缺失（风险 6） |
| `usePokeFactoryGame.ts` | **已完成** | `roundTransactionActive` state + 传参 + `buildStableFactoryBattleResume` 守卫 + view-model 暴露 |
| `view-model/state.ts` | **已完成** | `roundTransactionActive: boolean` |
| `BattleActionPanel.tsx` | **已完成** | 指令禁用纳入 `roundTransactionActive`；附带 `|| 队长已倒下` 放行补位选择（隐含决策，随风险 4 一并裁定） |
| `BattlePokemonPanel.tsx` | **已完成** | 事务进行中换人仅限补位选择 |

### 与既有计划的偏离

- 前序计划要求「所有终点统一返回结果、不在分支自由 `setMainBattleTurn`」——**未完全执行**（风险 3），但失效链的行为级目标已由「删除两条 effect + 事务唯一驱动」达成。
- 前序计划未提及「敌方换人算先手」「`failed` fail-closed」「`!consumed` 语义」——均为实现期新增，已上升为风险项。

### 剩余的确定性收尾清单

1. 收敛 `executeTurn` / `resolvePreTurnStatus` / `switchPokemon` / `useItem` 内的 `setMainBattleTurn`，全部经事务 `onTransition` 或单点 `finishAction`。
2. 修正 `runSimplePlayerRound` 返回语义：合法失败 = `SKIPPED`（不结束战斗），战斗结束单独判定。
3. 恢复玩家侧讲究头带锁招提示/拦截（或补等价 UI 禁用）。
4. 裁定 `failed` 行为：释放门闩并提供恢复路径，或明确 fail-closed 并写入玩家可见指引。
5. 删除或说明 `enemyActionGate.ts` 及其测试。
6. 核对 `targetHasActedThisTurn` 在畏缩/二段效果上的真实语义（先手侧传 `enemyActsFirst`，简单轮次敌方传 `true`）。
7. 补齐 `roundTransaction.test.ts`：END_TURN 后补位、幂等、非法相位、`finishRoundAction` 侧不匹配。
8. 静态验证刷新链（`buildStableFactoryBattleResume` 在事务进行中恒返回 `null`）。
