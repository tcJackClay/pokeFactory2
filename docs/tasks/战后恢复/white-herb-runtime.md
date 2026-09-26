# 白色香草战间返还手机浏览器验收

2026-09-26，主树提交 `20d70ec`，独立 Playwright Chromium 手机模拟视口 `390×844`，隔离来源 `127.0.0.163:4300`。没有访问用户 `127.0.0.1` 标签或存档，没有修改游戏实现。测试源脚本为 [run-white-herb-browser.mjs](run-white-herb-browser.mjs)，逐步存档摘要与页面文字在 [results.json](evidence/white-herb/results.json)。

从正常 UI 新建 v13 存档，选初遇伙伴、开始第 1 代挑战、六选三并进入第一战 `READY`。随后在**隔离测试存档**中将前排卡拉卡拉的当前及原配持有物改为 `white_herb`，把第一招换为带有真实战斗数据字段的 `overheat` 测试招式，并将敌方前排置为睡眠。当前随机租借队伍及六候选中没有自降能力招式，因此招式数据由测试脚本构造；这不是自然抽取的招式搭配。新建浏览器上下文载入存档，页面正常恢复第一战，显示“过热”与白色香草原配。[测试存档恢复画面](evidence/white-herb/fixture-ready.png)。

实际点击“战斗→过热”，不是 DEV 出招。敌方 HP 降至 59%，招式 PP 从 5 降至 4，战斗日志先显示“卡拉卡拉的特攻降低了！”，随后显示“卡拉卡拉使用白色香草恢复了降低的能力！”。[真实出招日志](evidence/white-herb/after-real-move.png)。这证明战斗引擎执行了白色香草触发路径。

**发现阻断：**等待消息结束后使用 DEV Win 快速结算（仅胜利和续战辅助），`ROUND_RESULT`、结果页刷新、`FACTORY_SWAP`、换怪页刷新均保存当前持有物 `white_herb`；第 2 战 `READY` 也为 `white_herb`。原配字段始终为 `white_herb`。因此“消耗后结果/换怪页保持为空”未通过，不能据第 2 战有道具判定返还成功。[结果页](evidence/white-herb/result-dev-win.png)、[换怪页刷新](evidence/white-herb/swap-reload.png)、[第 2 战](evidence/white-herb/stage2-ready.png)。本次第二轮样本无页面错误或 HTTP 400 及以上响应。

证据边界：战斗中的 `localStorage` 是开战检查点，真实出招后仍保存 `white_herb` 本身不能判定战中道具未消耗；失败依据是结算与换怪阶段新写入的检查点依旧如此。脚本没有读取 React 内存状态或道具详情面板。首轮尝试因 DEV Win 点选时消息仍处理而超时，已在同一隔离来源重新新建存档复测；上述结论只取第二轮完整样本。未在实体手机或 Codex 侧栏浏览器测试。

## 修复后回归

主工作区提交 `c7fc83b` 修复施招者状态覆盖后，以全新隔离来源 `127.0.0.165:4300` 重跑同一脚本，仍从正常 UI 新档进入第一战，测试存档注入白色香草与过热。实际 UI 出招的日志再次显示白色香草恢复能力。[出招截图](evidence/white-herb-fixed/after-real-move.png)。消息完成后的当前持有物为 `null`，原配为 `white_herb`。[完整逐步摘要](evidence/white-herb-fixed/results.json)。

随后 DEV Win 辅助结束第一战：`ROUND_RESULT` 及其刷新、`FACTORY_SWAP` 及其刷新，当前持有物均保持 `null`，原配均为 `white_herb`；[结果页](evidence/white-herb-fixed/result-dev-win.png)、[换怪页](evidence/white-herb-fixed/swap-reload.png)。跳过交换并进入第 2 战 `READY` 后，当前持有物恢复 `white_herb`，过热 PP 也恢复为 5/5。[第二战截图](evidence/white-herb-fixed/stage2-ready.png)。浏览器无页面异常或 HTTP 400 及以上响应。此修复后样本通过“实际道具消耗→战后保持消耗→下一战返还”的模拟浏览器检查；胜利本身由 DEV Win 辅助，招式与道具触发为真实 UI 操作。实体手机仍未验收。
