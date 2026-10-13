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
