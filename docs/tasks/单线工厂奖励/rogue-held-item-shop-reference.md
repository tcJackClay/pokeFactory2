# Rogue expansion 独立持有物商店与四卡候选研究

固定参考源：`output/rogue-expansion-reference`，Pokabbie/pokeemerald-rogue `expansion` 提交 `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014`。本文件只研究持有物**候选目录**；原作商店不是本项目每组第 3/6 胜的四选一，商店价格、库存随机率和解锁条件均不能直接成为本项目补给券或奖励规则。

## 实际调用与筛选链

| 固定源码位置 | 已核实的行为 |
| --- | --- |
| `data/scripts/Rogue/Rogue_Manager.pory:838–850`，`include/constants/rogue.h:78` | `Rogue_Shop_HeldItems` 调用 `rogue_dynamicpokemart(ROGUE_SHOP_HELD_ITEMS)`，独立于 `ROGUE_SHOP_RARE_HELD_ITEMS`；地图上的 Hub、Mart、Rest Stop 等入口指向该脚本。 |
| `src/shop.c:2120–2190` | 打开动态商店时查询本类别；持有物类别按名称排序并显示库存变化，查询结果转为商店清单。没有硬编码的“持有物奖励七件表”。 |
| `src/rogue_controller.c:9032–9046, 9060–9115, 9225–9234` | 运行中为持有物商店使用独立子种子；先筛 `Rogue_IsItemEnabled`，再按 `POCKET_HELD_ITEMS` 取交集，`minSalePrice=0` 且允许随机库存。稀有持有物商店在 expansion 下取 `POCKET_STONES`，两者不可混为一池。 |
| `src/rogue_baked.c:1541–1652, 1655–1694`，`src/item.c:1428–1434` | `ItemId_GetPocket` 经 `Rogue_ModifyItem` 得到运行时口袋。非进化道具、非树果且 `holdEffect != 0` 者进入 `POCKET_HELD_ITEMS`；树果仍在 `POCKET_BERRIES`；进化道具留在普通道具口袋；Mega/Z/驱动器/石板/记忆碟等形态及机制物品转入 `POCKET_STONES`。因此不能只读 `src/data/items.h` 原始 `.pocket`（很多写的是 `POCKET_ITEMS`）来列商店。 |
| `src/rogue_query.c:1254–1283, 1319–1342`，`src/rogue_controller.c:2346–2663` | 启用筛选会剔除禁用品、无有效描述的物品及运行中超出图鉴世代上限者；特定形态物品还受物种/机制开关限制。运行外 Hub 对未领取的任务商店解锁另做排除（`rogue_controller.c:9340–9363`）。这是 Rogue 的解锁语义，不能无条件映射为本项目九世代物种池限制。 |
| `src/rogue_controller.c:9298–9423` | 运行中持有物库存按难度与固定随机种子过滤；强制完整库存或非运行中不会走该随机过滤。商店仍检查有效价格。此处随机只决定 Rogue 商店库存，不能证明本项目四卡足量，也不能当作四卡权重。 |

`src/data/items.h` 的物品记录给原始 `holdEffect`、参数和价格；下列目录以**该固定源码里的真实效果**和本项目 `src/features/game/data/battle/itemEffects.ts`、调用入口双向核对。最终可发还要过当前所选三人、装备唯一性、战斗效果测试、来源权利与手机实玩门槛。

Rogue 的 `ItemToGen` 在 `src/rogue_controller.c:2041–2270` 还给 `ITEM_KINGS_ROCK` 等物品设世代解锁。本项目设置中的九世代目前定义为**物种池选择**，不能因此在第一代挑战里撤销用户已经批准的王者之证；是否另设道具世代解锁需要独立产品决定。

## 分层目录与首批建议

| 层级 | 候选与证据 | 本项目可用边界 |
| --- | --- | --- |
| 已批准五件 | `scope_lens`、`quick_claw`、`kings_rock`、`choice_band`、`focus_band`：本项目 `docs/tasks/单线工厂奖励/design.md:13,35–39` 已定；Rogue `src/data/items.h:6152,6411,6448,6497,6522` 有相应 `holdEffect`。 | 仍需各自效果、换装唯一性和下一战返还的完整验收。 |
| 首批可补两件 | `heavy_duty_boots`（Rogue `items.h:7008`，阻止入场陷阱）和 `loaded_dice`（`items.h:10018`，影响 2–5 连续攻击次数）。本项目 `itemEffects.ts:4–24` 已有元数据，`resolveEntryHazards.ts:54` 与 `resolveMoveStrikes.ts:56` 有使用入口。 | 两件均不依赖特定物种，可与五件组成**七个不同装备 ID**；其效果是条件性的，需验证双方陷阱/连续招式、换人、消耗与返还。七件保证数量下界，不保证每张对当时队伍都有明显收益。它们尚未获用户逐件批准，不能直接出卡。 |
| 扩展的通用效果 | `bright_powder`、`lax_incense`（命中修正），`white_herb`（能力下降后复原）、`mental_herb`（清除心智妨碍）：Rogue `items.h:5670,6374–6446`；本项目 `itemEffects.ts:9–20,132–137` 和 `resolveAccuracy.ts:54`、`useBattleController.ts:585–628` 有入口。 | 光粉/悠闲薰香增加随机闪避；既有设计曾建议先不放光粉。白色/心灵香草属于战斗内反应性复原，要先确认是否符合“首版无回复类奖励”。全部需精确触发概率/时点及战后返还测试；可作为扩大池的下一批，而非默认许可。 |
| 扩展的属性强化 | `silk_scarf`、`charcoal`、`mystic_water`、`magnet`、`miracle_seed`、`never_melt_ice`、`black_belt`、`poison_barb`、`soft_sand`、`sharp_beak`、`twisted_spoon`、`silver_powder`、`hard_stone`、`black_glasses`、`metal_coat`：Rogue `items.h:5929–6150`；本项目 `itemEffects.ts:166–180` 有 15 种属性强化。 | 原型在 `I_TYPE_BOOST_POWER=GEN_LATEST` 下 `TYPE_BOOST_PARAM=20`（`items.h:17–21`、`include/config/item.h:15`），即 1.2 倍；本项目目前写 1.1 倍。若声称按此 Rogue 参考，先校正倍率并逐属性测试。按三人当前攻击招式筛有用候选；盲目把没有对应属性招式的卡计入“有用四卡”会损害体验。 |
| 物种限定 | `thick_club`、`leek`、`deep_sea_scale`：Rogue `items.h:5519–5544,5579–5591` 有原配效果，本项目 `itemEffects.ts:139–159` 含物种限定元数据。 | 只对确有适用物种/形态的当前三人显示，且核对本项目形态 ID；不能用于所有队伍的四卡数量兜底。 |
| 暂缓或排除 | `leftovers`、`shell_bell`、树果，以及 Rogue 商店的更多 `life_orb`、`focus_sash`、`power_herb`、`assault_vest` 等。 | 前两件与用户暂不放回复类道具的设计相冲突；树果在 Rogue 的另一口袋；后四例在 Rogue `items.h:6624–6665,6923–6935` 有数据，但本项目 `itemEffects.ts` 无对应战斗元数据或完整机制，不能仅凭商店入口开放。形态/机制石属于 `POCKET_STONES`，也不在普通持有物商店。 |

**最短可实施首批建议是现有五件加厚底靴、命中次数道具，共七件**；这两件的本地战斗入口已存在，能先解开“最坏三人占用三件后只剩两卡”的纯数量缺口。用户希望更大的持有物池时，可继续审定上表通用效果，并优先补齐 15 种属性强化的倍率差异与适用招式筛选。若只把七件全部作为可装备卡，三人最多占三件，尚有至少四个不同 ID；若要求“当前队伍必能触发效果”或规定 ITEM/TM 固定配比，这个数量证明就不成立，须另作队伍级验证。

## 纳入项目时的核验口径

从固定 Rogue 源生成 `ITEM_* → 运行时口袋 → 启用/世代条件 → holdEffect/参数` 的带 SHA 清单，再与本项目显式 ID 映射、效果验收表交集。奖励生成只从用户已批准且当前可装备、三人本局装备基准无重复的卡中取不重复 ID；重选后冻结四卡、领取时再校验。对选定世代的可达三人队与换怪结果枚举候选数 `0/1/2/3/≥4`，同时区分“可装备”和“有对应触发场景”。手机上完成第 3/6 胜的领取、替换旧物、下一战实际触发及刷新恢复。此研究没有制定价格、出卡概率、补给券商品或 Rogue 商店解锁在本项目的映射。
