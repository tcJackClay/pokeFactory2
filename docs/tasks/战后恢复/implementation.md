# 战后恢复实施记录

核对本地 `reference/pokeemerald-expansion` 的 `BattleFactoryBattleRoom/scripts.inc`：普通战及首领战调用 `HealPlayerParty` 后开战；`BattleFactoryPreBattleRoom/scripts.inc` 也在战前执行恢复。本项目按用户要求增加结算后立即恢复，同时保留下一战前的重复恢复。原型脚本说明恢复时点，本项目的结算页即时恢复是明确的产品要求。

新增 `restoreFactoryParty`，逐只恢复 HP 和 PP、清除异常与挥发状态、能力阶级、招式锁定、连续出招和蓄力等临时战斗字段。特殊形态结束时按原始培养数据重算基础能力与 HP，并还原原属性。物种、招式、持有物和培养数据保持不变。

工厂胜负结算成功后、进入结果页前恢复队伍；结算失败时不提前进入结果页。`useFactoryFlow.healAllPokemon` 改用同一恢复函数，覆盖旧快照继续下一战和奖励后进入下一战。换怪生成的新队伍同样先完整恢复，再按现有成功条件提交，避免新队伍覆盖已恢复的旧队伍。战场天气、场地和双方增益仍由既有 `resetBattlePreview` 与 `spawnEnemy` 在新战前清空。

验证：`npm run lint`、`npm test`（145 项）、`npm run build`、`git diff --check` 通过。新增纯函数测试覆盖濒死与受伤成员、PP 上限、异常与临时状态、特殊形态回退、重复恢复和无 PP 上限数据。未运行浏览器；结果页与下一战的实际队伍显示、存档刷新恢复及换怪路径仍需实玩验收。
