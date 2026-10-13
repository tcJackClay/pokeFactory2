# Orchestrator 方案评审

2026-10-14：plan/context 通过，实质打回0次，采用 Route A，由原 architect 实施。方案在 `codex/held-item-effects`，须先整合永久收藏最终验收版本再改业务代码。

保留批准边界：九件及既定价格；独立王者之证、气势头带不消费；必要挣扎与回复封锁完整链；真实固定源元数据，不用夹具补字段冒充自然正文。未知效果、接棒/祈愿等不足继续列明，不能宣称整池已通过。

后续共享文件按九道具→高速旋转→TM固定正文串行，实施、审计、实玩各自冻结候选代码。最终目标reviewer仍不在每个切片重复创建。

## 最终候选272f360的运行返修

player在挣扎双末只结算后原地停留7秒，无导航或关闭仍出现console.error StaleRoundError；只读轨迹确认双HP0→LOSS/BP0且轮次锁释放，没有window error/unhandledrejection。auditor静态追到resolveBattleResult先切ROUND_RESULT导致epoch改变，后续消息等待抛正常取消，外层catch误报。该版运行证据保留为返修前历史，不作最终通过。

2026-10-14 02:38:03 +08:00 player已确认所有自己浏览器批次停止，源码冻结解除，仅授权原实现者局部修复：外层catch过滤StaleRoundError，普通异常仍报错；保留内层结算失败、pendingSettlement、finally、epoch guard及全部账本流程。不得通过删epoch保护或提前显示结算消息掩盖问题。

验证须使用实际生产回调：正常结果切换使旧消息取消时仅结算一次且无错误日志，普通Error仍可见，存储失败仍保留待处理/错误状态。独立审计后冻结新SHA，player重跑最终验收，禁止沿用272截图作新版本证据。

### Programmer 执行回填

已按上述范围完成：业务只改 resolveBattleResult 外层 StaleRoundError 过滤；实际生产结算与消息回调的三组回归覆盖正常取消、普通异常与存储失败。串行 lint/test/build/Go 全通过，测试 371/371；构建原大包警告保留。待独立审计后重新冻结 player 候选；272 运行尝试不升级为通过。
