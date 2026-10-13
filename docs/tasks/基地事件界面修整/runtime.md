# 最终代码实玩：基地事件界面修整

## 裁决与环境

**PASS：本任务 V1–V8 的指定自然/受控模拟浏览器范围。** 2026-10-14，对冻结业务提交 `a9dbde359a6e5cef3b5b87820763b1b2290fc5c4` 完成 26 个最终场景；不含首次淡入、选择器或夹具断言失败的草稿。没有改业务代码，也没有用旧 244738d 截图抵扣。

- 工作树 `D:/Games/pokeFactory2-worktrees/base-event-ui`。开始/结束 HEAD 均为 a9dbde3，`git diff --name-only -- src backend` 空。src tree=`717d26b87db1565e14b045642f61b9371efaca7a`，backend tree=`653145c29e68ff1c69697d95efd3f4214915af46`。
- 真实 Go：工作树根 `PORT=3007 go run ./backend/cmd/server`，session38278；Vite：4306、0.0.0.0，`GO_BACKEND_URL=http://127.0.0.1:3007`、`DISABLE_HMR=true`，session43860。健康检查ok，用户4300未触碰。环境和数据hash见 `evidence/final-a9dbde3/environment.json`。
- Playwright Chromium151.0.7922.34，touch/isMobile/DPR2，320×568、390×844、844×390；独立origin `http://127.0.0.203:4306`。每案例新context；不是实体Android、生产环境或Codex侧栏控制。浏览器已关闭，验收服务保留。
- 自然路径为空存储选择波克比并进基地；其他夹具由本版createSaveData生成且parse校验。旧自然队伍/存档只是标明来源的数据输入，当前运行重新采证。六伙伴切换、派遣READY/球/收据、七战结束checkpoint为受控档；不宣称自然七胜。
- 正常操作为tap、滚动、真实file input；只读React view-model补充观察事件队伍/背包/场景，不调用action。网络定点404和延迟、`.7/.99`首值后`.001`的RNG单独记录。没有DEV Win。

## V1–V8 对照

| 项 | 最终案例 / 结果 | 实际状态与证明边界 |
| --- | --- | --- |
| V1 | v1-natural；v1-v8-layout-stable-{zh-hans,zh-hant,en}；v1-english-companion-{25,133,175,447,744,921}；v1-dock-navigation | 自然波克比175绑定；三语三尺寸、六只英文伙伴名三尺寸无hero区域相交或横溢出。状态/标题/主按钮/伙伴有实际占位，短屏滚到四入口；Settings/Events往返、Collection三尺寸往返，Shop按原未开放状态disabled。geometry补证，关键图片已人工打开。 |
| V2 | v2-cold-summary | 真实BASE→EVENTS入口，未开picker，选中948先Loading/Reading types，再真实API返回Toedscool、ground/grass、matched(1)；25真实电属性在Johto不匹配。 |
| V3 | v3-partial-retry | 仅948首次HTTP404，25成功；948显示error而非未选择。1500ms计数窗口没有自动重复请求；点Retry后ready，Owned和选择不变。窗口仅用于检验无循环，成功以DOM状态变化判定。 |
| V4 | v4-late-choose / clear / import；v4-late-final-leave；v4-selected-a-to-b | 推荐加载期间改选25、清除、返回基地后释放真实响应不覆盖选择，按钮恢复；离场案例显式等待迟到response再读状态。另测已选A948加载中打开picker选B25，A完成仍显示B。真实导入另一伊布133档reload后新档不混旧选中/来源。 |
| V5 | v5-picker-dedupe-final；v5-partial-auto-no-subset；v5-all-details-failed-final | summary/picker重复开关下948只有一次in-flight；搜索空结果明确。正常基地路由Auto从完整池选948，matched(1)且按钮恢复；Johto无合格成员正常退出Loading并提示。948失败时虽133已可用仍不从残缺池推荐；重试后从完整池选中。全部Owned两只资料失败时显示失败/Retry，未伪装无收藏；显式重试恢复。 |
| V6 | v6-resume-final | 合法受控stage7 BASE/WIN档：事件Pick/Clear/Auto/dispatch禁用，摘要仍ready。320结束确认Cancel保留team/runId；Resume后真实训练家介绍点击CONTINUE，到stage8，runId与原队员ID保持。并非自然打完七场。 |
| V7 | v7-join-1-ball-final-v2；v7-join-0-ball-final-v2；v7-independent-events-route-final | 有球真实领取按钮双击burst：收据1→2、球1→0、队伍1→2、地区READY→IDLE，仅一次。320结果可读；844滚动看到完整原始训练文字，再滚回关闭可达。零球：原“背包里没有可用的精灵球”保留、球0/收藏不变，原流程READY→IDLE。另经真实事件战投大师球成功，结算回独立EVENTS，Clear→Auto正常选948，按钮恢复。 |
| V8 | 三语stable-layout；v8-dev-toggle；V7结果图 | 三语页面自有文案、英文/繁中picker短屏关闭可触达。正常模式无Mock/Dev preview；Settings启用开发模式后显示Dev preview。原动态中文与繁中专名fallback未伪装已完成。 |

## 明确的原行为与未完成项

1. **全站语言未完成**：英文结果仍原中文拼接，例如“认可了你的队伍…HP +2 努力值”、事件战调查结果和零球文案；完整信息保留。繁中地区/伙伴/属性专名仍沿简中fallback，例如岩狗狗、关都、一般。全局顶部繁中也沿现有字串。此片只验证两页面自有copy。
2. **共享一般属性图标白对白**：Kanto配置normal/water/grass正确，picker文字和摘要资格正确；`uiAppConstants.ts` 的normal引用 `index.css:67 --type-normal:#ffffff`，`components/TypeIcon.tsx`以该色着色mask，事件卡白底圆标近似空白。共享图标/变量/配置相对本片基线无diff，记录视觉待修，不称本片已解决。
3. **全局Round320仍截字为Rou…**；不属于本次hero修整，未标全站布局完成。短屏内容需要纵滚，已验证可达，不强求一屏全展示。
4. **零球领取结束本次派遣是现有流程**：`usePokeFactoryGame.ts:1748` 在join无球时返回原消息；外层领取将结果写入IDLE。本片未改该控制器。后续自然球来源/派遣规则闭环再评估，不把本片改成重新发奖或保留READY。
5. **Owned空态没有用非法档强造运行证据**：进入基地须绑定伙伴，合法正常页面至少拥有伙伴；本次验证资料全部失败与无搜索结果不混淆，未声明自然Owned空实玩。语言切换保留数据通过各语言独立合法档及页面往返；任意外部篡改内存上下文不在证明范围。
6. 自然球来源、岩狗狗地区资格、事件战完整断点恢复、捕捉原95%上限、自然完整长局、实体手机、生产/弱网/性能仍独立未完成。

## 原始错误与草稿

最终26场景无pageerror、非预期console error或非预期HTTP错误。3个故障案例仅预设404：partial-retry 1次、partial-auto 1次、all-details-failed-final 2次；对应服务console错误全部保留。注入只是控制故障，重试成功仍真实请求本地Go。

不入最终manifest的草稿保留本地：三份非stable-layout截图抓在模态淡入，稳定版改为检查实际opacity后重取；初次Auto截图滚动位置偏离操作地区，已重取Kanto完整摘要；首个V6脚本未点训练家CONTINUE导致等待stage8超时；首批V7锚定Events名称漏掉READY徽标；首个零球脚本错误附加“仍READY”断言，核原流程后改为记录IDLE；首次全资料失败拦截范围过宽干扰后台预取，正式只拦Owned的948/744。均未据此改业务。

## 关键视觉复核入口

以下均相对 `evidence/final-a9dbde3/`，图像已由player打开判断：

- `v1-v8-layout-stable-en/base-320.png`、`base-390.png`、`base-844.png`与`dock-320.png`：标题/状态/伙伴及底部四入口。
- `v1-v8-layout-stable-zh-hans/base-320.png`、`v1-v8-layout-stable-zh-hant/base-844.png`、`picker-320.png`、`v1-v8-layout-stable-en/picker-844.png`：三语及模态可读。
- `v2-cold-summary/02-ready.png`、`v3-partial-retry/01-one-error.png`与`02-retry-ready.png`：自动摘要、失败及真实重试。
- `v5-picker-dedupe-final/02-normal-route-auto-visible.png`：Kanto真实Auto结果完整可见；下方Johto原25不匹配不是被推荐结果。
- `v6-resume-final/01-disabled-summary.png`、`02-end-confirm.png`与`03-resumed-eight.png`：禁用/取消/继续。
- `v7-join-1-ball-final-v2/01-result-320.png`、`02-result-844.png`、`02b-result-844-scrolled.png`：320文字，844关闭位与滚动后完整原文分别采证。
- `v7-independent-events-route-final/02-independent-auto.png`：真实事件战结算后独立EVENTS推荐。

## 重放与入库

在同一SHA、相同真实服务环境，用 `node --import tsx docs/tasks/基地事件界面修整/run-*.mjs` 对应的 layout / async / regressions / summary-late / dock 脚本（不是直接运行harness模块）重放；可用环境变量PF_CASES逗号分隔选案例。每案例独立context。脚本仅写本任务证据目录。

`evidence/final-a9dbde3/manifest.json`列最终26案例和所有原件SHA256；`commit-manifest.json`为建议显式入库文件白名单，排除上述草稿，包含脚本/本记录/环境/压缩状态和关键图。证据与脚本设置-text保留字节。当前未暂存/未提交，由orchestrator审核后再逐文件核hash入库。
