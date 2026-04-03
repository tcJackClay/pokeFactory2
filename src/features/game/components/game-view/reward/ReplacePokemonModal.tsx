import { motion } from 'motion/react';
import type { GameViewSectionProps } from '../shared';

export function ReplacePokemonModal({ viewModel }: GameViewSectionProps) {
  const { showReplaceUI, playerTeam, t, getLocalized, replacePokemon, setShowReplaceUI } = viewModel;
  if (!showReplaceUI) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <div className="bg-white max-w-2xl w-full p-8 skew-x-[-2deg] shadow-2xl relative">
        <div className="skew-x-[2deg]">
          <h2 className="text-3xl font-black italic mb-2 tracking-tighter">{t('teamFull')}</h2>
          <p className="text-slate-500 mb-8 font-bold italic">
            {t('replacePartner')}{' '}
            <span className="text-blue-600 uppercase">{getLocalized(showReplaceUI)}</span>
          </p>

          <div className="grid grid-cols-2 gap-4">
            {playerTeam.map((pokemon, index) => (
              <button
                key={`${pokemon.id}-${index}`}
                onClick={() => replacePokemon(index)}
                className="p-4 bg-slate-50 hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-500 transition-all text-left flex items-center gap-4 group"
              >
                <img src={pokemon.sprites.front_default} className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                <div>
                  <div className="font-black text-lg uppercase group-hover:text-blue-600">{getLocalized(pokemon)}</div>
                  <div className="text-xs font-bold text-slate-400">Lv.{pokemon.level}</div>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowReplaceUI(null)}
            className="mt-8 w-full py-4 bg-slate-200 text-slate-600 font-black italic hover:bg-slate-300 transition-all"
          >
            {t('cancelReplace')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
