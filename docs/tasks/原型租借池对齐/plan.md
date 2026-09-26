# 原型租借池对齐实施计划

## 依据与现状

- 原型依据为根目录《对战工厂_参考索引.md》指向的固定提交 `ca17c6a3d40a`：`src/battle_factory.c` 的 `GenerateInitialRentalMons`、`GenerateOpponentMons`、`GetFactoryMonId`，以及 `battle_frontier_mons.h`、`battle_frontier_trainers.h`。本项目的 `docs/对战工厂原型核对.md` 已区分固定数据存在与实际启用。
- `scripts/generate_factory_reference_sets.cjs` 已把 Frontier 编号 110–881 的 772 个 set 转成 `src/features/game/config/factoryReferenceSets.ts` 及分块。区间表 `factoryReferenceRanges.ts` 已写入原型 Lv50/Open 的八档范围。这只证明数据可读，不证明生成流程使用了它。
- `factoryBattle.ts` 明确把 `useReferenceSetPool` 设为 `false`，注释说明是为覆盖玩家选择的更多地区/世代。`useFactoryFlow.ts` 的 `generateRentalDraft` 默认传 `GLOBAL_RANDOM`；于是初始六选三完全走所选世代随机物种、BST 质量带、进化阶段权重与 `requiredEvolutionStage: 'BASE'`，随后随机化租借 IV。原型是按挑战档位和历史租借 rank 从固定 set 区间抽六只，保留 set 的招式/道具并按原型固定 IV；不存在全员基础形态约束。这是当前最直接的玩法差异。
- 对手不是完全没用固定池。`generateEnemyEncounter` 先选生成的训练家模板，再取该模板的 `monSetKey` 编号池；`TRAINER_POOL_FIRST` 且过滤后有 110–881 编号时，`buildFactoryPool` 会使用对应固定 set。若候选耗尽，则先从训练家物种提示构造普通宝可梦，最后因 `trainerPoolFallbackToGlobal: true` 可退到全局随机。模板选择、按 BST 从抽样候选里择优、首领加成与原型 `GenerateOpponentMons`/`FillFactoryBrainParty` 也不等同。
- 训练家池数据的覆盖并非完整映射：`factoryTrainerMonSetPools.ts` 有 128 个池，其中静态编号统计为 102 个全在 110–881 内、23 个部分在区间内、3 个没有区间内编号；区间外编号出现 592 次（是列表项次数，非独立 set 数）。需由实现任务输出逐训练家、逐挑战档的有效候选与回退统计，不能把生成模板存在等同于原型对手已对齐。
- 已有手机视口运行基线见 `docs/tasks/基地钱包持久化/runtime.md`：初次租借生成三次约 10.1、10.2、12.9 秒，对应 148、126、125 个本地 `/api/pokeapi/*` 成功响应。新一次完整七战试玩见 `docs/tasks/组末BP结算/runtime.md`，同为桌面浏览器模拟 `390×844`，其首次六张租借卡生成约 24.7 秒；该样本未完整记录请求数，不可直接归因。尚无实体手机证据。优化后仍需处理物种、招式、道具资料，不能只改池开关就声称性能达标。

## 实施顺序

1. **先定模式边界。** Classic 按固定 Frontier set、原型挑战区间与历史租借 rank 运行。用户已指定设置页在第一至第九世代中单选一个互斥池，开始挑战不再选世代；现有可混合多世代的随机机制须先改为单世代并明确标为“扩展”，适用范围与 Classic 原型固定池分开。设置页单选不能使未覆盖的固定 set 变成原型数据；Classic 仅在已覆盖的原型范围内生成，无法覆盖时在开始前清晰说明，不把空池悄悄退回全局随机。Rogue 的额外规则未定，不代拟。本步依赖《世代设置实施计划》与模式入口规则，形成可测试的池来源契约。
2. **先修初选。** 在 `useFactoryFlow.ts` 的 `generateRentalDraft`、`buildFactoryPool` 中让 Classic 六个名额按 `getReferenceRangeByChallenge` 和 rental rank 从固定 set 取样；去除对这些名额的 `BASE` 限制与 BST 择优，按原型核对物种、同持有物、特殊例外和 IV 规则。复用 `getProcessedPokemonFromReferenceSet`，保持六选三 UI。若固定池不足六只，明确报错并允许重试，不静默改变数据来源。
3. **再修对手来源。** 对照 `GenerateOpponentMons` 与训练家表，逐挑战档核对模板资格、具体 set 编号、抽样及首领独立路径；使 Classic 对手只取相应有效固定 set。对 110 以下或未导入的引用，先核对原型真实可达性，再补齐必要数据或排除不可达模板。保留来源诊断日志，禁用 Classic 的物种提示与全局随机静默回退；扩展模式的回退由其自身规则决定。
4. **最后压缩首局加载。** 基于浏览器网络计数和 Go 本地数据服务，批量/并发预取本场所需物种、招式、道具与图片；复用已有缓存，避免对同一 set 重复查询。任何预载优化须保持随机结果、去重和固定 set 身份不变。记录冷启动与热启动耗时、请求数、错误数，并设置相对于上述基线的可量化改进目标，目标值由实现测量后定稿。

涉及文件：`src/features/game/config/factoryBattle.ts`、`factoryReferenceRanges.ts`、`factoryReferenceSets.ts`、`factoryTrainerTemplates.ts`、`factoryTrainerMonSetPools.ts`、`src/features/game/hooks/useFactoryFlow.ts`、生成脚本、Go 本地资料端点及相应单元测试。若修改生成数据，必须从固定参考提交重新生成和核对，不手改生成块。

## 静态验收

- 为 Lv50/Open 每档、边界组数、rental rank 的 0/1/最大值写确定种子测试：六个编号均落在正确区间，更好区间只用于指定名额；无不允许的重复物种/持有物；招式、道具、IV 与 set/原型计算一致，不强制基础形态。
- 为训练家池生成覆盖报告：每个可选模板在每个挑战档的可用编号数、区间外引用数、空池数及回退次数。Classic 允许的回退次数为 0；确有缺数据时返回可诊断错误。首领队伍单独对照 `FillFactoryBrainParty`。
- 验证设置中恰有一个世代、所选世代与模式的前置约束，不出现跨世代混池、无候选死循环或把随机池伪装成固定池。运行现有类型检查、构建和相关测试；检查前端产物没有意外全量载入 772 set。

## 手机运行验收

- 隔离新存档，在 `390×844`、`320×568` 竖屏和 `844×390` 横屏的手机浏览器视口分别从基地开 Classic、等候六张租借卡、选三只、完成第一战和赛后换租入口；同时记录 set 编号/来源、重复情况、招式与道具、加载耗时、请求数和失败请求。至少一条以正常出招而非开发胜利按钮打通。
- 至少在真实手机浏览器复核触控选择、等待态、横屏战斗可读性与刷新后恢复。分别测试冷缓存和热缓存、Go 本地资料齐全与服务暂不可用；离线或数据缺失时必须有可理解反馈，不能无限转圈或出现无声随机替代。
- 以三次冷启动样本与已有 10.1–12.9 秒、125–148 响应基线对照报告。若仍接近该量级，应继续优化后才把“首局体验已打磨”标记通过；模拟视口结论不能代替实体手机验收。
