# 永久收藏口径独立静态审计

- 审计日期：2026-10-14。
- 工作树：`D:/Games/pokeFactory2-worktrees/permanent-collection`。
- 最终代码：`7d6d177f8435d4458147414f2455955917012552`；任务差异基线：`a317686..HEAD`，包含先前 WIP 与上游合并后的完整代码。
- 裁决：**BLOCKED：两项队伍/耗材一致性缺陷需要修复后重审。**
- 本审计未启动游戏、开发服务或浏览器，未写业务代码、未提交。以下源函数执行为静态辅助验证，不是实玩证据。

## 阻断问题

### A1：捕捉成功后的训练写回会丢失刚捕捉成员

- 位置：`src/features/game/hooks/useBattleController.ts` 1599–1620；`src/features/game/hooks/usePokeFactoryGame.ts` 510–513、543。
- 捕捉成功先追加 `enemy` 到队伍，但 `useItem` 持有投球开始时的 `winBattle`，后续沿 `resolveBattleResult` → `onSuppressBattleResolved` → `awardDispatchTraining` 调用同一轮旧闭包。
- `awardDispatchTraining` 用闭包中的旧 `playerTeam` 算训练并直接 `setPlayerTeam(training.team)`。当所选派遣物种在原队伍中时，训练会覆盖刚捕捉后队伍。永久收据仍保留，但当前队伍丢失新成员，与 F3/plan §2.2 保留成功捕捉加队行为不符。
- 静态复现：通过 TypeScript AST 从实际源码提取 `awardDispatchTraining`，捕获旧队伍 `[25]`；将当前队伍设为成功捕捉后的 `[25,133]`；调用旧训练回调后得到 `[25]`。训练函数依赖采用可控 mock，只验证真实回调的快照写入方式；调用链另逐级读源码确认。
- 修复要求：让捕捉结算与训练基于最新队伍，保留捕捉/替换结果；增加实际回调路径回归，覆盖队伍有空位、训练目标在队伍内，以及满队替换边界。

### A2：跨地区同时领取可用一颗球获得两次收藏，并覆盖前一次加入成员

- 位置：`src/features/game/hooks/usePokeFactoryGame.ts` 1716–1750、1808–1810。
- `dispatchInFlightRef` 仅限制同一 `regionId`；事件页其他地区按钮仍可点击。两个地区的领取可以同时停在数据请求中。
- `resolveDispatchRegion` 在异步后用旧 `inventory` 找球、旧 `playerTeam` 算训练和队伍容量。第一次领取耗尽最后一颗球后，第二个旧闭包仍看到球并提交永久收据；`splice` 对已空背包无效。新增的直接 `setPlayerTeam(...)` 同时覆盖第一次已加入的成员。
- 静态复现：AST 提取实际 `resolveDispatchRegion`，令两地区的 `getProcessedPokemon` 分别延迟完成；初始队伍 `[25]`、背包一球；先完成 133 再完成 175。结果两次调用收藏提交、背包空、最终队伍 `[25,175]`，第一只 133 被覆盖。数据和存档依赖可控 mock，不代表真实事件实玩。
- 修复要求：跨地区领取须共用可保证背包/队伍一致性的执行与当前状态机制；避免其他地区迟到请求在事件战已开始后修改战斗队伍/覆盖事件上下文。补一球跨地区并发、两球连续合法领取的回归。

上述问题涉及 Hook 与控制器异步状态协作，已交 orchestrator 路由实现者；未以局部修补掩盖状态契约问题。

## 已核对的契约

- schema 15 拒绝旧版本并保留原文；额外 `ownedIds` 不赋予永久所有权。
- 来源收据校验派遣键、来源类型、地区与时间，重复收据幂等、冲突拒绝；初遇与收据并集派生 Owned。
- 全部主档写入口经过收藏序列化；旧快照保留来源与已完成派遣，显式 `replaceSaveData` 不混入当前档来源。
- 初遇成功写盘并回读后更新 UI；租借、换怪、租借进化通过统一 Seen 登记，未发现其他直接授予 Owned 的入口。
- join 成功保存前无球消耗、加队或成功弹窗；catch 提交失败走取消异常，不执行敌方行动；round 门闩覆盖同轮连点，首条日志后检查 epoch。
- 对 `a317686` 的控制器差异限于捕捉回调、取消与结束处理，上游状态命中、当前场地/队伍引擎修复保留。
- 图鉴 Seen/Owned 与原筛选取交集，新增文本提供简中/繁中/英文；Breed、蛋数、相关状态和 BaseTab 入口已移除。

## 独立四门禁

| 命令 | 结果 |
| --- | --- |
| `npm.cmd run lint` | PASS，退出码 0 |
| `npm.cmd test` | PASS，322/322，退出码 0 |
| `npm.cmd run build` | PASS，退出码 0；保留主 chunk 大于 500 kB 的警告 |
| `go test ./...` | PASS，退出码 0 |

自动测试通过不能覆盖上述异步快照问题；当前无捕捉成功后实际训练链与跨地区领取的对应回归。

## 保留的验收边界

- 自然新档无球来源、事件战无完整恢复断点、大师球受 95% 上限影响的旧矛盾维持 implementation 已记录的后续缺口，本审计未更改概率或新增赠球。
- 修复后需独立 player 验证最终代码，受控派遣/球夹具不能宣称自然流程已可达；模拟浏览器也不等于实体 Android Chrome。

## 返修复审：b2d5863

- 复审日期：2026-10-14。
- 冻结代码：`b2d58630e8475e4dbbc6d5e3a024b75073ebce1f`，开始复审时工作树干净。
- 复审差异：`7d6d177..b2d5863`，并核对原任务相关调用链与存档事务。上文 BLOCKED 保留为旧提交历史。
- **本版裁决：PASS（独立静态审计），可进入 player 最终代码实玩。** 未启动游戏/浏览器、未改业务、未提交。

### 原阻断关闭

1. **A1 已关闭。** 控制器 `setPlayerTeam` 本就同步更新 `liveBattleStateRef`；现在事件结算显式传入该最新队伍快照，`handleSuppressedBattleResolved` 将其继续传给 `awardDispatchTraining`。训练更新同步进入 `eventRuntimeRef`，不再读取投球开始前队伍。新增测试实际执行 `useItem → winBattle → resolveBattleResult → handleSuppressedBattleResolved → awardDispatchTraining`，确认捕获后的成员与训练共存且球消耗一次。
2. **A2 已关闭。** `dispatchInFlightRef` 改为全局同步布尔门闩，进入异步前设置、`finally` 释放。同一地区及跨地区请求不能同时领取。join 在数据请求返回后取最新 `eventRuntimeRef` 背包/队伍，在收藏提交成功后同步更新资源 ref，再调用 React setter；下一次旧回调也不能再次花同一球或覆盖此前加入成员。
3. **迟到派遣边界。** 请求返回后检查事件页、当前工厂互斥、事件战 active 状态；遇到已切换场景抛 `StaleDispatchError`，不写收藏、不消费资源，也不将 READY 标成领取完成。新事件战启动在释放领取门闩前同步设置 active。三项迟到结果测试分别覆盖新事件战、工厂及其他页面。

### 回归与未削弱契约

- 六项新增源码回调测试独立运行在全量测试中通过：捕捉完整链、跨地区一球、连续两球以及三个迟到结果边界。依赖使用 mock，不构成浏览器证据。
- 收藏保存仍先于捕捉扣球/队伍更新；提交失败/重复的 `ItemActionCancelledError` 与轮次同步门闩保持，首条异步日志后 epoch 检查保持。
- schema15、来源收据、显式导入和旧快照保护无本次改动；对应原有静态回归继续通过。
- 控制器本轮仅修改事件结算参数；上游命中、天气、当前队伍与场地逻辑无回退。
- 满队捕捉的永久登记不依赖替换操作，替换弹窗路径仍保留；实际选择/取消、视口与切场景表现交由 player 按原 R7 验证，不能从当前测试推称已经实玩。

### 本版独立门禁

| 命令 | 结果 |
| --- | --- |
| `npm.cmd run lint` | PASS，退出码 0 |
| `npm.cmd test` | PASS，328/328，退出码 0 |
| `npm.cmd run build` | PASS，退出码 0；既有主 chunk 大于 500 kB 警告 |
| `go test ./...` | PASS，退出码 0 |
| `git diff --check` | PASS |

自然球来源、事件战恢复断点与大师球旧上限仍是已声明后续缺口。此次 PASS 只关闭本任务静态质量门，不代表自然获得闭环、实体手机或公开发布验收通过。

## 满队捕捉修复复审：244738d

- 冻结代码：`244738de0f92fdb229aefae35f1d76330a08de9f`；审查 `b2d5863..244738d` 及实际捕捉/事件结算调用链。
- **本版裁决：PASS（独立静态审计），可由 player 重跑最终代码。** 先前 b2d5863 的满队运行失败是有效历史证据，不因静态通过而改写。
- 开始时 tracked 文件干净，存在 player 未跟踪 evidence/harness；未运行、修改或删除这些产物。未启动游戏/浏览器，未改业务，未提交。

### 修复核对

1. **真实页面挂载**：GameView 在有效/无存档且已绑定伙伴时，于 `EVENTS` 或 `BASE + EVENTS` 挂载真实 ReplacePokemonModal；`BATTLE` 无此挂载，避免结算/训练未完成就选择。弹窗本身对空候选返回 null。
2. **显示与滚动条件**：弹窗渲染六个成员按钮及取消按钮，含 dialog/aria-modal/标题关联。fixed、inset 与 12px 外边距约束可见区域；`.pf-modal-sheet` 的 `max-height: 100%` 配合新增 `overflowY:auto` 形成滚动容器。层级 160 高于事件结果弹窗 140。实际手机滚动与可点性仍需 player 验证。
3. **替换/取消幂等**：新事件回调读取最新 `eventRuntimeRef`；索引必须为整数且存在；事件战 active 或工厂互斥时拒绝。替换同步写当前队伍并清空 ref 候选，取消同步清空候选；同一旧回调连点不能再次换入。两条路径没有收藏提交、扣球、奖励发放或旧 rewardChoiceMade 修改。
4. **离场清理**：返回基地、切往其他基地页、启动/续接工厂均同步调用取消；页面 effect 兜底清理非战斗且非事件页的残留候选。新控制器/存档事务无本轮差异，既有成功保存顺序、失败不扣球、epoch 与旧快照保护保留。
5. **旧奖励替换路由**：viewModel 现在将 replacePokemon 指向事件专用回调。当前 REWARD 唯一路由为 FactoryItemRewardScreen，不再使用旧宝可梦奖励路径，因此本次改动没有切断当前批准的商店路径。

### 五项新增回归的证据范围

- 满队替换/取消从真实捕捉 → 事件结算/训练链进入，断言六人队、训练、Owned 对象、背包与提交次数不重复；继续调用旧替换回调验证候选已消费。
- 新战斗/工厂拒绝旧替换，离开事件同步清候选，均执行实际源码回调。
- SSR 测试提取实际 **GameView** JSX 函数，并导入实际 **ReplacePokemonModal**；仅把其他页面组件置空。覆盖 EVENTS、BASE+EVENTS 挂载及 BATTLE、空候选隐藏，并检查真实六成员/取消共七个按钮、候选名称、滚动和层级样式。它能发现遗漏父组件挂载，未把模态框 stub 成预期结果。
- SSR 不运行布局引擎、触摸或动画，不能替代新提交的满队弹窗实玩。

### 本版独立门禁

| 命令 | 结果 |
| --- | --- |
| `npm.cmd run lint` | PASS，退出码 0 |
| `npm.cmd test` | PASS，333/333，退出码 0 |
| `npm.cmd run build` | PASS，退出码 0；既有主 chunk 大于 500 kB 警告 |
| `go test ./...` | PASS，退出码 0 |
| `git diff --check` | PASS |

本轮无剩余静态阻断；待 player 对冻结提交重跑满队替换/取消及原验收清单，再由 orchestrator 验收。自然球来源、事件战断点与大师球旧上限的后续边界不变。
