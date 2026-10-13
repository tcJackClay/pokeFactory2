# 技术方案: 奖励商店（历史第一阶段与当前 F4/F5/F6 收尾）

> architect 拥有。≤300 行。每条规则与验证断言必须追溯到 `prd.md`。
>
> 本任务把第 3、6 胜后的「四卡免费领」（merge `f6518c3`）改造成**真正的交换商店**：货架 6 件、稀有度三档定价扣券、兑换原子交易、组末券折算 BP、老四卡存档兼容。构建在四卡生成的检查点事务层（`FactoryRewardCheckpoint` / `commitFactoryReward*`）之上，属**扩展 + 改语义**，不推翻既有状态机骨架。
> 历史第一阶段 `a8ade80` 覆盖 PRD F1/F2/F3（限持有道具）/F5（限两香草文案）/F7；下方 §7 是本次要完成的 F4、F5 进化说明、F6 与最终代码回归。两阶段合起来接受本任务全部 AC，旧浏览器证据不可代替最终代码实玩。

---

## 1. 改动面

| 文件 / 函数 | 当前职责 | 本任务改动 |
| --- | --- | --- |
| `src/features/game/config/factoryRewards.ts` | `FACTORY_REWARD_CONFIG.freeRewardChoiceCount: 4`、触发点、BP | `freeRewardChoiceCount` → `shelfSize: 6`（+`getFactoryShelfSize()`）；新增 `FactoryShopRarityTier`、`FACTORY_SHOP_RARITY_PRICES = {1:1, 2:2, 3:3}`、`FACTORY_TICKETS_TO_BP_RATE = 1`、`getFactoryShopRarityPrice()` |
| `src/features/game/config/factoryRewardPool.ts` | 七件候选名单、四卡枚举/抽样、适用性判定 | 名单扩到 **9 件**（+`white_herb`、`mental_herb`；仍排除 `bright_powder`）；新增 `FACTORY_HELD_ITEM_SHOP_RARITY` 档位表、`getFactoryHeldItemShopPrice()`、`FactoryShopProductKind`/`FactoryShopHeldItemProduct`/`FactoryShopProduct` 类型（为进化道具留口）；`drawFactoryRewardCards` → `drawFactoryShopShelf`（返回 `shelf`）；`getRewardApplicability` 扩展两香草 → `CONDITIONAL` |
| `src/features/game/config/factoryRewardPool.test.ts` | 四卡穷举测试 | 重写：shelfSize/费率常量、9 件名单、档位表、84 组三人组合全枚举（恒 6 件互异）、香草 CONDITIONAL 判定 |
| `src/services/saveManager.ts` | 检查点事务层（四卡 PENDING/READY/CLAIMED、`cardItemIds`、`claim`） | `FactoryRewardCheckpoint` 改语义：`READY { shelf, purchases }`、`CLAIMED { shelf, purchases, continueRequested? }`；新增 `FactoryShopPurchase { itemId, targetIndex, ticketsSpent }`；新增 `sanitizeFactoryRewardCheckpoint` / `isLegacyFourCardRewardCheckpoint` / `resolveRewardKeepIndices`；`FactoryWallet.lastSettlement` 增 `ticketBp`；`commitFactoryGroupSettlement` 组末折算（`ticketBp = (tickets + 1) × RATE`，钳 `MAX_FACTORY_BP`，折算后券清零；败退仍走 `createEmptyRunSupply` 不折算）；`commitFactoryItemRewardClaim` → `commitFactoryShopPurchase`（原子扣券+装备+追加 purchases，同参数幂等，券不足抛错不写盘）；`commitFactoryRewardContinueIntent` 放宽接受 READY/CLAIMED |
| `src/services/saveManager.test.ts` | 四卡检查点用例 | 夹具与断言全面适配新格式；新增 legacy READY/CLAIMED 迁移、组末折算+上限+败退三个用例 |
| `src/features/game/hooks/usePokeFactoryGame.ts` | 奖励接线 | `drawFactoryShopShelf` 配货；`claimFactoryItemReward` → `purchaseFactoryShopItem`（`rewardClaimInFlightRef` 同步门闩防连点，`syncRunSupply` 同步券余额）；`continueAfterFactoryReward` 接受 READY/CLAIMED |
| `src/features/game/hooks/useRewardFlow.ts` | 旧奖池（不再被 REWARD 路由使用） | `getFactoryRewardChoiceCount` → `getFactoryShelfSize`（引用对齐） |
| `src/features/game/view-model/actions.ts` | 动作契约 | `claimFactoryItemReward` → `purchaseFactoryShopItem` |
| `src/features/game/components/game-view/reward/FactoryItemRewardScreen.tsx` | 四卡屏 | 重写为商店：券余额（`shop-ticket-balance`）、6 商品卡（`shop-product`：图标/名称/价格/功能说明/适用性说明/`shop-redeem-button`/已购标记）、券不足 disabled+grayscale+line-through、队员选择→`确认兑换`面板、`shop-leave-button`、关闭页列出逐笔兑换 |
| `src/features/game/components/game-view/reward/FactoryItemRewardScreen.test.ts` | 四卡 SSR 测试 | 重写为 13 用例：PENDING/READY/CLAIMED、券不足、已购、商品诚实（香草/厚底靴/机变骰子）、破图兜底 |

**与既有代码的关系**：**替换**（四卡语义 → 商店语义）+ **新增**（券经济）。`restoreFactoryParty`、`useBattleController`、敌方 `heldItemPool`、`rewardPools.ts` 旧奖池、技能机、进化道具**均不改**。

---

## 2. 数据流与状态机

### 2.1 券经济（PRD §2.5 / F7）

```
每胜 +1 券（既有 commitFactoryGroupSettlement 攒券路径，不改）
  ↓ 组内第 3、6 胜后
商店（READY）：purchase 扣券（价格 = 档位表）→ 装备改写（同一落盘原子）
  ↓ 组末第 7 胜结算
ticketBp = (runSupply.tickets + 1) × FACTORY_TICKETS_TO_BP_RATE   // 第 7 胜刚攒到的 1 券计入
amount = min(组奖励 nominalBp + ticketBp, MAX_FACTORY_BP − balance)  // 先加折算、再钳位
runSupply.tickets → 0（下一组从 0 重攒）；lastSettlement.ticketBp 可区分折算来源
  ↓ 中途败退（LOSS）
createEmptyRunSupply()：券清零、ticketBp=0、amount=0（既有行为保持不变）
```

### 2.2 商店状态机（四卡状态机的语义扩展）

```
FACTORY_SWAP(胜第3/6战) ── commitFactoryRewardPending ──→ REWARD / PENDING（持久化点①）
REWARD / PENDING ── drawFactoryShopShelf(候选9−基准3, 6) ──→ commitFactoryRewardReady(shelf) ──→ READY（持久化点②）
   · 候选不足 6 件 ⇒ 抛错留在 PENDING（缺陷态，不补位、不重复、不少给）
   · 写入失败 ⇒ 留在 PENDING 可重试
REWARD / READY（可循环）── commitFactoryShopPurchase(itemId, targetIndex)（持久化点③）
   · 单次落盘原子：扣券 + factoryEquippedHeldItemId/HeldItemId 改写 + purchases 追加
   · 同 (itemId, targetIndex) 二次调用幂等返回（双击/连点只扣一次券）
   · 同件换目标 / 券不足 / 目标不合法 ⇒ 抛错不写盘，留 READY 可重试
   · 旧装备不进背包；基准改写 ⇒ 旧物立即回池；三人基准互异不变量保持
REWARD / READY ── commitFactoryRewardContinueIntent ──→ CLAIMED（持久化点④，幂等）
REWARD / CLAIMED ──「继续挑战」──→ nextFactoryStage() → 第 4/7 战（检查点随起战清除）
```

### 2.3 配货算法（PRD F2）

1. `E` = 三名队员的 `factoryEquippedHeldItemId`（**只读返还基准**，不读 `factoryHeldItemId`）。
2. `候选 = 9 件持有道具名单 \ E` ⇒ `|候选| = 6` 恒成立（全枚举 84 组三人组合验证）。
3. `drawFactoryShopShelf`：不放回等权抽 6 件（局部 Fisher-Yates，`random` 注入可确定性测试）。
4. 每件断言有合法装备对象；不足 6 件抛错（缺陷态）。
5. 货架 `READY` 落盘即冻结：刷新/重进/同版导入逐件不变（含价格与顺序）。

### 2.4 存档兼容（PRD 非功能 2）

- `isLegacyFourCardRewardCheckpoint`：有 `cardItemIds`（READY/CLAIMED）或纯 PENDING 无新字段 ⇒ 旧格式。
- `sanitizeFactoryRewardCheckpoint`：**旧格式优先识别**，一律迁移为 `PENDING`（重新配货；旧档无 purchases/扣券，迁移不构成重复给）；新格式结构完整则原样保留（冻结不重抽）。
- 旧 CLAIMED 的 `claim.targetIndex` 在迁移**前**经 `resolveRewardKeepIndices` 参与保位（沿用四卡领取语义，避免迁移丢装备）。
- `ticketBp` 走 `sanitizeSafeNonNegativeInt` 安全默认 0。

---

## 3. 状态契约

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `runSupply.tickets` | `number` | 玩家当前券余额；每胜 +1；兑换扣减；组末折算后清零；**恒 ≥ 0** |
| `battleResume.rewardCheckpoint.status` | `'PENDING' \| 'READY' \| 'CLAIMED'` | READY=商店营业（可多次购买）；CLAIMED=已离开（关闭页） |
| `battleResume.rewardCheckpoint.shelf` | `FactoryShopProduct[]`（`{kind:'HELD_ITEM', itemId}`） | 冻结货架：恰好 6 件、互不重复、每件有合法装备对象 |
| `battleResume.rewardCheckpoint.purchases` | `FactoryShopPurchase[]` | 已兑记录（逐笔：`itemId`/`targetIndex`/`ticketsSpent`）；同一 itemId 只出现一次 |
| `battleResume.rewardCheckpoint.cardItemIds` / `claim` | 旧四卡字段 | 读入时识别为 legacy → 迁移 PENDING；新格式恒无这两个字段 |
| `wallet.lastSettlement.ticketBp` | `number` | 本次结算中来自券折算的 BP（可区分来源，验收 AC-10 断言消费） |
| `wallet.lastSettlement.{nominalBp, amount, result}` | `number/number/'WIN'\|'LOSS'` | 组奖励基数 / 实入账（含折算并钳位）/ 结果 |
| `viewModel.supplyTickets` | `number` | 券余额 UI 镜像；购买成功后 `syncRunSupply` 同步 |
| `shop-product[data-state]` | `'available' \| 'insufficient' \| 'no-target' \| 'purchased'` | 商品卡状态（AC-2 视觉判定的 DOM 观测点） |
| `shop-ticket-balance` / `shop-redeem-button` / `shop-leave-button` | testid | 商店 UI 的浏览器断言锚点 |

---

## 4. 验证计划

> 证据根为 `docs/tasks/奖励商店/evidence/`；静态门禁输出写入 `log.md`。
> 纯逻辑走 `npm test`；浏览器断言在 390×844 与 844×390 手机模拟视口执行（`run-reward-shop-browser.mjs` + `shop-harness.mjs`，夹具由 `probe-shop-fixtures.mjs` 从四卡基档派生）。

| 断言（来自 prd.md） | 验证方式 | 文件路径 | 证据类型 |
| --- | --- | --- | --- |
| **AC-1** 第 3、6 胜后是商店：6 件商品、每件价格、券余额、「兑换」按钮 | 运行：受控 PENDING 存档注入 → 自动配货 → READY；断言 6 件、互异、价格=档位表、券余额可见、兑换按钮、功能说明；双视口截图。真实入口链路（第 3 胜 → 换怪跳过 → 商店）另跑一遍 | `evidence/shop-ready-t2/`、`evidence/full-flow-purchase/` | 状态快照 + 截图 |
| **AC-2** 券够可兑、券不够点不动 | 运行：t2 存档（讲究头带 3 券 > 余额 2）断言 disabled+grayscale+line-through+「券不足」，其余可点；t0 存档（余额 0）全货架点不动；双视口截图对比 | `evidence/shop-ready-t2/`、`evidence/shop-no-tickets/` | 状态快照 + 截图 |
| **AC-3** 扣券恰好按档位、不重复扣（双击/连点/刷新/导入） | 运行：t3 存档买 白色香草(1)+焦点镜(2) ⇒ 余额恰 0；purchases 逐笔 `{ticketsSpent}` 精确；确认按钮 DOM 级连点 8 次 + 真实双触控 ⇒ purchases 严格增长计数器=1、券只扣一次；兑换后刷新与同版存档冷重开 ⇒ 已购保留、券不重复扣、货架逐件不变。静态：`commitFactoryShopPurchase` 幂等/抛错路径单测 | `evidence/full-flow-purchase/`、`evidence/rapid-click-purchase/`、`evidence/double-tap-purchase/`、`evidence/refresh-import-purchase/` | 状态快照 + 截图 |
| **AC-4** 一次可买多件；可一件不买离开；离开后战次推进 | 运行：连买两件后关闭页列出两笔 → 继续挑战 → phase=BATTLE stage=4；离开不重新配货（货架同前） | `evidence/full-flow-purchase/` | 状态快照 + 截图 |
| **AC-5** 货架恰好 6 件互异；刷新/重进/导入逐件不变 | 运行：READY 后 reload 与同版存档冷重开，逐件（含顺序）比对 shelf；84 组三人组合候选全枚举单测恒 6 | `evidence/shelf-freeze/` + `npm test`（factoryRewardPool.test.ts） | 状态快照 |
| **AC-10** 七战全胜 BP = 组奖励 + 券×1:1，受 9999 约束；折算后券 0 | 运行：stage7 存档（券 6）真实取胜 ⇒ `lastSettlement {nominalBp:3, ticketBp:7, amount:10}`、余额 10、券 0；cap 存档（余额 9995）⇒ amount=4 钳到 9999。静态：折算、上限、幂等重放、败退单测 | `evidence/settle-7win-ticket-bp/`、`evidence/settle-9999-cap/` | 状态快照 + 截图 |
| **AC-11** 中途败退券清零不折算 | 运行：stage3 战斗中真实「逃跑→确认」认输 ⇒ `lastSettlement {result:LOSS, ticketBp:0, amount:0}`、余额不变、券 0。静态：LOSS 单测 | `evidence/mid-run-loss/` | 状态快照 + 截图 |
| **AC-13** 老四卡存档读入不崩溃 | 运行：legacy READY（cardItemIds 4 件）与 legacy CLAIMED（含 claim）注入 ⇒ 不崩溃、迁移 PENDING→重新配货 READY 6 件、无 cardItemIds 残留、无「不兼容」屏。静态：迁移单测 | `evidence/legacy-ready-import/`、`evidence/legacy-claimed-import/` | 状态快照 + 截图 |
| **AC-14** 门禁全绿 | `npm run lint && npm test && npm run build && go test ./...`（既有 2 项 Windows 符号链接失败如实记录） | `log.md` | 人工判断（门禁输出） |
| F3 原子性/可恢复（补充） | 运行：failNextWrite 注入配货写入 ⇒ 留 PENDING 如实报错可重试；注入兑换写入 ⇒ 不扣券不装备报错可重试 | `evidence/failure-semantics-shop/` | 状态快照 |
| F5 香草说明诚实（AC-12 前置） | 运行：两香草卡面含「条件性」说明。静态：SSR 测试 + `getRewardApplicability` 单测（CONDITIONAL） | `evidence/shop-ready-t2/` + `npm test` | 状态快照 + 截图 |

---

## 5. 不可自动验证的断言

- **「券不足的视觉区分玩家能感知」**：DOM 断言只能证明 disabled/grayscale/line-through 生效；可感知性靠双视口截图人工判读。
- **「下一组从 0 重攒」的完整体验**：需连打 7+ 场跨组验证，浏览器轮成本过高；兜底 = `commitFactoryGroupSettlement` 单测（第二组结算 ticketBp 恒以本组攒券计算、折算后 tickets=0 再从第 1 胜 +1）。

占比 < 30%，PRD 断言写法可保持。

---

## 6. 风险与隐含决策

> orchestrator 必须在 programmer 开始前逐条批准。

1. **第 7 胜的折算时序**：`ticketBp = (currentSupply.tickets + 1) × RATE`——第 7 胜的 +1 券在结算里**先攒到再折算**（一组最多折 7 券）。依据 decisions.md 第一节「组末结算时剩余券」+ 既有攒券实现「每胜 +1 于结算时入账」，二者语义一致；但「+1 是否计入本组」是隐含决策，需批准。
2. **幂等重放的 ticketBp 回读**：同一 (runId, stage) 结算重放时从 `lastSettlement` 回读 `ticketBp`，避免重复加算——重放不改存档，只是返回值可区分来源。需批准。
3. **旧 CLAIMED 迁移后的保位来源**：`resolveRewardKeepIndices` 必须读**迁移前**的 `source.rewardCheckpoint`（旧 claim.targetIndex），迁移成 PENDING 后该信息消失。隐含决策：旧档已领的那件**不**因迁移而回池重复出现（配货读的是当前基准，旧 claim 件已在队员身上）。需批准。
4. **legacy 识别优先级**：`sanitizeFactoryRewardCheckpoint` 必须先识别 legacy 再走 `hasValid`，否则旧 CLAIMED 会被新格式校验误保留。测试锁定。
5. **购买后检查点停留 READY**（不进 CLAIMED）：CLAIMED 语义改为「玩家离开商店」（continueRequested），购买本身不关店——这是 AC-4「一次可买多件」的落点。需批准。
6. **关闭页文案口径**：零购买时提示「券保留到组末结算（1 券 = 1 BP）」——把折算规则对玩家明示。自选文案，需批准。
7. **价格/名单的唯一数值源**：`FACTORY_SHOP_RARITY_PRICES` / `FACTORY_HELD_ITEM_SHOP_RARITY` 是唯一源；UI 与验收脚本的表值从配置读（脚本侧硬编码表需与单测对齐锁定）。
8. **`go test` 既有 2 项失败**（`backend/cmd/sync`、`backend/internal/content` 的符号链接清理检查）：Windows 权限问题、与本任务无关，按任务书如实记录。

---

## 7. 第二阶段边界与现状（接续第一阶段，不重写其契约）

第二阶段只补 `prd.md` F4、F5 的进化说明、F6，以及 AC-6/7/8/9/12 与 AC-14 的最终代码验证。F1–F3/F7 在第一阶段已有实现，但第二阶段修改了商品联合类型与检查点校验，最终仍须回归 AC-1–5/10/11/13。第一阶段的 14 个浏览器结果只证明 `a8ade80` 附近的旧代码，不能作为第二阶段最终提交的运行证据。

截至本方案撰写时，工作树已有**未提交 WIP**：`factoryEvolutionItems.ts` 定义 39 件道具、价格与图标兜底；`pokeApi.ts` 扩展进化链读取及物种变换；`factoryEvolutionShop.ts` 聚合可用目标；`factoryRewardPool.ts` 扩展商品联合类型；`saveManager.ts` 增进化购买事务；`resolveWhiteHerb.ts` 与其单测及 `useBattleController.ts` 增白色香草响应。这些只是待评审代码，未完成接线、静态门禁或实玩。`usePokeFactoryGame.ts` 配货仍只传三人持有物，`FactoryItemRewardScreen.tsx` 与 `view-model/actions.ts` 仍只认持有物，所以进化商品目前无法从真实 UI 上架或兑换。

### 7.1 改动面与数据流

| PRD 依据 | 文件 / 函数 | 必须完成的接线或校核 |
| --- | --- | --- |
| F4.1、F2.1–4、§7 数据失败降级 | 固定 Rogue 关系数据、`factoryEvolutionShop.buildFactoryEvolutionShopProducts`、`usePokeFactoryGame` 的 PENDING→READY effect | 用当前三名队员的物种、形态与性别从**固定关系数据**筛可用关系，再向 PokeAPI 取目标资源，聚合成 `EVOLUTION_ITEM` 商品，并与 `9−3` 件持有物候选等权不放回抽 6 件；只有完整有效关系可上架。目标资源失败记录具体降级原因，保留持有物保底；货架写入失败保持 PENDING 可重试。`READY` 以后只读冻结货架，不再网络取数或重抽。旧 WIP 的 `fetchPokemonEvolutionOptions` 不得继续作为关系枚举入口。 |
| F4.1、F4.2、§2.6 | `factoryEvolutionItems.ts`、新增固定关系数据模块、`docs/tasks/_gen_evolution_appendix.py`、`pokeApi.ts`、`docs/tasks/扩池规则/evolution-items.generated.md` | **固定 Rogue expansion 源码生成的 39 种／94 条静态映射是唯一可上架关系真相源**，包含 `EVO_ITEM`、`EVO_ITEM_MALE`、`EVO_ITEM_FEMALE` 的性别条件与连接线；王者之证两条进化显式排除。与中文附录同一生成器/输入，测试核对 39/94 的完整键集合。PokeAPI 只取目标物种资料、形态资源与名称，**不得**用其 `evolution_details` 单方面删增 Rogue 关系。按队员 `speciesId` + `pokeApiName`/`formLedgerSlug` + 性别筛选；形态或目标资源无法明确匹配时不上架，记录具体阻断项。 |
| F4.2–5、F3.1–6 | `usePokeFactoryGame`、`view-model/actions.ts`、`saveManager.commitFactoryEvolutionPurchase` | UI 发起后按冻结的 `(itemId, targetIndex, fromSpeciesId, toSpeciesId)` 选定目标；异步取进化后物种数据、按原队员构造完整队伍，最后**一次**提交扣券＋进化＋purchases。同步在途门闩防连点；同参重放幂等，目标已变化／券不足／写盘失败均保持原档与 READY。成功后同步 React 队伍、券余额、检查点。不得把进化道具放入背包或持有物槽。 |
| F4.2、F5.3、F1.2/8、AC-7/8/12 | `FactoryItemRewardScreen.tsx` 及 SSR 测试 | 两类商品分别渲染：进化道具的名称、图标兜底、3 券价格和具体「当前队员 → 目标形态」说明；若多队员可用先选队员，若同队员多目标再选目标；确认前显示前后形态。已购、余额不足、因本店前一笔进化而失效均不可点，并有不同于“券不足”的诚实状态。持有物购买路径与旧物替换仍可用。 |
| F4.3–4、AC-8 | `pokeApi.buildEvolvedFactoryPokemon`、`factoryEvolutionRules.ts`、`restoreFactoryParty.ts`、跨组流程 | 只更新物种身份和由新物种基础值重算的能力，不调用随机四招的 `getProcessedPokemon`；保留队员身份、等级、IV/EV、性格、性别、四招及顺序、三项持有物字段。PRD 还要求异色不重置，须先查明其在当前数据模型中的真实可观测字段（目前 `GamePokemon` 未见显式异色字段），有字段才纳入断言；无字段须报告“不适用／未验证”，不能假称保留。存盘前 `assertFactoryEvolutionPreserved` 校验；下一战准备、七战组末、下一组租借状态、导入导出后同一队员仍为进化形态。若当前流程重建队伍时按租借原物种覆盖，须沿该唯一续接路径修复。 |
| F6、AC-9、F5.2 | `battle/engine/resolveWhiteHerb.ts`、`useBattleController.ts`、`data/battle/itemEffects.ts`、对应测试 | 按现行 PRD 与本地参考实现：**无论对手或自身造成**，持有者任一负能力等级出现时，将所有负值复原至 0，正值不动；只有实际复原才消耗**本战当前**香草并显示日志。跨战由返还基准恢复。玩家与敌方两侧均检查，异步回合与二次触发不得多次消耗。商品说明继续标成条件性。现有 WIP 只看负值的方向与规则一致，但触发时机和真实回合仍需验证。 |

### 7.2 第二阶段状态契约（每项被下方验收消费）

| 可观测字段 | 契约 | 验收消费 |
| --- | --- | --- |
| `rewardCheckpoint.shelf[]` 的 `kind/itemId/targets[]` | 6 件互异；进化件有完整 `(targetIndex, fromSpeciesId, toSpeciesId, toPokeApiName, toNameZh, toNameEn)`；READY 后冻结 | AC-7/12、回归 AC-5 |
| `rewardCheckpoint.purchases[]` 的 `kind/itemId/targetIndex/fromSpeciesId/toSpeciesId/ticketsSpent` | 每件最多一笔；进化件价格 3；交易成功才追加 | AC-8、回归 AC-3 |
| `runSupply.tickets` | 失败时不变，成功时减正确价格，余额不负 | AC-8、回归 AC-3 |
| `battleResume.playerTeam[targetIndex]` 的 `speciesId/pokeApiName/selectedMoves/factoryEquippedHeldItemId/factoryHeldItemId` 与等级/IV/EV/性格/性别 | 同一队员按冻结目标进化，保留契约字段；其余队员逐字段不变 | AC-8、跨组/存档往返 |
| 固定关系数据的 `itemId/fromSlug/toSlug/gender`、生成脚本的 39/94 断言、`buildFactoryEvolutionShopProducts` 的 `products/degraded[]` | 39 件/94 条是确定性源；按队员形态与性别筛出可用关系。资源失败逐条在 `degraded[]` 留 `targetIndex/relation/reason`；王者之证排除由生成脚本和映射测试审计，**不**存在运行时 `ignored` 字段，队伍当前用不上的关系无需作为失败上报 | AC-7 与数据覆盖审计 |
| 战斗状态 `statStages`、`factoryHeldItemId`、战斗日志 | 实际负等级归零，本战香草被消耗且日志恰一次；下一战基准返还 | AC-9 |
| 商店 DOM 的 `shop-product[data-state]`、进化目标/确认控件及说明 | 有足额券且仍有合法目标才可买；失效、已购、券不足分别可见；前后形态说明具体 | AC-7/8/12 |

### 7.3 验证计划（第二阶段提交之后才运行；player 拥有运行证据）

| PRD 断言 | 验证方式与边界 | 文件路径 / 证据类型 |
| --- | --- | --- |
| AC-7、F4.1、F2.2：有用才上架；6 件互异 | **39/94 全量逐项数据覆盖门禁**：固定 Rogue 源码、生成附录与运行时数据模块三方键集合一致；核对 item/from/to/形态/性别，并逐条证明目标物种资源可解析。缺项列明并阻断“进化类已完成”。代表例含伊布多石、觉醒之石雌雄限定、连接线、地区形态及王者之证排除。注入含可进化队员的 PENDING 存档，经真实 UI 配货检查候选/货架/冻结；无匹配队伍与资源失败反例检查降级原因。等权抽样通过注入随机源验证每候选可入架。 | 全量映射校验脚本/结果、`factoryEvolutionItems.test.ts`、`factoryEvolutionShop.test.ts`、`factoryRewardPool.test.ts`；`evidence/evolution-shelf-*/result.json` 状态快照、双视口截图 |
| AC-8、F4.2–5：单次进化完整交易 | 浏览器在受控可进化队伍中用真实按钮选队员/目标并确认，前后存档逐项比较四招顺序、属性、持有物、其余队员、券与 purchases；再刷新、导出导入、起下一战及跨组检查形态。多队员／同队员多目标分别操作；双击与失败写盘后重试检查幂等和原子性。 | `saveManager.test.ts`、`factoryEvolutionRules.test.ts`、`pokeApi` 变换测试；`evidence/evolution-purchase-*/result.json` 状态快照＋截图；`runtime.md` 记录自然/受控与 DEV Win 辅助 |
| AC-9、F6：白色香草真实触发 | 纯函数测试全部 7 项能力等级、正负混合、无负值不消耗；战斗控制器分别测试**对手降级**与**自身招式自降**均触发、玩家/敌方对称、日志一次；player 至少用一种受控降级招式通过真实 UI 执行一回合，记录降级→归零→香草消失，下一战返还。 | `resolveWhiteHerb.test.ts`、相关战斗测试；`evidence/white-herb-battle/result.json` 状态快照＋截图/日志 |
| AC-12、F5：文案具体且诚实 | SSR 与浏览器核对香草条件性、进化道具显示每个有效队员及前后形态；无图标道具无破图；购买别件使目标失效后不再声称可用。 | `FactoryItemRewardScreen.test.ts`；`evidence/evolution-shelf-*/` 双视口截图＋人工判读 |
| AC-6 与 AC-1–5/10/11/13 回归 | 在**最终代码**重跑持有物替换、旧物不入背包、六件冻结/多买/离开、组末 BP 折算和旧档迁移；不得复用第一阶段截图。 | `run-reward-shop-browser.mjs` 或扩展脚本；`evidence/final-regression-*/result.json`＋截图，`runtime.md` 标明代码 SHA |
| AC-14 | 最终代码运行 `npm run lint`、`npm test`、`npm run build`、`go test ./...`；Windows 符号链接两项若仍失败，记录测试名与环境，不写「全绿」。 | `log.md` 命令/结果与失败详情；静态证据 |

### 7.4 编码前必须由 orchestrator 评审的风险与解释

1. **固定关系与 PokeAPI 分工**：现行 PRD 为 39 件／94 条，以固定 Rogue 源码为准。现有 WIP 直接从 PokeAPI `evolution_details` 枚举候选，可能漏 Rogue 关系或加入 Rogue 没有的关系；必须换成固定关系模块，PokeAPI 仅供物种资料与资源。全量覆盖报告须列每条 `item/from/to/形态/性别`，运行时资源缺失列具体阻断项、安全降级，不能以 39 个道具 ID 推断 94 条可用。
2. **白色香草的最终触发边界**：设计已核对本地 expansion `RestoreWhiteHerbStats`，现行 PRD 同步定为任一负能力等级触发（对手与自身均可）。WIP 的负值判断方向正确，但 controller 触发位置只在次要效果之后；须验证自身招式下降等其他事件路径不会遗漏，且战斗日志、消费和下一战返还恰好一次。
3. **检查点购买历史与连续进化**：现有 `hasValidFactoryRewardCheckpoint` 要求每条已购效果仍直接落在最终队伍上。若同一名队员先后进化两次、或买持有物后又换装，早期 purchase 记录在当前队伍上会“失效”，可能导致存档被拒。PRD F4 一次购买只进化一步，F1/F3 允许多次购买；需要校验**交易序列**或仅检查最后状态，保留历史幂等性，不可通过禁止合法购买规避。
4. **目标身份与原子边界**：WIP 用 `targetIndex/fromSpeciesId/toSpeciesId` 防误兑，但跨店刷新/导入和异步取数期间队伍可能改变；提交前须重读检查点并核对队员稳定身份、货架及余额，网络请求不应扣券或改内存。成功落盘后若 React 同步失败，恢复必须以存档为准。
5. **异色字段可观测性**：PRD F4.3 要求异色保留，当前 `GamePokemon` 未见显式异色状态，WIP 保留断言也没有对应项。实现前核查是否经其他字段记录；若不存在，AC-8 中这条只能标记不适用／未验证，由 orchestrator 记录产品数据缺口，不得以“其余字段保留”替代证明。

### 7.5 最终实玩发现的羽毛舞缺陷：限定修复方案（已批准）

**依据与现象。** PRD F6 要求能力等级真的降至 0 以下时白色香草才复原、消耗；AC-9 要在浏览器里看见一次完整触发。Player 对 `604232f` 的最终实玩中，原始羽毛舞使用后没有先发生攻击下降，因而香草不触发；冰冻之风和自身蛮力已能触发。根因在上游招式效果概率：`data/battle/index.ts:70–81` 把 PokeAPI `meta.stat_chance=0` 原样生成 `stat-stage {chance:0,isPrimary:true,change:-2}`；`lib/battleResolution.ts:739–742` 看到 `effectChance<=0` 就跳过整组。白色香草看到未下降的能力等级而不触发是正确的下游行为，不应改成无下降也消耗。

**资料口径。** 本机游戏 Go 代理对 `/api/pokeapi/move/feather-dance` 返回 `damage_class=status`、`target=selected-pokemon`、`stat_changes=[attack:-2]`、`meta.stat_chance=0`、`effect_chance=null`；同类的 `charm`、`growl` 和自身 `swords-dance` 也返回 0，冰冻之风返回 100，精神强念返回 10。本地固定 Rogue expansion `src/data/battle_moves_revised.h` 的 `MOVE_FEATHER_DANCE` 同时声明 `.effect=EFFECT_ATTACK_DOWN_2`、`.split=SPLIT_STATUS`、`.secondaryEffectChance=0`，证明这里的 0 不是“主效果永远不发生”。[PokéAPI Move 文档](https://pokeapi.co/docs/v2#moves)把 `stat_changes` 与 `meta.stat_chance` 分列；后者描述为“攻击导致目标能力变化的概率”，对主效果为零的解释需结合上述真实数据与固定参考实现，不能对所有 `chance=0` 一概视作必然。

**最小实现面。**

1. 在 `buildMoveSecondaryEffects` 只对 **`damage_class=status` 且存在 `stat_changes` 的主能力变化**，把 `meta.stat_chance=0` 归一为 `chance=100`；保留 `isPrimary=true`、命中/保护及目标适用条件。`meta.stat_chance>0` 原值不动，攻击招式的次要效果与显式 override 不改。
2. 在 `applyMoveSecondaryEffects` 的效果组概率门增加同一语义的窄幅兜底：仅当该效果是 `kind='stat-stage'`、`isPrimary===true`、`move.damage_class==='status'`、`chance===0` 时按 100 执行。这样已冻结在队员 `selectedMoves` 或检查点中的原始 `chance:0` 羽毛舞无需改档也可执行；`isPrimary=false` 或非状态招式的 0 仍为不触发。不得把所有 0 或所有 `isPrimary` 统一改为 100。
3. 白色香草结算入口维持现状：能力真的下降后由控制器为受影响一侧复原、消耗与记录；无下降（被保护/替身阻断、已到下限等）仍不得消耗。

**可执行验证计划。**

| 断言 | 静态验证 | 最终浏览器取证 |
| --- | --- | --- |
| 原始羽毛舞主效果生效 | `data/battle/index.test.ts` 用真实字段夹具断言生成 `chance=100,isPrimary=true,attack:-2`；`lib/battleResolution.test.ts` 用 `chance=0,isPrimary=true,status` 的旧序列化招式断言目标攻击 -2，随机值 0/0.99 均生效 | Player 重跑原始羽毛舞命中白色香草持有者：日志先降攻击再复原，目标最终攻击等级 0、本战持有物消耗，下一战基准返还；记录代码 SHA 与 `result.json`/截图 |
| 不扩大概率效果 | 同两处测试锁定精神强念 10%、冰冻之风 100%、非主效果或非状态招式 `chance=0` 仍不触发；保护/替身阻断不令羽毛舞效果或香草发生 | 原有冰冻之风、蛮力案例重跑或在最终回归中保留，证明自降与有概率降级未回退 |
| 双方与幂等 | 控制器测试以羽毛舞真实效果输出分别作用玩家/敌方，白色香草各只消耗及记录一次；第二次检查不重复触发 | 手机模拟视口（390×844）真实 UI 操作；用受控存档时注明，不将受控抽取说成自然抽取 |
| 门禁 | `npm run lint`、`npm test`、`npm run build`、`go test ./...`；auditor 静态复审该最小 diff | Player 只对修复后的最终代码重新取证，旧 `604232f` 截图不得复用为完成证据 |

**独立既有缺陷。** `battle/engine/resolveDamage.ts` 的状态招式分支在命中率判定前返回，不能在本任务中宣称羽毛舞“未命中不降级”已被验证；状态招式命中率另案处理。本轮只验证保护/替身阻断和主效果概率语义，不借机扩大招式平衡修改。

本节已获 orchestrator 批准，按任务流水线实施与复审；运行证据由 Player 在实现冻结后重取。
