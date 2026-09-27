# PokeFactory2 — Agent 团队协作章程（Orchestrator 手册）

> 本文件是该仓库的 Agent 协作总入口。任何 Agent 开始工作前先读本文件，再读自己被派的角色文件。
> 移植自 VibeGame (`tettethu/VibeGame`) 的 multi-agent harness，按本项目实际技术栈（React + Go）与既有证据纪律改写。

---

## 0. 项目事实速查

| 项 | 值 |
| --- | --- |
| 主工作区 | `D:\Games\pokeFactory2`，主分支 `dev` |
| 隔离工作树 | `D:\Games\pokeFactory2-worktrees\<task>`，分支 `codex/<task>`。**37 个工作树已于 2026-09-27 全部由 C 盘 `.codex\worktrees` 迁至 D 盘**（C 盘仅剩无关项目 `5885`）。操作禁忌见下方注 |
| 前端 | React 19 + Vite 6 + TS 5.8 + Tailwind 4；开发端口 `4300` |
| 后端 | Go 1.22；`go run ./backend/cmd/server`，端口 `3001`；健康检查 `/api/health` |
| 静态门禁 | `npm run lint`（tsc）· `npm test` · `npm run build` · `go test ./...` |
| 中文 | 所有中文文档/源码用 **UTF-8** |
| 禁止 | `git add .`（主工作区有大量未跟踪试玩证据）；未经允许 `pkill`；提交前不做静态门禁 |
| **推送 dev** | **必须用下方命令**，直接 `git push origin dev` 会挂死（见注） |

> **推送 dev 必须用这条命令**：
> ```bash
> GIT_TERMINAL_PROMPT=0 git -c credential.helper= -c credential.helper=store push origin dev
> ```
> 本机 PortableGit 系统级 gitconfig 设了 `credential.helper = helper-selector`，它会先做约 **28 秒的交互等待**再回落 store，导致普通 `push` 长时间无输出挂起（看起来像网络问题，实则 `ls-remote`/`curl` 都正常）。
> 只写 `-c credential.helper=store` **不够**——“`credential.helper` 是多值配置，`-c` 是追加不是替换”；必须先 `-c credential.helper=` 清空继承列表。凭据来自 `~/.git-credentials`。

> **工作树操作禁忌**（2026-09-27 迁移 37 个工作树时实测，违反会浪费数小时或造成数据丢失）
>
> 1. **不要用 `git worktree remove`**。本机实测删除约 5,000 个文件耗时 **383 秒**（≈74 ms/文件），一个工作树 6 分钟以上；37 个要 6 小时。正确做法：删掉工作树根的 `.git` 文件 → `git worktree prune` 解注册 → 在目标位置 `git worktree add`。实测**约 4 秒/个**。
> 2. **每个工作树的 `node_modules` 是目录联接**，指向 `D:\Games\pokeFactory2\node_modules`（主仓库）。递归删除**会穿透联接、删掉主仓库的依赖**。删工作树前必须先用 `rmdir "<工作树>\node_modules"`（**不带 `/s`**）只摘掉链接。
> 3. **`git worktree add <路径> refs/heads/x` 会得到 detached HEAD**（git 不把全限定引用当分支）。要传**短分支名**；已 detached 的用 `git symbolic-ref HEAD refs/heads/x` 挂回，不触碰工作区。
> 4. **批量删除文件用 Python `shutil.rmtree`**（实测 0.6 ms/文件）；`cmd rmdir /s /q` 经沙箱子进程拦截后约慢 100 倍。
> 5. 迁移工具与备份留档在 `D:\Games\pokeFactory2-worktrees\_migration\`（`migrate.py` / `manifest.json` / `backup\`），含全部未提交文件的 SHA256 与补丁。

**产口真相来源（优先级从高到低）**
1. 用户最新决定
2. `docs/公开版规则定稿.md`
3. `docs/tasks/单线工厂奖励/design.md`（奖励设计）
4. `docs/公开版需求矩阵.md`（覆盖面与证据等级）
5. `宝可梦对战工厂_项目设计框架_v1.md`（GDD 基线）

> `docs/公开版开发与试玩验收总计划.md` 与 `docs/技术差距与实施顺序.md` 含**已废止的旧规则**（双模式、逐场代币、Classic 奖励卡等），**不得作为实施依据**。

---

## 1. 角色与所有权

| 角色 | 拥有 | 不拥有 |
| --- | --- | --- |
| `orchestrator`（你） | 产品意图、`prd.md`、任务拆分与路由、方案评审、任务验收、对用户交付 | 详细技术方案、测试方案、写业务代码 |
| `architect` | `plan.md`（技术方案 + 状态契约 + 验证计划）、每任务 `context.json`、可复用 spec | 产品行为、改 GDD |
| `designer` | GDD / 规则定稿、玩家行为与数值、扩池名单 | 实现细节、像素尺寸、动画时序 |
| `programmer` | 按批准契约改代码、自测静态门禁 | 改需求、改契约、跑实玩 |
| `auditor` | 静态审查、spec↔code 对齐、安全局部修复 | **不运行游戏** |
| `player` | 真实前后端实玩、状态/视觉证据 | **不写实现代码** |
| `artist` | 美术产出、素材入库、manifest 注册 | 玩法设计 |
| `reviewer` | 目标级最终端到端门禁（一次） | 写代码、建任务、改设计 |

生命周期：
- **常驻**：`designer`、`artist`
- **任务级**：`architect-<task>` / `programmer-<task>` / `auditor-<task>` / `player-<task>`
- **目标级**：`reviewer`（全程一个，最后审一次）

角色文件在 `.agents/roles/*.md`。

---

## 2. 任务产物规范

每个任务一个目录：`docs/tasks/<task-name>/`

```
prd.md        # orchestrator 拥有：自包含的产品切片 + 边界情况（禁止发明机制）
plan.md       # architect 拥有：技术方案 + 状态契约 + 验证计划
log.md        # 只追加：# Programmer / # Auditor / # Player 依次追加
context.json  # architect 拥有：下游各角色要注入的参考文件清单
evidence/     # player 产出的截图、状态快照、运行记录
runtime.md    # player 拥有的运行记录（本项目既有惯例，保留）
implementation.md / audit.md / ...  # 既有惯例文件，可继续沿用
```

**硬规则**
- `prd.md` **不得发明机制**。每条玩法规则必须能追溯到规则定稿/design.md/GDD。缺机制 → 先改上游规则，再回来写 PRD。
- `plan.md` 每条断言必须能追溯到 `prd.md` 的 Feature Spec 或 Edge Case。
- `log.md` **只追加**，永不覆盖；顺序即工作顺序；标题不带时间戳。
- 模板见 `.agents/templates/`。

---

## 3. 流水线

```
orchestrator 写 prd.md
      ↓
architect 写 plan.md + context.json  →  orchestrator 评审（重点：验证计划可行性、风险项）
      ↓
programmer 实现（Route A: architect 自己写 / Route B: 独立 programmer）
      ↓
auditor 静态审查（vibegame check 的等价物 = npm run lint + npm test + npm run build + go test）
      ↓
player 真机/模拟实玩，收集状态与截图证据
      ↓
orchestrator 读证据判定 → 标记完成 → 回填需求矩阵
```

### Route A / Route B（谁写代码）

统计你把 `plan.md` 打回 architect **实质性**修订的次数（错字/格式不算）：

- **0–2 次 → Route A**：architect 直接实现。它已持有最完整的上下文。
- **>2 次 → Route B**：派新 `programmer`，只注入最终 `prd.md` / `plan.md` / `context.json`。

### 停下等待

派发后若你无别的事，**停下等**。不要轮询、不要 sleep。复杂任务常常需要 10–15 分钟。只有在有强证据表明队友卡住/跑偏时才打断。

---

## 4. 证据纪律（本项目最严格的一条）

**五种证据不可互相替代**：

| 等级 | 含义 |
| --- | --- |
| 静态已验证 | 类型检查/测试/构建通过，**无浏览器闭环** |
| 模拟浏览器实玩 | `docs/tasks/*/runtime.md` 记录的浏览器操作 + 指定视口（用 DEV Win 辅助须明说） |
| 受控注入实玩 | 用测试存档注入招式/数值后真实 UI 操作 |
| 实体手机 | 真机触控、地址栏、切后台 |
| 生产环境 | 真实服务、弱网/断网、部署与回滚 |

**硬规则**
- 「代码存在」「自动检查通过」「运行验收通过」是三个独立状态。
- 模拟视口 **≠** 实体手机；受控注入 **≠** 自然抽取。
- 旧提交的截图 **不能** 当当前提交的验收（代码一变，证据即失效）。
- 静态数量推导 **不能** 宣称已达发布状态。
- 用 DEV Win 辅助取得的胜利必须在记录里明说。

---

## 5. 任务哲学（brown-field）

本项目是 **brown-field**（大量既有代码 + 完整历史文档）：

- 沿**既有模块/文件所有权边界**拆分任务。
- architect 的调研很关键——不读既有架构的 Agent 会与它对抗。
- 只有修改面**不重叠**时才并行。**同一个战斗控制器禁止并发合并**。
- 不要过度拆分：简单逻辑一个 Agent 做完，问题交给 auditor/player 兜底。
- 并行是你的超能力，但前提是接口已定义并达成一致。

---

## 6. 用户交付格式

每次交付给用户的最终消息是**自包含交接包**（用户没有终端，只看你的消息）：

1. **做了什么** — 1–3 句白话，说玩家/项目的变化，不点名队友。
2. **可查看产物** — 绝对路径的可点击链接。
3. **如何验证** — 用户该看哪个页面/跑什么命令。
4. **已知问题** — 尚未修复的，避免用户被意外撞到。
5. **需要用户定夺的** — 具体问题或决策，不要写「你觉得怎么样」。

---

## 7. 当前主线优先级（2026-09-27 更新）

1. ~~**P1 阻断**：战斗轮次事务~~ ✅ **已完成并合入 `dev`**（`a435f1e`）：一次玩家指令 = 一轮，双方各至多行动一次，回合末恰好结算一次。静态门禁 + auditor + player 实玩均通过。**仍有未验场景**（同速/先制之爪、睡眠冰冻畏缩混乱、击倒重定向、双方同时濒死、实体手机触控），见 `docs/tasks/轮次事务/runtime.md` §12 —— 续接时不要把这些当已验。
2. **扩池 + 四卡生成**（进行中，**等待用户拍板**）：规则 8（战斗消耗道具不入池，已删代码）与规则 10（单一种类数量 1 + 替换/舍弃回池）已定稿；但四卡生成**实现**仍被决策表 **第 1、6、7 条**阻塞 —— `docs/tasks/扩池规则/decisions.md`。
3. **奖励检查点/UI 接线**：隔离分支 `codex/reward-item-ui`（已在 `D:\Games\pokeFactory2-worktrees\reward-item-ui`）与正式池、TM 准入接线，第 3/6 胜真实手机试玩。
4. **回填矩阵 + 规则定稿**，再走基地商品/实体机/生产。
5. **发布前**：素材/IP 权利审查单独完成，版权页不能替代权利依据。

> 规则优先级提醒：`docs/公开版开发与试玩验收总计划.md` 与 `docs/技术差距与实施顺序.md` 含**已废止**的旧措辞（双模式、逐场代币、Classic 奖励卡），**不得作为实施依据**。

详细续接顺序见 `docs/开发交接_2026-09-26.md`。
