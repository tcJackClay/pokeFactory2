import { motion, useReducedMotion } from 'motion/react';
import type { PokemonInfoScreenProps } from './shared';
import { PokemonDetailPanel } from './PokemonDetailPanel';
import { TeamRosterSelector } from './team/TeamRosterSelector';

export function PokemonInfoScreen({ viewModel, displayPokemon, pokemonList, selectedIndex }: PokemonInfoScreenProps) {
  const {
    t,
    getLocalized,
    getLocalizedDesc,
    getLocalizedNature,
    getStatName,
    setGameState,
    setInfoPokemonIdx,
    prevGameState,
  } = viewModel;
  const shouldReduceMotion = useReducedMotion();
  const isZh = viewModel.currentLanguage.startsWith('zh');

  return (
    <motion.div
      key="pokemon-info"
      initial={shouldReduceMotion ? false : { opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -100 }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.22, ease: 'easeOut' }}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="flex flex-1 flex-col overflow-hidden rounded-[30px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,245,249,0.97)_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
        <div className="border-b border-slate-200/80 bg-white/[0.78]">
          <TeamRosterSelector
            team={pokemonList}
            selectedIndex={selectedIndex}
            onSelect={setInfoPokemonIdx}
            getLocalized={getLocalized}
            title={t('viewTeam')}
          />
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          <PokemonDetailPanel
            pokemon={displayPokemon}
            isZh={isZh}
            t={t}
            getLocalized={getLocalized}
            getLocalizedDesc={getLocalizedDesc}
            getLocalizedNature={getLocalizedNature}
            getStatName={getStatName}
          />
        </div>

        <div className="border-t border-slate-200/80 bg-white/[0.78] px-4 py-4 md:px-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setGameState(prevGameState)}
              className="min-h-[48px] rounded-[18px] border border-orange-300 bg-orange-500 px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_18px_28px_rgba(249,115,22,0.22)] transition-colors hover:bg-orange-600"
            >
              {isZh ? '返回' : t('back')}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
