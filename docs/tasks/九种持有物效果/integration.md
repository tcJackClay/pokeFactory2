# 已验 UI 整合与冻结记录

## 整合输入

- 道具 A1 修复：`d6e74a04bc48f1646ca5a6e03a121b0e30bc867c`。
- 已验 UI 主线：`755dbec9b997cdebffdc611094de2c618fb7b8f6`（被验业务源 `a9dbde3`）。
- 在 `codex/held-item-effects` 用普通 `merge --no-ff --no-commit` 合并，自动成功，**没有冲突或手工业务改写**；门禁通过后再形成本合并提交。没有把道具分支合回主仓，也未推送或运行游戏。

## 差异核对

合并相对 `d6e74a0` 的 `src/backend/scripts` 差异恰好为以下 7 个 UI 文件，逐路径与 `755dbec` 的内容完全一致：

1. `src/features/game/components/game-view/EventsScreen.tsx`
2. `src/features/game/components/game-view/StartScreen.tsx`
3. `src/features/game/components/game-view/baseEventCopy.ts`
4. `src/features/game/components/game-view/baseEventUi.css`
5. `src/features/game/hooks/useEventDisplaySnapshots.ts`
6. `src/features/game/utils/eventDisplaySnapshots.test.ts`
7. `src/features/game/utils/eventDisplaySnapshots.ts`

- 其余合并输入仅 `.agents` 1 个文档、`docs` 288 个文档/既有 UI 验收产物；backend/scripts 没有新增差异。道具控制器、引擎、fixed flags 与 A1 补位代码保持 `d6e74a0`。
- 两次 design cherry-pick 与主线最终内容一致，`docs/tasks/工厂内容准入/design.md` 比对通过；无需重写。
- 合并前后原审计 `log.md/audit.md/static-audit` 及 `evidence-prep` 共 16 文件的组合 SHA256 均为 `887c8ec483025bb5094f41988f46230c1f394778463fdf6855ecc55c2f55cf6e`，证明合并未覆盖现场产物。审计报告、静态审计复现、player 准备仍未纳本合并提交；log 的新审计段和本次追加记录保留为未提交状态。

## 串行整合门禁

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | PASS |
| `npm test` | **368/368 PASS** |
| `npm run build` | PASS，2257 modules |
| `go test ./...` | PASS |
| `node scripts/extract_rogue_move_item_flags.cjs --source D:/Games/pokeFactory2/output/rogue-expansion-reference --check` | PASS，936 源记录→901 映射记录→919 slug，35 显式排除 |
| `git diff --cached --check` | PASS |

生产主包 682.02 kB / gzip 205.63 kB，保留 >500 kB 构建警告。元数据计数：contact 271、ignoresKingsRock 0、sheerForce 193、healBlock 36。

## 后续门禁

这是代码整合与静态证据。仍需独立 auditor 快速核对整合差异，然后对本合并后的精确 SHA 运行最终 player V1–V10。旧 UI 实玩与旧道具候选静态不能替代本候选的道具实玩；自然七战、实体手机、生产环境及其它已记录发布阻断仍保留。
