# Player 采证历史（不计最终通过）

冻结业务提交始终为 `ba5c0c286d588868b081aa15851e89941f790f2a`。下列尝试保留本地，最终 manifest 另列有效场景；没有为任何尝试修改业务代码。

1. 首个 stage 7 夹具没有同步 `runSupply.lastCreditedStage=6`，生产 createSaveData 正确拒绝 `Factory run supply disagrees with battle progress`。补齐夹具后通过生产解析，不能把该拒绝称为产品缺陷。
2. 首批 `evidence/final-ba5c0c2/` 截图仅等两帧、未覆盖战斗 motion 稳定。在长值 320 图中四个 PP 与右侧效果图标暂时不可见，player 初报为挤压裁剪并暂停；独立只读几何却显示四个 PP 都在按钮内部，`v2-clip-diagnostic/result.json` 的 `ppClipped=false`。随后同页不修改 DOM/业务，等字体完成及 2 秒稳定，`v2-paint-diagnostic/02-stable-full.png`、`03-first-move.png`、再 1 秒的 `04-stable-repeat.png` 均完整可见。player 与 orchestrator 撤回产品阻断。原异常图 SHA256 `2921c511fb58749922f9418e71439ab1725865230f8382c4dbf16ad1f2567819` 原样保留；不以初图宣布稳定裁剪，也不把几何独自当视觉通过。
3. 初个攻击动画断言把未初始化 currentPp 的正常字段作 `undefined - 1`，得到 NaN；实际回合后 PP 为 14。harness 改用产品既有 `currentPp ?? maxPp ?? pp` 初值，最终实际 Strength 回合 15→14，通过，无产品改动。
4. 中断恢复后重新确认没有自身脚本存活，旧 3008/4307 已停止；从本树根重新启动真实服务。最终目录改用 `final-ba5c0c2-stable`，截图前 `document.fonts.ready` 与 2 秒页面稳定；实际攻击动画则故意捕捉动画帧，单独标明。
5. `final-ba5c0c2-stable/v1-natural-eevee` 首个自然样本里 pokemon/147 请求一次 502 后重试恢复，全部 UI 断言通过但保留 1 条控制台错误。另一次空存储自然样本 `v1-natural-eevee-final` 零 HTTP/console/pageerror，通过；两次随机租借不作相同随机数据比较。
6. 最终矩阵初轮简中事件样本中后台预取 move/dual-chop 与 move/rock-smash 返回 502，关页中止其重试。伊布及关都页面均实际正常；原请求日志保留，不删错误装作零错误。最终 runtime 将明确是否成功补验以及边界。
7. 新增 Status 导航检验曾在 tap 返回后立即读取到前一帧 MAIN；其 failure 截图已显示 STATUS 按钮选中及场地面板。最终脚本等待真实按钮 `data-active=true` 后再读状态，未调用 action 或 setter。重采场景使用 `-final` 后缀，失败原件不覆盖。

第 2 项的暂态没有进一步隔离为字体、motion 或浏览器绘制中的某一种根因；能证明的是等待后重复截图完整，且没有稳定几何裁剪。最终只读状态快照提取本任务相关状态摘要，完整输入档仍逐案例保存并经生产解析；避免反复复制整份 PokeAPI 正文。

这份历史说明只用于复现与校准，不是发布验收或全片 PASS。
