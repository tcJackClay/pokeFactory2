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

最终业务代码停止写入后的门禁：

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
