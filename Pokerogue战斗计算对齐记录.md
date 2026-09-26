# Pokerogue 战斗计算对齐记录

对齐状态：已完成本文定义的“战斗公式、属性克制、异常状态”范围。这里的“完全对齐”指本项目当前单打战斗数据流中的三类计算原语，并以工厂配置的 277 种招式检查哪些招式会修改这些原语；不等于 277 种招式的全部编排行为均已移植，也不代表把 Pokerogue 的双打、敌方令牌、被动特性、演出阶段或完整招式系统整体移植进来。

对齐基线：

- 仓库：[pagefaultgames/pokerogue](https://github.com/pagefaultgames/pokerogue)
- 固定提交：[df2e5635668359c244fc277121b86cba912a2f8d](https://github.com/pagefaultgames/pokerogue/commit/df2e5635668359c244fc277121b86cba912a2f8d)
- 提交时间：2026-08-19T00:47:52+09:00
- 核心参照：[伤害与状态判定](https://github.com/pagefaultgames/pokerogue/blob/df2e5635668359c244fc277121b86cba912a2f8d/src/field/pokemon.ts)、[属性表](https://github.com/pagefaultgames/pokerogue/blob/df2e5635668359c244fc277121b86cba912a2f8d/src/data/type.ts)、[异常状态](https://github.com/pagefaultgames/pokerogue/blob/df2e5635668359c244fc277121b86cba912a2f8d/src/data/status-effect.ts)、[回合状态标签](https://github.com/pagefaultgames/pokerogue/blob/df2e5635668359c244fc277121b86cba912a2f8d/src/data/battler-tags.ts)、[招式属性](https://github.com/pagefaultgames/pokerogue/blob/df2e5635668359c244fc277121b86cba912a2f8d/src/data/moves/move.ts)、[特性](https://github.com/pagefaultgames/pokerogue/blob/df2e5635668359c244fc277121b86cba912a2f8d/src/data/abilities/init-abilities.ts)

1. 先枚举项目实际计算入口和数据边界

- 检查了伤害、命中、出手顺序、行动前检查、回合末结算、换人清理、二级效果、招式元数据、特性元数据、存档恢复和战斗控制器。
- 扫描 110..881 的 772 套工厂配置，得到 277 种唯一招式；再与 Pokerogue 的伤害/威力/命中/状态类招式属性逐项求交集。
- 原项目不是空白实现，但存在公式取整顺序、随机区间、属性表、状态回合数、特性旁路和换人状态清理不一致，不能判定为完整。

2. 对齐基础伤害、取整和随机数

- 基础伤害改为 `((2 × 等级 / 5 + 2) × 威力 × 攻击 / 防御 / 50) + 2` 的 Pokerogue 顺序。
- 有效能力值、主修正、连续特性修正分别在对应阶段向下取整，避免一次性浮点相乘造成边界误差。
- 伤害随机数改为离散整数 85..100，而不是连续浮点比例。
- 会心倍率改为 1.5；Sniper 在会心倍率上继续乘 1.5；会心阶段概率对齐为 1/24、1/8、1/2、1。
- 灼伤的物理伤害减半移到最终修正阶段；Facade 跳过灼伤减伤。
- STAB、Adaptability、太晶 STAB 上限及天气、场地、沙暴岩石特防均按参照顺序执行。

修改文件：

- `src/features/game/battle/engine/resolveDamage.ts`
- `src/features/game/battle/engine/resolveDamage.test.ts`
- `src/features/game/battle/engine/resolveActionSelection.ts`

3. 对齐项目招式池中的特殊伤害和威力公式

- 固定伤害：Dragon Rage、Sonic Boom、Seismic Toss、Night Shade。
- 当前 HP/双方 HP：Super Fang、Endeavor、Flail、Reversal、Eruption、Water Spout。
- 等级随机：Psywave。
- 体重：Low Kick。
- 亲密度：Return、Frustration。
- 分布抽样：Magnitude、Present。
- 连续使用：Fury Cutter、Rollout、Ice Ball，并在失败或换招后重置。
- 反击与蓄力：Counter、Mirror Coat、Spit Up、Revenge。
- 条件加倍：Facade、Smelling Salts、Knock Off。
- 一击必杀：Guillotine、Horn Drill、Fissure、Sheer Cold，含等级命中率和冰属性免疫。
- 场景修正：Grassy Terrain 下的 Earthquake/Magnitude、缩小状态下的 Stomp/Body Slam、潜水状态下的 Surf/Whirlpool。
- 天气修正：Solar Beam 在雨、沙暴、冰雹下减半；Synthesis、Moonlight 按晴天 2/3、恶劣天气 1/4、其他天气 1/2 恢复。
- HP/能力变化：Pain Split、Belly Drum、晴天下的 Growth。
- Hidden Power 使用个体值计算动态属性；Freeze Dry、Flying Press、Thousand Arrows 使用独立属性覆盖。

修改文件：

- `src/features/game/battle/engine/resolveDamage.ts`
- `src/features/game/battle/engine/resolveMoveType.ts`
- `src/features/game/data/battle/moveEffectTable.ts`
- `src/features/game/hooks/useBattleController.ts`
- `src/types.ts`

4. 对齐命中与速度计算

- 命中随机改为 0..99 整数并使用严格小于比较。
- 对齐命中/闪避阶级、No Guard、Compound Eyes、Hustle、Tangled Feet、Sand Veil、Snow Cloak。
- 对齐 Toxic、Thunder、Blizzard、Minimize 命中特例以及一击必杀招式的独立命中公式。
- 对齐麻痹速度 0.5、Quick Feet 和天气速度特性；Air Lock/Cloud Nine 会抑制天气计算。

修改文件：

- `src/features/game/battle/engine/resolveAccuracy.ts`
- `src/features/game/battle/engine/resolveActionSelection.ts`
- `src/features/game/data/battle/abilityEffects.ts`

5. 对齐完整属性克制和免疫反应

- 补齐 18 × 18 共 324 个基础属性组合，并对双属性逐项相乘。
- 增加 Stellar 对太晶目标的倍率规则。
- 对齐 Scrappy、Gravity、Thousand Arrows、Freeze Dry、Flying Press、Hidden Power 和 Sheer Cold 特例。
- 对齐 Levitate、Wonder Guard、Soundproof 以及吸收/免疫特性。
- 对齐 Reflect、Light Screen 的单打减伤、会心与 Infiltrator 旁路、Brick Break 破墙；Foresight 会移除幽灵免疫并忽略闪避阶级。
- 免疫特性不仅返回 0 倍伤害，还会触发 Water Absorb、Volt Absorb、Dry Skin、Earth Eater、Lightning Rod、Storm Drain、Motor Drive、Sap Sipper、Well-Baked Body、Flash Fire 的恢复或能力变化。
- Mold Breaker、Teravolt、Turboblaze 会绕过可被无视的防守特性。

修改文件：

- `src/features/game/battle/engine/resolveTypeEffectiveness.ts`
- `src/features/game/battle/engine/resolveTypeEffectiveness.test.ts`
- `src/features/game/battle/engine/resolveTypeImmunityReaction.ts`
- `src/features/game/battle/engine/index.ts`

6. 对齐非易失异常状态

- 睡眠：计数以 2 或 3 初始化，概率分别为 1/3 和 2/3；按 Pokerogue 的行动阶段实际阻止 1 或 2 个回合；Early Bird 调整计数。
- 冰冻：计数 3，每次行动有 25% 解冻，计数归零强制解冻；可自解冻招式和火属性命中解冻目标均已接入。
- 麻痹：不能行动概率改为 1/8，速度倍率 0.5。
- 中毒：每回合扣除最大 HP 的 1/8。
- 剧毒：按 `floor(最大 HP × 计数 / 16)` 递增，换人时重置为普通剧毒初始计数。
- 灼伤：回合末扣除最大 HP 的 1/16，并参与物理伤害最终修正。
- 补齐属性、天气、场地、Safeguard、Corrosion 和状态免疫特性的施加条件。
- 对齐 Synchronize、Hydration、Shed Skin、Natural Cure、Magic Guard、Poison Heal、Heatproof 等状态交互。

修改文件：

- `src/features/game/utils/battleStatus.ts`
- `src/features/game/utils/battleStatus.test.ts`
- `src/features/game/battle/engine/resolveBeforeMoveChecks.ts`
- `src/features/game/battle/engine/resolveEndTurn.ts`
- `src/features/game/battle/engine/resolveSwitchState.ts`
- `src/features/game/battle/engine/resolveSwitchState.test.ts`
- `src/features/game/lib/battleResolution.ts`
- `src/features/game/lib/battleResolution.test.ts`

7. 对齐会影响计算的易失状态和回合生命周期

- Confusion 改为 2..5 回合，自伤概率 1/3，自伤使用 40 威力并带 85..100 离散随机数。
- 对齐 Flinch、Infatuation、Yawn、Nightmare、Curse、Taunt、Torment、Encore、Disable、Uproar、Protect、Substitute 的现有计算入口。
- 修复二级效果重复掷 Flinch 概率的问题。
- 自身目标招式不再被旧目标快照覆盖。
- Safeguard 改为队伍侧持续状态；Aromatherapy、Heal Bell 执行全队治愈，Refresh 只处理自身允许的状态。
- 对齐 Focus Energy、Haze、Psych Up，以及 Leech Seed、持续束缚、Ingrain、Perish Song 的施加、回合末计算和换人清理。
- 换人时清理临时锁定、连续威力、受伤记录和 Stockpile，并保留队伍侧 Safeguard。
- 存档加载和 API 初始化补齐新增战斗状态字段，避免恢复战斗时丢失或产生非法计数。

修改文件：

- `src/features/game/battle/engine/resolveBeforeMoveChecks.ts`
- `src/features/game/battle/engine/resolveEndTurn.ts`
- `src/features/game/battle/engine/resolveSecondaryEffects.ts`
- `src/features/game/battle/engine/resolveSwitchState.ts`
- `src/features/game/lib/battleResolution.ts`
- `src/services/pokeApi.ts`
- `src/services/saveManager.ts`
- `src/types.ts`

8. 对齐会改变上述结果的特性、天气和场地

- 伤害侧补齐 Adaptability、Defeatist、Solar Power、Ice Scales、Huge Power、Pure Power、Hustle、Guts、Fur Coat、Marvel Scale、Technician、Iron Fist、Strong Jaw、Mega Launcher、Sharpness、Tough Claws、Reckless、Water Bubble、Toxic Boost、Flare Boost、Steelworker、Rocky Payload、Transistor、Dragon's Maw、低 HP 属性增幅、Tinted Lens、Neuroforce、Punk Rock、Thick Fat、Dry Skin、Purifying Salt、Fluffy、Filter、Solid Rock、Prism Armor、Multiscale、Shadow Shield、Sheer Force、Flash Fire。
- 天气侧补齐免疫、恢复和扣血特性；Air Lock/Cloud Nine 会同时抑制伤害、命中、速度、状态治愈和回合末天气效果。
- 场地侧补齐接地判定、Misty/Electric 状态阻止和 Grassy 回血。
- 补齐 Dream Eater 的睡眠条件、Damp 对自爆招式的阻止、Sturdy 的一击必杀免疫，以及 Rock Head/Magic Guard 的反作用力免疫。

修改文件：

- `src/features/game/data/battle/abilityEffects.ts`
- `src/features/game/battle/engine/resolveDamage.ts`
- `src/features/game/battle/engine/resolveAccuracy.ts`
- `src/features/game/battle/engine/resolveActionSelection.ts`
- `src/features/game/battle/engine/resolveEndTurn.ts`
- `src/features/game/lib/battleResolution.ts`

9. 验证结果

- `npm test`：90/90 通过。
- `npm run lint`：TypeScript `tsc --noEmit` 通过。
- `npm run build`：Vite 生产构建通过，共转换 2211 个模块。
- `git diff --check`：通过，仅有 Git 对现有 LF/CRLF 转换的提示，无空白错误。
- 工厂招式池固定为 772 套配置、277 种唯一招式，并记录排序后名称集合的 SHA-256；招式集合发生任何变化都会要求重新审计。
- 属性表有 324 组穷举断言；公式、离散随机、命中边界、异常回合数、换人清理、特性旁路和状态免疫均有回归断言。

最终结论：原项目的三类计算不完整；按上述固定 Pokerogue 提交对齐后，本文范围内的实际计算分支已完整覆盖。后续若更新 Pokerogue 基线提交，必须重新执行“工厂招式集合与上游特殊属性求交集”的审计，并重新运行全部验证，不能把本记录自动视为新提交下仍然完全一致。
