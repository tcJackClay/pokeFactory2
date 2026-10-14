# 独立静态审计：派遣赠球与阿罗拉入口

审计 SHA：`7c2720982facf73fedaaf318bc76ca82969cc405`；基线 `00f30d152596c185287f99b4be7227f93f581fe4`。职责为 auditor：没有运行游戏、没有修改实现、没有提交。

## 裁决：BLOCKED（A1 / A2）

### A1：空临时队伍的自然事件战入口会完成派遣并进入空白页面（高）

- 路径：新档初遇只登记 Owned，`playerTeam=[]`；领取物品结果后有3球但仍无临时成员；下一次抽到 battle 已满足球检查。
- `usePokeFactoryGame.ts:1880` 的 battle 分支完成目标加载后直接 `complete(battleResult)`，永久写入 completedResults/IDLE，接着设置 eventBattleActive 和 BATTLE。没有当前队伍存在或可战成员检查。
- `components/game-view/BattleScreen.tsx:21` 对空队直接 `return null`；`runSimplePlayerRound` 也拒绝无首发。因此玩家落入空白战斗而派遣已消耗。此为静态路径推导，不称作浏览器复现。
- implementation 第5点把自然可达性作为限制，不能替代入口保护；有球后此前不可进入的分支已可达。
- 修复方向经 root 确认：无可战队伍时不完成派遣、不进入 BATTLE，保留已持久化 battle pending 与可领取状态，显示可恢复反馈；不把伙伴自动加入、不重新抽结果。已有另一地区的 join 可获得临时成员，之后再领取原 battle。需要说明无队伍与全员濒死条件，后者也不可进入无可战成员的战斗。
- 验证：真实 READY 回调分别覆盖空队/全濒死队伍，库存/完成态不变，pending 不改判；获得合法临时队伍后同结果可继续。玩家后续实际验证自然初遇→赠球→无队伍提示/恢复，不用注入队伍冒充完整自然闭环。

### A2：IDLE 开始派遣未原子落盘，且异步开始未复核选择/导入代际（高）

- `usePokeFactoryGame.ts:1923–1988` 的开始分支在 fetch 后只调用 `setEventDispatches(RUNNING)`，未调用保存事务。成功显示由内存驱动，持久性依赖稍后的普通自动保存。
- 自动保存写失败仅 console，页面仍显示倒计时；刷新后开始丢失。随后领取的 `prepareDispatchResult` 仅承认磁盘 READY/到期 RUNNING，不能兑现从未落盘的开始。
- 开始分支 fetch 后只检查 `isDispatchContextCurrent()`，不像领取分支检查 generation / `skipExitPersistRef`。等待时改选择或导入，旧 continuation 可凭先前物种的资格更新新上下文。这些路径不能由现有 READY 领取迟到用例覆盖。
- 修复方向经 root 确认：开始须先持久成功后显示 RUNNING，失败保持原状态并反馈可重试；fetch 后及提交前复核 generation、导入保护、当前选择/Owned。沿用原10小时和概率，不扩大设计。
- 验证：必须使用实际 IDLE 开始回调，覆盖保存失败→重试、成功后刷新/导出、选择变化、离页再返回、开始工厂、导入期间迟到；验证无错误开始或错误成功提示。

## 其余契约审查

- F1/F3：item 使用 prepare + commit 两阶段；原物品、训练、3球、完成态一次主档 setItem，失败前不写内存奖励。已保存 pending 优先，首次准备失败仅同页保留；同次完成幂等、新次允许。
- F2：球移到 `baseInventory`，四球白名单、非负安全整数校验。普通工厂背包不显示球，控制器拒绝球；新工厂事务使局外快照失效并保留球。
- F2/F3：join 与 catch 使用新事务；`commitPermanentAcquisition` 除定义/静态测试外无生产调用。失败投球扣一球，成功扣球及 Owned 同写；已提交记录用于拒绝重复。
- F3：普通持久化、钱包和工厂事务沿 `serializeSaveData` 保留当前已落盘库存/pending/完成记录/资源快照。整档 replace 使用导入本身，退出/自动资源保存有导入保护。资源快照由统一 inventory revision 保护，不能宣传为完整事件战断点。
- F4：配置 diff 仅 Alola 尾部增加 rock，首项 fairy、10小时和池保持；其他八地区及概率函数无修改。
- F5：新球计数和投球入口已接单一库存，三语言新增模板存在。既有地区/成长道具/属性名称仍有动态中文（旧 helper），不得据模板存在宣称整个事件页已完全本地化；手机可读性归后续 player。
- 九道具：控制器本任务 diff 限于球/事件物品接线；原九道具效果实现与既有轮次事务未被修改，既有测试继续通过。浏览器代表回归仍待修复后最终 SHA。
- 跨标签强一致、事件战完整恢复、实体 Android、生产验收均未证明。此次未扩大到这些范围。

## 独立串行门禁

日志位于 `audit-static-7c27209/`，按 lint → test → build → go 顺序：

| 门禁 | 结果 |
| --- | --- |
| npm run lint | PASS |
| npm test | PASS，387/387，0 skip/cancel |
| npm run build | PASS，9.96秒；主包693.70 kB/gzip209.94 kB，保留 >500 kB 提示 |
| go test ./... | PASS，4包通过，server无测试 |
| git diff --check | PASS |

通过静态门禁不撤销 A1/A2。修复后需新冻结 SHA、独立复审及相应四门禁，再交 player。

## 复审：13dd1f222c1630ff56c67791aa46f887575c7bf3

裁决：**BLOCKED，A1 已关闭；A2 持久开始及迟到保护已改善，但真实旧 builder 仍能撤销开始。**

- A1：无队/全员濒死在目标生成前和 await 后均检查，deferDispatchBattle 保留 READY/pending/资源，不扣球不完成。健康后备+首发濒死转既有 POKEMON 面板，现有 switchPokemonInRound 支持无耗回合的濒死补位。9项新增静态用例已覆盖此处及 A2 开始故障/迟到；未运行游戏。
- A2 改善：startEventDispatch 单次持久成功后才同步 RUNNING，校验当前选择/Owned/资格/状态；开始 fetch 前后检查 generation/skipExit/当前选择。写失败有可见反馈，开始时间用实际成功提交时刻。
- **A2 残留可复现**：buildCurrentSaveData 使用 `baseInventoryRef.current` 的最新 revision，却把同一次旧 render 的 `eventDispatches` 放进 draft。syncEventSave 先更新 ref，再排队 setState。旧闭包在新 render 前保存时，会形成“revision=1 + IDLE”；serializeSaveData 的 `< stored.revision` 判断不成立，覆盖磁盘已保存的 RUNNING。
- 已执行静态脚本 `audit-stale-builder.mjs`，提取实际生产 `buildCurrentSaveData` 与 `syncEventSave`，使用真实 `startEventDispatch`/`persistSaveData`。仅 React setters 为 no-op，模拟尚未 render；没有用手写替代 builder。结果：开始磁盘 RUNNING/rev1 → 旧 builder draft IDLE/rev1 → 保存后磁盘 IDLE/rev1。日志 `audit-static-13dd1f2/stale-builder.txt`。
- 当前新增测试仅把旧 revision 的 stale 对象直接交给存储，未经过实际 builder/ref 混合，故未捕获该问题。不能以新增纯存储测试替代实际闭包回归。
- 最小防护方向：builder 的事件状态须绑定对应 render 的 revision，不能借最新 ref 提升旧 dispatch 的可信度；补齐 callback 依赖以保证新 render 获取新 revision。保存当前用户选择、时钟到期更新仍须可行，不应一律忽略所有事件字段。

独立串行四门禁再次 PASS：lint、396/396 测试（0 skip/cancel）、build 6.48秒（保留主包 >500 kB 提示）、Go4包；git diff --check PASS。日志 `audit-static-13dd1f2/`。除审计脚本、报告和日志外无修改，不提交、不运行游戏。修复后须新 SHA 复审。

## 最终复审：11573909569213af6cadd62e46b266ff83c4dbba

**全切片静态裁决：PASS，A1/A2 均关闭。** 前述 BLOCKED 为历史轮次，保留以说明修复来源。

- 最新业务 diff 仅让 buildCurrentSaveData 使用同次 render 的 baseInventory，并补上 callback 依赖。事件 dispatches 与 revision 不再来自不同代际。未创建另一账本或抹掉正常 UI 字段。
- 保留原 `audit-stale-builder.mjs`。新 `audit-stale-builder-fixed.mjs` 补入当前生产回调所需 state，独立提取实际 builder/sync；仍模拟更新 ref 之后、React render 之前旧闭包保存。输出：旧 draft revision0、IDLE；磁盘 revision1、RUNNING 保留，startedAt/readyAt 不变。真实序列证明 A2 残留关闭；日志 `audit-static-1157390/stale-builder-fixed.txt`。
- 新增生产闭包回归验证新 render 的地区选择与到时 READY 仍可保存。A1 的空队/全濒死 pending 保留和健康后备换人路径继续有效，A2 的原子开始、保存失败、选择/离页返回/工厂/导入/Owned迟到拒绝测试继续通过。
- 重新核对第一轮 F1–F5 审查和两次修复：单一永久库存、item 原奖励/训练/3球一致提交、join/catch一次消费与来源记录、最新保存保护、整档导入、工厂隔离、阿罗拉rock/10小时均无剩余静态阻断。

独立门禁严格串行全部 PASS：lint；397/397 测试（0 skip/cancel）；build 7.64秒；Go4包（server无测试）；git diff --check PASS。原始门禁日志 `audit-static-1157390/`。已验源码仍冻结1157390；没有业务修改、提交、开发服务器或游戏运行。

### 交给 player 的验证边界

本 PASS 仅静态门禁，不代替运行验收。最终1157390仍需真实Go+Vite上的R1–R7：自然岩狗狗阿罗拉开始/10小时，受控结果赠球与失败重试，无可战队伍不完成且可恢复，真实库存消费与捕捉/满队处理，导入/刷新/普通工厂隔离，以及三视口/三语言和九道具代表回归。受控时钟不等于真实等待，模拟触控不等于实体Android。事件战完整恢复、跨标签强一致、现存动态中文、主包>500 kB与生产验收仍按既有边界记录。

## 运行阻断后的独立复审：a70320b8f9dea7883b4e4f8f16c5832234f92cbb

**静态裁决 PASS；1157390 的静态 PASS 及其后实玩发现的 LOSS 返回阻断都保留，旧运行结果不得充当当前 SHA 验收。**

Player 在1157390发现：败退继续只显示BASE而未结束wallet run，实际保存仍为ROUND_RESULT LOSS，prepareDispatchResult因此拒绝。此轮只修已结算LOSS返回基地的事务及反馈，不修改租借随机生成或九道具。

### 修复审查

- `returnFromFactoryLoss` 从真实当前主档读取，要求匹配run和READY/ROUND_RESULT/LOSS；未结算、错误run或WIN不允许经此通路结束。阶段不限于第1战，所有已结算LOSS共用。
- 一次writeEventSave同时将wallet revision递增/currentRunId清空、runSupply清空、factory checkpoint清空，并递增baseInventory revision和保存局外临时资源快照。队伍来自结算已调用restoreFactoryParty的resume.playerTeam；球余额/交易、Owned/来源、pending/完成派遣及BP余额均保留。未新增BP发放。
- 主Hook只有存储成功后才同步wallet/supply/event refs、清battleResumeSnapshotRef、清当前遭遇并切BASE。失败不设置handledRoundResult门闩，保留结果页，错误走三语言模板；结果页已有role=alert和原按钮可重试。
- 再次点击旧continue闭包见walletRef.current.currentRunId=null即退出，不二次结束、不误处理新run。旧完整save受较新的wallet revision拦截；旧ROUND_RESULT builder调用getPersistableBattleResume时读取清空的snapshot ref，因此不能重新生成旧LOSS checkpoint。主档事件快照还沿A2的同render revision保护。
- 成功后session pending清理失败在既有clearPendingFactorySettlement内部捕获，不将已提交结果伪装为返回保存失败；刷新时无run/resume不再接旧intent。
- 新增真实回调序列测试覆盖结算前拒绝→真实LOSS结算→continue保存失败→重试成功→重复点击→旧保存→序列化重载→原pending battle领取，球和Owned一致。A1/A2的全部397项基础回归继续通过。

### 独立门禁及边界

串行 lint → test → build → go 全部 PASS：398/398测试，0 skip/cancel；build7.65秒，保留>500 kB告警；Go4包通过、server无测试；git diff --check PASS。原始日志 `audit-static-a70320b/`。

未修改业务、未提交、未运行游戏。允许player在最终冻结a70320b重新完成受影响闭环和R1–R7。尤其需真实败退返回→刷新仍BASE→赠球/pending战斗可继续，以及返回保存故障可见重试。静态闭环不代替自然长局、实体Android或生产环境；后台租借请求须隔离奖励RNG夹具验证，不能将夹具污染直接认定实现缺陷。

## 捕获资源循环后的独立复审：f713afd9b189b13e57e89404d638d1985c74eca2

**全切片静态裁决 PASS，A4 在静态effect调度模型中关闭；当前代码仍必须由player重新实玩。**

a70320b实玩发现捕获后Maximum update depth：runtime新成员缺少可选factoryChoiceLockedMoveName，而读档补null，原persistEventResources直接比较规范化后的磁盘对象与未规范化的runtime对象，反复保存和递增revision，触发依赖effect。保留原运行失败及静态before-fix日志，不能用本次静态PASS改写旧实玩结果。

- 业务diff仅persistEventResources：沿validateEventPersistentState与读档同口径规范化输入，再比较/写入规范对象。正常化过程复用既有sanitizeGamePokemonArray，不新增资源字段抛弃规则；有效HP、招式PP、状态、持有物等仍沿原读档语义保留。
- 旧revision和active factory run检查仍先于规范化/写入，故不能以旧资源恢复新run已失效快照。库存、Owned、派遣pending/完成态及A1/A2/LOSS修复路径未改变。
- 新测试提取实际生产useEffect，并以setBaseInventory调度下一轮调用，最多8轮。首次保存后一轮停止；再次相同输入无写；HP/PP、背包改变各一次写后稳定。此为实际effect代码的有限调度模型，**不是完整React挂载或浏览器实玩**。
- 已查作者before-fix：两项均明确在8轮未收敛失败；本次独立全门禁运行同两项通过。存储故障原文不变，解除故障可再保存；旧render revision及直接旧事务revision均不覆盖新快照。
- 原物品消费故障夹具此前给出的快照实际无protein，属于无变化写；现先持有protein再测试消费。新增断言失败后仍有protein、成功后背包为空且旧保存不能复活，属于补全真实前提与加强断言，没有删除故障/消费要求。

独立串行四门禁PASS：lint；400/400测试、0 skip/cancel；build7.53秒（主包既有>500 kB告警保留）；Go4包/server无测试；git diff --check PASS。原始日志 `audit-static-f713afd/`。未修改业务、未提交、未运行游戏。

交player冻结f713afd全片重跑，特别捕获后控制台无更新循环、UI可继续、球/Owned/临时队伍保存一致，以及HP/PP/背包真实变化、失败重试和刷新恢复。A1/A2/LOSS及九道具/手机代表回归仍需当前SHA证据；实体Android、生产、完整事件战续局、跨标签强一致边界保持。
