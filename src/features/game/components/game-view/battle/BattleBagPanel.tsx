import { ALL_ITEMS } from '../../../../../uiAppConstants';
import { BASE_BALL_IDS } from '../../../utils/baseBallInventory';
import { motion, useReducedMotion } from 'motion/react';
import type { GameViewSectionProps } from '../shared';

export function BattleBagPanel({ viewModel }: GameViewSectionProps) {
  const { inventory, baseBallCounts, eventBattleActive, playerTeam, t, getLocalized, getLocalizedDesc, useItem } = viewModel;
  const shouldReduceMotion = useReducedMotion();
  const mustChooseReplacement = playerTeam[0]?.currentHp <= 0 && playerTeam.some((pokemon, index) => index !== 0 && pokemon.currentHp > 0);

  const ballEntries = eventBattleActive ? BASE_BALL_IDS.flatMap((id) => {
    const item = ALL_ITEMS.find((entry) => entry.id === id);
    return item && baseBallCounts[id] > 0 ? [{ item, count: baseBallCounts[id] }] : [];
  }) : [];
  return (
    <motion.div
      key="items"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.18, ease: 'easeOut' }}
      className="flex h-full flex-col p-3 sm:p-4"
    >
      <div className="custom-scrollbar grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto pr-1 min-[420px]:grid-cols-2 sm:grid-cols-3">
        {ballEntries.map(({ item, count }) => (
          <button key={item.id} type="button" disabled={mustChooseReplacement} onClick={() => useItem(item, -1)}
            className="min-h-[96px] rounded-[18px] border border-slate-200 bg-white p-3 text-left">
            <span className="block text-sm font-black">{getLocalized(item)} × {count}</span>
            <span className="block text-xs leading-5">{getLocalizedDesc(item)}</span>
          </button>
        ))}
        {inventory.length > 0 ? (
          inventory.map((item, index) => (
            <button
              key={`${item.id}-${index}`}
              type="button"
              disabled={mustChooseReplacement}
              onClick={() => useItem(item, index)}
              className={`min-h-[96px] rounded-[18px] border border-slate-200 bg-white/90 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.90)] transition-all active:scale-[0.98] ${
                mustChooseReplacement
                  ? 'cursor-not-allowed opacity-60 saturate-75'
                  : 'hover:border-blue-200 hover:bg-blue-50/60'
              }`}
            >
              <div className="mt-1 text-sm font-black text-slate-900">{getLocalized(item)}</div>
              <div className="mt-2 line-clamp-2 text-[11px] font-semibold leading-5 text-slate-500">
                {getLocalizedDesc(item)}
              </div>
            </button>
          ))
        ) : ballEntries.length === 0 ? (
          <div className="col-span-full flex h-full items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm font-bold text-slate-400">
            {t('bagEmpty')}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
