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
