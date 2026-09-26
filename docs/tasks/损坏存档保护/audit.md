# 损坏存档保护审查

结论：静态审查通过；未发现未解决的 P1/P2。浏览器备份下载、后台/退出事件、双方向手机布局和实体触控仍需 player 验收。

- 训练家记录在 `usePokeFactoryGame.ts` 中以稳定的初始存档导入一次；导入 effect 排在自动保存前。`useFactoryFlow.ts` 在新局、开发快速局及结束局清空旧记录，StrictMode 重复执行 effect 不会再次导入旧记录。
- `saveManager.ts` 先分类原始文本，再规范化当前版存档。合法 READY 的 BATTLE、ROUND_RESULT、FACTORY_SWAP、BASE 和过渡 EMPTY 均有正样本；无效阶段、队伍成员、训练家、暂停标志及截断 JSON 均有反样本。当前版损坏与旧版不兼容分开显示。
- `usePokeFactoryGame.ts` 对异常存档阻断启动预取、自动保存、页面隐藏及退出保存。`saveManager.ts` 的普通保存、替换导入和钱包写入也拒绝覆盖异常原文；清除操作只在二次确认后移除存档和待结算记录。损坏文件导入不会替换现有好档。
- 审查发现空字符串原文可绕过 `if (raw)` 写入门禁。已改为检查 `raw !== null`，并补空字符串保存及钱包入口回归测试。`GameView.tsx` 的清除确认现会移动焦点到取消按钮，取消后返回原按钮；设置页导入结果增加状态/错误播报。
- `npm run lint`、定向 14 项测试、`npm run build`、`git diff --check` 通过。测试不替代浏览器和真机验收。
