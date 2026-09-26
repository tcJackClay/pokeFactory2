# Rogue expansion 招式机规则核对

核对版本：Pokabbie/pokeemerald-rogue `expansion` 分支提交 `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014`（2026-09-07）。源码保存在隔离目录 `output/rogue-expansion-reference`。以下仅描述该提交的 Rogue 代码和数据，不把 rh-hideout/pokeemerald-expansion 的 README 视为 Rogue 专有规则。

## 运行规则

1. `src/data/party_menu.h` 的 `sTMHMMoves` 在 `ROGUE_EXPANSION` 条件段中固定定义 TM01–TM50，共 50 个招式。TM01 是 `MOVE_RETURN`，TM13 是 `MOVE_THUNDER_WAVE`，TM50 是 `MOVE_MISTY_TERRAIN`。`include/constants/items.h` 将 `NUM_TECHNICAL_MACHINES` 定为 50；`include/constants/rogue.h` 的 expansion 配置移除 HM。`src/party_menu.c` 的 `ItemIdToBattleMoveId` 将道具编号换成招式。
2. `src/pokemon.c` 的 `CanSpeciesLearnTM` 先取 `Rogue_GetPokemonProfile(species)`，若 TM 对应招式存在于该物种的 `tutorMoves` **或** `levelUpMoves`，就返回可学。它不要求该招式在 PokeAPI 原始资料中标为 `machine`。因此本项目现有 `getLearnableMoves` 的全招式随机抽样，以及单纯按 PokeAPI `machine` 过滤，都不等同于 Rogue 规则。
3. `src/rogue_baked.c` 的 `Rogue_GetPokemonProfile` 根据修订模式选择普通或 revised profile。`src/rogue_controller.c` 的修订模式可为 `NEVER`、`IN_RUN` 或 `ALWAYS_ON`。抽取表必须固定并记录选用哪种模式。首版建议以普通 profile 为单一基准，若改用 revised，需先完成下述逐字段合并。
4. Rogue 的 TR 是另一套机制：`src/rogue_controller.c` 的 `RandomiseTRMoves` 从非 TM 招式随机选本局动态 TR。首版四选一若名为 TM，不应把动态 TR 混入固定 50 TM 池。

## 数据来源与生成

Rogue 已提交的物种数据位于 `src/data/rogue/pokemon/expansion/<species>/expansion_profile.json`。每份基础数据包含 `Species[]` 别名、`TutorMoves[]` 和 `LevelUpMoves[].Move`。同目录可有 `expansion_profile_revised.json`。`src/data/rogue/custom_json_rules.mk` 调用 `tools/Pokabbie/Build/CustomJson/PokemonProfileExporter.cpp`，从 JSON 生成 C profile；生成的头文件不在这份浅克隆的跟踪文件中。

`PokemonProfileExporter.cpp` 的 `ParseProfile` 会先复制普通 profile，再根据 revised JSON 的 `BuildSettings`，分别对等级招式、教学招式和竞技配招执行 `REPLACE` 或追加；缺席字段沿用普通 profile。例如皮卡丘的 revised JSON 仅替换等级招式，教学招式继续继承普通 profile。不能把 revised JSON 当完整物种资料，也不能把普通与 revised 无条件合并。

`tools/Pokabbie/PokemonDataGenerator/PokemonDataGenerator/Pokedex/PokemonProfileGenerator.cs` 说明这些 JSON 的上游生成过程：读取 PokeAPI 的 `version_group_details`；expansion 偏好顺序为 Rogue、Scarlet/Violet、Sword/Shield、Ultra Sun/Ultra Moon；非等级学习来源折入 `TutorMoves`，还会补入竞技配招、禁招和部分招式修正规则。移植应以该提交已冻结的 Rogue JSON 为准，不在运行时用当前 PokeAPI 重新生成兼容性。

对基础 profile 的只读统计：1156 份 JSON、1519 个无重复的物种或形态别名；与固定 50 TM 相交得到 14645 个可学 `(别名, TM)` 配对；16 份 profile 与这 50 项没有交集。另有 728 份 revised JSON。基础 JSON 总计 7,366,486 字节，revised JSON 总计 1,613,640 字节。这些是上游规模，不代表本项目九代物种、形态和战斗招式已全部映射。

## 本项目抽取口径

1. 固定源提交 SHA 和 profile 模式，解析 `ROGUE_EXPANSION` 条件段的 TM01–TM50，形成 `TM 编号 → MOVE_*` 表；核对编号连续、数量为 50、无空招式或重复招式。
2. 基础模式下，按每份 JSON 的全部 `Species[]` 建索引，取 `TutorMoves[] ∪ LevelUpMoves[].Move` 与固定 50 TM 相交。若采用 revised 模式，先严格执行 `ParseProfile` 的继承及逐字段 `BuildSettings` 规则，再求交集。
3. 将 Rogue 的 `SPECIES_*` 和 `MOVE_*` 显式映射为本项目的物种、形态及招式 ID。输出未映射物种、未映射招式和战斗效果未实现招式的清单；这些候选不得发卡，也不得用 PokeAPI 历代 `machine` 并集自动放宽。九代单选仍只决定租借物种池，TM 兼容性统一取这份固定 Rogue expansion 表。
4. 对抽取结果保存源 SHA、模式、生成器版本和摘要。静态校验 50 项 TM、1519 个唯一别名和普通模式 14645 个原始配对；在映射后再记录实际可用数量。奖励页只从当前队伍至少一名成员可学、尚未掌握、且本项目战斗效果已验证的 TM 中抽取，并把四卡及可选对象冻结在奖励检查点。领取时再次用固定表校验。

本项目 `src/services/pokeApi.ts` 的 `getLearnableMoves` 只排除已学招式后从所有 `pokemon.moves` 随机取样，不能直接用于此规则。商品价格、奖励权重及补给券兑换规则不在 Rogue TM 数据中，仍须按本项目设计定稿。

## 来源与权利边界

该分支根目录未发现适用于整个仓库的 `LICENSE` 或 `COPYING`；只有若干工具子目录有各自许可证。README 当前内容是 pokeemerald-expansion 的说明与致谢建议，不能据此认定 Pokabbie/Rogue 数据或宝可梦知识产权已获公开网页使用授权。此处的源码和抽取统计仅供规则研究；将兼容表或相关素材随公开版发行前仍需单独核对权利。

固定源码入口：[TM 列表](https://github.com/Pokabbie/pokeemerald-rogue/blob/a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014/src/data/party_menu.h)、[TM 可学判断](https://github.com/Pokabbie/pokeemerald-rogue/blob/a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014/src/pokemon.c)、[物种 JSON](https://github.com/Pokabbie/pokeemerald-rogue/tree/a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014/src/data/rogue/pokemon/expansion)、[JSON 编译器](https://github.com/Pokabbie/pokeemerald-rogue/blob/a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014/tools/Pokabbie/Build/CustomJson/PokemonProfileExporter.cpp)。
