# Rogue TM 项目战斗效果静态审查

固定 TM 50；本地缓存 48；缓存缺失 2；本地数据转换成功 48。名称转换仅为候选，所有项目 ID 和效果仍需逐项验证。

审查基于 Rogue 固定提交 `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014`、本项目 `4058406b68d3bcf659fd413b345e7ac10659aefa`，以及当时只读的本地 PokeAPI 缓存 `var/pokeapi/runtime/v2`。项目招式 ID 候选来自 `MOVE_*` 名称转换，对应游戏 `Move.name` 形式；源与项目语义没有显式映射，因此表内没有任何“已验证 ID”。本地转换结果由 `buildMoveBattleDataFromPokeApiMove` 对逐个缓存 payload 实际运行得到；“可转换”不代表线上请求、战斗效果或 Rogue 行为已验收。

复现命令（从本项目根目录运行，输入路径可更换）：

```powershell
node --import tsx scripts/audit_rogue_tm_effects.mts --source 'D:/Games/pokeFactory2/output/rogue-expansion-reference' --cache 'D:/Games/pokeFactory2/var/pokeapi/runtime/v2' --output 'output/rogue-tm-effect-audit'
node --import tsx --test scripts/audit_rogue_tm_effects.test.mts
```

`output/rogue-tm-effect-audit/tm-effect-audit.json` 保留 50 招逐项效果字段、缓存数据摘要与缺口，完整输出被 Git 忽略。本表是该输出的审查快照。

重点缺口：TM17 `freeze-dry` 在本地缓存缺失；项目有 `FREEZE_DRY` 覆盖项和对水属性特殊倍率逻辑及单测，但当前缓存没有提供能由实际加载链转换的数据。TM33 `quiver-dance` 同样缺缓存；构造的三项能力提升数据能被通用二级效果转换，真实资料与完整实战尚未验证。TM11、15、24、28、32、35、44 涉及蓄力、打完换人、场地陷阱、队伍顺风或连发锁定等未见对应状态和结算路径；TM18 `snowscape` 被映射为旧 `hail`，世代规则需单独核对。静态扫描未指出缺口的招式也仍需逐招验收。

| TM | Rogue 符号 | 项目招式 ID 候选 | 本地缓存/转换 | 项目结算路径 | 明显缺口 |
| --- | --- | --- | --- | --- | --- |
| TM01 | MOVE_RETURN | return | present/buildMoveBattleDataFromPokeApiMove-ok | dedicated-effect-or-field-override (FRIENDSHIP_POWER) | No obvious gap in static scan; runtime not verified |
| TM02 | MOVE_DOUBLE_TEAM | double-team | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM03 | MOVE_FACADE | facade | present/buildMoveBattleDataFromPokeApiMove-ok | dedicated-effect-or-field-override (FACADE) | No obvious gap in static scan; runtime not verified |
| TM04 | MOVE_OVERHEAT | overheat | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM05 | MOVE_FLARE_BLITZ | flare-blitz | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM06 | MOVE_SUNNY_DAY | sunny-day | present/buildMoveBattleDataFromPokeApiMove-ok | dedicated-effect-or-field-override (weather:sunny) | No obvious gap in static scan; runtime not verified |
| TM07 | MOVE_SURF | surf | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM08 | MOVE_AQUA_JET | aqua-jet | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM09 | MOVE_RAIN_DANCE | rain-dance | present/buildMoveBattleDataFromPokeApiMove-ok | dedicated-effect-or-field-override (weather:rainy) | No obvious gap in static scan; runtime not verified |
| TM10 | MOVE_LEAF_STORM | leaf-storm | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM11 | MOVE_SOLAR_BLADE | solar-blade | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | Two-turn charging is not represented by the current move battle data or battle turn flow. |
| TM12 | MOVE_GRASSY_TERRAIN | grassy-terrain | present/buildMoveBattleDataFromPokeApiMove-ok | dedicated-effect-or-field-override (field:grassy_terrain) | No obvious gap in static scan; runtime not verified |
| TM13 | MOVE_THUNDER_WAVE | thunder-wave | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM14 | MOVE_THUNDER | thunder | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM15 | MOVE_VOLT_SWITCH | volt-switch | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | Post-damage pivot switching is not represented by the current battle turn flow. |
| TM16 | MOVE_ICE_BEAM | ice-beam | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM17 | MOVE_FREEZE_DRY | freeze-dry | missing/not-tested | dedicated-override-unloaded (FREEZE_DRY) | Local move payload is absent; FREEZE_DRY override cannot be exercised through the current local cache. |
| TM18 | MOVE_SNOWSCAPE | snowscape | present/buildMoveBattleDataFromPokeApiMove-ok | dedicated-effect-or-field-override (weather:hail) | Current override maps snow to hail; snow defense boost and hail distinction require rule review. |
| TM19 | MOVE_BRICK_BREAK | brick-break | present/buildMoveBattleDataFromPokeApiMove-ok | dedicated-effect-or-field-override (BREAK_SCREENS) | No obvious gap in static scan; runtime not verified |
| TM20 | MOVE_BULK_UP | bulk-up | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM21 | MOVE_AURA_SPHERE | aura-sphere | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM22 | MOVE_SLUDGE_BOMB | sludge-bomb | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM23 | MOVE_CROSS_POISON | cross-poison | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM24 | MOVE_TOXIC_SPIKES | toxic-spikes | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | Entry hazard placement and switch-in poison are not represented in the current battle state. |
| TM25 | MOVE_EARTHQUAKE | earthquake | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM26 | MOVE_EARTH_POWER | earth-power | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM27 | MOVE_AERIAL_ACE | aerial-ace | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM28 | MOVE_TAILWIND | tailwind | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | Side-wide timed speed boost is not represented in the current field or team state. |
| TM29 | MOVE_PSYCHIC | psychic | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM30 | MOVE_CALM_MIND | calm-mind | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM31 | MOVE_TRICK_ROOM | trick-room | present/buildMoveBattleDataFromPokeApiMove-ok | dedicated-effect-or-field-override (field:trick_room) | No obvious gap in static scan; runtime not verified |
| TM32 | MOVE_U_TURN | u-turn | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | Post-damage pivot switching is not represented by the current battle turn flow. |
| TM33 | MOVE_QUIVER_DANCE | quiver-dance | missing/not-tested | generic-unloaded | Local move payload is absent; three self stat boosts cannot be checked through the current local cache. |
| TM34 | MOVE_STONE_EDGE | stone-edge | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM35 | MOVE_STEALTH_ROCK | stealth-rock | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | Entry hazard placement and switch-in damage are not represented in the current battle state. |
| TM36 | MOVE_SANDSTORM | sandstorm | present/buildMoveBattleDataFromPokeApiMove-ok | dedicated-effect-or-field-override (weather:sandstorm) | No obvious gap in static scan; runtime not verified |
| TM37 | MOVE_SHADOW_BALL | shadow-ball | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM38 | MOVE_SHADOW_SNEAK | shadow-sneak | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM39 | MOVE_CONFUSE_RAY | confuse-ray | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM40 | MOVE_DARK_PULSE | dark-pulse | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM41 | MOVE_NASTY_PLOT | nasty-plot | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM42 | MOVE_DRAGON_DANCE | dragon-dance | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM43 | MOVE_DRACO_METEOR | draco-meteor | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM44 | MOVE_OUTRAGE | outrage | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | Multi-turn forced use and confusion afterward are not represented in the current battle turn flow. |
| TM45 | MOVE_IRON_HEAD | iron-head | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM46 | MOVE_IRON_DEFENSE | iron-defense | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM47 | MOVE_FLASH_CANNON | flash-cannon | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM48 | MOVE_DAZZLING_GLEAM | dazzling-gleam | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM49 | MOVE_PLAY_ROUGH | play-rough | present/buildMoveBattleDataFromPokeApiMove-ok | generic-damage-or-secondary-effects | No obvious gap in static scan; runtime not verified |
| TM50 | MOVE_MISTY_TERRAIN | misty-terrain | present/buildMoveBattleDataFromPokeApiMove-ok | dedicated-effect-or-field-override (field:misty_terrain) | No obvious gap in static scan; runtime not verified |
