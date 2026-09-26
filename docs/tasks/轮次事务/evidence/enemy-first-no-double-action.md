# 敌方先手不出现 ENEMY→PLAYER→ENEMY 二动

- 手段：隔离来源 `127.0.0.61/62:4300` + 隔离 Playwright Chromium 手机模拟视口 + 受控存档注入（基准来自自然新档 `evidence/base-save.json`）；未使用 DEV Win。
- 脚本：`run-round-transaction-enemy-first-browser.mjs`；原始数据：`evidence/enemy-first/results.json`；截图：`evidence/enemy-first/*.png`。
- 断言口径：`battleLog` 增量中「对手的…使用了…」与「…使用了…」的出现顺序与条数。

## enemy-first-timers

fixture: `{"variant":"enemy-first-timers","playerSpeed":1,"enemySpeed":500,"weather":"sandstorm","weatherTurns":5,"tailwindTurns":{"player":4,"enemy":4},"fieldState":[],"fieldTurns":{},"playerStatus":{"id":"poison"}}`

| 回合 | 日志条数 | 行动顺序 | 敌方行动数 | 我方行动数 | 回合末结算行 |
| --- | --- | --- | --- | --- | --- |
| 1 | 7 | ENEMY→PLAYER | 1 | 1 | 地鼠受到了中毒伤害！；地鼠受到了沙暴的伤害！；大钳蟹受到了沙暴的伤害！ |
| 2 | 7 | ENEMY→PLAYER | 1 | 1 | 地鼠受到了中毒伤害！；地鼠受到了沙暴的伤害！；大钳蟹受到了沙暴的伤害！ |
| 3 | 7 | ENEMY→PLAYER | 1 | 1 | 地鼠受到了中毒伤害！；地鼠受到了沙暴的伤害！；大钳蟹受到了沙暴的伤害！ |

逐回合完整日志：
- R1: `对手的 大钳蟹 使用了 抓！` / `对手的 大钳蟹 造成了 16 点伤害。` / `地鼠 使用了 撞击！` / `地鼠 造成了 8 点伤害。` / `地鼠受到了中毒伤害！` / `地鼠受到了沙暴的伤害！` / `大钳蟹受到了沙暴的伤害！`
- R2: `对手的 大钳蟹 使用了 头锤！` / `对手的 大钳蟹 造成了 15 点伤害。` / `地鼠 使用了 撞击！` / `地鼠 造成了 8 点伤害。` / `地鼠受到了中毒伤害！` / `地鼠受到了沙暴的伤害！` / `大钳蟹受到了沙暴的伤害！`
- R3: `对手的 大钳蟹 使用了 抓！` / `对手的 大钳蟹 造成了 14 点伤害。` / `地鼠 使用了 撞击！` / `地鼠 造成了 8 点伤害。` / `地鼠受到了中毒伤害！` / `地鼠受到了沙暴的伤害！` / `大钳蟹受到了沙暴的伤害！`

## trickroom-enemy-first

fixture: `{"variant":"trickroom-enemy-first","playerSpeed":500,"enemySpeed":1,"weather":"none","weatherTurns":0,"tailwindTurns":{"player":0,"enemy":0},"fieldState":["trick_room"],"fieldTurns":{"trick_room":5},"playerStatus":{"id":"burn"}}`

| 回合 | 日志条数 | 行动顺序 | 敌方行动数 | 我方行动数 | 回合末结算行 |
| --- | --- | --- | --- | --- | --- |
| 1 | 5 | ENEMY→PLAYER | 1 | 1 | 地鼠受到了灼伤伤害！ |
| 2 | 5 | ENEMY→PLAYER | 1 | 1 | 地鼠受到了灼伤伤害！ |
| 3 | 5 | ENEMY→PLAYER | 1 | 1 | 地鼠受到了灼伤伤害！ |

逐回合完整日志：
- R1: `对手的 大钳蟹 使用了 撞击！` / `对手的 大钳蟹 造成了 15 点伤害。` / `地鼠 使用了 撞击！` / `地鼠 造成了 4 点伤害。` / `地鼠受到了灼伤伤害！`
- R2: `对手的 大钳蟹 使用了 抓！` / `对手的 大钳蟹 造成了 13 点伤害。` / `地鼠 使用了 撞击！` / `地鼠 造成了 4 点伤害。` / `地鼠受到了灼伤伤害！`
- R3: `对手的 大钳蟹 使用了 抓！` / `对手的 大钳蟹 造成了 15 点伤害。` / `地鼠 使用了 撞击！` / `地鼠 造成了 4 点伤害。` / `地鼠受到了灼伤伤害！`

结论：三个回合（含戏法空间先手）中每回合均为 `ENEMY→PLAYER`（或 `ENEMY→PLAYER→回合末`），敌方行动数恒为 1，未出现 `ENEMY→PLAYER→ENEMY`。