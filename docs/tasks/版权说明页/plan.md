# 版权说明页实施计划

日期：2026-09-26。任务目标：在当前非商业 PokeFactory2 网页中提供玩家可随时查看的版权与素材来源说明。该页面提供真实来源和项目关系说明，不替代公开发布前的 IP 与素材权利核查。

## 现状与入口

`StartScreen.tsx` 是基地首页底部入口区，已有“设置”按钮；`SettingsScreen.tsx` 是可滚动的系统页，返回调用 `enterBase`；`GameView.tsx` 按 `gameState` 切换页面。`GameState` 位于 `src/types.ts`，视图状态与操作类型位于 `src/features/game/view-model/`。加入页面不需要新增存档字段、修改 `saveManager.ts` 的版本或增加 Go API。

最短路径：在“设置”页添加“版权与素材来源”按钮，打开独立的只读页面。页面顶部有清楚的“返回设置”按钮，避免当前 `enterBase` 直接回基地使导航跳级。基地首页可以在后续增加小字入口，但本任务只要求经首页“设置”两步可达。页面也应能在没有存档、内容接口故障时显示，因为说明文本随前端构建发布。

## 页面内容与措辞

页面使用中文和英文两套固定文案，随当前语言切换。结构依次为：项目性质、IP 与关系、数据与图像声音来源、其他素材来源、链接与版本说明。避免把所有素材统称为“PokeAPI 授权”。建议核心文案：

> PokeFactory2 是独立制作的非商业游戏项目，与 The Pokémon Company、Nintendo、Game Freak、Creatures 或 PokéAPI 没有官方关联或背书。宝可梦名称、角色、形象及相关素材的权利归各自权利人所有。本项目的非商业性质和来源署名不代表已获得相关 IP 的使用许可。

来源项按当前仓库可核对的事实展示：

| 内容 | 当前证据 | 页面可用表述 |
| --- | --- | --- |
| 宝可梦资料 | `src/services/pokeApiEndpoint.ts` 与 `backend/internal/web/app.go` 使用 PokéAPI；`backend/config/sync-manifest.json` 列同步数据。 | “宝可梦资料使用 PokéAPI 数据，感谢其贡献者。”链接至 PokéAPI 项目和许可信息。不要称 PokéAPI 为宝可梦 IP 授权方。 |
| 宝可梦图像、道具图 | `storage/assets/pokemon-sprites/report.json` 有来源 URL；`src/assets/icons/ATTRIBUTION.md` 记录 `pokedex-data-card.png` 来自 PokeAPI/sprites。 | “部分图像来自 PokeAPI/sprites；其仓库声明图像内容版权属于 The Pokémon Company。”链接至具体仓库许可说明。不要将仓库的 CC0 声明解释为宝可梦形象已获公开使用许可。 |
| 宝可梦声音 | `backend/internal/web/app.go` 将音声请求指向 PokeAPI/cries。 | “部分声音通过 PokeAPI/cries 提供。”发布前核对实际启用的声音及其来源文件。 |
| 属性图标 | `src/assets/icons/ATTRIBUTION.md` 记录 18 个图标提取自 52Poké 图表及网页页脚许可文字。 | “属性图标来源：52Poké，已作适配处理。”链接至来源页面；素材本身的许可范围仍需核对。 |
| 战斗场地 | `public/assets/pokerogue/arenas/README.md` 记录从 `pagefaultgames/pokerogue-assets` 的 `beta` 分支固定提交导入 6 个文件，源文件标记为 AGPL-3.0-only。 | 写出“部分战斗场地素材来自 PokeRogue Assets”，链接到该仓库与许可文件，保留源提交号。 |
| 规则参考 | `Pokerogue战斗计算对齐记录.md` 记录 PokeRogue 固定提交用于战斗计算参考。 | 可在“开发参考”中列出，不表述为 PokeRogue 官方合作或资产授权。 |

不能在未逐项核查之前声称“全部素材均已获授权”“可合法公开发布”“所有图片均为 CC0”或“本项目受到宝可梦官方支持”。对于项目自身代码的版权或许可，也不要从 `src/App.tsx` 单个 Apache-2.0 文件头推断全仓库已按 Apache-2.0 授权。

官方与上游核查链接： [Pokémon 内容使用问答](https://support.pokemon.com/hc/en-us/articles/360000634094-Can-I-use-Pok%C3%A9mon-images-or-materials)、[Pokémon 网站使用条款](https://www.pokemon.com/uk/legal/terms-of-use)、[PokeAPI/sprites 许可说明](https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt)、[PokéAPI 数据项目许可](https://github.com/PokeAPI/pokeapi/blob/master/LICENSE.md)。这些页面分别说明官方 IP 的权利边界及第三方仓库自己的声明；本页不据此给出法律许可结论。

## 实现文件与操作

1. `src/types.ts`：给 `GameState` 增加只读页面状态，例如 `CREDITS`。
2. `src/features/game/components/game-view/SettingsScreen.tsx`：新增“版权与素材来源”按钮；保留现有滚动和语言切换逻辑。
3. `src/features/game/components/game-view/CreditsScreen.tsx`：新增独立页面。采用与设置页一致的系统页布局、可滚动正文、外链可见来源名、手机安全区域；外链用 `target="_blank" rel="noopener noreferrer"`。长链接不要直接作为按钮文案。
4. `src/features/game/components/GameView.tsx`：增加 `CREDITS` 渲染分支。
5. `src/features/game/hooks/usePokeFactoryGame.ts` 与视图操作类型：若直接使用已有 `setGameState` 打开页面，只需在版权页用明确的“返回设置”动作或已有 setter；不要让返回按钮清空或重置游戏进度。
6. `src/assets/icons/ATTRIBUTION.md`、`public/assets/pokerogue/arenas/README.md`：作为事实来源，不在本任务修改原始归属记录。若进一步盘点发现遗漏，再单独更新来源清单和页面文案。

## 验收

静态检查：`npm run lint`、`npm test`、`npm run build`；核查页面文案没有“已获授权”之类结论；逐个外链检查目的地；确认没有保存字段或存档版本变化。组件无需为静态文案写镜像式测试，但若导航状态有复杂逻辑，应验证“设置→版权→设置→基地”不会改变存档与进行中的挑战。

手机端运行检查：在生产构建或同等运行服务上，从首次进入的基地打开“设置→版权”，分别以 `320×568`、`390×844` 和 `844×390` 检查标题、来源列表、外链和返回按钮；长内容可单指滚动，横屏不会裁掉返回入口；中文、英文均无重叠和溢出。退出、刷新、再次进入后，存档与战斗续接状态保持。记录当前提交、视口、截图、控制台错误和实际链接目标。侧边浏览器的尺寸模拟通过后，再由实体手机浏览器复核触控与地址栏变化。
