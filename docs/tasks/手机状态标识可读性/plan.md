# 技术方案：手机状态标识可读性

基线 `992bf3e5`，工作树 `D:/Games/pokeFactory2-worktrees/mobile-status-readability`。PRD 一致性通过：F1–F4 均为既有信息的呈现修复；不引入玩法规则。尚未修改业务代码，等待 orchestrator 评审。

## 1. 调研结论与改动面

| 文件 / 入口 | 实际现状 | 计划改动 / PRD |
| --- | --- | --- |
| `src/features/game/components/game-view/EventsScreen.tsx` 两处属性圆标 | 地区要求和成员选择结果都把 TYPE_COLORS 传给 TypeIcon.color；normal 的变量是白色，容器也白色 | 同文件提取一个局部浅底前景色选择函数：normal 用现有 slate-500 色值，其他属性沿 TYPE_COLORS 和现有 fallback。两处同时调用。F1、E2 |
| `src/features/game/components/game-view/TopRecordPanel.tsx` | 三等列；横向 28px 图标占满窄卡；标签与值都 truncate；繁中复用简中 | 改为每卡上行小图标+完整标签、下行完整数字的两行布局；三个指标一直存在；删除标签/数字 truncate；三语小型本地 label 表。F2–F4 |
| `src/features/game/components/game-view/topRecordPanel.css`（新增） | 无独立样式 | 面板作用域样式统一布局、最小尺寸、数字换行、窄屏/横屏 spacing；由 TopRecordPanel 导入。F2/F4 |
| `src/index.css` 仅 pf-top-record-* 规则 | 两组媒体查询含脆弱的 `> div > div:first-child`，会把新布局的标签行当圆形图标 | 将这些面板专属响应式规则移至新 CSS，以命名 class 定位；其他媒体查询内容原样保留。F2/F4 |

### 图标消费方核实（F1/E2/E3）

`TypeIcon.tsx` 的 mask 背景优先 `color`，未给时用 currentColor，最后 `...style` 仍可覆盖。`TypeBadge.tsx` 为 LIGHT_TYPES 使用 slate-950 currentColor，为深色属性使用白色，现有 normal 徽标正常；战斗 `BattleMoveEffect` 通过 style.color 给 currentColor 着色。仅 EventsScreen 的两个白底圆标发生明确白对白问题。

因此不修改共享 TypeIcon API、TYPE_COLORS、--type-normal、18 个素材映射、TypeBadge 或 BattleMoveEffect。通过正确设置浅底消费方前景色保留共享显式 color/currentColor/style 契约。normal 素材确为 normal.png，不替换成火属性。

### 面板布局细节（F2/F3/F4、E1）

保留三列等宽；每卡 label 行使用紧凑图标与标签居中，下行 value 居中，图标不再占据数字可用宽度。取消 title 作为阅读依赖（可移除冗余 title）；完整标签仍为 aria-label。值用 tabular-nums、min-width:0、overflow-wrap:anywhere，极端长合法连胜可增高换行，不省略、不 k 缩写、不裁剪。

普通窄屏标签至少 11px，数字至少 15px；保留现有较宽屏数字字号。卡片 padding/间距集中本地 CSS；装饰图标约 14px，不隐藏指标。繁中为「輪次」「連勝」，简中「轮次」「连胜」，英文 Round/Streak；BP 三语相同。语言分支沿项目 zh-hant / zh-hans / en，其他 zh 继续简中 fallback。

## 2. 数据流与状态契约

没有新增状态、存档字段、事件或事务。props → 同一 getBattleIndexInSet / battleIndexOverride → String 数字与现有七战分母 → DOM。不得改传参方 GameView / TopStatusRegion。

| 可观测字段 | 来源 / 含义 | 消费验证 |
| --- | --- | --- |
| currentLanguage | Settings / 保存语言；DOM 标签 | V1/V2/V3 |
| coins | 已有 wallet.balance → view-model → props | V1/V2，0 与 9999 |
| stage / battleIndexOverride | 既有 run / resume 映射 | V1/V2，1/7 与 7/7 |
| streak | 既有 view-model → props，原值展示 | V1/V2，0、999999，额外长整数 |
| 类型语义、maskImage、backgroundColor | 真实 normal/water/grass DOM 与 computed style | V3/V4 |
| label/value 的 textContent、client/scroll 尺寸、bounding rect | 真实布局，判断无裁剪/相交 | V1/V2/V4 |
| document scrollWidth/clientWidth、入口/button rect | 页面溢出与可达性 | V1–V4 |

## 3. 验证计划

programmer 串行跑 `npm run lint` → `npm test` → `npm run build` → `go test ./...`；此片不添加镜像 CSS 实现的单元测试。auditor 静态检查改动严格落四个显示文件、图标消费方优先级不变、标签准确、数值计算未变。四门禁日志归 `docs/tasks/手机状态标识可读性/`，运行证据必须由 player 在最终冻结 SHA 重新采集。

player 从本工作树根启动真实 Go 与 Vite，独立端口/来源、0.0.0.0、HMR 关闭，健康检查与 API 成功；不触碰九道具冻结树。三语 × 320×568、390×844、844×390。使用当前 createSaveData 与 parse 校验的大值/指定队伍夹具，不用 DOM 替换或孤立组件截图替代真实页面。

| 验证 | 断言 / PRD | 真实路径与方法 | 证据文件 / 类型 |
| --- | --- | --- | --- |
| V1 | 新档 0 BP/0 连胜、基地原实际 0/7 和进入租借/首战后的实际战次（1/7）、全标签无省略，三语三视口均可读；F2–F4/E1 | 自然新档绑定伙伴→基地→开始挑战租借；Settings 切三语。进入实际共享顶部出现的页面观察 | `evidence/final-<sha>/v1-*` 截图、DOM 几何/文本、操作日志 |
| V2 | 9999 BP、7/7、999999 连胜完整；额外较长合法整数不裁剪；F2/E1 | 合法受控存档刷新/继续至租借或战斗；三语三视口均量测。记录 stage/override 真实值；值不得只靠 title | `evidence/final-<sha>/v2-*` 存档来源+前后状态+截图 |
| V3 | Kanto normal/water/grass 均可辨，指定 normal 成员圆标同样可辨；F1/E2/E3 | 基地→事件，真实关都卡；自然伙伴优先伊布（normal），开启选择器/选中后检查两处圆标；至少三语三视口覆盖地区卡 | `evidence/final-<sha>/v3-*` mask/颜色快照、截图人工检查 |
| V4 | currentColor 深浅属性徽标与战斗 style.color 保持；实际导航和操作可达；F1/F4/E2 | 实际租借页含 normal+深色属性（可受控指定队伍）→详情/图鉴→实际战斗招式徽标，至少一次 normal 攻击动画；检查无横溢出，关键按钮可点击 | `evidence/final-<sha>/v4-*` 截图、页面操作、console/network记录 |

每个最终页面截图前等待字体/图片和页面动画稳定。几何检查只补充截图，不能把非空 mask URL 当视觉已通过。浏览器 DOM 读属性不执行游戏 action 或重写源码。若长值让战斗短屏按钮不可达，先报告并退回修布局，重新冻结后重跑受影响范围。

## 4. 风险与隐含决策（3 项，需评审）

1. **局部浅底色**：采用 slate-500 `#64748b` 作为 normal 圆标前景，和当前未知属性 fallback 一致；不调整其它 17 种属性色。PRD 要求可辨但没有指定色值。
2. **布局和字号**：每卡标签+图标一行、值独占第二行；标签最低 11px、数字最低 15px。实际 320 可用宽度须 player 判断；不为装饰图标挤占数字。
3. **超长值**：大于六位的合法整数允许数字换行，但不得 ellipsis 或改变值；普通 9999/999999 应保持一行。没有新增上限/数值规则。额外 fixture 以现有存档校验接受的整数为准。

## 5. 证明边界

本片只证明指定模拟浏览器页面的显示修复；不声明实体 Android、生产环境、自然完整七胜、全站无障碍或全站本地化。共享图标/主题未改也要实际回归代表消费方；不能援引旧截图作为本片通过证据。