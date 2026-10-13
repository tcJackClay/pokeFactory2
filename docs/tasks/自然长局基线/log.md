# Player

- 在主仓冻结业务基线 c4a7db1（文档 HEAD 从 6bd0352 到 82a98ef）启动独立 Go 3005 / Vite 4304，HMR 关闭。
- 首次自然样本 9 次输入后，因为 harness 用前一完整回合存档判断强制换人而超时关闭。保留错误脚本、正文、截图、存档；没有标为产品败退或卡死。
- 经 orchestrator 授权修复验收工具，再进行一次新档自然样本：390×844、65 次真实招式输入、3 次真实强制换人，首胜后下一战败退。无 DEV Win、存档/数值/招式/RNG 注入。
- 已验证范围：自然开局、首胜、战间 HP/PP 恢复、1 券入账且 BP 0、跳过换怪进入下一战、正常败退后券清零且结算 BP 0。未验证：第 3/6 胜商店、七战结算、实体手机、生产环境。
- 所有 console/pageerror/HTTP≥400/requestfailed 为 0；结算页内部英文实现标识遗留交后续 Stage 8。
- 最终只读整理发现产品缺陷：自然高速旋转为对手提速。103→104 原始存档证明 actor ID120 speed 0→0、target ID74 speed 0→1；运行中招式 secondaryEffects.appliesTo=target。已交 orchestrator 串行修复；未继续重跑，未修改代码。
- 详细运行记录、证据路径与边界见 runtime.md；本目录未提交。

# Player

- 按 orchestrator 后续要求仅整理证据入库子集，没有重新运行游戏或修改业务源码。
- 保留全部原件；两个完整 result.json 另存为 gzip，逐字节解压比对一致。全部 163 份正文、23 个关键节点 PNG/完整存档、环境/选择指令/招式原始响应与前后对比、脚本/runtime/log 列入 commit-manifest.json。
- 其余连续 PNG/完整中间存档、未压缩 result、浏览器 storage 导出列入 localOnly 清单，仅本地保留且未删除。文件数、SHA256、字节数由打包脚本生成；没有 Git 暂存或提交。
- runtime 可点击证据链接改为入库文件，完整本地轨迹与入库可复核子集已分开说明；不提升七战、实体手机或生产环境证据等级。
