# Classic 赛后路径实施计划

**结算与旧档部分已被最新用户规则取代。** 下文关于逐场钱包、败退发币和旧档迁移的要求不再执行；Classic 的可选换怪、不进入奖励卡和第七战后结算方向继续有效。当前发放规则为整组获胜后按参考工厂单打表发 BP、败退 0；过往存档无需兼容，可重置或拒绝并明确提示，旧代币不得当 BP。实施结算时以《docs/公开版规则定稿.md》及 `docs/tasks/组末BP结算/prd.md` 为准。

日期：2026-09-26。依据《docs/对战工厂原型核对.md》《docs/公开版规则定稿.md》与本地 `reference/pokeemerald-expansion` 提交 `ca17c6a3d40a`。参考脚本 `BattleFrontier_BattleFactoryLobby/scripts.inc` 第 523–534 行说明胜后可从刚击败的对手换一只、第七名训练家后不能换；`BattleFrontier_BattleFactoryPreBattleRoom/scripts.inc` 的 `AskSwapMon` 允许拒绝；`BattleFrontier_BattleFactoryBattleRoom/scripts.inc` 在第七胜后回大厅。该反编译扩展是 Classic 参考实现，不等同于原版所有细节。最新用户规则为七战整组胜利后发 BP，败退 0 BP，覆盖此前逐场入账规则。

## 现状与目标

当前 `factoryRewards.ts` 配置七战一组，并设置第 4、7 战前奖励卡。`usePokeFactoryGame.ts` 的 `nextFactoryStage` 在目标战次触发 `rewardFlow.openRewardStage()`，进入 `REWARD`；这会让 Classic 在第 3、6 场胜后、进入第 4、7 场前看到奖励卡。`continueAfterRoundResult` 已在非第七场胜后进入 `FACTORY_SWAP`，第七场胜后回基地；`FactorySwapScreen.tsx` 有“跳过交换”和“确认交换”，`useFactoryFlow.ts` 以 `enemyTeam[enemyIdx]` 替换一只我方成员。

Classic 的目标路径：第 1–6 场胜后显示刚击败的敌队候选，玩家只可换一只或跳过，然后进入下一场，钱包余额不因单场胜利变化；第 7 场胜后不出现换怪或奖励卡，显示整组 BP 结果并回基地，之后可继续挑战。任一场失败或主动退出，本组 0 BP，直接回基地，不进入换怪或奖励卡。第 4、7 场之前不插入奖励卡。Rogue 的奖励时点、内容和次数仍未定稿，本任务不定义。

## 实施切入点

1. 在 `usePokeFactoryGame.ts` 的 `nextFactoryStage` 去掉 Classic 到 `rewardFlow.openRewardStage()` 的分支，让跳过和换怪都只调用同一个直接进入下一战的动作。不要简单删除 `REWARD` 页面和奖励实现；它们可留待 Rogue 规则定稿，但 Classic 正常路径不可触达。若未来有模式字段，必须以显式模式判定；目前可用路径固定为 `CLASSIC`，不可假定 Rogue 已可用。
2. 在 `continueAfterRoundResult` 保持第七战胜利转基地，并确认结算页面文案清楚区分“继续赛后换怪”和“七战已完成返回基地”；第七场不提供换怪操作。检查 `RoundResultScreen.tsx` 的操作文案和进度显示。
3. `FactorySwapScreen.tsx` 与 `useFactoryFlow.ts` 继续支持“换一只/跳过”。交换候选只能来自刚击败的 `enemyTeam`，不能提前替换为下一战预取队伍；第 1–6 场每个赛后节点只允许确认一次。跳过、换怪、按钮连点共用防重入逻辑，防止战次跳两次或交换两只。确认换怪后将所选敌方宝可梦恢复至可用状态的现有逻辑需核对，与当前项目规则保持一致，不在此任务新定数值。
4. 钱包只在第七胜的整组结算处发 BP；转到换怪、下一战或基地不能发 BP 或再次发 BP。结算方案见 `docs/tasks/组末BP结算/plan.md`。当前逐场钱包实现须停止用于 Classic，并修改结果页“本场获得代币”的文案。

## 存档与中断

用户已明确不要求兼容过往存档。新规则采用新 schema；旧 v7/v8 存档不得被静默当成新 BP 存档、保留逐场入账余额或折算。发现旧档时显示明确的不兼容提示和重新开始入口，必要时允许先导出备份，再建立新档。新 schema 内仍要记录赛后换怪、第七战组结算等阶段，以保证新版本自身刷新恢复时不跳战、不二次发 BP。

## 验收

静态：为 Classic 路由写流程级测试，覆盖第 1、3、4、6 场胜后都先换怪/跳过并直达下一战，第 7 场胜后直接组结算和基地；任一场失败或主动退出不进换怪；`REWARD` 在 Classic 不可达；候选队伍来自刚击败的敌队且最多交换一只；连点不重复推进或发 BP。测试旧 schema 明确提示或重置，不做金额迁移；新 schema 的换怪和组结算节点须可刷新恢复。运行 `npm run lint`、`npm test`、`npm run build`。

运行：用当前前端与 Go 服务从新存档完成一组七战，分别在第 3→4、第 6→7 处记录页面流转，确认没有奖励卡；至少一次换怪与一次跳过，记录前后队伍与战次；前六胜钱包不变，第七胜后记录组 BP、钱包和回基地，另测失败与主动退出。旧 v8 样本只能触发不兼容提示或重置，不可将旧逐场余额混入 BP。手机尺寸覆盖 `320×568`、`390×844`、`844×390`，确认换怪候选与“跳过”“确认”均可读可点。记录提交、数据版本、存档起点、截图、控制台及服务错误；侧边浏览器之后由实体手机复核触控。
