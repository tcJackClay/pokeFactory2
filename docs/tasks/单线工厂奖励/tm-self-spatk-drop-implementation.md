# TM10 与 TM43 自降特攻实施记录

基于主树 `dev` 的 `577877a` 在独立工作树修改。固定 Rogue expansion `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014` 的两招均使用 `EFFECT_OVERHEAT`，脚本指定命中后作用于使用者的特攻下降两级。已给 `leaf-storm` 和 `draco-meteor` 添加专用转换覆盖，保留原有伤害、准确率和守住判定路径。

测试从 PokeAPI 形状的原始资料转换为战斗数据，再串联真实伤害与副作用结算。两招及既有 Overheat 在玩家和敌方使用时，命中使使用者特攻下降两级、目标不降且 HP 减少；未命中和被守住均不降；命中替身仍按现有自降规则执行。`npm run lint`、`npm test`（160/160）、`npm run build` 均通过。未启用 TM 奖励，也未运行游戏；仍需独立运行验收。
