# 技术方案：固定 TM 运行数据与学习资格

状态：orchestrator 已批准，0 次实质打回，Route A 实施；三个技术决定均获确认。工作树 `codex/fixed-tm-data`，基线 `33557dee7004095c3bfb10daabeccb94982a2235`。

## 1. PRD 一致性与调研结果

- F1 对应规则定稿 TM 行、内容准入 design 的固定来源门槛；F2 对应既有 `tm-mapping-coverage.md` 的身份研究；F3 对应四项准入与未定价不能上架；F4 为本任务运行交付边界。未发现需要新增玩法的缺口。
- 只读复现 `extract()` 与 `mapFactorySpecies()`：固定源摘要 `353a1226dae0a7601cef5a3613572d35d0cf9a780299426a9cadc6a36e21bb9e`；50 TM、1156 普通 profile、1519 别名、14645 原始配对；工厂 1025 基础、51 具名形态均映射，未知/冲突均 0。此为静态数据身份结果，不是效果验收。
- `src/types.ts` 的 `Move` 使用 `name` 作为项目招式标识，没有数字 `id` 字段。`backend/config/rogue-tm-moves.json` 已跟踪 50 个有序 `move/{name}` 键，摘要为 `20d76b0c244a45edd20ee5d789c64ce467a2efe2278e2e4c193037368f8953dc`。直接复用该清单交叉核对项目 ID，避免另造 numeric-ID 体系。
- `scripts/extract_rogue_tm_compat.cjs` 已有固定提交/内容摘要、普通 profile、别名解析、10 条显式形态例外；其 CLI 有意只写 ignored output。新生成器调用已导出的纯提取函数，不改变研究 CLI 的写入限制。
- 运行缓存当前仍缺 `freeze-dry` / `quiver-dance` 正文；其余缓存也不是固定发布内容。本任务不读取缓存作为资格来源、不宣称正文完成。
- `getProcessedPokemon()` 保存真实 PokeAPI `id`、基础 `speciesId` 和形态文本；`getProcessedPokemonFromReferenceSet()` 可能构造形态文本。查询层不靠任意 `name`/中文名猜身份，不自动套基础形态。商店后续接线须提供经确认的索引身份。

## 2. 改动面

| 文件 | 归属与改动 | PRD |
| --- | --- | --- |
| `scripts/generate_fixed_tm_runtime.cjs` | 新生成器，复用 extractor，验证后端 50 键与工厂索引，确定性输出；支持 `--source`、`--check` | F1/F2/F4、AC1 |
| `scripts/generate_fixed_tm_runtime.test.cjs` | 生成器契约测试、输入篡改/冲突拒绝、固定源全量复现 | AC1/AC2 |
| `src/features/game/data/fixedTm/generated.ts` | 生成的完整 50 名单和 1076 个身份的精简学习数据；跟踪入库 | F1/F2/F4 |
| `src/features/game/data/fixedTm/types.ts` | 只读身份、TM、资格结果、准入诊断类型 | F2/F3 |
| `src/features/game/data/fixedTm/query.ts` | 精确身份查找、单成员/全队可学且未学查询；纯函数 | F2/F3 |
| `src/features/game/data/fixedTm/index.ts` | 唯一消费者入口，缓存动态 import Promise，按需加载查询与数据 | F4 |
| `src/features/game/data/fixedTm/admission.ts` | 50 项默认未准入、正文/效果证据空、价格空；只读门槛诊断 | F3 |
| `src/features/game/data/fixedTm/fixedTm.test.ts` | 实际生成数据、查询、准入隔离、离线加载测试，进入现有 npm test 范围 | AC1–AC4 |
| `docs/tasks/固定TM运行数据/provenance.json` | 源路径/摘要、输入清单摘要、每个身份的符号/profile/映射方式、输出摘要和缺口 | F1/F2/F4 |
| 本目录 `implementation.md`、`log.md` | 实现/静态结果与复现命令；log 只追加 | AC5 |

不改 `package.json`、`src/types.ts`、后端种子、原 extractor、控制器、存档、商店/交易/UI 或已有数据加载路径。新增模块尚无生产页面调用方，后续 TM 商店任务通过唯一入口接线；本轮提供可被运行代码调用的完整模块，不把它接成商品。每条代码边界来自 PRD 约束/F4。

## 3. 数据流与生成契约

### 3.1 离线生成（F1/F2/F4）

1. `node scripts/generate_fixed_tm_runtime.cjs --source D:/Games/pokeFactory2/output/rogue-expansion-reference` 从显式源路径读取，不依赖约定 output 路径存在。
2. 调用 `extract()`：校验 Git SHA、TM/profile 摘要、计数，严格排除 revised 与动态 TR。调用 `mapFactorySpecies()`：锁定 pokedex/species.h 摘要、交叉验证工厂索引；任何未知/冲突、重复 identifier 或重复 pokemonId 均停止生成，不能写半套产物。
3. 解析后端 50 键，校验其来源和有序摘要；逐项对应源 TM 编号、MOVE 符号以及项目 `Move.name`。TM17/33 仍保留，不能因为当前正文缺失删除。
4. 以工厂索引的 identifier/speciesId/pokemonId 和源 profile 为映射依据。生成每行 `identifier, speciesId, pokemonId, sourceAlias, tmNumbers`；TM 以 1–50 的整数数组存储，避免原始 profile 文本膨胀。不使用 JS 32 位位掩码容纳 50 项。
5. provenance 保留完整映射证据、普通模式、生成器版本、源输入摘要、后端清单与工厂索引 SHA256、映射前后计数及各生成文件 SHA256。无绝对机器路径/当前时间字段，保证同输入字节完全一致。
6. 写入前一次性构建并验证所有内容。正常模式只写上述指定 generated/provenance 文件；`--check` 不写文件，逐字节对比当前产物，发现漂移返回非 0。生产构建不调用提取器、不要求有研究库。
7. 实施中确认本机 Git 自动转换 CRLF。orchestrator 已批准局部 `.gitattributes` 保持新模块/任务目录和两份生成脚本 LF；项目文本输入摘要明确使用 UTF-8、CRLF→LF 规范化，固定 Rogue 原始输入摘要不变。输出仍逐字节核对，不放宽漂移检查。

### 3.2 身份及资格查询（F2/F3）

- 输入 `FixedTmMemberIdentity = { pokemonId: number; speciesId: number; identifier?: string }`。两个数均为正整数，pokemonId 是实际个体形态 ID，不是基础 speciesId 的别名。可选 identifier 若提供也必须精确匹配该映射行；数字字符串只在该行本身为基础标识时允许。
- `resolveFixedTmIdentity(identity)` 按 pokemonId 找唯一映射，复核 speciesId 和显式 identifier。缺失/未知/冲突返回诊断；未知 pokemonId 即使 speciesId 已知也拒绝。禁止未知形态自动回退到基础物种。
- `getFixedTmEligibility(identity, moveName, knownMoveNames)` 返回可区分的 `eligible / already-known / incompatible / unknown-identity / identity-conflict / unknown-tm`。先验证 TM 与身份，再取固定资格，最后排除已学，绝不读取成员的 PokeAPI 全 moves。
- `listLearnableFixedTms(identity, knownMoveNames)` 按 TM 编号返回来源可学且未学项；名称明确是学习资格，不是商店商品。代际不作为参数。
- `getTeamFixedTmEligibility(members)` 保留每个成员诊断，并给出至少一名符合来源资格且未学的 TM 及成员索引；不修改成员、不发奖励、不扣券。
- 当前 API 不提供 GamePokemon 的猜测式适配器。后续接线应从实际 `id/speciesId` 和已核对工厂标识构造输入；进化/形态切换后的身份必须重新查表。缺身份的旧数据保持诊断，不补猜测。

### 3.3 准入与加载（F3/F4）

- `getFixedTmAdmission(moveName)` 对所有固定 50 返回 `status: pending`、`fixedContentEvidence: null`、`battleEvidence: null`、`price: null`；项目名称映射与兼容性已有数据不改变这些门槛。
- `getFixedTmSaleReadiness(...)` 合并成员资格与准入诊断，返回 `saleEligible: false` 和 blocker 列表。不要设计“调用者传 true 即绕过”的批准开关。未来准入必须修改跟踪的台账并附正文/效果证据和获批价格，属后续任务。
- 消费者只使用 `loadFixedTmCatalog()`，内部 `import('./query')` 按需加载 generated 数据，复用同一 Promise；加载错误向上抛出，可再次调用重试，不能回落空表/全部可学。
- 本任务不往 App/首屏引入模块，无新增 API、fetch 或回源请求。模块无需网络资格查询；后续打包按需加载可能需要本地静态 chunk，这不等于离线 PWA 能力。

## 4. 可观测状态契约

| 字段 | 含义 | 消费的验证项 |
| --- | --- | --- |
| provenance.source.commit/profileMode/digestSha256 | 固定源及普通模式 | V1/V2 |
| provenance.inputHashes/outputHashes/counts | 输入变化、重生成一致性、覆盖率 | V1/V2/V7 |
| catalog.tms[].tm/moveName/sourceMove | 完整 50 编号和项目身份 | V1/V4 |
| identity.identifier/speciesId/pokemonId/sourceAlias | 精确形态映射 | V2/V3 |
| eligibility.status/compatible/alreadyKnown | 不同拒绝原因及来源资格 | V3/V4/V5 |
| teamEligibility[].memberIndexes | 实际三人队至少一人资格 | V5 |
| admission.status/fixedContentEvidence/battleEvidence/price | 保持未准入与证据空缺 | V6 |
| saleReadiness.saleEligible/blockers | 资格与售卖隔离 | V6 |

## 5. 验证计划

均为静态/数据验证，不产生购买、战斗或实体手机通过声明（AC5）。

| 编号 / PRD | 断言与方法 | 路径/记录 | 证据类型 |
| --- | --- | --- | --- |
| V1 / AC1 | 50 连续唯一项，后端种子与固定源逐项匹配；改变来源SHA、输入摘要、重复键/缺项应拒绝；重复生成字节一致、--check无写入且漂移失败 | `scripts/generate_fixed_tm_runtime.test.cjs`；implementation | 静态测试/摘要 |
| V2 / AC1/2 | 开启真实源集成测试，全量逐行对比原 extractor 的 tms 和1076映射；1025+51、10例外、0未知/冲突；普通profile测试保留排除revised/竞技配招含义 | 生成器测试、provenance | 数据断言 |
| V3 / AC2 | 1/1025边界、全部10形态例外、rotom与rotom-heat；未知pokemonId配已知speciesId不得回退；speciesId/identifier冲突、缺失/非法数值分别拒绝 | `fixedTm.test.ts` | 单元测试 |
| V4 / AC2/3 | 皮卡丘 TM13 正例、皮卡丘 TM25 反例；百变怪/未知图腾零兼容是incompatible不是unknown；已学 thunder-wave 单独报告；TM17/33身份仍存在；未列入50的招式拒绝 | `fixedTm.test.ts` | 单元测试 |
| V5 / AC3 | 三成员资格联集准确保留索引；一员已学、另一员可学仍能给后者资格；全员已学/不兼容/未知无候选；改世代无查询入口，不查pokemon.moves | `fixedTm.test.ts` | 单元测试 |
| V6 / AC3 | 50项全部pending、正文/效果证据/价格空；即便三员可学且未学saleEligible仍false；未知TM不可售 | `fixedTm.test.ts` | 单元测试 |
| V7 / AC4 | 禁用fetch的Node测试中动态load+查询成功；检查无output/绝对路径运行导入；记录generated原始/gzip大小；构建完成且未接入首屏图，不增加首屏请求 | `fixedTm.test.ts`、build输出及implementation | 静态构建/包体数据 |
| V8 / AC5 | npm lint/test/build与go test ./...；额外显式执行CJS生成器测试及旧提取器真实源测试；独立auditor复核 | implementation、audit | 静态门禁 |

复现附加测试：设置 `ROGUE_TM_SOURCE` 后运行 `node --test scripts/extract_rogue_tm_compat.test.cjs scripts/generate_fixed_tm_runtime.test.cjs`。生成器集成测试在无源机器可显式跳过，但交付门禁必须有源执行、不得把skip记为通过。

本任务无玩家界面变化，因此不为其制造UI验收场景。后续商店学习/逐招效果由player在冻结最终代码真实前后端验证；当前仅 AC5 的数据/静态边界。

## 6. 风险与待批准技术决定

1. **只按需提供模块，不接生产页面**：PRD禁止改商店/UI；新增查询入口会在后续任务接线。构建通过不表述为玩家已能购买TM。（F3/F4）
2. **严格身份参数**：本轮不按 `name/formLedgerSlug` 猜测形态。调用方未持有可信数字形态身份时宁可返回未知；以后扩充形态必须补显式映射和源证据。（F2）
3. **仅派生资格数据入库**：保留1076映射需要有限数据体积；使用按需chunk并记录真实大小，不靠未经实测的性能数字。公开分发权利核查仍是目标级独立门槛。（F4/任务约束）

无新增玩法数值、价格或准入豁免。以上3项请求方案评审确认。
