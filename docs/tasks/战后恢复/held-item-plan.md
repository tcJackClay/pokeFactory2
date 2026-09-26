# 工厂战间持有物返还计划

## 原型与当前差距

`reference/pokeemerald-expansion/src/battle_factory.c:609–623` 的 `RestorePlayerPartyHeldItems()` 按租借 set 记录重新赋予玩家队伍持有物；`data/maps/BattleFrontier_BattleFactoryPreBattleRoom/scripts.inc:56` 在战斗返回前战室后调用 `factory_resethelditems`，随后治疗队伍。战间返还的对象是**当前玩家租借队**，包含已交换获得的租借宝可梦；战斗中道具消耗、拍落仍应即时生效，到战后才恢复。

当前 `useFactoryFlow.ts` 在建池时仅把选出的 `itemId` 写入可变 `GamePokemon.factoryHeldItemId`。`useBattleController.ts` 的消耗与拍落会将此字段设为 `undefined`；没有保留初始持有物来源。`restoreFactoryParty.ts` 已负责战后 HP、PP、异常与临时状态恢复，并在 `resolveBattleResult()` 成功结算后、进入 `ROUND_RESULT` 前被调用；`performSwap()` 也复用它，但不会恢复已清空的持有物。`saveManager.ts` 会保存战斗队伍，却没有原持有物字段，故仅靠当前快照无法可靠推回已消耗或被拍落的道具。

## 最小数据与转换

1. 在 `GamePokemon` 增加仅表示本次工厂租借原配的字段，例如 `factoryOriginalHeldItemId: string | null`。生成六只租借和每场敌队时，在同一个确定的 `itemId` 来源处同时设置原配字段与战斗当前字段 `factoryHeldItemId`；`''`/`none` 统一为 `null`。原配字段不进入基地背包，也不因战斗消耗、拍落而变。当前跨世代随机池按槽位分配道具，参考 set 则用 `FactoryReferenceSet.heldItemId`；不能仅存 Frontier set 编号，因为九世代随机池未必有该编号。
2. 战斗效果继续只改 `factoryHeldItemId`。`restoreFactoryPokemon()` 从不可变的 `factoryOriginalHeldItemId` 重建当前持有物；`null` 恢复为空。连同现有 HP/PP/状态恢复构成一个纯函数，重复调用结果相同。玩家队伍中原配道具已被消耗、被拍落或当前被其他效果替换时，下一战都以该成员的原配为准；不把敌方当前道具或玩家背包道具复制进来。
3. 第 1–6 胜及第 7 胜的战后结果都恢复玩家队伍，先恢复再提供换怪/组结算页面；败退路径若仍展示队伍也只显示战后恢复状态，不增加 BP。换怪时新成员来自刚击败的 `enemyTeam`，其原配字段须随它一起进入玩家队伍，`performSwap()` 对换入队伍调用同一恢复函数，确保敌人在刚才战斗中消耗或被拍落的原道具从下一场起恢复；被换出的成员不再属于玩家队伍。跳过换怪沿用战后已恢复的原队伍。
4. 处理战果落盘顺序：现有 `resolveBattleResult()` 先调用结算持久化，再执行 `setPlayerTeam(restoreFactoryParty)`。结算可能先把未恢复队伍写入 `ROUND_RESULT` 检查点；若此刻刷新，内存中的后续恢复不会发生。修改为从本场最终队伍计算恢复后队伍，并在同一个成功的结算/结果提交中写入 `ROUND_RESULT` 快照与恢复后队伍；然后更新 React 状态。结算失败则保持原战斗结果待重试，不允许画面已恢复但存档仍处于消耗态。`FACTORY_SWAP`、组末 `BASE` 和跨页自动保存继续持久化恢复后的原配字段；下一战起始可再次幂等检查恢复，但不能依赖该补救掩盖结果提交缺口。

## 存档与校验

新 schema 明确要求工厂 READY 快照中的 `factoryRentals`、`playerTeam`、`enemyTeam` 各成员持有合法原配字段（含 `null`）；对实际引用成员检查 ID、原配道具 ID 与当前可变道具的类型。原配道具须在工厂持有物数据中可识别；无原配 `null` 不可被自动补成随机道具。战斗中快照允许当前道具 `undefined`，恢复到 `ROUND_RESULT`/`FACTORY_SWAP`/可续 `BASE` 后应校验当前持有物与原配一致。交换成员保留自己的原配，不以队伍槽位重新分配。导入含缺失、伪造或不一致字段的同版本 READY 档要触发已有损坏存档保护，不能静默清空快照或猜测来源。

用户允许旧版存档不兼容，因此发布该字段时升级 schema 并沿用旧档明确提示、备份和重新开始路径；不尝试从已被消耗的旧 `factoryHeldItemId` 反推原配。**同一新 schema** 正在进行的战斗快照须保留战斗中的已消耗状态，刷新后继续该战，待战果成立才返还；处于 `ROUND_RESULT`、换怪页、奖励页或可续基地的快照则应已完成返还。防止旧的 BATTLE 自动保存覆盖更新的战果/返还快照，复用现有持久快照新旧阶段保护并补足恢复后的队伍字段校验。

## 验收

- 单元测试：有原配树果/白色香草的成员战斗中消耗后当前字段为空，战后恢复同一原配；拍落同理；原配为空仍为空；连续两次恢复完全相同。敌方在战斗中消耗道具后换入玩家队，恢复的是该敌方成员的原配；跳过换怪维持原队原配；第 7 胜组结算也保留原配。
- 保存测试：战斗中消耗或拍落后刷新，当前战斗道具仍为空且原配字段保留；胜利结算原子落盘后立即刷新，`ROUND_RESULT` 队伍道具已返还；换怪/跳过、跨组 BASE 续玩、同版导出导入和下一场起战均一致。模拟结算写盘失败、双击继续与旧 BATTLE 延迟自动保存，不能跳过返还或回滚快照。旧版档有提示，同版本损坏原配字段进入保护页。
- 运行试玩：在模拟手机 390×844 与实体手机分别制造一次可消耗道具、一次拍落、一次敌方道具已消耗后的交换，并覆盖第 3/6 胜奖励节点和第 7 胜组末。逐节点核对战斗日志、持有物显示、快照、刷新及下一战效果；确保战斗中道具不会即时复活，战间只对仍在队伍中的成员返还。保存截图与具体道具、阶段和存档字段证据。
