# 状态招式命中独立静态审计

审计日期：2026-10-13。基线 `2022d20`，受审提交 `324530486c60217a36fe5cabe7a9ad79739efb56`，工作树 `D:\Games\pokeFactory2-worktrees\status-accuracy`。仅静态审查，未运行游戏、未启动服务或 Playwright，未改业务代码，未提交。

## 裁决

**BLOCKED：F1 的当前天气输入仍有一处旧闭包路径。** 四项静态门禁均通过，但不能据此忽略实际契约缺口。以下问题交 architect/orchestrator 路由，修复后需复审与 player 验证。

### A1：同回合第二行动的状态命中仍使用回合开始天气

- 位置：`src/features/game/hooks/useBattleController.ts:1194` 的 `calculateDamage` wrapper，向 `resolveDamageStep` 传闭包中的 `weather` / `fieldState`（约 1209–1210），而非当前 `liveFieldRef.current`。
- 静态链：`handlePlayerMove` 的同一次 `executeRoundTransaction` 通过当前回调完成两个行动；先手天气招式在 `executeTurn` 尾部调用 `setWeather`（2451），该 setter 同步更新 `liveFieldRef.current.weather`（496–500）。React 重渲染虽创建新回调，但不会替换已经执行中的 round 回调持有的 `executeTurn` / `calculateDamage`。
- 可判定场景：回合开始无天气，先手成功沙暴，后手对具有沙隐的对手使用普通数值命中的状态招式。新状态分支确实调用了 `resolveAccuracy`，但 wrapper 仍传 `none`，使 `getResolvedMoveAccuracy` 的沙隐 0.8 修正漏用。状态招式命中应取当前行动天气，违反 PRD F1/F3；此处也可见既有伤害路径的同类风险。
- 修复建议：由 architect 定义当前场地读取的窄幅接线，使第二行动获得第一行动已提交的天气；同时确认相关场地读取与副效果路径的边界。保留伤害分支 RNG 调用顺序。增加验证应覆盖同一回合先改变天气再读取，而非仅向纯函数手工传入正确天气。需要浏览器的部分交 player。
- 证据边界：这是从当前回调引用及状态 setter 得出的静态结论；没有伪称已用浏览器复现。非局部状态时序取舍未由 auditor 擅自修复。

## 已核对通过的静态部分

| 契约 | 审查结论 |
| --- | --- |
| F2 对敌状态命中 | 状态分支在合法保护/替身终态之后调用既有 `resolveAccuracy`；miss 返回双方效果许可 false，控制器 miss 早退在实际副效果及香草之前；PP 扣除仍在出招前部且仅一次。 |
| F3 数值与必中 | `accuracy=0` 保持零命中，null/显式 ignore flag/既有无防守与毒属性剧毒复用同一 helper；必中未跳过保护/替身。上述 A1 是动态天气输入例外。 |
| F4 目标类别 | 新 helper 仅对 status 生效；`user`、`user-field`、真实 `users-field`、天气/场地、`opponents-field`、明确 HAZE 免当前对手检查。`all-pokemon` 本身不免检，摇晃舞仍走个体检查；未知目标保守保留检查。 |
| F5 香草 | 复用实际负等级恢复、正等级保留、当前持有物与返还基准分离的既有路径。普通 miss/保护/替身在消费之前终止；既有王者盾牌接触惩罚与自身下降测试仍通过。 |
| F6 队伍快照 | `resolvePreTurnStatus` 两队参数改为必填并删除闭包 fallback；玩家调用传 live 两队，敌方调用新增当前 playerTeamForTurn；普通出招与简单轮次的敌方入口都显式传 live 两队。前置检查仅改行动者，非行动者队伍原样保留，因此后续使用传入对手队伍没有再次丢失前置变化。 |
| 伤害 RNG | 新分类 helper 对非 status 直接 false，且不调用 RNG。既有伤害分支条件和随机调用位置未移动；新增 accuracy 骰仅在对敌 status 路径。 |
| 范围 | 无存档结构、商店、气势头带或飞翔两回合机制改动；受审 diff 为任务文档与 6 个源码/测试文件。 |

新增纯引擎“前一行动状态保留”测试能证明输入正确快照时引擎不回滚，**不能单独证明 React 控制器接线**；必填类型与代码审查补足静态部分，AC8 仍须用修复前实际失败夹具复验。AC7、完整回合刷新、设备及真实视觉均未在本审计中获得运行通过。

## 独立门禁

均在受审工作树重新执行，不引用 programmer 的结果代替独立执行：

- `npm.cmd run lint`：PASS，退出码 0。
- `npm.cmd test`：PASS，302 tests / 302 pass / 0 fail / 0 skipped。
- `npm.cmd run build`：PASS，2241 modules；主 chunk 577.29 kB，保留超过 500 kB 的提示，不是此次命中修复的编译阻断。
- `go test ./...`：PASS；server 无测试，cmd/sync、assets、content、web 通过（Go 缓存结果）。
- `git diff --check 2022d20..HEAD`：PASS。

## 后续证据

修复 A1 并复审后，按 plan V1–V9 交 player 收集最终代码的真实 Go+Vite UI、受控场景与三种模拟视口证据。实体 Android Chrome、自然完整长局与生产环境不可由这些静态结果代替。
