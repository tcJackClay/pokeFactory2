# Rogue expansion TM 来源抽取

本切片只生成供研究和审核的符号常量兼容矩阵，不接入奖励页。源为 `Pokabbie/pokeemerald-rogue` 的 `expansion` 提交 `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014`。脚本会核对实际 Git HEAD，不接受其他提交。

在项目根目录执行：

```powershell
node scripts/extract_rogue_tm_compat.cjs --source 'D:/Games/pokeFactory2/output/rogue-expansion-reference' --output 'output/rogue-tm-extract'
node --test scripts/extract_rogue_tm_compat.test.cjs
```

`--source` 可以指向其他位置的同一提交。输出目录位于 `.gitignore` 排除的 `output/`，由调用者提供路径；完整矩阵不提交仓库。抽取读取 `src/data/party_menu.h` 中 `sTMHMMoves` 的 `ROGUE_EXPANSION` 分支，且只读取 `src/data/rogue/pokemon/expansion/**/expansion_profile.json`。每个别名的可学 TM 来自该普通 profile 的 `TutorMoves ∪ LevelUpMoves[].Move`。注释占位 TM、其他条件分支、`expansion_profile_revised.json`、动态 TR 和 PokeAPI machine 并集均不参与。

输出文件：

- `compatibility-matrix.json`：来源提交、普通 profile 模式、输入内容摘要、TM01–50 的 `MOVE_*`、各 `SPECIES_*` 别名对应的 TM 编号与 profile 相对路径。
- `source-anomalies.json`：重复别名及没有任何固定 TM 交集的 profile 路径。
- `project-mapping-gaps.json`：本项目名称候选提示和未验证的 ID、战斗效果映射清单。名称相似不代表语义一致，不能据此发卡。

本次复现结果：50 个 TM，1156 份普通 profile，1519 个不重复 Species 别名，14645 个 `(别名, TM)` 配对；重复别名 0，固定 TM 零交集 profile 16 份。输入内容摘要 SHA-256 为 `353a1226dae0a7601cef5a3613572d35d0cf9a780299426a9cadc6a36e21bb9e`。计数不符合上述固定值时生成失败，不会静默扩大兼容范围。

本项目仍缺显式 `SPECIES_* → speciesId/pokemonId/形态` 表、`MOVE_* → 招式 ID` 表，以及逐招战斗效果验收。名称粗匹配仅有 41/1519 个物种别名出现在工厂索引的 `identifier` 中、23/50 个 TM 招式名出现在现有工厂配招中、13/50 个存在战斗数据覆盖项；均未视为已映射或已验证。当前可发布奖励候选数仍为 0，必须先补齐映射和效果验收，再决定可发放范围。

源仓库根目录未发现覆盖全仓库的许可证，且宝可梦相关名称与形象的公开使用权仍待核对。完整派生矩阵仅保留在隔离输出中；此提交只包含抽取程序、测试和来源记录。
