# 暂停挑战跨页恢复试玩验收

测试时间：2026-09-26。运行版本：`13a7a85` 加本轮工作树修复。使用独立无头 Chrome 的 `127.0.0.9:4300` 源，不读写用户原 `127.0.0.1` 浏览器存档。正式新局在独立 `127.0.0.7` 和 `127.0.0.8` 源租借加载超过 120 秒仍未完成；因此跨页回归将前一轮真实运行所得的 **v10 第七胜 `READY/BASE` 存档**导入新隔离源。它验证同版本存档在最新代码上的恢复行为，不能替代本轮全新局七战验收。原样本已获得 3 BP、连胜 7、队伍 ID `915, 940, 946`。

## 跨页与刷新

从基地进入「设置」→「版权与素材来源」→返回设置→返回基地→刷新。每一步本地存档均为 `READY/BASE`、`stage=7`、`streak=7`、`challengePaused=true`、钱包 3 BP，队伍 ID 保持不变，刷新后仍有「继续挑战」。[状态记录](evidence/settings-credits-recovery.json)及[刷新后基地](evidence/390-resumable-base-reload.png)可对照。该路径修复前在进入设置时立即清空快照；本次未复现。

进入图鉴后刷新、进入事件概览后刷新，同样恢复 `READY/BASE stage7`、连胜 7、3 BP 和继续入口。[状态记录](evidence/dex-events-readonly.json)、[事件概览](evidence/390-resumable-events.png)。图鉴截图捕获时仍显示加载中，因此只确认进入图鉴和刷新后的存档恢复，未验收图鉴内容加载完成。

## 事件操作保护

可续局期间，事件页明确提示先继续或结束挑战。实际检查第一地区的「选择」「清除」「推荐」「开始派遣」「Mock 道具」「Mock 加入」「Mock 特殊」按钮均处于禁用状态；事件派遣状态、队伍、钱包及工厂快照未改变。[按钮和状态记录](evidence/event-controls.json)、[事件页截图](evidence/390-resumable-events-controls.png)。本存档所有派遣任务原本为 `IDLE`，没有可领取结果，所以「领取」按钮的禁用行为尚未由真实运行覆盖。

## 结束当前连胜

基地点「结束当前连胜」会显示确认说明。点「取消」后仍为 `READY/BASE stage7`，3 BP 和继续入口保留。再次打开并点「确认结束」后，快照为 `EMPTY`、`challengePaused=false`，基地改为「开始挑战」，连胜显示 0，钱包仍为 3 BP；刷新后保持。事件页的「选择」「开始派遣」及三个 Mock 按钮恢复可操作。[状态记录](evidence/end-streak.json)、[确认提示](evidence/390-end-streak-prompt.png)、[结束后基地](evidence/390-end-streak-confirm.png)、[事件恢复](evidence/390-events-after-end.png)。该样本的 `trainerIdsBySet` 在结束前后均为 `[]`，因此只能确认结束后无残留，无法验证非空旧记录被清除。正式点击新挑战并进入租借页尚未完成。

## 新局租借加载

本轮两个全新隔离源中，第一代和第九代新局租借各等待 120 秒仍未出现租借卡。25 秒诊断截图显示「正在寻找宝可梦…」，请求数 236、响应数 235，已返回的响应均为 200，浏览器控制台未见错误。[画面](evidence/390-rental-load-25s.png)、[请求摘要](evidence/rental-load-25s.json)。摘要最后 15 条里 `/api/pokeapi/ability/63/` 在请求列表而未见对应响应，可能是当时待完成请求；未保留完整请求清单、initiator 或响应头，不能判定根因，也未记录 `/api/data/factory-species-index` 的状态。首轮设置返回后曾发生一次自动化误点，已排除该脚本错误后独立重试，仍遇到 120 秒租借未完成。需在加载修复后从全新局复测。

跨页、事件和结束连胜脚本捕获的控制台错误与 HTTP 400 以上响应均为空。本轮未复核 844×390 横屏，也未完成第 1 战败退、v8 旧档提示及 `ROUND_RESULT`/`FACTORY_SWAP` 页面刷新；这些路径保留待测。
