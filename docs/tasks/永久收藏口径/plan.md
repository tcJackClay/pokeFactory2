# 永久收藏口径：技术方案与验证计划

状态：一次实质修订后获准Route A完整实施；已整合dev `a317686`，捕捉接线按串行授权完成，待独立auditor/player。起点 `0fd19eb`，工作树 `D:/Games/pokeFactory2-worktrees/permanent-collection`。

## 1. PRD 一致性与调研结论

F1–F4 可追溯至规则定稿末节及局外规则提案。后续用户明确“保留现有获得方式，补成永久收藏”，现有地区派遣加入与事件成功捕捉也成为获批来源。保留其原有概率、物种池、消耗及普通工厂禁捕捉；不新增赠予机制。下述新契约对应 orchestrator 更新的 F3/AC6。

真实代码入口：

| 入口 | 当前行为 | 本次处理 / PRD |
| --- | --- | --- |
| `usePokeFactoryGame.ts` collection effect（约901行） | 六候选/敌队记 Seen；playerTeam 同时记 Seen、Owned | 队伍只登记 Seen/既有 formKey；换怪、进化通过队伍更新自然覆盖 / F2 |
| 同文件 catchSuccess effect（约952行） | 事件捕捉成功事后登记 Owned，失败写盘仍已播成功 | 用捕捉提交回调在成功副作用前保存永久来源 / F3、AC6 |
| 同文件 resolveDispatchRegion join（约1702行） | 消耗球、登记 Owned、加入当前队伍、训练、成功弹窗 | 永久来源与领取收据原子落盘后执行现有副作用 / F3、AC6 |
| 同文件 resolveDispatchRegion battle（约1740行） | 用旧地区池启动可捕捉事件战 | 保留开战与池，携带派遣唯一键到捕捉提交 / F3、AC6 |
| `bindCompanionToSave` | 仅绑定 progress；Hook 忽略返回的存档 | 同次写入绑定与收藏，验证后同步 UI / F1、F3 |
| saveManager 读取/创建/替换及各事务写盘 | ownedIds 是无来源整数列表；版本14 | 版本升级，来源驱动永久索引；审计所有落盘入口 / F3 |
| CollectionScreen | 按 Seen 列表展示，拥有状态图标存在；无 Owned 筛选/数量 | 增加 Seen/Owned 单选及数量，结合原有筛选 / F3 |
| StartScreen / view-model / Hook | Breed 禁用占位、eggCount、breedingUnlocked | 删除占位与无用状态 / F4 |

租借进化没有独立 Owned 回调：商店更新 `playerTeam` 后被上述 effect 误登记。修复应覆盖这个真实入口，不修改进化规则或战斗控制器。

## 2. 改动面与状态契约

### 2.1 永久来源与存档（F1、F2、F3）

- 新增纯工具 `src/features/game/utils/permanentCollection.ts`（及测试）。`CollectionLedger` 新增 `acquisitions`，只记录正式获得的来源收据：`{ acquisitionId, speciesId, source: 'DISPATCH_JOIN' | 'DISPATCH_CATCH', regionId, dispatchStartedAt, acquiredAt }`。初遇来源仍由已验证的 `companionSpeciesId` 提供，不重复储存第二个绑定值。
- `ownedIds` 是初遇ID与有效acquisitions物种ID并集的去重排序索引，不反向授予永久身份；`seenIds` 保留遭遇并并入永久物种；`formKeys` 不改变粒度和来源。收据不是完整宝可梦个体，不新增等级遗传/养成规则。
- 收据唯一键为地区ID与该次派遣 `startedAt` 组成的稳定字符串，同次派遣只能产生一个永久获得结果；source不纳入唯一键以防join/catch重复授予。同ID不同内容拒收，不以最后一条覆盖。新同版记录缺数组或字段无效按corrupt处理；测试创建器统一提供空数组。手工伪造完整有效来源不属于防作弊目标。
- `SAVE_SCHEMA_VERSION` 14 → 15。旧版按既有 legacy 流程备份/清除，不迁移旧 Owned。原始旧档原文在用户清除前保持不变。
- `normalizeSaveData` 校验伙伴与来源收据后归一收藏；同版输入任意额外ownedIds不产生永久记录，Seen/Forms清理保留。已绑定初遇或有效收据缺失的索引可重建；来源本身无效则不猜测。
- `persistSaveData` 先完成现有伙伴保护，将已落盘与内存来源按acquisitionId合并后生成收藏，防旧自动保存擦掉永久获得。已落盘某派遣收据对应内存仍是同一startedAt的旧READY/RUNNING时保留已落盘完成态，防止自动保存复活旧领取入口。新开始的不同派遣不被此规则挡住。钱包/券/检查点保护顺序不变；显式同版导入替换仍整体使用导入档，不能与当前档暗中合并。
- 抽出局部存档序列化函数，将每个保存主档的 `localStorage.setItem` 入口使用同一来源归一；只归一收藏，不变更战斗检查点、事务顺序、版本校验或副作用。包含 `replaceSaveData`、钱包、结算、商店、换怪等写入口，pending settlement 的 sessionStorage 不是收藏主档。
- `bindCompanionToSave` 在一份 JSON 写入中同时保存绑定、Seen、Owned；成功回读校验三项。`confirmCompanion` 仅在成功返回后同步 `companionSpeciesId` 和返回的 collection，并进入基地；失败保留选择页和既有错误提示，允许重试。BP、亲密度无变化。
- Hook collection effect 保留Seen/Forms采集，Owned只从初遇与正式来源生成；删除租借与旧捕捉effect直接推ID行为，捕捉交由交易返回同步。不能仅靠读盘修正内存错误。
- 更新 `GameView.tsx` 旧档提示：v14 明确说明租借登记与永久收藏口径变化；v10 伙伴缺失提示保留，其余较新旧档用通用版本提示，避免误称逐场代币。原始备份和确认清除流程不改。

### 2.2 派遣正式获得交易（F3、AC6）

- 保留事件入口、选择/计时、现有item/join/battle概率、地区物种池、球消耗、训练与队伍容量行为。取消上一稿所有关闭入口、事后空领取或说明未开放的方案。
- 新增 `commitPermanentAcquisition(draft, record, completedDispatch)` 存档事务：回读有效当前档，以acquisitionId查收据；已存在且内容一致返回 `applied:false`，不发第二次；冲突拒绝。新收据与对应派遣完成态在同次主档setItem中写入并返回完整collection/events。失败抛出且原文未变。
- join：所有地区共用同步in-flight门闩覆盖异步取数据、抽签与提交，避免跨地区并发领取。提交前使用最新队伍/背包快照，成功后先同步资源ref再释放门闩。每次异步返回复核当前页面、工厂互斥与事件战状态，迟到结果不得覆盖新的上下文。先准备既有目标、验证球，生成稳定收据；事务成功后同步collection/dispatch，再扣球、更新队伍与训练、播放原成功弹窗。失败仍READY、显示保存失败可重试，不扣球、不训练、不加队、不得显示成功。重复提交不重复消耗与副作用；完成后刷新/重开同次不再领取。
- catch：EventBattleContext新增来源派遣键/startedAt。控制器在判定成功后、扣球/改队/成功文本之前调用 `commitCaughtPokemon(enemy)` 回调。回调返回COMMITTED/ALREADY_COMMITTED/FAILED，后两者保持敌方/球/队伍并展示保存失败/已登记提示，终止该简单轮次而不让敌方出手。复用现有runSimplePlayerRound同步进行中门闩覆盖首条异步日志，避免连点双重抛球；日志后复查epoch。已提交成功在成功文本后同步结束当前事件战，避免无epoch保护的延迟回调。结算回调显式传入控制器liveBattleStateRef当前队伍；派遣训练基于此快照更新，保留刚捕获成员。
- 正常概率判定为捕捉失败时不产生收据，仍按现有规则消耗球并显示挣脱；保存失败不是捕捉概率失败，不消耗球。满队成功时永久登记照常，后续替换UI取消不撤销已成功捕捉的收藏，队伍容量逻辑维持现状。
- 派遣捕捉来源在成功保存后即持久；本次不宣称保存事件战的完整敌队/背包/回合。事件战中途刷新尚无断点是既有缺口，记录在implementation/runtime中。已成功收藏离场、刷新及导入须保留。
- 开发者Mock只预览弹窗，不产生正式收据；普通工厂禁捕捉不变。join/catch来源取得的个体进入现有基地队伍不等于带入工厂；工厂启动仍六选三。

### 2.3 图鉴与取消入口（F3、F4）

- CollectionScreen 添加两项原生按钮式单选（`aria-pressed`、分组名称）：见过/已拥有；默认见过，Owned 选项仅保留 `entry.owned`。搜索、属性、地区筛选与此项取交集；空结果沿用列表空态，不显示未拥有候选。
- 已拥有数量使用永久 `collectionOwnedIds` 去重数，与过滤后的结果数量区分；Seen 数保留当前口径。小视口也显示永久数量，不再依赖 `hidden sm:flex`。不重写 Forms 或后台预取登记策略。
- StartScreen 移除 Breed nav、文案、Dna 图标分支、蛋徽标；四个剩余入口使用两列手机/四列宽屏，避免五格空洞。删除 Hook、GameViewState 中 availableEggCount / breedingUnlocked，BaseTab 删除 BREEDING。无独立培育页面，GameView 现有分发无需添加替代页。

### 2.4 文件所有权

主文件：`saveManager.ts` / `saveManager.test.ts`、`usePokeFactoryGame.ts`、`permanentCollection.ts` / test、`CollectionScreen.tsx`、`StartScreen.tsx`、`GameView.tsx`、view-model `common.ts` / `state.ts`、`uiStrings.ts`。控制器仅获准串行后接入捕捉回调与门闩；必要时更新测试版本14夹具，历史runtime不改写。

**saveManager.ts及测试已获独占**；收藏完整契约仍待本次修订批准。`useBattleController.ts`必须等状态任务审计/实玩/合入，再整合到本分支后才编辑；其余独立UI可先做。不得改resolveDamage或覆盖状态任务变动。若新增版本夹具，合并时串行更新，旧截图不沿用。

## 3. 可观察状态

| 字段/界面 | 契约 | 被验证项 |
| --- | --- | --- |
| `schemaVersion` | 新档15，14及更旧为legacy | T1、R6 |
| `progress.companionSpeciesId` | 确认前null；成功后唯一绑定；失败不变 | T2、R1、R2 |
| `collection.ownedIds` | 初遇与正式派遣来源的唯一物种并集 | T1–T5、R1–R5、R7 |
| `collection.acquisitions` | 唯一派遣获得收据；失败不增加，重入不重复 | T2、T4、T5、R7 |
| `collection.seenIds` / `formKeys` | Seen包含绑定与既有遭遇；Forms口径不变 | T1、T3、R3–R5 |
| `wallet.balance`、工厂 `playerTeam` | 初遇不发BP；租借队不因基地伙伴追加 | T2、R1、R3 |
| `events.dispatches[region]`、队伍/背包 | join保存成功才消费/完成；捕捉概率失败扣球、保存失败不扣；重复不重发 | T4、R7 |
| 图鉴筛选/数量、基地四入口 | 所见与存档一致，无Breed/蛋占位 | R1、R5、R8 |

## 4. 验证计划

### 静态验证（实现者与独立 auditor，AC5）

| 项 | 断言 / PRD | 方式与产物 |
| --- | --- | --- |
| T1 | v14拒绝并原文保留；v15空/绑定/派遣收据恢复；额外Owned不能授予身份；非法/冲突收据拒收；Seen/Forms保留 / F3 | `saveManager.test.ts`，状态断言 |
| T2 | 六种合法伙伴逐一绑定；重复确认幂等；setItem抛错无绑定/Owned；重试成功；旧自动保存不能冲掉；导出同版解析保持；BP不变 / F1、F3 | 扩展现有companion binding测试，模拟真实存储失败、落盘原文断言 |
| T3 | 纯登记租借/换怪/进化与重复成员只增加Seen，Owned不变；相同物种去重 / F2 | `permanentCollection.test.ts`，真实collection函数输入/输出 |
| T4 | join/catch交易写入失败原文不变；重复收据幂等/冲突拒绝；旧自动保存保留来源与完成态；同版导入完整替换不混档；全仓Owned入口审计 / F2、F3、AC6 | `saveManager.test.ts`事务状态断言；auditor列入口、捕捉失败扣球和成功保存顺序 |
| T5 | 现有结算/换怪/进化/商店/导入事务回归，主档落盘收藏来源一致 / F2、F3 | 全量saveManager tests加代表性原文断言，不复制全部事务测试 |
| T7 | 捕捉→胜利→事件训练不丢新成员；跨地区一次只处理一个领取，单球不双花/两球不丢成员；异步派遣期间切页面、进入工厂或其他事件战，迟到结果不写入新上下文 / F3、AC6 | permanentCollectionCallbacks.test.ts 提取实际源码回调与调用链，受控依赖验证；属于静态证据 |
| T6 | 四门禁 / AC5 | `npm.cmd run lint`、`npm.cmd test`、`npm.cmd run build`、`go test ./...`；实现与audit日志保存结果 |

### Player（最终固定代码，真实 Go + Vite）

所有证据由 player 写 `docs/tasks/永久收藏口径/runtime.md` 与 `evidence/`，记录 commit、服务cwd、浏览器、视口、控制台/HTTP。开始后冻结业务代码，若修改重跑受影响验收。主视口390×844，补320×568、844×390；模拟Chromium触控不是实体Android。

| 项 | 操作与验收 / PRD | 证据类型 |
| --- | --- | --- |
| R1 | 自然新档浏览六候选、改选，再确认；确认前Owned空，后仅选中ID，基地显示一致；立即图鉴已拥有只1，BP不变 / AC1、AC3 | 截图+localStorage前后JSON，自然流程 |
| R2 | 新隔离来源对主档setItem定点抛错，确认停留并报错；解除故障重试成功；刷新/退出重开稳定 / AC1 | 受控故障注入UI+JSON，明确非自然故障 |
| R3 | 设置与初遇不同世代；自然六选三、真实首战一次出招，Seen增加但Owned不变；队伍仅租借成员，不额外插伙伴 / AC2 | 自然模拟浏览器UI+检查点，不用DEV Win |
| R4 | 同版本受控检查点分别进入换怪与进化商店，实际UI换怪/租借进化；完整保存后Seen有对应ID、Owned仍绑定伙伴；失败/退出不清永久收藏 / AC2 | 受控注入UI+前后JSON，沿用商店夹具形状但用新版本生成，不引用旧证据 |
| R5 | 已拥有/见过与搜索/地区/属性组合，重复开关图鉴；导出后经设置真实导入，reload再看数量与伙伴；租借碰巧相同ID也仅计1 / AC1、AC3 | 截图+导出/导入前后JSON；同ID场景可受控 |
| R6 | 新隔离来源放入v14旧档；显示正确解释，可下载原文；取消清除原文不变，确认重置回初遇；导入旧档拒绝且当前档保留 / AC5 | 受控旧档UI与下载文件/原文哈希 |
| R7 | 受控READY派遣真实领取join、进入battle后成功捕捉：各新增可追溯收据，离场/刷新/导入保留；连点/重复领取不重发。注入存储失败不扣球/加队、不播成功，可重试；捕捉概率失败仍扣球且无收据；item回归，满队捕捉保留Owned；训练对象在队时捕捉后新成员仍在队；两地区READY并发领取仅单次处理，单球不双花、两球依次领取保留两个成员；派遣生成延迟时切页面/开始工厂/已有事件战，迟到结果不覆盖新上下文 / F3、AC6 | 受控分支/失败注入UI+JSON，球/队伍操作前后快照；不宣称事件战刷新恢复 |
| R8 | 中英文基地三视口，无培育/蛋数量或待解锁承诺；设置、图鉴、事件可进入返回；图鉴Owned筛选和数量不截断 / AC4 | 实际截图与触控操作，非仅DOM存在 |

受控存档应由当前版已有公开创建/解析函数与真实数据生成；不要把旧版JSON仅改数字冒充合法当前档。验证失败先检查harness（选择器、数据与事务落盘时机），再判断产品缺陷。

## 5. 风险与待审技术决定

1. **版本15会拒绝全部v14档**：符合不兼容旧档授权，但会让旧试玩夹具需重建；原始备份入口必须保留。
2. **来源索引不是完整个体**：初遇与派遣收据支持Owned，后续养成若需个体属性须单独定约；不把本任务称永久队伍养成完成。
3. **事件战刷新无完整断点**：永久获得交易持久，但既有事件战背包/回合无法续接；只验成功收藏离场保留，不扩大宣称。派遣join落盘完成态与收据一起写，不能靠事后effect。
4. **控制器串行依赖**：捕捉提交需要少量接线，等待状态任务完整合入后整合再改；saveManager版本独占已获排期。当前只先改无依赖UI。
5. **真实手机边界**：本任务可做模拟与受控；实体Android Chrome、生产验收仍归后续阶段。

没有新增玩法数值或概率；新视图列数属本任务取消入口后的布局选择。
