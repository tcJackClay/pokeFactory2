# 九种持有物：272f360 实玩尝试（暂停，非最终通过）

## 冻结与运行环境

- 精确代码 `272f360cf1adce528d2c17c8b9b260f32cea0c66`；开始与停止时 `git diff HEAD -- src backend scripts` 为空。
- 2026-10-14，本工作树 `D:\Games\pokeFactory2-worktrees\held-item-effects`。
- Go `3006`（session `88195`，工作树根 cwd）；Vite `0.0.0.0:4305`（session `47004`，`DISABLE_HMR=true`，转发真实 Go）。数据版本与健康响应在 `evidence/final-272f360/environment.json`。
- 隔离 Playwright Chromium，`390×844`、DPR2、touch；实际浏览器版本逐例写入 `result.json`。本次尚未扩到三视口，不是实体 Android / 生产验收。
- 无 DEV Win、无游戏时钟加速、无业务源码修改。浏览器 context 可并行，各自隔离存档；实际 UI 操作进入正常战斗循环。

## 已完成范围

截至停止，共 **24 份完整 result.json**：22 份检查通过（其中1份自然基线），2份针对同一终局日志缺陷的原始现场。它们只证明本表覆盖的入口，**不构成九道具任务验收通过**。其余批次尚未执行或已中断，不可补记 PASS。

| 例组 | 本次覆盖 |
| --- | --- |
| natural | 自然新档选伊布→基地→随机六选三→首战 READY；生成当前 schema 夹具来源，无随机控制。 |
| king-native-fail-item-pass-player/enemy | 两侧恶之波动真实 Go 正文→生产 builder，受控 native `.9` / item `.01` 独立 roll；明确道具日志、目标本轮不出招、下一轮改双失败后恢复行动、物品保留。 |
| focus-repeat-player/enemy | 同一持有者连续两次致命打击在受控 `.01` 下撑至1HP；当前道具和装备基准保留、两条真实挺住日志；未重载/重装。 |
| scope-player/enemy-lens/bare | 四例，同数值/roll `.1` 对照焦点镜有无，实际暴击/普通日志。 |
| claw-player-same/priority | 慢速爪同级先动；高优先级对手仍先动；各自一次出招/PP，无消费。 |
| white-player-superpower/tackle/swift | 自降及真实 contact 撞击王者盾牌消费，正等级保留；非接触高速星星不误耗。tackle例另刷新核消费与PP稳定。 |
| dice-player-four/five/single/fixed | 真正文乱抓4/5段、普通单发、二连踢固定2次；一次PP、物品保留，实际命中日志。 |
| mental-player-all/none | 受控并存六类限制及迷恋别名清除一次；无合格状态不耗。这是清除接线，不是六种自然施加验收。 |
| heal-block-natural-bare/herb | 真实 heal-block 正文施加：无草目标被封锁、Recover不回血不扣PP、回合末剩4；有草当动作清除消费，后手Recover正常回血且PP扣1。 |

普通招式原始精确响应字节、SHA256和生产 builder 输出在 `move-sources/`。没有手工添加 `makesContact` 或其它 battleData 字段。受控夹具从本次自然新档生成，使用当前 `createSaveData`；场景/数值/道具/能力/招式选择和 RNG 均属受控。数学概率与全部纯函数组合由静态审计证明，本次少量 UI 样本不估计 28% / 37%。

## 阻断：正常终局输出 StaleRoundError

最小复现：双方仅剩一只、均1HP；我方撞击PP0且速度快，经实际挣扎按钮命中敌方，反作用同时使我方倒下。正确结果为 LOSS / BP0。

1. 初次 `struggle-double-last-loss/` 正确显示失败页，但 console 捕获一次 `StaleRoundError`。初始脚本另把结果页恢复后的HP/PP错当战内数值，两条断言因此失败；这两条是测试观测时点错误，不能据此说伤害/PP实现错误。
2. `struggle-terminal-observation-2/` 增加只读 React viewModel 的 MutationObserver 轨迹；真实点击后结果页原地等待 **7秒**，期间不导航也不关闭浏览器。仍捕获同样错误。
3. `terminal-trace.json` 明确记录战内双方HP0、我方原招PP0、原槽不变，随后结果页/败退恢复。因此本次确认的是非预期控制台日志，**不是 A1 双倒胜负回归**。
4. 监听 `window.error` 和 `unhandledrejection` 没有对应事件；该堆栈来自 console error 捕获，独立 auditor 只读定位同样指向终局 epoch 更新后陈旧消息被外层 `console.error` 输出。浏览器仍停在结果页，排除关闭 context 才产生错误的解释。

核心原件：

- `evidence/final-272f360/struggle-terminal-observation-2/result.json`
- `evidence/final-272f360/struggle-terminal-observation-2/terminal-trace.json`
- `evidence/final-272f360/struggle-terminal-observation-2/result-immediate.json.gz`
- `evidence/final-272f360/struggle-terminal-observation-2/result-stable.json.gz`
- `evidence/final-272f360/struggle-terminal-observation-2/result-stable.png`

本次已运行场景没有 HTTP≥400；除上述两次相同 console 现场，其余完整结果没有 console/pageerror。尚未验证返回基地按钮，不把页面显示当按钮闭环。

## 停止与后续

orchestrator 判定需局部修复后重新冻结，player 随即停止扩大本版本验收。**2026-10-14 02:38:03 +08:00** 已确认无 `run-held-*` Node 脚本继续运行；只终止自身 items 批次 PID9292及核对过的子进程树，未结束其它工具/用户进程。服务保留HMR关闭，原件不覆盖。

待修复后的新 SHA 重新生成独立目录并执行任务完整清单。剩余 V1–V10 双侧/反例、挣扎备阵组合、厚底靴、封锁时限/恢复来源、下一战返还及三视口仍未验；此前已过样本不能直接改标新 SHA 通过。未提交任何本次证据，由 orchestrator 核清单后归档。
