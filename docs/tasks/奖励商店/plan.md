# 技术方案: 奖励商店（第一阶段：S1–S6）

> architect 拥有。≤300 行。每条规则与验证断言必须追溯到 `prd.md`。
>
> 本任务把第 3、6 胜后的「四卡免费领」（merge `f6518c3`）改造成**真正的交换商店**：货架 6 件、稀有度三档定价扣券、兑换原子交易、组末券折算 BP、老四卡存档兼容。构建在四卡生成的检查点事务层（`FactoryRewardCheckpoint` / `commitFactoryReward*`）之上，属**扩展 + 改语义**，不推翻既有状态机骨架。
> 本阶段范围 = PRD 的 F1/F2/F3（限持有道具）/F5（限两香草文案）/F7 + 非功能 1/2/4/5；进化道具（F4）、白色香草战斗效果（F6）为下一阶段。

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

### 2.4 存档兼容（PRD S6 / 非功能 2）

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
