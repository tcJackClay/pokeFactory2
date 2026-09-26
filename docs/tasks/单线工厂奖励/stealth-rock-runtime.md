# 隐形岩入场与连续补位手机浏览器验收

2026-09-26 主树提交 `20d70ec`，独立 Playwright Chromium 手机模拟视口，隔离来源 `127.0.0.166:4300`。未访问用户 `127.0.0.1` 标签或存档，未改游戏实现。测试脚本 [run-stealth-rock-browser.mjs](run-stealth-rock-browser.mjs)，逐步页面文字及存档摘要 [results.json](evidence/stealth-rock/results.json)。

从正常 UI 建立 v13 新档、六选三并进入第一战 READY，再制作独立测试存档：己方场地 `stealthRock=true`，两只后备均设为 1 HP，对手前排睡眠。隐形岩和 HP 为测试存档注入，不是本场自然使用招式；后续换人均通过真实 UI 点击。恢复后的 390×844、320×568 战斗可操作，页面没有横向溢出。[390×844 测试战场](evidence/stealth-rock/fixture-ready-390.png)、[320×568 测试战场](evidence/stealth-rock/fixture-ready-320.png)。

先从大钳蟹换入 1 HP 蛋蛋。画面显示蛋蛋 0/122、隐形岩受伤和倒下文案，系统出现强制换人列表；此时 1 HP 小火马可选，已倒下的蛋蛋不能出战。[第一次濒死 390×844](evidence/stealth-rock/first-hazard-faint-390.png)、[第一次濒死 320×568](evidence/stealth-rock/first-hazard-faint-320.png)。再选小火马，隐形岩再次将其从 1 HP 击倒，显示“小火马受到了隐形岩的伤害！”和“小火马 倒下了！”，系统继续要求补位。[第二次濒死](evidence/stealth-rock/second-hazard-faint-390.png)。最后选大钳蟹，隐形岩入场扣血后余 80/91，并返回正常可操作战斗；两只后备保持 0 HP。[第三次换人](evidence/stealth-rock/third-switch-390.png)。整个过程仍在第一战，无误入结果页、重复结算或浏览器异常；本次没有 DEV Win。

存档在正在进行的回合内主要是开战检查点，`first-hazard-faint` 等摘要可能落后于画面；本项入场扣血与连续补位依据可见 HP、日志和换人按钮，稳定后的队伍摘要再作交叉核对。只覆盖玩家侧隐形岩与两只 1 HP 后备连续倒下；敌方侧撒岩招式的实际施放、属性倍率精确数值和实体手机触控尚未验收。
