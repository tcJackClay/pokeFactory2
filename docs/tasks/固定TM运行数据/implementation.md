# 固定 TM 运行数据实施记录

## 范围与结果

在 `codex/fixed-tm-data`、基线 `33557dee7004095c3bfb10daabeccb94982a2235` 完成批准的独立数据模块。未修改战斗控制器、存档、商店/交易/UI、后端种子或现有首屏加载路径。状态为**静态数据已验证**，等待独立 auditor；没有浏览器实玩，也不宣称 TM 购买/学习已接入。

- 固定 Rogue `a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014`、ordinary profile；沿用已校验的提取函数及 10 条显式形态例外。
- 完整 50 项 `Move.name` 与跟踪的后端 50 个种子键逐项一致。`freeze-dry` / `quiver-dance` 保留，现有运行缓存缺正文不影响身份台账，也不视为正文已就绪。
- 1076 个工厂身份（1025 基础 + 51 具名形态）均有明确源 profile。上游 1156 profile、1519 别名、14645 原始兼容配对；运行数据只保留项目映射范围。
- 查询按真实 pokemonId + speciesId 解析；显式 identifier 有冲突也拒绝。未知形态不回退基础物种。来源可学、已掌握、不兼容、未知身份、冲突身份、非固定 TM 都有可观测结果。
- 三人资格联集保留可学且未学的成员索引。全部 50 项仍为 pending，固定正文/效果证据与价格为空，售卖结果恒为 false。未删项、未定价、未准入。
- `loadFixedTmCatalog()` 为按需入口，成功加载复用 Promise，失败清空缓存并重新抛出，下次允许重试。运行查询不请求外部数据，也不读取 output。

## 使用入口

```ts
import { loadFixedTmCatalog } from './src/features/game/data/fixedTm';

const fixedTm = await loadFixedTmCatalog();
const member = { identity: { pokemonId: 25, speciesId: 25 }, knownMoveNames: [] };
fixedTm.getFixedTmEligibility(member.identity, 'thunder-wave', member.knownMoveNames);
// status: eligible，仅表示固定来源可学且未学
fixedTm.getFixedTmSaleReadiness('thunder-wave', [member]);
// saleEligible: false，缺准入、固定正文、效果验收、批准价格
```

调用方不应把基础 speciesId 当作未知形态的 pokemonId；本轮没有 GamePokemon 名称猜测适配器。后续商店任务需要接入真实身份、冻结货架与原子学习交易，再完成逐招实玩。

## 可复现生成

```powershell
node scripts/generate_fixed_tm_runtime.cjs --source D:/Games/pokeFactory2/output/rogue-expansion-reference
node scripts/generate_fixed_tm_runtime.cjs --source D:/Games/pokeFactory2/output/rogue-expansion-reference --check
$env:ROGUE_TM_SOURCE='D:/Games/pokeFactory2/output/rogue-expansion-reference'
node --test scripts/extract_rogue_tm_compat.test.cjs scripts/generate_fixed_tm_runtime.test.cjs
```

源路径可换成任意同提交、同内容的本地 checkout。生成器读取固定源 + 跟踪的工厂索引/后端种子，不读取旧临时抽取文件。先完整构建校验所有结果再写指定两份产物。`--check` 无写入，缺文件、漂移或来源变化返回非零，不自动修复。

provenance 记录源路径、源文件及脚本/项目输入摘要、1076 份映射证据、生成数据摘要与资格缺口。不记录机器绝对路径或当前时间，重复生成逐字节一致。Rogue 源文件摘要保留原始字节；项目文本输入摘要明确标注为 UTF-8、CRLF 归一化为 LF，避免 Windows checkout 造成虚假输入变化。局部 `.gitattributes` 仅约束新模块、新任务目录及两份新脚本为 LF，不改变其他文件规则；产物核对仍是严格字节比较。

## 静态验证

| 命令 | 结果 |
| --- | --- |
| `npm.cmd run lint` | PASS，退出 0 |
| `npm.cmd test` | PASS，302/302，0 fail，0 skipped |
| `npm.cmd run build` | PASS；2240 modules；已有主入口超过 500 kB 提示仍存在 |
| `go test ./...` | PASS，sync/assets/content/web 包；server 无测试文件 |
| `node --import tsx --test src/features/game/data/fixedTm/fixedTm.test.ts` | PASS，9/9 |
| 设置 ROGUE_TM_SOURCE 后运行上述两份 CJS 测试 | PASS，11/11，0 skipped；包含实际全量抽取、两次字节一致重生成和 CRLF/LF 摘要稳定性 |
| `git checkout-index` 导出输入与产物后，在新副本运行 `--check` | PASS；本机 `core.autocrlf=true`，项目旧输入转 CRLF，新产物保持 LF，仍严格一致 |

测试覆盖真实映射逐行与提取器比对、全 1076 × 50 资格查询、全国图鉴边界、10 条形态例外、洛托姆形态差异、零兼容物种、未知/冲突身份、已学排除、队伍资格联集和全部50项不可售。`--check` 用临时文件验证缺失/漂移时不修复、成功时不改 mtime。Node 中禁用 fetch 后按需加载和资格查询仍成功。

换行修正后完整重跑四项门禁，结果仍为上述 PASS。独立检出副本仅位于 ignored `output/tm-checkout-reproduction/`，不作为运行依赖或提交内容。

## 体积与当前构建边界

| 文件 | UTF-8 原始字节 | gzip 字节 | SHA256 |
| --- | ---: | ---: | --- |
| `src/features/game/data/fixedTm/generated.ts` | 143019 | 24708 | `e4139668c13c46981818547a24c9a15b7d0af30ad70c37c74167bf61c04f7277` |
| `docs/tasks/固定TM运行数据/provenance.json` | 539189 | 39889 | `2aa398500678fcd490212cc87b8f96c57caa124993abf605a06f5b79fe2d5423` |

这是源文件压缩体积，不是假称真实 HTTP 传输量。provenance 不参与浏览器导入。当前没有生产页面引用 fixedTm 模块，Vite 成功构建且未把它加入首屏或输出 TM chunk；后续调用方接线后才会生成按需 chunk，需要届时再核实际包体。没有新增首屏请求，没有宣称具备离线 PWA 缓存。

## 后续边界

1. 独立 auditor 尚待执行；本任务没有实玩/实体手机证据。
2. 50 项固定正文、战斗效果、批准价格、原子购买学习与实际商店上架仍是后续任务；当前准入 0/50。
3. 已批准的严格身份会对缺失或未映射的新形态返回未知；需补源证据后显式扩表，不放宽到基础形态。
4. 公开发行的数据/素材权利仍由目标级发布门槛独立处理。
