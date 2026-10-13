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
