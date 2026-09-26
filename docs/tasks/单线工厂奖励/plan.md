# 单线工厂奖励实施计划

## 规则与当前缺口

以 `design.md` 为规则来源：只有一条工厂主线；每组第 3、6 胜后先处理可选换怪或跳过，再进入四选一奖励；首版仅 ITEM/TM，卡片加载失败留节点重试；每胜 +1 本局补给券，跨组持续至本次挑战结束；不重抽。七战组末 BP 仍按现行单打表结算，第 7 胜不换怪、不出卡。具体 ITEM/TM 子池、补给券商品与价格未定，不借用旧池或旧价格。

- `usePokeFactoryGame.ts` 的 `continueAfterRoundResult()` 将第 1–6 胜直接送 `FACTORY_SWAP`；`nextFactoryStage()` 和 `performSwap()` 在换怪页直接开始下一战。第 3/6 胜后要在这两条动作中插入同一个奖励节点，不能仅恢复旧 `preBattleRewardBattlesInSet: [4,7]`。
- `useRewardFlow.ts` 的 `openRewardStage()` 可生成页面，但当前 `generateRewardSet()` 包含 POKEMON、EVOLUTION、队伍扩容许可及旧 ITEM 池；四卡可能不足，失败仅写控制台。`rerollRewards()` 以 `50+50n` 调 `spendWallet()` 扣基地 BP；`RewardScreen.tsx` 仍展示该按钮及 BP 价格，必须移除功能和入口。
- `RewardScreen.tsx` 由 `rewards`、`rewardChoiceMade` 等内存状态显示；`saveManager.ts` 的 READY 快照 `phase` 只有 BATTLE、ROUND_RESULT、FACTORY_SWAP、BASE，没有候选卡、待领取结果、补给券或 REWARD。刷新卡页可能丢节点。`getPersistableBattleResume()` 和清理 effect 也未将 REWARD 当可保留快照。当前 `coins` 实际镜像 `wallet.balance`，是基地 BP，不能复用为补给券。
- `useBattleController.ts` 胜负结算调用 `commitFactoryGroupSettlement()`；该函数对非第 7 胜直接返回，故券不能只附在现有组末 BP 加款分支。现有 BP 的 `runId`、`settledThrough`、`lastSettlement` 必须保持其组末幂等语义。

## 状态机与保存边界

```text
BATTLE 胜 → 持久化 ROUND_RESULT 与本场 +1 券 → ROUND_RESULT
组内第 1、2、4、5 胜 → FACTORY_SWAP → 下一战
组内第 3、6 胜 → FACTORY_SWAP → REWARD(PENDING/READY/CLAIMED) → 下一战
组内第 7 胜 → BASE 组结算与可续挑战；不换怪、不出卡
任意败退 → 本组 BP +0，结束本次挑战并清本局券；此前已入账 BP 保留
```

奖励节点用 `runId + 绝对 stage` 作唯一键，因此跨组第 10/13 胜也各有独立节点。换怪页的跳过与交换是互斥一次性动作：确定最终队伍后，先把队伍、换怪计数及 `REWARD/PENDING` 检查点写入存档，写成功才离开换怪页；不得先启动 `nextFactoryStage()` 或消耗第 4/7 战的敌队预取。奖励生成成功时一次保存四张**不可变**候选及 `READY`，再开放领取；失败保持 `PENDING`、错误提示和重试按钮，刷新后仍在该节点。候选用明确的 ITEM ID 或 TM 招式标识与必要战斗资料序列化，并按已批准名单、可学习目标及四张数量做校验；同版导入恢复同一组候选，不重新抽。若生成无法组成四张合格卡，报告加载失败留节点，不用未获批类别填位。

领取时校验卡确属该节点、未领取、队伍及目标仍有效。ITEM 入库存档与 `CLAIMED` 同次提交；TM 的选择学习者、替换旧招式等步骤需要可恢复的 pending 操作，最终招式更改与 `CLAIMED` 同次提交。按钮双击、刷新后重试或旧异步返回不能追加第二件物品/重复改招。`CLAIMED` 恢复后显示已领结果及“继续”，不再调用生成器或重发道具；继续动作先持久化节点已完成与下战启动意图，再推进 stage，失败仍可返回已领节点重试，不重复领取。可复用 `createClassicActionGate()` 的单次动作约束，但必须以持久检查点作为跨刷新幂等依据，不能只靠 React ref。

存档增加独立的本局券字段，如 `runSupply: { runId, tickets, lastCreditedStage }`，并绑定同一工厂 `runId`。每场胜利的 `runId:stage` 在胜负结算事务中仅记一次 +1；第 7 胜同次提交本局券和组末 BP，但分别记账、分别展示。`lastCreditedStage` 需检查连续 stage 与合法结果，避免导入档倒退或重复加券；起新局归零，组末 BASE 可续快照不清，主动结束或败退清零。未来消费须在用户定稿商品/价格/限购后另加扣券流水，本任务不得临时借 BP 钱包、`coins` 或 `spendWallet()` 做兑换。旧版存档无需迁移，但新 schema 旧档拒绝/重置须沿用现有明确提示；同版本快照的 REWARD 字段损坏走保护界面，不可静默回 BATTLE 或重新生成卡。

`saveManager.ts` 的自动保存合并当前只保护“持久 ROUND_RESULT 不被旧 BATTLE 覆盖”。需扩大为明确的检查点阶段/单调修订规则：旧的 FACTORY_SWAP、REWARD/PENDING 或 BATTLE 状态不得覆盖已提交的 REWARD/READY、CLAIMED 或更高 stage；也不能把新的 BP 钱包状态回滚。页面退出、普通自动保存、导入导出与 `pendingBattleResumeRestore` 走同一验证规则。保存失败时停在当前安全节点并提示重试，不能先改变 UI 再期望后台自动保存补救。

## 分切片实施

1. **规则函数与持久模型。**在 `factoryRewards.ts`/赛后路径函数中按绝对 stage 判定每组 3/6 胜的奖励节点；扩展 `BattleResumeSnapshot`、`saveManager.ts` 的严格解析、序列化、导入及阶段修订；加本局券与每胜去重，保留 BP 单独组末计算。先用固定假卡测试，不开放真实卡内容。
2. **赛后换怪到奖励节点。**修改 `usePokeFactoryGame.ts`、`useFactoryFlow.ts` 的跳过/换怪动作：第 3/6 胜最终队伍提交后进入 REWARD/PENDING；其余胜次原路径，组末原 BP 路径。预取仅针对确认后的下一战，并避免旧缓存键串入换怪后的队伍。
3. **四卡与领取。**在具体 ITEM 子池、TM 候选及效果得到设计定稿后，限定 `useRewardFlow.ts` 仅生成四张 ITEM/TM；落盘 READY 后展示。移除 POKEMON/EVOLUTION/扩容处理在主线奖励中的入口，删除 `RewardScreen.tsx` 的重抽按钮和 BP 价展示，并使旧 `rerollRewards()` 无调用路径。实现 ITEM/TM 领取的原子提交与可恢复 TM 选择。未定商品与价格保留在后续消费任务，不阻断先记录券余额。
4. **恢复与运行验收。**补 BOOT 恢复 REWARD、跨页自动保存、已领未继续、保存失败重试、主动结束/败退清券；完成九世代单选池及首组/跨组真实浏览器验收。最后清理玩家可见的双模式措辞和 `mode: 'CLASSIC'` 旧标签；若仅供内部历史识别，需保证不会呈现模式选择。

## 静态与浏览器验收

- 规则测试覆盖绝对 stage 3、6、10、13 出卡，1、2、4、5、7、8、9、11、12、14 不出卡；第 3/6 胜跳过与换怪都只进入一次奖励，第 7 胜只结组末 BP。胜利重放/双击每 stage 只 +1 券，组末加券与 BP 不互相影响，败退/主动结束清券而既有 BP 保留。
- 保存测试覆盖 PENDING、READY、TM 中途、CLAIMED、进入下一战前的刷新/重开/同版导入；候选不变、不重复发物品、不重复教招。模拟卡片 API 失败、存储写入失败与损坏 REWARD 快照，分别留节点重试或显示保护提示。BP 钱包 50/100 余额下奖励页无重抽按钮，动作层亦不能扣 BP。
- 浏览器在 390×844、320×568、844×390 和实体手机上，新档六选三打到首组第 3 胜：先换怪或跳过，再四卡，刷新后四卡仍相同；领取 ITEM 或 TM，刷新后效果一次；第 6 胜重复另一条换怪分支；第 7 胜只显示 BP 组结算。继续到第二组第 3/6 胜，券余额按累计胜场为 10/13，四卡各一次；失败与主动结束后券清零。记录每节点存档字段、可点击性、截图、控制台与请求失败反馈。若真实 ITEM/TM 子池尚未定稿，只能验收前两切片，不得宣称整条奖励主线可发布。
