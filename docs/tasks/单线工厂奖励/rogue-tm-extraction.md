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
- `project-mapping-gaps.json`：按 Rogue `NATIONAL_DEX_*` 顺序、`species.h` 别名链、普通 profile 符号与 10 条显式形态例外建立工厂基础物种和形态的静态身份映射；同时列出未知/冲突项、招式名称候选和未验证的战斗效果。名称相似不代表招式语义一致，不能据此发卡。

本次复现结果：50 个 TM，1156 份普通 profile，1519 个不重复 Species 别名，14645 个 `(别名, TM)` 配对；重复别名 0，固定 TM 零交集 profile 16 份。TM 表与 profile 输入内容摘要 SHA-256 为 `353a1226dae0a7601cef5a3613572d35d0cf9a780299426a9cadc6a36e21bb9e`；物种映射另锁定 `pokedex.h` 摘要 `60f3d9117944dd7aff4b0dd8354c4ca08a5790a6cf1afc3290d8c380081d36c8` 和 `species.h` 摘要 `f3119662bdedb2c0a5e83383f8bb9156c687aa272757210c7e16003a8754575a`。脚本同时固定提交、输入摘要和计数；源码工作树即使停留在同一提交，只要这些输入文件被改动，生成也会失败。两份研究脚本仅允许把完整结果写入本项目 Git 忽略的 `output/` 目录。

工厂索引现有 1025 条数字标识基础物种和 51 条具名形态。对固定 Rogue 来源的静态身份映射结果为基础 1025/1025、形态 51/51，其中 10 条依赖显式形态例外；未知项 0，冲突项 0。旧版 `41/1519` 只计直接文字命中，漏掉全部数字标识基础物种，已从报告计数字段移除。生成报告保留每行 `speciesId`、`pokemonId`、请求的 Rogue 符号、别名解析结果和 profile 路径，但这些静态证据不证明实际招式效果或奖励可用。50 个 `MOVE_*` 到本项目招式 ID 和逐招战斗效果仍未验收；23 个招式名出现在现有工厂配招，13 个有战斗数据覆盖项，这两项只是审查提示。当前可发布奖励候选数仍为 0。

复现形态与九代边界测试时先设置 `ROGUE_TM_SOURCE` 为固定源码目录，再运行 `node --test scripts/extract_rogue_tm_compat.test.cjs`。测试明确核对全国图鉴第 1 号妙蛙种子、第 1025 号桃歹郎和全部 10 条形态例外。

源仓库根目录未发现覆盖全仓库的许可证，且宝可梦相关名称与形象的公开使用权仍待核对。完整派生矩阵仅保留在隔离输出中；此提交只包含抽取程序、测试和来源记录。
