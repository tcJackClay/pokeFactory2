import { motion } from 'motion/react';
import TypeBadge from '../../../../components/TypeBadge';
import type { GameViewSectionProps } from './shared';

export function FactorySelectScreen({ viewModel }: GameViewSectionProps) {
  const {
    factoryRentals,
    selectedRentalIndices,
    currentLanguage,
    t,
    getLocalized,
    toggleRental,
    setInfoPokemonIdx,
    setPrevGameState,
    setGameState,
    confirmRentals,
  } = viewModel;

  return (
    <motion.div
      key="factory-select"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 flex flex-col p-4 overflow-hidden"
    >
      <div className="text-center mb-8">
        <div className="inline-block bg-slate-900 px-12 py-3 skew-x-[-12deg] shadow-xl mb-4">
          <h2 className="text-3xl font-black italic tracking-tighter skew-x-[12deg] text-white uppercase">{t('factorySelect')}</h2>
        </div>
        <p className="text-slate-500 font-bold italic text-sm">{t('factorySelectDesc')}</p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
          {factoryRentals.map((pokemon, index) => {
            const isSelected = selectedRentalIndices.includes(index);
            return (
              <div
                key={`${pokemon.id}-${index}`}
                onClick={() => toggleRental(index)}
                className={`group relative bg-white p-5 shadow-lg transition-all border-b-4 flex flex-col items-center cursor-pointer ${
                  isSelected ? 'border-blue-500 -translate-y-1 scale-[1.02]' : 'border-slate-100 hover:border-slate-300'
                }`}
              >
                <div className={`absolute top-0 left-0 px-3 py-1 text-[9px] font-black italic text-white skew-x-[-10deg] z-20 ${isSelected ? 'bg-blue-500' : 'bg-slate-400'}`}>
                  <span className="skew-x-[10deg] inline-block uppercase">#{index + 1}</span>
                </div>

                <div className="relative mb-2 group-hover:scale-110 transition-transform">
                  <img
                    src={pokemon.sprites.front_default}
                    alt={pokemon.name}
                    className="w-24 h-24 object-contain mx-auto relative z-10 drop-shadow-md"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h4 className="text-lg font-black italic mb-1 uppercase leading-tight text-center">{getLocalized(pokemon)}</h4>
                <div className="flex justify-center gap-1 mt-1 mb-4">
                  {pokemon.types.map((typeSlot) => (
                    <TypeBadge key={typeSlot.type.name} type={typeSlot.type.name} size="xs" />
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full text-[10px] font-bold italic text-slate-500">
                  <div className="flex justify-between"><span>{t('hp')}</span><span>{pokemon.maxHp}</span></div>
                  <div className="flex justify-between"><span>{t('attack')}</span><span>{pokemon.calculatedStats.attack}</span></div>
                  <div className="flex justify-between"><span>{t('defense')}</span><span>{pokemon.calculatedStats.defense}</span></div>
                  <div className="flex justify-between"><span>{t('spAtk')}</span><span>{pokemon.calculatedStats.spAtk}</span></div>
                  <div className="flex justify-between"><span>{t('spDef')}</span><span>{pokemon.calculatedStats.spDef}</span></div>
                  <div className="flex justify-between"><span>{t('speed')}</span><span>{pokemon.calculatedStats.speed}</span></div>
                </div>

                <div className="mt-4 w-full space-y-1">
                  {pokemon.selectedMoves.map((move, moveIndex) => (
                    <div key={`${move.name}-${moveIndex}`} className="flex justify-between items-center text-[8px] bg-slate-50 px-2 py-1">
                      <span className="font-black italic uppercase truncate max-w-[80px]">{getLocalized(move)}</span>
                      <TypeBadge type={move.type} size="xs" className="scale-75 origin-right" />
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 w-full mt-4">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setInfoPokemonIdx(index);
                      setPrevGameState('FACTORY_SELECT');
                      setGameState('POKEMON_INFO');
                    }}
                    className="flex-1 py-1.5 bg-slate-100 text-slate-600 font-black italic hover:bg-slate-200 transition-all text-[10px] uppercase"
                  >
                    {t('info')}
                  </button>
                  <div className={`flex-[2] py-1.5 font-black italic text-[10px] uppercase text-center ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'}`}>
                    {isSelected ? (currentLanguage.startsWith('zh') ? '已选择' : 'Selected') : t('selectThis')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 bg-white border-t-4 border-slate-900 flex justify-center">
        <button
          disabled={selectedRentalIndices.length !== 3}
          onClick={confirmRentals}
          className={`px-12 py-4 font-black italic text-xl skew-x-[-12deg] transition-all shadow-xl ${
            selectedRentalIndices.length === 3
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span className="skew-x-[12deg] inline-block">{t('confirmSelection', { count: selectedRentalIndices.length })}</span>
        </button>
      </div>
    </motion.div>
  );
}
