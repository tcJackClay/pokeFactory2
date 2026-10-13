# 技术方案：高速旋转效果

architect 拥有；2026-10-14，**仅方案，未实现、未运行游戏、未验收**。调研 dev=`82a98efecd263f1f788d7425456b086e64cc7a4c`；固定 Rogue=`a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014`。以下 F1–F5 对应本目录 PRD 的五条 Feature Spec，E 指 Edge Cases。

**blocked-by：永久收藏和九种持有物效果合入 dev。** 九道具正在改 builder、独立畏缩、命中后副效果和控制器。实施前必须从整合后的 dev 新建/更新任务工作树，重新读取这些函数与测试；本方案的函数职责是整合依据，调研行号不是待覆盖补丁。不得提前改业务文件。

## 1. 契约核对与现状

- F1–F3 对应 design R1–R3；F4 对应 design §5；F5 和 E 是既有事务/证据约束。没有新价格、招式池、陷阱或世代决定。
- 自然记录 `evidence/attempt-2/rapid-spin-target-observation.json`：海星星120速度0→0、小拳石74速度0→1，目标HP28→24。原始 `damage-raise`、`stat_chance=100`、攻击目标 `selected-pokemon` 被 builder 错解为目标强化。保留历史，不能改写旧证据。
- `data/battle/index.ts/buildMoveSecondaryEffects` 仅根据攻击 target 含不含 user 选择 stat 受益者，还把所有 user 效果置 `isPrimary`。攻击目标、受益者、是否普通次效果必须分别处理（F4）。
- `moveEffectTable.ts` 无 RAPID_SPIN；当前替身命中 `resolveDamage` 正确返回 `applyUserSecondaryEffects=true`、target=false；控制器替身分支在副效果后 `continue`，本体分支在副效果后才处理倒下。不能只在本体存活分支加清除（F3）。
- `trapped/seeded` 的来源字段就在 `volatileStatuses` 项内；`clearVolatileStatus` 会删除整个项。陷阱是 `BattleHazards.{player,enemy}.{stealthRock,toxicSpikesLayers}`。无其他三种陷阱状态（F2）。
- **当前没有 Simple/Contrary 的统一能力阶段变换**：`battleResolution.ts` 直接 oldStage+delta 后 clamp；`stageModifiers.ts` 只有倍率查询。经 orchestrator 明确批准，本任务新增可复用的自身阶段 helper，只接高速旋转，其他招式的完整能力阶段规则仍是后续缺口；不假称已统一实现（F1）。
- 当前普通接触伤害未找到 Rough Skin/Iron Barbs/Rocky Helmet 执行链；已实现的是 `resolveProtectionCollision` 的盾牌接触惩罚。遵守 design 的自身步骤先于 moveend 接触反伤约束；不在本任务新增那些未实现机制（F3/E）。

## 2. 改动面

| 文件 / 函数 | 改动与追溯 |
| --- | --- |
| `src/types.ts` / MoveEffectId | 增加 RAPID_SPIN（若上游已存在则复用），无新存档字段或 schema（F1–F3）。 |
| `src/features/game/data/battle/moveEffectTable.ts` | rapid-spin 指定 RAPID_SPIN，攻击 target 保持 selected-pokemon，secondaryEffects 显式空数组，防止通用 stat_changes 再提一次速度；接触等固定元数据复用九道具生成表（F1/F4）。 |
| `src/features/game/data/battle/index.ts` | damaging 且 meta.category=damage-raise 的 stat 受益者为 user，但仍是普通次效果；status 按原 target，保留其主效果语义。概率/group/requiresHit 不变；user 效果不被目标替身拦住。既有 override 完整优先，不附加重复效果（F4）。 |
| 新 `battle/engine/resolveSelfStatStageChange.ts` | 输入成员、stat、请求 delta，按该成员当前特性处理 Simple/Contrary，再 clamp；返回成员、原/新阶级和实际 delta，消息依据实际结果。仅高速旋转接入，无随机、无对敌能力下降免疫扩写（F1）。 |
| 新 `battle/engine/resolveRapidSpin.ts` | 纯粹的伤后资格及状态变换，输出成员、本侧陷阱、按顺序的清除/阶级事件；一次调用清全部合法项，不改目标/其他队员（F1–F3）。 |
| `battle/engine/index.ts` | 导出上述真实生产 helper（F1–F3）。 |
| `hooks/useBattleController.ts/executeTurn` | 在伤害已同步、替身 continue/目标倒下/战斗结束前的共同命中后入口串接；同步当前两队、hazards refs及React状态，再播放事件；复用九道具的白草即时响应（F2/F3/F5）。 |
| 测试：`data/battle/index.test.ts`、新增 `resolveRapidSpin.test.ts` / `resolveSelfStatStageChange.test.ts`、`resolveSecondaryEffects.test.ts` 或既有 lib 测试 | 测真正函数输出及生产构造链，不用源码包含字符串证明行为（E）。 |

### 2.1 正文与元数据（F1/F4）

固定普通源 `battle_moves.h` 的 RAPID_SPIN 正文及 design §2 是对照；原自然 Go 记录的基础正文已经符合。分别经 `pokeApi.ts/fetchMove` 和 `fetchMoveByName` 实际构造，断言 Move 的 type、class、power、accuracy、pp，以及 battleData 的 effect/target/contact/secondary 列表。禁止给夹具手写 appliesTo、effectId 或 makesContact。

当前两个 fetch 入口直接使用 API 基础正文，builder 只生成 battleData。若整合时普通 Go 正文不符合固定值，报告具体字段并在这两个入口共同调用的最小正规化点修复本招；不能只修改 battleData 却声称 Move.power 已固定。正常符合时无需扩写整个正文系统。其余全招式固定正文归独立任务。

通用 `damage-raise` 修复限定其 stat_changes 语义；不能以 change>0 决定 user。flame-charge/power-up-punch/charge-beam 保留概率及九道具固定 `sheerForceBoost`，其自身变化不是主效果；swagger/flatter 对敌强化与混乱不改变；ancient-power 等显式 group override 优先（F4）。高速旋转自身 helper 不进入该随机次效果循环，既不额外抽骰，也不被强行抑制。

## 3. 伤后状态契约与接线

### 3.1 纯 helper（F1–F3）

输入 `move`、`actingSide`、**当前动作的原成员身份**、已扣PP的当前 `actor`、当前 `hazards`、该次真实 `hitResult`。资格要求 RAPID_SPIN、当前actor存活、未miss/未被保护/实际multiplier>0、命中允许自身效果；不能额外要求目标存活或本体HP下降。替身受击且本体无掉血仍合格。状态招式/其他伤害招式一律 no-op。

处理顺序：清 trapped整项 → 清 seeded整项 → 本侧毒菱归零 → 本侧隐形岩清除 → 自身速度阶段变换。清除不依赖阶段能否继续变化；无项目仍提升。以 immutable copy 保持另一侧、其他 volatile、非易失状态、天气/场地/顺风/屏障、当前道具/返还基准、PP和所有其他队员原值。事件只为实际清除/阶段变化生成，+6且普通能力不输出虚假提升；Contrary在+6应降一级，不能提前用+6短路（design R1/R3）。

### 3.2 控制器整合（F3/F5）

1. 使用九道具合入后的命中结果。保护/miss/免疫已有失败出口仍在本helper之前；无行动不调用。保护接触反伤沿现有流程，不能用发生接触作为成功资格。
2. 扣目标本体或替身HP并同步后，在共同伤后位置调用；本体和替身两条路径必须收敛到同一封装，不能仅在原副效果函数内部附带修改hazards。局部 `rapidSpinResolved` 只在本动作真实合格调用后置位，保证清除/提速一次；不要混用 targetHasActedThisTurn 或回合序号当执行记录。
3. 先写回当前 nextPlayerTeam/nextEnemyTeam及updatedActor，再同步 `hazardsRef.current`、`liveFieldRef.current.hazards` 和现成 setHazards；只调用React setter不足以保证本轮后续入场/保存拿到新陷阱。
4. 将确定的清除/阶段事件加入真实battleLog；在目标倒下补位及结算之前展示。速度下降会进入既有白色香草响应，保留装备基准。避免再经通用 secondaryEffects 施加同一次+1。
5. 兼容独立王者之证分支：旋转自身步骤即使目标倒下/替身受击仍发生；道具畏缩仍用上游独立资格、逐击随机与事件，不能因为自效果合格而放宽畏缩。正常一次旋转不会为速度/清除引入随机调用。
6. 使用事务当前epoch/round的existing guard与 `addMessagesSequentially` 的 StaleRoundError；若新增await后还有写入，重新确认同epoch及原actor身份，不能改到补位成员。不要新增回合提交或把半轮状态落盘。
7. 本次清除后的同轮末直接消费新队伍，不再结算seeded/trapped；正常中毒/扎根仍照常结算。下一轮行动排序读取新速度，当前已确定的两动作次序保持原事务规则。普通换人与下一战的恢复仍由现有模块负责。

### 3.3 可观测字段

| 字段 / 事件 | 不变量 | 验证消费 |
| --- | --- | --- |
| actor/target id、两队槽位及 GamePokemon.currentHp/maxHp | 自身变更不写入target/补位者；替身与本体损伤分开 | V1–V5、V8 |
| actor/target.statStages.speed，actor.abilities[0] | 普通自身变化、能力修正/上下限；对方速度不变 | V1、V3–V5、V7 |
| volatileStatuses.trapped/seeded及所有 linked/source/turns/counter字段 | 清整个项，不留禁换或回合伤害来源 | V2–V5、V8 |
| volatileStatuses.substitute.counter，nonVolatileStatus，ingrain/屏障 | 替身受伤允许自身效果；无关状态保留 | V2–V4 |
| hazards.player/enemy.stealthRock/toxicSpikesLayers | 只清actingSide，所有层同时清；刷新/后续入场不恢复旧值 | V2–V5、V8 |
| factoryHeldItemId / factoryEquippedHeldItemId，selectedMoves.currentPp | 唱反调白草仅实际负等级时触发；PP每动作一次，道具基准不变 | V3、V6、V8 |
| 实际 UI battleLog、控制器当前队伍/陷阱 props | 伤害→清除/自身变化→倒下/结算；末只瞬时状态可读 | V1–V8 |
| 完整READY checkpoint.phase/status/checkpointAt，两队、hazards、battleLog | 只完整轮保存；刷新一致，下一战恢复另看 | V8 |

## 4. 验证计划

新测试使用 node test + tsx 的真实引擎函数；不引入与实现同构的假控制器。fixture将原 `rapid-spin-go-raw.json` 的生产输入作为原件并记hash，通过生产builder生成Move，场景队伍/HP/状态可受控，但新增实现字段不可手补。

| ID / PRD | 静态结果验证 | 冻结最终代码后的真实UI / 产物 |
| --- | --- | --- |
| V1 F1/F4/E 原缺陷 | index.test：原记录与两个fetch入口构造的正文/target/专用effect；resolveRapidSpin：双方actor变target不变；用实际 `resolveActionSelection` 验下一轮速度跨阈值后排序改变 | `evidence/final-<sha>/v1-*`：受控重建海星星→小拳石和敌方镜像，点击旋转，存完整前后状态/日志/截图；次轮同优先级无爪排序对照。明确不是重新自然抽取。 |
| V2 F2/E 同时清除 | 双侧参数化：trapped+seeded+本侧岩钉/两层毒菱全清；对侧、poison、ingrain、reflect/light_screen、weather/field/tailwind均保持；无项目/只有对侧项目对照 | 一次出招全清，回合末无已清状态伤害/敌方寄生回血；普通中毒仍扣、扎根仍回。随后真实换人，非毒接地无靴成员不受已清陷阱影响。 |
| V3 F1/F2 能力/上限 | 新阶段helper：普通0、+6、Simple、Contrary、-6；清除与提升互不依赖；helper→白草真实响应后等级/当前物品/基准 | +6仍全清；Simple实际+2；Contrary下降日志及白草一次消费；无负等级不消费。小视口复核。 |
| V4 F3 失败/替身 | 生产 resolveDamage→旋转helper：miss、保护、正常幽灵免疫/无法行动 no-op；替身存续/破裂均自身完成、本体HP不变；保护盾接触惩罚不放行 | 用真实守住、幽灵类型、睡眠等；miss如需固定RNG列明；替身两例记录counter及自身速度/清场。不把夹具篡改applyUserSecondaryEffects当验收。 |
| V5 F3/E 击倒时序 | 击倒非末只/末只目标，同样helper结果；后续换入者速度不继承；九道具生产命中后流程的实测接线由右栏保证 | 非末只观察日志顺序和补位后原actor；末只使用下节只读瞬时取证，后接正常结算/恢复。双方末只分别覆盖，不能仅看满血结算存档。 |
| V6 F4 共享解析 | 真正文 flame-charge/power-up-punch/charge-beam：user、原概率、isPrimary=false；固定RNG过/不过及强行对照。swagger/flatter target；ancient-power group单抽且不重复。高速旋转强行仍生效且自身helper不抽骰 | 至少概率自强化、对敌强化、既有override各一真实出招；与强行有/无对照、日志与受益者一致；依赖上游固定元数据并保存来源。 |
| V7 F3/F5 九道具回归 | 旋转配王者之证：item独立生效/不生效、替身/击倒不畏缩但自效果合法；PP一次。上游白草/状态命中/当前field测试全保留 | 代表性独立畏缩与下轮恢复，双方仅一次行动；不把clear事件变为额外回合。 |
| V8 F5/E 保存与短链 | 完整checkpoint/rollback及restoreFactoryParty测试消费旋转后队伍/陷阱；不落盘半轮；两侧snapshot保真 | 普通完整轮刷新保留速度/已清陷阱/PP；真实下一战恢复等级/状态/持有物；最终版本自然短链采集，随机未出现旋转不强求刷档，明确自然本招未覆盖。 |

全部运行证据路径为 `docs/tasks/高速旋转效果/evidence/final-<sha>/`，用case manifest对应输入hash、前后状态、日志/截图、console/pageerror/HTTP错误。`runtime.md`逐项区分受控输入、固定RNG、自然流程，独立player拥有。

### 4.1 替身与末只倒下的观察方法（F3/E）

- 替身场景保留双方健康后备，结束完整轮后读取checkpoint，证明actor速度/清除、target本体不掉血和counter变化；同时保存替身日志。不能仅凭伤害数字判定本体命中。
- 末只倒下后工厂会自动恢复，结算存档无法证明伤后瞬时速度。player在真实点击前安装**只读**页面观察：通过React已提交fiber props定位实际Battle界面两队、hazards、日志，在正常渲染/日志改变时复制必要字段和performance.now到harness内存；不dispatch、不改ref、不改计时器/RNG、不调用战斗函数。
- 本次旋转先同步结果再展示清除/速度日志，正常日志已有展示间隔，故可在倒下/切页前读到该成员和场地；记录随后faint日志和ROUND_RESULT。只读采样须先用V1普通回合与持久化checkpoint交叉校验字段归属，不能误读alternate旧fiber；采集失败标工具未覆盖并修harness，不以旧存档补证。
- 状态panel与battleLog截图证明可见步骤，采样证明真实状态先发生；状态纯函数测试证明边界数值。三者配合，日志单独不作状态正确的替代。禁止新增公开debug API或延迟结算专供验收。
- 如九道具整合已有普通接触反伤，增加低HPactor对接触反伤者：自身步骤发生后才actor倒下，新成员不继承；仍不存在则记缺失机制，不构造假的反伤成功证据。

### 4.2 门禁与视口（E）

programmer和独立auditor：`npm run lint`、`npm test`、`npm run build`、`go test ./...`。审查实际生产调用、当前snapshot、ref同步、epoch、独立畏缩与自身步骤先后。

player在同一冻结业务SHA从工作树根启动真实Go与Vite、确认健康/精灵/招式接口，关闭HMR；主390×844，320×568/844×390复核关键日志/操作。测试全过程不改业务源码；如修复，重做最终版本证据。此任务不等于自然七战、实体Android Chrome或生产验收。

## 5. 风险与评审要点

1. **上游接口变化**：九道具未合入前实施阻塞；合入后刷新命中后/道具响应/元数据接口，本任务不能覆盖上游独立畏缩与当前field修复。
2. **瞬时状态证据**：只读React采样不稳定，必须与普通完整checkpoint校准；末只用例没有采到合法瞬时状态就不判通过。
3. **状态语义缺口**：Simple/Contrary仅在本招新增helper使用，其他招式尚缺统一规则；普通接触反伤、撒菱/黏网/钢阵依旧未覆盖。不得以本切片完成宣称全招式准入。
4. **正文依赖与概率**：原输入经生产builder、固定元数据优先级与普通次效果资格均需实测；高速旋转专用效果不能泄漏到damage-raise通用逻辑，不能额外抽骰或重复提速。

未自行选定玩法数值；所有数值取PRD/design/固定源。Simple/Contrary的最小helper范围、末只只读采样、自然随机缺席时保留缺口均已获orchestrator确认。需评审以上4项工程/证据风险，批准后才实施。
