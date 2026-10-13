# 奖励商店最终代码运行验收

## 代码、服务与证据边界

- 当前验收代码固定为 `4072de03eb7ecfc2277bd9b473407f272a2875d6`。旧 `evidence/final-604232f/` 是缺陷修复前的历史证据，不用于本次 PASS 判定。本页只引用 `evidence/final-4072de0/`；每个 `result.json` 都标注完整代码 SHA。
- 已停掉上一提交的 Go/Vite 进程；在 `D:/Games/pokeFactory2-worktrees/reward-shop` 重新启动 `PORT=3001 go run ./backend/cmd/server` 与 `DISABLE_HMR=true npm run dev`。新服务健康检查原始响应见 `evidence/final-4072de0/health.txt`：HTTP 200，`{"runtime":"go","status":"ok"}`。
- 经上述 Go 内容代理运行 `python scripts/audit_factory_evolution_resources.py --base-url http://127.0.0.1:3001`，原始输出见 `evidence/final-4072de0/resource-audit.json`：175/175 资源、94/94 固定关系、9 个 form-only 资源可用，`failed: []`。
- Playwright Chromium 使用隔离的 `127.0.0.<octet>:4300` 来源、`isMobile/hasTouch`、DPR 2，三种**模拟**视口 320×568、390×844、844×390。受控存档把队伍置于战次、奖励或结算边界；战斗、商店、设置导出导入都由真实浏览器 UI 操作。未用 DEV Win。未进行实体手机或生产环境验收。
- 14 项旧商店回归重新运行于当前 SHA，摘要 `evidence/final-4072de0/regression-console.json`，逐例状态与截图在 `regression/<case>/`：14/14 无失败断言，0 个 HTTP 错误；其中故障语义用例的 2 条 console error 是预期存盘失败注入。12 项新增用例各自有 `result.json`、截图及可还原的 `.json.gz` 夹具。进化写盘失败用例有 1 条预期注入的 console error，其他新增用例最终运行均无页面或 HTTP 错误。

## AC 逐项结果

| 条目 | 当前 SHA 的运行证据与结论 | 未验证边界 |
| --- | --- | --- |
| AC-1 | **模拟浏览器通过**。`regression/shop-ready-t2` 与 `evolution-shelf-eligible/01-eligible-320x568.png`、`02-eligible-390x844.png`、`03-eligible-844x390.png`：六件、价格、余额、按钮可见，三视口可滚动。 | 实体手机。 |
| AC-2 | **通过**。`regression/shop-ready-t2` / `shop-no-tickets`：足额可兑，余额不足禁用并划价。 | 受控余额。 |
| AC-3 | **通过**。`regression/full-flow-purchase`、`rapid-click-purchase`、`double-tap-purchase`、`refresh-import-purchase`；进化 `evolution-confirm-burst` 八连点只一笔，`evolution-write-failure` 写盘失败不扣券不进化，重试只成功一次。 | 故障为受控注入。 |
| AC-4 | **通过**。`regression/full-flow-purchase` 多笔购买；`leave-shop-without-purchase` 零券离店后到第 4 战。 | 受控检查点。 |
| AC-5 | **通过**。`regression/shelf-freeze`、`refresh-import-purchase` 与 `evolution-shelf-eligible`：六件互异，刷新、重开、同版存档往返与购后冻结。 | 未以浏览器统计检验等权抽样；静态测试另有覆盖。 |
| AC-6 | **通过**。`regression/full-flow-purchase`：选队员、确认替换、基准唯一、旧物不进背包。 | 受控队伍。 |
| AC-7 | **通过主要路径**。`evolution-shelf-eligible` 含完整伊布，可用进化石入架；`evolution-shelf-ineligible` 无匹配则六件全持有物；`evolution-gender-dawn-stone` 觉醒之石仅允许雄奇鲁莉安与雌雪童子，雌奇鲁莉安禁用。Go 代理逐条资源审计 175/175、94/94。 | 浏览器未模拟目标资源加载失败与全候选等权抽样。 |
| AC-8 | **通过主要路径**。`evolution-shelf-eligible` 真实兑换后扣 3 券，四招/顺序/PP、等级/IV/EV/性格/性别/持有物保留，其余队员不变，刷新、冷重开和下一战仍是新形态。`evolution-multi-teammate` 两名伊布选第二名，第一名不变；`evolution-gender-dawn-stone` 同道具选择第三名雌雪童子。`evolution-cross-group-controlled` 真实 UI 赢第 7 战、组末到基地、设置导出/导入、进第 8 战后形态仍在。`evolution-confirm-burst` 与 `evolution-write-failure` 覆盖幂等/原子性。 | 跨组从受控第 7 战开始，不是自然打完第 4–7 战。同道具同队员多目标在现有 94 条关系中无实例，浏览器未验证。`GamePokemon` 无异色字段，异色保留不适用／未验证。 |
| AC-9 | **模拟浏览器通过指定触发路径**。`white-herb-feather-dance-raw` 原始旧序列化羽毛舞效果为 `isPrimary:true,chance:0,change:-2`，真实 UI 日志“羽毛舞→攻击降低→白色香草恢复”，当前香草消耗、负等级归零、装备基准保留、仅触发一次。`white-herb-icy-wind` 用 Go 原始冰冻之风数据注入敌方招式槽，经真实 UI 命中后降我方速度并触发；`white-herb-self` 蛮力自降后触发，下一场基准香草返还。`white-herb-opponent` 的 chance=100 隔离场景也通过。 | 王者盾牌接触与状态招式未命中分支未作浏览器实玩；后者由 plan §7.5 列为既有缺口。 |
| AC-10 | **通过**。`regression/settle-7win-ticket-bp`、`settle-9999-cap` 覆盖组奖励＋余券折算、9999 上限、下组归零；`evolution-cross-group-controlled` 同时检查下一组券 0。 | 受控七战边界。 |
| AC-11 | **通过**。`regression/mid-run-loss`：败退券归零、不折算 BP。 | 受控败退边界。 |
| AC-12 | **通过当前抽样**。`regression/shop-ready-t2` 中香草文案有条件说明；`evolution-shelf-eligible` 与 `evolution-gender-dawn-stone` 显示具体前后形态。 | 未逐件人工核查 39 种道具文案。 |
| AC-13 | **通过**。`regression/legacy-ready-import`、`legacy-claimed-import` 旧四卡状态读入不崩溃。 | 仅这两类旧状态。 |
| AC-14 | **独立 auditor 静态通过**：当前 SHA 的 `npm run lint`、`npm test` 293/293、`npm run build`、`go test ./...`、`git diff --check`。player 不把静态门禁冒充运行证据。 | 见 `log.md` 最后一个 Auditor 段落。 |

## 异常与复验

第一次重跑 `white-herb-self` 时，全部玩法断言为真，但浏览器捕获一次与本次香草动作无关的 `502 /api/pokeapi/move/iron-head/`。以相同 SHA 和夹具重跑后，`white-herb-self/result.json` 的 HTTP 与 console 错误均为零。观察记录在 `evidence/final-4072de0/transient-502.md`；第一次结果文件已被清洁复验覆盖，不能据此断言代理永不偶发 502。

首轮羽毛舞脚本在 React 状态已更新但 localStorage 尚未落盘时读到上一回合，误多按一回合，出现“香草已消耗后又被羽毛舞降攻”的假断言。只修 player harness，等待 `battleLog` 落盘后以同 SHA 重跑原始羽毛舞、对手路径、自身蛮力及冰冻之风；最终结果均无失败断言。此问题不是业务代码失败。

## 裁决

**当前 SHA 的指定模拟浏览器验收通过，可交由 orchestrator 做任务级接受与合入决策。** 本结论限于上述受控场景和模拟视口；实体手机、生产环境、自然完整七战、目标资源失败的浏览器降级、异色数据、王者盾牌浏览器路径与既有状态招式命中率缺口均未验证或未解决。下一次业务代码修改需要重新取对应运行证据。
