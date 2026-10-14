# 技术方案：派遣赠球与阿罗拉入口

状态：root 0 次实质修订通过 Route A，已授权实施。最终合并基线 `00f30d152596c185287f99b4be7227f93f581fe4`，调研基线 `be353a11e7b80fad5bfff04ba2a0cf58bfa74b79`。

**前置已解除（2026-10-14）**：九道具 `6d95772` 与手机界面 `ba5c0c2` 各自最终代码实玩通过，并实际合入 dev。root 已指定首段最终共同基线，接线已重新核对。此任务先于高速旋转与 TM 业务接线，独占存档、主 Hook、捕捉控制器。

## 1. PRD 一致性和实际代码

F1–F5 均来自本任务 design 中的用户决定；边界约束来自 PRD。没有另选价格、概率或派遣机制。

| 真实入口 | 当前行为与差距 | 对应 |
| --- | --- | --- |
| `config/events.ts` Alola | requiredTypes 为 fairy/ghost/grass，首项还决定训练属性 | F4：尾部增加 rock，保留首项、10 小时及其他字段 |
| `utils/eventDispatchRewards.ts` | `rollDispatchOutcome` 分类阈值；`applyDispatchTrainingToTeam` 纯训练计算 | F1：沿用，训练不在当前队伍仍跳过 |
| `usePokeFactoryGame.ts` resolveDispatchRegion item | 先训练、追加临时物品、弹窗，调用者最后改 IDLE；没有保存事务 | F1/F3：改为先准备、原子落盘、后同步与反馈 |
| 同 Hook join | `commitPermanentAcquisition` 只保存 Owned/完成态，然后内存扣球、训练和加队 | F2/F3：扣球与永久来源必须同一次主档写入 |
| `useBattleController.ts` useItem | 捕捉成功先保存来源，成功/失败随后只扣临时 inventory | F2/F3：两种概率结果都需持久消费；失败写盘不能扣球/敌方行动 |
| `saveManager.ts` serializeSaveData | 保留来源和相关完成态，未保护永久球或 item 结果 | F3：同样保护新账本和已领取派遣，禁止旧自动保存倒灌 |
| `useFactoryFlow.ts` startGame/quickStartDevBattle | 清空 inventory；战斗检查点 inventory 是临时资源 | F2：球完全移出此数组与检查点，不使用复制并回写的双库存 |
| 主 Hook 初始化 | 当前队伍/背包仅从工厂 battleResume 初始化；基地刷新不恢复训练与成长物品 | F3：交易恢复快照需补齐，见 §2.3，须 root 明确批准 |
| `EventsScreen.tsx` / `BattleBagPanel.tsx` | 事件页无球数，战斗背包按数组 index 用物品 | F5：事件页球计数；事件战以球种 ID+数量显示与选择 |

## 2. 实现决策和状态契约

### 2.1 单一永久库存与版本（F2/F3，PRD 存档约束）

- 新增纯模块 `utils/baseBallInventory.ts` 和测试。`GameSaveData.baseInventory` 包含 `revision`、`balls`（现有四种球 ID 的非负安全整数计数）、`transactions`（稳定 ID、种类、时间、增减、派遣来源或事件投球序号）。初始四种球均零；本任务唯一新来源是物品派遣的普通球赠送，不授予其他球。
- 赠球数量放 `config/events.ts` 命名配置，值来自 F1；类型白名单以 `uiAppConstants.ts` 四种既有球为准。不把 `Item` 函数对象写存档，不扩张未知 ID，不增加任意玩法上限；超安全整数拒绝交易。
- 从现行版本升到下一版本（当前为 15，若合并基线无版本变化则 16）。新版缺永久库存、负数/小数/非有限计数、未知球种、冲突交易 ID、非法来源拒绝为 corrupt。版本旧档保留既有备份/明确重置；不从旧临时球迁移。
- 永久账本由专用事务写入。普通 `persistSaveData` 和所有工厂事务不得接受旧 draft 覆盖已落盘账本；`serializeSaveData` 默认采用最新已提交 baseInventory，专用交易显式传入已校验的新 revision。不要简单按最大余额合并（那会复活已花球）。
- 同版 `replaceSaveData` 完整采用导入档，不和本地相加；保留 `skipExitPersistRef`。读取后同步库存 ref/state；导出含库存、交易和派遣完成记录。自动保存和离页保存不得复活已消耗球或已完成 item。
- 普通工厂检查点 `inventoryItemIds` 排除球且新版校验拒绝其中混入球；临时 Item[] 保持非球。普通工厂 useItem 即使被旧回调传球也先拒绝，不触碰永久事务。

### 2.2 派遣发放与消费事务（F1/F2/F3）

- 所有地区继续共用 `dispatchInFlightRef`，覆盖数据加载、结果选择、保存和内存同步。提交前重新读取存档验证 region/startedAt/READY（含已到时 RUNNING）、所选成员仍 Owned 和页面上下文；切页、开始工厂、导入产生的迟到回调不提交。
- 同一派遣的稳定结果键沿用 `dispatch:<region>:<startedAt>`。新增已完成结果记录，涵盖 item、join 和已结束的 battle 派遣；不可只查 collection.acquisitions，因为 item 无 Owned 收据。事务重复请求返回已提交结果，冲突拒绝。下一次 startedAt 不同可再次发奖，不按地区永久限领。
- 在现有 `item` 分支先用纯函数计算成长物品和训练后队伍，不调用有副作用的 `awardDispatchTraining`。一次主档 setItem 同时写：原奖励结果、训练恢复快照、永久普通球增加、结果收据、该地区 IDLE/lastResult。构造和校验全在 setItem 前，成功之后才能 setState/ref、弹成功。失败保留 READY 和本次已准备结果以便重试，不重新抽签或重新叠训练；刷新后的恢复见 §2.3。
- item 成长物品选择池、训练计算、物种不存在当前队伍时跳过的行为保持。保存成功的同一结果不能再次发放任何部分；不能以三球发放成功掩盖原奖励或训练保存失败。
- join 改为专用交易扩展现有 `commitPermanentAcquisition`：从落盘基地库存按既有球顺序选一颗，验证余额，然后一次写扣球、永久来源、完成态、原训练/临时队伍结果。旧调用者不再 splice 临时 inventory。零球仍沿原结果提示与结束派遣规则，不赠球、不重新抽签。
- 两个不同地区的同页领取依次从最新落盘 revision 计算；每次成功先同步资源 ref 再释放门闩。两球两次加入都保留；最后一球只让一个加入成功。每次同步不得用旧 draft 覆盖另一地区交易。
- battle 分支只检查基地球数，不赠球；创建事件 context 时保留派遣键。以派遣键加唯一 attempt ID 供永久交易幂等（crypto UUID；LAN HTTP 缺 UUID 时用时间加模块单调序号，不消耗战斗 RNG）；这不是完整战斗断点。
- useItem 的球路径改为 `commitEventBallAttempt({dispatchKey, attemptId, ballId, acquisition?, resources})`。现有概率公式和 RNG 次序保持；成功概率结果由同一次保存完成扣一球+永久收藏收据+派遣完成态；失败概率结果保存扣一球及该次尝试收据，不登记 Owned。已提交重复 attempt 不再播新投球、不再扣球或推进敌方。
- 控制器原简单轮次门闩继续覆盖日志与提交。提交前复核 epoch/敌方/页面，事务拒绝或写盘失败不改变敌队、余额、Owned、队伍，不让敌方出手；返回可重试错误。成功写盘后的消息异常不能撤销永久交易。保留原满队替换/取消和训练不丢新捕获成员的修复。
- 事件战刷新仍不恢复整场敌方/PP/回合；已提交 attempt 与消费不回滚。重新进入事件不得重复使用旧 attempt ID；旧成功捕捉收据禁止再次发放。现有 READY→IDLE、零球处理保持，不借此增加新的重开战或重抽入口。

### 2.3 原奖励与训练的最小恢复（F3，待 root 重点审）

- 现有存档没有独立基地队伍或成长物品；仅落一个“已领”收据会导致刷新后原奖励丢失。建议 `events.resourceCheckpoint` 存本次交易后的当前临时队伍（复用现有合法 Pokemon 序列化/校验）和非球物品 ID、revision、所属工厂 runId/事件上下文。它只恢复已提交资源，不变为永久养成档、Owned 个体或事件战断点。
- 初始化无可恢复工厂检查点时加载有效的局外资源快照；有工厂检查点以工厂为准，绝不把基地成员带入六选三。进入新工厂/快速开始时与 `beginFactoryWalletRun` 同步使该局外恢复快照失效，永久球不动；成功清临时背包后旧保存不能重建失效快照。
- 同次交易在快照和收据保存成功后才更新内存；刷新直接装载结果，不重新执行训练函数或追加物品。后续临时物品消费/事件结算更新此快照，防止旧奖励快照恢复已消耗成长物品。这个接线覆盖新增持久性必需范围，不调整原效果、用途和清包规则。
- 为避免保存失败导致已选 item 在刷新后重抽，派遣结果准备独立存为 `events.pendingResults[dispatchKey]`：只保存已选 outcome/成长物品和派遣身份，不发奖励；成功领取事务删 pending 并写完成收据。pending 写失败无奖励、显示保存失败；一旦写成便复用。join/battle 沿相同结果锁避免 item 失败被改判，但不增加新掉落概率。准备与最终发放两个阶段均故障测试。
- 以上是原子性和恢复实现选择，若 root 不批准局外资源快照或 pending 结果范围，应先裁定 F3 可执行边界，不能悄悄降为仅三球持久。

### 2.4 UI 和阿罗拉（F4/F5）

- Alola requiredTypes 尾部增加 rock，保留 fairy 首项以保持原训练属性；其他八地区整体快照对照。
- `EventsScreen` 现有标题/说明区域显示普通球及其他已有非零球数量；item 弹窗和 lastResult 同时说明原奖励与新增普通球。无球提示改为基地库存语义，新增保存失败与库存不足文案走 zh-hans/zh-hant/en。
- `BattleBagPanel` 仅在合法事件战显示库存投球按钮，按球种聚合数量，以 ballId 回调；非球仍用原 index。库存显示来自同一 baseInventory，没有球数组展开或复制回填；刷新/消费同步渲染。
- 保留已验手机布局/可滚动弹窗和导航；新增计数长文本在 320 宽、横屏和三语言不遮挡原按钮。不新增背包页、商店或开发数字字段。

## 3. 文件所有权

| 文件 | 本任务最小责任 / PRD |
| --- | --- |
| `src/features/game/config/events.ts` | rock 资格、已定赠球配置 / F1/F4 |
| `src/features/game/utils/baseBallInventory.ts`、`.test.ts` | 库存及交易校验纯模型 / F2/F3 |
| `src/services/saveManager.ts`、`.test.ts` | 版本、原子交易、导入/自动保存保护、局外资源与准备结果 / F2/F3 |
| `src/features/game/hooks/usePokeFactoryGame.ts` | 派遣准备/领取、最新 ref、库存和恢复接线 / F1–F5 |
| `src/features/game/hooks/useBattleController.ts` | 仅球路径回调、结果/epoch门闩；不改九道具战斗规则 / F2/F3 |
| `src/features/game/hooks/useFactoryFlow.ts` | 必要时传新局清局外快照回调；优先在现有 beginWalletRun 封装处处理 / F2/F3 |
| `src/features/game/view-model/state.ts`、actions.ts/common.ts | 基地球计数、投球动作、领取反馈类型 / F5 |
| `components/game-view/EventsScreen.tsx`、`battle/BattleBagPanel.tsx`、`baseEventCopy.ts`、现有 uiStrings 文件 | 最小显示/本地化；必要时 GameView 旧档版本解释 / F5 |
| `hooks/permanentCollectionCallbacks.test.ts`、新 dispatch 交易回调测试 | 实际 hook/控制器回调及并发/故障顺序静态断言 / F2/F3 |

不改后端数据、不改捕获公式、概率池、成长效果。若合并基线已改变上述入口，先报告并修 plan，再实施。

## 4. 可观测状态

| 状态 | 断言消费 |
| --- | --- |
| `baseInventory.balls/revision/transactions` 主档 JSON | T1–T5、R2–R7 |
| `events.pendingResults` / 完成结果键 / dispatch.startedAt,status,readyAt | T2/T4、R1–R4/R7 |
| `events.resourceCheckpoint` 队伍 EV、非球物品与失效标志 | T2/T3、R2/R3/R5 |
| `collection.acquisitions/ownedIds`、事件队伍 | T3/T4、R4/R6 |
| 工厂 battleResume.inventoryItemIds、实际投球按钮 | T5、R5 |
| 事件页球数、领取弹窗、无球/失败反馈、Alola 资格与倒计时 | R1–R7 |

字段命名按本计划定约；暂未存在的新字段不得写成已观察到的运行事实。

## 5. 验证计划

### 静态与独立 auditor

| 编号 | PRD / 断言 | 方法与产物 |
| --- | --- | --- |
| T1 | F2/F3：新版创建/解析，旧版拒绝且原文备份；非法球、负数、小数、Infinity、溢出、未知/冲突交易；同版导入完整替换 | baseBallInventory.test、saveManager.test，原文前后和返回对象 |
| T2 | F1/F3：item 一次+配置球数+原物品+训练+IDLE；重复幂等、不同次再领；pending/最终setItem失败均无部分到账，重试复用结果；训练不在队伍仍跳过 | 存储故障注入，实际事务和纯训练函数，静态报告 |
| T3 | F2/F3：最新账本保护旧自动保存、离页保存、导入不相加；工厂全部保存事务不复活消耗；局外快照恢复不重训/复制成长物品；新工厂使快照失效而球保留 | saveManager.test覆盖真实序列与关键所有写入口审查 |
| T4 | F2/F3：join/catch 成功原子扣球+来源；投球失败仅扣球；同页跨地区最后一球、两球顺序领取；重复attempt、异步迟到、epoch变化、失败无敌动 | 实际 Hook/控制器回调测试，冻结 RNG 与 await 时点，明确不是实玩 |
| T5 | F1/F2/F4：地区配置唯独 Alola 增 rock，时长/首项/池不变；概率阈值不变；普通工厂禁球/临时背包无球；全部四门禁回归 | 配置快照、已有概率测试、控制器路径检查；顺序 lint→test→build→go test |

### 最终冻结代码 Player

真实 Go+Vite 均以验收工作树根为 cwd，独立端口/来源、HMR 关闭。runtime 写准确 SHA、服务、浏览器、请求/控制台；所有源码在验收前冻结。以下是模拟浏览器，实体 Android 和生产环境仍未覆盖。

| 编号 | PRD / 操作 | 证据 |
| --- | --- | --- |
| R1 | F4：自然新档选岩狗狗→图鉴仅其 Owned→事件实际选 Alola→开始；显示/落盘相差10h。另核非 Owned 租借不入候选 | 自然入口截图、主档；不注入球、不DEV |
| R2 | F1/F3/F5：从 R1 真实已开始派遣推进受控时钟至到时、定点控制结果为item，真实点击领取；原成长物品+训练（在队与不在队分别）+球+完成态；重复点击/刷新/重开不增加；下一次派遣item再增加 | 受控时间/RNG明示，前后存档/队伍/弹窗截图，不宣称等足10h或自然随机item |
| R3 | F3：分别阻断 pending 写和最终领取写，失败不出现成功/部分奖；解除后同结果一次成功；立即离页和导出→真实设置导入→reload | 受控setItem故障与下载/导入文件、原文快照、反馈截图 |
| R4 | F1/F2/F3：受控另次join使用真实赠得球，球-1且Owned+来源一次；两地区READY连点最后一球只消费一次；两球顺序领取保留全部记录；零球行为原样 | 真实UI受控结果、前后JSON，含两地区和零球提示 |
| R5 | F2：赠球后自然进入六选三和首战实际出招，无投球通路；继续/返回/结束普通工厂球数不变；快速开始仅作为开发路径单独标注 | 工厂UI+库存快照；跨组/败退夹具明示，不用旧证据替代 |
| R6 | F2/F3：受控battle派遣真实进入事件战，投球概率失败耗1无Owned，成功耗1且永久收藏；写盘失败不耗球、不敌动，重试一次；满队取消/替换不二扣；刷新不恢复已花球 | 真实战斗操作截图、attempt记录/来源/球数；不宣称事件战整场恢复 |
| R7 | F3/F5：数据加载迟到时切页/开始工厂不能写旧结果；三语言390×844，320×568/844×390球数/反馈/投球按钮真实可点无重叠 | 受控延迟与截图、控制台/HTTP记录，模拟触控非实体手机 |

若自然随机结果没有item，只记自然入口和已出现结果；受控奖励覆盖不能声称自然完整闭环。故障夹具不改实现、不把DEV加球作为真实来源。

## 6. 风险与评审决定

1. **局外恢复快照**：F3 原奖励/训练目前没有持久载体；§2.3 增最小载体仍比加三个数组项更宽。须 root 批准范围，不能静默漏掉。
2. **准备结果持久化**：新增两阶段结果冻结只为错误重试不换奖，不设新随机机制；两个写点均须故障覆盖。
3. **存档版本与原子消费**：会替换原捕捉成功回调接口，必须在九道具最终基线上串行集成并重跑其代表性回归；旧档不兼容已授权。
4. **事件战恢复边界**：本切片保证永久球、收据不回滚，不补整场事件战；战斗刷新后的原入口行为如实记录。
5. **并发范围**：本计划验证单页面多入口/异步并发与旧保存。localStorage 多浏览器标签的同时读写没有跨进程 CAS，不能宣称多人/多标签共享存档事务隔离；如要求多标签强一致须另议统一写锁，不能仅凭 revision 比较宣传已支持。

未自行选择任何玩法数值。方案文件外只写 context.json；无业务修改、游戏运行或提交。

实施补充：初次 pending 保存失败仅同页保留准备结果；关闭页面后不存在可恢复的已落盘结果，不承诺恢复未保存抽签。

最终字段细化：已完成派遣记录为 events.completedResults；resourceCheckpoint 仅存临时 playerTeam/inventoryItemIds，写序由 baseInventory.revision 统一保护。beginFactoryWalletRun 的 serializeSaveData 同次清除此快照；旧普通保存采用已落盘字段，不能复活。投球 identity 采用派遣键+唯一 attempt ID 而非新增完整事件 session。

静态测试实现归并至 hooks/dispatchBallTransactions.test.ts（16项，含纯校验与真实回调）；未另建重复的 baseBallInventory.test.ts。


## A1 / A2 审计修复补充（Route A，经 orchestrator 批准）

- F3/F5、边界“合法刷新/异步迟到”：`startEventDispatch` 从最新主档验证地区、Owned、当前选择、资格及 IDLE；一次写入 RUNNING/start/ready 和 revision 成功后才同步 UI。失败仍 IDLE，选择保留，可见失败并可重试。异步物种校验前后检查 dispatch context generation、页面、工厂与导入保护。普通旧 revision 草稿不得覆盖刚持久化的派遣状态。
- F2/F3/F5、边界“不新增机制”：已准备 battle 结果遇空队或全濒死队伍，`deferDispatchBattle` 只保存 READY 与恢复提示，不完成结果、不消耗球、不改 Owned/临时资源。目标异步加载后再次验证可战成员；有健康后备但首发倒下时打开既有换人页，不自动改队。
- 恢复提示指向现有工厂挑战：工厂胜负结算先恢复队伍，败退返基地或七战结算后结束挑战均保留当前临时队伍；随后重新领取已保存的 battle。此处为代码路径论证，自然流程仍由 player 验收。不能让初遇伙伴自动参战，也不能依赖另一地区 join 作为唯一恢复入口。
- 新增9项实际回调测试：空队/全濒死保留与同结果续领；目标 await 后空队与首发倒下健康后备；IDLE 写失败重试、刷新/导出解析、旧草稿覆盖；选择/离页再回/工厂/导入/Owned 变化后的迟到。测试注入临时队伍只证明回调契约，不证明自然取得队伍。
- 保留 `audit.md` 与 `audit-static-7c27209/` 的原始 BLOCKED 历史；新代码需新 SHA 独立复审和最终实玩，不沿用旧证据。


### A2 复审补充：保存构建器的渲染代际（F3 / F4）

`buildCurrentSaveData` 的 `baseInventory` 必须来自和 `eventDispatches` 相同的 React 渲染，并列入 useCallback 依赖。不能使用即时更新的 `baseInventoryRef.current` 为旧闭包中的 IDLE 标记新 revision。`syncEventSave` 同步更新 ref、异步调度 state 后，旧 builder 仍携带旧 revision，由 serializer 保留已保存 RUNNING；新渲染 builder 则正常持久化选择和到期 READY，不能一律丢弃 UI 派遣字段。

新增实际 builder + sync 序列测试，保留复审复现脚本 `audit-stale-builder.mjs` 原文（脚本预期针对13dd1f2失败版本，并非修复版通过门禁）。专项26项；旧门禁和原审计历史不覆盖。
