# 实现交接：基地事件界面修整

## A1 返修后的当前候选

独立审计 cdf289d 得到 BLOCKED A1，原因是遗漏 `BASE/currentBaseTab=EVENTS` 的真实合法入口。已修为与 GameView/原派遣上下文一致的两路判定；latest、上下文签名和 effect 均读取 currentBaseTab。推荐状态带 token，失效回调只清自身 loading，较新请求状态不受旧响应影响。

新增 6 项测试直接提取并执行生产 `pickRecommendedPokemon`/`cancelRecommendation` callback：两个合法入口均成功、BASE 换页迟到不写且返回后可再推荐、改选/续局/进入战斗失效、手动取消与新旧请求交错、卸载不写 UI。未只测试预计算 blocked 布尔值。

返修后四门禁**串行**通过：lint exit 0、345/345 tests exit 0、build exit 0、Go exit 0；见 `static-a1-*.log`。主 chunk 595.02 kB（gzip 197.47 kB）警告仍保留。未运行游戏；等待独立复审。下方339项记录保留为首候选历史，不代替本次结果。

2026-10-14。分支 `codex/base-event-ui`，工作树 `D:/Games/pokeFactory2-worktrees/base-event-ui`，基线 `fdbf4e7`。本文件只记录实现与静态验证；独立 auditor / player 尚未裁决。

## 已实现

- 基地状态和伙伴从绝对定位改为真实占位；标题、挑战按钮及伙伴区域可以纵向滚动。专属 CSS 限定本页面，保留伙伴图片/动画、四入口、开始/继续/结束操作。
- 事件页选中 ID 自动加载摘要，不依赖 picker；未选择、加载、失败、匹配、不匹配分开显示。失败提供显式重试；API 返回部分字典时单只失败，不自动循环重试。
- 摘要、picker、推荐共用逐 ID in-flight Promise 与增量结果；卸载停止通知。推荐只有在选择/Owned/页面/可续局上下文仍有效时才落选择，手动清除和选取会立即废弃旧推荐。部分数据失败时提示重试，不从残缺池随机推荐。
- 两页面自有文案集中在 `baseEventCopy.ts`，支持简中/繁中/英文。普通事件页移除 Mock 开关/说明；已在 Settings 开启开发模式后仍可预览。九地区英文名沿既有 Settings/Collection 映射。结果弹窗和 picker 可在短视口滚动并关闭。
- 补齐 `copy.menuDeveloping` 缺失引用。未改共享状态、存档结构、战斗/领取流程、派遣配置、球来源、资格或概率。

## 文件与依赖

仅改批准七个业务文件：StartScreen、EventsScreen、baseEventCopy、baseEventUi.css、useEventDisplaySnapshots、eventDisplaySnapshots、对应测试。所有新增类型为本地显示类型。

工作树已包含 Git 跟踪的本地素材/数据；`storage/assets/pokemon-sprites/report.json` 与 `storage/data/factorySpeciesIndex.json` 存在。只建立 `node_modules` Junction 指向主仓依赖，无主数据复制、清理或额外服务启动；未触碰主仓 4300 或其他验收服务。

## 最终静态门禁

| 命令 | 结果 | 记录 |
| --- | --- | --- |
| `npm.cmd run lint` | PASS，exit 0 | `static-lint.log` |
| `npm.cmd test` | PASS，339/339，exit 0 | `static-test.log` |
| `npm.cmd run build` | PASS，exit 0 | `static-build.log` |
| `go test ./...` | PASS，exit 0 | `static-go.log` |

新增 6 项实际异步 helper 测试：并发去重/增量合并、部分返回/错误数据/显式重试、抛错恢复、dispose 后迟到回调、新生命周期隔离、推荐 token/上下文作废。测试未启动游戏。构建仍有现有大 chunk 警告：主 chunk 594.75 kB（gzip 197.37 kB），本片没有做性能准入。

最初类型检查发现 `Object.entries(records)` 推导 unknown，已改逐 key 类型读取。最后补完 gameState 退出保护及 disposed 前置保护后重跑上述全部四门禁，均通过。

## 下游运行重点与未完成边界

- 按 plan V1–V8，在最终冻结 SHA 起真实 Go/Vite（HMR 关闭），中英三视口与繁中抽查；player 不得使用 244738d 旧图证明本片。页面回到基地/继续工厂、推荐迟到及失败重试须经真实操作。
- 静态 snapshot 服务成功缓存会跨页面复用，故冷加载/故障注入必须全新浏览器 context、首次该 ID 请求；API 故障被共享服务记录的 console error 是预期注入，须分类留存。
- 结果 `lastResult` 和 popup.message/itemName/pokemonName 保留创建时原文；包含上游简中、训练数值与特殊地点，本片没有结构化重译。地区/伙伴/属性专名仍缺独立繁中字段，沿原 fallback。全站及整页全部本地化未完成。
- 无实体手机、生产/性能、自然完整长局结论。自然球来源、岩狗狗资格、事件战完整恢复、捕捉原有上限和全局顶部栏截字仍属独立范围。
- 没有运行游戏、没有生成运行截图，也没有自行审计通过声明。
