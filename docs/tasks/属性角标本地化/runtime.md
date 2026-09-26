# 属性角标手机浏览器验收

2026-09-26 在 v12 主分支提交 `ef55156` 的本地开发服务，用 Chrome 手机模拟与独立 `127.0.0.148` 英文、`.149` 中文新档运行。均通过正常 UI 选择初遇伙伴、进入设置、六选三并进入可操作首战；英文通过设置页按钮切换 `English`。未使用 DEV Win，未访问用户 `127.0.0.1` 存档。[浏览器状态、控制台和 API 记录](evidence/results.json)。

英文 390×844 可操作战场中，敌方 HP 卡为 `Dragon`、玩家为 `Water`；四招角标依次为 `Normal`、`Flying`、`Bug`、`Normal`，均可见且是英文。[竖屏截图](evidence/en-390x844.png)。844×390 的敌我 HP 卡角标仍可见且英文，但四招角标虽然在 DOM 中仍为英文，却被横屏布局隐藏，截图不可见；这项可见性要求尚未通过。[横屏截图](evidence/en-844x390.png)。中文新档 390×844 的敌我 HP 卡及四招角标仍为中文。[中文截图](evidence/zh-hans-390x844.png)。无页面异常、HTTP 400 及以上响应或热更新。

修复前基线：提交 `ab8e961` 上，训练家对白后点击继续会出现 `TypeError: options?.commitBattleStart is not a function` 并退回六选三；`ef55156` 已修复，以上新档验证了继续进入首战。[修复前英文返回截图](evidence/en-before-fix-failure.png)、[修复前控制台](evidence/results-before-fix.json)。

2026-09-26 v13 提交 `706444c` 的全新隔离 `.152` 英文档与 `.153` 中文档再次从正常 UI 进入首战。英文 390×844 和 844×390 的敌我 HP 卡均显示 `Poison`，四招均清晰显示 `Poison`、`Ghost`、`Steel`、`Ground`；横屏隐藏问题已修复。[英文竖屏](evidence/v13/en-390x844.png)、[英文横屏](evidence/v13/en-844x390.png)。中文档在 390×844 的敌我 HP 卡与四招继续显示中文。[中文截图](evidence/v13/zh-hans-390x844.png)。[v13 页面状态](evidence/v13/results.json)记录两档均无页面异常、HTTP 400 及以上或热更新。此轮只确认首战角标，没有实际出招。
