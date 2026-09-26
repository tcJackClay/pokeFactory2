# 暂停挑战跨页恢复实施计划

## 现状

- `usePokeFactoryGame.ts` 在每组第七胜的 `ROUND_RESULT` 后设置 `hasFactoryRunToResume=true`、`gameState='BASE'`；基地按钮 `startOrResumeFactoryFromBase` 会走 `nextFactoryStage`。`factoryResumeCheckpoint.ts` 也把第七胜的 BASE 快照视为可恢复，并在下一组第一战稳定快照出现后才释放旧检查点。这是连续挑战的预期路径。
- `getPersistableBattleResume` 仅在 `BATTLE`、`ROUND_RESULT`、`FACTORY_SWAP` 或 `BASE && hasFactoryRunToResume` 保留检查点；`SETTINGS`、`CREDITS`、`COLLECTION`、`EVENTS` 等页返回空快照。另一段 effect 离开上述状态时会清空 `battleResumeSnapshotRef`。因此第七胜从 BASE 进入设置，再进入版权说明或返回时，自动保存可能把可续挑战的队伍与阶段清掉；内存里的继续按钮仍可能显示，刷新后无可靠恢复。
- `GameView.tsx` 中基地的图鉴、事件实际通过 `currentBaseTab` 在 `gameState='BASE'` 渲染；设置及其版权页使用独立状态。图鉴浏览是只读；事件页 `dispatchEventRegion` 可启动/结算派遣，`resolveDispatchRegion` 可改 `playerTeam`、`inventory`，遭遇战会写 `enemyTeam` 并切到 `BATTLE`。`handleSuppressedBattleResolved` 虽阻止工厂战结算，仍会清战斗相关状态，可能覆盖工厂检查点。事件页还有 DEV mock 入口。
- 现有“逃跑/弃权” `forfeitChallenge` 仅允许 `gameState='BATTLE'`，不能在第七胜 BASE 直接结束连胜。第七胜的已发 BP 属前一组；下一组未开始时不应另生结算。若之后在本组失败或主动退出，本组 0 BP，之前已结算 BP 保留。

## 最小安全语义

1. “可继续挑战”是独立于当前浏览页的状态。只读打开设置、版权、图鉴、事件概览，再返回基地，均须保留同一个工厂快照、`runId`、阶段、队伍、钱包与已结算标识。`getPersistableBattleResume` 和清 ref 的 effect 应以 `hasFactoryRunToResume` 及有效检查点为准，而不是只认 BASE 页；保存中的 `challengePaused` 与快照必须一致。刷新后回到基地继续，不能自动跳新局或重复结算第七胜。
2. 可续挑战期间，事件页可以查看地区、派遣进度和历史结果；对能改变队伍、背包或进入战斗的动作统一禁用，并在页面给出“先继续或结束当前挑战”的说明。至少包含派遣启动、到期领取/结算、派遣宝可梦选择变更、推荐/清除和 DEV mock。已有计时派遣仍可随时间变为 READY，但领取延后至挑战结束。前端 disabled 与 hook 入口的运行状态校验都要有，防止异步请求或旧点击绕过。
3. 在有可续挑战的 BASE 增加明确的“结束当前连胜”操作，二次确认后清除工厂恢复快照、`hasFactoryRunToResume`、当前 `runId` 和待预取敌人，再开放事件操作。第七胜返回基地尚未开始下一组时，结束只放弃继续资格，不撤销上一组已入账 BP，也不生成下一组 0 BP 的假结算。若将来允许组中途从基地退出，则按已定规则对该组记 0 BP，并保持此前 BP。战斗中的现有弃权继续走败退结算，不复用事件战斗路径。
4. 继续挑战开始下一组时，只有在新一组第一战形成稳定快照后才释放 BASE 检查点；加载失败仍保留继续按钮和可恢复数据，重试不重复给 BP。跨页浏览不应隐式改变玩家的租借三只、敌方预览、背包或战斗日志。

涉及文件：`src/features/game/hooks/usePokeFactoryGame.ts`、`factoryResumeCheckpoint.ts`、`src/features/game/components/game-view/StartScreen.tsx`、`EventsScreen.tsx`、`SettingsScreen.tsx`、`CreditsScreen.tsx`、`src/services/saveManager.ts` 与对应测试。优先修改检查点保存语义与事件入口保护，再补 UI 禁用和主动结束按钮。

## 静态验收

- 用第七胜 BASE 检查点验证 BASE→SETTINGS→CREDITS→SETTINGS→BASE、BASE→COLLECTION→BASE、BASE→EVENTS→BASE 的每次保存均为 `challengePaused=true` 且 `battleResume.status='READY'`，阶段与队伍相同；刷新后继续进入下一组，不重复上一组 BP。测试异步保存顺序，旧页 effect 不得覆盖新快照。
- 事件所有写入口在可续挑战时均不能更改队伍、背包、派遣状态或切入事件战；到期状态可显示 READY，结束连胜后可正常领取。DEV mock 同样受门禁。主动结束后检查旧检查点不可恢复、上一组钱包余额不变、下一组未开始时无结算记录；再开新局可正常生成六选三。
- 覆盖继续下一组加载失败、重试、成功建立新快照；验证此前 BP 保留、本组败退 0 BP 及幂等结算。运行定向测试、类型检查和构建。

## 手机运行验收

- 在隔离存档中以正常操作完成真实七战，记录第七胜后的 BP 与 BASE 快照。用 `390×844` 竖屏和 `844×390` 横屏依次打开设置、版权、图鉴、事件概览，每页返回后刷新，再点继续挑战；检查按钮可见、可触、队伍和阶段正确，BP 不重复增加。
- 在可续挑战时尝试事件派遣、到期领取及开发 mock，确认有清楚的不可操作提示且不覆盖工厂队伍；点击“结束当前连胜”先取消再确认，检查钱包、事件解锁和新挑战。另测继续下一组后在本组败退，确认本组 0 BP 且上一组 BP 保留。记录截图、存档字段和浏览器错误；模拟手机视口通过后再在实体手机浏览器复核触控与刷新。
