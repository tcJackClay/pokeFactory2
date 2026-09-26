# 战斗轮次事务修复计划

基线为 `origin/dev` 的 `5cb777f`。目标是一次玩家指令形成一轮：双方各至多行动一次，双方行动或合法跳过后仅结算一次回合末。先修轮次边界，再接 TM 跨回合与打完换人；否则新招式会放大当前重复行动和提前结算问题。

## 已核实的失效链

- `useBattleController.ts` 的 `handleAttack` 先选敌方招式与先后。敌方先手时直接等待 `runEnemyAutoAction`；敌方 `executeTurn` 的普通及多条早退路径将 `turn` 设为 `PLAYER`，玩家 `executeTurn` 完成后又把它设为 `ENEMY`。`enemyTurn` effect 只看 `turn === 'ENEMY'`，因此可能让敌方在同一轮再行动一次。
- 回合末 effect 用 `previousTurnRef` 检测 `ENEMY → PLAYER`。敌方先手这次中间过渡已满足条件，若日志结束使 `isMessageProcessing` 变 false，天气、异常、计时可能在玩家尚未行动时提前结算；随后还可能漏掉真正的回合末。`roundEndInFlightRef` 只防当前 epoch 内并发，不以轮次 ID 保证“恰好一次”。日志函数每批设置布尔 busy，批与批之间可重新开放 effect。
- `resolvePreTurnStatus` 在不能行动时也直接设置下一 `turn`。`executeTurn` 的梦话/打鼾/守住/顺风/隐形岩/毒菱/睡觉/替身/诅咒、守住碰撞、未命中、替身、免疫、伤害后施招者或目标濒死等路径各自写 turn 或调用补位。`switchPokemon`、敌方主动换人、`sendOutNextEnemy`、`sendOutNextPlayer` 也写 turn。仅修普通攻击末尾无法覆盖全部路径。
- `handleAttack` 目前在判断敌方是否先手**之前**就执行玩家 `resolvePreTurnStatus`，敌方先手后又执行一次。修复时状态妨碍检查须随本侧真正的行动机会执行一次，避免睡眠回合数、混乱自伤或果实效果被提前或重复推进。
- 现有 `battleInstanceRef.epoch` 在游戏状态、运行 ID、关卡改变或卸载时递增，可用于废弃旧异步 continuation；`liveBattleStateRef` 由渲染更新，日志等待后的即时读取仍须核对 epoch 与成员身份。`completeEndTurnResolution` 已有 `isCurrentBattle`，但外层触发条件需要改为完整轮次完成。

## 最小可测试的交接方案

1. 引入战斗内单一轮次事务，标识 `{battleEpoch, roundId}`，记录已选玩家指令、已选敌方指令、顺序、双方行动结果（`PENDING/ACTED/SKIPPED`）与阶段（`SELECTED/FIRST_ACTION/WAIT_REPLACEMENT/SECOND_ACTION/END_TURN/DONE`）。招式、优先级、先制之爪及顺序只在开始时决定一次；敌方后手不能在 `enemyTurn` effect 中重新选招。`turn` 只负责展示当前输入或动画，不再作为“敌方还有一次行动”“可以做回合末”的事实来源。每次阶段变化同步更新事务 ref，并用一个驱动函数调度下一步。
2. 把 `executeTurn`、`resolvePreTurnStatus`、主动换人和补位的终点统一返回带队伍/HP/状态的结果，如 `ACTION_DONE`、`ACTION_SKIPPED`、`WAIT_PLAYER_REPLACEMENT`、`BATTLE_ENDED`；不在这些分支自由调用 `setMainBattleTurn`。前置状态妨碍检查也移到该侧实际行动开始时，每侧每轮执行一次。原有伤害、PP、日志与动画逻辑暂不重写；先将所有早退汇聚至一次 `finishAction`，由它记录本侧已行动并推进事务。开始行动前再次核对 epoch、roundId、行动者 ID、当前 HP；每个 `await addMessagesSequentially` 后若战斗已更换则废弃后续写入。为防连续点击，创建事务时立即加同步门闩，直到完整回合或明确中断后解除；不要只依赖异步 React busy state。
3. 第一行动后若有一方濒死，先完成既有合法补位：玩家需选人时把事务停在 `WAIT_REPLACEMENT`，选择完成才恢复；敌方自动补位可在事务内部完成。若一方队伍全灭，直接终止事务并走胜负结算，不执行未行动的招式或回合末。若补位因入场陷阱再次濒死，继续补位但该侧已消耗的行动不能复活。正常补位后，第二行动以新在场者为目标；若原行动者被击倒或因状态无法行动，记 `SKIPPED`，不由补位成员代打一招。玩家/敌方主动换人本身是该侧一次行动，换入后若对方尚未行动，其已选招式对新成员结算。
4. 第二行动完成或跳过后，直接调用一次 `resolveEndTurn` / `completeEndTurnResolution`，以 `{epoch, roundId}` 的 `endTurnCommitted` 门闩保证同一轮只提交一次天气、残余伤害、计时和补位。删除或停用以 `ENEMY → PLAYER` 为依据的回合末 effect；`roundEndInFlightRef` 扩为轮次级幂等，不能在日志 `finally` 清掉后被旧 effect 再触发。仅在完整回合末和必要补位结束后开放下一次玩家输入。日志先后为出招/状态受阻 → 伤害/濒死 → 补位/入场陷阱 → 第二行动 → 回合末；长日志不会改变事务阶段。
5. `usePokeFactoryGame.ts` 的稳定玩家回合快照只应在 `DONE` 且无悬挂补位/异步日志时生成。进行中刷新回到最近的完整稳定检查点；不要把已扣 PP、已受伤而未完成第二行动的半回合持久化。战斗切换、新局、结算、卸载立即使旧 `{epoch, roundId}` 无效，旧日志 Promise 结束后不得提交新的 turn、队伍或存档。后续 pivot、蓄力、逆鳞使用同一事务阶段接口，不再各自发明交接。

## 回归矩阵与验收

| 轮次情景 | 必须断言的结果 |
| --- | --- |
| 玩家先手、敌方先手、同速/先制之爪改变顺序 | 双方本轮各行动一次；各招 PP 只扣一次；回合末仅一次；下一轮只开放一次输入。 |
| 第一或第二行动：未命中、守住、免疫、招式失败、睡眠/冰冻/畏缩/混乱自伤、挑衅等妨碍 | 每个早退都将该侧记为已行动或跳过，合法剩余行动照常执行；无空轮、重演、提前天气/中毒伤害。 |
| 玩家/敌方主动换人、第一行动击倒对手、双方濒死、入场陷阱击倒补位 | 已行动者不再攻击；存活且尚未行动的原成员打当前新目标；全灭只结算胜负，不继续第二行动或重复回合末。 |
| 长日志、连续点击、刷新、关卡/运行切换、卸载 | 日志等待期间不启动新事务；旧 epoch 的回调不写入新战斗；刷新恢复上一个完整回合，无半轮 PP/HP 漂移。 |
| 天气、毒/烧伤、顺风、蓄力/逆鳞等回合末计数 | 不在敌方先手后玩家尚未行动时递减；完成轮次时恰好结算一次。 |

先为纯轮次推进器写带结果的状态转移测试，再以可控速度、命中与异常夹具测试 hook/战斗集成，逐一跑完所有早退分支。执行 TypeScript、现有战斗测试和构建门禁。最后在 390×844 和 844×390 手机浏览器实玩敌方先手与玩家先手、守住/未命中、强制补位及刷新，逐回合记录双方行动次数、PP、HP、日志和天气/异常计时。浏览器验收必须证明没有敌方二动，也没有回合末提前或漏结算。
