# 战斗日志本地化实施记录

2026-09-26，先处理引擎与结算库中的玩家可见消息。新增 `src/features/game/battle/battleLogText.ts`，以显式语言参数选择完整中英文句子，并统一状态、能力数值和招式名称。引擎消息仍返回现有 `string`，不会改变战斗事件和历史日志的数据形状；未对历史文本做正则翻译。

`resolveEndTurn({... currentLanguage})`、`resolveBeforeMoveChecks({... currentLanguage})`、`resolveSecondaryEffectsStep({... currentLanguage})`、`applyMoveSecondaryEffects({... currentLanguage})`、`resolveProtectionCollision(attacker, defender, move, currentLanguage)`、`resolveTypeImmunityReaction(move, defender, fieldState, attacker, currentLanguage)` 增加可选语言参数。未传参时沿用英文，调用方需传当前语言才能显示中文。控制器接线由并行程序员在 `useBattleController.ts` 完成，已只读核对六处调用均传入 `currentLanguage`。

已覆盖剩饭、天气与场地恢复、状态/噩梦/诅咒伤害、睡眠/冰冻/混乱/麻痹/着迷无法行动、异常施加、能力升降、扎根/寄生种子/束缚、守住碰撞和特性免疫消息。中文不再把宝可梦名称与英文所有格、`rose`、`is confused`、`restored HP with Leftovers` 拼接在一起。招式优先使用已有 `zhName`；缺失时仍使用原始名称，需由素材数据校验覆盖率。

当前仅覆盖 engine/lib 消息源，不能据此宣称中文战斗日志全面完成。`useBattleController.ts` 仍直接生成英文：约 517、541、571、594、611 行的树果和道具回调；约 692–694 行的吸血与反伤；约 1381–1453 行的捕获与换人；约 1587–1736 行的梦话、打鼾、睡觉、替身、诅咒；约 1851–2204 行的王者之证、守住、替身、未命中、要害、道具恢复、多段命中、吵闹；约 2520–2583 行的吵闹、招式锁定、先制之爪。这些都需要由持有控制器的程序员或下一任务逐句改成显式双语；引擎只透传树果和道具回调的现成 `message`，无法在源头替它翻译。`formatDynamaxEndMessage` 已由控制器调用 `t('specialDynamaxEnd')`，需运行确认该词条完整。

新增实质性双语测试：剩饭、混乱无法行动、混乱施加及攻击提升。`npm run lint`、相关 28 项测试、`npm run build` 通过；全套 112 项测试由并行程序员运行通过。浏览器中含剩饭和混乱的即时日志、语言切换与刷新恢复，还需由 player 角色运行验收。

2026-09-26 后续处理了控制器直接生成的英文。现已覆盖树果和携带道具恢复/治愈/能力提升、吸血与反伤、捕获与换人失败、梦话/打鼾/睡觉/替身/诅咒、王者之证、守住、未命中、替身承伤、要害、击落道具、气势头带、贝壳之铃、多段命中、大闹、招式锁定与先制之爪。敌方名称使用中文“对手”前缀；已知携带道具和精神状态在中文日志中使用中文名。消息仍在控制器事件发生处生成完整句子，使用 `battleLine` 和 `battleItemMessage` 显式选择语言，没有改变战斗效果、事件时序或历史日志。

新增 `battleLogText.test.ts` 覆盖控制器道具消息的中英文完整句式。全套 `npm test` 当前 119 项通过。生产构建由 orchestrator 在代码冻结后统一复跑，本轮重复构建已取消。当前浏览器运行验收正在 player 执行，尚不能依据静态测试宣布实际日志全部通过；招式 `zhName` 缺失时仍会回退原始名称，需在数据覆盖率检查中继续核对。
