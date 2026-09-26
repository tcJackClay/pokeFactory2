# TM10 与 TM43 自降特攻修复计划

固定 Rogue expansion 源提交 `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014` 的 `src/data/battle_moves.h` 把 `MOVE_LEAF_STORM` 和 `MOVE_DRACO_METEOR` 均设为 `EFFECT_OVERHEAT`；`data/battle_scripts_1.s` 的 `BattleScript_EffectOverheat` 指定 `MOVE_EFFECT_SP_ATK_TWO_DOWN | MOVE_EFFECT_AFFECTS_USER | MOVE_EFFECT_CERTAIN`。本项目 `buildMoveBattleDataFromPokeApiMove` 依据 selected target 将这两招的 PokeAPI `stat_changes` 误指向目标，而 `overheat` 已有正确 override。

只给 `leaf-storm`、`draco-meteor` 加与 `overheat` 等价的自降两级副作用 override，不改招式威力、准确率、PP 或通用 PokeAPI 转换。保留 `requiresHit: true`，守住和未命中由现有伤害结算阻断；替身命中时依照现有自降规则执行。用真实 PokeAPI 形状的 payload 断言转换结果，并串联现有 `calculateDamage` 与 `applyMoveSecondaryEffects` 断言双方能力等级和 HP：命中自降、未命中与守住不自降，玩家与敌方均覆盖。跑类型检查、聚焦测试、全套测试和构建；不启用 TM 奖励，不运行游戏。
