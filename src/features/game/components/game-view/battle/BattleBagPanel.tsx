import { motion } from 'motion/react';
import type { GameViewSectionProps } from '../shared';

export function BattleBagPanel({ viewModel }: GameViewSectionProps) {
  const { inventory, t, getLocalized, getLocalizedDesc, useItem } = viewModel;

  return (
    <motion.div key="items" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full flex flex-col p-2 sm:p-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
        {inventory.length > 0 ? (
          inventory.map((item, index) => (
            <button
              key={`${item.id}-${index}`}
              onClick={() => useItem(item, index)}
              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-none skew-x-[-4deg] transition-all text-left group"
            >
              <div className="skew-x-[4deg]">
                <div className="font-black text-sm group-hover:text-blue-600">{getLocalized(item)}</div>
                <div className="text-[10px] text-slate-500 mt-1 line-clamp-1">{getLocalizedDesc(item)}</div>
              </div>
            </button>
          ))
        ) : (
          <div className="col-span-full py-8 text-center text-slate-300 font-bold italic">{t('bagEmpty')}</div>
        )}
      </div>
    </motion.div>
  );
}
