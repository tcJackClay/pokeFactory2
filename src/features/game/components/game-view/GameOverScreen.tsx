import { motion } from 'motion/react';
import { RefreshCw, Skull } from 'lucide-react';
import type { GameViewSectionProps } from './shared';

export function GameOverScreen({ viewModel }: GameViewSectionProps) {
  const { stage, t, setGameState } = viewModel;

  return (
    <motion.div
      key="gameover"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col items-center justify-center p-4 text-center"
    >
      <div className="bg-red-500 p-6 md:p-8 skew-x-[-12deg] shadow-2xl mb-6 md:mb-8">
        <Skull className="w-12 h-12 md:w-20 md:h-20 text-white skew-x-[12deg]" />
      </div>
      <h2 className="text-4xl md:text-7xl font-black mb-4 tracking-tighter italic text-slate-900 uppercase">{t('gameOver')}</h2>
      <div className="bg-slate-900 text-white px-6 py-2 skew-x-[-10deg] mb-8">
        <p className="font-black italic text-lg md:text-2xl skew-x-[10deg]">{t('reachedFloor', { stage })}</p>
      </div>

      <button
        onClick={() => setGameState('START')}
        className="px-10 md:px-12 py-4 md:py-5 bg-slate-900 text-white font-black text-xl md:text-2xl skew-x-[-12deg] hover:bg-blue-600 transition-all shadow-xl"
      >
        <span className="flex items-center gap-3 skew-x-[12deg]">
          <RefreshCw className="w-5 h-5 md:w-6 md:h-6" /> {t('restart')}
        </span>
      </button>
    </motion.div>
  );
}
