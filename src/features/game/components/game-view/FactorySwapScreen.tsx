import { motion } from 'motion/react';
import { Dna, Swords } from 'lucide-react';
import TypeBadge from '../../../../components/TypeBadge';
import type { GameViewSectionProps } from './shared';

export function FactorySwapScreen({ viewModel }: GameViewSectionProps) {
  const { playerTeam, enemyTeam, t, getLocalized, performSwap, nextFactoryStage } = viewModel;

  return (
    <motion.div
      key="factory-swap"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 flex flex-col p-4 overflow-hidden"
    >
      <div className="text-center mb-8">
        <div className="inline-block bg-slate-900 px-12 py-3 skew-x-[-12deg] shadow-xl mb-4">
          <h2 className="text-3xl font-black italic tracking-tighter skew-x-[12deg] text-white uppercase">{t('factorySwap')}</h2>
        </div>
        <p className="text-slate-500 font-bold italic text-sm">{t('factorySwapDesc')}</p>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-hidden px-4">
        <div className="flex flex-col overflow-hidden">
          <h3 className="text-xl font-black italic mb-4 flex items-center gap-2">
            <Dna className="w-6 h-6 text-blue-500" /> {t('currentTeam')}
          </h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
            {playerTeam.map((pokemon, index) => (
              <div key={`${pokemon.id}-${index}`} className="bg-white p-4 shadow-md border-l-4 border-blue-500 flex items-center gap-4">
                <img src={pokemon.sprites.front_default} className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                <div className="flex-1">
                  <div className="font-black italic uppercase text-lg">{getLocalized(pokemon)}</div>
                  <div className="flex gap-1 mt-1">
                    {pokemon.types.map((typeSlot) => (
                      <TypeBadge key={typeSlot.type.name} type={typeSlot.type.name} size="xs" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden">
          <h3 className="text-xl font-black italic mb-4 flex items-center gap-2">
            <Swords className="w-6 h-6 text-red-500" /> {t('opponentTeam')}
          </h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
            {enemyTeam.map((pokemon, enemyIndex) => (
              <div key={`${pokemon.id}-${enemyIndex}`} className="bg-white p-4 shadow-md border-l-4 border-red-500 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <img src={pokemon.sprites.front_default} className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                  <div>
                    <div className="font-black italic uppercase text-lg">{getLocalized(pokemon)}</div>
                    <div className="flex gap-1 mt-1">
                      {pokemon.types.map((typeSlot) => (
                        <TypeBadge key={typeSlot.type.name} type={typeSlot.type.name} size="xs" />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {playerTeam.map((candidate, playerIndex) => (
                    <button
                      key={`${candidate.id}-${playerIndex}`}
                      onClick={() => performSwap(playerIndex, enemyIndex)}
                      className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black italic skew-x-[-10deg] hover:bg-blue-600 transition-all"
                    >
                      <span className="skew-x-[10deg] inline-block">{t('swapWith')} {getLocalized(candidate)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 bg-white border-t-4 border-slate-900 flex justify-center gap-4">
        <button
          onClick={nextFactoryStage}
          className="px-12 py-4 bg-slate-200 text-slate-600 font-black italic text-xl skew-x-[-12deg] hover:bg-slate-300 transition-all shadow-xl"
        >
          <span className="skew-x-[12deg] inline-block">{t('skipSwap')}</span>
        </button>
      </div>
    </motion.div>
  );
}
