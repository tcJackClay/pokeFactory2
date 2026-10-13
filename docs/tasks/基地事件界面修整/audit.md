# 独立静态审计：基地事件界面修整

2026-10-14；auditor。候选 `cdf289da8cac7b94addae27d4502d20c7789a86a`，基线 `fdbf4e7`，工作树 `D:/Games/pokeFactory2-worktrees/base-event-ui`。

## 裁决

**BLOCKED：A1 正常基地入口的推荐会被新上下文保护错误拦截。** 四项静态门禁通过不覆盖此实际路由语义。未改业务源码、未提交、未启动服务、未运行游戏；候选仍为 cdf289d。

## A1 — 推荐保护遗漏 BASE / EVENTS 合法路由（P1）

- 违反 PRD F2/E2/E3、plan §4.2：推荐应在当前事件页有效，只有离场、手动选择变化、续局等情况下作废。
- `StartScreen.tsx` 的事件入口调用 `openBaseTab('EVENTS')`；真实 `usePokeFactoryGame.ts:1182–1186` 设置 `currentBaseTab='EVENTS'` 和 `gameState='BASE'`。
- `GameView.tsx:194` 在上述合法状态渲染 `EventsScreen`。同一项目还支持 `gameState='EVENTS'` 的独立路由；既有 `isDispatchContextCurrent`（控制器第 280–283 行）明确接受这两者。
- 新 `EventsScreen.tsx:131` 却把 `latest.current.gameState !== 'EVENTS'` 一律视为 blocked。由基地正常进入后，点击推荐，`ensure` 完成后必早退，既不推荐也不显示无匹配或失败结果。
- 早退同时保留第 128 行设置的 `recommendation.status='loading'`；第 301 行会据此禁用所有地区的推荐按钮，直到手动清除/更改选择或离场。
- 现有第六项 helper 测试只传入已计算的 blocked 布尔值，未验证生产界面的合法路由判定，因此 339 项通过不能排除此错误。

### 修复与复审要求

由实现者在本页所有权内对齐现有双路由语义：接受 `EVENTS`，或 `BASE` 且 `currentBaseTab='EVENTS'`；最新上下文及失效依赖须覆盖 currentBaseTab，保留原 mounted、操作序号、选择/Owned 签名与续局保护。不要只放开全部 BASE 场景。补充有实际语义的双路由和 BASE 其他 tab 失效验证；重新冻结候选后审计，player 通过真实基地入口验证 Auto 成功/无匹配/失败可重试及离场迟到路径。

## 其他已核对内容

- 改动只涉及批准的七个业务文件；共享控制器、saveManager、pokedexClient、派遣配置、types、uiStrings、index.css、战斗引擎均无 diff。
- 摘要自动请求全部当前选中 ID，picker 与推荐按需请求 Owned；按 ID 显示 loading/error/ready，无选择单独派生，不再把缺失快照当不匹配。返回部分结果、错误 ID 或空类型会转为对应 ID error。
- helper 的 pending Promise 去重、增量合并、显式失败重试、finally 收尾和 disposed 抑制通知路径正确；失败不会因渲染依赖重复自动请求。底层 fetchDexSnapshots 吞单只失败并返回部分字典的实际语义已核对。
- hook 每次 effect setup 新建 store；StrictMode cleanup 不会复用已 disposed 实例。现有单测覆盖容器生命周期，不等于已跑 React StrictMode 实际挂载；后者仍需 player 验证。
- 手动清除/选取与返回基地同步 cancel，选择/Owned/续局变化 cancel，结果按 render 当前 ID 读取；上述保护保留，但 A1 路由条件须修正。
- 派遣/领取/开发预览仍调用既有动作，未改概率、资源、永久登记和事务顺序；可续局时原修改按钮继续 disabled，只读资料重试允许。部分加载失败不从残缺池推荐符合批准方案。
- 页面独立 `baseEventCopy` 是已批准接口隔离；简中/繁中/英自有文案、地区英文映射与动态原文边界一致。未删 lastResult、popup.message、等级、派遣要求或实际时长；普通页面 Mock 开关和引导删除，Settings 开发开关及门控预览保留。
- CSS 全部位于页面命名空间，状态/伙伴改为正常占位，原主操作/四入口/结束确认保留；不对视觉可读、尺寸、滚动触达作静态 PASS 声明。

## 独立门禁

| 命令 | 结果 | 本次原始日志 |
| --- | --- | --- |
| `npm.cmd run lint` | PASS，exit 0；构建结束后独立运行 | `audit-lint-after-build.log` |
| `npm.cmd test` | PASS，339/339，exit 0 | `audit-test.log` |
| `npm.cmd run build` | PASS，exit 0；主 chunk 594.75 kB 警告保留 | `audit-build.log` |
| `go test ./...` | PASS，exit 0 | `audit-go.log` |
| `git diff --check fdbf4e7..HEAD` | PASS | 本次命令输出 |

审计工具注意：首次将 lint 与 build 并行运行，现有 tsconfig 开启 allowJs 且没有 include/exclude 限定，tsc 默认枚举 dist；Vite 同时清理重建 dist 造成 TS6053“文件不存在”。保留 `audit-lint.log` 作为失败记录；构建停止后独立 lint 通过，确认是门禁调度冲突。本仓以后将 lint/build 串行运行。未为此修改配置，也未掩盖首次失败。

## 交给后续 player 与保留边界

修复 A1 后再按 V1–V8，用最终冻结提交真实 Go/Vite 重验。重点为自然基地入口、冷摘要、单只失败重试、共享请求、推荐迟到/手动切换/离场/续局、合法领取回归，以及中英三视口和繁中抽查。共享 API 的成功缓存要求冷故障用全新 context。

动态结果原文、地区/地点/伙伴/属性繁中缺字段、全站语言、真实手机、自然球来源、岩狗狗资格、事件战完整恢复、生产和性能仍未由本片完成；本审计没有运行证据。
