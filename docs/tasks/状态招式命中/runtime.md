# 状态招式命中：最终代码实玩

运行于 2026-10-13，2026-10-14 整理完成。代码固定为 **`146c23f35cacd9511b6c05e36edf551959c09075`**。本任务指定的26个受控浏览器场景全部通过；原 PP 回滚失败夹具修复后保持一次消耗，未再次回滚。此结论是本任务运行验收，**不是整个公开版发布通过**。

## 环境、方法与证据入口

- 根目录 `D:/Games/pokeFactory2-worktrees/status-accuracy`，Go3003、Vite4302，同工作树启动，`DISABLE_HMR=true`，代理 `GO_BACKEND_URL=http://127.0.0.1:3003`。运行前后业务源码 diff 为空；未编辑实现、PRD或plan。未停止原3001/4300及基线3002/4301服务。
- 同源 `/api/health` 返回HTTP200、runtime=go/status=ok；数据版本和服务详情见 [environment.json](evidence/final-146c23f/environment.json)。PokeAPI/CSV/cries版本为空，不能把本地代理可用视为完整离线资源交付。
- Playwright Chromium151.0.7922.34，DPR2、`isMobile/hasTouch`，主要390×844；未命中、保护、替身、香草另采320×568与844×390。仅模拟触控，**没有实体手机**。
- 每例独立来源/浏览器context。使用完整受控存档，以真实UI点“战斗”与招式，等待双方各一次出招日志、面板恢复可操作和检查点落盘，再读取状态。没有直接调用引擎推进，没有DEV Win。
- [manifest.json](evidence/final-146c23f/manifest.json) 列26例、源码SHA、每例失败断言、HTTP/console错误、注入范围和截图文件。26例均无失败断言、无pageerror/console error、无HTTP≥400。每例含`injected-save.json.gz`、前后保存数据、`result.json`和实际截图；返还场景按操作步命名gzip快照。
- 真正验收目录只取 `evidence/final-146c23f/`。`evidence/fixture-draft-146c23f/` 是harness调试留档，**不用于通过判定，入库时不要混入最终证据**。

## 可复现的受控范围

基础存档来自已有商店white-herb-self夹具；保留存档schema14及第三战的关联记录。除PP两例原件外，双方主力HP400、抗性数值300、速度分别500/1、能力等级0、无异常，特性替换为不影响命中的illuminate；每队三名持有物各不相同。每方单一招式保证选招明确，未注入期望结果。原始Go招式正文保存在 [move-source.json](evidence/final-146c23f/move-source.json)，正文由当前`buildMoveBattleDataFromPokeApiMove`转换。

| 场景 | 额外受控字段 | RNG处理 |
| --- | --- | --- |
| 双方羽毛舞hit/miss | 状态招式accuracy=100/0，目标香草；无香草对照保持普通持有物。初次currentPp/maxPp均不注入，沿用正文pp | 不覆盖Math.random |
| 冥想/求雨/能力上限 | 对手真实使用保护；预置替身counter100、闪避+6；上限例我方特攻/特防+6 | 不覆盖 |
| 保护/替身 | 保护由对手真实出招；替身例预置有效替身counter100；目标香草 | 不覆盖 |
| 自降香草 | 蛮力真实效果，初始香草 | 不覆盖 |
| 王者盾牌香草 | 对手真实使用王者盾牌；**我方撞击battleData.makesContact=true受控注入**。原因见已知问题 | 不覆盖 |
| 完整回合刷新 | 我方羽毛舞accuracy0；初始晴天剩3回合 | 不覆盖 |
| PP回滚回归 | 原修复前miss/hit两例注入存档原件，飞翔accuracy100、对方撞击accuracy0/100、剩饭与缺血 | 不覆盖 |
| 同轮沙暴 | 先手沙暴/无天气冥想对照，先手目标特性sand-veil；后手羽毛舞accuracy100，双方先手各一组 | **仅4例固定Math.random=0.9**，确保普通100命中而沙隐80未命中，非自然概率抽样 |
| 同轮薄雾 | 先手薄雾/无场地冥想；目标normal接地或flying非接地；后手剧毒；双方各3例 | **仅6例固定Math.random=0.5**，稳定通过剧毒90命中分支，验证异常适用性 |
| 下战返还 | 保持第三战关联字段，三名对手currentHp=1，真实蛮力击倒→胜利→跳过换怪→商店离店→第四战 | 不覆盖，无DEV Win |

## V1–V10逐项结果

| 计划 / AC | 运行结果与目录 | 证据边界 |
| --- | --- | --- |
| V1 / AC1、AC5 | `status-player-hit/miss`、`status-enemy-hit/miss`四例通过。命中实际降攻后香草恢复至0、当前香草消费、装备基准保留；未命中攻等级0且香草保留；双方PP各一次。`status-hit-no-herb`直接观察目标attack=-2。 | accuracy100/0是受控接线；不称自然命中率抽样。 |
| V2 / AC2 | V1保留数值0/100分野；V3实际null招式生效。V10另以同轮天气、固定0.9证明100受沙隐修正。 | 无防守、毒系剧毒必中、ignore flag、命中等级各边界由plan规定的独立静态测试补足，见audit；未另称这些组合均已浏览器实玩。 |
| V3 / AC3 | `self-calm-mind`在对手保护/替身/高闪避下特攻/特防各+1；`field-rain`真实求雨得到rainy且本轮结束剩4；`self-cap`两项仍+6不超限。正文null未修改。 | 黑雾/摇晃舞分类及全部旧无效条件使用计划静态证据，未逐招扩展实玩。 |
| V4 / AC4 | `status-protect`、`status-substitute`保留对应阻挡反馈、目标attack0、香草不消费，PP各只扣一次，无额外miss反馈。 | 个别显式绕过例外的静态验证见audit，不泛化全部声音技。 |
| V5 / AC5 | `white-herb-self`蛮力自降后只一次香草；`white-herb-kings-shield`真实保护→接触自降→一次香草、攻防归0、装备基准不变。`white-herb-next-battle`第一击消费后真实走完受控第三战，经过换怪/商店至第四战，当前香草返还、全等级归0。 | 王者盾牌例注入contact flag；下战例对手HP1，是受控短战，非自然七战。 |
| V6 / AC6 | `complete-round-refresh`双方本轮各一次出招，PP各一次，晴天计时3→2，刷新前后PP/HP/能力/道具/日志/阶段/场地完全一致（仅checkpointAt允许变化）。 | 不虚构存档没有的roundId；更广轮次组合由独立静态门禁补足。 |
| V7 / AC6 | `pp-miss-leftovers`、`pp-hit-leftovers`两例真实飞翔伤害、敌方miss/hit分支、一次PP、剩饭和完整回合都正确。首次currentPp缺省也由V1/V3等实际样本覆盖。 | 未新增飞翔两回合机制；所有伤害概率顺序仍由既有静态回归约束。 |
| V8 / AC7 | 固定最终SHA、真实Go+Vite、26例全无页面/HTTP错误；320/390/844关键截图已实际查看。未命中、保护、接触降攻与香草文本可读，未被初版夹具通知遮挡。 | 模拟视口不是实体手机；未证明所有屏幕与无障碍流程。 |
| V9 / AC8 | 两例与修复前相同完整夹具。原miss例轨迹15→14→15，现在两例均**15→14并保持14**，完整回合及刷新都14，敌方撞击35→34；miss例我方HP300→325，敌方400→382。 | 修复前目录位于主工作区`docs/tasks/手机资源基线/pp-probe/`，没有覆盖。 |
| V10 / AC2、AC6 | `same-round-weather-{player,enemy}-{sand,none}`四例：先手真实沙暴后后手羽毛舞miss，目标attack0；无天气对照相同RNG命中，目标attack=-2。`same-round-misty-{player,enemy}-{grounded,no-field,flying}`六例：新薄雾的接地目标不上异常，无场地和飞行对照均bad_poison；场地计时4。 | `.9/.5`是明确受控RNG；当前weather/field读取闭环有UI证据，其他治疗/补位/顺风等读当前值路径仍按计划静态审计边界，不冒充全部实玩。 |

## 重点状态与截图

- [修复后PP未命中分支](evidence/final-146c23f/pp-miss-leftovers/after.png)：画面PP14/15，日志对手未命中与剩饭恢复；原始DOM轨迹与刷新字段在同目录result.json。
- [320香草接触路径](evidence/final-146c23f/white-herb-kings-shield/after-320x568.png)、[844保护阻挡](evidence/final-146c23f/status-protect/after-844x390.png)：实际审阅文本可读。
- [同轮沙暴](evidence/final-146c23f/same-round-weather-player-sand/after.png)、[同轮薄雾](evidence/final-146c23f/same-round-misty-player-grounded/after.png)：异常/能力效果以result.json状态为准；薄雾阻止剧毒没有专门的新提示，不能仅凭场景颜色作证。
- [进入第四战](evidence/final-146c23f/white-herb-next-battle/next-battle.png)：界面4/7；同名gzip快照中当前held和equipped均white_herb。

## 已知问题与harness修订

1. **自然招式接触正文缺口尚在**：本次Go原始撞击正文无flags，`src/features/game/data/battle/index.ts:98–102`从data.flags和本地override合并，得到makesContact=false。V5经orchestrator明确允许，仅该例注入true来验证既有接触惩罚/香草入口；这不证明自然撞击contact数据完整。后续TM固定正文准入应核flags，不能用此受控通过替代自然数据验证。
2. 初版基础夹具把三名持有物都设厚底靴，触发导入规整提示，挤压320画面。实际审图发现后中止，改为合法唯一装备并完整重跑正式目录。不是业务回归，也没有把被提示遮挡的旧图当最终视觉通过。
3. 返还例最初只把第三战改为第一战而未同步关联钱包/局内记录，游戏正确拒读不一致存档。最终保持第三战字段，真实经过奖励商店进第四战。失败试验放`fixture-draft-146c23f/herb-invalid-stage`，未计最终样本。
4. 运行验收时没有改源码。主脚本一部分样本在等待其它独立context时执行，但同一来源互不共享存档。harness补丁只改测试夹具，不触发Vite实现变更。

## 复用与裁决

主脚本 `node --import tsx docs/tasks/状态招式命中/run-status-browser.mjs`，可用`PF_STATUS_CASES`逗号名单和`PF_STATUS_BATCH`分批。返还脚本 `node docs/tasks/状态招式命中/run-herb-return-browser.mjs`，依赖主脚本生成的white-herb-self夹具。重跑应新建证据目录，不覆盖当前冻结SHA证据。

**本任务指定受控运行验收 PASS。** 四项静态门禁与305/305测试由独立auditor记录，本player不冒认亲自重跑。自然完整长局、实体Android/iOS、生产/弱网、未接入特殊招式和自然contact正文完整性仍未验证或未解决。交orchestrator结合上述边界判定合入及回填。
