# Architect

- 基线 `2022d20`；先核对 PRD F1–F5 与 designer D1–D5，创建 `plan.md` 和 `context.json`。
- 方案获 orchestrator 批准，实质性打回 0 次，Route A。
- 后续真实 UI 证实 PP 回滚，orchestrator 补 F6/AC8 并批准最小补传与必填类型方案；作为新增缺陷范围记录，未改上游玩法。
- 风险：旧序列化目标分类、PP旧快照覆盖、完整回合落盘时点。

# Programmer

- 修改：`resolveDamage.ts`、`useBattleController.ts`；新增 `resolveMoveTargeting.ts`；追加/新增 `resolveDamage.test.ts`、`engine.test.ts`、`resolveMoveTargeting.test.ts`。
- 决策：PokeAPI `users-field` 与设计表 `user-field` 作为同义己方场地识别，已报 orchestrator 获认可。气势头带、飞翔两回合、保存结构及未知特殊机制均未扩改。
- 静态门禁：lint PASS；302/302 测试 PASS；build PASS；Go 全套 PASS；diff check PASS。构建原有主 chunk 大小提示仍在。
- 已追加实施记录 `implementation.md`。没有执行浏览器或生成运行证据；待独立 auditor 与 player 完成 AC1–AC8。
