# 对手预取耗尽回退手机浏览器验收

2026-09-26，主树 `734fff5`，Playwright Chromium 手机模拟视口 `390×844`，隔离来源 `127.0.0.167:4300`。未访问用户 `127.0.0.1` 标签或存档，未修改实现代码。测试脚本 [run-opponent-prefetch-browser.mjs](run-opponent-prefetch-browser.mjs)，逐步页面、存档摘要、网络状态和控制台记录 [results.json](evidence/opponent-prefetch/results.json)。

正常路径：经 UI 新建 v13 存档，初遇伙伴、开始挑战、第 1 代六张租借卡、六选三、训练家对白，进入第 1 战 `BATTLE/READY` 且战斗菜单可操作；没有开发按钮辅助开战。[六张租借卡](evidence/opponent-prefetch/six-rentals.png)、[第 1 战](evidence/opponent-prefetch/stage1-ready.png)。

可控失败：用 DEV Win 结束第 1 战，仅为快速到达下一战预取节点。保存真实 `ROUND_RESULT` 后以新浏览器上下文载入同一隔离存档，并在浏览器网络层对 `/api/pokeapi/**` 返回测试用 HTTP 404；这是网络故障注入，不是自然服务故障。本样本拦截 172 个请求。控制台明确出现第 2 战 `prefetchEnemy` 耗尽告警，正式继续时也报第 2 战敌队不足。结果页进入换怪页后点击“跳过交换”，页面给出“对手队伍暂时无法生成。当前进度已保留，请再次点击继续。”提示。[失败提示](evidence/opponent-prefetch/failure-alert.png)。

失败前后存档均为同一 `runId`、`stage=1`、`phase=FACTORY_SWAP`、钱包 0 BP、本局补给券 1；没有错误地进入第 2 战或重复结算。刷新后仍可回到换怪页，存档字段不变。[失败后刷新](evidence/opponent-prefetch/failure-reload.png)。失败提示属于当前页面状态，刷新后不再显示，但“跳过交换”仍可操作。解除网络拦截后再次点击“跳过交换”，完成训练家对白并进入第 2 战 `BATTLE/READY`；同一 `runId`、补给券仍为 1。[重试成功](evidence/opponent-prefetch/stage2-ready-after-retry.png)。

结论：正常首次开战、预取耗尽时的玩家提示、失败不推进 stage、刷新保留检查点和恢复网络后的重试均通过本次模拟浏览器检查。第 1 战胜利由 DEV Win 辅助，不证明完整对战胜利路径；172 个 HTTP 404 均由浏览器故障注入，测试未观察真实代理故障。未覆盖基地继续节点、交换一只宝可梦节点或实体手机。
