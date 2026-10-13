# 技术方案：TM 固定正文

状态：仅方案，等待评审与后续实施授权。调研主仓 `dev@82a98efecd263f1f788d7425456b086e64cc7a4c`；状态命中已合入，永久收藏与九道具尚未合入。本稿不运行游戏，不修改业务代码。

## 1. PRD 一致性与前置依赖

- 本稿 F1–F5 对应 PRD 的五条 Feature Spec；V 项同时对应 PRD 的边界与验收。来源是固定 Rogue `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014` 普通 `gBattleMoves_Mainline`、有效 GEN_LATEST 配置及 designer 的 `tm50固定正文与档位提案.md`。档位只是提案，不进入数据或运行常量。
- **blocked-by：九种持有物效果整合。** 其拥有 `data/battle/index.ts`、元数据提取器与控制器。实施前由 orchestrator 指定最新整合基线，重读合入后的真实 builder/提取器；复用它已核对的宏解析和四项道具元数据，不从旧主仓覆盖。永久收藏和状态命中结果也必须保留。
- 固定资格模块已提供 50 项名称、1076 身份、9981 项目兼容配对及 pending 准入。本任务不重新生成它的 `generated.ts/provenance.json`，不修改查询/兼容数据、售价或售卖状态；正文证据写在独立任务中，后续准入任务再关联。
- 不给报恩租借亲密度代决：保留已有成员 `friendship`，不设置255，不新增增长。其公式和源动态占位可固定；亲密度来源决策另行处理，不阻止正文调研。

## 2. 当前真实读取链与风险定位

| 路径 | 当前行为 | 本任务所需处理 / PRD |
| --- | --- | --- |
| `services/pokeApi.ts:fetchMoveByName` | 缓存未命中后取在线正文，再分别构造 Move 顶层与 battleData | 固定50先走本地正文；两个层次同源，不允许只改引擎/只改卡面（F1/F3） |
| 同文件 `fetchMove(url)` | 独立复制构造逻辑，直接读取资源URL | 名称/数值URL统一到同一已核对身份及工厂正文构造函数，禁止遗漏（F3） |
| `getProcessedPokemon` / `getProcessedPokemonFromReferenceSet` / `fetchRequiredMovesInOrder` | 玩家、敌队、参考套装均用 fetchMoveByName，普通随机从原始全 moves 选取 | 保持这些调用和合法物种/招式选择，构造成员的50项值自动统一；不借正文任务改池（F3/F5） |
| `data/battle/index.ts:buildMoveBattleDataFromPokeApiMove` | 泛用API数据+旧 override；读取可选flags | 对严格匹配的固定50入口委派固定转换，防止直接调用builder仍受在线版本污染；非50维持原行为（F3） |
| `services/pokedexClient.ts:fetchDexMoveDetails` | 图鉴独立fetch数值，界面读取 `detail.power` | 固定50由同一正文投影为DexMoveDetail，避免图鉴与战斗不同；其他招式不动（F3） |
| `BattleMovesPanel`、`PokemonDetailPanel`、`CollectionScreen` | 直接显示Move.power/accuracy，空值显示`--` | 使用小型显示语义helper，区分变化威力、无威力、必中、无需命中；中英均清楚（F2/F3） |
| `useGameLocalization` | 优先 flavor_text_entries，再zhDescription | 固定50提供跟踪的双语名称/简述，不能在线旧简述覆盖固定数值；保留现有语言fallback（F3） |
| `saveManager` / `restoreFactoryParty` | 已保存selectedMoves，恢复消耗只从当前成员读取；战间按maxPp/pp补满 | 本任务不重写存档schema或恢复事务；新构造招式数值固定，保存后保留同一正文和PP。旧存档兼容不属要求（F3） |

已读到的具体差异：固定顺风15PP、雷110威力、电磁波90命中、逆鳞120威力/10PP、空间−7；旧 `overheat` override 有 `thawsUser:true`，固定普通表在有效配置下没有该字段（C零初始化为false）。源 `MOVE_SNOWSCAPE=809`，项目已有PokeAPI `snowscape.id=883`，**两套数字ID不能混用**。这两项需要明确字段和身份所有权，不能靠展开顺序碰巧正确。

## 3. 最小改动面

| 文件（计划新增或修改） | 责任 / PRD |
| --- | --- |
| `scripts/generate_fixed_tm_content.cjs` + `.test.cjs` | 读取固定普通表与配置、生成50正文、严格校验/--check；只生成本任务产物（F1/F5） |
| 九道具已合入的宏/条件解析工具 | 优先使用其已导出的解析函数；若未导出，在不改原结果前提下提取共享纯解析模块，并回跑九道具来源测试。具体文件名以其最终实现为准（F1/F3） |
| `src/features/game/data/fixedTmContent/generated.ts`、`types.ts` | 50条基础标量、原始语义、目标/效果信息、配置及来源版本；独立于大兼容矩阵（F1/F2/F5） |
| `fixedTmContent/identity.json` | 项目 `Move.name`、PokeAPI数字ID与核对来源；不使用Rogue数字ID冒充API ID（F3/F5） |
| `fixedTmContent/localization.ts` | 已有中文名称优先复用、英文名称核源、50项准确简述与来源定位；不带待定价格（F3） |
| `fixedTmContent/index.ts`、`battleMapping.ts` | 纯查询/目标/语义转换；不发网络请求、不自动准入、不导入重型资格矩阵（F1–F4） |
| `src/services/fixedTmMove.ts` | 从固定正文、双语文本、生产battle builder构造全新Move；不与battleMapping形成循环依赖（F3） |
| `src/features/game/data/battle/index.ts` | 固定50先进入专用映射；保留九道具metadata与非50通路（F3） |
| `src/services/pokeApi.ts`、`pokedexClient.ts` | 固定50优先读取、共享构造/图鉴投影，网络失败不回退另一版本（F3） |
| `fixedTmContent/presentation.ts`、三个上述招式展示组件、`src/uiStrings.ts` | 只修源语义无法用裸数字正确表达的字段；标准数值直接取同一正文（F2/F3） |
| 各模块附近`.test.ts`、`services/pokeApiMoves.test.ts`、`pokedexClient.test.ts` | 真实生产构造/读取/投影/PP隔离断言（F1–F5） |
| 本目录 `source-expectations.json`、`provenance.json`、`effect-dependencies.md`、implementation/log | 独立50项期望表、摘要/配置、逐项效果执行器/缺口、静态记录；player另写runtime/evidence（F4/F5） |

不改 `useBattleController.ts`、伤害/轮次/存档业务算法、奖励池/商店交易/商品价格、1076映射和9981配对。若正文接线必须新增战斗机制才能正确执行，记录依赖并交回orchestrator，不顺带实现。正文生成输出局部LF规则沿已核实的fixedTM方案，禁止全仓换行变更。

## 4. 固定来源提取与字段契约

### 4.1 提取（F1/F5）

1. 输入：显式 `--source <pinned-checkout>`；核Git提交与原始源文件SHA256。至少锁定 `src/data/battle_moves.h`、`src/data/party_menu.h`、`include/config.h`、`include/config/battle.h`，被读取的常量/脚本也列原始摘要。记录实际输入而非只记录HEAD。
2. 限定 `gBattleMoves_Mainline`，按已跟踪后端TM50键与固定TM名单逐项核对；只输出这50项。禁止选revised表、动态TR，禁止拿全招式元数据覆盖表当做正文全量准入。
3. 展开受支持的常量别名、括号、布尔/数值、GEN比较和#if/#elif/#else。GEN_LATEST递归取GEN_9；不能把GEN_9字面字符当9（源枚举值是8）。使用九道具已审核的解析器，不能eval。未知表达式、重复有效赋值、缺必填、重复TM、分支栈错误均失败，不默认0/false。
4. 必填基础字段：effect、power、type、accuracy、pp、secondaryEffectChance、target、priority、split。布尔字段确实未写时仅按C零初始化，并记录为“源省略false”，与“解析失败”分开。需要的argument及其符号必须保留。
5. `B_USE_FROSTBITE=Rogue_GetRevisionModeActive()` 是运行函数表达式，不当作GEN数值求值。本产品锁定普通模式，映射freeze-hit/freeze-dry为冻结；provenance显式记录该语义依据。若源/config变化导致这个解释不再成立，生成失败等待复核。
6. 保留原始字段、有效分支、表达式、已求值值、符号/行位置于provenance；生成记录存必要语义。不支持的互动标志留在效果依赖表，不能悄悄丢掉后宣布完整。
7. 生成器先完整校验，再只写指定正文/provenance；`--check`严格无写入、字节比较。固定参考摘要按原始字节，项目文本输入按注明的LF规范化；产物LF。与已有生成器同样验证Windows Git独立检出后重现。

### 4.2 正文数据结构与转换（F1/F2/F3）

`FixedTmBody` 保存 `tm/moveName/sourceMove`、sourceEffect、属性/类别、`sourcePower` 与 `powerMode`、`sourceAccuracy` 与 `accuracyMode`、基础PP、priority、sourceTarget/runtimeTarget、secondaryEffectChance、argument、必要flags及内容版本。语义值固定为：

| 源含义 | 运行/显示契约 |
| --- | --- |
| 普通固定伤害威力 | Move.power为相同数值；UI照值显示，实际伤害仍走引擎 |
| 变化技power=0 | Move.power=null，powerMode=status；UI“—”，不伪装1或默认40 |
| 报恩power=1占位 | sourcePower保留1，powerMode=friendship，Move.power=null；battle effect保持FRIENDSHIP_POWER；UI“变化 / Variable”及亲密度简述，不把1当最终威力。保留现有成员值与现有公式，不选择F1/F2 |
| 波导弹/燕返accuracy=0 | accuracyMode=always-hit，Move.accuracy=null；忽略普通命中骰子，但不附带bypassProtect或属性免疫豁免；UI“必中 / Always” |
| 自身/天气/场地/陷阱accuracy=0 | accuracyMode=not-applicable，Move.accuracy=null；无需对敌命中，UI“—”；目标语义决定作用侧，不伪造必中伤害 |
| 有数值命中 | 保持源数字，不让null/0的转换影响真实数值零边界或源外招式 |
| SEL / FA / BOTH / RND（本任务50中伤害目标） | 单打统一 selected-pokemon，sourceTarget仍记录差异；不加多人伤害折扣、不打两次 |
| USR | user；顺风保留TAILWIND效果作用己方侧，不能把它改成单个成员volatile |
| ALL天气/场地/空间 | entire-field，结合对应weather/fieldState；不是对敌状态技，不被其保护/替身/回避阻挡 |
| OPF | opponents-field，仅陷阱侧；不能误用到电磁波/混乱 |

本稿没有新玩法数值。所有固定数值由固定源提取；简述中的机制描述来自designer核对表，不用在线flavor里的数值替代。

### 4.3 battle builder字段所有权（F3/F4）

- `buildMoveBattleDataFromPokeApiMove(raw)`先严格识别name是否固定50。是则把原始在线标量视作非权威输入，委派 `buildFixedTmBattleData(body)`；不是仍走既有路径。固定分支不再先用在线数据造结果再无序叠加旧override。
- 基础字段/命中/PP/类别/属性/目标与源flags以固定正文为准。effect符号→项目执行器、主效果/次效果、施加者/目标、weather/fieldState由显式审核映射表负责；它是源脚本到当前模型的适配，不是读取任意PokeAPI meta。必须穷尽当前50出现的36类effect符号，未知effect报错。
- 例如能力提升主效果为保证生效，自降特攻是命中后使用者−2；不能把secondaryEffectChance=0通用解释为“不生效”，也不能把逆鳞的100解释为每击100%混乱。映射字段必须附script/提案定位。
- 九道具四项 `makesContact/ignoresKingsRock/sheerForceBoost/healBlockBanned` 继续由其固定普通源元数据接口提供；本任务同源原始值与该接口全50一致性测试。冲突时报错查源，不取两表OR、不用物理类别推断contact。
- 其余已消费的source flags（highCritRatio、thawsUser、ignoresProtect、ballistic等）固定值优先；过热的旧thawsUser=true须在固定分支被源false取代。未知/未消费的标志完整列依赖，不为方便扩写引擎。
- 新固定映射输出既有副效果结构，保留九道具独立畏缩与合法出招契约；不修改RNG次序、行动次数、能力等级应用/PP扣减。百分比/分数由源语义存储，涉及例如闪焰冲锋精确1/3反作用的完整执行正确性仍要单独效果断言，不把“已有recoilPercent”当验收。
- 缺执行器的效应用显式 sourceEffect + executionCoverage/dependency 记录；不得映射成NONE并标“已支持”。当前自然池已可抽到这些招式，本任务不擅自删除它们或新增禁用机制，但必须把不完整运行列为公开版阻断，不能把正文50/50写成效果50/50。

## 5. 生产读取、缓存与故障（F3及Edge Cases）

1. 小型固定50正文/身份/文本静态随包，`fetchMoveByName`先准确规范slug并查50表，命中后无需等任何move网络响应，使用 `createFixedTmMove`。不静态导入1076身份兼容数据。本任务记录实际包体增量；不预设“零体积”。
2. `fetchMove(url)`只识别明确的move资源路径。名称使用既有50name；数值必须查独立核对的PokeAPI数字身份清单。该清单在实施时用官方named资源一次性核对并保存响应身份与原始摘要（现有48条缓存可复核，缺项补一次研究读取），不能用Rogue moves.h数字兜底。任意未知URL/未知ID不能冒名命中，仍走旧非50读取；明确请求与响应name/id矛盾应报错。
3. 每次构造返回独立Move及嵌套battleData/文本数组，不能缓存一个可变Move给双方共用currentPp。缓存只存冻结模板，实例化才复制；新成员由现有路径初始化PP，固定基础pp来自正文，不把已消耗PP补满。
4. 图鉴固定50详情和名称fallback走相同本地数据投影，不先建立PokeAPI client再等失败。混合请求中只让非50走在线路径，局部失败不丢本地成功项。
5. 本地固定模块加载/构造失败必须抛错让既有加载重试入口接管，不回退在线异版本或把固定招式替换撞击。明确固定正文错误不能被普通 `catch` 当作随机候选失败吞掉；实施时须核查普通/参考成员构造的catch分类，必要时增加窄类型错误传播，不重构全部网络错误流程。
6. 固定简述替换这50项的在线flavor，至少跟踪zh-hans/en名称与源语义摘要；繁体沿既有fallback。UI裸数字替换只限power/accuracy语义helper。报恩已有成员F继续驱动引擎，通用图鉴没有成员不能显示某个虚构固定威力；不借本稿新增亲密度规则。
7. 新构造的两队/进化保留四招/换入成员保存同一Move正文版本；同版本刷新保持PP与正文。旧存档不迁移，禁止读档时无条件重构Move导致本场PP回血；如需用内容版本识别旧数据，须单独评审最小失效入口，不在本任务偷偷改saveManager。

## 6. 效果依赖台账（F4）

实施时按50逐行填 `effect-dependencies.md`：TM、sourceEffect、生产映射、现有执行器、现有测试定位、缺口、正文证据、战斗证据、售卖/价格状态。以下为已调研的批次入口，**不是已通过清单**：

| 批次 / TM | 当前执行入口/缺口 |
| --- | --- |
| 直接伤害/先制/高暴击：07、08、21、23、25、27、34、38、48 | resolveDamage/resolveActionSelection/typeEffectiveness；全场目标单打投影、必中保护与属性免疫、高暴击标志需正文链回归；地震潜地/场地互动仍列验收 |
| 动态/条件威力：01、03 | FRIENDSHIP_POWER/FACADE已有；报恩F口径待用户；硬撑烧伤豁免与异常资格已有代码需最终效果验收 |
| 自降/增益/目标降级：02、04、10、20、26、29、30、33、37、41、42、43、46、47、49 | secondaryEffects+applyMoveStatChanges及状态命中/香草链；固定主次效果/概率/目标须准确，旧图不替代 |
| 状态/反作用/畏缩：05、13、14、16、17、22、39、40、45 | 通用副效果、冻结资格、天气命中、FREEZE_DRY；九道具完成后保留独立道具畏缩；反作用精确计算与自身解冻单独验 |
| 天气/场地/侧状态：06、09、12、18、24、28、31、35、36、50 | controller与entryHazards/endTurn已有；源配置下的计时、接地、薄雾混乱保护/青草减伤仍需逐项；正文接入不自动打勾 |
| 破屏障：19 | BREAK_SCREENS已有伤害豁免及控制器路径；先移除再伤害、目标侧/保护/免疫必须效果任务核验 |
| 跨回合/换人：11、15、32、44 | 当前未发现完整solar-blade蓄力、HIT_ESCAPE或RAMPAGE执行器；日光刃坏天气半伤只见solar-beam名称特判。这4项维持明确阻断，不能用普通伤害替代通过 |

自然全moves池、接棒/祈愿等源外遗留不由本任务扩写；沿九道具台账保留为后续公开版问题。无论本轮50正文是否通过，admission仍pending，价格null，saleEligible=false。

## 7. 状态与验证契约

| 可观测字段/产物 | 含义 | 消费验证 |
| --- | --- | --- |
| sourceCommit、sourceFileHashes、effectiveConfig、rawFields | 原始源/配置分支和原始语义 | V1/V2 |
| tm、moveName、apiMoveId、sourceMove | 两套ID分离、名单不漂移 | V1/V3 |
| powerMode/sourcePower/Move.power、accuracyMode/sourceAccuracy/Move.accuracy、pp、priority、type、damage_class、target | 同一生产正文与显示语义 | V2–V5/V8 |
| battleData effectId/flags/secondaryEffects/weather/fieldState、sourceEffect与executionCoverage | 保留执行器语义和未实现缺口 | V4/V6/V8 |
| player/enemy selectedMoves.currentPp/maxPp、friendship、完整READY checkpoint | 消耗实例独立、亲密度不被改、刷新不补PP | V5/V8 |
| admission/price/saleEligible、资格模块生成摘要 | 数据/效果/售卖分离、既有资格不改 | V7 |
| bundle字节、move请求记录、错误类别 | 小表成本、失败不切另一版本 | V3/V5/V8 |

| 验证 / 追溯 | 具体方法与结果断言 | 路径/证据等级 |
| --- | --- | --- |
| V1 F1/F5 | 固定源HEAD+原始摘要；全50连续/唯一与已跟踪名单一致；未知表达式/分支/重复/缺项/错误SHA/配置改变均失败；--check无写入；独立检出重复生成一致 | 生成器CJS测试+provenance；静态 |
| V2 F1/F2 | **独立期望表**：从designer核对表及原始C逐项人工复核生成 `source-expectations.json`，禁止由生成器输出复制；测试全50标量和target/effect；单列顺风15、雷110、电磁波90、逆鳞120/10、空间−7，GEN分支反例用小fixture明确旧/新值 | 新fixedTmContent测试；auditor独立逐项对源复核，静态 |
| V3 F3/离线 | 名称及数值URL经真实fetchMove/fetchMoveByName构造50项；禁止fetch时固定项成功、混合图鉴本地部分成功；模拟在线返回错误版本不被固定项请求/采纳；错误ID/非move URL/响应身份不符拒绝冒名；未知项保留原链 | `pokeApiMoves.test.ts`、`pokedexClient.test.ts`；静态网络桩 |
| V4 F2/F3 | 生产builder对同名故意错误在线字段仍给固定结果；源0⇒null区分必中的攻击/无需命中的场地；Return不显示或执行固定1；固定目标单打一次；过热不自解冻、闪焰冲锋自解冻；九道具4flags全50一致，非50旧结果回归 | builder/content纯测试，现有engine结果测试；静态 |
| V5 F3/PP | 新玩家/敌方成员经真实构造链得到相同正文；同招实例互不共享，改一侧currentPp/嵌套值不影响另一侧/缓存；刷新保留消耗不补满；friendship前后不变；明确固定正文故障传播，不随机回退撞击 | service与现有checkpoint结果测试；静态；实际UI见V8 |
| V6 F4 | 50项每个effect有显式映射或明确缺口；未实现的11/15/32/44保留阻断，不映射NONE假通过；高暴击、主/次效果机会、自降和反作用数据与源脚本逐项核对 | effect-dependencies+auditor源审，静态；不声称效果全部正确 |
| V7 F4/F5 | 1076/9981资格模块产物未改、原测试仍通过；全50admission pending/price null/saleEligible false；不读取定价提案当常量；四门禁及生成器有源测试 | 测试/摘要/静态审计 |
| V8 F3/验收 | 最终冻结SHA真实Go+Vite；390×844中英：真实生产构造的顺风15PP、雷110、电磁波90、逆鳞120/10展示，行动消耗与完整轮次刷新；波导弹必中仍被保护/幽灵免疫、冥想/天气不被敌方保护挡、双方正文一致；320×568和844×390代表详情可读。TM01显示变化且friendship未改；TM17/33无move网络也显示正确正文；图鉴与战斗同值 | player runtime/evidence：受控招式/场景须标注，不改生产builder输出字段；这是正文接线代表，不是50项全部效果实玩/实体Android |

V8可用真实新租借样本后通过受控选择替换为**生产构造函数的返回招式**；记录原始生成步骤/版本与快照，禁止直接在测试存档补power/accuracy/battleData来“证明”正文。数值精确性以独立源表+静态结果覆盖全50；少量随机实玩不估计概率。

## 8. 审阅风险与需要明确的技术选择

1. **共享文件基线**：必须等九道具（及其前置收藏）合入，重新核对其宏解析与builder导出接口。本稿依赖接口若最终不同，更新plan后再实施，不猜文件名直接改共享代码。
2. **数字身份补齐**：50个name已核；URL数字入口另需固定官方API身份取证。明确只借API核ID/本地化，不借API决定数值；源Snowscape809与API883是防误映射固定反例。
3. **UI与文本范围**：建议双语简述一并固定，三个现有显示面共用语义helper；这是保证离线及避免旧文案覆盖的最小展示改动。报价/实际成员报恩亲密度选择仍待用户，本任务只显示动态语义并保留现状。
4. **固定字段优先级**：源权威值须覆盖旧override矛盾（过热解冻已证实）。保留有效执行器适配及九道具已定元数据，不能保留错误值来追求“零行为变化”。若出现未列出的产品冲突，停下报具体源位置。
5. **未完整效果的自然可达性**：四项跨回合/换人缺口仍在自然池。正文任务不准入也不能因此称自然游戏已完整；若用户希望临时禁用它们，这是额外设计决策，当前不代做。
6. **旧存档与异常fallback**：新正文不能在刷新时治愈PP；本任务建议不改schema。实现前需确认后续基线保存的Move可带正文语义字段；若必须调整读档/失效机制，另请orchestrator批准明确改动点。

当前交付仅plan/context，尚无源期望表、生成正文、测试或运行结果。以上6项供评审；不请求用户为实现细节重新定玩法。
