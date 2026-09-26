# 战斗状态标签实施记录

## 缺陷来源

首局实玩截图 `docs/tasks/首局完整实玩/evidence/battle-844x390.png` 中，敌我 HP 卡分别出现 `protect_chain`、`uproar`。两张卡都通过 `getPrimaryBattleStatusId` 取得状态 ID，再用只覆盖部分状态的 `AILMENT_ZH` 映射；缺失时直接显示原始 ID。`protect_chain` 是连续守住成功率所用的内部计数，不应作为玩家状态展示。

## 修改

- HP 卡统一使用 `getBattleStatusLabel`，按当前语言展示完整的非挥发状态和已知挥发状态。`uproar` 显示为“大闹”或“Uproar”。
- 状态选择器跳过 `protect_chain`，仍保留它的战斗计算和存档字段；若还有真实状态，则继续展示该状态。
- 同一路径扫描到 `light_screen`、`perish_song`、`flash_fire`、`defense_curl` 等可能露出下划线的状态，统一加入玩家可读映射。未知状态在中文下显示“特殊状态”，在英文下转成空格分隔的标题形式。

## 验证

- `npm run lint`：通过。
- `npm test`：140 项通过，包含内部计数不展示、真实状态优先显示、中英文状态文案及未知状态兜底。
- `npm run build`：通过。
- `git diff --check`：通过。

本次依据现有实玩截图定位问题，并完成静态和构建验证；未在浏览器重新运行战斗。需由后续实玩复核双语 HP 卡及同分辨率显示。
