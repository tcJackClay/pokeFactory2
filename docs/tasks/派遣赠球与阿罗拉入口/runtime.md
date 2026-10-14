# Player 最终实玩：派遣赠球与阿罗拉入口

## 最终结论

冻结 `f713afd9b189b13e57e89404d638d1985c74eca2`：下列31项模拟浏览器场景完成，功能/状态断言通过。6条控制台报错全部来自命名的定点写故障；最终白名单内非预期console、pageerror、HTTP>=400、requestfailed均为0。此前1157390、a70320b及本版attempt目录全部保留为历史，不计PASS。

实际证据边界：自然新档岩狗狗入口 + 明示受控时间/结果/状态的浏览器操作，不是实体Android，不是自然七战或生产验收。无DEV Win。胜后换怪下一战用HP/速度/PP受控战局，独立于自然六选三/实际出招/逃跑返回路径。

### 运行身份

- 开始2026-10-14约11:46 +08；全部浏览器于12:00前完成关闭，12:00后只做离线文件核验。每场景result.json记录独立起止ISO时间。
- Chromium151.0.7922.34，模拟触控，DPR2；390×844，320×568，844×390。
- Go3009/PTY38619，Vite4308/PTY5307，来源127.0.0.209:4308，`DISABLE_HMR=true`。工作树均为dispatch-balls；health返回runtime=go/status=ok。服务留供root复核。
- schema16；后端真实物种/招式资料，无网络响应内容伪造。源码全程冻结，最终git HEAD和src/backend/scripts无diff复核通过。
- RNG只在rollDispatchOutcome或Vite真实源码捕捉判定所在行固定，其他originalRandom。派遣目标自然抽取；捕获目标数据来自当前Go。受控时间不冒充真实等10小时。

### R1–R7 场景与结果

| 计划 | 最终目录（均在evidence/final-f713afd） | 核验结果 |
| --- | --- | --- |
| R1/R2 | r1-natural-rockruff-r2-first-gift | 自然新档仅Owned744；真实选择Alola并开始，readyAt-startedAt=36,000,000ms；再控制时钟与item结果，原成长道具和3球同领，不把伙伴加入战队；刷新无重复 |
| R1 | r1-start-write-failure | RUNNING写失败保持IDLE/可见错误；解除后重试真实十小时落盘 |
| R1 | r1-empty-team-battle-retry | 空队battle结果保留pending/READY，球不变、无白屏；刷新改结果RNG仍保留battle |
| R2/R3 | r2-second-item-and-import | 下一次真实开派遣后控制时钟得第2份3球；真实设置导出/导入保持6；导入更早档完整替换3而非相加 |
| R2 | r2-training-item-with-party | 实际join取得的成员参加匹配地区，训练与原物品/+3同时提交；刷新不重复训练 |
| R3 | r3-pending-failure / r3-commit-failure | 准备/最终奖励两写点分别故障；无部分奖；解除并更换结果RNG后仍重试原item，仅一次到账 |
| R4 | r4-first-join-real-gift | 真实赠球存档→受控join结果、自然目标→扣1并永久Owned/来源；刷新保留队伍和余额 |
| R4 | r4-two-region-two-balls | 两地区顺序领取保留全部扣球/来源交易 |
| R4 | r4-last-ball-concurrent-and-zero | 实际三球经过真实join剩1；同页两按钮连点只让一个加入，另一次零球无新增/无赠球、按原规则结束 |
| R5/A3 | r5-factory-natural-and-pending-recovery | 实际六选三/真实出招，工厂背包无球；逃跑确认→结束写失败保结果页→解除重试原子清run/checkpoint→BASE刷新不回结果→同pending进入事件；球3保持 |
| R5 | r5-win-continue-keeps-balls | 受控enemy1HP/单敌、速度与PP触发实际挣扎胜利，非DEV Win；换怪页跳过→真实第2战→刷新续战，球3不进入临时包 |
| R6 | r6-catch-failure / r6-catch-success | 真实UI投球失败/成功分别扣1；失败无Owned，成功唯一永久来源；刷新不复活球 |
| R6 | r6-catch-write-failure | 捕获写失败不耗球、不加Owned、不敌动；解除后重试仅扣1并收藏 |
| R6 | r6-catch-full-cancel / r6-catch-full-replace | 临时队伍复制成六只的边界夹具；取消保留原六只、替换首位变成目标，均永久收藏且只扣1；320/844弹窗实操 |
| R6/A4 | r6-caught-member-resources-persist | 当前实际捕获成员作为受控耐久战首位，真实出招PP减1、真实成长物品消费；刷新保持快照，revision静置稳定 |
| R6/A4 | r6-captured-hp-change | 同源真实捕获成员加受控初始中毒；实际回合伤害HP800→552、招式PP到9、物品耗尽，刷新全部保持，不耗球 |
| R6/A4 | r6-growth-item-write-fault | 成长道具写失败不消耗、不生效、不敌动，解除后单次使用；HP/PP/背包持久且revision停止增长 |
| R7 | r7-late-start-clear / leave / import | 延迟真实744资料响应，清除选择/回基地/真实同版导入使旧开始失效；不落RUNNING、不改球 |
| R7 | r7-mobile-zh-hans / zh-hant / en | 三语言各三视口事件球数、Alola选择器真实选择、横向不溢出 |
| R7 | r7-bag-zh-hans / zh-hant / en | 三语言各三视口球按钮≥44px、命中测试无遮挡，视口截图；每种语言真实触控投球消费1 |
| 代表回归 | regression-mental-herb | 精神香草实际解除封锁并消耗，刷新保持消耗/装备基准，基地球不变 |
| 代表回归 | regression-struggle-terminal | 只读逐帧trace确认双方HP0、原PP0→唯一LOSS；结果页按规则恢复队伍后稳定7秒，无异步错误、球不变 |

### 循环问题的关闭证据

`r6-catch-success`及write-failure/full-cancel/full-replace的result包含revisionSamples：成功回事件页截图后静置4秒、关闭弹窗再3秒，revision保持；刷新后再3秒保持。没有Maximum update depth，永久球只扣一次。资源变更用真实UI操作，`summary.json.postChecks.hp`记录HP800→552、PP9、items0。不会把不变化时停止保存误写成资源变化不再持久。

### 视觉复核

直接查看了简中320背包、英文844横屏背包、成长道具使用后的390战斗截图。球名、数量、说明与按钮均可见可点；英文横屏三列背包使卡片较窄，文字多行但没有裁切。已有POKEM...命令截断属于先前未全局修整的文案边界，本任务未扩大为全局布局重做。

### 白名单与来源

- `evidence/final-f713afd/summary.json`：31场景时间/控制手段/状态断言、满队选择的离线快照复核。
- `evidence/final-f713afd/manifest.json`：323个证据/来源文件，60,017,508字节，逐文件相对任务目录路径、SHA256、size。manifest自身不计入自身hash清单。
- 自然来源链：natural-running→natural-first-gift→empty-pending→实际工厂party-base-pending→真实捕获actual-caught。两球/一球/零球源自真实赠3后的实际消费，未用DEV增加球。
- fixtures仅派生时钟、结果、临时队伍/HP/PP等明确边界，所有注入起点保存在input.json.gz；不将受控队伍或状态冒充自然抽取。

### 错误分类、历史与未覆盖

- 最终6条预期console：start写、pending写、commit写、LOSS结束写、捕获写、成长物品写；均有失败状态与重试成功对照。
- 本版`attempt-last-ball-low-sweep-502`保留低空踢API502及原功能断言，有限重跑对应最终场景无网络错误。a70320b的dark-pulse502也保留。不能据最终样本无错误宣称外部API无故障风险。
- 本版三个harness错误样本保留：挣扎结果页HP已恢复却错误期望0；成长物品label错误匹配“增强剂”而实际“特防增强”；英文Poke Ball误匹配Poké Ball。都修采证脚本后重跑，未改业务。
- 不覆盖：实体Android地址栏/切后台/触控设备差异、生产环境/弱网断网部署、自然完整七战、事件战完整断点、跨标签事务CAS。工厂快速开始开发入口、异步开始工厂这一具体迟到分支及所有旧保存入口排列依靠静态测试，未宣称全部有UI路径采证。
- 当前切片是有边界的模拟验收，不是整个公开版最终reviewer审查或发布就绪结论。

---

# 历史尝试（以下不计最终PASS）
# Player 实玩记录（待修复，未通过）

## 1157390 首轮历史

- SHA：`11573909569213af6cadd62e46b266ff83c4dbba`；Chromium 151.0.7922.34，模拟触控/DPR 2，390×844 主视口，320×568、844×390 三语言边界。不是实体 Android。
- Go 3009（PTY 38619），Vite 4308（PTY 5307，`DISABLE_HMR=true`），工作树根 cwd；健康检查 `runtime=go,status=ok`。浏览器来源 `http://127.0.0.207:4308`。
- 2026-10-14 11:20:36 +08 已停止所有浏览器验收；定向进程检查无 run-capture/run-join/run-factory 或 Playwright Chromium 临时 profile 进程。服务保留，无业务代码修改。
- 全部证据位于 `evidence/final-1157390/`，目录名不代表通过。本轮不得作为后续修复 SHA 的最终验收。

### 阻断：工厂逃跑后 pending 派遣仍被钱包拒绝

路径：`r5-factory-natural-and-pending-recovery`。

1. 从真实领取 3 球的自然岩狗狗存档派生 READY battle，空队领取后保留 pending。
2. 实际 UI 开启工厂六选三、首次对战出招，再点击逃跑及确认，进入 LOSS 结果并返回基地。
3. 事件页已可领取，临时队伍三只、球仍 3；领取同 pending 时控制台 `Factory challenge blocks dispatch rewards`，页面显示保存失败。

`06-base-after-forfeit.json.gz` 与 `failure.json.gz` 精确状态：

- `wallet.currentRunId = run:b851ed1c-cceb-4585-a08a-868fa5a232b8`；revision 2，balance 0，settledThrough 1。
- lastSettlement：同 runId，setNo 1，stage 1，result LOSS，amount 0，settledAt `2026-10-14T03:16:31.991Z`。
- `factory.challengeStatus = 0`；`battleResume.status = READY`，phase ROUND_RESULT，roundResult LOSS，checkpointAt `2026-10-14T03:16:23.428Z`。
- runtime：gameState BASE，eventBattleActive false，hasFactoryRunToResume false，playerTeam.length 3。
- `dispatch:alola:20000` 仍为 pending battle；永久球 3。

旧工厂结果检查点仍可在刷新后载入，基于该档继续的 `r6-catch-failure` 停在等待基地；后续捕捉进程已取消，不作为捕捉证据。

### 其他历史观察

- 自然新档岩狗狗 → 阿罗拉真实开始，readyAt-startedAt = 36,000,000 ms。随后明示 Date.now/RNG 控制，真实领取原成长物品和 3 球，刷新无重复。
- pending/commit 两写点定点故障均无部分发奖，解除后同结果一次成功。开始派遣写失败保持 IDLE，重试后落盘十小时。
- 第二次物品派遣再 +3，设置真实导出/导入保持 6，导入更早真实档完整替换为 3。
- 空队 battle 留待领取、刷新改 RNG 不重抽；手机三语言各三视口选择操作及横向无溢出断言完成。
- `r4-first-join-real-gift`：实际第一份 3 球 → READY/RNG 受控 join 木木枭，余额 2、Owned/来源/临时队伍持久化成立。然而该场景还有独立控制台错误 `Failed to generate enough rentals`，不得把整场记作无错误 PASS。

### Failed rentals 的证据边界

发生窗口：`r4-first-join-real-gift/result.json`，2026-10-14T03:18:41.853Z 至 03:18:52.189Z。调用栈 `useFactoryFlow.ts:873` → `withRequestTimeout` → `useFactoryFlow.ts:895`。该记录 HTTP>=400 与 requestfailed 均空；脚本只操作事件 join 和 reload，没有点击工厂开始。

当前 harness 未为单条 console 记录时间、未记录全部请求顺序，因此无法精确断言错误发生在 join 前后还是 reload 前后，更不能据此归因为网络。该样本有 outcome/target 全局 RNG 控制，可能影响后台租借生成；下一轮将给 RNG 按调用栈限定并增加请求/console 时间记录，验证其来源。未改产品实现。

修复后需要新冻结 SHA 全量重跑本切片；剩余捕捉、最后一球并发、迟到开始与九道具代表回归未完成。

## a70320b 第二轮历史（新阻断，未通过）

SHA `a70320b8f9dea7883b4e4f8f16c5832234f92cbb`；新来源127.0.0.208:4308，沿用Go3009/Vite4308 HMR关闭。2026-10-14 11:36:44 +08全部浏览器停止，定向进程检查无采证node或Playwright profile。服务保留。

本轮 RNG 仅固定 `rollDispatchOutcome` 结果；目标物种和后台工厂随机仍使用originalRandom。捕捉仅固定Vite编译源码 `const caught = Math.random()` 的准确行号栈，其他随机原样。真实join随机得到科斯莫古(789)，未再出现旧版全局常量RNG下的 Failed rentals；这支持旧错误存在harness干扰风险，旧原件仍保留，不删除错误记录。

自然工厂路径已关闭旧阻断：六选三、实际出招、逃跑确认；故障注入结束存档写时保持结果页，解除后wallet.currentRunId=null，battleResume.status=EMPTY，临时队伍/球/原pending保留，BASE刷新不回结果页，原pending实际进入事件战。初次脚本错误地期待battleResume=null而非EMPTY，原样本移到attempt-r5-harness-null-expectation；修正断言后全流程重跑通过，非产品缺陷。

### 新阻断：成功捕捉回事件页产生Maximum update depth

目录 `evidence/final-a70320b/r6-catch-success`，result原件包含非预期console，不得记作整场PASS。

- 03:35:36.582Z `01-event-bag`：BATTLE，eventBattleActive=true，球3，revision9，临时队伍52/104/54，敌方792。
- 03:35:43.113Z `03-caught`：EVENTS，eventBattleActive=false，球2，revision41，队伍52/104/54/792，唯一CATCH交易及DISPATCH_CATCH永久来源落盘。
- 03:35:44.779Z console：`Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.` React console文本没有业务栈。
- 脚本捕捉成功后等待调查完成→截图→触摸(5,5)关闭弹窗→读存档→reload；异常属于成功回事件页/关闭弹窗这一段，而非入战。现有时序不能精确细分弹窗关闭前后。
- 03:35:48.236Z `06-reload`：BASE，球2，revision64，Owned/队伍保留792。短期revision9→41→64记录供诊断。

捕捉失败样本 `r6-catch-failure` 功能断言为扣1/无Owned，另有03:35:24.662Z请求 `http://127.0.0.208:4308/api/pokeapi/move/dark-pulse/` 返回502，同刻console资源加载失败，单列网络问题，不与update-depth混为一谈。

捕捉写失败/解除重试已完成，只有预期 `PLAYER catch transaction fault`。后续满队捕捉被停止；精神香草消耗及刷新代表回归完成，挣扎终局采证中止。两阶段赠球故障、同版导入完整替换、三语三视口、两地区顺序消费、最后一球同页连点、无球、真实队伍训练+原成长物品+3、迟到开始清选择/离页/导入均有历史断言证据。所有历史局部通过不能替代下一修复SHA验收。

