# 当前目标

## User Input

> 我现在需要的是继续参考 https://github.com/tettethu/VibeGame/tree/main 的多agents的架构和他所使用的skill，继续自动化开发该项目

（原文，永不编辑）

---

## 目标解读

把 VibeGame 的多 Agent harness 移植进本项目，并**用它继续自动化开发**，按 `docs/开发交接_2026-09-26.md` 的续接顺序推进到可发布态。

---

## Task Breakdown

### Stage 0 — Harness 落地（已完成）
- 产出：`AGENTS.md`、`.agents/roles/*`、`.agents/skills/factory-build`、`.agents/templates/*`
- 状态：done

### Stage 1 — 清 P1 阻断：战斗轮次事务
- 任务：`轮次事务`
- 完成状态：一次玩家指令 = 一轮；双方各至多行动一次；回合末恰好结算一次
- 前置：无
- 可并行：无（独占战斗控制器）

### Stage 2 — 奖励池与四卡生成
- 任务：`扩池规则`（designer，独立于 Stage 1，可并行）
- 任务：`四卡生成`（依赖 扩池规则；architect → programmer → auditor → player）
- 前置：无（`扩池规则` 可与 Stage 1 并行）

### Stage 3 — 奖励检查点/UI 接线 + TM 准入
- 依赖：Stage 2

### Stage 4 — 回填矩阵与规则定稿，补基地商品/实体机/生产
- 最终 reviewer 门禁

---

## Done When

- [ ] 一次玩家指令只产生一轮：双方各至多行动一次，回合末恰好结算一次
- [ ] 刷新恢复到最近的**完整**回合检查点，无半回合 PP/HP 漂移
- [ ] 顺风行动顺序、先制之爪/王者之证在轮次修复后重验通过
- [ ] 每队在最坏装备占用下仍能生成四张不同且可领取的奖励卡
- [ ] 第 3/6 胜奖励节点在模拟手机视口可完整走通（换怪 → 四卡 → 装备 → 下一战返还）
- [ ] `docs/公开版需求矩阵.md` 对应行回填证据等级
- [ ] `npm run lint` / `npm test` / `npm run build` / `go test ./...` 全部通过
