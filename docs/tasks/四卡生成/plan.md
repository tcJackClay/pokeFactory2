# 技术方案: 四卡生成（第 3、6 胜后持有物奖励节点）

> architect 拥有。≤300 行。每条规则与验证断言必须追溯到 `prd.md`。
>
> 本任务把「每组第 3、6 胜后先换怪/跳过，再四选一」从**未实现**补成**可领取事务**：七件基础保底池的候选枚举 / 抽样 / 冻结 / 领取 / 回池，以及奖励节点 UI。
> 构建在既有代码上：`config/factoryRewards.ts`（触发点与 `freeRewardChoiceCount` **已存在**）、`hooks/usePokeFactoryGame.ts`（工厂流程与存档接线）、`services/saveManager.ts`（检查点事务层）、`components/GameView.tsx`（`gameState === 'REWARD'` **已路由**到 `RewardScreen`）。
> 上游陈旧分支 `codex/reward-item-ui`（`20d582a`，11 ahead / 81 behind）提供**可直接搬运的存档事务层**；其候选口径（五件）与卡面**不可搬运**（见「上游陈旧分支复用结论」）。

---

## 1. 改动面

| 文件 / 函数 | 当前职责 | 本任务改动 |
| --- | --- | --- |
| `src/features/game/config/factoryRewardPool.ts`（**新增**） | 无 | 单一真值源：`FACTORY_REWARD_HELD_ITEM_IDS`（七件）、`isFactoryRewardHeldItemId`、`enumerateFactoryRewardCandidates(equippedIds)`、`drawFactoryRewardCards(candidates, count, random)`、`getRewardApplicability(pokemon, itemId)`（卡面诚实判定）。**不 import** `rewardPools.ts` |
| `src/features/game/config/factoryRewardPool.test.ts`（**新增**） | 无 | 穷举枚举证明（PRD 验收 1/2/5）、等权不放回抽样、适用性判定 |
| `src/features/game/config/factoryRewards.ts` | 组内序号 / BP / 触发点 | **新增** `isFactoryRewardPreBattle(stage)` = `shouldTriggerPreBattleRewardStage(stage)`；**新增** `shouldEnterRewardAfterWinning(stage)` = `shouldTriggerPreBattleRewardStage(stage + 1)`（换怪节点锚点，单一数值源）。不改 `FACTORY_REWARD_CONFIG` |
| `src/types.ts` → `GamePokemon` | `factoryHeldItemId`（本场当前）、`factoryOriginalHeldItemId`（租借原配） | **新增** `factoryEquippedHeldItemId?: string \| null`＝**本局返还基准**（初始=租借原配；领取奖励后=奖励装备） |
| `src/features/game/utils/restoreFactoryParty.ts` → `prepareFactoryPartyForBattle` | 用 `factoryOriginalHeldItemId` 返还 | 改用 `factoryEquippedHeldItemId`；`restoreFactoryParty` 本体不动（保留消耗态至下一战） |
| `src/features/game/hooks/useFactoryFlow.ts` → `buildFactoryPool` 的 `mons.push` | 写 `factoryOriginalHeldItemId` / `factoryHeldItemId` | 同时写 `factoryEquippedHeldItemId`（玩家与敌方**对称**）。`heldItemPool`（敌方伪持有物去重池）**不动** |
| `src/services/saveManager.ts` | `SAVE_SCHEMA_VERSION = 13`；`phase: BATTLE\|ROUND_RESULT\|FACTORY_SWAP\|BASE` | 版本 → **14**；`phase` 增 `'REWARD'`；新增 `FactoryRewardCheckpoint`（`PENDING\|READY\|CLAIMED`）；新增 `commitFactoryRewardPending / commitFactoryRewardReady / commitFactoryItemRewardClaim / commitFactoryRewardContinueIntent`；新增 `canEquipRewardItem`、`getFactorySwapEquippedItemConflict`、`hasUniqueEquippedItems`；`hasValidFactoryHeldItemState` 增校验 `factoryEquippedHeldItemId`；`assertCurrentSaveRecoverability` 增 REWARD 相位规则；`commitFactoryBattleStart` 增「已领取且已请求继续」的起战来源；`persistSaveData` 的 `phaseRank` 增 `REWARD` |
| `src/features/game/components/game-view/reward/FactoryItemRewardScreen.tsx`（**新增**） | 无 | 四卡展示 / 选卡 / 选队员 / 替换确认 / 已领取页 / PENDING 页 / 存疑态；**卡面适用性标注**（本任务新写） |
| `src/features/game/components/game-view/reward/FactoryItemRewardScreen.test.ts`（**新增**） | 无 | SSR 渲染断言：四卡、逐卡标注、无「重抽/扩容许可」旧入口 |
| `src/features/game/components/game-view/RewardScreen.tsx` | 旧奖励屏（ITEM/POKEMON/TM/EVOLUTION） | 改为**只**渲染 `FactoryItemRewardScreen`（旧屏保留文件，不再被 REWARD 路由选中） |
| `src/features/game/components/game-view/FactorySwapScreen.tsx` | 换怪/跳过 | 奖励前那一战（组内第 3、6 胜后）对**会造成三人基准重复**的换怪组合禁用并给出说明；仍允许改选或跳过 |
| `src/features/game/hooks/usePokeFactoryGame.ts` | 工厂流程编排 | `continueAfterRoundResult` REWARD 前不再预取敌队；`nextFactoryStage` / `performSwap` 在奖励节点改为写 `PENDING` + `setGameState('REWARD')`；新增 `claimFactoryItemReward / continueAfterFactoryReward / clearFactoryItemRewardError / clearPostBattleActionError`；`getPersistableBattleResume` 与清空 effect 增 `'REWARD'`；**移除** `devOpenRewardScreen` 及其 DEV 按钮 |
| `src/features/game/view-model/state.ts` | 视图状态类型 | 新增 `postBattleActionError`、`rewardClaimError`、`rewardClaimBusy`、`rewardContinueError`、`rewardContinueBusy`、`rewardCheckpointStatus`、`rewardCheckpoint` |
| `src/features/game/view-model/actions.ts` | 动作契约 | 新增 `claimFactoryItemReward`、`continueAfterFactoryReward`、`clearFactoryItemRewardError`、`clearPostBattleActionError`；移除 `devOpenRewardScreen` |
| `src/features/game/battle/battleLogText.ts` → `HELD_ITEM_ZH` | 持有物中文名 | **新增** `heavy_duty_boots: '厚底靴'`、`loaded_dice: '机变骰子'` |

**与既有代码的关系**：**接线 + 新增**，不替换既有语义。战斗控制器（`useBattleController` 回合语义）、`resolveEntryHazards` / `resolveMoveStrikes` / `data/battle`（两件道具的战斗效果）、`FACTORY_BATTLE_CONFIG.heldItemPool`、`rewardPools.ts`、`useRewardFlow.ts` 的旧奖池逻辑**均不改**。

---

## 2. 数据流与状态机

### 2.1 触发锚点（PRD §1）

- 配置真值：`preBattleRewardBattlesInSet = [4, 7]`（已存在）。
- 玩家可见锚点：**进入组内第 4、7 战的战前阶段**。
- 代码锚点：`gameState === 'FACTORY_SWAP'` 且 `shouldEnterRewardAfterWinning(stage)`（= 刚赢下组内第 3、6 战）。两条互为等价表述，**只保留一个数值源**（`preBattleRewardBattlesInSet`）。

### 2.2 奖励节点状态机（PRD §2、§3.4、§3.5、§4 与边界）

```
FACTORY_SWAP(胜第3/6战)
  ├─ 跳过换怪 / 换怪（先过三人基准唯一性校验）
  └─ commitFactoryRewardPending(runId, stage, finalTeam, swapped)
        ├─ 成功 → phase=REWARD, checkpoint={PENDING}        ── 持久化点①
        └─ 失败 → 留 FACTORY_SWAP，postBattleActionError，不推进战次、不出卡
              ↓
REWARD / PENDING  ── 屏幕挂载时按当前「本局返还基准」枚举候选
        ├─ 枚举成功 → commitFactoryRewardReady(runId, stage, cards) → READY ── 持久化点②
        ├─ 枚举不足 → 留在 PENDING，显示缺陷态（**不补位、不出卡**）
        └─ 写入失败 → 留在 PENDING，可重试
              ↓
REWARD / READY ── 选卡 + 选队员 + 替换确认
        ├─ commitFactoryItemRewardClaim(runId, stage, itemId, targetIndex)  ── 持久化点③
        │     · 原子写：{CLAIMED, cardItemIds, claim} + 队员 factoryEquippedHeldItemId=itemId
        │     · 已 CLAIMED 且 (itemId,targetIndex) 相同 → 幂等返回同一检查点
        │     · 已 CLAIMED 但参数不同 → 抛错（不写）
        ├─ 成功 → CLAIMED（旧物直接移除、不进背包、**立即回池**）
        └─ 失败 → 留在 READY，rewardClaimError，不改变装备位
              ↓
REWARD / CLAIMED ── 「继续挑战」
        ├─ commitFactoryRewardContinueIntent(runId, stage)        ── 持久化点④
        │     · 幂等；刷新/重开后可再次点击
        └─ nextFactoryStage() → 起战回调写 stage+1 的 READY/BATTLE（清除 rewardCheckpoint）
              ├─ 成功 → 第 4 / 第 7 战开战前按新返还基准返还装备
              └─ 失败 → 留在 CLAIMED + continueRequested，rewardContinueError，可重试
```

失败回退统一语义（PRD §4、边界 A）：**不推进战次、不少给卡、不重复卡、不改变装备位**。`PENDING` 刷新后重新生成合法（同节点同队伍状态，PRD 边界）；`READY`/`CLAIMED` 刷新**冻结不重抽、不重复领取**。`stage` / 战斗纪元变化即丢弃检查点（PRD §边界「阶段切换」）。

### 2.3 候选枚举与抽样（PRD §3.1–§3.3）

1. `E` = `playerTeam` 三名成员的 `factoryEquippedHeldItemId`，经 `getItemBattleData(id).id` **归一为标准 ID** 后去重（`null` / 空串剔除）。
   **必须读「本局返还基准」，不得读 `factoryHeldItemId`**（战斗中消耗/拍落会让后者为空）。
2. `候选 = FACTORY_REWARD_HELD_ITEM_IDS \ E`（七件固定，`|E| ≤ 3` ⇒ `|候选| ≥ 4`）。
3. 合法性过滤：对每张候选断言 ∃ 队员 `i` 使 `canEquipRewardItem(playerTeam, 候选, i)` 为真（换装后三人基准 ID 仍互异）。恒真结论**由代码断言**，不默认假设。
4. 抽样：`drawFactoryRewardCards(候选, getFactoryRewardChoiceCount(), random)` —— **不放回等权**抽 `min(4, |候选|)`，`random` 注入以便确定性夹具。**不固定 ITEM/TM 配比**（裁决 6），**不设权重**（不沿用 `FREE_REWARD_TYPE_WEIGHTS`）。
5. `TM` 候选恒为空（allowlist 0/50），**不进入本任务候选来源**；四卡保底独立于 TM。
6. 候选不足 `min(4, |候选|)` ⇒ 返回 `{ok:false, reason:'INSUFFICIENT'}`，UI 显示缺陷态并上报；**禁止**重复卡 / 空卡 / 旧奖池 / 未验收 TM 补位。

### 2.4 数据流

`FACTORY_SWAP` →（存档 `PENDING`）→ `REWARD` 屏幕 `useEffect(runId+stage+status==='PENDING')` → `factoryRewardPool` 纯函数 →（存档 `READY`）→ 玩家选择 →（存档 `CLAIMED`）→ `nextFactoryStage()` → `prepareFactoryPartyForBattle`（按 `factoryEquippedHeldItemId` 返还）→ `commitFactoryBattleStart`（写 stage+1，清 `rewardCheckpoint`）。

---

## 3. 状态契约

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `battleResume.phase` | `'BATTLE' \| 'ROUND_RESULT' \| 'FACTORY_SWAP' \| 'REWARD' \| 'BASE'` | 存档相位；`REWARD` 为新增 |
| `battleResume.rewardCheckpoint.status` | `'PENDING' \| 'READY' \| 'CLAIMED'` | 奖励节点状态；仅 `phase === 'REWARD'` 时存在 |
| `battleResume.rewardCheckpoint.cardItemIds` | `FactoryRewardHeldItemId[]` | 冻结的四张候选（`READY`/`CLAIMED`）；`|4|`、ID 互异、每张可装备 |
| `battleResume.rewardCheckpoint.claim` | `{ itemId, targetIndex }` | 已领取的卡与装备对象（`CLAIMED`）；`targetIndex` 的 `factoryEquippedHeldItemId === itemId` |
| `battleResume.rewardCheckpoint.continueRequested` | `true?` | 已请求进入下一战；保证刷新后可重试且不重复起战 |
| `GamePokemon.factoryEquippedHeldItemId` | `string \| null` | **本局返还基准**；三人互不重复是不变量 |
| `GamePokemon.factoryHeldItemId` | `string \| undefined` | 本场当前持有物；战斗中消耗/拍落即为 `undefined`，**不参与候选计算** |
| `viewModel.rewardCheckpoint` / `rewardCheckpointStatus` | 检查点快照 / 状态 | 奖励屏渲染来源；未处于 `REWARD` 时为 `null` |
| `viewModel.rewardClaimError` / `rewardClaimBusy` | `string \| null` / `boolean` | 领取失败原因与 UI busy；失败留在 `READY` |
| `viewModel.rewardContinueError` / `rewardContinueBusy` | `string \| null` / `boolean` | 继续失败原因与 UI busy；失败留在 `CLAIMED` |
| `viewModel.postBattleActionError` | `string \| null` | 换怪/奖励落盘失败、换怪装备冲突提示；显示于换怪屏 |
| `playerTeam[i].selectedMoves[].battleData` | `MoveBattleData` | 卡面诚实判定输入：`!guaranteedHits && minHits===2 && maxHits===5`（机变骰子） |

---

## 4. 验证计划

> 证据根为 `docs/tasks/四卡生成/evidence/`；静态门禁输出写入 `docs/tasks/四卡生成/log.md`。
> 纯逻辑断言走 `npm test`（`node --import tsx --test "src/**/*.test.ts"`）；hook/浏览器断言在 390×844 与 844×390 手机模拟视口执行。

| 断言（来自 `prd.md`） | 验证方式 | 文件路径 | 证据类型 |
| --- | --- | --- | --- |
| **1 四卡保底**：三人占七件中任意三件且 TM=0 时恒产 4 张 ID 互异、每张有合法队员 | **静态·穷举**：以 `ITEM_BATTLE_DATA` 全部 ID + `null` 为全集，枚举所有 `|E| ≤ 3` 组合（约 1.15 万组）逐组枚举候选；断言 `|候选| = \|H \ E\|`，其中 `E ⊂ H` 且 `\|E\|=3` 的 35 组恒为 4；抽 4 张后 ID 互异；每张至少一个合法目标。输出 `0/1/2/3/≥4` 分布与失败最小反例 | `evidence/four-card-coverage.json` | 状态快照（确定性夹具输出） |
| **2 返还基准口径**：消耗/拍落不改候选；换怪后重算且三人唯一 | 静态：`factoryHeldItemId=undefined` 而 `factoryEquippedHeldItemId` 不变 ⇒ 候选集逐张不变；`getFactorySwapEquippedItemConflict` 对该换怪组合返回冲突，`canEquipRewardItem` 在换后的队伍上仍成立且基准 ID 互异。运行：第 3 胜后换怪 → 核对候选与三人装备 | `evidence/baseline-vs-current-items.json` | 状态快照 |
| **3 冻结**：`READY` 后刷新 / 重开 / 同版导入候选逐张不变 | 静态：`commitFactoryRewardReady` 二次调用同卡返回原检查点、不同卡抛错；`sanitizeBattleResume` + `assertCurrentSaveRecoverability` 保留 `cardItemIds`；`replaceSaveData` 后逐张比对。运行：`READY` 刷新与导出再导入，比对卡面 | `evidence/freeze-reload.json` + `evidence/freeze-reload-390x844.png` | 状态快照 + 截图 |
| **4 唯一领取**：双击/连点只产生一次 `CLAIMED`、装备位只变一次、旧物不入背包 | 静态：同 `(itemId,targetIndex)` 二次 claim 幂等返回；不同参数抛错；`rewardClaimInFlightRef` 同步早退；断言 `inventory` 长度不变。运行：确认按钮连点 5 次，核对 `CLAIMED` 一次、装备位一次、背包无旧物 | `evidence/double-claim.json` + `evidence/double-claim-390x844.png` | 状态快照 + 截图 |
| **5 替换与回池**：旧物立即回池、后续节点可再出现，三人基准仍互异 | 静态：领取 `h` 装备给 `i` 后，`enumerateFactoryRewardCandidates` 结果含 `i` 的旧物；任意组合下基准 ID 互异不变量成立。运行：连续两个奖励节点核对旧物重现 | `evidence/replace-return-to-pool.json` | 状态快照 |
| **6 返还时序**：新物成为第 4 / 第 7 战开战前的返还基准；第 7 胜后无下一战不提前返还 | 静态：claim 后 `prepareFactoryPartyForBattle` 返回新物；第七胜后不调用该函数，`factoryHeldItemId` 保持消耗态且 `phase='BASE'` 快照保留。运行：第 4 战开战前核对装备，第 7 胜后核对未返还 | `evidence/return-timing.json` | 状态快照 |
| **7 失败语义**：注入枚举或落盘失败，节点留在原处、战次不推进、不少给卡/不重复卡 | 静态注入：`window.localStorage.setItem` 首次抛错 ⇒ `PENDING` 提交失败、仍停 `FACTORY_SWAP`、`stage` 与 `playerTeam` 不变、无 `rewardCheckpoint`；`commitFactoryRewardReady` 抛错 ⇒ 停 `PENDING`；枚举注入为不足 ⇒ 返回 `INSUFFICIENT` 且**候选数不被补齐** | `evidence/failure-semantics.json` | 状态快照 |
| **8 卡面诚实**：`heavy_duty_boots`/`loaded_dice` 在无触发场景的队伍中不宣称当局有效 | 静态 SSR：无合格 2–5 次连续招式（含 `guaranteedHits` 非空）的队伍中，`loaded_dice` 卡面含「当前无对应触发场景」且不含「本场必然有效」；`heavy_duty_boots` 卡面只提**隐形岩 / 毒菱**，不出现「尖刺」「黏黏网」，且含「接地毒属性仍吸收毒菱」 | `evidence/card-honesty.html` + `evidence/card-honesty-390x844.png` | 状态快照（SSR markup）+ 截图 |
| **9 端到端**：模拟手机视口完成「胜第 3 场 → 换怪/跳过 → 四卡 → 选卡 → 选队员 → 替换确认 → 第 4 战开战前返还」 | 运行：390×844 与 844×390 各一遍完整链路，逐步截图并导出存档快照 | `evidence/e2e-390x844/`、`evidence/e2e-844x390/` | 截图 + 状态快照 |
| **10 静态门禁 + 新增测试覆盖上述断言** | `npm run lint && npm test && npm run build` | `log.md`（# Programmer 段） | 人工判断（门禁输出） |
| 回归：`FACTORY_SWAP` 之外不得绕过奖励直接开战；`rewardCheckpoint` 出现在 `REWARD` 之外即判存档无效 | 静态：`commitFactoryBattleStart` 对第 3/6 胜的绕行来源抛错；`assertCurrentSaveRecoverability` 断言 | `evidence/reward-bypass-rejected.json` | 状态快照 |
| 回归：旧存档 `battle_atk`/`battle_def`/旧奖池 ID 安全丢弃不崩溃；v13 及更早版本进「旧规则存档不兼容」页并提示先备份 | 静态：`hydrateInventoryFromItemIds` 过滤 + `classifySaveText` 分类 | `evidence/save-compat.json` | 状态快照 |

---

## 5. 不可自动验证的断言

- **「玩家感知只领取一次 / 没有重复扣卡」**：需真实浏览器连点与刷新，静态只能证明存档层幂等与同步门闩；兜底为 player 的连点实玩核对（证据类型=人工判断）。
- **「卡面诚实说明确实被玩家看到且可理解」**：SSR 断言只证明文案存在，可读性靠 390×844 / 844×390 截图人工判读。

占比 < 30%，PRD 断言写法可保持。

---

## 6. 风险与隐含决策

> orchestrator 必须在 programmer 开始前逐条批准。

1. **七件名单的规则来源等级**：`docs/公开版规则定稿.md` 第 8 行仍写「已确认的五件起始候选」，七件只在 `docs/tasks/扩池规则/design.md` §1.1 为「设计者选定（待用户确认）」、并由 `decisions.md` 的 Orchestrator 裁决（2026-09-27）代决。traceability 等级 = **裁决 + design.md ≠ 规则定稿**。需批准在 Stage 2 验收后一次性回写，或先回写再实现。
2. **锚点映射**：PRD 用「组内第 4、7 战战前」，代码在「第 3、6 胜后的 `FACTORY_SWAP`」触发。两者在 `battlesPerSet=7` 下等价，但**依赖该配置不被改动**；新增 `shouldEnterRewardAfterWinning(stage)` 单一来源 + 测试锁定。
3. **不复用 `FACTORY_BATTLE_CONFIG.heldItemPool`**（9 件、含已排除的 `leftovers`/`bright_powder`、不含两件）。后果：敌方/租借伪持有物池与奖励七件**不同集**，敌方可能出现与玩家同款装备，玩家可见「两边都有焦点镜」。**本任务不改敌方池**（改动会波及敌方去重与生成规则，属另一任务）。需批准接受该可见口径，或另行裁定是否把敌方池收敛到七件。
4. **两件道具精灵图不存在**：实测 `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/heavy-duty-boots.png` 与 `loaded-dice.png` 均 **404**（该仓库 905 个道具图中无此二名），而 `getFactoryHeldItemIcon()` 的 fallback 按 ID 拼连字符 URL ⇒ 奖励卡与 `PokemonDetailPanel` 会显示破图。**自选方案**：奖励卡 `<img onError>` 切换为非图片兜底（lucide 图标 + 名称），不为两件自制美术；`PokemonDetailPanel` 的同类破图**不扩大范围**（记为已知问题）。需批准。
5. **`HELD_ITEM_ZH` 补译名**：`heavy_duty_boots: '厚底靴'`、`loaded_dice: '机变骰子'`。当前会回落到 `'heavy duty boots'` / `'loaded dice'`（英文串）。译名为自选，需批准。
6. **卡面适用性呈现粒度（自选）**：`loaded_dice` 用「该队员是否有 `!guaranteedHits && minHits===2 && maxHits===5` 的招式」逐队员判定；`heavy_duty_boots` 因陷阱由对手在战斗中铺设、奖励时刻不可判定，**恒按条件性文案**呈现（只提隐形岩/毒菱 + 接地毒属性仍吸收毒菱）。文案与判定谓词均为自选，PRD §3.6 只规定**内容边界**。
7. **删除 DEV 面板的 `Reward` 按钮**（`devOpenRewardScreen`）：该按钮会把 `gameState` 直接置 `REWARD` 且无检查点，落到新奖励屏只会显示「奖励待准备」，成为死按钮。属开发者可见行为变更，需批准。
8. **`SAVE_SCHEMA_VERSION` 13 → 14**：所有 v13 及更早存档一律进「旧规则存档不兼容」页（先下载备份再清除）。但 `InvalidSaveScreen` 的 legacy 文案现说明的是「七战整组结算 BP」，与本次（奖励节点）不同因。**是否改写文案需批准**；不改则提示仍明确但原因不精确。
9. **不等权以外的抽样语义（自选）**：`random` 注入为可测试；未采用种子化 PRNG，故「同一次抽取」不可复现，只有「冻结后不重抽」可测。需批准不引入种子存档。
10. **换怪选项限制（自选实现）**：奖励前那一战的换怪若会让三人基准重复，则**禁用该组合并提示**，而非自动替换掉重复者或丢弃敌方原配。依据 design.md §3.1 第 6 条（不得擅自丢弃敌方原配道具）+ 三人唯一不变量；但「提示禁用 vs 自动处理」是自选，需批准。
11. **`REWARD` 相位单列**而非复用 `FACTORY_SWAP`：`persistSaveData` 的 `phaseRank` 令 `REWARD(3) > FACTORY_SWAP(2) > ROUND_RESULT(1)`，`BASE(2)` 与 `FACTORY_SWAP` 同秩。这是自选的持久化优先级口径，需确认不会让旧快照覆盖新检查点。
12. **旧奖励路径成为不可达代码**：`RewardScreen` 旧实现与 `useRewardFlow` 的 `openRewardStage/selectReward/rerollRewards/nextStage` 在本任务后不再被 `REWARD` 路由使用。PRD 明确「只需不再使用，不要求清理」，故**保留不删**；但 `RewardScreen.tsx` 文件内容会被替换为渲染新屏（否则文件内旧实现成死代码）。需批准该处理方式。

---

## 上游陈旧分支复用结论

盘点对象：`codex/reward-item-ui`（`20d582a`，11 ahead / 81 behind，merge-base `706444ce`）、`codex/factory-reward-checkpoint`（`296eb61`，7 ahead / 81 behind，是前者的后缀子集）。两分支**均落后 `dev` 81 个提交**，基线早于「轮次事务」合入，故**不能直接合并**，只能逐件搬运。

| 部分 | 结论 | 理由 |
| --- | --- | --- |
| `saveManager.ts` 检查点事务层（`FactoryRewardCheckpoint`、`commitFactoryReward{Pending,Ready}` / `commitFactoryItemRewardClaim` / `commitFactoryRewardContinueIntent`、`hasValidFactoryRewardCheckpoint`、`hasUniqueEquippedItems`、`canEquipRewardItem`、`getFactorySwapEquippedItemConflict`） | **原样搬运** | 与 `dev` 的 81 个提交无交集：它只依赖 `factoryRewards`、`data/battle`、`restoreFactoryParty`、`hasRecoverablePokemonCore`，这些符号在 `dev` 上均存在且签名未变。已完整实现 PENDING/READY/CLAIMED、幂等、冻结、落盘后回读校验、失败抛错（PRD §3.4/§3.5/§4 与边界 A）。 |
| `saveManager.ts` 的 `phase: 'REWARD'`、`assertCurrentSaveRecoverability` REWARD 分支、`persistSaveData` 的 `phaseRank`、`sanitizeBattleResume` 透传 | **原样搬运** | 同一事务层的组成部分；`dev` 侧仅有 `BATTLE/ROUND_RESULT/FACTORY_SWAP/BASE` 四相位，无冲突。 |
| `types.ts` 的 `factoryEquippedHeldItemId` + `restoreFactoryParty.prepareFactoryPartyForBattle` 改读该字段 + `useFactoryFlow` 的 `mons.push` 补写 + `saveManager.hasValidFactoryHeldItemState` 增校验 | **原样搬运** | 「本局返还基准」是 PRD §3.1/§3.5 的硬前提；`dev` 目前只有 `factoryOriginalHeldItemId`（租借原配，不可变）与 `factoryHeldItemId`（本场当前，会被清空），**缺第三个字段**。改动面小（1 类型字段 + 2 处赋值 + 1 处读取 + 1 处校验），且与轮次事务无耦合。 |
| `saveManager.test.ts` 的 8 个新用例 + `restoreFactoryParty.test.ts` 的基准返还用例 | **需改造（小）** | 用例主体（幂等、冻结、失败重试、回池、唯一性）可直接搬；但需把 `SAVE_SCHEMA_VERSION` 断言、卡数组长度、以及「五件 ID 字面量」改为七件，并把锚点 `shouldEnterFactoryRewardAfterSwap(3 \| 6)` 改为 `shouldEnterRewardAfterWinning`。 |
| `usePokeFactoryGame.ts` 的 REWARD 接线（`getPersistableBattleResume` 增 REWARD、清空 effect 增 REWARD、`nextFactoryStage`/`performSwap` 改走 `commitFactoryRewardPending`、`claimFactoryItemReward`/`continueAfterFactoryReward`、view-model 暴露） | **需改造（中）** | 结构可照搬，但基线是旧的；`dev` 上 `nextFactoryStage` 已改为 `(playerPool?)` 且内部走 `spawnEnemy({commitBattleStart})`（`dev` 行为，旧分支相同），可复用；**必须改**的是：(a) `continueAfterRoundResult` 里对奖励前那一战**跳过 `prefetchEnemy(stage+1)`**（旧分支已做，但 `dev` 该函数体已重写，需重新贴入）；(b) 锚点换 `shouldEnterRewardAfterWinning`；(c) 接入新增的 `FactoryRewardCheckpoint` 类型。 |
| `FactoryItemRewardScreen.tsx`（181 行） | **需改造（中）** | 骨架（PENDING 页 / CLAIMED 页 / 四卡网格 / 队员选择 / 替换确认 / 焦点管理 / `aria-*`）可留；**必须改**：(a) 五件 `ITEM_NAMES` → 七件且改走 `battleHeldItemName` + 新补译名；(b) 加**卡面适用性标注**（PRD §3.6，旧分支完全没有 ⇒ 本任务新写）；(c) 加图片 `onError` 非图片兜底（两件精灵图 404）；(d) 加候选不足缺陷态（PRD 边界 B）。 |
| `FactoryItemRewardScreen.test.ts`（78 行） | **需改造（小）** | 五条 SSR 用例的断言骨架可留；卡数组与名称断言改七件，并**新增**卡面诚实断言（验收 8）与「不出现重抽/扩容许可」断言。 |
| `FactorySwapScreen.tsx` 的冲突提示 + `aria-describedby` | **需改造（小）** | 逻辑照搬，锚点换 `shouldEnterRewardAfterWinning`；`dev` 该屏已有 `opponentLoadError` 区块，需合并渲染位置。 |
| `RewardScreen.tsx` 改为渲染新屏 | **原样搬运** | 3 行委托，无冲突。 |
| `view-model/state.ts` / `actions.ts` 的字段与动作 | **需改造（小）** | 照搬字段名，但 `dev` 的 `GameViewFlowState` 已有 `opponentLoadError` 而无 `rentalLoadError` 冲突，需重排插入位置；`devOpenRewardScreen` 移除同步做。 |
| `factoryRewards.ts` 的 `FACTORY_REWARD_HELD_ITEM_IDS`（**五件**）与 `shouldEnterFactoryRewardAfterSwap(stage)`（`battleInSet===3\|\|6`） | **必须重写** | 候选口径是本轮**已被推翻**的旧口径：五件下界 `5−3=2 < 4`（`decisions.md` 第 1 条裁决 + design.md §0）。`battleInSet===3\|\|6` 是**第二个数值源**，与既有 `preBattleRewardBattlesInSet=[4,7]` 重复；改为 `shouldTriggerPreBattleRewardStage(stage+1)`。 |
| 旧分支的候选生成（隐含 `rewardPools` / 候选不足不处理） | **必须重写** | 旧分支只实现「固定候选 + 领取」，**没有候选枚举/抽样/合法性过滤**（PRD §3.1–§3.3 在本轮才定稿：等权不放回、`H \ E`、回池、不改 ITEM/TM 配比）。`enumerateFactoryRewardCandidates` / `drawFactoryRewardCards` / `getRewardApplicability` 全部新写为纯函数 + `factoryRewardPool.test.ts`。 |
| 旧分支的 `devOpenRewardScreen` 删除 | **原样搬运** | 与新奖励屏互斥（见风险 7）。 |

**一句话**：事务层（`saveManager` 检查点 + 返还基准字段 + 换怪唯一性）**可搬 ≈ 70% 的存档/接线工作**；**必须重写**的是候选枚举/抽样模块、七件名单与锚点、卡面诚实标注，以及两件道具的图标兜底。

---

## 当前实现进度盘点

> 基于隔离工作树 `D:/Games/pokeFactory2-worktrees/four-card-reward`（基线 `0394e9d`）实地核查。

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `config/factoryRewards.ts` | **部分完成** | 已有 `FACTORY_REWARD_CONFIG`、`getFactoryRewardChoiceCount`、`getPreBattleRewardBattlesInSet`、`shouldTriggerPreBattleRewardStage`、`getFactoryGroupBp`、`getFactorySetBp`。缺：换怪锚点 helper、七件名单 |
| `config/factoryRewardPool.ts` | **未开始** | 不存在。候选枚举 / 抽样 / 合法性过滤 / 适用性判定全部缺失 |
| `config/rewardPools.ts` | **已完成（不再使用）** | `FREE_REWARD_TYPE_WEIGHTS` 与旧 ID 仍在；本任务不引用、不删除 |
| `config/factoryBattle.ts` → `heldItemPool` | **已完成（不改）** | 9 件，敌方伪持有物去重用途；含已排除的 `leftovers`/`bright_powder`，不含两件（见风险 3） |
| `data/battle/itemEffects.ts` + `resolveEntryHazards.ts:54` + `resolveMoveStrikes.ts:56` + `data/battle/index.ts:332` | **已完成** | 七件的战斗元数据与调试点齐备。**核实结论**：`heavy_duty_boots`（`HEAVY_DUTY_BOOTS`，`resolveEntryHazards.ts:54` 同时覆盖隐形岩伤害与毒菱状态）与 `loaded_dice`（`LOADED_DICE`，`minHits===2 && maxHits===5` 改次数）**战斗效果链路完整可用** |
| `config/factoryHeldItemIcons.ts` | **部分完成** | 六件有显式映射条目；`loaded_dice`/`heavy_duty_boots` 走 fallback 拼 URL，**实测两图 404** |
| `battle/battleLogText.ts` → `HELD_ITEM_ZH` | **部分完成** | 五件中文名齐备；缺厚底靴 / 机变骰子（会回落英文串） |
| `uiAppConstants.ts` → `ALL_ITEMS` | **不涉及** | 七件**均不在** `ALL_ITEMS`；工厂持有物不经 `ALL_ITEMS` 链路，仅 `hydrateInventoryFromItemIds` 用它过滤背包 ID。**核实结论：装备链路不依赖 `ALL_ITEMS`** —— 装备与查重走 `GamePokemon.factoryHeldItemId` / `factoryEquippedHeldItemId` + `getItemBattleData()`（键为 `ITEM_BATTLE_DATA`，含七件），故无需把七件加入 `ALL_ITEMS` |
| `types.ts` → `GamePokemon` | **未开始** | 缺 `factoryEquippedHeldItemId`（本局返还基准） |
| `utils/restoreFactoryParty.ts` | **部分完成** | `restoreFactoryParty` 保留消耗态正确；`prepareFactoryPartyForBattle` 仍按 `factoryOriginalHeldItemId` 返还，**需改为新基准字段** |
| `hooks/useRewardFlow.ts`（597 行） | **未开始（本任务不改造其内部）** | 仍是旧奖池（ITEM/POKEMON/TM/EVOLUTION + 十次重抽 + 扩容许可）。`REWARD` 相位需在 view-model 层短路，不删除 |
| `hooks/usePokeFactoryGame.ts`（1898 行） | **未开始** | `CHALLENGE_ACTIVE_STATES` 已含 `'REWARD'`（利好）；`buildStableFactoryBattleResume` / `getPersistableBattleResume` / 清空 effect **均不含** `REWARD`（会清掉检查点快照）；`continueAfterRoundResult` 无条件预取敌队；`useRewardFlow` 仍接 `setGameState` |
| `services/saveManager.ts`（1458 行） | **未开始** | `SAVE_SCHEMA_VERSION=13`；`phase` 无 `REWARD`；无 `FactoryRewardCheckpoint`；`assertCurrentSaveRecoverability` 无奖励相位规则；`commitFactoryBattleStart` 拒绝从 `REWARD` 起战 |
| `components/GameView.tsx` | **已完成** | `gameState === 'REWARD'` 已路由到 `RewardScreen`；`showFactoryTopRecord` 与 `opponentLoadError` 已含 `REWARD` |
| `components/game-view/RewardScreen.tsx` | **部分完成** | 仍是旧六卡 UI（`RewardCardsGrid` / `RewardHeader` / 重抽按钮 / 确认领取），需替换为新屏 |
| `components/game-view/reward/FactoryItemRewardScreen.tsx` | **未开始** | 不存在 |
| `components/game-view/FactorySwapScreen.tsx` | **部分完成** | 换怪/跳过可用；缺装备冲突提示与禁用 |
| `view-model/state.ts` / `actions.ts` | **未开始** | 缺 7 个奖励/换怪状态字段与 4 个动作 |
| `saveManager.test.ts` / `factoryRewardPool.test.ts` / `FactoryItemRewardScreen.test.ts` | **未开始** | 现有 `saveManager.test.ts` 1014 行未覆盖奖励检查点 |

### 剩余的确定性收尾清单

1. 在 `factoryRewards.ts` 增 `isFactoryRewardPreBattle` / `shouldEnterRewardAfterWinning`，并加测试锁定「组内第 4、7 战 ↔ 第 3、6 胜后」等价。
2. 新建 `factoryRewardPool.ts` + 穷举覆盖测试（PRD 验收 1/2/5 的确定性夹具）。
3. 增 `factoryEquippedHeldItemId` 并在**三处**写入（`buildFactoryPool` 的 `mons.push`、`commitFactoryItemRewardClaim`、`sanitizeGamePokemon` 透传），一处读取（`prepareFactoryPartyForBattle`）。
4. 搬运并适配 `saveManager` 检查点事务层（含 schema 13→14、`phase: REWARD`、`assertCurrentSaveRecoverability`）。
5. 新建 `FactoryItemRewardScreen.tsx`（含七件名称、适用性标注、图片兜底、缺陷态）+ SSR 测试。
6. 改 `RewardScreen.tsx` 为委托；删 `devOpenRewardScreen` 与 DEV 按钮。
7. 接线 `usePokeFactoryGame.ts`（`REWARD` 纳入快照稳定性与清空守卫、跳过预取、`PENDING`/`claim`/`continue` 动作、view-model 暴露）。
8. 补 `HELD_ITEM_ZH` 两条译名。
9. 补齐失败注入测试（`localStorage.setItem` 抛错）与「绕行拒绝」回归测试。
