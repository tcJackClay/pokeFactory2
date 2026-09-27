import type { GameViewSectionProps } from './shared';

/**
 * 三人「本局返还基准」唯一性的**如实提示**（PRD 边界 + Orchestrator 裁决补遗一/二）。
 *
 * 出现在检测到重复并把重复者规整回原配/空位之后（load、同版导入、换怪、起战、奖励节点皆可能），
 * 明确告知玩家「发生了什么、原配没有丢、挑战可以继续」，**不静默**。
 * 由玩家自行关闭；提示不会阻止任何操作。
 */
export function FactoryHeldItemRepairNotice({ viewModel }: GameViewSectionProps) {
  const { heldItemBaselineRepaired, dismissHeldItemRepairNotice, currentLanguage } = viewModel;
  if (!heldItemBaselineRepaired) return null;
  const isZh = currentLanguage.startsWith('zh');
  return (
    <div
      role="status"
      data-testid="factory-held-item-repair-notice"
      className="mb-2 flex w-full items-start justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-left text-sm font-semibold text-amber-900"
    >
      <span>
        {isZh
          ? '检测到队伍中有重复的「本局返还基准」（可能来自外部导入的存档），已自动规整：先持有的队员保留该装备，重复者回落其租借原配（原配不可用时置为空装备位）。任何道具都没有被丢弃、也没有进入背包，挑战可以继续。'
          : 'Duplicate run baselines were found (likely from an imported save) and reconciled automatically: the first holder keeps the item, duplicates fall back to their rental original (or an empty slot if that is also held). Nothing was discarded or bagged, and the challenge can continue.'}
      </span>
      <button
        type="button"
        onClick={dismissHeldItemRepairNotice}
        className="shrink-0 rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-black text-amber-900"
      >
        {isZh ? '知道了' : 'Got it'}
      </button>
    </div>
  );
}
