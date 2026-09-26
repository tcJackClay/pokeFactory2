# 英文新档首战运行记录

2026-09-26，当前工作树提交 `15e5397`。Chrome 手机模拟器以独立 `127.0.0.136:4300` 来源建立 v11 新档，在设置页正常点击 English，再返回基地开启第 1 代挑战，完成六选三和首战第一回合。未用 DEV Win，未改游戏实现，未访问用户 `127.0.0.1` 存档。[步骤与页面文字原始记录](evidence/english-fresh-results.json)。

| 步骤 | 实际结果 |
| --- | --- |
| 设置页切换 | 存档 `settings.currentLanguage=en`，设置标题变为 `Settings`；进入租借页仍为 `en`。[设置截图](evidence/english-fresh-settings.png) |
| 首战入场 | 页面显示 `Opponent sent out Clefairy!`，菜单与招式名为英文；HP 卡属性角标仍是中文“妖精”“地面”“岩石”，招式卡属性也是中文。[战斗截图](evidence/english-fresh-battle-ready.png) |
| 实际出招一回合 | 使用 `Hidden Power`，PP 从 15/15 变为 14/15，对手 HP 从 100% 到 95%。新生成的回合末日志为 `Rhyhorn restored HP with Leftovers!`、`Clefairy restored HP with Leftovers!`，均为英文；属性角标仍显示中文。[390×844](evidence/english-fresh-after-move.png)、[844×390](evidence/english-fresh-after-move-landscape.png) |

结论：从 UI 正常切换英文后，新生成的已捕获战斗日志是英文；此前战后切换语言样本中的中文旧日志不能作为“新英文日志仍中文”的证据。战场与招式属性角标仍是中文，是真实英文新档可重复观察到的本地化缺口。本轮仅一场一回合，未逐条覆盖所有战斗日志模板。浏览器无页面异常、HTTP 400 及以上响应或 Vite 热更新。
