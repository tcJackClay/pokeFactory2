# 最终代码实玩：手机状态标识可读性

## 结论与环境

**PASS：V1–V4 指定模拟浏览器显示与操作范围。** 2026-10-14，对冻结提交 `ba5c0c286d588868b081aa15851e89941f790f2a` 完成 11 个最终自然/受控场景。最终证据只使用 `evidence/final-ba5c0c2-stable/manifest.json` 白名单；早期不稳定图、脚本断言失误、首次 502 尝试不抵扣通过项，见 `attempt-history.md`。

- 工作树 `D:/Games/pokeFactory2-worktrees/mobile-status-readability`，开始/结束 HEAD 均为 ba5c0c2；`git diff --name-only -- src backend` 为空。src tree `fdba3ea7cd3fc79b19038f1cf7490230cec4a75d`，backend tree `653145c29e68ff1c69697d95efd3f4214915af46`。
- 真实 Go 从工作树根 `PORT=3008 go run ./backend/cmd/server`，session14364；Vite4307，session15185，`GO_BACKEND_URL=http://127.0.0.1:3008`、`DISABLE_HMR=true`、host0.0.0.0。健康检查 `status=ok,runtime=go`。用户4300和其他任务服务未触碰。
- Playwright Chromium151.0.7922.34，`isMobile/hasTouch=true`、DPR2，320×568 / 390×844 / 844×390，独立 origin `http://127.0.0.204:4307`。浏览器批次均已结束，服务保留。不是实体 Android、侧边浏览器或生产环境。
- 数据是本树真实 Go API；环境文件保存精灵 report 与 factorySpeciesIndex SHA256。没有网络响应替换、RNG 固定或 DEV Win。全部操作通过 DOM tap/scroll；React view-model 仅只读，不调用 action/setter，不修改 DOM 伪造截图。
- 普通页面截图前等待 `document.fonts.ready`、页面/模态淡入及 2 秒稳定；实际攻击动画另在真实动画时捕捉。几何与文本是截图的补充，未以非空 mask URL 独自证明可见。

## 验证结果

| 项 | 最终案例 | 实际结果与证据边界 |
| --- | --- | --- |
| V1 | `v1-natural-eevee-final` | 空存储自然选择伊布133，实际事件选择伊布后返回基地，Settings 从简中切英语，再开始挑战、真实六选三、确认和训练家 Continue。基地/租借均0 BP、0/7、0连胜；真实首战1/7，三个视口均完整。最终租借为 Shellder/Rattata/Voltorb/Spearow/Ponyta/Gastly，选前三只，不固定抽取。 |
| V1/F3 | `v1-v3-zero-events-{zh-hans,zh-hant,en}-final` | 本版自然伊布存档经当前 createSaveData 重建，仅修改语言。三语×三视口顶部标签及0/0值完整：BP、轮次/輪次/Round、连胜/連勝/Streak。繁中没有 Settings 按钮，本次通过受控合法档设置，不能宣称繁中入口已完成。 |
| V2 | `v2-{zh-hans,zh-hant,en}-{999999,9007199254740991}-final` | 本次自然首战队伍保留，通过生产 createSaveData+parse 注入 wallet9999、stage7、streak、curChallengeBattleNum6、runSupply.lastCreditedStage6。三语×三尺寸显示9999 BP、7/7和完整连胜。六位数保持一行；最大安全整数在320/390换行、844完整，未缩写、省略或修改上限。39份顶部几何样本均无页面横溢出；标签≥11px、数字≥15px。不是自然七胜或实际赚取9999 BP。 |
| V2/F4 | 同上六个战斗场景 | 各尺寸滚到实际招式卡均可达，稳定图有完整PP和效果图标；844实际点击Status/变化/變化，等待data-active=true并只读确认STATUS，再点击Battle/战斗/戰鬥回到真实招式页。不是仅靠元素存在判断可操作。 |
| V3 | 三语零值事件场景 | 实际基地→Events，关都normal/water/grass图标均可辨。三语三尺寸实际打开/关闭选择器，伊布normal小圆标也可辨；两处normal前景均rgb(100,116,139)，原normal.png映射保持。摘要匹配1属性，未改地区资格或收藏。 |
| V4 | 自然租借/首战 + `v4-normal-animation` | 实际租借页normal/electric浅徽标为深currentColor，water/fire/ghost/poison深徽标为白currentColor；实际战斗招式徽标同样保留。动画场景重放同SHA早先自然首战档（来源文件与hash入清单），真实点击Strength：白色normal动画在深色战场可辨；PP15→14、敌HP116→108，完整回合继续至玩家可操作。无随机覆盖、无DEV Win。 |

每个最终目录含 `result.json`（动作、检查、请求/错误）、PNG、状态JSON.gz。受控场景保存完整 `input.json.gz`；状态快照提取相关wallet/phase/stage/队员/HP/PP等只读摘要，未复制无关整份招式正文。自然输入与动画自然来源单独保存。

## 错误记录与证明边界

- 最终11场景 **0 pageerror、0 console error、0 HTTP状态错误**。繁中零值事件记录了2个后台招式预取取消：`move/confusion/`、`move/thunder/` 的 `net::ERR_ABORTED`；页面伊布资料、选择器和操作成功。原记录保留；未定位取消的具体发起原因，不声称全部后台请求成功或弱网验收通过。
- 原简中事件预取dual-chop/rock-smash 502及首次自然Dratini502保留在尝试目录，重采最终同范围场景无502。没有改后端或拦截响应消除错误。
- 早期“PP裁剪”初报已撤回：只读几何无越界，未改变页面后稳定重复截图PP完整。此片未因此增加业务修复；具体暂态是字体、动画或浏览器绘制中的哪种原因未进一步隔离。
- 英文战斗原有Pokemon命令仍缩写为`POKEM...`；繁中部分专名/动态日志仍沿原fallback。本片只修顶部三指标与事件浅底normal，不能称全站文案/无障碍完成。
- 未验证实体Android触控/地址栏/后台恢复、生产/弱网、自然完整七胜、完整18属性每种消费方。代表徽标和一次普通属性攻击动画不等于全战斗效果验收。

## 已亲自打开的关键视觉证据

以下相对 `evidence/final-ba5c0c2-stable/`：

- `v1-natural-eevee-final/rental-en-390.png`：真实六只租借的深浅currentColor徽标。
- `v1-natural-eevee-final/first-battle-844.png`：实际首战1/7、横屏招式操作区。
- `v1-v3-zero-events-zh-hans-final/picker-320.png`：最终成员normal圆标可辨。
- `v1-v3-zero-events-zh-hant-final/base-320.png`：輪次/連勝字形。
- `v1-v3-zero-events-en-final/events-320.png`、`picker-844.png`：关都三图标和伊布normal浅底小圆标。
- `v2-zh-hans-9007199254740991-final/battle-320.png`、`v2-zh-hant-9007199254740991-final/battle-390.png`、`v2-zh-hant-999999-final/battle-844.png`、`v2-en-9007199254740991-final/battle-320.png`：完整大值、PP和关键按钮。
- `v4-normal-animation/02-normal-animation.png`：实际normal攻击动画；前后状态见01/03 JSON.gz。

## 重放与交接

同一冻结SHA与服务端口，运行 `node --import tsx docs/tasks/手机状态标识可读性/run-mobile.mjs`，再 `run-matrix.mjs` 与 `run-animation.mjs`。每场独立browser context；PF_CASES可指定场景。最终 `manifest.json` 和任务根 `commit-manifest.json` 含显式文件及SHA256，排除草稿/失败/未完成尝试。

本player未提交、未暂存、未改业务；由orchestrator核证据、明确路径入库和合入后再回填矩阵。
