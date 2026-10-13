# 固定 TM 运行数据独立静态审计

## 裁决

**PASS（仅固定数据模块的静态门禁）**。审计代码为 `427130f1b24903651871ef6eda8842d79ec1314d`，基线 `33557dee7004095c3bfb10daabeccb94982a2235`。未修改业务代码、共享状态或生成数据；未提交，未启动游戏、开发服务或浏览器。商店购买、学习和 50 招效果不在本次通过范围。

## 需求与实现对齐

| 契约 | 独立核查与结果 |
| --- | --- |
| F1 / AC1 固定来源 | 核对原始 `src/pokemon.c:5286` 的 `CanSpeciesLearnTM`，确为普通 profile 的 TutorMoves 与 LevelUpMoves 并集；既有 extractor 固定提交、1156 普通 profile、1519 别名、14645 原始配对及原始内容摘要。新生成器复用严格提取、对后端 50 键逐项及有序摘要复核，01–50 完整无重复。 |
| F2 / AC2 身份与学习资格 | 独立脚本直接读取每份源 profile，未调用 extractor 的资格函数，逐项对比生成产物的 1076 个身份与 9981 个映射后配对，全部一致。核对 1025 基础、51 具名形态与 10 个显式例外的符号/profile 证据。 |
| F2 / AC2 严格失败 | `resolveFixedTmIdentity` 要求正整数 pokemonId/speciesId，按实际 pokemonId 查找，并校验 speciesId 与可选 identifier；未知形态不会回退基础物种。未知、不兼容、已学与冲突均能区分；队伍联集只列可学且未学成员。 |
| F3 / AC3 准入隔离 | 所有 50 项仍为 pending，固定正文/战斗证据/价格均 null；`saleEligible` 恒为 false，学习资格不绕过这些门槛。无调用者授权开关，无商店状态或交易改动。 |
| F4 / AC4 加载边界 | 唯一入口动态 import 查询模块；失败分支清空应用层 Promise 并重新抛出，后续调用可重新尝试。运行模块不读研究 output、不回源 GitHub、不 fetch 资格。当前生产代码没有引用，构建未产生 TM chunk；不据此宣称已测试浏览器 chunk 网络故障或离线 PWA。 |
| F1 / AC1 可复现与失败写入 | 有源全量重生成字节一致。另独立调用 CLI：错误源码提交在写入前拒绝，两份现有产物 SHA256 与 mtime 均不变；正确源 `--check` 后二者也均不变。源/映射/清单验证完整结束后才进入写文件阶段。 |
| F1 / AC1 换行与摘要 | 原始 Rogue 文件按原字节严格核验；项目文本摘要明确 CRLF→LF。局部 `.gitattributes` 只影响本任务新增产物。`--check` 对生成结果仍逐字节核对，不因摘要规范化放宽检查。 |

## 独立门禁

| 命令/检查 | 最终结果 |
| --- | --- |
| `npm.cmd run lint` | PASS，退出 0 |
| `npm.cmd test` | PASS，302/302，0 fail、0 skipped |
| `npm.cmd run build` | PASS，2240 modules；既有入口大于 500 kB 提示仍在 |
| `go test ./...` | PASS，四个有测试的包通过，server 无测试文件 |
| 设置 `ROGUE_TM_SOURCE=D:/Games/pokeFactory2/output/rogue-expansion-reference` 后，`node --test scripts/extract_rogue_tm_compat.test.cjs scripts/generate_fixed_tm_runtime.test.cjs` | PASS，11/11，0 skipped；含固定真实源码全量核对 |
| 独立原始 profile 对比 | PASS，1076 身份、9981 映射后配对 |
| 错误源 CLI / 正确源 `--check` 的摘要与 mtime 比对 | PASS，拒绝/只读检查均不写产物 |
| `git diff --check 33557de..HEAD` | PASS |

## 首次失败与安全修正

首次 lint **失败**：程序员在门禁后留下的 `output/tm-checkout-reproduction/src/features/game/data/fixedTm/generated.ts` 被 TypeScript 扫入，不完整复现副本缺少 `./types`。Git ignored 不能阻止 tsc 扫描。

经确认这是本任务派生副本并核对绝对路径后，以 `Move-Item -LiteralPath` 将整个目录保留并移动到 `D:/Games/pokeFactory2-worktrees/_audit-evidence/fixed-tm-checkout-reproduction`。未删除或修改主工作区 output，未改 tsconfig。`implementation.md` 已更正今后的 `checkout-index --prefix` 应指向工作树外专用暂存。移走后重新执行四项门禁，以上为最终结果。

## 后续边界

- 当前准入仍为 **0/50**；固定正文、逐招效果、价格、购买学习事务与实际页面尚待后续任务。
- 动态 import 异常恢复做了静态分支审查，本轮没有浏览器网络故障证据；接入生产调用方时需验证实际 chunk 加载失败与恢复行为。
- 生成器先校验后写入可以避免无效来源产生半套数据；它不是跨文件文件系统事务，本次不承诺断电或磁盘 I/O 故障时双文件原子落盘。`--check` 可发现产物不一致。
- 无浏览器实玩、实体手机或生产环境通过声明。无待 orchestrator 路由的代码阻断项。
