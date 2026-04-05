import { motion, useReducedMotion } from 'motion/react';
import type { GameViewSectionProps } from '../shared';

export function ReplacePokemonModal({ viewModel }: GameViewSectionProps) {
  const { showReplaceUI, playerTeam, currentLanguage, t, getLocalized, replacePokemon, setShowReplaceUI } = viewModel;
  const shouldReduceMotion = useReducedMotion();
  const isZh = currentLanguage.startsWith('zh');

  if (!showReplaceUI) return null;

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pf-modal-backdrop"
    >
      <div className="pf-modal-sheet p-5 sm:p-6">
        <div>
          <h2 className="text-2xl font-black text-slate-950 sm:text-[30px]">{t('teamFull')}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            {t('replacePartner')} <span className="font-black text-blue-600">{getLocalized(showReplaceUI)}</span>
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {playerTeam.map((pokemon, index) => (
              <button
                key={`${pokemon.id}-${index}`}
                type="button"
                onClick={() => replacePokemon(index)}
                className="rounded-[20px] border border-slate-200 bg-white/92 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] transition-all hover:border-blue-300 hover:bg-blue-50/70"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[18px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,246,250,0.96)_100%)]">
                    <img
                      src={pokemon.sprites.front_default}
                      className="h-14 w-14 object-contain"
                      referrerPolicy="no-referrer"
                      alt={pokemon.name}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-lg font-black text-slate-900">{getLocalized(pokemon)}</div>
                    <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Lv.{pokemon.level}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowReplaceUI(null)}
            className="pf-action-button mt-5 w-full"
          >
            <span>{t('cancelReplace')}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
