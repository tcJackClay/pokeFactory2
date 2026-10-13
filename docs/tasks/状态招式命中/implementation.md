# 状态招式命中实施记录

2026-10-13，基线 `2022d20`，`codex/status-accuracy`。orchestrator 批准 plan 后按 Route A 实现；F6/AC8 是同日新增的已复现旧快照缺陷扩充。

## 已实现

- 新增 `resolveMoveTargeting.ts`：状态招式按真实自身/己方场地/对方场地/全场或已识别天气、场地、黑雾效果，决定是否需要检查当前对手。支持项目 `user-field` 和 PokeAPI `users-field` 同义标签。黑雾旧序列化 all-pokemon 与摇晃舞 all-pokemon 分开；未知标签不默认免检。
- `resolveDamage.ts` 对敌状态技在保护/替身终态之外调用原有 `resolveAccuracy`；数值零会未命中，null/显式忽略与既有必中特性不消耗随机命中骰。未命中双方副效果许可关闭。伤害招式分支原判定位置与随机顺序保留。
- `useBattleController.ts` 修复敌方前置检查未传 currentPlayerTeam 的问题。此前该参数缺省会从本轮旧闭包复制我方队伍并写回；敌方命中后后续伤害分支覆盖掩盖了回滚，miss 早退则把已经消耗的 PP 保存回旧值。现补传当前队伍；两个队伍参数均为必填，删除 fallback。仅现有两处调用，不改 PP 扣除次数、结束回合、存档结构或飞翔机制。

## 验证

- `npm run lint`：PASS。
- `npm test`：302/302 PASS，新增 9 项测试。覆盖状态命中结果与双方真实副效果/香草组合、整数命中边界、无防守/毒系剧毒/null、保护替身与绕过、己方/全场目标、黑雾与摇晃舞区别、毒系剧毒不绕过钢系异常免疫，以及后一行动 miss/hit→回合末保留先前 PP/能力/持有物的纯引擎流水线。
- `npm run build`：PASS；仍有主 chunk 超过 500 kB 的构建提示，不在本次命中修复中进行包拆分。
- `go test ./...`：PASS（cmd/sync、assets、content、web；server 无测试）。
- `git diff --check`：PASS。

纯引擎流水线不执行 React 控制器，也不能替代实际浏览器旧快照回滚复验。必填参数是编译期调用约束；完整真实链仍交给 player 按 AC8 的失败夹具复测。修复前证据保留在主线 `docs/tasks/手机资源基线/pp-probe/`，不覆盖该目录。

## 未验边界

本轮只完成实现与静态自检，尚无独立 auditor 判定或本次代码的运行证据；未运行游戏。最终 player 需覆盖 plan V1–V9，包括首次 PP 字段缺省、双方命中/未命中、保护替身、冥想/求雨、王者盾牌香草、下战返还、完整回合刷新及三视口关键反馈。未知特殊目标、实体手机、自然长局与生产环境均未因本次测试获得通过。

## A1 复审修复

独立 auditor 对 3245304 判定 BLOCKED：保留的伤害/命中适配器读到了回合开始的 weather/fieldState。2026-10-13 orchestrator 批准按 F1 修复动作执行期输入，并补查状态效果适用性。

- 抽出 currentFieldDamage.ts，保留回调每次执行读取 liveFieldRef.current；只转传输入，不改引擎算法或 RNG 顺序。
- 副效果、前置状态检查、睡觉场地检查、行动间入场陷阱、顺风计时、属性免疫响应、天气治疗与重复场地判定均读取当前 ref。逐入口旧值→新值见 plan 的 A1 审计表。
- 初始 AI 选招和本轮先后手仍读选择时快照，不在回合中重排。当前场地 setter 和回合末原本已用即时 ref，保留。
- engine.test.ts 新增3项真实轮次/共用引擎回归：同一 retained resolver 先手沙暴→后手沙隐状态命中，两侧先后互换；雨与青草场地伤害变化且 RNG 抽取次数不变；先手薄雾→后手剧毒对接地保护、无场地/飞行目标正例，双方互换。
- 最新四门禁：lint PASS；305/305 tests PASS；build PASS（原有主 chunk 577.64 kB 提示）；Go PASS；diff check PASS。

上述是实现自检，不代替 auditor 复审或 player 最终 UI 场景。A1原审计报告与日志保留不覆盖；player还需补 plan V10 天气/薄雾代表流程，未逐项实玩的特殊场地交互留在证据边界。
