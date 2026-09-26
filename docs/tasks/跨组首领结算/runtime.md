# Classic 跨组首领结算试玩验收

2026-09-26，在前端 4300、Go 服务 3001 和 390×844 Chrome 移动模拟中，从 `127.0.0.43:4300` 独立 v10 新档走到第 21 战；所选世代为第九代。全程同一 `runId=run:82a30f60-d451-4560-af4a-102fb0c350e7`，阶段间通过浏览器导出的同档 `storage_state` 重开，未人工改写存档字段；这不是单一标签从头持续打开。用户 `127.0.0.1` 存档未读写。运行版本为 `13a7a85` 加本轮训练家记录修复工作树。

## 三组逐战结果

| 战次 | 出招与胜利方式 | 结算后钱包 | 结算组号 | 象征 |
| --- | --- | ---: | ---: | ---: |
| 1 | 实际出招一回合，随后 DEV Win | 0 | 0 | 0 |
| 2–6 | DEV Win | 0 | 0 | 0 |
| 7 | DEV Win，对手 `FRONTIER_TRAINER_MAXWELL` | 3 | 1 | 0 |
| 8 | 实际出招一回合，随后 DEV Win | 3 | 1 | 0 |
| 9–13 | DEV Win | 3 | 1 | 0 |
| 14 | DEV Win，对手 `FRONTIER_TRAINER_ARMANDO` | 6 | 2 | 0 |
| 15 | 实际出招一回合，随后 DEV Win | 6 | 2 | 0 |
| 16–20 | DEV Win | 6 | 2 | 0 |
| 21 | DEV Win，对手实际为 `TRAINER_NOLAND` | 20 | 3 | 1 |

第 1、8、15 战真实出招的画面分别见[第 1 战](evidence/run21-stage1-real-turn.png)、[第 8 战](evidence/run21-stage8-real-turn.png)、[第 15 战](evidence/run21-stage15-real-turn.png)；这只证明正常招式和一个回合能运行，不构成自然打赢三组。其余胜利由可见 DEV Win 辅助。租借选择阶段曾因自动化脚本误点详情而中断，之后重新建独立新档。新档进入第 1 战后，一次 DEV Win 由于战斗消息仍在处理而未生效；随后从该档第 1 战稳定 `READY` 检查点重开，再完成真实出招和后续 21 战，逻辑存档及 `runId` 未换。每战 READY/结果的训练家、敌队、钱包及使用记录见[逐战状态](evidence/run21-observations.json)和[逐战存档审计](evidence/run21-audit.json)。

21 场各有 3 名敌方宝可梦，共 63 个出场位置。以项目 `factorySpeciesIndex.json` 的 `pokemonId→speciesId/gen` 映射核对，全部属于所选第九代，包括形态 ID `10257` 等；无未匹配 ID。每组 7 名训练家 ID 各不重复。第一组训练家记录在结果页和基地刷新后保留 7 条；进入第二组时记录切换为第二组，第二、三组也逐战累积至 7 条。[第 7 战刷新](evidence/run21-stage7-refresh.json)、[第 14 战刷新](evidence/run21-stage14-refresh.json)、[第 21 战刷新](evidence/run21-stage21-refresh.json)。

## 组末、首领与幂等

第 7、14 战均为普通训练家，结果页分别显示基础 BP 3，实际到账 +3，没有首领额外 10。每次重开结果页、刷新、返回基地并再刷新，钱包分别保持 3、6，`revision` 分别保持 2、3，训练家使用记录与 `READY/BASE` 续战检查点保留。[第 7 战结果](evidence/run21-stage7-result-clean.png)、[第 14 战结果](evidence/run21-stage14-result-clean.png)、[第 14 战基地](evidence/run21-stage14-base.png)。

第 21 战稳定战斗检查点中的训练家 ID 是 `TRAINER_NOLAND`，第三组训练家记录包含该 ID；[逐战审计](evidence/run21-audit.json)记录了该状态。结果页显示 `NOLAND / FACTORY_HEAD`、`基础 BP 4 + 首领额外 10`、本组 +14、余额 20；[无遮挡结果截图](evidence/run21-stage21-result-clean.png)。钱包 `lastSettlement` 为第 3 组、第 21 战、`isFrontierBrain=true`、`nominalBp=14`、`amount=14`，`settledThrough=3`、象征数 1。重开结果页、刷新、回基地再刷新后，余额 20、`revision=4` 和象征 1 均未重复变化。[第 21 战状态](evidence/run21-stage21-refresh.json)、[基地画面](evidence/run21-stage21-base.png)。

继续进入第 22 战并刷新，保持余额 20、`revision=4`、象征 1，得到第四组首条训练家记录；[继续状态](evidence/run21-stage22-continue.json)。独立从该稳定检查点选择逃跑并确认，第 22 战结果显示本组 +0、余额仍 20；刷新保持，`settledThrough=4`，象征仍为 1。[败退状态](evidence/run21-stage22-loss.json)、[败退结果](evidence/run21-stage22-loss-clean.png)。

本轮逐战脚本记录的页面异常和 HTTP 400 以上响应均为空。未做第一代短样本、第 42 战首领周期、组末继续加载窗口的再次刷新故障注入，也未在实体手机上运行。此前第 7 战继续窗口已有独立运行记录；本次 7、14、21 战仅覆盖稳定结果、基地和下一战检查点的刷新。
