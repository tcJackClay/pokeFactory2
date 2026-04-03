import { AnimatePresence, motion } from 'motion/react';
import { Eye, RefreshCw, Sparkles } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../../../../types';
import { FACTORY_REWARD_CONFIG } from '../../config/factoryRewards';
import type { GameViewSectionProps } from './shared';

export function GameHeader({ viewModel }: GameViewSectionProps) {
  const {
    gameState,
    coins,
    stage,
    streak,
    currentLanguage,
    showLangMenu,
    showLogHistory,
    t,
    setShowLangMenu,
    setCurrentLanguage,
    setShowLogHistory,
  } = viewModel;

  const currentLanguageLabel = SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLanguage)?.name ?? 'English';
  const battlesPerSet = FACTORY_REWARD_CONFIG.battlesPerSet;
  const setBattleProgress = ((stage - 1) % battlesPerSet) + 1;

  return (
    <header className="flex justify-between items-center flex-none mb-4 relative z-50">
      <div className="flex items-center gap-4">
        <div className="bg-slate-900 px-6 py-2 skew-x-[-12deg] shadow-xl border-l-4 border-blue-500">
          <h1 className="text-xl font-black italic tracking-tighter skew-x-[12deg] text-white uppercase">PokeFactory</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowLangMenu((open) => !open)}
            className="bg-white px-4 py-1.5 skew-x-[-12deg] shadow-sm border border-slate-200 hover:border-blue-500 transition-all group flex items-center gap-2 pointer-events-auto"
          >
            <div className="skew-x-[12deg] flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                {currentLanguageLabel}
              </span>
            </div>
          </button>

          <AnimatePresence>
            {showLangMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-40 bg-white shadow-2xl border-4 border-slate-900 overflow-hidden z-[100] pointer-events-auto"
              >
                <div className="p-1 grid grid-cols-1">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setCurrentLanguage(lang.code);
                        setShowLangMenu(false);
                      }}
                      className={`px-4 py-2 text-left text-[10px] font-black italic uppercase transition-all ${
                        currentLanguage === lang.code ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {gameState !== 'START' && (
          <>
            <div className="bg-white px-4 py-1.5 skew-x-[-12deg] shadow-sm border-r-4 border-yellow-500">
              <span className="font-black italic skew-x-[12deg] inline-block flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-yellow-500" /> {coins}
              </span>
            </div>
            <div className="bg-white px-4 py-1.5 skew-x-[-12deg] shadow-sm border-r-4 border-red-500">
              <span className="font-black italic skew-x-[12deg] inline-block text-sm uppercase tracking-widest">
                {t('stage')} {stage}
              </span>
            </div>
            <div className="bg-white px-4 py-1.5 skew-x-[-12deg] shadow-sm border-r-4 border-emerald-500">
              <span className="font-black italic skew-x-[12deg] inline-block text-xs uppercase tracking-wide">
                {t('setProgress', { current: setBattleProgress, total: battlesPerSet })}
              </span>
            </div>
            <div className="bg-white px-4 py-1.5 skew-x-[-12deg] shadow-sm border-r-4 border-violet-500">
              <span className="font-black italic skew-x-[12deg] inline-block text-xs uppercase tracking-wide">
                {t('streak', { count: streak })}
              </span>
            </div>
          </>
        )}

        {gameState === 'BATTLE' && (
          <button
            onClick={() => setShowLogHistory((show) => !show)}
            className={`p-2 skew-x-[-12deg] transition-all shadow-sm border pointer-events-auto ${
              showLogHistory
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-900 border-slate-200 hover:border-slate-900'
            }`}
            title={t('battleHistory')}
          >
            <RefreshCw
              className={`w-4 h-4 skew-x-[12deg] ${showLogHistory ? 'rotate-180' : ''} transition-transform duration-500`}
            />
          </button>
        )}
      </div>
    </header>
  );
}
