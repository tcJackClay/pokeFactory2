# 技术方案：基地事件界面修整

architect 拥有；2026-10-14。调研基线 `26a8e933a9357fe2f8aaa6055fa48a140c4cc5db`（包含永久收藏 merge `d4a17b6`）。当前仅方案，实施须等 orchestrator 批准。PRD 的 F1–F3、E1–E3 为本片唯一产品契约。

## 1. 一致性检查与真实根因

- F1/E1：已读 `永久收藏口径/runtime.md`，并打开 `final-244738d/r8-entry-return-matrix/en-base-320.png`。Standby 绝对定位在右上，伙伴绝对定位在左下；中间内容参与 flex 压缩，英文标题换行，状态与伙伴均不占布局空间。`index.css` 的低高度规则又缩小/移动伙伴、强制横屏内容 row。仅缩小字或增加 z-index 不解决空间分配。
- F2/E2：`EventsScreen` 的摘要与 picker 共用 `snapshotById`，自动 fetch effect 以 `pickerRegionId` 为前提。摘要把“选中但无数据”渲染成“未选择+不匹配”。`fetchDexSnapshots` 会吞单只失败并返回部分字典，不能仅靠 catch 判失败；当前依赖 snapshotById 的 effect 会重新请求缺失项，存在失败重复请求风险。
- F2/E2：`ensureSnapshots` 另一路请求使用闭包旧 map 覆盖合并，推荐异步完成只检查旧 render 的 `hasFactoryRunToResume`；离场、手动选新成员或清除期间应使旧推荐失效。实际领取/开始派遣另在 `usePokeFactoryGame` 真实 fetch、校验、互斥，本片不替换。
- F3：两页面多数中文判断使用 startsWith('zh')；事件标题、返回、计时动作和结果标题有固定简中。Mock 开关与说明即使 developerMode 关闭也显示。共享 `uiStrings`/types 无需修改。
- F3 范围已由 orchestrator 明确：只验页面自有文案；动态 lastResult/popup.message 不猜译、不删数值、不扩 controller 所有权。原始记录保留，完整结构化本地化列后续任务。本片不能称“整页所有语言已完成”。

## 2. 文件所有权与改动面

| 文件 | 改动 / 对应 PRD |
| --- | --- |
| `src/features/game/components/game-view/StartScreen.tsx` | F1/F3：状态、标题、操作、伙伴改为正常布局；接页面 copy；行为与素材保持。补齐现有 `copy.menuDeveloping` 未定义引用为本地禁用入口说明。 |
| `src/features/game/components/game-view/EventsScreen.tsx` | F2/F3/E2：接只读摘要加载器；五态显示、重试、异步推荐有效性；页面 copy、正常模式移除开发说明；已有交易 action 不改。 |
| 同目录 `baseEventUi.css`（新增） | F1/E1：仅 `.pf-base-event-start` 与 `.pf-base-event-events` 命名空间内布局。StartScreen import；不写 index.css，不影响其他页面。 |
| 同目录 `baseEventCopy.ts`（新增） | F3：页面自有 zh-hans / zh-hant / en 文案、数值参数格式化、既有地区英文名映射；不承担规则和发奖。 |
| `src/features/game/hooks/useEventDisplaySnapshots.ts`（新增） | F2/E2：本页面 hook，挂载/卸载与最新上下文、请求 store 订阅；不触达保存或战斗。 |
| `src/features/game/utils/eventDisplaySnapshots.ts` 与 `.test.ts`（新增） | F2/E2：页面专用请求状态容器，注入 fetchDexSnapshots 函数；并发去重、部分失败与过期请求单测。 |

**并行约束**：这些路径与九道具控制器/types/builder/数据提取不重叠；不修改 `usePokeFactoryGame.ts`、`useBattleController.ts`、saveManager、view-model、pokedexClient、uiStrings、constants、events 配置、伙伴配置。新 helper 类型保持本地。后续 TM 正文会改 pokedexClient，本片只用稳定 `fetchDexSnapshots(ids)` 接口；如其接口变更须重新评审，不并发擅改共享服务。

隔离分支 `codex/base-event-ui`，批准后从当前 dev 创建工作树，先核对上游差异。实现与运行均不在主仓做。最终合并其他代码后，旧截图只证旧冻结版本；需要在最终目标门禁重验。

## 3. 布局与文案实施契约

### 3.1 基地（F1/E1/E3）

1. hero 内改为正常流：状态独立顶部行，标题说明、主操作（含重试/结束按钮/错误）、伙伴独立区域。所有文本允许换行、min-width:0；状态不 absolute，伙伴不 absolute，背景装饰仍可 absolute。
2. 窄屏纵向排列；较宽/横屏用正常 grid 放标题与主操作，伙伴仍占真实区域。不足高度时整体页面纵向滚动；移除本页 `md:overflow-hidden` 和固定 h-full 压缩链，不用隐藏内容保首屏。状态/标题/伙伴/按钮均不能相交。
3. 现有短屏 `.pf-start-hero-content` row、伙伴 scale、按钮 margin-top 的 `!important` 必须在本任务 scoped CSS 明确覆盖或改用新结构 class 不命中旧规则；保留原有 orb 色彩、图标、尺寸响应设计，不叠新全局 media。
4. 六只伙伴素材、皮卡丘帧动画、reduced-motion、图片回退沿用；伙伴名字可换行。四入口数量、SHOP 禁用/未实现状态、resume/end/save-failed 逻辑保持。弹窗内容较高时可滚动、确认/取消可达。
5. 改动不含顶部全局 BP/Round/Streak 栏；若它仍截字单独记录，不借本片宣称全站无截断。

### 3.2 页面文案（F3）

1. `baseEventCopy` 精确区分 zh-hans / zh-hant / en，其他现有语言沿英文 fallback。覆盖基地标题、状态、主操作、余额说明、结束确认与错误、四入口及禁用提示；事件标题/返回、选择/清除/推荐、状态/失败/重试、派遣动作、剩余时长标签、搜索/空态、picker 匹配徽章/关闭、弹窗自有标题。
2. 地区英文名复用 SettingsScreen/CollectionScreen 已有九项对应关系，复制到本任务只读映射并注明来源（现有常量不导出，避免改共享文件）。简中沿 region.name；繁中地区/地点/伙伴静态名称没有专用字段，保留已有 fallback 并记录缺口，不凭字形转换生成专有名。
3. Dex 名称继续用 `getLocalized({name:apiName,names,zhName})`；真实数据有精确繁中时自动采用。缺名称时沿当前服务 fallback，不让名称缺失变成资格不匹配。属性文本复用现有 TYPE_ZH / 英文 type key；繁中属性缺专用数据同样明示范围。
4. 普通事件页删除 Mock 开关和引导说明；开发模式仍可由已有 Settings 开关启用。预览按钮只在 `devToolsAvailable && developerMode` 下出现，使用明确的开发预览文案并保留原调用和续局禁用；不改变全局 developerMode。
5. `lastResult` 与 popup.message/itemName/pokemonName 均保留实际原文，不能由类型/队伍现状猜测旧结果。已有 message 优先；无 message 的页面兜底加入句翻译为自有文案。不新增“自动保存事件战”等承诺。
6. 模态框限制在可用视口高度内并滚动，关闭按钮可达；正常页面不再展示 Mock 文案，不删除真实派遣要求/时间/消耗。实际全局 alert/controller 文案保留上游边界。

## 4. 异步摘要状态与数据流（F2/E2/E3）

### 4.1 单只记录与请求

- 局部 store 按 species ID 保存 `loading | ready | error`，未请求记缺省 idle。ready 含原 DexSnapshot；error 不伪造空 types；选择为 null 的“未选择”是 UI 派生状态，不写 store。
- 请求 ID 集合：所有当前 `eventDispatchPokemonByRegion` 非空 ID 常驻加载；picker 打开时再并集 Owned；推荐时显式请求 Owned。去重已 ready / in-flight；retry 只重试当前 error ID。失败后不自动循环请求，只有用户重试或新组件生命周期再试。
- 每请求记录递增 token；成功只接受 request token 仍匹配的 ID，按 ID 增量合并，不能覆盖另一请求已完成的字典。返回缺 ID、错误 ID、无法判定的空类型按该 ID error；一批部分成功独立呈现。
- store 用 finally 收尾每个当前请求，不留卡死 loading；服务异常与返回空字典均能到 error。底层已有超时/错误输出；本片不改其缓存或重试策略。相同 ID summary/picker/推荐复用同一 in-flight Promise。
- hook 卸载取消订阅并废弃此实例；迟到响应不得通知卸载组件或触发选择 action。React StrictMode 的 setup-cleanup-setup 创建独立存活实例，不能复用永久 disposed store。底层 API 无 abort 参数时只忽略过期结果，不谎称网络已取消。

### 4.2 UI 五态及当前上下文

| 条件 | 名称与资格显示 | 行为 |
| --- | --- | --- |
| selected ID 为 null | 未选择；提示选择 Owned | 原选择/推荐行为 |
| 有 ID，idle/loading | `加载中 #ID`；资格 `正在读取属性` | 不显示未选择/不匹配；原派遣按钮交原 action 独立校验 |
| 有 ID，error | `#ID 资料加载失败`；资格未知 | 显式重试；不清掉已选 ID，不修改派遣状态 |
| ready 且符合类型 | localized 名称、ID、真实类型、匹配数量 | 匹配按现有 requiredTypes 交集 |
| ready 且不符类型 | localized 名称、ID、真实类型、不匹配 | 不重写资格，也不靠显示层放行 |

- 显示始终用 render 中当前 selected ID 取 record，A 的迟到响应不会把 B 的摘要换回 A。改变语言只重新格式化现有 snapshot，不清选择、不重新发奖。
- 推荐开启时捕获当前 Owned 签名、全部选择签名、region、操作序号；完成后检查 mounted、最新 hasFactoryRunToResume=false、签名一致、操作序号仍当前，才调用原 setEventDispatchPokemon。手动选、清除、再次推荐、退出页面均使旧操作失效。推荐抽样范围与原随机算法保持，不改资格。
- 部分 Owned 获取失败时推荐不从残缺候选池悄悄抽样：显示加载失败可重试，已有选择保持；全部加载成功但无匹配才显示“没有符合地区属性的已拥有宝可梦”。这是显示完整性约束，不新增资格。
- picker 可先展示已加载候选，同时标注剩余加载/失败数量和重试；“没有宝可梦”只在 Owned 真空，“无搜索结果”在有数据但筛选为空。失败状态不能伪装空收藏。
- resume 时关闭 picker、取消未完成推荐；选择/清除/推荐/派遣领取/开发预览仍 disabled，摘要与只读重试允许。最终动作仍由原 controller 的 ref guard 阻止；不改互斥门闩/存档/支付顺序。

## 5. 可观察状态契约

| 字段 / 观察点 | 类型 / 位置 | 消费用例 |
| --- | --- | --- |
| selected IDs、Owned、dispatch status/readyAt | 原 view-model + 导出主存档；不写新 schema | V2–V7 |
| record phase、ID、名称、匹配数 | 对应地区摘要 DOM：稳定 `data-region-id`、`data-selected-id`、`data-load-state`，可见 status 文案；不暴露业务动作 | V2–V5 |
| 每 ID 请求次数、延迟/失败 | Playwright network/request journal；helper 注入 Promise | V2–V5 |
| 当前语言、hasFactoryRunToResume、gameState | 原存档/只读 view-model + 按钮 disabled 与页面标题 | V1/V4/V6–V8 |
| 基地各文本/控件 rect 与 scrollWidth/clientWidth | DOM geometry + viewport screenshot，稳定后读取 | V1/V8 |
| BP、球、队伍、Owned 收据与派遣记录 | 主存档 + 原只读 view-model（事件队伍不完整持久化） | V6/V7 |

不新增 debug action/API；异步 helper 的 private token 由单测验证，浏览器以可见结果及请求记录验真。

## 6. 验证计划

实现者只做静态门禁，独立 auditor 审 diff/状态契约；player 使用冻结最终提交、真实 Go+Vite、独立 origin，HMR 关闭。所有截图/结果写本任务 `evidence/final-<SHA>/`，包含 manifest、源 SHA、环境、受控项与请求日志。不能挪用 244738d 旧图作本次 PASS。

| 编号 / PRD | 断言与方式 | 文件 / 证据 |
| --- | --- | --- |
| V1 F1/E1/E3 | 新档自然选伙伴→基地；中英三视口状态/标题/名字/主操作/四入口均可读可点、无相交与横溢出；繁中三视口抽查最长文案；所有六只英文伙伴名用合法档补测标受控。短横屏可纵滚。 | `evidence/final-<SHA>/v1-layout/` 截图+geometry+操作记录 |
| V2 F2/E2 | 冷浏览器直接进事件，已选原野水母或另一现有合法档，不打开picker；看到loading后真实 API 完成自动正确名称/属性/匹配。单测 selected null/loading/error/ready 派生值。 | `eventDisplaySnapshots.test.ts`；`v2-summary/` 状态/网络/截图 |
| V3 F2/E2 | 截断一只真实API请求（单次失败）→该只error，另只成功；无自动请求风暴；已选/收藏不变；解除后点重试成功。不把全部失败当空Owned。底层预期console error分类保留。 | helper 可控Promise测试；`v3-retry/` 请求次数+主档前后+截图 |
| V4 F2/E2/E3 | 延迟A→UI清除/改选B（B可先已加载）→释放A，摘要仍B；推荐等待中清除/改选/返回基地，释放后不得改选择；UI导入另一合法当前版档会reload，旧页面请求不得污染新档。 | helper并发/token单测；`v4-stale/` 前后快照+真实UI动作 |
| V5 F2/E2 | 打开关闭再开picker、同时summary/picker读相同ID，成功仅一份in-flight；失败重试能恢复；搜索无结果与Owned空和加载失败分开；推荐全部成功无匹配才给无匹配说明。 | helper去重/部分失败单测；`v5-picker/` 网络+截图 |
| V6 E3/F3 | 合法可续工厂档进基地→事件，各改选/清除/推荐/领取按钮disabled，picker关闭；只读summary照常加载。返回继续挑战仍恢复原 checkpoint。结束确认取消不丢进度。 | `v6-resume/` UI+checkpoint before/after；不改内存action |
| V7 E2/F3 | 受控READY派遣+已有球，经真实按钮领取一次，Owned收据+球+派遣状态符合原成功交易；双击不重复；截图原始动态结果/训练数值仍在。球不足一次原失败提示保留。不得为本片发明自然球来源。 | `v7-dispatch-regression/` 主档+只读状态+截图；受控READY/RNG/球逐项声明 |
| V8 F3/E1 | 中简/中繁/英各自页面自有copy一致；英文320及横屏picker/弹窗可触达关闭；正常mode无Mock按钮/提示，Settings明确开开发mode后才有预览；动态原文与专名fallback单独列清单，不算漏测通过。 | `v8-copy/` DOM text+截图+已知语言缺口表 |

四门禁在实现停止写入后统一跑并保存退出码：`npm.cmd run lint`、`npm.cmd test`、`npm.cmd run build`、`go test ./...`。不写纯样式镜像测试；可控 Promise 测试至少覆盖部分空结果、reject、去重、retry token、增量合并、dispose；原收藏测试全跑。新单测文件由现有 glob 自动纳入，无需改 package.json。

视觉阅读质量由 player 人工看关键图，geometry 只补证；新档/实际网络正常路径与受控迟到/失败分别标记。模拟浏览器不是实体 Android，未覆盖性能/生产/完整事件战恢复/全站本地化。

## 7. 风险与隐含选择（需 orchestrator 批准）

1. **允许纵向滚动**：320 与短横屏不强求所有内容同屏，布局使用真实占位。这来自 F1，具体间距沿现有设计，只为避免交叠调整；不引入新触控手势。
2. **局部加载失败的推荐策略**：部分失败时不抽残缺池，而要求重试；防止数据缺失改变既有随机候选分布。普通开始/领取仍走原 action，不依赖本地摘要 ready。
3. **开发开关位置**：事件页不再主动向玩家推荐 Mock；Settings 原开关保留，已启用的开发预览按钮明确门控。这是移除面向玩家调试说明的最小处理，未删测试能力。
4. **本地化数据缺口**：events region/site 只有简中；伙伴 config 无繁中；TYPE_ZH 无繁中；popup Pokemon 无ID、消息和 lastResult 是创建时拼好的原文。英文地区可复用既有映射，动态结果/其地点/专名缺口保持原文。后续需独立结构化事件结果与多语言数据任务；本片仅自有文案完成，orchestrator 已确认此边界。
5. **共享缓存与证据**：pokedexClient 单例会缓存成功快照且吞失败，冷加载/故障用全新浏览器 context，失败必须发生在该 ID 首次请求；不能用暖缓存声称重试链通过。当前上游异步校验真实权限不因摘要显示而更改。

其余已知问题（自然球来源、岩狗狗资格、95%旧捕捉上限、事件战完整恢复、全局顶部字样）均未纳入本片，不得因本片 PASS 消失。
