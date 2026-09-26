# TM24 毒菱手机浏览器验收

2026-09-26 主树提交 `a3e078e`，Playwright Chromium 手机模拟视口 `390×844`、`844×390`，独立来源 `127.0.0.187:4300` 建立正常 v13 新档、第 1 战 READY，再将该检查点复制到 `127.0.0.188:4300` 注入测试招式与队伍属性。未访问用户 `127.0.0.1` 标签或存档，未改游戏实现，未从奖励卡领取 TM。脚本 [run-toxic-spikes-browser.mjs](run-toxic-spikes-browser.mjs)，逐步页面文字、双方状态与布局数据 [results.json](evidence/toxic-spikes-final2/results.json)。

测试存档将双方前排招式设为“毒菱”，我方第一后备设一般属性、第二后备设毒属性；敌方第一后备设一般属性。敌方前排 1 HP 且招式均为毒菱，后备只使用无害“跃起”，使双方施放及入场效果可控。各动作均通过真实 UI 点击，未用 DEV Win。[竖屏可选招式](evidence/toxic-spikes-final2/fixture-ready-390.png)、[横屏可选招式](evidence/toxic-spikes-final2/fixture-ready-844.png)。

第 1、2 回合双方分别实际施放毒菱，存档场地由两侧 0→1→2 层。最初的横屏状态卡虽然存档和页面文字均为完整的“我方场地：毒菱 2 层”“对手场地：毒菱 2 层”，但视觉截图把名称截为“毒…”，**原样本横屏可读性未通过**。[最初横屏截图](evidence/toxic-spikes-final2/both-layer2-status-844.png)。刷新后两侧仍各 2 层，仍在第 1 战。[两层刷新](evidence/toxic-spikes-final2/both-layer2-reload.png)。

随后我方通过“撞击”击倒敌方前排，敌方一般属性后备入场后显示剧毒；我方换入一般属性后备也显示剧毒。稳定存档双方当前前排状态均为 `bad_poison`。[敌方入场](evidence/toxic-spikes-final2/enemy-next-poison.png)、[我方入场](evidence/toxic-spikes-final2/player-next-poison.png)。再通过 UI 换入毒属性后备，战斗日志显示其“吸收了毒菱！”，己方场地由 2 层归零，敌方场地仍为 2 层；刷新后状态保持 0/2，仍可继续战斗。[吸收](evidence/toxic-spikes-final2/player-poison-absorb.png)、[吸收后刷新](evidence/toxic-spikes-final2/absorb-reload.png)。完整样本未见浏览器异常或 HTTP 400 及以上响应。

证据边界：本次是从正常 READY 派生的测试存档，精灵属性、招式与敌方出招经过注入；证明战斗 UI 与引擎可执行相应分支，不证明 TM 获取或自然 AI 恰好选择毒菱。仅验收两层导致的剧毒及落地毒属性吸收，未覆盖一层导致普通中毒、飞行/悬浮/钢系免疫、第三次施放失败、实体手机触控。前两次尝试因随机敌方在吸收后立即再次撒毒菱、以及幽灵前排免疫普通攻击而无法完成单次证据链，已改为独立确定性最终样本，未将这两次脚本超时归为产品故障。

状态卡文字修复后，在主树 `7693a22` 用全新隔离来源 `127.0.0.193`→`.194` 重跑双方两层施放并等待面板完全出现。390×844 与 844×390 截图均完整显示两条名称及层数：[竖屏](evidence/toxic-spikes-layout-fixed3/both-layer2-status-390.png)、[横屏](evidence/toxic-spikes-layout-fixed3/both-layer2-status-844.png)。两视口 `scrollWidth` 分别等于 390 和 844，状态文字测得 `scrollWidth=clientWidth=128`、正常换行样式，未见裁切。横屏点“战斗”后招式卡重新出现且可读，[返回战斗](evidence/toxic-spikes-layout-fixed3/both-layer2-battle-844.png)。[复测状态与异常记录](evidence/toxic-spikes-layout-fixed3/results.json)无浏览器错误。本次只复测文字布局和返回操作，入场状态与吸收沿用上述修复前逻辑样本结论。
