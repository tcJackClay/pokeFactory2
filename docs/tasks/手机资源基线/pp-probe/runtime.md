# 对手未命中后我方 PP 回滚：受控运行复现

2026-10-13，冻结代码 `2022d20d045404b757b99c908d0d7c22c3655bda`，Go3002/Vite4301（禁HMR），Chromium151.0.7922.34，390×844、DPR2模拟触控。业务代码无改动。**此目录为受控注入实玩，独立于上级的自然新档性能基线。**

## 结果

**缺陷已在真实 UI 确定复现。** 我方出招时飞翔 PP 由15降至14；对方攻击未命中后，画面回滚为15，当前回合检查点和刷新恢复也保存15。仅将对方攻击改为100%命中的对照样本，飞翔始终保持14。

| 样本 | 我方 DOM PP轨迹 | 回合结束存档 | 刷新恢复 | 对手行动 |
| --- | --- | --- | --- | --- |
| `miss-leftovers` | 15→14→15 | `playerTeam[0].selectedMoves[0].currentPp=15` | 15 | 撞击 accuracy=0，日志明确“攻击没有命中” |
| `hit-leftovers` | 15→14 | 同字段14 | 14 | 撞击 accuracy=100，日志明确造成4点伤害 |

两例我方飞翔均真实造成18点伤害（对方HP400→382）；对方PP35→34。miss样本我方HP300→325（剩饭），hit样本HP300→296→321（伤害后剩饭）。日志顺序均为我方出招→对方出招→回合末恢复，回合结束`phase=BATTLE/status=READY/turn=PLAYER`。此证据证明不是初始`currentPp`缺省或UI尚未落盘导致的误判。

我方已消耗的PP在对方miss之后回到旧值，行为与旧成员快照覆盖一致；**具体哪条赋值或快照引用造成覆盖，仍由architect静态定位**。没有从两例扩展到所有保护、免疫、失败或道具分支。

## 夹具、操作与证据

- 夹具来源：已入库商店`white-herb-self/injected-save.json.gz`。保留完整存档结构，受控修改为呆呆兽仅会飞翔（Go原始招式数据构造，accuracy改100）、速度500、HP300/400、剩饭；比比鸟仅会撞击、速度1、HP400。这不是自然合法招式池验收。
- 两例注入数据唯一有意差异是对方撞击accuracy0/100；没有覆盖Math.random，没有调用战斗内部函数直接推进。其他伤害、动画、剩饭和写盘均由真实游戏执行。
- 隔离来源`127.0.0.191:4301`和`.192:4301`，浏览器storageState仅在打开前放入夹具。打开战斗→点“战斗”→点“飞翔”→等完整日志和面板恢复→读完整存档→刷新→再读恢复状态。
- DOM MutationObserver只读取招式卡文案，记录15→14→15的实际显示轨迹，不修改游戏状态。原始轨迹在`miss-leftovers/result.json#uiTrace`。
- 每例保留`injected-save.json.gz`、`before-save.json.gz`、`after-save.json.gz`、`before.png`、`after.png`、`reload.png`及`result.json`。两张after截图已实际查看，与存档一致。
- 两例均0页面/console error、0 HTTP≥400，无DEV Win。脚本：根目录运行`node --import tsx docs/tasks/手机资源基线/pp-probe/run-pp-probe.mjs`。复验时应使用新证据目录，保留当前修复前证据。

结论：当前代码的该路径**失败**，可交同一战斗任务修复，再用两例验证PP不回滚。此轮没有改业务代码，没有提交。
