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
