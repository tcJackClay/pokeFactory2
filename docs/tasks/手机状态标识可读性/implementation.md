# 实现交接：手机状态标识可读性

## 实现范围

基线 `992bf3e5`，批准 Route A。仅四个业务文件：

- EventsScreen：两处白底属性圆标共用局部前景色选择函数，normal 用已批准 `#64748b`，其余颜色沿原表。没有改18属性素材或属性语义。
- TopRecordPanel：三列保持，每卡图标与完整标签在上行，完整数值独占下行；删除 truncate/title；补齐繁中「輪次」「連勝」。
- topRecordPanel.css：面板局部布局，标签11px；窄屏数字0.95rem；超长数值允许折行，未加数值上限、缩写或重新计算。
- index.css：仅迁走两个媒体查询内的 pf-top-record-* 规则，保留同查询中的战斗页面规则；脆弱 first-child 选择器由命名 class 替代。

TypeIcon 的 color/currentColor/style 优先级、TYPE_COLORS、--type-normal、TypeBadge、BattleMoveEffect、控制器、存档和收益计算均未修改。

## 验证和证据边界

静态门禁结果将记录在下方与 log.md；未运行游戏，未写运行 evidence，未触碰九道具工作树。独立 auditor 后由 player 在最终冻结 SHA 运行三语三视口实际页面。低风险样式修复未添加镜像 CSS 的单元测试。

V1 按 review 校准：基地可显示原实际 0/7，进入租借/首战检查该场景原实际值，禁止以改计算来满足夹具。大值验收要包含9999 BP和999999连胜，另测合法超长值；没有运行截图前不称显示验收已通过。

## 后续注意

- 最终需要截图判断 normal 形状及小屏文字，computed style 和几何不是视觉证明的替代品。
- 需实际进入基地→事件和租借/战斗，验证浅深属性徽标未退化、关键导航可达。
- 此片不证明实体 Android、全站无障碍或公开发布完成。

## 静态结果

串行四门禁 PASS：lint、npm test **345/345**、build、go test ./...。日志为本目录 static-lint.log / static-test.log / static-build.log / static-go.log。构建保留既有 >500 kB chunk 警告，主包594.96 kB（gzip197.48 kB）；不属于本显示片的性能验收。git diff --check PASS。
