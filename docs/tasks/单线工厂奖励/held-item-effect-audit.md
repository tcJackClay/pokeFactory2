# 持有物战斗效果静态盘点

核对基线：本地主工作树 `e29583c`；固定 Rogue expansion 源码 `output/rogue-expansion-reference` 为 `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014`。仅检查代码和既有测试，没有运行游戏。本表是可评估候选，不改变已经批准的五件奖励持有物，也不自动批准额外道具、价格或出卡权重。

Rogue 的 `src/rogue_controller.c:9225-9227` 将 Held Items 商店候选筛至 `POCKET_HELD_ITEMS`；`src/rogue_baked.c:1641-1652` 将非进化、非树果且有 `holdEffect` 的物品改入该口袋。下列物品在固定源码 `src/data/items.h` 均有对应 `holdEffect`，且没有物种限定字段。因此它们属于这个商店类别的**候选**；原型还会执行激活、随机和进度筛选，不能据此说每局必售，更不能照搬为本项目奖励卡。项目 `itemEffects.ts` 的下列项均无 `speciesIds`；带物种限制的粗骨头、大葱和深海鳞片已排除。

| 持有物 | 当前项目效果与代码证据 | 准入状态及主要缺口 |
| --- | --- | --- |
| 焦点镜 `scope_lens` | `itemEffects.ts:44-49` 定义会心等级 +1；`resolveDamage.ts:106-109` 读取当前装备。Rogue `items.h:6522`。 | 已批准五件之一；需玩家和敌方会心概率边界、奖励换装及下战返还的结果验收。 |
| 先制之爪 `quick_claw` | `itemEffects.ts:38-43` 定义 20% 触发；`useBattleController.ts:2510,2685-2700` 决定行动顺序。Rogue `items.h:6411`。 | 已批准；敌方先手整回合事务仍有独立缺陷，修复前不能据浏览器先手样本判定本物品通过。 |
| 王者之证 `kings_rock` | `itemEffects.ts:26-31` 定义命中后畏缩 10%；`useBattleController.ts:1885-1891` 进入命中附加效果。Rogue `items.h:6448`。 | 已批准；须覆盖攻击命中、对方已行动、替身、多段攻击和双方装备。 |
| 讲究头带 `choice_band` | `itemEffects.ts:120-125` 定义物攻 1.5 倍及锁招；`resolveDamage.ts:97-100`、`useBattleController.ts:1613,2676,2722` 使用。Rogue `items.h:6152`。 | 已批准；需换人清锁、敌方 AI、存档恢复和奖励替换后的实战。 |
| 气势头带 `focus_band` | `itemEffects.ts:126-131` 定义 10% 保留 1 HP；`useBattleController.ts:2125-2141` 触发。Rogue `items.h:6497`。 | **已批准但效果对齐有阻断**：本项目触发时调用 `consumeHeldItem` 并清当前道具，固定 Rogue `battle_script_commands.c:2185-2190,12309-12316` 仅记录触发，没有消耗气势头带。应先由设计确认要遵循原型还是明确采用本项目改动规则，再做概率、多段伤害和逐战返还验收。 |
| 光粉 `bright_powder` | `itemEffects.ts:9-14` 定义对手命中倍率 0.9；`resolveAccuracy.ts:54` 读取。Rogue `items.h:6374`。 | 未批准；无物种限制且已接战斗计算，但会增加随机闪避。先确认体验取舍，再验证固定随机边界和双方对称。 |
| 白色香草 `white_herb` | `itemEffects.ts:132`、`useBattleController.ts:585-606,1916-1925` 在能力下降后恢复并消耗。Rogue `items.h:6387`。 | 未批准；已有 `docs/tasks/战后恢复/white-herb-runtime.md` 的隔离浏览器“过热→消耗→下战返还”证据，仍缺奖励领取/换装、其他降能力路径和实体手机验收。它恢复能力等级而非 HP，但是否落入“无回复类奖励”边界需设计确认。 |
| 心灵香草 `mental_herb` | `itemEffects.ts:133-139`、`useBattleController.ts:608-626,1928-1940` 清除所列心智异常并消耗。Rogue `items.h:6436`。 | 未批准；目前主要是静态接线及日志测试，缺挑衅/再来一次等真实触发、双方对称、刷新和下战返还验收；类别边界需设计确认。 |
| 厚底靴 `heavy_duty_boots` | `itemEffects.ts:4-8`、`resolveEntryHazards.ts:54-78` 阻挡隐形岩伤害和毒菱中毒；接地毒属性仍吸收毒菱。Rogue `items.h:7008`。 | 未批准；当前项目仅有隐形岩和毒菱，原型中尖刺、黏黏网等完整入场陷阱尚未齐备。应按已支持范围标注效果，并复测双方主动/濒死入场、重力和刷新。 |
| 机变骰子 `loaded_dice` | `itemEffects.ts:21-25`、`resolveMoveStrikes.ts:56-57` 将 2–5 次攻击改为 4/5 次；`resolveMoveStrikes.test.ts:102` 有固定随机测试。Rogue `items.h:10018`。 | 未批准；无物种限制，但只对持有对应多段招式的成员有实际收益。须明确可领取是否要求当前队伍有适用招式，再验玩家/敌方实战、多段 PP/日志与逐战返还。 |

数量边界：若仅在五件已批准道具中选，三名队员占用其中三件时只剩两张不同且不重复的道具卡。额外至少两件**经批准且经完整效果验收**的无物种限制道具，才可能在不依赖 TM 的前提下达到四张候选的数量下界；`four-card-coverage-analysis.md` 的可领取公式仍须逐队核对。`src/features/game/config/factoryBattle.ts:29-39` 的九件租借伪池与 `src/features/game/data/battle/itemEffects.ts` 的效果表均不等于奖励可发池。`src/uiAppConstants.ts:101` 的现有 `ALL_ITEMS` 也不是上述持有物的完整奖励实体；实际奖励生成、图标/名称、装备事务和存档校验需要另行接线。

优先处理两项风险：第一，气势头带目前触发即消耗，与固定 Rogue 原型不一致，若按原型发卡需要修复并重测；第二，敌方先手轮次事务尚未封闭，先制之爪与王者之证的浏览器验收会被这一缺陷污染。其余新增候选均只是来源和静态效果盘点，不能据本表宣布达到四张可领取卡或公开版发布门禁。
