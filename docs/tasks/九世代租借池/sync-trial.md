# 工厂资料隔离试同步记录

## 范围

2026-09-26 在忽略目录 `output/sync-trial-architect-20260926/` 中构建现有 `backend/cmd/sync`，将 `-state` 指向其下全新空目录。临时清单仅含 `languages.csv`，临时工厂索引仅含第 1 代百变怪 `pokemon/132` 与 `pokemon-species/132`。命令启用 `-full`、2 个 worker，单次进程有 90 秒硬上限。未使用共享 `var/current.json`，未改变游戏代码或共享资料库。

## 结果

| 试次 | 参数 | 耗时 | 结果 | 发现条目边界 | 隔离 state 最终大小 |
| --- | --- | ---: | --- | --- | ---: |
| 1 | `-version trial-20260926-ditto -max-entries 100` | 3.57 秒 | 退出码 1，`sync exceeded max entries: 100` | `seen` 至少触及 100 个键；没有逐请求计数日志 | 0 文件、0 字节 |
| 2 | `-version trial-20260926-ditto-300 -max-entries 300` | 3.25 秒 | 退出码 1，`sync exceeded max entries: 300` | `seen` 至少触及 300 个键；没有逐请求计数日志 | 0 文件、0 字节 |

两次都在 `syncing PokeAPI ... seeds=2 full=true` 阶段失败，未执行 CSV 的版本准备，未生成正式 manifest，也未激活隔离版本。`PrepareVersion` 失败后删除临时对象目录，因此最终 0 字节**不能**作为同步所需磁盘或网络传输量的估计。试验产物中的二进制和日志仅供调查，不可发布。

## 原因与边界

`backend/internal/content/store.go` 的 `extractPokeAPIKeys()` 递归扫描返回 JSON 中所有指向 `pokemon/`、`pokemon-species/`、`pokemon-form/`、`move/`、`ability/`、`evolution-chain/` 的 URL。`syncVersion()` 对每个发现的键继续递归，没有按原始工厂物种、招式或特性建立有界闭包；一个工厂物种进入招式、特性等资源后即可扩展到许多其他宝可梦。两次试验只证明发现集合分别超过 100 和 300，不能从日志确定实际下载请求数、传输字节、完整闭包规模或九代同步总耗时。继续提高 `-max-entries` 可能把单物种试验变成大范围 PokeAPI 同步，因此按任务的增长上限停止，没有尝试默认 20000。

## 后续最小步骤

先使同步器或独立清单生成器只收集九代工厂路径确需的键：从允许的 `pokemon/{identifier}` 出发，提取对应物种、全部可随机抽到的招式、全部特性及实际用到的形态/进化链；对 `move`、`ability` 返回的反向宝可梦列表不继续扩散。为这一闭包加键数、已下载数、总字节和每类来源的进度日志，并对超额和部分失败保留可审查报告。然后在同样的隔离空状态目录重试单物种，成功产出 manifest、记录时长/峰值磁盘，再扩至单世代和九世代。当前 `-full` 不适合作为可预测的小范围生产资料同步方案；在闭包被界定并通过关闭上游验收前，不能据此声明离线发布资料已准备好。
