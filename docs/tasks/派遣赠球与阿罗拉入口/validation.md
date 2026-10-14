# 静态验证记录

日期：2026-10-14。基线 `00f30d152596c185287f99b4be7227f93f581fe4`，工作树 `D:/Games/pokeFactory2-worktrees/dispatch-balls`。

同一最终业务内容串行运行：

| 门禁 | 结果 | 日志 |
| --- | --- | --- |
| npm run lint | PASS，tsc --noEmit | static/lint.txt |
| npm test | PASS，387/387，0 skip/cancel | static/test.txt |
| npm run build | PASS，8.59s | static/build.txt |
| go test ./... | PASS，4 包通过，server 无测试文件 | static/go.txt |

新增 16 项 dispatchBallTransactions 回调/事务测试；既有 371 项继续通过。故障注入日志为测试预期。主包 693.70 kB / gzip 209.94 kB，构建仍提示 >500 kB，未将其认定生产性能已通过。

本记录仅静态证据。未运行游戏；待独立 auditor，再由 player 在冻结提交上完成真实 Go+Vite 的受控与自然入口实玩。


## A1 / A2 修复门禁

原提交7c27209审计 BLOCKED 的两项入口问题已修复；本节不覆盖原始审计结论。
按 lint → test → build → go 串行执行，日志 `static-a1-a2/`：

| 门禁 | 结果 |
| --- | --- |
| npm run lint | PASS |
| npm test | PASS，396/396，0 skip/cancel |
| npm run build | PASS，7.72秒；主包695.43 kB/gzip210.52 kB；保留 >500 kB 提示 |
| go test ./... | PASS，4包通过，server无测试 |

新增9项实际回调契约测试，专项25/25；第一次专项执行修正了测试本身的规范化快照比较及钱包参数，最终四门禁均以上述日志为准。未运行游戏，待独立复审后在新冻结SHA实玩。
