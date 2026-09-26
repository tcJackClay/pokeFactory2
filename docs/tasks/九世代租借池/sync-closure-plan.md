# 工厂资料同步闭包计划

## 问题与范围

隔离试验仅以百变怪 132 的 `pokemon` 和 `pokemon-species` 为种子，现有 `-full` 在 100 与 300 键限制下均于约 3 秒触发 `sync exceeded max entries`。`backend/internal/content/store.go` 的通用 `extractPokeAPIKeys()` 无视 JSON 所处资源类型，只要见到六类 PokeAPI 链接就继续递归。招式、特性、物种等响应含反向关联；这些链接不是工厂生成一只宝可梦时的依赖，不能作为同步扩展依据。

本任务把**九个互斥世代池的 Classic 工厂租借、敌队生成、六选三和首战**定义为首个可发布闭包。后续 Classic 战次共用相同的生成路径；Rogue 奖励、图鉴、事件另列模块闭包，不能把本闭包称为整站所有资源已覆盖。图片、叫声及 CSV 不属于 PokeAPI JSON 闭包，单独核查和打包。

## 从运行时代码推导的键集合

| 起点或响应 | 必须保留的依赖 | 应停止的递归 |
| --- | --- | --- |
| `storage/data/factorySpeciesIndex.json`、单世代随机池、允许的特殊形态池 | 为每个**实际可能抽中**且未被 `factorySpeciesRules.ts` 禁用的标识符加入 `pokemon/{identifier}`。再并入 `factoryReferenceSets` 中可能被训练家模板选中的 `speciesId` 对应 `pokemon/{id}`，以及固定 set 的招式名。以现行 `useReferenceSetPool=false`、敌方 `TRAINER_POOL_FIRST` 与全局回退为准。 | 不从宝可梦总表或图鉴总表扩成全部形态；不把非工厂资源当工厂种子。 |
| 每个种子 `pokemon/{identifier}` 的 JSON | `species.url` 指向的 `pokemon-species/{id}`；所有 `abilities[*].ability.url`；所有 `moves[*].move.url`，因为完整资料路径会从招式列表随机抽四招，必须覆盖每种可能结果。名称/ID 规范化后去重，拒绝不属于本地 PokeAPI 根路径的链接。 | `forms`、`held_items`、`location_area_encounters`、`types`、`stats`、`game_indices` 等所带链接不由当前工厂加工代码请求；仅使用已在 `pokemon` 本体中的标量资料。 |
| `pokemon-species/{id}` | 名称、性别率、基础亲密度等在同一 JSON 中，工厂成员加工不需额外 URL。 | `evolution_chain`、`varieties`、`egg_groups`、图鉴相关地区/世代链接均不继续展开。现有 `getFactoryCandidateMeta()` 只有索引缺失时才回退物种及进化链；发布前应以完整索引预检阻止这种隐形依赖，索引缺项要报覆盖失败，而非让线上随机关卡回源。 |
| `ability/{key}` 和 `move/{key}` | 本体已含中文名称、招式战斗数据及描述；同步后做结构校验。 | `ability.pokemon`、`move.learned_by_pokemon` 等反向宝可梦集合；以及 `generation`、`type`、`damage_class`、`effect_entries` 中的其他链接。它们是隔离试验快速扩张的主要可疑边，不应被通用递归追踪。确切增长来源须在带父键日志的小样本中验证。 |
| `pokemon-form`、`evolution-chain` | 当前允许池不需要通用 `pokemon-form` 抓取：`pokeApi.ts` 仅对 Unown 特殊形态走该端点，而工厂禁用物种 201。正常特殊形态直接走 `pokemon/{slug}`。完整索引命中时，工厂候选也不请求进化链。 | 不因 `pokemon` 中 `forms` 列表或物种的进化链 URL 扩散。若未来允许 Unown 或改变进化阶段计算，应明确扩展闭包和回归，再加入对应键。 |

`getProcessedPokemon()` 的六卡完整详情路径会取全部特性资料、物种资料及随机选出的四招；`getProcessedPokemonFromReferenceSet()` 会取 set 对应物种、物种资料、全部特性和固定招式。`useFactoryFlow.ts` 的 `buildFactoryPool()` 六个名额串行生成，敌队按同一选中世代、训练家 set 和全局回退生成。覆盖检查必须枚举全部可选来源，不能只用某次运行实际抽到的六只反推完整性。

## 同步器最小改造

1. 在 `backend/cmd/sync` 增加明确的 `factory` 同步范围，保留原有 `-full` 作非发布的通用模式；新范围从索引、允许形态和当前参考 set 配置生成工厂种子，同时让非工厂基础清单单独同步。不要给 `extractPokeAPIKeys()` 加一个笼统黑名单后继续通用遍历。
2. 在 `backend/internal/content/store.go` 为工厂范围提供按**父资源类型**解析子键的发现函数：仅 `pokemon` 解析 species、ability、move；species/ability/move 不再生子键。已下载响应直接进入待发布版本的暂存对象，避免“先抓一轮生成清单、再抓一轮制作版本”产生两次上游请求。统一规范路径、排序去重，manifest 每条记录父键/发现来源，便于解释为何被纳入。
3. 同步开始前核查索引覆盖 `getRandomPokemonIdentifier()` 可能返回的基准 ID 与特殊形态，核查参考 set 的物种和招式能进入闭包；如存在不被索引覆盖的可抽中对象，明确修索引或按规则排除，不能让 `getFactoryCandidateMeta()` 的回退成为发布必需数据的盲区。
4. 加硬封顶和阶段进度：小试验先用 2 分钟、200 键、100 MiB 与 2 worker；完整候选版初始保护建议 6000 键、1 GiB 暂存内容、90 分钟及 4 worker，实际阈值须据小试验产出调整并记录。每批输出已排队/已完成键数、类型分布、下载字节、耗时、失败键及当前父键。`-max-entries` 按发现集合与实际 manifest 双重限制，累积字节和总期限独立限制；现有单响应 64 MiB 读取上限应变为可识别错误。任何上限或网络错误都带非零退出码，不激活版本。
5. `PrepareVersion` 仍写隔离临时目录，正常失败删除临时对象；异常中断遗留的 `.tmp` 仅在确认路径属于指定 state 根且不对应活动版本后清理。PokeAPI 与 CSV 都准备完成后，对 manifest 键闭包、每个对象哈希/体积、工厂索引版本、固定 set 招式和图片报告做激活前校验。全部通过才原子写隔离 `current.json`；失败保留既有活动指针和旧版。可保留失败报告，但不得将部分内容当成成功版本。
6. 输出机器可读覆盖报告：逐代候选数、JSON 类型数、缺失键、版本总大小、素材前/背/官方画覆盖和运行调用链版本；为发布包保存源提交、索引哈希、素材报告时间与同步版本。CSV、图鉴总表等扩展资源应在各自模块独立验收，不能让它们的链接污染工厂闭包。

## 可重复验证

- **纯函数测试**：给 `pokemon/132`、`pokemon-species/132`、`move/transform`、`ability/limber` 固定响应样例，加入大量 `learned_by_pokemon`/反向 `pokemon` 链接；断言只发现种子物种、其能力与招式，且对子资源不再扩展。覆盖多特性、多招式、同 URL 去重、特殊形态 slug、参考 set 固定招式、非法外域 URL、缺少必需字段及索引缺项。
- **隔离同步测试**：使用本地假上游和空 state，断言小物种能在封顶内产生 manifest；版本对象仅抓一次；固定输入多次运行得相同键集合与哈希；超过键数/字节/期限、HTTP 错误和中途取消时，退出非零、清除临时对象、不改变已有 `current.json`。模拟 CSV 准备失败，确保 PokeAPI 的部分新版本不会变成活动版本。
- **覆盖校验测试**：从待激活 manifest 反推每个工厂 `pokemon` 的 species、全部 ability、全部随机可能 move；从参考 set 反推物种和固定 move；抽走任何一个键都必须阻止激活。图片报告与文件、URL 回退另行检查；缺第 9 代背面原图时按当前服务的前面图回退做画面验收。
- **生产式运行验收**：仅在上述小试验成功后于独立 state 同步九代，激活固定版本，清空浏览器缓存和运行缓存，`ALLOW_UPSTREAM_FETCH=false` 启动生产构建。九代各三次从六卡、六选三到首个可操作战斗命令，所有工厂必需 JSON 均返回 `X-Content-Store: VERSION`，图像来自 `BUNDLED` 或受控版本，无 `content_not_synchronized`。记录三次中位数、最慢值、请求路径及版本号，并复核游戏资料、招式与道具正确性；不把本次隔离试验的失败版本当成发布工件。
