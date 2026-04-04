import { motion, useReducedMotion } from 'motion/react';
import type { GameViewSectionProps } from '../shared';

export function BattleBagPanel({ viewModel }: GameViewSectionProps) {
  const { inventory, t, getLocalized, getLocalizedDesc, useItem } = viewModel;
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      key="items"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.18, ease: 'easeOut' }}
      className="flex h-full flex-col p-3 sm:p-4"
    >
      <div className="custom-scrollbar grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {inventory.length > 0 ? (
          inventory.map((item, index) => (
            <button
              key={`${item.id}-${index}`}
              type="button"
              onClick={() => useItem(item, index)}
              className="min-h-[96px] rounded-[18px] border border-slate-200 bg-white/90 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.90)] transition-all hover:border-blue-200 hover:bg-blue-50/60 active:scale-[0.98]"
            >
              <div className="mt-1 text-sm font-black text-slate-900">{getLocalized(item)}</div>
              <div className="mt-2 line-clamp-2 text-[11px] font-semibold leading-5 text-slate-500">
                {getLocalizedDesc(item)}
              </div>
            </button>
          ))
        ) : (
          <div className="col-span-full flex h-full items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm font-bold text-slate-400">
            {t('bagEmpty')}
          </div>
        )}
      </div>
    </motion.div>
  );
}
