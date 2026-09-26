# 初遇伙伴设计核对

## 已定玩家行为

- 用户本轮定稿：首发初遇事件一次展示六只候选：25 皮卡丘、133 伊布、175 波克比、447 利欧路、744 岩狗狗、921 布拨。玩家从中选择一只，**确认前可改选，确认后绑定当前存档**。伙伴只在基地承担局外陪伴，不进入工厂租借队。
- 《宝可梦对战工厂_项目设计框架_v1.md》§3.1–3.2 确定初遇发生于工厂挑战前，并把伙伴作为局外长期线的锚点；§4.1 的工厂队伍仍走临时租借。§10.5 的对话、亲密度、背景和事件钥匙是后续建议，尚无增长及解锁数值。
- 初遇候选与设置中的工厂世代池**相互独立**：选任一工厂世代时，初遇仍展示同一组六只。新版本存档确认后应能在基地看到所选伙伴；刷新、重开和同版本导出导入后保持。不得因选择伙伴改变 Classic 六选三租借结果或直接将其加入队伍。

## 候选池来源核对

| 来源 | 已找到的内容 | 对限定候选池的结论 |
| --- | --- | --- |
| 《宝可梦对战工厂_项目设计框架_v1.md》§3、§10.5、§20–21 | 写明“偶遇一只”“局外陪伴”；§20 的“皮卡丘”是 Base 线框示例，§21 有 `starterSpeciesId` 草案字段。 | 框架原本没有物种名单、候选数量或抽取规则；这些现由用户本轮决定，不能把线框示例误记为来源。 |
| 《对战工厂_参考索引.md》指向的 `reference/pokeemerald-expansion/src/battle_factory.c`、`src/data/battle_frontier/battle_frontier_mons.h` | 提供工厂租借与对手的固定 set、档位和抽样入口。 | 这是工厂战斗池，不是初遇伙伴池；不能直接拿租借池当候选名单。参考索引没有局外陪伴系统条目。 |
| 当前 `src/features/game/hooks/usePokeFactoryGame.ts` 与 `src/features/game/view-model/state.ts` | `starterName` 固定为 `Pikachu`，`starterBondLevel` 固定为 1；ViewModel 只有展示字段。 | 是现有占位，不是限定候选池或玩家选择记录。 |
| `src/uiStrings.ts` 与 `src/assets/menu/pikachu-anim-front.png` | 有“从这三只随机宝可梦中选择一只”的旧文案和皮卡丘展示图；本地 `storage/assets/pokemon-sprites/` 也有多个物种资源。 | “三只随机”不是本轮规则，需在实现初遇时改为六只固定候选；资源存在只证明初步可用，不等于公开使用许可。 |

**结论：限定名单、六只全展示、确认后绑定及工厂世代池独立均来自用户本轮决定。**设计框架、工厂参考池与当前占位资源只用于核对实现条件，不替代该决定。

## 仍待定的后续内容

伙伴亲密度如何增长、专属剧情、培育资格、特殊形态及装饰效果尚未定稿；本任务不为这些内容设数值或事件。现有 `starterBondLevel=1` 是占位，不是经批准的亲密度规则。

## 已定限定物种池与资源核对

以下六只由用户本轮批准为完整初遇池。物种 ID 均能在 `storage/data/factorySpeciesIndex.json` 找到；所列两种图像均为本地现有文件。索引证明数据可定位，图片存在证明有初步展示资源，但都不证明版权许可、画面质量、基地动画或最终文案已验收。

| 物种 ID | 已定候选物种 | 本地索引 | 本地资源 | 设计辨识点，不附加玩法效果 |
| ---: | --- | --- | --- | --- |
| 25 | 皮卡丘 Pikachu | 第 1 世代，`pokemonId=25` | `storage/assets/pokemon-sprites/official_artwork/0025-pikachu.png`；`front_default/0025-pikachu.png`；另有 `src/assets/menu/pikachu-anim-front.png` | 与现有基地占位衔接，识别容易。 |
| 133 | 伊布 Eevee | 第 1 世代，`pokemonId=133` | `storage/assets/pokemon-sprites/official_artwork/0133-eevee.png`；`front_default/0133-eevee.png` | 亲近型外观，与皮卡丘形成不同的陪伴气质；本规则不附带进化或培育特权。 |
| 175 | 波克比 Togepi | 第 2 世代，`pokemonId=175` | `storage/assets/pokemon-sprites/official_artwork/0175-togepi.png`；`front_default/0175-togepi.png` | 轮廓与前两者不同，可支持偏温和的陪伴形象；其蛋形外观不代表已定产蛋规则。 |
| 447 | 利欧路 Riolu | 第 4 世代，`pokemonId=447` | `storage/assets/pokemon-sprites/official_artwork/0447-riolu.png`；`front_default/0447-riolu.png` | 提供偏训练搭档的形象，与纯可爱型选择拉开感受；不能因此进入工厂队。 |
| 744 | 岩狗狗 Rockruff | 第 7 世代，`pokemonId=744` | `storage/assets/pokemon-sprites/official_artwork/0744-rockruff.png`；`front_default/0744-rockruff.png` | 犬类伙伴轮廓明确，可让玩家选择更像日常陪伴的对象；不预设进化分支。 |
| 921 | 布拨 Pawmi | 第 9 世代，`pokemonId=921` | `storage/assets/pokemon-sprites/official_artwork/0921-pawmi.png`；`front_default/0921-pawmi.png` | 让限定池包含较新的物种，补足年代跨度；其电属性不赋予局内效果。 |

这组六只覆盖 1、2、4、7、9 世代，采用不同外形；它们是**完整的已定初遇池**，不按工厂所选世代过滤，也不从其他物种随机补入。

### 呈现与改选规则

- **呈现**：首次初遇时同时展示全部六只，玩家选择一只；不抽样、不因工厂世代设置过滤。
- **确认前**：可以浏览其他候选并改选；确认按钮应明示将其设为当前存档的基地伙伴。
- **确认后**：绑定当前存档，基地不提供改选。新版本的刷新、重开与同版本导出导入不能重新触发首次选择。
- **工厂公平性**：选择只改变局外伙伴身份及经后续批准的陪伴内容，不改租借池、敌队、BP 数值或战斗属性。

## 可验收的最小流程

新档一次看到全部六只 → 确认前可切换选择 → 确认一只 → 基地显示该伙伴 → 刷新、重开与同版本导出导入后仍是同一只，且不能再次改选 → 无论设置选择哪个工厂世代，初遇六只不变；进入 Classic 时仍只从该世代租借池六选三，初遇伙伴不在租借队。
