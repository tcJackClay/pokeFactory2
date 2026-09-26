# Rogue TM 到工厂奖励的映射覆盖核查

核查版本：主仓库 `58cb4234` 的工厂索引与战斗实现、隔离工作树 `codex/tm-source-extract` 的抽取结果；Rogue `expansion` 固定提交 `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014`，普通 profile 模式。只读核查源码与数据，没有运行游戏。本文中的“静态候选”表示还需战斗测试，不能直接发卡。

## 物种与形态

`storage/data/factorySpeciesIndex.json` 有 1076 条：1025 条基础物种的 `identifier` 是数字字符串，51 条可直接抽到的具名形态是文字。因此旧抽取报告里的 `41/1519` 只是把 Rogue 英文名称直接同工厂 `identifier` 比较得到的**名称提示**，不能作为物种覆盖率；它漏掉全部 1025 条数字标识。

以 Rogue `include/constants/pokedex.h` 的 `NATIONAL_DEX_NONE` 后全国图鉴顺序为 ID，并对 `include/constants/species.h` 中的 `SPECIES_*` 符号别名逐级解析后，1025/1025 个项目基础 `speciesId` 都在普通 Rogue profile 的 `Species[]` 中找到对应条目。九代分别为 151/151、100/100、135/135、107/107、156/156、72/72、88/88、89/89、127/127。这是静态物种身份映射；不证明该物种的所有招式已在本项目实现。

51 条具名形态中，41 条按 `pokeApiName` 转成 `SPECIES_*` 符号直接命中；其余 10 条须显式映射，不能使用一般字符串替换：

| 本项目 `identifier` | Rogue profile 符号 | 证据/说明 |
| --- | --- | --- |
| `wormadam-sandy` | `SPECIES_WORMADAM_SANDY_CLOAK` | Rogue `species.h` 与独立 Sandy Cloak profile |
| `wormadam-trash` | `SPECIES_WORMADAM_TRASH_CLOAK` | 独立 Trash Cloak profile |
| `zacian-crowned` | `SPECIES_ZACIAN_CROWNED_SWORD` | Rogue 冠剑形态命名 |
| `zamazenta-crowned` | `SPECIES_ZAMAZENTA_CROWNED_SHIELD` | Rogue 冠盾形态命名 |
| `urshifu-rapid-strike` | `SPECIES_URSHIFU_RAPID_STRIKE_STYLE` | Rogue 连击流形态命名 |
| `tauros-paldea-combat-breed` | `SPECIES_TAUROS_PALDEAN_COMBAT_BREED` | Rogue 用 `PALDEAN` |
| `tauros-paldea-blaze-breed` | `SPECIES_TAUROS_PALDEAN_BLAZE_BREED` | Rogue 用 `PALDEAN` |
| `tauros-paldea-aqua-breed` | `SPECIES_TAUROS_PALDEAN_AQUA_BREED` | Rogue 用 `PALDEAN` |
| `wooper-paldea` | `SPECIES_WOOPER_PALDEAN` | Rogue 用 `PALDEAN` |
| `maushold-family-of-three` | `SPECIES_MAUSHOLD` | Rogue `species.h` 将 `SPECIES_MAUSHOLD` 定义为 `SPECIES_MAUSHOLD_FAMILY_OF_THREE`，普通 profile 记录前者；不能错误地用 Family of Four。 |

这 10 个符号均存在于固定 Rogue 的普通 profile 或其 `species.h` 别名链。故可建立 1076/1076 条工厂索引到 Rogue profile 的**静态显式映射**；必须把上述 10 条作为人工维护的例外表，并以 `speciesId`、`pokemonId`、形态名称三项交叉验证，避免同种不同形态套用错误 learnset。玩家换入敌队的成员使用其实际形态身份，不只用基础 `speciesId`。

## 招式 ID 与效果

`scripts/extract_rogue_tm_compat.cjs` 固定抽取 Rogue expansion 的 TM01–50。核查时访问官方 PokeAPI `/api/v2/move?limit=1000`，50 个 `MOVE_*` 经下划线转连字符后全部精确匹配一个 PokeAPI 招式名称，即名称层面 50/50 可映射到本项目 `Move.name`。当前开发运行缓存 `var/pokeapi/runtime/v2` 有其中 48 个招式详情，缺 `freeze-dry` 和 `quiver-dance`；运行缓存不是固定发布内容库，也不证明战斗效果。正式发布应在固定版本内容库中收齐 50 项及使用到的图片/翻译，再关闭上游验证。

当前代码已有 PokeAPI 招式基本威力、属性、命中、优先度、状态及能力变化的通用处理，另有 `moveEffectTable.ts` 覆盖特殊规则。但名称能解析不等于完整战斗效果。以下 8 个 TM 的关键效果在当前 `MoveBattleData` 字段、覆盖表或战斗控制器中缺失/不符，不应直接发卡：

| TM | 招式 | 静态缺口 |
| --- | --- | --- |
| TM11 | `solar-blade` | 未找到蓄力回合处理；当前只出现在 Sleep Talk 禁用列表。 |
| TM15 | `volt-switch` | 有伤害资料，未找到命中后换下使用者的流程。 |
| TM18 | `snowscape` | 覆盖表将其设置成 `hail`；天气状态只有 `hail`，与雪景效果不符。 |
| TM24 | `toxic-spikes` | `FieldState` 无毒菱；未找到入场触发。 |
| TM28 | `tailwind` | `FieldState` 无顺风；未找到本方速度持续增益。 |
| TM32 | `u-turn` | 有伤害资料，未找到命中后换下使用者的流程。 |
| TM35 | `stealth-rock` | `FieldState` 无隐形岩；未找到入场伤害。 |
| TM44 | `outrage` | 未找到连续出招锁定及结束后混乱。 |

排除这 8 项后，**最多 42 项**可进入下一步逐招验收；不能把 42 写成已验证可发卡。`MOVE_BATTLE_DATA_OVERRIDES` 只对其中部分招式有专门覆写，其余可能由通用 PokeAPI 元数据处理；“无覆写”本身不等于不支持。战斗效果验收还须比较 Rogue 预期与项目实际，例如回报、冰冻干燥、戏法空间、雷电天气命中、能力变化、双打目标在本项目单打中的解释。当前奖励流程没有这份 42 项的逐招通过记录，因此**已证明可公开发放的 TM 数量为 0**。

## 四卡数量风险

Rogue 原始表有 1519 别名、14645 个 `(别名, TM)` 配对，不能用作四卡可生成性的分母。对本项目 1025 个基础物种，源表在尚未扣除已学招式和战斗效果前，16 种没有固定 TM，40 种少于 4 种。暂排上述 8 项后，17 种为 0，50 种少于 4；按九代的“少于 4”数量为 7、3、5、3、5、2、5、14、6。此处仅是物种级上界，不是实际三人队抽样概率，也没有计入实际所选三人、已学四招、换入敌队成员或运行时内容失败。

四张卡允许同时含道具与 TM，因而单一物种少于四种 TM 不必然造成卡片不足；但首版道具子池与重复规则尚未定稿，现有数据不能证明每个奖励节点始终能给四张**不同且可领取**的卡。实际候选公式应为：当前三名队员可学且未掌握的 TM 联集，交集于通过战斗效果验收及固定内容库覆盖的 TM；再加已批准、可装备且未违反重复规则的道具。若总数小于四，奖励节点必须保留可重试/可解释状态，不能无限抽样、重新抽旧卡或自动推进下一战；产品规则还需定稿一种补足策略。

## 持有物不重复与换怪

用户要求玩家三人的持有物保持不重复。代码目前仅在初租借/敌队生成的 `buildFactoryPool` 以 `pickedItems` 避免各自队内重复；`classicFlow.ts` 的 `swapDefeatedPokemon` 只替换成员，`useFactoryFlow.ts` 的 `performSwap`/`commitSwap` 不核对换入者与剩余两人的道具，奖励检查点也未校验整队。因此初始两队分别无重复不保证换怪后玩家队仍无重复。

本地固定原型 `reference/pokeemerald-expansion/src/battle_factory.c` 在生成租借六只和敌方三只时排除各自队内重复持有物（约第 294、455 行）；但 `src/battle_factory_screen.c` 的 `Swap_ActionMon` 只调用 `Swap_AlreadyHasSameSpecies`，`CopySwappedMonData` 直接复制敌方成员及其租借记录，未见换怪时的跨队持有物重复检查。故“换怪后玩家三人道具始终不重复”是用户新增约束，不能说原型已经保证。

最小实现语义：比较**本局装备位** `factoryEquippedHeldItemId`（下一战返还来源），不比较本场可能已消耗/拍落的 `factoryHeldItemId`。换入敌方成员若其装备位与留下的两人任一非空装备位相同，应禁止该换入组合并说明原因，保留选择其他敌方成员、改换出对象或跳过；不得擅自丢弃敌方道具。奖励持有物候选也须至少有一名目标成员可装备且不与另外两人装备位重复；领取事务和存档恢复再次校验。对重复的同款奖励卡，不应通过给已有同款成员原地覆盖来凑四张“可领取”卡。若敌方三人对所有可换出对象均冲突，跳过仍可前进。存档校验需要覆盖 REWARD、BASE、BATTLE 等玩家三人状态，但敌方队伍独立判定。

首版已批准五种不同的持有物奖励。玩家三人已装备其中三种时最多剩两种不重复道具卡；再遇不足两种可学 TM 的队伍，四张不同卡就无法凑齐。这是需要补足策略的构造性边界，并非当前随机流程已出现的实测样本。

## 最短实施与验收顺序

1. 修正抽取脚本的 `project-mapping-gaps.json`：新增 `NATIONAL_DEX_* → speciesId`、`species.h` 别名解析及上述 10 条形态例外；分别输出基础 1025/1025、形态 51/51 的有证据映射，以及未知/冲突清单。删除或重命名误导性的 `speciesNameCandidatesInFactoryIndex: 41`；它只能作为“直接文字命中形态 41”展示。测试要包含第 1、9 代边界及 10 个例外。
2. 固定 TM50 到本项目 `Move.name` 的逐项映射和内容库版本；验证 50 名称唯一、资料存在、招式 ID/名称一致。将 8 个缺口作为明确的排除表或补实现任务，禁止靠 `effectId: 'NONE'` 的普通伤害回退掩盖特殊规则。
3. 对拟入池每招做有结果断言的战斗测试；基本伤害、状态、能力变化、天气/场地及特殊规则各选代表，再对全部可发 TM 做资料加载、目标选择、使用后状态的静态验收。通过的招式才进入发布 allowlist，输出可发 TM 数。
4. 用真实三个队员的形态身份、当前四招和装备位计算可领取候选，跨第 1–9 代跑固定种子和边界组合，统计每个奖励节点 `0/1/2/3/≥4` 可领卡数量，并纳入最终道具池后验证总数始终为四。增加换怪后道具重复的正反测试、不同换出对象测试、奖励装备与剩余两人冲突测试；浏览器与手机真实第 3、6 胜验收候选冻结、四卡不重抽、不同形态可学性、已学招式排除、失败留节点重试。

本报告不改变玩家规则，也不批准任何 TM 或道具入池。来源表的再分发及宝可梦相关权利仍是公开发布前单独门槛。
