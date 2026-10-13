# 永久收藏口径：实玩记录

## 当前裁决：BLOCKED（b2d5863）

2026-10-14，player 以冻结提交 `b2d58630e8475e4dbbc6d5e3a024b75073ebce1f` 完成首轮验收，发现满队捕捉替换 UI 未挂载。已通知 orchestrator，并按其指示结束全部本任务浏览器操作，等待修复后的独立审计与新版本重跑。本文件不代表最终通过。

## 环境与手段

- 工作树：`D:/Games/pokeFactory2-worktrees/permanent-collection`。
- Go：工作树根执行 `PORT=3004 go run ./backend/cmd/server`，session 76907；Vite：4303 / 0.0.0.0，`GO_BACKEND_URL=http://127.0.0.1:3004`、`DISABLE_HMR=true`，session 63770。
- 浏览器：Playwright 自带 Chromium，具体版本逐案 `result.json.browser`；隔离 context，来源 `http://127.0.0.201:4303`，DPR 2 / touch / isMobile；主视口 390×844，UI 补 320×568、844×390，中英文。
- 真实 Go/Vite，既有本地 API/素材缓存，未限速；不是实体 Android、生产环境或 Codex 侧栏控制。未使用 DEV Win。
- R1/R3 是空存储起步的自然初遇、世代9选择、自然租借和首回合。R2 为定点 Storage.setItem 故障。其他明确使用受控 schema15 存档或故障/随机数。
- 夹具 `fixtures.mjs` 调用当前 `createSaveData` 生成并校验，使用本版自然首战产生的真实宝可梦数据；事件夹具持有一份受控合法派遣来源收据、READY 派遣与球，从 LOSS 结果页通过 UI 返回基地。进化复用历史真实数据形状，但通过当前 creator 重建，收藏采用本版字段与来源；没有只替换旧版本号。
- 派遣 RNG：第一次 .7 为 join / .99 为 battle / .1 为 item，随后 .001；捕捉成功 .001，概率失败 .99。这是覆盖路径用的全局受控 RNG，不能当自然概率统计。跨地区并发用两个真实按钮 DOM click 同步 burst，明确不是两根手指的实体触控。
- 游戏操作走按钮/触控；只读 React view-model 用于观察事件队伍/背包/日志（事件战不持久化完整检查点），不调用 view-model action 或修改内存状态。每个 `*.json.gz` 同时含原始主存档和观察状态。

## 实际产品阻断

`r7-catch-full-cancel` 与 `r7-catch-full-replace` 两次均：6名队员 → 事件捕捉成功 → 永久收据由1变2、球已扣1、`showReplaceUI.id=150`，随后 `gameState=EVENTS`。关闭调查奖励提示后，页面没有 `.pf-modal-sheet`，玩家无法替换也无法取消。观察状态与截图一致。检索只找到 `ReplacePokemonModal.tsx` 定义，没有组件挂载点。

证据：

- `evidence/final-b2d5863/r7-catch-full-cancel/03-success.json.gz`
- `evidence/final-b2d5863/r7-catch-full-cancel/failure.png`
- `evidence/final-b2d5863/r7-catch-full-replace/03-success.json.gz`
- 两目录 `result.json`、注入档与操作快照。

## 按验证计划逐项结果

| 项 | 结论 | 实际证据与剩余边界 |
| --- | --- | --- |
| R1 | PASS | `r1-natural-partner`：六候选浏览/改选，确认前Owned空，选择岩狗狗后Owned `[744]`、BP0；真实图鉴已拥有1。 |
| R2 | PASS | `r2-bind-failure`：写盘抛错不绑定，解除后伊布 `[133]`，reload保持。故障产生的console error是预期。 |
| R3 | PASS | 同R1的05/06：设置gen9、自然六选三、真实双方首轮；Owned仍 `[744]`、租借仅3只且无744。 |
| R4 | 部分通过 | `r4-rental-evolution`：真实兑换进化后Seen含新ID，Owned仅744，刷新保持。`r4-rental-swap`已点确认并出现训练家继续界面，但脚本等待stage2超时，尚未排完夹具/等待条件；不能算换怪验收通过。修复冻结结束后重跑。 |
| R5 | 部分通过 | `r5-r8-filter-import-layout`：Owned/搜索744/岩石/阿罗拉与关都筛选，导出后真实file input导入reload，Owned仍744。永久派遣记录同版导入、显式另一档替换及同物种租借去重未独立完成。 |
| R6 | 部分通过 | `r6-legacy`：v14收藏口径解释、下载原文精确一致、取消清除原文不变、确认清除回初遇。当前有效档导入旧档拒绝未完成。 |
| R7 | BLOCKED | 满队替换/取消不能操作。其他已通过子项见下表；迟到结果场景未完成。 |
| R8 | 部分通过 | 中英文基地/图鉴三视口都能经按钮进入返回，DOM无蛋/培育词且无横溢出，320图鉴拥有数可见。人工看图发现部分base截图抓在页面转场尚未完成（如en-base-844只有顶部状态栏），不能算完整视觉通过，需加稳定等待重拍。事件/设置全矩阵返回尚未完成。 |

### R7 已通过子项

| 目录 | 结果 |
| --- | --- |
| `r7-join-two-regions` | 两球连续关都、丰缘join：来源1→3、队伍1→3、球2→0，前次成员保留。 |
| `r7-single-ball-concurrent` | 同步点两地区领取，只有一笔收据新增、队伍1→2、球1→0，另地区仍READY。 |
| `r7-join-write-failure` | 存储失败保持球1/队伍1/来源1；解除重试后球0/队伍2/来源2。 |
| `r7-item` | 真实item分支增加成长道具，来源/队伍/球不误增减。 |
| `r7-catch-success-training` | 真实进入事件战、背包大师球成功：来源1→2、球2→1、队伍1→2，原成员HP EV增加且捕获成员保留；刷新永久Owned保持。 |
| `r7-catch-probability-failure` | 固定.99捕捉失败仍扣1球，来源不增加。 |
| `r7-catch-write-failure-retry` | 写盘失败不扣球、不加队、不增来源；仅投球日志，无敌方出招且己方HP不变；解除重试成功并刷新永久记录保持。 |

`r7-late-leave` 是 harness 未完成：真实按钮叫“返回主页”，脚本等待“返回”，延迟route触发了API超时；不当作产品迟到结果失败或通过。切入工厂/已有事件战的迟到运行场景尚未完成。

## 证据、错误和视觉复核

- 主目录 `evidence/final-b2d5863/`，每案 `result.json` 带前后关键收藏、完整操作页文本、浏览器版本、错误与HTTP，`*.json.gz`保存完整存档/运行状态，PNG为对应截图。
- 自然、正常join/catch、进化与图鉴正式样本HTTP>=400均0；故障注入案例记录预期 `PLAYER controlled storage failure`。未将受控console错误抹掉。
- 草稿另存 `evidence/harness-draft-*`，包含错误按钮文案、奖励弹窗内部点击未关闭等harness问题；首个草稿曾有 `/pokemon-species/1/` 502，正式重跑无该错误。草稿不能入最终通过清单。
- 人工打开复核：满队失败图、中文320图鉴、英文844基地。前两者支持相应结论，英文基地转场空白说明截图时机不合格，R8保持未通过。
- 暂不宣称自然获得可达：当前新档无自然球来源。事件战完整恢复断点与大师球95%上限仍是已声明缺口。

## 后续重跑要求

修复候选必须经独立审计、四门禁后冻结，再建立新SHA证据目录。R1–R8入口及所有受影响捕捉/替换/取消/训练/来源保存均按新代码重跑。补齐上表未完成项；旧证据仅作为缺陷历史，不支持新提交通过。player未改业务代码、未提交、未合入。
