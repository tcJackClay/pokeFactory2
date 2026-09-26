# 工厂有限闭包同步首切片

新增 `backend/cmd/sync -factory`：从现有工厂索引生成候选 `pokemon` 种子，检查 1–1025 基准 ID、允许直接抽取的特殊形态及参考 set 物种；禁用物种 201 被排除。参考 set 的固定招式也作为种子。基础清单仍并入同一 PokeAPI 版本，CSV 按原流程准备。原 `-full` 的通用递归模式保留，`-full` 与 `-factory` 互斥。

工厂闭包只从 `pokemon/{identifier}` 响应中的 `species.url`、全部 `abilities[*].ability.url` 和全部 `moves[*].move.url` 发现子键。只接受本地 `/api/pokeapi/` 或 PokeAPI 根路径，排序去重；物种、特性、招式响应不再继续扩展。缺失必需字段或外域 URL 使同步失败。manifest 条目记 `discoveredFrom`，种子记 `seed`。下载响应直接写暂存对象，没有第二轮抓取。

工厂模式默认上限为 6000 键、1 GiB 累计对象、90 分钟及 4 worker；`-factory-sample` 默认 200 键、100 MiB、2 分钟及 2 worker。三个上限可分别指定。同步按进度记录排队/完成键数、类型分布、字节、耗时和父键；64 MiB 单响应超限显式报错。失败返回错误并删除暂存目录，已有活动指针不变。样本模式必须给明确 `-state`，只准备 PokeAPI 版本，不同步 CSV，也不激活版本。

本地假上游的百变怪 132 测试放入 400 条反向宝可梦链接，有限闭包仅抓取 `pokemon`、物种、特性、招式 4 键，每键一次；没有扩展到 300 键。定向测试也覆盖键数、字节、期限、HTTP 错误、缺字段、外域 URL、失败清理及旧活动指针保持。`go test ./...` 全部通过。

隔离真实上游小试验使用临时 state `C:\Users\45186\AppData\Local\Temp\poke-factory-sample-77db2f7682c9435ea44c80880528e91c`，运行百变怪 132，限制 200 键、100 MiB、2 分钟、2 worker。约 4 秒完成 5 键、130083 字节：`pokemon/132`、`pokemon-species/132`、`ability/7`、`ability/150`、`move/144`。`current.json` 不存在，版本仅准备未激活；未触碰共享 `var`。

此切片尚未做完整九池同步和激活前的独立闭包/对象校验、图片及 CSV 版本联动核查、异常进程遗留暂存清理、全站其他模块覆盖和关闭上游的九代浏览器验收。完整版本仍须在隔离 state 准备并审计后才能激活，不能把该小样本视为发布工件。
