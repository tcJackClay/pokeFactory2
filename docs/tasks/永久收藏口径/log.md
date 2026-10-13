# Programmer

- 按部分批准先移除基地Breed、蛋计数、breedingUnlocked与BaseTab占位；四个保留入口改两列/宽屏四列。
- 图鉴新增Seen/Owned单选与数量，跟现有搜索、地区和属性过滤取交集；新文案集中到uiStrings.ts，支持简中/繁中/英文。
- 尚未改saveManager、收藏登记和控制器；派遣成功来源交易按用户最新决定修订plan，等全面批准。控制器另等待状态任务合入后串行接线。
- 尚未完成四项静态门禁或浏览器验收；未提交。

# Programmer

- 根据用户“保留现有获得方式，补成永久收藏”修订后获批的非controller范围已实现：schema15，初遇与派遣来源收据，统一Owned派生，派遣join原子记录，旧快照防回退，同版显式导入不混档。
- 重复派遣收据判等忽略重试时间；保留原acquiredAt，不重复领取副作用。join保存失败维持READY、不扣球不加队，UI提示重试。
- 已准备commitCaughtPokemon回调，但尚未接入控制器；旧捕捉事后Owned effect已移除，因此当前分支是未完成中间态，不可合并或实玩验收为完成。
- 自测：npm run lint PASS；npm test 301/301 PASS；npm run build PASS（既有大chunk警告）；go test ./... PASS。
- 没有运行游戏。控制器接线仍等待状态任务合入，再整合并全量重跑门禁，随后独立auditor/player。

# Programmer

- 上游状态任务完成实玩并合入后，获准串行捕捉接线。先保留WIP bff64de，再merge dev@a317686为ee65ed6，无冲突，无reset。
- 已连接commitCaughtPokemon：成功提交后才扣球/加队；存储失败/重复收据取消简单轮次，无敌方行动。复用上游roundActionLockedRef同步门闩，补捕捉日志后的epoch检查，移除原先无epoch保护的延迟胜利回调。
- 最终完整代码四门禁：npm run lint PASS；npm test 322/322 PASS；npm run build PASS（既有chunk警告）；go test ./... PASS；git diff --check PASS。
- 全src核对现有球定义/初始化/所有背包增加入口后，确认自然新档暂无球获得来源；R7需受控球/队伍夹具，不能宣称自然可达。详细证据、事件战断点缺口与旧大师球95%上限矛盾见implementation.md。
- 没有运行游戏；交独立auditor，再由player以冻结最终代码验收。未推送，未合入主线。

# Auditor

- What I checked: 对 `a317686..7d6d177` 完整差异核对 PRD/plan、schema15 来源归一、全部主档写入口、初遇/派遣/捕捉交易、显式导入、轮次取消和上游场地修复；独立四门禁全部通过，测试 322/322。
- Fixed locally: none；未改业务、未运行游戏、未提交。
- Found but not fixed (needs lead routing): 捕捉结束的旧训练回调覆盖刚捕获队伍；跨地区并发 join 使用旧背包/队伍，最后一颗球可提交两次获得且后一次覆盖前一次加队。已用实际源码 AST 回调提取与受控依赖做静态复现，详情见 audit.md。需实现者修复并补回归。
- Verdict: BLOCKED。门禁 PASS 不能代替上述状态契约修复；随后重审再转 player。

# Programmer

- 修复独立审计A1：控制器事件结算显式传递当前队伍，派遣训练不再写回捕捉前闭包队伍。
- 修复A2：跨地区共享领取门闩，读取并同步最新队伍/背包，单球不双花且连续加入不丢成员。异步返回复核页面/工厂/事件战上下文，迟到结果不写回新状态。
- 新增6项实际源码回调静态回归，包含真实catch→winBattle→resolveBattleResult→事件训练链与跨地区/上下文切换。R7同步补充相应实玩情形。
- 四门禁：npm run lint PASS；npm test 328/328 PASS；npm run build PASS（既有chunk警告）；go test ./... PASS。未运行游戏，未推送、未合入主线；交独立复审。

# Auditor

- What I checked: 独立复审冻结代码 b2d58630e8475e4dbbc6d5e3a024b75073ebce1f，核对 A1 当前队伍显式传递、A2 全局领取门闩与最新资源同步、页面/工厂/事件战迟到保护，以及原有保存失败/导入/epoch 契约未被削弱。六项真实源码回调回归纳入全量 328/328 通过；lint/build/go test 独立通过。
- Fixed locally: none；未运行游戏、未改业务、未提交。仅追加审计文档，旧 BLOCKED 历史保留。
- Found but not fixed (needs lead routing): 本任务无剩余静态阻断；自然球来源、事件战完整断点与大师球旧上限仍按 implementation 记录由后续任务处理。
- Verdict: PASS（静态）。A1/A2 关闭，可转 player 在本版冻结代码验证原 R1–R8 与捕捉训练、跨地区领取、满队替换/取消；此结论不代替运行验收。

# Player

- 冻结 b2d58630e8475e4dbbc6d5e3a024b75073ebce1f，真实 Go3004/Vite4303、HMR关闭、Chromium手机触控模拟；自然初遇/自然九世代首战与受控派遣、捕捉、存档、三视口UI分开记录，未用DEV Win。
- PASS子项：R1/R2/R3、租借进化Seen不Owned、初遇同版导入、v14备份/取消/清除、两球连续join、单球跨地区burst、join保存失败重试、item、catch训练、概率失败、catch保存失败重试及刷新永久记录。
- BLOCKED：满队成功捕捉后showReplaceUI已设但无组件挂载，EVENTS页面无替换或取消入口；full-cancel/full-replace两次复现。证据 evidence/final-b2d5863/r7-catch-full-{cancel,replace}/。
- 未完成项和harness问题已如实记入runtime.md：换怪检查点等待、迟到派遣返回选择器、部分视觉截图在转场中、派遣来源同版导入与旧档拒绝等，不能合并为R1–R8全部通过。
- 已按orchestrator要求结束本任务全部浏览器运行，服务保留，等待修复和独立重审后按新SHA重跑。未改业务、未提交、未合入。

# Programmer

- 修复player满队捕捉阻断：GameView在事件结算后挂载ReplacePokemonModal，BATTLE期间不开放；手机短屏可滚动，六名成员与取消按钮可达。
- 替换/取消使用最新队伍及候选ref并同步清候选；离开事件/开始工厂同步取消待替换，旧点击不覆盖队伍；永久收据、消耗与战斗概率未改变。
- 新增5项实际回调/父页面SSR回归，全量npm test 333/333、npm run lint、npm run build、go test ./... PASS。build保留既有chunk提示。
- 已保留b2d5863的独立审计与失败runtime/log历史；证据和harness由player管理，未批量暂存。未运行游戏/推送/合入，冻结交独立审计后player按最终SHA重跑R1–R8。
