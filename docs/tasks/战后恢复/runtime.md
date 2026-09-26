# 战后恢复手机浏览器运行记录

2026-09-26 在 schema v12、主分支提交 `ef55156` 的本地开发服务，以 Chrome 390×844 手机模拟器和隔离 `127.0.0.151:4300` 新档通过正常 UI 进入第 1 战。[页面与存档快照](evidence/browser-results.json)。未访问用户 `127.0.0.1` 存档，也未改实现代码。

正常选择前三只租借并在首战实际使用一次“冰冻光束”。出招后画面显示 PP 从 10/10 到 9/10、玩家角金鱼受沙暴伤害后 HP 67/105，说明回合确实运行。[回合截图](evidence/failure.png)。该次样本前三只原配道具为 `leftovers`、`choice_band`、`scope_lens`，均非本轮可主动消耗的白色香草或心灵香草。样本中的战斗自动保存快照在截图时仍显示招式 PP 10/10 与旧 HP，说明截图与存档读取处于回合过渡窗口，不能据此判断恢复规则。

随后尝试用开发面板 `Win` 加速到结果页，但点击发生在回合尚未完成的过渡期；30 秒内未取得 `ROUND_RESULT`，浏览器无页面异常和 HTTP 400 及以上响应。该尝试不能作为结算失败证据。战后 HP、PP、异常状态、结果页与换怪页的消耗道具保持、下一战前返还、刷新恢复及横屏，本轮**未完成浏览器验收**；静态测试结果见 [实施记录](held-item-implementation.md)，不能替代实际试玩。后续需在新版本稳定后选出持有 `white_herb` 或 `mental_herb` 且能在实际回合触发消耗的样本，并等待回合完全结束再触发结算。

2026-09-26 v13 提交 `706444c` 的独立 `.157` 新档验证本局补给券。正常 UI 进入第 1 战 READY 后，存档 `runSupply.tickets=0,lastCreditedStage=0`；使用开发面板 `Win` 辅助结算后 `ROUND_RESULT` 为 `tickets=1,lastCreditedStage=1`，BP 仍为 0。结果页刷新、进入 `FACTORY_SWAP`、换怪页刷新，均维持 1 券；跳过交换进入第 2 战 READY 后仍为 1 券，没有重复入账。[状态序列](evidence/v13/ticket-results.json)、[刷新后结果页](evidence/v13/ticket-result-reload.png)、[第 2 战](evidence/v13/ticket-stage2-ready.png)。该胜利由 DEV Win 触发，未把它视为真实打赢一战的证据；本局券的持久化和继续流程由实际浏览器验证，未覆盖第二场胜利后的再次发券。无浏览器异常或 HTTP 400 及以上。

v13 另一次独立 `.155` 首战通过正常操作使用“大晴天”，画面 PP 从 5/5 变为 4/5；测试脚本在回合消息仍处理期间点击 DEV Win，未进入结果页，因此不能验证受伤或 PP 在战后的恢复。[过渡期状态](evidence/v13/browser-results.json)、[画面](evidence/v13/failure.png)。两次随机首战的前三只租借分别为 `leftovers`、`choice_band`、`scope_lens` 等非消耗道具，未自然获得并触发白色香草或心灵香草。本轮按限定结束，不将战后道具保持、下一战前返还及刷新标为通过。
