# TM24 毒菱剩余边界手机浏览器补测

2026-09-26，主树 `7693a22`，隔离 Playwright Chromium `390×844`，从正常新档第 1 战 READY 复制测试存档。未访问用户 `127.0.0.1` 标签或存档，未修改游戏实现。脚本 [run-toxic-spikes-boundaries-browser.mjs](run-toxic-spikes-boundaries-browser.mjs) 与 [run-toxic-spikes-one-layer-browser.mjs](run-toxic-spikes-one-layer-browser.mjs)。

在 `.197` 样本中，我方前排经真实 UI 连续施放毒菱三次，敌方仅使用无害“跃起”。敌方场地前两次依次为 1、2 层；第三次日志明确“但是失败了！”，PP 18→17，但场地仍为 2 层。[第三次失败画面](evidence/toxic-spikes-boundaries/third-use-flying-third-use-failed-visible.png)。此后通过 UI 换入测试存档中设为飞行属性、无道具与特性的后备，未中毒，敌方场地仍 2 层；刷新后不变。[飞行入场](evidence/toxic-spikes-boundaries/third-use-flying-after-switch.png)、[刷新](evidence/toxic-spikes-boundaries/third-use-flying-after-switch-reload.png)、[完整状态](evidence/toxic-spikes-boundaries/results.json)。该样本无浏览器异常或 HTTP 400 及以上响应。

在 `.196` 样本中，双方前排第一回合各选毒菱，但敌方虽只有一招且 PP=1，稳定检查点出现我方场地 **2 层**、敌方场地 1 层。随后我方一般属性后备入场得到 `bad_poison`，刷新仍如此；因此该样本**不能**证明“一次敌方施放→一层→普通中毒”，还揭示敌方同回合重复行动疑点。[异常逐步状态](evidence/toxic-spikes-boundaries/results.json)。程序员已确认基线敌方回合缺少单次行动门禁；此项等待修复后重新按真实施放路径验收。

为了独立检查一层入场规则，在全新 `.199` 隔离测试存档中直接预置**我方场地 1 层**，敌方仅使用无害招式，再通过 UI 换入一般属性后备。该后备状态为 `poison`，非 `bad_poison`，刷新后保持；[一层入场](evidence/toxic-spikes-one-layer-fixture/one-layer-after-switch.png)、[刷新](evidence/toxic-spikes-one-layer-fixture/one-layer-after-switch-reload.png)、[状态记录](evidence/toxic-spikes-one-layer-fixture/results.json)。这证明一层检查点后的入场规则可以运行，但一层由测试存档注入，不能替代修复后敌方一次真实施放的验收。
