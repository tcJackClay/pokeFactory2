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
