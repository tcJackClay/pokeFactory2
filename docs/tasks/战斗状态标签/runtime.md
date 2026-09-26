# 战斗状态标签运行验收

2026-09-26 在提交 `969cdbe` 的本地开发服务上，用 Chrome 手机模拟浏览器、触摸模式和独立 `127.0.0.116`–`.123` 来源建立 v11 新档，通过正常 UI 选初遇伙伴、第 9 代租借、六选三和首战出招。未使用 DEV Win、未改游戏实现，也未访问用户 `127.0.0.1` 存档。八个租借池抽样均无页面异常、HTTP 400 及以上响应或 Vite 热更新；逐池招式与状态见[运行记录](evidence/status-results.json)。

| 实际战斗状态 | 中文 390×844、844×390 | 英文 390×844、844×390 |
| --- | --- | --- |
| `uproar` | `.123` 租借队首飘飘雏使用“吵闹”后，存档 `playerTeam[0].volatileStatuses.uproar.active=true`、招式 PP 9/10；HP 卡实际显示“**大闹**”，不露出原始 `uproar`。[竖屏](evidence/uproar-zh-390.png)、[横屏](evidence/uproar-zh-844.png) | 同版真实战斗快照只将语言字段设为 `en`，独立 `.130` 恢复后 HP 卡显示“**Uproar**”，两视口一致。[竖屏](evidence/uproar-en-390.png)、[横屏](evidence/uproar-en-844.png)、[状态](evidence/english-results.json) |
| `protect_chain` 与有效 `protect` | `.116` 凉脊龙实际使用“守住”后，内部同时存在 `protect_chain.counter=1` 与 `protect.active=true`；同版快照独立 `.132` 恢复，HP 卡显示“**守住**”，没有 `protect_chain`。[竖屏](evidence/protect-chain-zh-stable-390.png)、[横屏](evidence/protect-chain-zh-stable-844.png) | 独立 `.131` 英文恢复，HP 卡显示“**Protected**”，没有 `protect_chain`。[横屏](evidence/protect_chain-en-844.png) |
| 仅剩 `protect_chain` | 以 `.116` 的真实战斗检查点在隔离 `.133` 续打，第二次连续使用“守住”失败，存档 `protect_chain.counter=2`、`protect` 不存在；HP 卡不显示状态标签，也不显示原始 ID。[竖屏](evidence/chain-only-zh-390.png)、[横屏](evidence/chain-only-zh-844.png)、[回合状态](evidence/chain-only-results.json) | 该真实回合快照仅改语言字段后于独立 `.134` 恢复，两视口 HP 卡均无状态标签，页面文字没有 `protect_chain`。[横屏](evidence/chain-only-en-844.png)、[状态](evidence/chain-only-english-results.json) |

英文验收使用实际战斗产生的同版本存档快照，只修改 `settings.currentLanguage` 后在隔离来源启动；这验证了英文渲染与存档恢复，**没有通过设置页切换语言**。英文页面的战斗日志和属性角标仍有中文，这是同屏观察到的其他本地化范围，不能把本次状态标签通过结论扩展为全战斗英文已完成。实体手机及更多状态标签未在本轮验收。
