# .agents/ — PokeFactory2 多 Agent harness

移植自 [VibeGame](https://github.com/tettethu/VibeGame) 的 multi-agent 架构，按本项目 React + Go 技术栈与既有证据纪律改写。

## 结构

```
AGENTS.md                  # 总入口：orchestrator 手册（先读这个）
.agents/
  roles/                   # 8 个角色契约
    architect.md            #   技术方案 + 状态契约 + 验证计划
    programmer.md           #   按契约实现 + 静态自测
    auditor.md              #   静态审查（不运行游戏）
    player.md               #   真实实玩 + 证据
    designer.md             #   玩法规则与数值
    artist.md               #   美术与素材入库
    reviewer.md             #   目标级最终门禁（一次）
  skills/
    factory-build/SKILL.md  # 端到端多阶段开发工作流
  templates/               # 任务产物模板
    prd.md  plan.md  context.json
  goal.md                   # 当前目标（build 工作流使用）
  review-lock.json          # reviewer 持有
  logs/                     # reviewer 详细笔记
docs/tasks/<task>/          # 任务产物：prd / plan / log / context / evidence / runtime
```

## 与原版 VibeGame 的差异

| VibeGame | 本项目 | 原因 |
| --- | --- | --- |
| `vibegame` CLI + tmux 拉起 Claude Code/Codex | WorkBuddy 子 Agent（Agent 工具） | 运行环境不同；tmux 在 Windows 不可用 |
| `vibegame check .` | `npm run lint` + `npm test` + `npm run build` + `go test ./...` | 技术栈不同 |
| `vibegame play` / Runtime API / bot | Playwright 隔离脚本 + 真实前后端 | 前端是 SPA，不是自研 Phaser 引擎 |
| Phaser 引擎 spec | 本项目 `docs/公开版规则定稿.md` 等 | 引擎不同 |
| `assets/manifest.json` | `src/assets/**` + 素材脚本 | 资源体系不同 |

**保留的原版精髓**：角色所有权边界、`prd → plan → log → evidence` 契约链、Route A/B 路由、证据分级纪律、reviewer 常驻与一次性门禁、任务级上下文注入。

## 用法

**单任务**：读 `AGENTS.md` → 写 `prd.md` → 派 architect → 评审 → 派 programmer → auditor → player → 判定。

**多阶段目标**：加载 `.agents/skills/factory-build/SKILL.md`。

## 与既有文档的关系

本 harness **不替代** `docs/公开版开发与试玩验收总计划.md` 的阶段划分，也不替代 `docs/开发交接_2026-09-26.md` 的续接顺序；它是**执行机制**，规则真相仍在 `docs/公开版规则定稿.md`。
