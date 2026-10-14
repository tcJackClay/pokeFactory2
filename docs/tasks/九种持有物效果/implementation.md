# 九种持有物效果：实现交接

## 基线与权限

- Route A，方案实质打回 0 次；orchestrator 明确授权实现与提交，不推送、不合入 dev、不运行游戏。
- 工作树 `D:/Games/pokeFactory2-worktrees/held-item-effects`，分支 `codex/held-item-effects`。先快进整合 `dev d4a17b6`，包含状态命中/PP/currentField 与永久收藏事务。
- designer 的上游文档提交 `053708f` 已单独 cherry-pick 为 `97e762e`，仅补设计来源，不改变本次静态门禁所验代码。
- 固定源 `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014` 普通 GEN9 表；详情见 plan 与 move-flags-source.json。

## 逐件实现与静态证据

| PRD | 实际处理 | 生产入口 / 结果测试 |
| --- | --- | --- |
| F1 焦点镜 | 保留原 +1 暴击等级 | resolveDamage；同 roll 有镜/无镜、状态伤害零 |
| F2 先制之爪 | 先比较优先级，再比较同级爪发动 | resolveActionSelection；高优先级/单爪/双爪/空间 |
| F3 王者之证 | 原生与道具独立抽取；源后置免疫不提前省略道具 roll；返回明确道具来源 | resolveFlinch + controller 每击；独立成功/失败、天恩、恶臭、精神力/鳞粉、强行与固定 flags、已行动 |
| F4 讲究头带 | 保留物攻加成；UI/玩家/敌方同一合法招式集合；无合法招使用最小挣扎 | resolveLegalMoves/prepareMoveUse；耗 PP 锁仍保留、换出清锁、失去道具不限制、双方共同集合 |
| F5 气势头带 | 致命直接单击 10% 挺住，完全移除消费逻辑 | resolveHeldItemHit；同成员连续两次触发、边界失败、非致命无 roll、毒伤不触发 |
| F6 厚底靴 | 保留既有入场算法 | 双侧岩石/毒菱；接地毒先吸收、飞行毒不吸收、普通伤害仍在 |
| F7 机变骰子 | 保留 2–5 → 4/5 与 Skill Link 优先 | strike plan、实际伤害单击击倒即停与生产 PP helper 一次扣 PP |
| F8 白色香草 | 保留状态任务实现；补真实无 flags 正文的 contact 构造 | 缓存 Aqua Jet → builder → 实际控制器保护碰撞 → 王者盾牌降攻 → 香草恢复/消费；Surf 反例 |
| F9 心灵香草 | 补第六类 heal_block；保持一次清除、当前消费/返还基准分离 | resolveMentalHerb；六类含迷恋双别名逐项/同时、毒与混乱保留、下一战返还 |

## 必要补链

- 挣扎：固定 50 物理接触，普通命中跳过，保护仍挡，无属性相性与 STAB，不套通用 Z 增伤，不占四招或扣 PP；成功攻击链按最大 HP 四分之一向下取整且至少 1 反作用，魔法防守豁免、坚硬脑袋不豁免。原补位事务保留。
- 回复封锁：实际招式命中/保护/替身/芳香幕与重复失败；5 回合计时、即时香草、选择与执行都禁受限招式；更快施加后已选吸取/睡觉整招失效且不扣该招 PP。
- 既有 HP 入口：控制器自身回复/吸取/吞下/贝壳之铃/文柚果、回合末剩饭/青草/扎根/种子受益者、天气与吸收特性。保持免疫、晴天干燥皮肤损血、种子污泥浆损血；HP 果封锁期间既不回血也不消费。
- 第 5 轮末回复检查仍被挡，随后解除。普通换人、新战清除；战内状态结构不改，整轮原子检查点流程不变。
- 例外：分担痛楚与礼物不加通用回复禁令；目标治疗对施招者或受益者封锁均禁止。固定源 `battle_script_commands.c:17057–17078` 普通 1/2、超级发射器波动 3/4、青草花疗 2/3，至少 1；数值收敛至 config/heldItemRules.ts。
- 实施审计补漏：毒疗现有入口按 `battle_util.c:2792–2806,2822–2840` 在封锁下不回血也不变成毒伤，普通毒/剧毒/满 HP 都有对照。orchestrator 批准并已补上游。
- 梦话已有调用链按 `battle_script_commands.c:13072–13104` 先排除禁用候选，调用后再按 `battle_util.c:3654–3662` 复核。真实 chooseSleepTalkMove/executeTurn 回调静态执行验证全受限/合法吸取/混合候选，梦话仅扣自身 PP。未添加其它调用招式系统。

## 固定元数据

生成器与测试由独立 programmer 在约定 5 文件内产出，整合前已停止写入。

- 936 源记录，901 映射源记录 → 919 PokeAPI slug；四字段 contact/ignoresKingsRock/sheerForceBoost/healBlockBanned。
- NONE、自定义 SWIRLING_BLADE、33 个无官方 PokeAPI CSV 对应身份的 G-Max 共 35 条明确排除；未知未补成“已支持”。PokeAPI 例外与双连字符 Z slug 均在来源清单。
- 真正物理类别不推断 contact；自然正文无 flags 时使用固定源。其余招式机制仍不代表准入。
- `node scripts/extract_rogue_move_item_flags.cjs --source D:/Games/pokeFactory2/output/rogue-expansion-reference --check` 可离线重现；源漂移、未知表达式/身份与冲突拒绝。

## 静态验证

首轮冻结 `b068eef` 的静态门禁（后由独立审计 A1 阻断，不能据此通过验收）：

- `npm run lint` PASS。
- `npm test` PASS，**353/353**；本任务新增 17 组行为测试 + 3 组固定数据测试，既有收藏/状态/存档测试保留。
- `npm run build` PASS，2253 modules；主包 674.53 kB / gzip 202.83 kB，保留 >500kB 警告。
- `go test ./...` PASS。
- `node --test scripts/extract_rogue_move_item_flags.test.cjs` PASS，7/7；提取器 `--check` PASS（919 slug、35 排除）。
- `git diff --check` PASS。

门禁后冻结业务代码。首次全测唯一失败是旧心灵香草精确列表缺 heal_block，按最新完整列表更新，未减弱断言。

## 保留的风险与证据边界

- 未运行 Go/Vite 游戏、未浏览器实玩；本文件只证明实现与静态验证。独立 auditor 后由 player 在最终 SHA 实玩 V1–V10。
- 自然完整七战、真实手机、生产环境均未由本任务验收。
- raw.moves 随机入口无全池准入，接棒/祈愿缺执行器、其它未知调用招式与未覆盖特殊多段仍是后续公开版阻断；单招补齐不代表全池正确。
- 更复杂技能组合、声波/穿透等所有特殊替身路径尚未逐项运行验收；不得用 17 个静态测试组宣称所有交互已实玩。
- 生产构建保留 >500kB 主包警告，属于现有发布性能门禁。
- 价格、道具池、TM 上架、Rapid Spin、收藏/捕捉逻辑没有本任务改动；独立审计仍须检查共享控制器继承状态。


## A1 返修交接

- 独立审计确认新增挣扎触发旧 `executeTurn` 自身倒下早退，导致双倒下只处理一侧；原始报告及复现原件保留。
- 规则依据更新：designer `2573e56` cherry-pick 为 `59d744f`，源 checkteamslost 与 DREW→BattleLost；见 design S 与 plan §9。
- 修复只加双倒下分支及回调依赖：目标伤害和自身反作用全部提交后，统一两队存活判胜负；仅在双方仍有人时先补敌，再打开玩家选择。终局优先我方无人 LOSS，故双方全灭不会先 WIN。沿既有胜负/收藏 callback，不添加 DRAW。
- 双方都有后备时，先跑既有敌入场陷阱链；返回 false 表示已安排终局即停止。返回 true 后仍检查 mounted/epoch/当前 BATTLE，防止旧异步回调开启玩家补位。
- 生产回调静态回归新增 3 组：8 种对称后备矩阵；双方敌入场陷阱耗尽与 epoch 失效；原单侧倒下、保护、Magic Guard、替身和气势头带反作用。8 矩阵内断言旧成员只执行一次、终局只一次，双方补位后原行动账本 ACTED/SKIPPED 与 END_TURN 恰一次。原四招 PP 没被挣扎扣除。
- 回归直接执行实际 controller 回调及真实轮次与入场 helper，不以同名 spy 代替 sendOut 行为；最终结算 I/O 仍用观测 spy，不把它当浏览器或保存恢复验收。
- 当前业务代码已停止写入，四门禁按 lint→test→build→Go 串行执行；结果在下节。原审计复现脚本对应 b068eef 的旧 scope，当前回放使用新增的生产 callback 测试。


### A1 返修静态门禁

按要求串行：`npm run lint` PASS → `npm test` **356/356 PASS** → `npm run build` PASS（2253 modules，主包 674.92 kB / gzip 202.93 kB，原大包警告保留）→ `go test ./...` PASS；`git diff --check` PASS。当前未运行游戏，需独立复审；尚未整合另一个待验 UI 分支，整合后门禁另跑。


## ROUND_RESULT 正常取消误报返修

- 基线 `272f360cf1adce528d2c17c8b9b260f32cea0c66`；player 已停全部批次后，按 review.md 的局部授权解除源码冻结。
- 唯一业务改动：`resolveBattleResult` 外层 catch 仅跳过 `StaleRoundError` 的 console.error。结算成功后切换 ROUND_RESULT 使旧消息 epoch 失效属于正常取消；真实 Error 继续记录。内层存储失败、pendingSettlement、finally、消息 epoch guard、结算和轮次账本均未改。
- 在既有 AST 生产回调测试中增加真实 `StaleRoundError` 类、`addMessagesSequentially` 与 `resolveBattleResult` 的联合执行；React setter/延迟调度/存储 I/O 使用可观测替身，消息等待期间模拟结果页 render 的 epoch 更新。没有复制结算算法，没有运行浏览器。
- 三组新增回归：WIN/LOSS 均只调用一次结算、保留结果和恢复队伍、epoch 更新后的取消无 console.error；普通消息异常仍记录原 Error 且 finally 释放 loading；存储失败保留 pending/error，留在 BATTLE、不提前提交恢复队伍、不产生结果日志。
- 串行四门禁：`npm run lint` PASS → `npm test` **371/371 PASS** → `npm run build` PASS（2257 modules，主包 682.04 kB / gzip 205.64 kB，原 >500 kB 警告保留）→ `go test ./...` PASS。
- 这里只达到静态可审候选；272 的 22 项通过/2 项缺陷/3 项中断是旧尝试，不是最终 PASS。新提交需独立审计和重新冻结实玩；自然七战、实体手机与生产环境证据边界不变。
