import { motion } from 'motion/react';
import type { GameViewSectionProps } from '../shared';

export function BattlePokemonPanel({ viewModel }: GameViewSectionProps) {
  const { playerTeam, gameState, t, getLocalized, switchPokemon, setInfoPokemonIdx, setPrevGameState, setGameState } = viewModel;

  return (
    <motion.div key="pokemon-list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full flex flex-col p-2 sm:p-3">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
        {playerTeam.map((pokemon, index) => (
          <div
            key={`${pokemon.id}-${index}`}
            className={`p-1.5 sm:p-2 border skew-x-[-4deg] transition-all ${
              index === 0 ? 'bg-blue-50 border-blue-500' : pokemon.currentHp <= 0 ? 'opacity-50 bg-slate-100' : 'bg-white border-slate-200'
            }`}
          >
            <div className="skew-x-[4deg] flex flex-col gap-1.5 w-full">
              <div className="flex items-center gap-1.5 min-w-0">
                <img src={pokemon.sprites.front_default} className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0" referrerPolicy="no-referrer" />
                <div className="flex-1 overflow-hidden">
                  <div className="font-black text-[9px] sm:text-[10px] truncate uppercase">{getLocalized(pokemon)}</div>
                  <div className="h-1.5 bg-slate-200 mt-1">
                    <div className="h-full bg-blue-500" style={{ width: `${(pokemon.currentHp / pokemon.maxHp) * 100}%` }} />
                  </div>
                  <div className="mt-0.5 text-[8px] font-bold text-slate-500">
                    HP {pokemon.currentHp}/{pokemon.maxHp}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  disabled={pokemon.currentHp <= 0 || index === 0}
                  onClick={() => switchPokemon(index)}
                  className="px-1.5 py-1 bg-blue-500 text-white text-[8px] font-black italic hover:bg-blue-600 disabled:opacity-50"
                >
                  {t('switch')}
                </button>
                <button
                  onClick={() => {
                    setInfoPokemonIdx(index);
                    setPrevGameState(gameState);
                    setGameState('POKEMON_INFO');
                  }}
                  className="px-1.5 py-1 bg-slate-900 text-white text-[8px] font-black italic hover:bg-slate-700"
                >
                  {t('info')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
