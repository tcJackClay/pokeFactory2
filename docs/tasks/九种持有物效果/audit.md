# 九种持有物效果：独立静态审计

## 裁决

**BLOCKED — A1：挣扎同时击倒双方时漏处理防守方倒下与整队胜负。**

- 冻结候选：`b068eef2b7dd6dfd002b3d27d70a4846884d4c37`，工作树 `D:/Games/pokeFactory2-worktrees/held-item-effects`，对照 `d4a17b6`。
- `97e762e` 是 designer 文档 `053708f` 的 cherry-pick；本次共检查 35 个变动文件（含该设计澄清、生成表与任务文档）。业务文件未作修改，未提交。
- 已读 AGENTS、auditor 角色、factory-build、PRD、plan/context、implementation/log、内容准入 K/M/S 与当前规则；固定源 HEAD 独立核对为 `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014`。
- 未启动游戏服务、浏览器或 Playwright。以下仅为代码审查与静态执行结果，不是实玩通过。

## A1 [P1] 同时倒下时提前 return，整队终局未结算

定位：`src/features/game/hooks/useBattleController.ts:2307` 新增挣扎反作用，`:2351–2359` 出招方倒下仅调用其本侧补位，然后 return；防守方的处理在 `:2424` 之后，因早退到不了。`handleAttack` 在 `:2860` 看到任一队全灭便令轮次结束；`roundTransaction.ts` 在 `battleEnded` 时也不会再跑回合末。

**可复现情况：**玩家 1/200 HP、敌最后一只 1 HP，玩家另有健康后备。双方因挣扎同时变成 0 HP，只调用 `sendOutNextPlayer`（开启玩家补位），不调用 `sendOutNextEnemy`/胜利结算；任一队全灭 guard 又跳过回合末，后续点击不能自然补出缺失结算。敌方挣扎、玩家全灭但敌有后备是对称遗漏。敌方最后一只挣扎造成双方全灭时，当前仅走 `sendOutNextEnemy`，该 helper 无后备会安排 WIN，和固定源双方全灭按败退结算冲突。

固定源依据：

- `data/battle_scripts_1.s:6416–6419,3466–3496,8754–8765`：挣扎攻击链、反作用与双方濒死检查；`6695–6710` 的 HandleFaintedMon 先检查整队胜负再补位。
- `src/battle_script_commands.c:4569–4606,4617–4634`：checkteamslost 汇总双方整队 HP；双方全灭是 DREW。
- `src/battle_main.c:5484–5515`、`src/rogue_controller.c:6822–6838`：DREW 落入 BattleLost。此为已有参考规则，不新增产品机制。

修复/复验必须覆盖以下矩阵，且双方都作为挣扎出招方：

| 我方后备 | 敌方后备 | 双方在场者倒下后的结果 |
| --- | --- | --- |
| 无 | 无 | 败退一次，不能先发 WIN |
| 有 | 无 | 胜利一次，不停留等待无意义补位 |
| 无 | 有 | 败退一次 |
| 有 | 有 | 双侧补位，不让已倒下者再行动；同轮回合末至多一次 |

另需回归仅出招方倒下、仅目标倒下、反作用被 Magic Guard 豁免、保护未命中链不扣反作用，以及替身被击破后的反作用。不要仅针对一个方向插入 winBattle，也不要使两条 setTimeout 分别安排胜和负。

### 独立静态复现

命令（工作树根）：

```powershell
node --import tsx docs/tasks/九种持有物效果/static-audit/reproduce-double-faint.ts
```

脚本通过 TypeScript AST 解析**实际生产 executeTurn callback**，使用真实伤害、持有物、生存、反作用 helper；只把 UI setter、日志和补位出口作为观测 spy。`double-faint-results.jsonl` 保存 8 项双倒下组合与 1 项气势头带边界对照。回合结束 probe 只检查生产的 all-wiped guard 与真实 executeRoundTransaction；不冒充完整 React 装载或补位 UI。

关键输出：`actingSide=player, playerReserve=true, enemyReserve=false, hp=[0,0], calls=[sendOutNextPlayer], endTurnCommitted=false`。反向 `actingSide=enemy, playerReserve=false, enemyReserve=true` 仅 `sendOutNextEnemy`。

附加 1 HP 气势头带成功对照：固定 random=0.05，目标仍为 1 HP，挣扎使用者从 200 降至 150；该路径未发现漏反作用。此前补位 spy 未注入 getHeldItemLabel 的一次脚本错误已修正，最终脚本 exit 0；该工具错误不作产品缺陷。

## 其余检查结果

| 规格 | 独立审查结论 |
| --- | --- |
| 焦点镜 | 既有 crit stage +1、物理/特殊与状态技伤害边界接线保留；测试结果通过。 |
| 先制之爪 | resolveActionSelection 先比较优先级，同级才比较单侧 proc，随后速度/空间；控制器每轮抽一次、不追加动作。 |
| 王者之证 | 每击生产入口只有非零伤害且存活本体进入道具机会；替身分支显式传 0。resolveFlinch 对原生与道具分别抽签，保留恶臭、强行、鳞粉/精神力、已行动、极巨化等后置生效门禁；结果经 resolveSecondaryEffectsStep spread 传回控制器，日志不再猜来源。多段后续本体仍可进该入口；畏缩回合末清理。 |
| 讲究头带/挣扎 | 加物攻与特殊不加成保留；UI/handleAttack/enemy 共享 legal set，锁招零 PP 有 fallback；普通出招一次 PP，fallback 不改槽/锁/PP，失物不再限制、换出清锁；无属性/STAB、普通命中跳过、保护与固定反作用规则在真实 helper。**双倒下 A1 未通过。** |
| 气势头带 | resolveHeldItemHit 逐击调用，非致命不抽，致命 10%，不消费 current 或 equipped；回合末间接伤害不调用此 helper。 |
| 厚底靴 | 保留双侧入场岩石/毒菱路径，接地毒先吸收毒菱、飞行毒不吸收；不免普通伤害。 |
| 机变骰子 | 2–5 次范围为 4/5，Skill Link 优先，固定/单发不扩大；生产循环目标倒下停止，PP 在循环前扣一次。 |
| 白色香草 | 保留只恢复负等级、当前消费且装备基准不变的路径；实际无 flags aqua-jet 经 builder 补 contact 后进入保护接触惩罚与白草。 |
| 心灵香草/回复封锁 | 六类加迷恋别名共同清除且只消费一次；自然 heal-block builder、命中/保护/穿替身/芳香幕/重复失败已接入。选招与执行复核；5 回合末先挡恢复再到期。主动/吸取/睡觉、目标治疗比例、剩饭/贝壳铃/HP 果、天气/吸收、扎根/青草/寄生种子受益者、毒疗和梦话调用的限定入口逐项核对。Pain Split/Present 豁免保留。 |
| 元数据 | 生产 builder 引用生成表；4 个布尔不由物理类别猜 contact；未知身份未生成表记录。普通 GEN9 源 936 条，901 映射记录→919 slug，35 显式排除；排除与未有执行器不能算支持。 |
| 继承事务 | diff 未覆盖永久收藏捕捉 transaction/refs；currentFieldDamage/liveFieldRef、当前玩家队伍 PP 传递保持。新消息 await 仍使用共用 epoch 抛错机制。A1 属本任务新增挣扎调用既有倒下早退所暴露的任务内缺陷。 |

## 独立门禁

按 lint → test → build → Go 顺序完成，日志在 `static-audit/`：

| 命令 | 结果 |
| --- | --- |
| `npm.cmd run lint` | PASS / exit 0 |
| `npm.cmd test` | PASS / 353 tests, 353 pass, 0 fail |
| `npm.cmd run build` | PASS / 2253 modules；主包 674.53 kB，保留 >500 kB 警告 |
| `go test ./...` | PASS / exit 0 |
| `node --test scripts/extract_rogue_move_item_flags.test.cjs` | PASS / 7/7 |
| `node scripts/extract_rogue_move_item_flags.cjs --source D:/Games/pokeFactory2/output/rogue-expansion-reference --check` | PASS / 919 slug、35 排除；contact271、ignoreKing0、sheerForce193、healBlock36 |
| `git diff --check d4a17b6 HEAD` | PASS |

通过静态门禁不覆盖 A1。实现者的 353 项测试没有执行这组真实 executeTurn 双倒下终局组合，不能代替新增回归。

## 交回与证据边界

- 无安全局部修复：A1 涉及胜负、补位、事务出口与异步安排，交 orchestrator 路由 programmer，不能审计时随手改一个 return。
- 修复后需新冻结 SHA、独立静态复审，再交 player；本候选不得先写 runtime PASS。
- raw.moves 全池未准入、接棒/祈愿缺执行器、未覆盖特殊多段/能力组合、自然七战、实体 Android 与生产部署仍为既有公开版差距。静态表覆盖与测试数量不代替这些验收。


---

## A1 独立复审：d6e74a0 — PASS

本节是最新裁决；上面的 b068eef BLOCKED 与原始失败记录保留，不改写历史。

- 候选 `d6e74a04bc48f1646ca5a6e03a121b0e30bc867c`；对照 `b068eef`，`59d744f` 仅为上游设计 S 的 `2573e56` cherry-pick。业务差异为 controller 双倒下 20 行处理 + 2 个回调依赖；另加生产回调回归，无其它业务改动。
- 当前判断：**A1 已修复，独立静态门禁 PASS，可交后续整合与最终 SHA 实玩。** 无业务修补、无提交、无游戏服务或浏览器运行。

### 状态与事务复核

1. 目标伤害、道具结果、反作用已同步双方状态后，再判整队存活。先查我方无人 → LOSS（包含双方全灭），再查敌方无人 → WIN；终局分支直接 await 既有结算出口后 return，不再安排两条互相冲突的胜负 timer。
2. 双方有后备时先走真实 sendOutNextEnemy 与入场陷阱链；返回 false（已安排终局）立即结束，不能再开玩家补位。
3. 敌补位 await 后核 mounted、epoch 和 live gameState；失效 continuation 不会开启玩家菜单。前面的濒死日志 await 仍由实际 addMessagesSequentially 的 epoch guard 保护。
4. 随后玩家补位沿既有 replacement promise 与 switchPokemon；新先发 id 不等于轮次预选 id，已倒下成员不会再次行动，END_TURN 恰一次。
5. winBattle/loseBattle 的 callback 依赖加入完整；结算继续从 liveBattleStateRef 读取双方，不回到初始队伍快照。捕捉/收藏和 current-field 路径无新增改动。

### 独立回放与新增结果

原 `reproduce-double-faint.ts` / `double-faint-results.jsonl` 完整保留。独立复审复制为：

```powershell
node --import tsx docs/tasks/九种持有物效果/static-audit/reproduce-double-faint-d6e74a0.ts
```

新输出为 `static-audit/double-faint-results-d6e74a0.jsonl`，13 条：8 种双方后备矩阵、1 HP 气势头带对照、双方出招各 2 种敌入场终局/epoch 失效。仅补新入口需要的 win/lose、pending/epoch/live refs 与 sendOut 边界 spy；生产 executeTurn 仍由 AST 读取，未复制修复算法。新增 ended/stale probe 按该入口返回语义同步敌队全灭/epoch，原粗略 all-wiped probe 仍不是完整 React 实玩。

独立回放观察：

- 我方无后备（敌有/无均可），双方出招方向均仅 LOSS 一次。
- 我方有后备、敌无后备，双方出招方向均仅 WIN 一次。
- 双方有后备，先 enemy replacement，再 player replacement；不安排胜负。
- 敌补位已终局仅 `sendOutNextEnemy, WIN-scheduled`；epoch 失效仅 `sendOutNextEnemy`；二者无玩家补位或回合末。
- 气势头带在 1 HP 再次触发仍保留物品，使用者 200→150，反作用正确。

同时独立执行了新增真实 handleAttack/runEnemyAutoAction/executeTurn/sendOut/switchPokemon 回调测试：验证 8 矩阵中 terminal 一次、双方补位旧成员只行动一次、ACTED/SKIPPED 与 END_TURN 一次；真实入场岩石伤害耗尽后备后只终局；epoch 失效；仅一侧倒下、保护、Magic Guard、替身与 Focus Band 回归均通过。终局 I/O 使用 spy，仍不表示存档/浏览器验收。

### 新候选独立门禁

按 lint → test → build → Go 串行运行，均 exit 0。新日志为 `static-audit/{lint,test,build,go}-d6e74a0.log`，未覆盖旧日志。

- lint PASS。
- npm test **356/356 PASS**，0 fail。
- build PASS，2253 modules，主包 674.92 kB；原 >500 kB 警告保留。
- Go PASS。
- 固定 flags `--check` PASS（919 slug、35 显式排除），该部分未改动。
- `git diff --check b068eef HEAD` PASS。

### 后续边界

若再整合已验 UI，需核对最终合并差异、静态门禁与最终运行 SHA；本次 PASS 不自动覆盖未知后续改动。当前仍无九道具最终浏览器、自然七战、实体 Android 或生产环境证据。原报告列出的全池准入、接棒/祈愿及特殊互动差距继续保留。


---

## 最终整合复审：272f360 — PASS

本节为本任务当前最新静态裁决：**PASS，可将 `272f360cf1adce528d2c17c8b9b260f32cea0c66` 原样冻结交 player。** 仅批准进入最终 SHA 实玩，不宣称运行验收或公开版完成。

### 整合边界的独立核对

- HEAD 与通知一致，双父为已审 `d6e74a04bc48f1646ca5a6e03a121b0e30bc867c` 和已验 UI 主线 `755dbec9b997cdebffdc611094de2c618fb7b8f6`。
- 相对 d6e74a0，`src/backend/scripts` 确认恰好 7 路径：EventsScreen.tsx、StartScreen.tsx、baseEventCopy.ts、baseEventUi.css、useEventDisplaySnapshots.ts、eventDisplaySnapshots.test.ts、eventDisplaySnapshots.ts。
- 上述七文件逐字节比较 `755dbec` 及其已验业务版本 `a9dbde3` 均无差异。已阅读 UI 独立 A1 PASS 与 orchestrator acceptance；该旧 UI 证据仅作为整合输入的来源，不代替本合并提交的道具实玩。
- 道具 controller、全部 battle engine/data、battleResolution、types、uiStrings、scripts 与 d6e74a0 均无差异；A1 双倒下修复完整保留。package/lock/tsconfig/Vite/backend 无额外变化。不存在手工冲突造成的业务第三版。
- 当前 `git diff HEAD -- src backend scripts`、暂存区以及这些目录下的未跟踪源码均为空。现场仅既有审计/准备文档与本次追加，不存在运行中会热更新的源码编辑。
- UI 新逻辑沿独立模块，仅把摘要/推荐页面状态与文案显示接入；未向 battle controller 或结算注册新的回调。无需要重新设计或扩大测试面的整合风险。

### 门禁记录核对（本轮不重复已通过实验）

`integration.md` 记录该自动合并、提交前串行 lint→test→build→Go 全 PASS，fixed flags --check PASS。独立读取现场 `static-integration/test.log`，确认为 368 tests / 368 pass / 0 fail，与原已审 356 加 UI 12 项一致。

本轮四门禁依据是整合执行者的串行记录；本 auditor 没有再次运行它们。现场 static-integration 只留 test.log，未声称已独立读取不存在的其它三项原始日志。前一冻结 d6e74a0 的四门禁为本 auditor 实际独立运行，记录仍完整保留。

本轮独立执行的 `git diff --check d6e74a0 HEAD -- src backend scripts` PASS；固定元数据全部字节与已审版本相同，结合整合 --check 记录无需重复提取器实验。构建 2257 modules / 主包 682.02 kB 的原 >500 kB 警告依然保留。

### 交给 player

使用最终 `272f360cf1adce528d2c17c8b9b260f32cea0c66` 的真实前后端完成九道具 V1–V10，并保留受控注入/随机来源及模拟手机视口的边界。不得复用旧提交截图代替本提交结果。运行期间源码保持冻结；若再改业务，须另行说明差异与重新冻结。

本轮无业务修改、无提交、无服务或浏览器运行；原 b068eef BLOCKED、d6e74a0 修复 PASS 及全部回放输出未覆盖。


---

## 终局取消日志局部复审：6d95772 — PASS

本节为最新静态裁决：**PASS，可将 `6d9577268df1e45207bdd54d8ec2f8ae08a7564e` 原样冻结交 player 全量重验。** 该结论不替代最终代码实玩。

### 修改边界与生产错误边界

- 对照 272f360，提交恰好修改 4 个文件：controller、heldItemEffects.test.ts、implementation.md、review.md。唯一业务变化为 resolveBattleResult 外层 catch 按实际 `StaleRoundError` 类过滤预期取消，普通 Error 仍由 console.error 记录。
- 正常 WIN/LOSS 提交后切换 ROUND_RESULT 会更新 epoch；此前消息等待抛出的 StaleRoundError 被外层无差别记录。该补丁仅修复日志边界，没有更改结算顺序、幂等调用、epoch 校验、pending 状态或 finally 清理，也没有放宽旧回合的执行资格。
- 内层存储失败处理仍保留明确错误日志、待结算上下文及 settlementError；失败不进入结果页、不发放余额。A1 双倒下分支及 UI 整合均未改变。
- git diff --check 272f360 HEAD 通过；审查现场生产目录 src/backend/scripts 相对 HEAD 无修改，暂存区为空。

### 实际生产回调验证

独立审查并运行新三组回归。测试通过 AST 取得实际 StaleRoundError、addMessagesSequentially、resolveBattleResult，替代外围状态 setter、存储和时间等待，不复制待测算法。

1. 正常 WIN 与 LOSS：各只结算一次，结果和连胜正确，队伍恢复且当前引用同步；结果状态引起 epoch 更新，消息等待取消不再输出 console 错误，pending 清空、settlementError false、loading false。
2. 普通消息异常：原 Error 保持可见，结算仍只提交一次，结果页不回退，finally 清理 loading。
3. 存储异常：保留 Factory settlement failed 错误、pending 与 settlementError，停留 BATTLE；不产生结果、余额或恢复队伍的假成功，finally 清理 loading。

### 独立四门禁

本 auditor 按 lint → test → build → Go 串行实际执行，四项均 exit 0。新日志另存 `static-audit/{lint,test,build,go}-6d95772.log`，未覆盖旧日志。

- npm run lint：PASS。
- npm test：**371/371 PASS**，0 fail、0 skipped。
- npm run build：PASS，2257 modules，主包 682.04 kB / gzip 205.64 kB；既有 >500 kB 构建警告保留。
- go test ./...：PASS。

固定源元数据与已审 272/d6 字节不变，本次无重新提取需求。无业务修改、无游戏/服务运行、无提交。

### 实玩交接

272f360 的 24 份完整实玩结果（22 项局部通过、2 份终局日志缺陷现场）仍是历史证据，不能替代 6d95772 全量重验。原始失败、复现、截图和旧审计全部保留。新 SHA 需要重新覆盖正常 WIN/LOSS 的终局控制台及完整 V1–V10；自然长局、实体 Android、生产环境等原有证据边界不变。
