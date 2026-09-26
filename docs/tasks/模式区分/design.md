# Classic 与 Rogue 模式规则对照草案

依据：《宝可梦对战工厂_项目设计框架_v1.md》§4.1–4.5、§13.1、§14.4、§15，以及《对战工厂原型核对.md》对固定提交 `ca17c6a3d40a` 的核查。参考实现是 `pokeemerald-expansion` 的对战工厂代码和脚本；它是反编译扩展项目，不能把每项细节都等同《绿宝石》原版。以下分开记录参考实现、PokeFactory2 项目扩展和用户定稿。当前基地商品搁置。

## 来源对照

| 规则点 | 参考实现 | PokeFactory2 项目已有规则与框架 | 用户定稿 / 尚待定稿 |
| --- | --- | --- | --- |
| 租借池与初选 | `src/battle_factory.c` 的 `GenerateInitialRentalMons` 从固定 `gBattleFrontierMons` 池按挑战档位生成候选；`src/battle_factory_screen.c` 的初选界面从六只租三只。见《对战工厂原型核对.md》“组队与租借”。 | `factoryReferenceSets.ts` 已含固定参考 set，但 `useFactoryFlow.ts` 仍有在线生成和回退；框架 §4.1–4.2 要求临时租借六选三、不直接带入局外培育队。 | 两模式共用工厂租借骨架；Rogue 是否改变队伍规模未获单独决定，不能擅改。 |
| 胜后换怪 | [大厅规则文字](https://github.com/rh-hideout/pokeemerald-expansion/blob/ca17c6a3d40a/data/maps/BattleFrontier_BattleFactoryLobby/scripts.inc#L523-L543)：每场胜利后**可以**从刚击败的对手队伍换一只，第七战后不能换；[赛前室脚本](https://github.com/rh-hideout/pokeemerald-expansion/blob/ca17c6a3d40a/data/maps/BattleFrontier_BattleFactoryPreBattleRoom/scripts.inc#L137-L158)有拒绝换怪分支。 | `usePokeFactoryGame.ts` 的非组末胜利进入 `FACTORY_SWAP`，第七战回基地结算；`FactorySwapScreen.tsx` 有“跳过交换”。应继续核对候选仅来自刚击败的敌队、一次最多一只。 | **Classic 已定稿：每场胜利后只保留换怪与七战结算，不进入奖励卡。**换怪是可选择的决策，不应误写成强制交换。Rogue 的赛后顺序待定。 |
| 七战与 BP | [战斗室脚本](https://github.com/rh-hideout/pokeemerald-expansion/blob/ca17c6a3d40a/data/maps/BattleFrontier_BattleFactoryBattleRoom/scripts.inc#L91-L110)第七胜标记整组成功；[大厅脚本](https://github.com/rh-hideout/pokeemerald-expansion/blob/ca17c6a3d40a/data/maps/BattleFrontier_BattleFactoryLobby/scripts.inc#L40-L80)只在成功分支调用 `frontier_givepoints`，败退不发；本地 `src/frontier_util.c` 的工厂单打表前两组各 3 BP，之后按 `sBattlePointAwards`，击败工厂首领另加 10。 | 框架 §4.1–4.3 设七战一组、第七战首领或特殊战；现有 `factoryRewards.ts` 仍按每场胜负计算项目代币，第七战另加，是待替换的本项目旧规则。钱包持久与幂等基础可复用。 | **用户最新定稿：整组七战获胜才按参考工厂单打表入账 BP，败退 0；前两组各 3 BP，击败工厂首领另加 10。**覆盖旧的逐场到账决定。Rogue 是否沿用同组长与 BP 规则待定。 |
| 战前情报与恢复 | [赛前室脚本](https://github.com/rh-hideout/pokeemerald-expansion/blob/ca17c6a3d40a/data/maps/BattleFrontier_BattleFactoryPreBattleRoom/scripts.inc#L54-L78)胜后恢复队伍，并在换怪询问前提供对手属性和风格提示；`battle_factory.c` 用 `sRequiredMoveCounts` 分类风格。 | `useFactoryFlow.ts` 有预取和恢复，`factoryBattleStyle.ts` 有风格数据；具体玩家可见时点尚需试玩验证。 | 框架 §4.3、§10.3 建议保留提示；两模式的提示差异未定。 |
| 奖励卡 | 已核查的参考胜后路径为恢复、对手提示、可选换怪与下一战；参考原型的这条路径没有项目式奖励卡。 | `factoryRewards.ts` 配置第 4、7 战前奖励；`usePokeFactoryGame.ts` 的 `nextFactoryStage` 会打开 `REWARD`，尽管摘要写为 `CLASSIC`。框架 §4.5 建议把奖励页整理入 Rogue。奖励卡是项目扩展。 | **Classic 不进入奖励卡已定稿**，现有第 4、7 战前路径与之冲突。Rogue 奖励卡出现时点、次数和内容待定。 |
| 捕捉、局内商店与特殊机制 | 已核查的参考工厂租借/换怪脚本没有这些项目式奖励与商店节点；不能由“没找到”推断所有游戏版本的全部限制。 | 工厂战斗由 `allowWildCatch` 禁捕，事件战斗允许；`RewardScreen.tsx` 重抽扣 `coins`；框架 §4.4 建议 Classic 无局内商店，§4.5 建议 Rogue 保留局内商店、特殊机制、更多随机事件。 | Rogue 捕捉、商店货币、特殊机制和事件细则待定；基地商品继续搁置。 |
| 模式与存档 | 参考代码按单打/双打、等级模式区分部分连胜数据；没有本项目的 Classic/Rogue 双模式。 | `GameView.tsx` 没有模式选择页，`saveManager.ts` 没有 Classic/Rogue 运行模式字段，`usePokeFactoryGame.ts` 的摘要固定 `CLASSIC`。 | 双模式选择是框架 §14.4 的项目目标；切换时机、同时保留几条 run 和纪录归属待定。 |

## 当前实现与设计方向的冲突或空白

- `usePokeFactoryGame.ts` 的组结算摘要把 `mode` 固定为 `CLASSIC`；`GameView.tsx` 没有模式选择页，`saveManager.ts` 的工厂存档也没有运行模式字段。因此“切换模式、恢复原模式、分别结算”尚未成立。
- `usePokeFactoryGame.ts` 的 `nextFactoryStage` 在第 4、7 战前按 `factoryRewards.ts` 的配置进入 `useRewardFlow.openRewardStage()`；当前主流程的结果摘要却标为 Classic。**这已与用户定稿的 Classic 不进入奖励卡直接冲突**；Rogue 奖励卡何时出现仍待规则决定。
- `RewardScreen.tsx` 的重抽会扣 `coins`；当前余额将按最新决定改为整组发放的 BP，Rogue 局内重抽是否可动用 BP 仍未定。不能直接把旧的逐场代币消费当作两模式共用规则。
- `factoryRewards.ts` 和 `useBattleController.ts` 仍按逐场胜负计算并结算代币，甚至失败也发；这与整组七战胜利才发 BP、败退 0 BP 的最新规则直接冲突。钱包的持久化/去重结构可保留，发放触发点、数值来源和结果文案须重做。
- `useBattleController.ts` 的工厂战斗禁用捕捉，当前仅事件战斗通过 `allowWildCatch` 开放捕捉。这满足 Classic 禁捕的方向，但不能据此推断 Rogue 应允许或不允许捕捉。
- `usePokeFactoryGame.ts` 已有特殊首领与战斗特殊机制状态；它们目前不是按 Classic/Rogue 分配。Rogue “保留特殊机制”不等于 Classic 必须禁用，框架未作此决定。
- `usePokeFactoryGame.ts` 的 `shopItems` 当前未接入局内商店页面。基地商店尚待商品规则定稿；不能把局内奖励页或禁用的基地入口视作 Rogue 局内商店已完成。

## 最少需要用户定夺的选择

1. **Rogue 奖励卡**：Classic 胜利后只保留换怪与七战结算、不进奖励卡已定稿。Rogue 的奖励卡在何时出现、每次可选几张、有哪些类型，以及与换怪节点如何排序？
2. **Rogue 捕捉与特殊机制**：Rogue 是否允许在普通工厂战斗中捕捉？两模式是否都能使用已解锁的 Mega、极巨、太晶等特殊机制，还是只给 Rogue？
3. **模式与存档**：同一时间可否同时保有一个 Classic run 和一个 Rogue run？模式能否在一组七战中途切换，还是仅能在基地开新局时选择？连胜、最高纪录和特殊解锁是否分模式记录？
4. **Rogue 局内经济**：Rogue 的奖励卡重抽与局内商店是否使用组末获得的基地 BP，还是使用独立局内资源？商品、价格和扣费时点随后再定；当前基地商品继续搁置。
5. **共同七战规则**：Rogue 是否也保持七战一组、第七战首领/特殊战与继续/回基地的选择？若改变，请确定新组长、组末奖励和失败退出方式。

上述选择得到确认后，先更新规则表和存档边界，再拆成模式选择与持久化、Classic 路径清理、Rogue 内容接入三项可验收任务。任何一项不得靠 `mode` 文本标签或已有奖励页的存在来宣称完成。
