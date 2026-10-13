# Architect

- 基于固定源码与真实项目索引复现 50 TM、1076 工厂身份映射，制定 plan/context。
- orchestrator 0 次实质打回后批准 Route A；明确独立按需模块、严格身份、资格与售卖分离。

# Programmer

- Files modified: 新增 `scripts/generate_fixed_tm_runtime.cjs` 与测试、`src/features/game/data/fixedTm/` 类型/生成数据/资格/准入/按需入口及测试、任务 provenance/implementation；plan 记录批准状态。
- Decisions / deviations: 无玩法、价格或准入变化；不改 battle/save/shop/UI；全部 50 项 pending。生成器复用 extractor 导出函数，不更改研究 CLI 的 output 限制。
- Validation: lint PASS；npm test 302/302；build PASS；go test ./... PASS；固定资格测试9/9；有源 CJS 抽取/生成测试首轮10/10、0 skipped。
- Remaining: 等待独立 auditor；后续正文/效果/定价/交易/UI 与实玩均未完成，不把数据资格标为商店准入。

# Programmer

- 提交前发现 `core.autocrlf=true` 会破坏生成产物的跨工作树字节比较；经 orchestrator 批准加入局部换行规则。项目文本摘要标注并使用 LF 规范化，Rogue 源原始摘要保持不变。
- 增加 CRLF/LF 等价及正文变化拒绝的直接测试；随后完整重跑静态门禁与11项有源 CJS 测试。
- 第二轮最终结果：lint/build/go test PASS；npm test302/302；CJS11/11、0 skipped。另从 Git index 在新目录检出真实 CRLF/LF 输入与产物，再运行生成器 --check，PASS；未提交 ignored 复现副本。
