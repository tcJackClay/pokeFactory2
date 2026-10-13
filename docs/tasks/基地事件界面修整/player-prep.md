# Player 准备记录：基地事件界面修整

2026-10-14。仅只读准备；候选 HEAD `cdf289da8cac7b94addae27d4502d20c7789a86a` 尚待独立 audit。**未启动服务、未运行浏览器、未执行验收、未改业务文件。**

## 已读与原缺陷

已读 AGENTS、player 角色、factory-build、prd/plan/context/review/implementation，以及永久收藏 runtime、runtime-harness、fixtures、run-observations、run-events、run-import-matrix。已人工打开旧 `en-base-320.png`：Standby 与 BATTLE 标题交叠，Rockruff 标签靠近 Start Run。旧图只作问题基线。

## 冻结与环境

收到 orchestrator 的独立 audit PASS 和最终 SHA 后，先检查 HEAD、业务 diff、3007/4306 端口及健康检查，再从本工作树根启动 Go3007、Vite4306。`GO_BACKEND_URL=http://127.0.0.1:3007`、`DISABLE_HMR=true`、`--host 0.0.0.0`。独立 origin 拟用 `http://127.0.0.203:4306`，保留用户4300与九道具3006/4305服务。Playwright Chromium touch/DPR2；版本现场记录。源码全程冻结。

每个冷请求/故障案例用全新 browser context，以隔离 pokedexClient 模块缓存。不得直接 import 旧 runtime-harness/fixtures：其模块有启动浏览器副作用和永久收藏工作树绝对路径。新 harness 使用本任务相对路径及运行时目标 SHA。

## 夹具来源与边界

- V1 空 localStorage 自然初遇一只伙伴；六伙伴补测使用本任务当前 createSaveData 生成合法档，明确受控，不宣称六次自然初遇。
- 已跟踪的 `永久收藏口径/evidence/final-244738d/natural-base.json`、`natural-battle.json` 为真实自然来源。旧快照只提供数据输入，当前 creator 重建并 parse 校验，不作本次通过证据。
- 摘要选中948来源：旧 `r7-catch-success-training/06-reload.json.gz` 的真实永久收据与选中配置。用于冷摘要、自选/清除和导入另一有效档，当前 API 请求真实经过本次 Go。
- 领取夹具参考 `fixture-sources/event-party-natural-b2d5863.json.gz` 的真实队伍形状；当前 createSaveData 重建 schema、明确注入 READY、球和初始有效收据。从 LOSS 实际 UI 返回基地再领取。RNG .7→.001 只用于一次 join 分支覆盖，非自然概率证明。
- 续局使用 natural-battle 当前 creator 重建；UI 返回基地保留检查点，取出前后主档确认取消结束和继续不丢进度。
- 所有动作走真实 DOM/tap/file input；React view-model 只读观察，不调用 action。网络延迟/失败、RNG、存档注入逐案单列。

## V1–V8 执行安排

| 项 | 独立案例与证据 |
| --- | --- |
| V1 | 中简/英320×568、390×844、844×390；繁中长文案三尺寸；自然初遇→基地；六只英文伙伴名受控补测。截图+geometry，逐个滚到四入口并触达可用按钮，Shop真实禁用保留。人工读状态/标题/伙伴/主操作，不能只靠 rect。 |
| V2 | 选中948冷进事件，短延迟观察 loading 再释放真实响应，未开picker即正确名称/属性/匹配；保存 request journal 与data-selected-id/data-load-state。 |
| V3 | 两只选中，单只首次请求返回非重试HTTP404（明确故障注入），另一只正常。观察错误且无自动风暴，选择/Owned不变；解除后点Retry恢复。注意底层500有3次有限重试，不能把有限重试叫风暴。 |
| V4 | 分开跑延迟A→选B、清除、推荐中离场、推荐中手动选择/清除；释放后旧响应不能改新选择。导入经Settings真实file input触发reload，检查新档不混入旧选择。请求保持短于底层6秒timeout；若需要长等待则如实记录timeout/重试而不伪称单请求。 |
| V5 | summary/picker同ID并发、关闭重开去重；部分失败显示可重试，不从残缺Owned推荐。全部成功后无匹配显示正确说明；搜索无结果与全资料失败分开。Owned空需合法构造且由实际UI可达，若schema强制伙伴则记录不可达并由静态覆盖，不伪造非法档。 |
| V6 | 有效可续检查点→基地→事件，各修改/领取disabled、只读摘要可加载；结束确认取消后真实继续恢复。无调用内部action。 |
| V7 | READY+球受控领取一次并按钮burst去重；主档收据/球/派遣状态及只读队伍前后；另案球不足保留实际中文提示。动态结果/训练原文截图完整保留。 |
| V8 | 三语自有copy、英文320/横屏picker与结果关闭可触达；普通无Mock，Settings开启开发模式后才可预览。列出动态lastResult/popup和繁中专名fallback实际残留，不把整页全量本地化算通过。 |

各案保存实际步骤、主档/只读快照 gzip、DOM文本、请求/控制台日志、关键屏幕截图、layout JSON。最终 runtime 对照逐条判定，manifest标代码SHA/文件hash与受控手段。若新阻断则先向orchestrator报告并冻结证据，不自行改业务。模拟浏览器不等于实体Android；自然球来源、完整事件战续档、生产与性能不在本片通过范围。
