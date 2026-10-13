# 状态招式命中：技术方案与验证计划

基线 `2022d20`；工作树 `D:/Games/pokeFactory2-worktrees/status-accuracy`。2026-10-13 orchestrator 已批准本方案及三项风险，实质性打回 0 次，按 Route A 实现；批准不代表运行验收完成。规则只来自本目录 PRD F1–F5、边界条件及 designer D1–D5；气势头带虽已另行定稿，仍不属于本任务。

## 1. PRD 一致性与调研结论

- F1/F2 与 D1、D4 一致；F3 与 D2 一致；F4 对应 D3 目标分类和 D4，明确要求本次修正对手保护/替身误挡自用、队伍与场地；F5 来自 D5 及现行香草规则。没有待自行决定的产品数值。
- `resolveDamage.ts` 状态分支先于共用 `resolveAccuracy` 返回，造成所有普通状态技不掷命中；保护与替身的 `moveTargetsUser` 仅判断 `target === 'user'`，会把部分场地目标当对手单体。
- `getMoveTarget` 读 `battleData.target → move.target → selected-pokemon`；转换器已把本地 override 放在 PokeAPI target 前。不能另读原始 target 覆盖这条优先级。
- `useBattleController.executeTurn` 在判定前显示出招并扣 PP。保护、顺风、两种陷阱、睡觉、替身及幽灵诅咒有专用早退路径；天气/地形则在正常动作尾部生效。此次不重写这些路径。
- 正常命中经 `applyMoveSecondaryEffects` 后才调用双方香草；未命中已有早退、中文日志和动作收尾。王者盾牌接触惩罚有独立香草入口，必须保留。

## 2. 改动面与技术决策

| 文件/函数 | 决策 | PRD 依据 |
| --- | --- | --- |
| `src/features/game/battle/engine/resolveMoveTargeting.ts`（新增纯辅助） | 输出状态技是否以对手个体作为命中/保护/替身检查对象。使用 `getMoveTarget/getMoveWeather/getMoveFieldState/hasMoveBattleEffect`，具体分类见下表；未知标签保守沿个体路径，不新增隐式绕过。 | F3/F4 |
| `battle/engine/resolveDamage.ts:calculateDamage` | 伤害招式保留既有分支次序及随机消耗。状态技单独按辅助分类决定对手防护；保护/普通替身阻挡保留现有终态。未被挡的对敌状态技调用已有 `resolveAccuracy`，失败返回 `isMiss:true` 且双方副效果许可均为 false；成功返回现有零伤害结果。自用/场地不调用对手命中、防护判定。 | F2/F3/F4 |
| `battle/engine/resolveMoveTargeting.test.ts`（新增）与 `resolveDamage.test.ts` | 分类表、真实转换目标、概率边界、绕过、阻挡和伤害回归。不能只测新 helper 自身；必须断言 calculateDamage 和效果组合的可见状态结果。 | AC1–AC4/AC6 |
| `features/game/lib/battleResolution.test.ts`、`battle/engine/resolveWhiteHerb.test.ts`、既有 `resolveControllerProtectionCollision` 测试 | 复用现有下降/香草与接触惩罚覆盖；必要时追加“命中结果许可→实际效果→香草”组合断言，确保旧序列化羽毛舞主效果 chance=0 仍正常，未命中不进入效果。 | F2/F5、AC5 |
| `hooks/useBattleController.ts` | 按新增 F6 修复敌方出招前置检查遗漏当前我方队伍：补传 currentPlayerTeam，将前置检查的两个队伍参数设为必填并删除旧闭包 fallback；仅两处调用，玩家侧已传齐。不给 PP 补扣，不改变轮次事务或保存结构。 | F1/F2/F6、AC8 |

### 目标分类（只用于 status；伤害招式保持既有行为）

| 真实目标/语义 | 对手命中与防护检查 | 代表/限制 |
| --- | --- | --- |
| `user`、`user-field` / PokeAPI 实际标签 `users-field` | 均跳过 | 冥想及本地 override 后的光墙/神秘守护等；自身条件继续由原效果处理。后两者是同一已批准己方场地语义的别名 |
| 已识别 `weather`、`fieldState`，或 `target === 'entire-field'` | 均跳过 | 求雨、戏法空间、场地；重复场地失败保留 |
| `opponents-field` | 均跳过 | 隐形岩、毒菱现有专用入口也保留，层数上限不改 |
| 明确 `effectId === 'HAZE'` | 均跳过 | 即使旧序列化 target 为 all-pokemon 仍按黑雾实际语义；其全场清等级仍由既有效果处理 |
| `selected-pokemon`、`all-opponents`、`all-pokemon` 及其余未分类目标 | 保留个体检查 | 摇晃舞不能因 all-pokemon 自动绕过。真实必中/null 只由 resolveAccuracy 决定，不能跳过保护/替身。不存在语义证据的 user-and-allies 等新标签不自行开放 |

普通状态技被替身挡下时，先返回已有阻挡结果，不先掷命中；保护仍优先。允许绕过替身/保护的个别招式继续由既有 `substituteInteraction` / `bypassProtect` 判断，声音标记不增加新一刀切规则。自用/场地成功时保留现有副效果许可，以便冥想与黑雾等走其原效果实现，不能借本次修改重写目标效果分发。

### 数据流

合法选择 → 既有前置检查 → 既有出招日志/一次 PP 扣除 → 专用招式早退或 calculateDamage → 状态目标分类 → 防护终态或共用命中 → 未命中早退 / 命中效果及香草 → 原轮次事务完成 → 完整回合保存。新辅助不持久化任何字段，不增加网络请求或新的随机源。

## 3. 状态契约

| 可观测字段/结果 | 位置与用途 | 消费验证 |
| --- | --- | --- |
| `Move.accuracy`、`battleData.target/effectId/ignoreAccuracyCheck/substituteInteraction/bypassProtect` | 静态输入与浏览器保存的 selectedMoves；记录真实源字段和夹具差异 | V1–V4 |
| `DamageCalculationResult.isMiss/blockedByProtect/blockedBySubstitute/applyUserSecondaryEffects/applyTargetSecondaryEffects` | 纯结算返回值，浏览器不声称直接可见 | V1–V4、V7 |
| `factory.battleResume.playerTeam/enemyTeam[].statStages`、`status`、`volatileStatuses`、`currentHp` | 完整回合后的实际能力、异常、保护/替身和生命值 | V1、V3–V7 |
| `selectedMoves[].pp/maxPp/currentPp` | 有效 PP = currentPp ?? maxPp ?? pp；首次出招允许 currentPp 未设置，结果必须持久化一次扣除 | V1、V5–V7 |
| `factoryHeldItemId/factoryEquippedHeldItemId` | 当前道具与下战返还基准分别取值，不能混用 | V1、V4–V6 |
| `factory.battleResume.weather/weatherTurns/fieldState/fieldTurns/hazards` | 场地作用、计时及每轮仅一次结算的可观测佐证 | V3、V6 |
| `factory.battleResume.battleLog/turn/stage/phase` | 每侧一次出招、单一失败原因、场景阶段与刷新前后比对；存档没有 roundId，不虚构此字段 | V1、V4–V8 |

## 4. 验证计划

所有静态测试由 programmer/auditor 执行；player 创建自身 harness、运行脚本和证据，不由实现者预写 evidence。下列目录是计划路径，尚未产出。AC1 的“轮次不增加”指没有额外轮次；合法一轮应正常完成一次。

| 编号 / PRD 断言 | 静态方式与文件 | 真实 UI 方式与证据路径 | 证据类型 |
| --- | --- | --- | --- |
| V1 / AC1、F2：双方普通状态技命中/未命中，目标效果与 PP 一致 | `resolveDamage.test.ts` 用确定随机源分别断言命中/未命中标志与效果许可；同一转换羽毛舞组合实际下降/香草；无需假定状态技伤害 | `evidence/status-player-hit/`、`status-player-miss/`、`status-enemy-hit/`、`status-enemy-miss/`。正常 READY 复制到独立来源，原始羽毛舞只将命中率受控为 100/0；双方各单一合法出招，保存一次 PP 消耗与前后日志。至少一个首次出招不注入 currentPp/maxPp，直接保留正文 pp。另有无香草命中样本直接观察下降 | 结果断言、夹具 diff、前后存档、截图 |
| V2 / AC2、F3：普通100受修正；No Guard、毒系剧毒、null、ignore flag 与数值0不同 | `resolveDamage.test.ts` 固定整数随机边界与命中/闪避等级；必中/null 以会抛错的 RNG 确保未调用；必中仍被保护/替身挡、毒免疫仍按原适用性；双方副效果许可正确 | V1 的 UI 100/0 只证明接线，概率/特性各组合由静态断言补足，不能把受控0描述为自然低命中抽样。至少一条真实 null 状态招式由 V3 界面生效记录 | 固定输入/结果表及 UI 代表证据 |
| V3 / AC3、F4：自用、天气、场地不被对手干扰；既有条件保留 | `resolveMoveTargeting.test.ts` 和 `resolveDamage.test.ts` 输入真实转换后的冥想/求雨；对手保护、替身与高闪避组合。黑雾 all-pokemon 与摇晃舞 all-pokemon 反例；已有陷阱重复、重复场地、能力上限的结果测试复用并运行 | `evidence/self-calm-mind/`、`field-rain/`、`self-cap/`；真实点击冥想/求雨，对手受控保护/替身/闪避，截图与 statStages/weather 对应。能力已到上限再施放不继续增长；无需把旧文案改成新规则 | 前后状态、日志、截图 |
| V4 / AC4、F4：普通目标被保护/替身阻挡，例外保留 | `resolveDamage.test.ts` 验普通羽毛舞保护/替身终态且无副效果；已有 bypassProtect/substituteInteraction 的代表保持；all-pokemon 摇晃舞不得自动绕过 | `evidence/status-protect/`、`status-substitute/`；目标初始无负等级且持香草；确认只有对应阻挡反馈、目标与香草不变、PP 一次扣除 | 状态/日志、截图 |
| V5 / AC5、F5：实际下降→香草一次，既有自降、接触与返还保持 | 运行 `resolveWhiteHerb.test.ts`、保护碰撞与自身蛮力现有结果测试；正等级不改、降至0不消费、装备基准保留 | V1 命中样本；`evidence/white-herb-self/`、`white-herb-kings-shield/`、`white-herb-next-battle/`。从受控合法检查点通过真实 UI 使用蛮力/接触王者盾牌，下一战经正常胜利及换怪/继续进入；不使用 DEV Win，复用商店 harness 的场景方式但重新取最终 SHA 证据 | 消耗/恢复/返还状态、顺序日志、截图 |
| V6 / AC6、F1/F2：无额外行动、完整回合保存与刷新一致 | 运行既有 roundTransaction/presentEndTurnResolution 测试，覆盖每侧一次/末尾一次和异常路径；不把组件内不存在的持久 roundId当断言 | `evidence/complete-round-refresh/`。双方行动各一次的日志增量，天气等可控回合计时只减一次；完成回合且可选招后刷新，比对 PP、能力、道具、HP、日志、阶段，不能重复一轮 | 静态调用计数、存档前后对照、截图 |
| V7 / AC6：伤害招式概率、PP 和顺序不回退 | 既有 resolveDamage / strikes / actionSelection 与战斗效果测试全跑；伤害命中/未命中 RNG 顺序不变 | `evidence/damaging-regression/`；复用自然招式正文，包含首次 currentPp 缺省及玩家命中后敌方未命中的一轮；并复核 player 报告的飞翔样本。证据若无法复现只记线索，不能称缺陷关闭 | 伤害/PP/日志快照 |
| V8 / AC7：最终代码真实服务与反馈可读 | `npm run lint`、`npm test`、`npm run build`、`go test ./...` 及独立 auditor PASS | `runtime.md`、`evidence/final-<sha>/` 或上述各目录的清单：Go+Vite 同工作树固定提交，主要390×844；320×568、844×390分别截未命中/保护/香草关键反馈。记录请求与console错误、操作、源码SHA、服务根、截图；受控夹具与未用DEV Win明确标注 | 服务记录、结果清单、截图人工检查 |
| V9 / AC8、F6：另一方 miss/hit 后前一方完整状态不回滚 | `engine.test.ts` 以首次 currentPp 缺省的真实结构派生第一行动结果，经过真实 resolveBeforeMoveChecks → calculateDamage 的 miss/hit → resolveEndTurn，断言先前 PP/能力/持有物保留、HP 只产生合法伤害/剩饭、计时仅一次；必填类型防再次遗漏任一队伍。该纯引擎测试不替代实际控制器接线复验 | `evidence/pp-miss-leftovers/` 与 `pp-hit-leftovers/`：player 复用冻结主线失败夹具，重新采集最终 SHA 的 15→14 后不回15轨迹、完整回合与刷新保存。此前记录 `D:/Games/pokeFactory2/docs/tasks/手机资源基线/pp-probe/` 为修复前证据，不能覆盖 | 流水线结果断言、DOM轨迹、快照、截图 |

### 运行夹具可行性与检查点

- 可复用 `docs/tasks/奖励商店/run-reward-shop-final-browser.mjs` 的独立 `127.0.0.<octet>` 来源与存档导入范式；本任务新 evidence 不覆盖历史目录。原始招式由当前真实 Go `/api/pokeapi/move/<name>/` 获取并保存关键字段与夹具变化。
- 确定 miss/hit 使用受控 `accuracy=0/100`，不是全局覆盖 Math.random；零/普通等级、去掉必中特性、无旧负等级，敌方只有一个合法招式以约束决策。保护由实际使用保护或在行动开始受控预置，必须记录预置范围和保护剩余时点。
- UI 点击后等出招/终态日志落盘且菜单可操作，再核对完整回合快照；不能在新日志第一行写入时马上当整轮完成。以双方本轮各一次出招及稳定落盘样本作为完成条件，避免沿用固定 sleep 判断。
- 下一战返还使用受控、可自然取胜的战次场景，公开记录数值/战次注入，不称完整自然七战；不改用户现有来源存档。
- 实体 Android Chrome 若无设备能力，只列未验；模拟视口不升格。全程运行时禁改源码/HMR，修复后重跑受影响场景。

## 5. 风险与评审重点

技术风险 3 项，无新增产品数值：

1. **目标分类兼容旧序列化数据**：只有已确认语义拥有免对手检查资格；尤其 HAZE 与 TEETER_DANCE 的 all-pokemon 对照必须进入测试。其他未知/未接入特殊招式仍单独登记，不扩大为完整原型兼容。
2. **PP 缺陷与新增 F6**：player 已以 miss-leftovers/hit-leftovers 证实回滚。根因是 runEnemyAutoAction 仅传 currentEnemyTeam，resolvePreTurnStatus 从旧闭包补我方队伍并无条件写回；敌方命中后正常伤害分支再次用正确队伍覆盖，掩盖了前一次回滚，未命中早退则留下旧值。orchestrator 2026-10-13 批准最小补传及必填约束；这是新实玩缺陷扩充，不计方案打回。飞翔两回合机制明确不扩入。
3. **真实 UI 状态稳定性**：日志逐行落盘且前端状态/存档时点不同；player 等完整回合后读取，刷新只用于已完成检查点。静态计数不能代替 UI 行为证据，受控样本也不能代替自然长局。

评审后 Route A 实现时，只改本方案对应引擎/测试及必要接线，完整静态门禁之后交独立 auditor，再交 player。状态字段或验收触发若实际不可观测，先修订方案，不在报告里虚构通过。
