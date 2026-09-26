# 战斗日志本地化实施计划

依据《docs/手机端试玩验收记录.md》：中文界面实际出现 `触手百合's 攻击 rose!`、`芭瓢虫 restored HP with Leftovers!`、`芭瓢虫 is afflicted with 混乱!`、`芭瓢虫 is confused!`。目标是中文战斗日志没有英文句式，宝可梦、招式、道具和状态名称与中文界面一致；英文界面仍能正常显示。

入口不止一处。`useBattleController.ts` 的 `addMessagesSequentially` 直接把 `string` 加入 `battleLog`；该文件还有大量硬编码英文句式。`battle/engine/resolveEndTurn.ts` 的剩饭、天气、能力等事件直接产生英文 `message`；`resolveBeforeMoveChecks.ts`、`resolveSecondaryEffects.ts` 等引擎文件也产生消息。`battle/engine/types.ts` 当前事件类型是 `{ type: 'message'; message: string }`。`battleText.ts` 和 `uiStrings.ts` 已有部分中文名称与界面文案，可作为统一词表的起点。只在日志 UI 中做英文正则替换会遗漏动态参数和新消息。

实现顺序：盘点所有玩家可见的战斗消息源，按“出招、属性、状态、能力、道具、天气、场地、结算”分类；将事件改为稳定的消息键加参数，或在最小改动范围内使用集中格式化函数，由当前语言统一渲染。名称参数应传稳定 ID 或已本地化名称，避免拼出中文名加英文所有格。先覆盖本次四条复现路径，再覆盖同源的剩饭、异常状态、能力与招式回合消息；同版本存档中的 `battleLog` 是历史文本，读取时不应误译或损坏。用户已决定不要求兼容过往存档，旧档可重置或拒绝，但须明确提示。主要文件为 `useBattleController.ts`、`battle/engine/*.ts`、`battle/engine/types.ts`、`battleText.ts`、`uiStrings.ts` 与日志显示组件。

静态验收：`npm run lint`、`npm test`、`npm run build`；为消息格式化写有参数的中英双语测试，包含剩饭、能力提升、混乱施加与混乱无法行动，检查中文输出不含 `is/was/with/rose/'s` 等英文句式；扫描玩家可见战斗消息仍有硬编码英文的路径并逐项处理。运行验收：以含剩饭和混乱的可复现战斗，在 `390×844` 与 `844×390` 连续完成数回合，查看即时消息与历史日志；记录原文、期望、实际、截图、控制台。切换英文后复核相同事件；刷新恢复后日志可读且战斗状态不变。实体手机再复核日志滚动与文字可读性。
