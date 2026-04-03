import { AnimatePresence, motion } from 'motion/react';
import { Skull } from 'lucide-react';
import type { GameViewSectionProps } from './shared';

export function BattleLogHistory({ viewModel }: GameViewSectionProps) {
  const { showLogHistory, gameState, battleLog, t, setShowLogHistory } = viewModel;

  return (
    <AnimatePresence>
      {showLogHistory && gameState === 'BATTLE' && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-20 right-4 z-[60] w-80 bg-white shadow-2xl border-4 border-slate-900 p-4 max-h-[400px] overflow-y-auto custom-scrollbar"
        >
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="font-black italic text-sm uppercase tracking-widest text-slate-400">{t('battleHistory')}</h3>
            <button onClick={() => setShowLogHistory(false)} className="text-slate-400 hover:text-slate-900">
              <Skull className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {battleLog
              .slice()
              .reverse()
              .map((log, index) => (
                <div
                  key={`${log}-${index}`}
                  className={`text-xs font-bold italic ${index === 0 ? 'text-blue-600' : 'text-slate-400'}`}
                >
                  {index === 0 ? '> ' : ''}
                  {log}
                </div>
              ))}
            {battleLog.length === 0 && <div className="text-center py-8 text-slate-300 italic">{t('noRecords')}</div>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
