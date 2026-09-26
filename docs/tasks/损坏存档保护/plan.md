# 损坏存档保护实施计划

## 现状与风险

- 当前存档版本是 v10，原始文本保存在 `pokefactory_save_v1`。`saveManager.ts` 的 `sanitizeBattleResume` 遇到 `status:'READY'` 但 `battleKind`、`stage`、玩家队伍或敌队无效时静默返回 `EMPTY`；`normalizeSaveDataSafely` 在其他规范化错误时也尝试把 `battleResume` 清空后重试。这样会把“原本声称可续玩但内容损坏”变成表面有效的新档。
- `usePokeFactoryGame.ts` 仅用 `readUnsupportedSave()` 的旧版原文阻止自动保存。当前 v10 损坏 READY 不会被该函数标记，`loadSaveData()` 可能得到清空后的对象，随后依赖变化、页面隐藏或退出的保存逻辑将它写回原键，丢失唯一可供诊断和备份的原文。`persistSaveData()` 对读取旧文本失败也选择用新草稿覆盖。
- `readUnsupportedSave()` 将不可解析 JSON 与真正旧版本放在一起，`GameView.tsx` 均显示“旧规则存档不兼容”，原因不准确。导入入口 `parseSaveDataFromText()` 同样经过宽松规范化，损坏 v10 的 READY 可被导入为 EMPTY。

## 判定边界

1. **旧版不兼容**：JSON 可解析且 `schemaVersion !== 10`。沿用“旧规则存档不兼容”的备份/清除路径，不迁移逐场代币；与损坏 v10 分开显示。
2. **当前版损坏**：JSON 不可解析；或可解析且 `schemaVersion === 10`，原始 `factory.battleResume.status === 'READY'` 却无法严格恢复为 READY；或 `challengePaused === true` 但不存在满足 `hasRecoverableFactoryBaseCheckpoint` 的有效 BASE 检查点。原始 `READY` 即便只剩部分可解析队伍，也要检查必要结构和局内一致性，不把被 `sanitizeGamePokemonArray` 丢弃的关键成员默默当成合法缩队。优先拒绝这份续玩快照并保护原文，不自动修复战斗。
3. **合法空状态**：当前版明确 `battleResume.status === 'EMPTY'` 且没有声称存在可恢复的暂停挑战时，可以按现有默认值规范化非关键字段。不能仅凭 `challengeStatus` 或钱包存在 `currentRunId` 就认定损坏，因为选租借队或加载过渡可能还未形成 READY 战斗快照；此边界以当前状态机的合法保存节点为准。
4. **其他当前版异常**：在通用 `normalizeSaveDataSafely` 的兜底分支中，只要清除恢复快照才可继续，就按“损坏当前版”返回诊断结果；不要用成功返回掩盖一次数据丢失。UI 无需向玩家暴露底层字段名，但内部测试和诊断可标记原因类别。

## 最小实施顺序

1. 在 `saveManager.ts` 增加一次只读的原始存档分类入口，返回合法当前版、旧版、损坏当前版或不可解析 JSON，以及原始文本。分类须先于 `loadSaveData` 的宽松规范化；`parseSaveDataFromText` 导入也复用同一严格校验。`sanitizeBattleResume` 可以继续为明确 EMPTY 的合法数据设默认值，但原始 READY 降级为 EMPTY 必须抛出可区分错误。
2. `usePokeFactoryGame.ts` 初始化时把任一异常存档状态作为自动保存门禁，覆盖 render 后 effect、`visibilitychange` 和 `beforeunload`；`persistSaveData()` 本身也拒绝覆盖已存在但未通过当前版校验的原文，防止遗漏的调用路径破坏备份。读取失败期间不创建新局、不执行钱包结算或导入替换。旧版已有门禁继续有效。
3. `GameView.tsx` 按分类显示对应页面。损坏当前版文案说明“保存的挑战记录无法读取，原始存档尚未修改”；提供下载**未经规范化的原始文本**备份和“清除并重新开始”两项明确操作。JSON 可解析但结构坏可保存 `.json`，不可解析原文用 `.txt` 并设置相应文本 MIME；点击备份不得清除。清除前二次确认，确认后只删除该存档及关联待结算键，再重载。旧版仍使用旧版文案；正常 v10 不显示任何阻断页。
4. 同版本导入遇损坏 READY 或不可解析文本时拒绝替换，并在设置页反馈“导入文件损坏”；现有本机存档保持原样。若导入旧版本，继续用旧规则不兼容提示。所有下载均直接取原始文本，不能导出规范化后的 EMPTY 副本冒充备份。

涉及：`src/services/saveManager.ts`、`src/features/game/hooks/usePokeFactoryGame.ts`、`src/features/game/components/GameView.tsx`、设置页导入反馈与 `saveManager.test.ts`。只新增损坏检测与保护，不改战斗状态机、BP 数值或旧版迁移规则。

## 验收

- 静态测试以真实 v10 READY/BASE、READY/BATTLE、READY/ROUND_RESULT、READY/FACTORY_SWAP 和合法 EMPTY 为正样本；分别破坏阶段、队伍、训练家/关键阶段字段、暂停标志及 JSON 语法。损坏时分类正确，原始 `localStorage` 字符串在初始化、多个渲染、页面隐藏、退出事件、刷新和 `persistSaveData` 直接调用后完全一致；钱包余额及待结算键不被伪造或清空。旧 v8/v9 仍按旧版分类。导入坏文件不替换好档。运行类型检查、定向测试、构建。
- 浏览器在独立源写入一份可复现的合法 v10 可续挑战快照后备份其原文，再分别注入“READY 队伍缺失”“READY 阶段非法”“暂停标志与快照冲突”和截断 JSON。进入页面应显示准确损坏提示，等待自动保存、切后台、刷新后逐字符比对 localStorage 原文仍在；下载备份解码后的文本与原文一致，取消清除仍保留，确认清除后才能进入新档。另用旧 v8 档检查旧版文案与备份不回归。`390×844` 与 `844×390` 检查按钮可读可点；实体手机再复核下载与触控。
