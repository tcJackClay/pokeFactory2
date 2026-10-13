# 最终代码实玩：244738d

## 裁决

**PASS（本任务指定自然/受控模拟浏览器范围）**。2026-10-14，以 `244738de0f92fdb229aefae35f1d76330a08de9f` 全新浏览器 context 重跑，22 个功能场景通过，另有 2 个加载/布局观察场景。没有用 b2d5863 的旧 PASS 抵扣。满队捕捉弹窗阻断已在本版关闭。R8 结论限定新四入口、Owned 计数/筛选及捕捉替换操作可读可点，未认证全站排版或本地化完成。

## 环境与证据边界

- 工作树 `D:/Games/pokeFactory2-worktrees/permanent-collection`；开始与结束均核对 HEAD 244738d，验收未改业务源码。
- Go 工作树根 `PORT=3004 go run ./backend/cmd/server`（session11473）；Vite `0.0.0.0:4303`、`GO_BACKEND_URL=http://127.0.0.1:3004`、`DISABLE_HMR=true`（session72604）。起步发现前轮服务已结束，重新启动并使用新 context。
- Playwright Chromium，具体版本见 environment.json；390×844 主视口，320×568/844×390，DPR2、touch、isMobile。真实前后端与本地素材/数据缓存，没有限速。不是实体Android、生产环境或Codex侧栏遥控。
- R1/R3 空存储自然初遇与九世代随机六选三、真实首回合；未改抽取或使用DEV Win。R2仅故障注入；其他注入情况见逐案记录。所有当前存档通过当前 createSaveData 生成/校验。事件固定队员原始数据来自历史实际自然租借，只作明确的受控数据输入，并使用新schema15结构与本版运行验证。
- 事件受控就绪、球、初始有效来源收据；RNG首值 .7/.99/.1 选择join/battle/item，后续 .001；捕捉失败 .99。进入工厂前恢复原生RNG。同步双按钮/同按钮burst通过真实DOM按钮click触发；不称实体双指测试。截图操作其余为tap，模态框通过滚动容器滚动到取消按钮。
- 主存档+只读React view-model状态在每个 gzip 快照：事件队伍/背包/日志不是完整持久检查点，所以读取运行状态；从未调用view-model action或直接修改业务内存。Storage故障、存档注入与RNG单独标注。
- 证据根 `evidence/final-244738d/`。manifest.json列场景、断言、错误分类与全部文件SHA256；体积较大的原始result已无损存为result-detail.json.gz，result.json保留关键前后摘要（原始字节可由gzip还原）；environment.json记录健康检查与内容版本。runtime-harness在抓图前等待550ms，并人工打开关键截图确认页面已显示；图鉴异步摘要另有加载完成样本。

## R1–R8 对照

| 项 | 本版结果 | 场景 / 实际证明 |
| --- | --- | --- |
| R1 | PASS | r1-natural-partner：候选改选确认前Owned空；岩狗狗确认后仅744，BP0；图鉴Owned1。 |
| R2 | PASS | r2-bind-failure：主档写盘失败停留，解除后伊布绑定成功，reload仍133；预期故障日志保留。 |
| R3 | PASS | r1-natural-partner 05/06：UI设置gen9，自然六选三、真实双方首回合；租借3只无744，Owned只744。 |
| R4 | PASS | r4-rental-swap：实际选对手、确认交换、点击训练家intro继续，到stage2且swapCount1，Seen增加、Owned只744；r4-rental-evolution：真实商品/队员/进化确认，Seen登记、Owned不增、reload保持。 |
| R5 | PASS | r5-r8-filter-import-layout：Owned+搜索744+岩石+阿罗拉命中，改关都为空（body保留）；初遇导出/真实file input导入。r5-r6-permanent-import：实际捕捉产生的收据导出→导入保持；另一合法伊布档整体替换，原来源不混入。r5-same-species-dedup：伙伴/租借均133，重复进入图鉴仍Owned1。 |
| R6 | PASS | r6-legacy：v14说明、备份字节一致、取消清除不变、确认回初遇；r5-r6-permanent-import：有效v15导入v14拒绝、当前收藏不变。 |
| R7 | PASS / 指定UI路径 | 下方全部受控场景。迟到离场/进入工厂均通过；共享门闩下同时另开事件战的UI请求被阻止，overlap场景证明仅一个事件战且第二地区仍READY。不能宣称任意外部修改上下文的运行覆盖。 |
| R8 | PASS / 限定范围 | r5-r8-filter-import-layout + r8-entry-return-matrix：中英三视口基地四入口、Owned计数/筛选、设置和事件进入返回，无生蛋承诺、横向溢出。满队320滚到取消、844替换可用。未改hero区布局、事件本地化及摘要显示问题见下方独立风险。 |

## R7 子场景及关键前后值

- r7-join-two-regions：两地区连续领取，球2→0，队伍1→3，来源1→3，第一只保留。
- r7-single-ball-concurrent：两个领取按钮同步burst，仅一笔新增；球1→0，队伍1→2，另一地区READY。
- r7-join-write-failure：失败球1/队伍1/来源1不变；解除重试分别0/2/2。
- r7-item：增加成长道具，球/永久来源/队伍不误变。
- r7-catch-success-training：实际背包投球，球2→1、队伍1→2、来源1→2；原成员HP EV增加，捕获成员仍在；reload保留Owned。
- r7-catch-probability-failure：.99失败扣1球、不新增来源。
- r7-catch-write-failure-retry：故障时球/队伍/来源不变，只有玩家投球日志，敌方未出招、己方HP不变；解除重试成功、刷新来源保持。
- r7-catch-full-cancel：320×568滚动到取消；队伍仍6且ID序列不变，已捕获物种永久Owned保持；球只扣1，候选清空。
- r7-catch-full-replace：844×390选择成员，同按钮同步点击两次；只替换一次，队伍6，来源/球不重复，候选清空。
- r7-late-leave：真实数据请求暂停，返回基地再释放响应，仍READY、球/队伍/来源不变。
- r7-late-factory：暂停派遣请求→返回基地→开始新工厂→释放响应，六候选正常出现，旧来源保持、不新增目标物种1，地区仍READY；工厂开局依原规则清空背包，不把这点标为派遣扣球。
- r7-overlap-event-double-catch：同时点两个地区只开一个事件战，第二地区READY；大师球按钮同步双击，只消费1球/增加1队员/1收据。
- r7-permanent-start-factory：从本版已捕捉并刷新档自然开始新工厂，Owned及全部来源保持。

## 关键截图（已人工打开复核）

- `r7-catch-full-cancel/04b-cancel-scrolled.png`：320取消按钮确实滚到屏幕内。
- `r7-catch-full-replace/04-full-team.png`：844六人替换对话框。
- `r5-r8-filter-import-layout/en-base-844.png`：英文横屏基地完整渲染，无前轮转场空图。
- `r8-entry-return-matrix/en-base-320.png`：四入口可点；也保留hero区问题。
- `r5-r8-filter-import-layout/en-owned-844.png`：英文Owned1完整可读。
- `r5-r6-permanent-import/05-other-owned.png`：显式另一档替换后伊布Owned1。
- `r8-entry-return-matrix/zh-事件-390.png`：事件入口和返回可见。

## 错误、加载观察和后续界面问题

- 22功能样本无pageerror/HTTP≥400。只有3个预设写盘失败场景的受控错误和一次v14导入拒绝console记录；manifest按预期错误分类，原记录未抹去。
- 独立观察 `observation-dex-load`：伊布初显英文名/0属性后，真实请求完成恢复中文与属性；前一条即时截图是加载占位，不是永久数据丢失。
- `observation-event-summary`：进入事件页等待3秒仍“未选择#948/属性不匹配”；打开真实选择弹窗并完成请求后，底页恢复“原野水母#948/已匹配(1)”。EventsScreen摘要effect只在pickerRegionId存在时发起。领取有独立真实fetch校验，未阻断本任务获得；这是待修的选中摘要显示问题。
- 英文320 hero区 Standby与标题有局部重叠、伙伴标签接近Start Run；本版diff相对a317686未改hero/标题/伙伴段，只改dock删除Breed和列数。没有旧320稳定图证明缺陷起源，所以称“当前未改hero区布局问题”，不武断称历史已存在。新四入口/Owned/替换的触控均未遮挡。
- 事件页仍有中文和Mock说明，属于当前本地化/开发文案待整理范围。本验收不将这些页面称公开发布体验完成。
- 自然新档无球获得入口，事件战不保存完整回合/背包断点，大师球仍有95%旧上限；本轮未扩张范围或修改它们。无实体Android、弱网、生产或完整自然长局证明。
- 两个harness草稿另存：服务未起时connection refused；迟到派遣测试未恢复固定RNG导致租借不足。正式重跑前修正harness，正式目录无这两类失败，不将其当产品缺陷。

## 可复现方式

以同一冻结版本起Go3004/Vite4303（HMR关闭），按顺序运行任务目录的 `run-natural.mjs`（生成自然基档），再用 `node --import tsx` 运行 fixtures所依赖的事件/捕捉/换怪/迟到等脚本；纯UI脚本可直接node。`run-import-matrix.mjs`、`run-event-overlap.mjs`、`run-observations.mjs`依赖已生成的本版捕捉成功快照。脚本目录和本版manifest可交叉核对。

---

# 历史候选运行记录（不作为244738d证据）

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
