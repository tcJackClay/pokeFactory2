# Programmer

- 基于实际合并前置 `00f30d152596c185287f99b4be7227f93f581fe4` 实施；没有运行游戏。
- 主要文件：saveManager、usePokeFactoryGame、useBattleController 的球路径、baseBallInventory、events、事件页/战斗背包和文案；不改九道具效果、派遣概率或捕获公式。
- 实际字段/恢复范围/attempt 身份细化已回填 plan/context/implementation；初次准备失败关闭后无持久结果的边界遵循 root review。
- 静态验证与证据见 validation.md；等待独立 auditor 后再交 player。
- Validation：lint PASS；test 387/387 PASS；build PASS；go test ./... PASS。业务代码冻结，未跑游戏，未推送或合入 dev。

# Auditor

- What I checked: 冻结7c272098对齐F1–F5/T1–T5，审单一库存、所有保存入口、派遣准备/领取、join/catch、空队自然入口与IDLE开始路径；独立串行四门禁387/387通过，见audit.md及audit-static-7c27209。
- Fixed locally: none；未修改实现、未提交、未运行游戏。
- Found but not fixed (needs lead routing): A1 无可战队伍仍完成派遣并进入BATTLE，空队BattleScreen返回null；A2 IDLE开始只改内存且缺开始异步代际/导入复核，写失败会显示未持久化成功。root已认可两项为阻断，统一派修。
- Verdict: BLOCKED，修复后新SHA复审；静态通过不代表浏览器闭环。


# Programmer

按 orchestrator 批准修复独立审计 A1/A2：无可战队伍保留 READY/battle pending/资源并提示工厂挑战返基地；目标加载后再检查，倒下首发有健康后备打开既有换人页。开始派遣改为先原子写盘，失败不出现假倒计时，metadata 迟到检查 generation/导入/选择/Owned。旧 revision 草稿不得回退已持久化开始状态。

新增9项实际回调测试，全量396/396。串行 lint/test/build/Go 均 PASS，日志 `static-a1-a2/`。方案/context/implementation 已补充真实事务与证据边界。保留原 audit 与日志；没有运行游戏、push或合并。交付新修复提交后冻结源码，等待独立复审。

# Auditor

- What I checked: 13dd1f2完整A1/A2修复影响；独立四门禁396/396通过，静态实际builder/ref复现见audit-stale-builder.mjs。
- Fixed locally: none，只有审计产物，未运行游戏或提交。
- Found but not fixed (needs lead routing): A2剩余混合revision旧builder可把已落盘RUNNING覆回IDLE；实际生产闭包与真实存储已复现。A1静态关闭。
- Verdict: BLOCKED，等待A2旧builder修复与新SHA。


# Programmer

修复 A2 复审残留：实际 buildCurrentSaveData 捕获同渲染 baseInventory 并加入依赖，防止 syncEventSave 更新 ref 后旧闭包借新 revision 回写 IDLE。新增真实 builder/sync/start/persist 时序测试，并验证新渲染选择与到期 READY 保存；专项26/26，全量397/397，lint/build/Go串行 PASS。日志 `static-a2-builder/`。原复现脚本和审计证据未修改；提交后再次冻结，不游戏、不推送、不合并。
