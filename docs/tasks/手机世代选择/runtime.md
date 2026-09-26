# 手机世代选择运行验收

2026-09-26，`13a7a85` 加当前工作树改动。本地前端 4300 与 Go 服务 3001 运行中。使用独立 Chrome 上下文及 `127.0.0.22`—`127.0.0.33` 源；挑战锁定样本由同版本第七胜可续局存档导入 `127.0.0.31`。未读写用户 `127.0.0.1` 存档。测试视口为 320×568、390×844、844×390；修复后触摸滑动用 Chrome 移动模拟执行。

## 入口、选择和持久化

三视口设置页均只有一个“当前世代”入口，默认显示第一世代／关都。弹层有九个原生单选项。分别选择第九、第五、第三世代后弹层关闭，`settings.selectedGens` 为 `[9]`、`[5]`、`[3]`；刷新后入口及存档保持对应世代。Escape 和遮罩点击均关闭弹层，Escape 后焦点回到入口。切换英文后，入口、弹层标题、地区及九行英文文案正确，所选世代不变。本轮控制台页面错误和 HTTP 400 以上响应均为空。[三视口动作与状态](evidence/generation-picker-results.json)、[320 默认入口](evidence/320x568-settings-default.png)、[390 弹层](evidence/390x844-picker-open.png)、[844 英文弹层](evidence/844x390-picker-english.png)。

## 小屏滚动复测

初版在 320×568 和 844×390 的 `fieldset` 中，内容高度分别超过可视区 99、277 像素，设置 `scrollTop` 与滚轮均无法滚动，第九行无法作为普通触控目标。初版[320 截图](evidence/320x568-picker-wheel.png)、[诊断数据](evidence/scroll-diagnostic.json)保留为修复前证据。

改为普通滚动容器后，320×568 触摸滑动使 `scrollTop` 从 0 到 99（最大 99）；844×390 触摸滑动到 177，滚轮继续到 277（最大 277）。第九行完全进入视口；在移动模拟中直接触摸第九行，弹层关闭并写入 `[9]`，刷新后仍为 `[9]`。[修复后滚动状态](evidence/scroll-fixed-gesture-results.json)、[真实触摸选择与刷新](evidence/scroll-fixed-touch-selection.json)、[320 底部画面](evidence/320x568-picker-bottom-fixed.png)、[844 底部画面](evidence/844x390-picker-bottom-fixed.png)。390×844 九行本来即全部可见，无需滚动。

## 可续挑战锁定

将同版本 `READY/BASE stage7`、已获 3 BP、`challengePaused=true` 的隔离存档导入新源后，390×844 与 844×390 设置页的世代入口均禁用，并显示“先完成或结束挑战”的说明。刷新后世代仍为 `[9]`，3 BP、stage7 和暂停标记均保持。[锁定状态](evidence/challenge-lock-results.json)、[390 截图](evidence/390x844-challenge-locked-fixed.png)、[844 截图](evidence/844x390-challenge-locked-fixed.png)。这是同版本导入样本的界面锁定验证，非本轮重新打完七战。

本轮覆盖 Chrome 移动模拟触摸与浏览器窗口尺寸，未在实体手机 Safari／Chrome 上验收。
