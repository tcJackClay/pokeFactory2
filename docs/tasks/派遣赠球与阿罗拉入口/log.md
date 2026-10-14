# Programmer

- 基于实际合并前置 `00f30d152596c185287f99b4be7227f93f581fe4` 实施；没有运行游戏。
- 主要文件：saveManager、usePokeFactoryGame、useBattleController 的球路径、baseBallInventory、events、事件页/战斗背包和文案；不改九道具效果、派遣概率或捕获公式。
- 实际字段/恢复范围/attempt 身份细化已回填 plan/context/implementation；初次准备失败关闭后无持久结果的边界遵循 root review。
- 静态验证与证据见 validation.md；等待独立 auditor 后再交 player。
- Validation：lint PASS；test 387/387 PASS；build PASS；go test ./... PASS。业务代码冻结，未跑游戏，未推送或合入 dev。
