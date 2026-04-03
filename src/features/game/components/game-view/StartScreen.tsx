import { motion } from 'motion/react';
import { ChevronRight, Dna, RefreshCw, Sparkles, Sword, Zap } from 'lucide-react';
import { GENERATIONS } from '../../../../constants';
import type { GameViewSectionProps } from './shared';

export function StartScreen({ viewModel }: GameViewSectionProps) {
  const {
    startStep,
    selectedGens,
    startLevel,
    loading,
    t,
    setStartStep,
    setSelectedGens,
    setStartLevel,
    startGame,
  } = viewModel;

  return (
    <motion.div
      key="start"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: -100 }}
      className="flex-1 flex flex-col items-center justify-center py-4 text-center overflow-y-auto custom-scrollbar"
    >
      {startStep === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
          <div className="relative mb-6">
            <div className="w-48 h-48 bg-white rounded-full shadow-2xl flex items-center justify-center relative overflow-hidden border-8 border-slate-100">
              <Dna className="w-24 h-24 text-blue-500 relative z-10" />
              <div className="absolute top-0 left-0 w-full h-1/2 bg-red-500 opacity-10" />
            </div>
            <div className="absolute -bottom-4 -right-4 bg-red-500 text-white p-4 rounded-full shadow-lg">
              <Sword className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-4xl sm:text-6xl font-black mb-6 tracking-tighter italic text-slate-900 uppercase">PokeFactory</h2>
          <p className="text-slate-500 max-w-md mb-12 text-base sm:text-lg font-medium italic px-4">{t('rogueJourney')}</p>
          <button
            onClick={() => setStartStep(1)}
            className="group relative px-10 sm:px-16 py-4 sm:py-6 bg-slate-900 text-white rounded-none skew-x-[-12deg] font-black text-xl sm:text-3xl transition-all hover:bg-blue-600 hover:scale-105 active:scale-95 shadow-[12px_12px_0px_#00000022]"
          >
            <span className="flex items-center gap-3 skew-x-[12deg]">
              {t('startBattle')}
              <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" />
            </span>
          </button>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-3xl">
          <div className="mb-8 flex items-center justify-between">
            <button
              onClick={() => setStartStep((prev) => prev - 1)}
              className="text-slate-400 font-black italic hover:text-slate-900 flex items-center gap-2"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
              {t('back')}
            </button>
            <div className="flex gap-2">
              {[1, 2].map((stepIndex) => (
                <div key={stepIndex} className={`w-3 h-3 rounded-full ${startStep >= stepIndex ? 'bg-blue-500' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>

          <div className="bg-white p-6 md:p-10 shadow-2xl border-b-8 border-slate-900 mb-6 md:mb-12">
            {startStep === 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 className="text-xl md:text-2xl font-black italic mb-6 md:mb-8 uppercase tracking-tighter flex items-center gap-3">
                  <Dna className="w-5 h-5 md:w-6 md:h-6 text-blue-500" /> {t('selectRegion')}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                  {GENERATIONS.map((generation) => (
                    <button
                      key={generation.id}
                      onClick={() => {
                        setSelectedGens((prev) =>
                          prev.includes(generation.id)
                            ? (prev.length > 1 ? prev.filter((id) => id !== generation.id) : prev)
                            : [...prev, generation.id],
                        );
                      }}
                      className={`p-3 md:p-4 border-2 md:border-4 skew-x-[-4deg] transition-all relative overflow-hidden group ${
                        selectedGens.includes(generation.id)
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105'
                          : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="skew-x-[4deg] relative z-10">
                        <div className="font-black text-base md:text-lg italic">{generation.name}</div>
                        <div className="text-[8px] md:text-[10px] font-bold opacity-60 uppercase tracking-widest">{generation.region}</div>
                      </div>
                      {selectedGens.includes(generation.id) && (
                        <div className="absolute top-0 right-0 w-6 h-6 md:w-8 md:h-8 bg-blue-500 flex items-center justify-center skew-x-[4deg] -translate-y-1 md:-translate-y-2 translate-x-1 md:translate-x-2">
                          <Sparkles className="w-2 h-2 md:w-3 md:h-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setStartStep(2)}
                  className="mt-8 md:mt-12 w-full py-4 md:py-5 bg-blue-600 text-white font-black text-lg md:text-xl italic skew-x-[-10deg] hover:bg-blue-700 transition-all shadow-lg"
                >
                  <span className="skew-x-[10deg] inline-block">{t('nextStep')}</span>
                </button>
              </motion.div>
            )}

            {startStep === 2 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 className="text-xl md:text-2xl font-black italic mb-6 md:mb-8 uppercase tracking-tighter flex items-center gap-3">
                  <Zap className="w-5 h-5 md:w-6 md:h-6 text-yellow-500" /> {t('setDifficulty')}
                </h3>
                <div className="flex flex-col sm:flex-row justify-center gap-4 md:gap-6">
                  {[30, 50].map((level) => (
                    <button
                      key={level}
                      onClick={() => setStartLevel(level)}
                      className={`flex-1 py-6 md:py-8 px-8 md:px-10 text-3xl md:text-4xl font-black italic transition-all skew-x-[-10deg] border-2 md:border-4 ${
                        startLevel === level
                          ? 'bg-yellow-400 text-white border-yellow-400 shadow-2xl scale-105'
                          : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="skew-x-[10deg]">
                        <div className="text-[10px] md:text-sm uppercase opacity-60 mb-1 md:mb-2">Level</div>
                        <div>{level}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={startGame}
                  disabled={loading}
                  className="mt-8 md:mt-12 w-full py-5 md:py-6 bg-slate-900 text-white font-black text-xl md:text-2xl italic skew-x-[-10deg] hover:bg-red-600 transition-all shadow-xl disabled:opacity-50"
                >
                  <span className="skew-x-[10deg] inline-block flex items-center justify-center gap-3">
                    {loading ? <RefreshCw className="animate-spin w-5 h-5 md:w-6 md:h-6" /> : t('startAdventure')}
                  </span>
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
