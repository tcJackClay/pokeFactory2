# 初遇伙伴实施计划

## 目标与边界

新存档在进入基地及工厂挑战前，完整展示 25 皮卡丘、133 伊布、175 波克比、447 利欧路、744 岩狗狗、921 布拨六只候选。玩家可在确认前任意改选；确认成功后将一只绑定当前存档，基地展示该伙伴，不能再次选择。初遇池与设置中的九个互斥工厂世代池独立；伙伴不进入租借队、敌队或战斗结算。按 `design.md` 实现，不加入亲密度增长、剧情、培育特权或新数值。

## 当前入口与缺口

- `src/features/game/components/game-view/BootLoadingScreen.tsx` 在资料准备好后调用 `enterBase()`；`src/features/game/hooks/usePokeFactoryGame.ts` 的 `enterBase()` 无条件进入 `BASE`。
- `src/types.ts` 的 `GameState` 没有初遇状态；`src/features/game/components/GameView.tsx` 没有初遇页面分支。`BaseScreen.tsx` 复用 `StartScreen.tsx`。
- `usePokeFactoryGame.ts` 把 `starterName` 固定为 Pikachu、`starterBondLevel` 固定为 1；`StartScreen.tsx` 显示专用皮卡丘两帧图，没有按存档展示所选物种。
- `src/services/saveManager.ts` 的 v10 `progress`、`SaveDraftInput`、`normalizeSaveData()`、`createSaveData()` 均没有伙伴字段。自动保存及离开页面保存由 `buildCurrentSaveData()` 触发，确认必须经过同一持久化路径。
- `src/uiStrings.ts` 的旧“从三只随机宝可梦中选择”文案与六只固定候选冲突。

## 实施顺序

1. **先合入损坏存档保护任务，再改存档结构。**该任务正在改 `saveManager.ts`，本任务不得并行覆盖其检查、备份或自动保存门禁。随后把新规则升为新存档 schema，维持当前存储键的版本判定和旧档明确提示；旧 v10 不做伙伴迁移或隐式指定皮卡丘。新 schema 的 `progress.companionSpeciesId` 只允许上述六个整数 ID 或 `null`（未确认）。解析同版本存档时拒绝字段缺失、非法 ID 或其他类型，走损坏存档保护界面，不能悄悄改成候选之一。新档 `null` 合法，便于在选择前保存；导出、导入和重置使用同一校验。若 schema 升级会影响正在进行的旧局，由既有旧版提示明确告知玩家备份或重开，不静默覆盖。
2. **建立单一候选配置与显示资料。**在游戏功能目录集中定义六个 `{id, 中文名, 英文名}`，UI 与校验共用 ID 集合；当前语言决定名称，不以当前工厂世代过滤。候选图先使用 `getPokemonOfficialArtworkUrl(id)` 的同源端点，失效时回退 `getPokemonSpriteUrl(id)`；核实 Go 资源映射与六张本地图像均可访问。素材存在不代表公开使用许可，最终发布素材权利沿用总发布门槛。
3. **加入初遇页面和导航门禁。**扩展 `GameState`、`GameView.tsx` 与 ViewModel，在 `BOOT` 完成后按 `companionSpeciesId` 分流：`null` 进入初遇选择，已确认进入基地或原有续玩路径。页面一次列出全部六只，当前选中有文字与可见状态；点击其他候选只改临时 UI 状态。确认按钮在未选时禁用，确认前提示“绑定当前存档”，避免误触。入口及开始挑战动作均应检查已确认，不能通过刷新、其他页面入口或开发辅助绕开初遇；但不要改工厂队伍构建规则。
4. **确认时同步落盘，再进入基地。**确认处理仅接受名单内 ID，并检查当前存档仍未绑定；用当前存档构建器生成数据、写入新 ID、调用 `persistSaveData()`，成功后才更新运行状态并进入基地。写入失败保留选择页、所选项和可重试提示；连点确认幂等。自动保存和 `beforeunload` 保存都必须从同一个 `companionSpeciesId` 状态取值，不得在确认前产生默认皮卡丘，也不得用旧状态覆盖刚确认的值。确认后刷新或同版本导入不再出现选择页。
5. **替换基地占位展示。**`StartScreen.tsx` 从 ViewModel 获取 ID 和名称，按 ID 展示对应图像与可读标签。现有 `pikachu-anim-front.png` 的两帧裁切仅用于 ID 25；其余五只使用静态图，不套用皮卡丘帧位移。`starterBondLevel=1` 只是占位，不能在本任务中把它包装成已定亲密度玩法。初遇页面、基地及界面文案统一删去“三只随机”措辞。

## 静态验收

- `npm run build`、现有类型检查和相关测试通过；新增针对候选 ID 白名单、`null` 未确认、非法同版本档拒绝、确认持久化失败、连续确认、同版本导出导入的有意义测试。
- 检查 `GameState`、ViewModel、页面、保存构建与解析的字段全链路；六只候选从唯一配置渲染，数组恒为六只，物种顺序稳定，不受 `selectedGens` 修改影响。
- 检查所有工厂组队、敌队与 BP 代码没有读取伙伴 ID；挑战队伍仅来自原有租借流程。
- 核对 `storage/assets/pokemon-sprites/official_artwork/` 与 `front_default/` 六组文件，并核对同源资源端点能对六个 ID 返回图像；检查无永久外网图片依赖。

## 手机端运行验收

在隔离新档和模拟手机视口分别测 320×568、390×844 竖屏及 844×390 横屏。新档完成启动后，选择页能看到六只完整候选及名称；窄屏允许同页滚动，但不能漏项、横向溢出或遮挡确认按钮。逐一切换选中项，再确认其中一只；基地显示正确物种，刷新、关闭重开、同版本导出导入后仍一致且不出现改选入口。分别用第一代与第九代工厂池建立新档，初遇六只完全相同；进入 Classic 后验证六选三来源仍为当前单世代租借池，伙伴不出现在租借队。模拟保存失败，页面留在初遇、显示重试反馈；恢复后一次确认成功。旧版存档和损坏同版本存档分别出现可理解的提示与备份/清除入口，不被自动保存覆盖。记录截图、控制台、资源响应与存档字段，不把结构测试当成手机视觉验收。
