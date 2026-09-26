# TM17 与 TM33 固定内容覆盖计划

只读基线：项目 `577877a`，Rogue expansion `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014`。本地审计 `scripts/audit_rogue_tm_effects.mts` 只遍历 `var/pokeapi/runtime/v2/*.json` 的 `meta.key`，并校验对应 body 哈希；当次 50 招中 48 招命中、`move/freeze-dry` 和 `move/quiver-dance` 未命中。再次只读扫描当前 1442 份运行缓存元数据，两键仍均无记录。这说明本机此前没有留下这两项**开发运行缓存**，不能推断 PokeAPI 上游没有招式，也不能由其他物种 JSON 中的招式链接代替招式正文。Rogue 固定表确有 TM17 `MOVE_FREEZE_DRY` 与 TM33 `MOVE_QUIVER_DANCE`；项目的 `fetchMoveByName` 实际请求同源 `/api/pokeapi/move/{name}/` 并将正文送入 `buildMoveBattleDataFromPokeApiMove`。

当前 `var/current.json` 与兼容位置 `var/pokeapi/current.json` 均不存在，故没有已激活的**固定 PokeAPI 内容版本**。`backend/config/sync-manifest.json` 的基础键只有宝可梦总表和 18 个属性，另有三个 CSV，不含这两项招式。`backend/cmd/sync/factory_seeds.go` 从物种、参考 set 配招形成工厂种子，再由 `pokemon` 正向发现其 `moves`；固定 50 TM 奖励表不是当前种子来源。因此即便将来生成一代或九代工厂版本，也不能仅凭随机配招闭包断言两项及其余 48 项奖励 TM 都在版本内。尤其 `-factory-generation` 会以选中世代种子取代基础 PokeAPI 种子，单独往基础清单加两个键无法覆盖这一模式。

## 最小实施路径

1. 在固定 Rogue TM 抽取物中形成版本化的 50 项 `TM → move/{name}` 清单，显式核对 TM17=`move/freeze-dry`、TM33=`move/quiver-dance`、总数 50、无重复、源 SHA/输入摘要一致。把清单并入工厂版本的种子集合，适用于 `-factory` 和 `-factory-generation=1..9`；抽样试验模式可只加明确指定的测试键，避免无意放大试验。不要在浏览器运行时用随机物种 `moves` 或 PokeAPI `machine` 重建 TM 表。为两个键增加固定测试，并将全部 50 TM 键计入内容覆盖报告。
2. 在隔离 state 准备新 PokeAPI 版本，保持现有条目数、字节、时限封顶与失败清理。核对 `manifest.entries` 中两个精确键、正文文件存在、SHA256 和大小吻合、JSON 可解析，正文 `name`、`id`、属性、伤害类别、PP、`meta`、`stat_changes` 等必需字段有效；再从该版本通过同源 Go 内容接口分别读两项，确认 `X-Content-Store: VERSION`。TM17 的 `FREEZE_DRY` 水属性特殊相性，以及 TM33 的自身特攻/特防/速度各 +1，仍须按 `tm42-verification-matrix.md` 的**战斗结果**单独验收，资料齐全不等于可发卡。
3. `-factory` 与 `-factory-generation` 目前均只 `PrepareVersion`，日志明确写“not activated”；不要把准备完成当公开发布。现行常规模式会调用 `ActivateRelease`，但 `-full` 的通用递归不是工厂发布捷径。完成全九代工厂与 CSV 的固定版本、图片和内容闭包校验后，需要一个受控的激活步骤把**同一验证过的版本**设为活动指针，保留旧版本以回滚；若现有 CLI 无适合的“验证后激活”入口，则另立发布切片补该入口和原子/失败测试。当前阶段不下载也不激活。
4. 发布 Go 服务配置 `ALLOW_UPSTREAM_FETCH=false`，网页继续使用默认同源 `/api/pokeapi`，不覆盖为外部 PokeAPI 地址。清浏览器与服务运行缓存后，两个请求均须来自 `VERSION`，外部 PokeAPI 断连时仍返回相同正文。弱网下同源请求有现成超时/重试，但需测试加载失败后留在奖励节点、给重试提示、不会扣券或吞 TM。若用户设备彻底断网且网页本身未缓存，本计划不声称可离线游玩；那需要另行验证服务工作线程或离线包。

## 验收与失败封闭

- 静态：在空 state 的假上游测试中，仅提供这两项和最小工厂种子，断言工厂 prepared manifest 含两键且 body 哈希正确；缺一键、字段损坏、超限、超时均失败，活动 `current.json` 不变。九代种子测试逐代断言固定 TM 键被加入，不受当前世代物种招式列表是否含这两招影响。覆盖脚本分别报告开发缓存命中、固定版本命中，不把 `RUNTIME` 或 `UPSTREAM` 算作发布覆盖。
- 内容服务：隔离已激活版本、关闭上游、清运行缓存后，请求 `/api/pokeapi/move/freeze-dry/` 与 `/api/pokeapi/move/quiver-dance/` 均 200、`X-Content-Store: VERSION`、name 与固定 ID/摘要一致；故意移除版本中的一个键时必须有明确 `content_not_synchronized` 或构建前校验失败，不得静默改走上游。
- 前端与实战：从真实同源响应经 `fetchMoveByName` 加载，TM17 显示和施放，水目标克制倍率正确；TM33 展示可学对象并施放，使用者三项能力各 +1。完成奖励冻结、领取、替换、刷新与下一战路径；资料请求失败时不领取、不扣券、不推进奖励状态。玩家侧手机浏览器 390×844、844×390 各留画面与网络证据。
- 权利：固定内容版本与源码研究清单仅解决技术可用性。Rogue profile/招式表、PokeAPI 正文、宝可梦名称和形象分别核对来源、许可及公开网页使用权；非商业与署名均不构成已获授权结论。权利未定前该版本只供隔离技术验收，不能标记公开发布通过。
