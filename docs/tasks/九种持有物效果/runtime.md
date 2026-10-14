# 九种持有物效果：最终代码实玩

## 裁决与证据范围

最终代码：`6d9577268df1e45207bdd54d8ec2f8ae08a7564e`。本报告仅评价九种持有物、必要的挣扎/回复封锁链及其指定手机模拟视口；不评价整个公开版是否完成。原 `272f360` 的终局 console 缺陷保留在 `runtime-attempt-272f360.md`，没有把旧截图复制为本版通过证据。

**本任务指定实玩矩阵 PASS：102份完整结果（1份自然基线、101份受控），各断言通过，完整结果内 console/pageerror、HTTP≥400、requestfailed 均为0。** 2026-10-14 10:12:44 +08:00 已确认全部浏览器批次结束，业务源码仍无差异。结合独立371项静态门禁，可交orchestrator进行本任务验收与合入决定。

通过包包含965份证据文件、181,370,443字节（不含manifest自身）；manifest SHA256：`7e0645da74e4a6acb1e52355b385c6d595f85ba39e203bdc29477f11a4383be6`。历史目录另列在manifest中，未计入以上通过文件/用例。

最终汇总与每件原始文件的 SHA256 以 `evidence/final-6d95772/manifest.json` 为准。该清单逐例列明断言、操作截图标签和布局尺寸；只纳入完整结果，不纳入中断目录或已识别的 harness 失败目录。概率/数值全部组合由独立静态审计覆盖，不能把下表的 UI 样本推成精确概率统计。

## 环境与手段

- 日期：2026-10-14。首次执行在约02:49开始，用户中断后约09:49核对现场续接。SHA与业务文件未变；完整结果只读跳过，7份中断目录以 `interrupted-*` 保留。
- 工作树：`D:\Games\pokeFactory2-worktrees\held-item-effects`。
- Go `3006`，cwd为该工作树根；Vite `0.0.0.0:4305`，真实 `/api` 转发到Go，`DISABLE_HMR=true`。首次session `15208/20965`，中断后确认进程已停，再启动session `87275/41560`。健康及内容版本见 `environment.json` 和 `resume-environment.json`。
- Chromium `151.0.7922.34`，touch、DPR2，主视口 `390×844`；实际补测 `320×568`、`844×390` 的挣扎点击、出招、日志和刷新，并检查下一战页面。
- **不是实体Android Chrome，也不是生产环境。** 不声称有实体触控、地址栏、切后台、弱网或部署验收。
- 唯一自然基线：新档确认伊布、开始挑战、自然六选三到首战READY。其余例全部以该保存为起点，使用当前生产 `createSaveData` 规范化后注入明确场景/数值/招式选择/道具/能力/限制；无 DEV Win，无游戏时钟加速。
- 普通招式来自真实Go原始响应→最终生产 `buildMoveBattleDataFromPokeApiMove`。`move-sources/*` 保存原始响应字节、SHA256、URL和built正文；没有手工补contact或其它battleData。指定招式仍属受控选择，不能称自然抽中。
- `result.json` 保存 RNG 调用值及stack。一般场景固定`.5`；镜临界`.1`、爪`.01`、骰`.4/.6`、王者原生`.9`与道具`.01`等逐例可追踪。下一战生成前恢复真实 `Math.random`。
- UI行为通过实际按钮 tap 执行。存档是完整检查点；即时倒下/结果日志另用**只读** React viewModel，不调用setter/handler/引擎。终局自动恢复后的HP/PP不当作战内伤害结论。

## V1–V10 规则与实际证据

以下路径均相对于 `evidence/final-6d95772/`，每例有 `injected-save.json.gz`（受控例）、截图、完整存档及只读runtime快照、可见文本、`result.json`。

| ID | 本版实际UI覆盖 | 关键证据 | 精确静态覆盖/边界 |
| --- | --- | --- | --- |
| V1 焦点镜 | 双方有镜/无镜同数值roll对照，暴击日志差异，非消费 | `scope-player-lens/bare`、`scope-enemy-lens/bare` | 暴击等级数学边界和状态技不变伤害见heldItemEffects.test；UI不估计概率。 |
| V2 先制之爪 | 双方慢速爪在同优先级先动；对方更高优先级仍先动；各侧一次/PP一次/物品保留 | `claw-player/enemy-same/priority` | 双爪、无发动、空间、同速组合由独立静态审计覆盖。 |
| V3 王者之证 | 双方恶之波动原生失败但道具成功，目标当轮停动、下一轮恢复；精神力、保护、已行动、强行反例 | `king-native-fail-item-pass-player/enemy`、`king-counter-*` | 两独立roll、RNG顺序、多段/替身/flags等完整条件见静态审计；28%/37%为推导，非UI频率。 |
| V4 讲究头带/挣扎 | 双方实际锁招→锁招PP0且另一招仍有PP→挣扎；换出清锁/换回可另招；拍落保留装备基准、可选水枪；挣扎打幽灵、坚硬脑袋不免反作用/魔法防守免、保护不扣反作用 | `choice-lock-fallback-player/enemy`、`choice-switch-clears-lock`、`choice-knock-off-alternative`、`struggle-ghost-*`、`struggle-protect-counter` | 物理1.5/特攻不加成、无STAB/完整相性数值、其它选招限制矩阵由静态测试；UI验证真实fallback与槽/PP/锁不变。 |
| V4 双倒结算 | 玩家/敌方发动，双方无后备/仅我方/仅敌方/双方有后备；正确LOSS/WIN或双方补位。敌方后备再死于岩石不留陈旧补位；只结算一次 | `struggle-terminal-observation-2`、`struggle-double-player/enemy-*`、`struggle-double-entry-hazard-win` | 终局probe只读轨迹确认双方HP0、原招PP0；原地7秒console干净。完整8矩阵也有生产回调静态证据。 |
| V5 气势头带 | 同一成员连续两次致命撑1HP，双方当前道具/基准均仍在；失败roll与中毒间接致死正常补位 | `focus-repeat-player/enemy`、`focus-untriggered`、`focus-indirect-poison` | 多段逐击、非致命不roll与边界精度由静态验证；UI不靠重新装备制造“可重复”。 |
| V6 厚底靴 | 双侧靴/无靴、接地毒/飞行毒共8入场例；接地毒穿靴仍吸毒菱，非毒穿靴留层且不毒，飞行毒不吸；我方主动换人、敌方倒下补位；另我方倒下后穿靴补位 | `boots-entry-player/enemy-*`、`boots-player-forced-replacement` | 对方主动换人AI未单独强制；实际补位经过其生产入场路径。未增加撒菱/黏网。普通伤害不免由静态双侧验证。 |
| V7 机变骰子 | 双侧4/5段、单发及固定二连踢不变；一次PP/非消费；无骰与连续攻击对照、目标早倒停止 | `dice-player/enemy-four/five/single/fixed`、`dice-counter-*` | 特殊多段不扩展，随机分界与逐击计数由静态校验。 |
| V8 白色香草 | 双侧蛮力自降、真实contact撞击王者盾牌、自身正等级保留，消费一次；非接触高速星星反例；消费后刷新仍不返还 | `white-player/enemy-superpower/tackle/swift`、`white-player-tackle/reload.*` | raw无flags→生产builder补真实contact，未注入contact；状态技miss/保护等完整回归仍见静态集，不拿旧状态任务图片当新版实玩。 |
| V9 心灵香草 | 双侧同时六限制和迷恋两别名解除、清绑定信息、一次消费；无限制/普通毒与混乱反例；真实回复封锁当次触发香草让后手Recover正常执行；消费后刷新稳定 | `mental-player/enemy-all/none`、`mental-ordinary-status-counter`、`heal-block-natural-herb`、`mental-consumption-refresh` | 六项合并起点是受控标签清除；自然封锁施加另列，不混称六招自然生成。 |
| V10 持久与下一战 | 白草/心草消费后刷新不复活；封锁计时刷新不重置；挣扎原PP0/反作用血量刷新不重复；实际UI清敌→胜利→跳换→新敌生成→第2战，两草按基准返还，能力等级清零 | `hb-five-rounds-refresh`、`struggle-viewport-refresh`、`herbs-next-battle-return` | 返还场景敌队HP1属受控，没有DEV Win；心草为受控已消费基准，实际消费路径另有前述证据。不等于自然七战。 |

## 回复封锁必要链

| 功能 | 实际UI结果与证据 |
| --- | --- |
| 普通施加/回合计时 | `heal-block-natural-bare` 无草阻止后手Recover，PP不扣；施加回合末剩4。`hb-apply-repeat` 不续期；`hb-apply-protect/substitute/aroma` 分别阻挡/穿替身/芳香幕阻挡。 |
| 执行时重新检查 | `hb-enemy-fast-cancel-recover` 更快敌方封锁取消我方已选Recover；`hb-absorb-entire-cancel` 不伤目标也不吸血；`hb-rest-no-status-cure` 不回血/不清毒/不扣该招PP。 |
| 选择与换人 | `hb-select-disabled-switch-clear` Recover灰禁、仍有Tackle不出现挣扎；真实换人后旧成员封锁清除。全部禁用fallback及梦话候选由独立生产回调静态审计。 |
| 目标治疗 | `hb-target-heal-pulse/floral-healing-none/target` 无封锁只治疗目标，目标封锁不治疗；施招者门禁已在共同选招/执行静态覆盖。 |
| 道具与场地 | `hb-item-leftovers/sitrus_berry/shell_bell` 不回复且HP果不白耗；`hb-grassy-ingrain` 封锁方不回血，另一方仍回复，扎根仍在。 |
| 种子/污泥浆 | `hb-seed-ordinary/ooze` 目标仍扣血，封锁受益者不回血；污泥浆仍损受益者，不误免伤。 |
| 吸收免疫与天气 | `hb-absorb-water-absorb/volt-absorb/earth-eater/dry-skin` 免疫保留、不回血；`hb-weather-*` 雨盘/干燥皮肤/冰冻之躯不回血，晴天皮肤损血和冰雹免伤保留。 |
| 例外 | `hb-pain-split-exempt` 均分仍可增HP；`hb-present-exempt` 真实礼物回血分支仍有效。再生力/祈愿未有完整执行器，不制造通过证据。 |
| 第5轮顺序/刷新 | `hb-five-rounds-refresh` 自然施加后第2轮刷新仍剩3，第5轮末剩饭仍不回，第6轮回25；`hb-fifth-endturn-order` 最后一轮青草/扎根/天气/文柚果都不回、果不耗，状态随后到期，下轮正常回血和消费。 |

## 手机视觉与交互

主流程390触控完成全部用例。`struggle-viewport-refresh` 在320和844实际点击挣扎，保留前后HP/PP和截图，再刷新核无重复动作；`herbs-next-battle-return/next-320.png`、`next-844.png` 展示最终返还后的新战布局，页面 `scrollWidth<=innerWidth`。

人工查看小屏与横屏截图：战斗面板、主要日志、招式与底部菜单可见，无重叠/横向溢出；竖屏上下布局、横屏左右布局成立。这里只覆盖本任务页面和关键日志，不把模拟截图当作全站手机无障碍或实体手机通过。

## 原始失败与排除纪律

- 272版本的真实业务console缺陷见独立尝试报告，6d版本终局重验已消除。
- `harness-attempt1-*` 是本版自动脚本的可解释误判原件：补位提示等待词不匹配；按钮姓名在父卡而非按钮内；敌方固定`.5`合法选择第二招；礼物`.9`恰好miss；终局日志应读viewModel而非旧检查点；点击跳换后才复位RNG导致敌队重复采样。已分别修正harness、保留原件、重跑新同名完整结果，不修改产品。
- 这些失败目录及7个中断目录不是通过证据；最终manifest显式列出历史目录，避免混入通过数量。成功清单要求每项断言真、无failure、无console/pageerror/HTTP≥400；完整结果中的requestfailed另行记录。

## 尚未证明的边界

- 全自然七战、自然概率统计、全部随机招式的正确性未由本任务证明。既有接棒/祈愿执行器和自然raw.moves未过滤等公开版差距继续保留。
- 第九代全部复杂互动（如未实现彩虹/双打/亲子爱）没有借九件道具样本宣称完整。
- 整个公开版的实体Android、生产部署/弱网/回滚和最终reviewer门禁仍待后续。
- 本角色没有写业务代码、没有提交证据或合并；交orchestrator读清单、验收及归档。
