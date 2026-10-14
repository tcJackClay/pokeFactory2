# 九种持有物效果：技术方案（批准，Route A）

## 1. 基线、依赖与规则追溯

- 调研基线为 `6c34644`；方案评审0次实质打回，orchestrator已批准Route A。2026-10-14实现前已ff整合 `d4a17b6`，状态修复/永久收藏当前refs与捕捉事务均在。以下原调研行号供定位；实施不运行游戏。
- `prd.md` 功能规格按顺序记作 F1–F9；所有改动服务于这九条及其验收要求。规则来源为 `工厂内容准入/design.md` 的九件表、K/M/H 固定源复核。
- **实现前置已满足**：已按 orchestrator 指定的 `d4a17b6` 整合状态招式命中与永久收藏控制器接线并复读差异；调研行号只用于历史定位。
- 状态任务的 `currentFieldDamage`、`liveFieldRef` 行动输入、PP 当前队伍传递、目标分类必须保留；永久收藏事务/捕捉出口不能被旧控制器覆盖。
- 同一 `useBattleController.ts` 只允许本任务串行持有；Route A已于整合后正式授权，仅本任务独占业务文件；固定flags生成由独立programmer按五文件边界并行，类型/builder仍由本任务负责。
- 固定源：主仓 `output/rogue-expansion-reference`，SHA `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014`；普通 `src/data/battle_moves.h`，GEN_LATEST 配置，不使用 revised。
- F4/F9 补充：orchestrator 已明确授权双方共同合法行动 fallback（含无锁全 PP 耗尽）和自然回复封锁最小链；最终来源为主仓 `docs/tasks/工厂内容准入/design.md` M5–M8/S。该文档的最终 M5–M8/S、礼物豁免及第五轮末顺序已随 `d4a17b6` 整合进本树。

## 2. 逐件现状：代码存在不代表验收通过

| 规格 | 当前入口（基线行号） | 结论与最小处理 |
| --- | --- | --- |
| F1 焦点镜 | `data/battle/itemEffects.ts:44`；`engine/resolveDamage.ts:134–138,600–605` | 暴击等级接线已在；验证等级边界、无镜对照/状态技，不重写伤害公式。 |
| F2 先制之爪 | `engine/resolveActionSelection.ts:30–37`；controller:2627,2844 | **缺陷**：先判断爪再判断招式优先级。先比较优先级，同级才比较发动；之后保留速度/空间/同速判定。单次抽签，不在轮内重排序。 |
| F3 王者之证 | controller:2022–2030,2238,2272；`lib/battleResolution.ts:858–884` | **缺陷**：取原生和道具概率 max；强行仍漏道具、无 ignoresKingsRock/恶臭资格、日志凭概率大小猜来源。改成资格明确的独立两次机会与事件来源。 |
| F4 讲究头带 | `resolveDamage.ts:185,418`；controller:1804,2541–2550,2829；`resolveSwitchState.ts:44` | 加攻/锁招/换人清锁已在；**缺陷**：玩家锁招耗尽后无按钮，敌方可退回别招。共享合法行动选择及挣扎补缺，非全盘改 AI。 |
| F5 气势头带 | controller:2246–2261,2314 | **缺陷**：触发时 consumeHeldItem，后续逐击又清物品。删除两处消费语义；保留当前物品与基准，逐击独立生存判定。 |
| F6 厚底靴 | `engine/resolveEntryHazards.ts:54–87` | 岩石免伤、接地毒先吸收毒菱已正确；验证双侧入场/替补及反例；不新增撒菱/黏网。 |
| F7 机变骰子 | `engine/resolveMoveStrikes.ts:56–68`；controller 逐击循环 | 连续攻击特性优先、2–5 取4/5已在；验证目标早倒下、固定次数/单发、一次 PP，不扩大特殊多段规则。 |
| F8 白色香草 | controller:160–204,2064；状态任务已修命中与保护接触链 | 沿用已集成实现；补真实正文 contact 及最终整合版本必要回归，不重写降级系统。 |
| F9 心灵香草 | `itemEffects.ts:137`；controller:718–733；`resolveBeforeMoveChecks.ts:89` | 六类中缺 heal_block；现有共同清除/一次消费可复用。自然回复封锁本身缺实现，按 §5 补真实链。 |

### 2.1 自然正文与可达性证据

- `data/battle/index.ts:96–108` 只读可选 `data.flags`；`moveEffectTable.ts` 未覆盖 contact。既有 `index.test.ts:84` 主动构造 flags，不能证明普通正文具备该字段。普通缓存 fixture `engine/fixtures/rogue-tm-direct-cache.json` 的 aqua-jet 等不带 flags；不能把“physical”当接触。
- `MoveBattleData` 无 `ignoresKingsRock`、`sheerForceBoost`、`healBlockBanned`。只根据有没有副效果判断强行资格会偏离固定正文。
- `useFactoryFlow.ts:786` 默认 GLOBAL_RANDOM，1029–1030 无参考套装时进入 `getProcessedPokemon`；`services/pokeApi.ts:536–554` 注释“have power”但实现无威力/准入筛选，随机取全部 `raw.moves` 中四招。
- 主仓 `var/pokeapi/runtime/v2/9a2e9e562e7e96cba5bdce647097108501e3de707f693649772158ac705de3a6.body` 是天秤偶 `343/baltoy`，其 moves 含 `heal-block`。这是静态自然数据可达证据，不是自然抽取实玩；不能以 TM 未准入来排除现有随机招式缺陷。
- `VolatileStatusId` 已允许任意 string，`battleStatus.ts:75–91` 已把连字符规范成下划线；heal_block 清除无需新存档 schema。真正缺口为施加、限制、时限及治疗入口。

## 3. 文件与数据流方案

### 3.1 固定源最小元数据（F3/F8，F9取决于§5）

1. 新 `scripts/extract_rogue_move_item_flags.cjs` 与测试：只导出本任务所需 `makesContact/ignoresKingsRock/sheerForceBoost/healBlockBanned`。固定源 SHA、原文件摘要、GEN 宏求值写进来源清单。
2. 新 `src/features/game/data/battle/rogueMoveItemFlags.ts` 存普通表对应 move slug 的上述字段。覆盖固定源中可明确映射到 PokeAPI 的招式；901 源记录映射 919 slug，NONE、自定义 SWIRLING_BLADE 与 33 个无对应 PokeAPI CSV 身份的 G-Max 共 35 条明确排除并写入来源清单；这是几个布尔元数据的补全，不覆盖招式威力/PP/命中/其他效果、不把全招式视为已准入。
3. 提取器使用白名单支持布尔、GEN 比较及实际出现的条件块；遇到未知表达式/未映射 slug/重复 ID 报错。不能用 eval 或把未解析表达式默认为 false；沿 `extract_rogue_tm_compat.cjs` 的来源校验和异常映射纪律，不复用其50招范围。
4. `types.ts` 给新增布尔可选字段；`data/battle/index.ts` 用固定元数据补正文缺字段，原始 PokeAPI flags仍保留，其余既有 override 按现优先级；固定源不含的招式明确标未覆盖，不能凭属性或类别猜测。
5. 自然数据测试从无 flags 的真实缓存经生产 builder 得到接触与否；王者盾牌+撞击/非接触招式正反例。player 使用这条生产构造链的存档，只注入选择/场景，不补 battleData 字段；保存原始正文来源/hash。

### 3.2 王者之证、气势头带与心灵香草（F3/F5/F9）

- 在 `lib/battleResolution.ts` 将原生畏缩与物品畏缩分开掷骰；原生概率保持原来源和修正，道具概率取配置。不得改成概率求和、max 或整招仅一次。
- 每次已命中的有效本体伤害之后调用；状态技、零有效伤害、击倒、保护、免疫、纯替身受伤不进道具支路。替身破掉的当击仍不进；后续本体命中可进。保留声音/穿透的现有替身绕过。
- 根据真实固定字段排除 ignoresKingsRock、恶臭、合格强行；天恩沿现修正。现有鳞粉/精神力与忽略防守特性路径按源保持；目标已行动/已有畏缩不再次扣行动，已有极巨化状态的畏缩免疫要纳入现成路径。
- 返回 `flinchSource` 或等价显式事件（move/item），控制器据事件展示道具消息；不再用 moveChance < extraChance 猜。两次都触发也只设置一个 flinch，不制造第二次行动丢失。
- RNG 契约：可测试的单击资格/机会函数接收 random；源util:8111–8118中伤害/no-effect/受伤标志/ignoresKingsRock/存活检查在道具随机之前，恶臭排除在随机之后；SetMoveEffect的鳞粉/强行/替身/精神力/已行动是后续生效门禁。按此分开“需抽取”与“可生效”，原生成功仍保留本来合格的道具机会，测试显式校验调用序列。不触碰伤害命中/暴击随机顺序；多段与其他副效果原顺序保留。
- 气势头带将单击“受伤→是否致命→随机挺住”的计算提取可测 helper（新 `engine/resolveHeldItemHit.ts`），控制器逐击真实调用；不消费、不覆盖当前物品、不修改 `factoryEquippedHeldItemId`，事件仅表示本击发生。间接伤害不调用该 helper。
- 心灵香草将现有纯变换与消息构造分离为可测 helper（可放 `engine/resolveMentalHerb.ts`）；清列表中所有 active 状态及其绑定信息后一次清当前物品，保留非合格状态和装备基准。加入 heal_block；attract/infatuation同时存在也只消费一次。控制器沿现有出招前与施加后的两个入口使用同一个 helper。

### 3.3 共同合法行动与最小挣扎（F4，orchestrator补充）

- 新 `engine/resolveLegalMoves.ts`：统一已有 PP、当前讲究物品/锁名、定身、挑衅、无理取闹、再来一次等选择限制；forced Uproar 已有规则优先保留。心灵香草待触发限制必须按现有出招前解除语义正确判断，不能尚有草却误选挣扎。
- `chooseEnemyMove` 仅接收该共同结果：合法集合非空照旧评分；为空选规范本地挣扎，不偷换其它 PP 招式。`handleAttack` 同样校验，阻止 forged fallback 或非法点击；受限但仍有合法招式时不开放挣扎。
- `BattleMovesPanel.tsx` 从相同纯选择结果构造可点击挣扎入口，保证全 PP 耗尽时不用点击 disabled 按钮；普通四招展示保持现有布局。选择挣扎不写入永久 selectedMoves，不消耗普通招式 PP，不用网络获取。
- `data/battle/moveEffectTable.ts` 或专属常量提供固定源挣扎数据；`resolveDamage.ts`/`resolveTypeEffectiveness.ts` 补其必要类型中立/无 STAB 例外，必中仍受保护，不能只给 normal 导致幽灵免疫。反作用按固定源最大 HP 算法，命中链一次处理（包括替身受击）；保护导致攻击失败不另扣血；双方倒下沿原补位顺序。不落到现有按伤害百分比 recoil 分支。固定脚本8755–8758跳过坚硬脑袋豁免，但仍允许魔法防守免该反作用，不能套通用系列印象。
- 引用：源 `battle_util.c:1822–1905` CheckMoveLimitations/AreAllMovesUnusable；`:316–318` 选挣扎；`battle_moves.h:2918–2946`；`battle_script_commands.c:1399,2267` PP豁免、`:3619–3628` 最大HP反作用；`battle_util.c:10100,10622,10718,10735` STAB/类型例外；脚本6416–6419,3466–3496命中链与8755–8765反作用豁免。
- 换出已有 `resolveSwitchState.ts:44` 清锁复用；失去讲究物品后锁不再限制选择，补清无效锁字段的最小同步点。不得清 `factoryEquippedHeldItemId`，不因 PP 耗尽而解除当前讲究锁。

### 3.4 其它正确路径（F1/F6/F7/F8）

- 焦点镜、靴、骰子、白草保持算法，新增真正结果断言；只有验证暴露契约缺陷才修局部，并先报告超范围问题。
- Quick Claw 调整 `resolveActionSelection` 的比较顺序；概率仍由 itemEffects 配置/控制器一次roll，现有事务决定两个动作各一次。
- 道具说明在 `constants.ts`、factoryRewardPool 及实际卡面配置搜索核对：气势头带不写消费，王者之证不写原生不叠加，白草不局限对手下降；只改与F1–F9直接矛盾的文案，价格/列表不动。

## 4. 状态契约与观测

| 状态字段/事件 | 不变量 | 被验证项消费 |
| --- | --- | --- |
| 两队成员 id、currentHp/maxHp、statStages、abilities | 伤害/挺住/治疗只更新本动作正确成员；倒下停止多段 | V1、V3–V9 |
| factoryHeldItemId | 七种非消费道具保持；两草实际生效才空；拍落只移除当前 | V1–V10 |
| factoryEquippedHeldItemId / factoryOriginalHeldItemId | 战内不变；新战按equipped返还，队伍基准不重复 | V8–V10 |
| selectedMoves.currentPp/maxPp/pp、factoryChoiceLockedMoveName | 普通出招一次PP；多段不多扣；挣扎不新增招式或改其它PP | V2–V7、V10 |
| volatileStatuses flinch/限制/替身（active、turnsRemaining、linkedMoveName、counter） | 已行动者不受倒扣，畏缩不跨轮；香草清绑定信息，普通异常保持 | V3、V4、V8、V9 |
| nonVolatileStatus、hazards、fieldState、weather | 靴只入场既有陷阱；当前场地输入保留状态任务修复 | V5、V6、V8–V10 |
| round transaction transitions、实际行动日志、出招次数 | 两侧最多各一次；道具事件不新建动作；合法fallback进入原事务 | V2–V5、V10 |
| 真实 builder battleData 与源摘要；新 helper 事件/随机计数 | 概率与metadata静态精确，UI只证明生产接线结果 | V1–V9 |
| 保存的READY完整检查点与刷新后同字段 | 整轮原子保存，不落盘半轮；恢复后无物品/PP旧快照回滚 | V10 |

观测使用现有保存导出/完整轮次检查点与截图日志；不为测试新增公开调试API或把动画中半轮快照当存档承诺。消耗即时状态可用现有React状态观测/战斗状态面板，记录方式由player说明。

## 5. 已批准的必要范围：自然回复封锁（F9）

当前已证可自然抽到，不能仅通过注入 heal_block 标签后清除而标F9完整。orchestrator 已批准本任务纳入最小自然可达链；designer最终M5–M8表已核。新增 `engine/resolveHealBlock.ts` 提供禁用招式与各恢复来源的纯资格判断，生产入口调用，不在总HP setter粗暴封禁：

| 输入/入口 | 必要改动面与固定源依据 |
| --- | --- |
| 回复封锁命中→施加 | `moveEffectTable.ts`/`battleResolution.ts`；源battle_moves.h:6707–6720，commands:6356–6370及脚本3421–3432；普通状态准确率和保护仍有效，**穿替身**，芳香幕阻止，已有状态失败不续期。须显式配置substituteInteraction与对手target，不能映射opponents-field后跳过命中。普通状态技无超能力相性免疫；既有反射路径保持。 |
| healBlockBanned 招式不可用/出招时拦截 | 固定布尔表、`resolveLegalMoves`、`resolveBeforeMoveChecks`；源util:1560–1566,1867,3654–3660。吸取整招禁用，不是仍伤害仅禁回血（源test/battle/move_effect/absorb.c:27–43）。先手施加必须影响后手，但不重排行动。 |
| 时限到期/换人/新战 | `resolveEndTurn.ts`、既有 `resolveSwitchState` 与 restore；源commands:6360–6367、util:3181–3189。施加当回合也递减，第5次回合末清除，重复不续期，刷新保存原余时。递减放现有天气/扎根/寄生/青草/HP树果/剩饭处理之后，避免第5轮末提前放行回血；源util:2634,2651,2658与7771–7782,7817先治疗检查后封锁到期，后续ITEMS2不再次回血。普通换人清除；源接棒保留例外不等于授权新增接棒。 |
| 香草立即清除 | 同一副效果后处理/出招前helper消费一次，限制移除后当前或下一次合法行动恢复；正反例比较真正回血/禁用结果。 |

| 现有恢复路径→文件 | 实施动作（固定源定位详见design M7） | V9静态断言/代表UI |
| --- | --- | --- |
| 主动治疗、吸取、吞下/REST → controller:1931,2338；共同legal/checks | 固定healBlockBanned决定整招禁选/禁执行；REST不得先治异常；更快封锁能取消已选后手治疗 | 无草封锁后不能回血/治异常；吸取目标不掉HP；先手香草解除后可正常出手；执行取消不扣PP |
| 治愈波动/花疗 → builder/controller通用healingPercent | 现无独立效果，原通用结算给actor会错。针对这两项既有自然正文补正确target治疗分支，双方任一封锁不治；不生成新招式 | 目标HP改变、施招者HP不变；双方分别封锁；保护/替身按固定正文复核 |
| 文柚果 → controller:655；贝壳之铃→controller:2346；剩饭→endTurn:380 | 封锁者不回血；文柚果不消费；草/PP果/治异常果不受此检查 | 当前物品和HP保持；解除后合格入口正常；不补发被挡回血 |
| 青草场地/扎根 → endTurn:334,171 | 禁受益者回血，保留场地和状态 | 同场另一成员仍回血；解除后恢复 |
| 寄生种子 → endTurn:139–147 | 寄生目标照常扣血，检查受益者封锁；污泥浆损血分支在禁恢复之前 | 目标扣血但受益者不回血；污泥浆仍损受益者，不误免伤 |
| 蓄水/储电/食土/干燥皮肤吸收 → resolveTypeImmunityReaction:47–68 | 免疫不改，只抑制回血与相应日志 | 对应攻击仍零伤害，封锁者不回血；其它吸收加能力等作用不被泛改 |
| 雨盘/干燥皮肤/冰冻之躯 → battleResolution:202–237 | 禁天气回血；仍走已有天气免伤/晴天下损血语义 | 雨雪不回，晴天该损仍损，冰雹免疫仍在 |
| 分担痛楚 → battleResolution:494 | 豁免；维持均分HP结果，不加回复封锁限制 | 封锁者均分仍可增HP，配对无封锁数值相同 |
| 礼物随机目标恢复 → resolveDamage:580–594/controller:2206 | 固定源commands:13468–13516及脚本5801–5809无封锁检查，普通Present也无禁用flag；保持该豁免，不加通用回血禁令 | 目标/施招者封锁仍能收到随机治疗；与礼物伤害分支分开对照 |

源config/battle.h:98以第九代配置限制既有回复。再生力换出、提前许下的祈愿结算是源豁免，当前无专用实现，不借此新建；工厂战后恢复始终照规则。当前接棒在固定租借套装（如chunk_610_709.ts:28）出现但无执行器；祈愿也无延迟结算器。**接棒/祈愿与raw.moves无准入过滤均是明确的后续公开版阻断**，应进入招式准入任务处理，本任务不扩写；不承诺接棒传封锁/定时治疗，修复此单招不代表整个自然池已正确或获准发布。

## 6. 验证计划

所有新增测试走真实纯引擎/helper并由控制器生产接线使用；拒绝源码字符串检查替代结果。双方参数化可覆盖共享规则，UI每件至少具有生效入口与不该生效对照；概率不靠少数随机样本估计。

| ID/规格 | 静态结果断言与文件（新文件可创建） | player真实UI与证据 |
| --- | --- | --- |
| V1/F1 | `resolveDamage.test.ts`同数值同roll有镜/无镜、临界暴击等级；状态技零伤害、镜不消费 | 固定roll说明的出招→暴击/普通日志与HP截图；两侧入口；精确倍率仅引用静态断言。 |
| V2/F2 | `resolveActionSelection.test.ts`高优先级优先、同级单爪/双爪/无爪、空间/同速；事务测试每侧一次 | 慢爪先动对照高优先级；日志排序与PP；下轮仍只有各一次。 |
| V3/F3 | `battleResolution.test.ts`及新helper：原生失败/道具成功、反向、都失败/都成功；天恩、恶臭、源flag、强行资格、鳞粉/精神力/绕过、已行动；逐击计数；零伤害/致死/替身/保护/miss无效 | 恶之波动/铁头真实正文，受控场景各结果；显示来源日志→后手畏缩→下一轮行动恢复；替身破裂后续击、本体免疫反例。28%/37%仅为两独立机会的静态推导。 |
| V4/F4 | `resolveLegalMoves.test.ts`和engine流水线：锁招命中/miss后保持，物攻/特攻对照；换人清锁/拍落不限制；全PP耗尽、锁招0PP或disable/taunt/torment后唯一fallback；有合法招不能挣扎；挣扎类型/反作用/PP | 两侧锁定→非法招不可执行→耗尽显示挣扎→实际攻击/反作用；换出再回/拍落后可换招；持有基准和保存前后对照。 |
| V5/F5 | `resolveHeldItemHit.test.ts`同 holder 两次致命都触发且保留物品；边界失败/非致命不抽；多段逐击/中途失败倒下；间接伤害无挺住 | 同成员两次挺住、下一击未触发对照，毒/天气致死；HP/当前物品/基准截图快照；明确固定随机来源。 |
| V6/F6 | `resolveEntryHazards.test.ts`双方岩石/一二层毒菱、毒穿靴吸收、非接地毒不吸收、非毒穿靴保留层、无靴对照；真实switch/替補入口一次 | 双方正常换人+倒下补位；穿靴HP/异常不变且普通攻击仍伤；接地毒清层证据。 |
| V7/F7 | `resolveMoveStrikes.test.ts`4/5边界、SkillLink优先不多roll、单发/固定次数；真实逐击循环目标早倒下且PP一次 | 多段次数日志/目标HP/PP，击倒提前停与无骰对照；不宣称特殊多段已支持。 |
| V8/F8 | 复用whiteHerb与状态任务测试，增加无flags缓存→builder→王者盾牌接触自降→香草恢复；非接触/未命中/保护/无负等级不误消费 | 自降/对手下降及真实正文接触代表；负归0正保持；消费一次，下一场返还。 |
| V9/F9 | `resolveMentalHerb.test.ts`六类逐项+同时+别名，清linked信息、无状态/毒睡眠混乱不消费；施加/限制/真实回血/到期/普通换出/同轮清草正反例，穿替身/保护/芳香幕；吸取整招不伤目标 | 六类可以用受控起始状态逐项验证解除，但heal_block自然机制须另有真实招式正文施加+回血被阻止/草恢复流程；不能把两类证据混称自然生成。 |
| V10/边界 | 组合事务/restoreFactoryParty/checkpoint：物品与基准、PP、锁名、状态完整轮保存；失败回滚和后手miss不覆盖先手更新 | 最终SHA刷新仍保留本战消费/不消费与PP；通过真实换怪/继续下一战返还基准；390×844主流程，320×568/844×390关键日志/挣扎按钮；不依赖旧SHA截图。 |

- 实现将逐件静态断言聚合于 `engine/heldItemEffects.test.ts`（17 组含参数化双方/多状态及真实控制器回调），复用其它既有单测，未机械拆成每道具一个测试文件。
- 测试路径主要为 `src/features/game/battle/engine/*.test.ts`、`lib/battleResolution.test.ts`、`data/battle/index.test.ts`、`hooks/useBattleController.*.test.ts`，不让每件测试复制控制器算法。
- programmer四门禁：`npm run lint`、`npm test`、`npm run build`、`go test ./...`；auditor独立复核规则、字段/当前队伍、RNG、每击/每轮/消费次数。
- 冻结代码SHA后player同时启动真实Go与Vite；前端绑定0.0.0.0，Go从该树根启动并确认sprite report及数据接口。实玩期间不得HMR修改代码。
- `runtime.md`逐件表记录有效/无效、双侧、截图、前后状态、是否注入招式/数值/RNG、未验组合；只声明本次覆盖，非自然七战/实体手机/生产发布验收。

## 7. 风险与审阅重点

1. **整合依赖已完成**：`d4a17b6` 为本次实际实现基线，继承状态与收藏测试；只改批准入口，独立审计仍须核当前 refs/捕捉/补位没有被覆盖。
2. **F9具体契约**：自然回复封锁已批准纳入，M5–M8与本稿补查PRESENT/第5轮末时序约束必须全保留。更广自然池/接棒/祈愿缺机制是后续公开版阻断，不能用九件任务完成掩盖。
3. **元数据完整性**：固定源C条件/slug映射必须严校验；未知招式单列覆盖缺口，不能默默填false；自然正文和注入字段证据分开。
4. **共同fallback风险**：PP/锁招/限制/UI/AI共享调用避免一边可点另一边拒绝；不能因香草尚未触发而无谓挣扎，不能改变原子事务或AI评分。
5. **RNG/事件时点**：独立畏缩应按固定源逐击顺序；丢失动作/道具日志不能重复。FocusBand两次触发是同持有者，不靠每次重载重新装备。

范围外维持：新增道具、价格/TM上架、捕捉商品、全招式重写、自然完整七战、实体手机、生产/IP门禁；未支持彩虹等互动应如实列未验，不扩机制。


## 8. Route A 实现补查与实际接口

- 固定源 `battle_script_commands.c:17056–17078`：普通治愈波动/花疗为目标最大 HP 的 1/2，超级发射器治愈波动 3/4，青草场地花疗 **2/3**，向下取整且至少 1。数值归 `config/heldItemRules.ts`；不是把花疗统一当 3/4。目标封锁与施招者封锁都不治疗。
- orchestrator 已确认的既有入口补漏：`battleResolution.ts` 毒疗由源 `battle_util.c:2792–2806,2822–2840` 约束，回复封锁时普通毒/剧毒均不回血且不转成毒伤；满 HP 不溢出。新增对照测试，保留既有其它毒计时语义，不扩能力系统。
- `prepareMoveUse` 是控制器逐击循环前的实际 PP/讲究锁更新；缺省 `currentPp` 用 maxPp/pp，挣扎不改四槽。`resolveLegalMoves` 同时供 UI、玩家提交和敌方选招使用，预测当次心灵香草解除但不提前消费。
- `resolveFlinch` 分别返回 `flinched/kingsRockFlinched`；道具候选由控制器当前命中的本体伤害传入，不接纯替身击。`resolveHeldItemHit` 只服务直接单击，不负责间接伤害。
- 挣扎作为最小固定 50 威力 fallback 不套既有通用 Z 增伤；不在本任务新增 Z 招式替换或特殊多段机制。
- 本稿 V1–V10 的真实 UI 项须待独立 player 逐项记录；静态测试不能关闭自然完整七战、实体手机或生产门禁。

- F9 既有调用链补查：项目实际调用入口仅梦话在控制器中将 selectedMove 替换为 calledMove；`chooseSleepTalkMove` 根据固定源 `battle_script_commands.c:13072–13104` 的 `CheckMoveLimitations(..., ~MOVE_LIMITATION_PP)` 先排除受封锁招式。调用确定后再复核封锁资格，呼应 `battle_util.c:3654–3662` 实际攻击 canceller；不能只在随机选中后才失败。保留已使用梦话的单次 PP，被调用槽不扣。没有添加新的挥指/借助/仿效执行器；它们属于更广准入风险。
- 三组真实控制器 callback 回归直接执行生产 `chooseSleepTalkMove/executeTurn`（AST 提取与本仓已有收藏回调测试一致）：全部回复候选被封锁时失败无副作用；未封锁吸取正常伤害与回血；混合候选只调用合法攻击。只替换呈现 setter/日志等待，真实 builder、伤害、副效果、PP helper 均执行，不用源码字符串断言证明接线。


## 9. 独立审计 A1 返修（Route A）

- 冻结 `b068eef` 的独立审计 BLOCKED：既有 `executeTurn` 在反作用致出招者倒下后仅处理本侧补位就 return，漏掉同时倒下目标的整队胜负；在场 HP 都已写入而交易看见全灭便 abort，可能卡 BATTLE 或错误 WIN。
- 上游固定源四组合已定：目标伤害→反作用→整队统一判定；双方有后备都补位，仅我方有人 WIN，仅敌方有人 LOSS，双方无人 LOSS（参考 DREW→BattleLost）。design S 单文档 `2573e56` 已 cherry-pick 为 `59d744f`。
- 最小修复仅落于上述出招者倒下分支：若目标也倒下，先检查我方全队（无人即 LOSS，包含双方无人），再敌方全队（无人即 WIN），直接 await 唯一终局。双方有人先用现有 sendOutNextEnemy 完成真实入场陷阱链；只有返回成功、battleMounted、epoch 未变且仍 BATTLE 时才用现有 sendOutNextPlayer 开启补位等待。敌后备被陷阱耗尽已安排 WIN 时立即停止，不重复安排胜負或开无意义菜单。
- 原单方倒下、现有 sendOut helpers、选择/伤害/RNG、回合末和存档事务算法不改；补 winBattle/loseBattle 的 callback 依赖。新代码不创建 DRAW 或另一个回合执行器。
- 验证从生产源码 AST 取实际 executeTurn、sendOutNextPlayer/sendOutNextEnemy、switchPokemon、handleAttack、runEnemyAutoAction、resolvePreTurnStatus 等回调；真实伤害/入场陷阱/轮次事务执行，仅呈现与最终 settlement I/O 用观测替身。8 组双方出招×四后备组合要求结果一次、旧在场者不再行动；双后备仍 BATTLE、双方补位且原事务恰一次 END_TURN。额外双方入场岩石耗尽敌后备、异步 epoch 失效，以及单侧倒下/保护/魔法防守/替身/气势头带不免反作用对照。
- 审计原件 `audit.md`、旧 static-audit 复现与日志保留不覆盖。旧复现脚本是 b068eef 的当时 callback scope，修复候选的可重放回归以 `heldItemEffects.test.ts` 为准。
