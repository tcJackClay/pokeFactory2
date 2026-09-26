# 组末 Battle Points 结算实施计划

日期：2026-09-26。依据《docs/公开版规则定稿.md》《docs/tasks/组末BP结算/prd.md》与本地 `reference/pokeemerald-expansion` 固定提交 `ca17c6a3d40a`。目标为 Classic 工厂单打七战整组胜利后发放 BP；任一场失败或主动退出，本组 0 BP。用户已明确不兼容过往存档；不得将旧逐场代币换算成 BP。

## 参考数值与发放条件

本地 `src/frontier_util.c` 的 `sBattlePointAwards[FRONTIER_FACILITY_FACTORY][FRONTIER_MODE_SINGLES]` 完整 30 档为：`3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15, 15, 15`。`GiveBattlePoints` 使用已完成七战组数减一作为零基索引，超过第 30 档固定使用末档；仅实际对手是 `TRAINER_FRONTIER_BRAIN` 时加 10。`BattleFactoryLobby/scripts.inc` 只在整组成功分支调用 `frontier_givepoints`，失败分支不调用。参考 `MAX_BATTLE_FRONTIER_POINTS` 是 9999；用户已确认数值与发放条件都按原型，本项目 BP 余额上限为 9999。

首领不能等同于任意第七战。参考 `gFrontierBrainInfo[FRONTIER_FACILITY_FACTORY].streakAppearances = {21, 42, 21, 1}`，`GetFrontierBrainStatus` 对工厂单打按连胜和已获象征识别 21、42 以及取得两个象征后的后续 21 战周期。当前 `useFactoryFlow.ts` 把每组第七战标为 `isBoss`，`specialBossBattleActive` 仅在 stage 21 且尚未解锁时置真，并用普通训练家模板加权生成；这两者都不足以证明实际遇到原型意义的工厂首领。**首领身份实现是 +10 BP 的阻断前置任务**：先核对并实现首领出场进度、独立训练家身份与持久标记，击败被明确标记的实际首领才加 10。若该前置任务未完成，组末 BP 的基础表可验收，但 +10 和完整公开规则不可标记完成；不可通过所有第七战或单独 stage 21 猜测首领奖励。

## 存档与原子结算

当前 `saveManager.ts` schema 8 的 `wallet` 有余额、`currentRunId`、`settledThrough` 和单场 `lastSettlement`；`commitFactoryBattleSettlement` 每场加余额。`useBattleController.ts` 每场调用 `getFactoryTokenReward`，失败也发代币；`forfeitChallenge` 走 `loseBattle`。`RoundResultScreen.tsx` 与基地摘要使用 `lastTokenGain` 显示本场代币。新规则需替换这些逐场语义，不能只把前六场金额改为 0 而仍让第七战失败获奖。

使用新 schema 记录 `BP balance`、当前连续挑战 ID、当前组号及组内战次、已结算组的稳定标识、结算结果和实际入账额。结算键采用挑战 ID 加组号；`检查已结算→按完整表及首领标记求金额→更新余额→记录组键与结果` 同步写入同一份存档。组末重复回调、结果页重开、刷新与导出导入只返回原结算，绝不再加 BP。失败与主动退出也将当前组标为 0 BP 的终结结果，以阻止之后从旧页面误触发胜利发奖；此前已成功结算的组不回滚。写入失败时停在可重试状态、显示失败反馈，不先显示“已获得 BP”。

用户明确所有修改内容不要求兼容过往存档。采用新的存档版本和明确的旧档拒绝或重置路径；检测 v7/v8 时提示“旧规则存档不兼容，需要重新开始”，可允许先导出备份，但不得静默带入逐场入账余额、折算或据旧 `streak` 补发。新 schema 自身需要正常保存和恢复进行中的组、结算完成的组及首领身份。

上限检查与组键写入必须同次完成；结算记录区分名义奖励与实际入账，页面准确显示到顶时实际获得值，并有 9999 边界测试。即使已达上限、实际入账为 0，仍须记录该组已结算，防止重复领奖。

## 实施文件与顺序

1. `src/features/game/config/factoryRewards.ts`：移除 Classic 逐场代币计算入口，加入从固定源码逐项核对的 30 档工厂单打 BP 表和组号索引函数；对失败及退出返回 0。表项值与索引测试先通过。
2. `src/features/game/config/factoryBattle.ts`、`useFactoryFlow.ts`、训练家模板及存档快照：实现真正可识别的工厂首领进度与遭遇标记，区别“第七场难度首领”和“Frontier Brain”。先完成 21、42 及后续周期、失败后连胜重置、刷新恢复、对手身份验证，再允许 +10。若参考原型象征状态在本产品尚未定义，设计者先定稿等效的长期进度字段。
3. `src/services/saveManager.ts`：新 schema、旧档拒绝/重置、组键幂等和余额原子写入；用现有钱包单键写入与失败反馈机制，但替换 `settledThrough` 的逐场含义，避免旧数据被误读。
4. `src/features/game/hooks/useBattleController.ts`、`usePokeFactoryGame.ts`：前六胜只推进；第七胜以当前组号与真实首领身份结算；失败和 `forfeitChallenge` 标记 0 BP 终结；跨组继续时生成下一组可结算状态，不重复旧组奖励。
5. `RoundResultScreen.tsx`、`StartScreen.tsx`、`TopRecordPanel.tsx`、`uiStrings.ts`：统一“BP”“本组获得 BP”“当前 BP”文案。前六场结果只显示胜负与进度，不误报本场代币；第七场成功显示基础 BP、首领额外 BP 和实际到账；失败/退出显示 0 BP。`BaseRunSummary` 不应再次入账。

## 静态与运行验收

静态：`npm run lint`、`npm test`、`npm run build`、`go test ./...`。测试完整 30 档、组号索引及第 30 档后封顶；前六胜余额不变、第七胜首两组各 3、第 3 组 4；各战次失败和主动退出 0；已结算组不重复加钱；下一组正常结算；真实首领 +10 与普通第七战无 +10；21、42 和后续周期的首领身份与输后重置；写入失败不报成功；上限边界；旧 v7/v8 明确拒绝或重置且余额不迁入。

运行：用真实 Go 服务与前端在新存档完成第 1 组七战，逐场记录余额，第 7 胜记录组号、首领标记、名义 BP、实际入账与基地余额；继续第 2、3 组验证 `3、3、4`，并用可复现的首领进度验证仅实际击败首领时 +10。分别从第 1、6、7 场失败与主动退出，钱包保持此前已结算金额且本组为 0；刷新、重复打开结果、导出导入不重复发放。旧 v8 样本只显示不兼容或重置，不混入 BP。手机 `320×568`、`390×844`、`844×390` 复核组结算文案与按钮，记录提交、数据版本、存档起点、组次和战次、前后余额、截图、控制台及服务错误；实体手机再检查触控。
