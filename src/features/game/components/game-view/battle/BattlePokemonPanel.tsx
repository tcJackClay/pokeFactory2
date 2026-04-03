import { motion } from 'motion/react';
import { Dna } from 'lucide-react';
import type { GameViewSectionProps } from '../shared';

export function BattlePokemonPanel({ viewModel }: GameViewSectionProps) {
  const { playerTeam, gameState, t, getLocalized, switchPokemon, setBattleMenuTab, setInfoPokemonIdx, setPrevGameState, setGameState } = viewModel;

  return (
    <motion.div key="pokemon-list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-black italic flex items-center gap-2">
          <Dna className="w-5 h-5" /> {t('myTeam')}
        </h3>
        <button onClick={() => setBattleMenuTab('MAIN')} className="text-xs font-bold text-slate-400 hover:text-slate-900 underline">
          {t('back')}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
        {playerTeam.map((pokemon, index) => (
          <div
            key={`${pokemon.id}-${index}`}
            className={`p-2 border skew-x-[-4deg] transition-all flex items-center gap-2 ${
              index === 0 ? 'bg-blue-50 border-blue-500' : pokemon.currentHp <= 0 ? 'opacity-50 bg-slate-100' : 'bg-white border-slate-200'
            }`}
          >
            <div className="skew-x-[4deg] flex items-center gap-2 w-full">
              <img src={pokemon.sprites.front_default} className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
              <div className="flex-1 overflow-hidden">
                <div className="font-black text-[10px] truncate uppercase">{getLocalized(pokemon)}</div>
                <div className="h-1.5 bg-slate-200 mt-1">
                  <div className="h-full bg-blue-500" style={{ width: `${(pokemon.currentHp / pokemon.maxHp) * 100}%` }} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  disabled={pokemon.currentHp <= 0 || index === 0}
                  onClick={() => switchPokemon(index)}
                  className="px-2 py-1 bg-blue-500 text-white text-[8px] font-black italic hover:bg-blue-600 disabled:opacity-50"
                >
                  {t('switch')}
                </button>
                <button
                  onClick={() => {
                    setInfoPokemonIdx(index);
                    setPrevGameState(gameState);
                    setGameState('POKEMON_INFO');
                  }}
                  className="px-2 py-1 bg-slate-900 text-white text-[8px] font-black italic hover:bg-slate-700"
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
