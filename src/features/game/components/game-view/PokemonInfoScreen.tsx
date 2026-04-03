import { AnimatePresence, motion } from 'motion/react';
import TypeBadge from '../../../../components/TypeBadge';
import type { PokemonInfoScreenProps } from './shared';

export function PokemonInfoScreen({ viewModel, displayPokemon, isMobileViewport }: PokemonInfoScreenProps) {
  const {
    hoveredMove,
    t,
    getLocalized,
    getLocalizedDesc,
    getLocalizedNature,
    getStatName,
    setHoveredMove,
    setGameState,
    prevGameState,
  } = viewModel;

  return (
    <motion.div
      key="pokemon-info"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="flex-1 flex flex-col max-w-5xl mx-auto w-full overflow-hidden"
    >
      <div className="bg-white shadow-2xl overflow-hidden border-y-4 md:border-y-8 border-slate-900 flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-4 md:p-8 bg-slate-50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 md:p-4 opacity-20 md:opacity-100">
                <div className="text-4xl md:text-6xl font-black italic text-slate-200 tracking-tighter">
                  #{String(displayPokemon.id).padStart(3, '0')}
                </div>
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-8">
                  <div className="bg-slate-900 text-white px-3 py-1 skew-x-[-12deg] font-black italic text-sm md:text-xl">
                    <span className="skew-x-[12deg]">LV.{displayPokemon.level}</span>
                  </div>
                  <h2 className="text-2xl md:text-4xl font-black italic tracking-tighter uppercase truncate">
                    {getLocalized(displayPokemon)}
                  </h2>
                </div>
                <div className="flex gap-2 md:gap-3 mb-4 md:mb-8">
                  {displayPokemon.types.map((typeSlot) => (
                    <TypeBadge
                      key={typeSlot.type.name}
                      type={typeSlot.type.name}
                      size={isMobileViewport ? 'sm' : 'lg'}
                    />
                  ))}
                </div>
                <div className="flex justify-center py-4 md:py-12">
                  <motion.img
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    src={displayPokemon.sprites.front_default}
                    className="w-40 h-40 md:w-64 md:h-64 object-contain drop-shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="bg-white p-3 md:p-4 border-l-4 border-slate-900 shadow-sm">
                  <div className="text-[10px] font-black text-slate-400 uppercase mb-1">{t('ability')}</div>
                  <div className="font-black italic text-base md:text-lg">
                    {getLocalized(displayPokemon.abilities[0]?.ability) || t('none')}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-8 bg-white">
              <div className="mb-6 md:mb-8">
                <div className="flex justify-between items-end mb-4 md:mb-6 border-b border-slate-100 pb-2">
                  <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-slate-400">{t('stats')}</h3>
                  <div className="text-[8px] md:text-[10px] font-bold text-blue-500 italic">
                    {getLocalizedNature(displayPokemon.nature)} {t('nature')}
                    ({displayPokemon.nature.plus ? `+${getStatName(displayPokemon.nature.plus)}` : ''}
                    {displayPokemon.nature.minus ? `, -${getStatName(displayPokemon.nature.minus)}` : ''})
                  </div>
                </div>
                <div className="space-y-2 md:space-y-3">
                  {[
                    { key: 'hp', color: 'bg-red-500' },
                    { key: 'attack', color: 'bg-orange-500' },
                    { key: 'defense', color: 'bg-yellow-500' },
                    { key: 'spAtk', color: 'bg-blue-500' },
                    { key: 'spDef', color: 'bg-green-500' },
                    { key: 'speed', color: 'bg-pink-500' },
                  ].map((statConfig) => {
                    const value = (displayPokemon.calculatedStats as any)[statConfig.key];
                    const base = (displayPokemon.baseStats as any)[statConfig.key];
                    const iv = (displayPokemon.ivs as any)[statConfig.key];
                    const statName = getStatName(statConfig.key);

                    return (
                      <div key={statConfig.key} className="flex flex-col gap-0.5 md:gap-1">
                        <div className="flex justify-between items-center text-[8px] md:text-[10px] font-bold italic">
                          <div className="text-slate-500">{statName}</div>
                          <div className="text-slate-300">
                            {t('base')}: {base} / {t('iv')}: {iv}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className="flex-1 h-1.5 md:h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(value / 400) * 100}%` }}
                              className={`h-full ${statConfig.color}`}
                            />
                          </div>
                          <div className="w-6 md:w-8 text-right font-black italic text-xs md:text-sm">{value}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-slate-400 mb-4 md:mb-6 border-b border-slate-100 pb-2">
                  {t('currentMoves')}
                </h3>
                <div className="grid grid-cols-1 gap-2 md:gap-3">
                  {displayPokemon.selectedMoves.map((move, index) => (
                    <div
                      key={`${move.name}-${index}`}
                      onMouseEnter={() => setHoveredMove(move)}
                      onMouseLeave={() => setHoveredMove(null)}
                      className="flex items-center justify-between p-2 md:p-3 bg-slate-50 border-l-4 border-slate-900 group hover:bg-slate-100 transition-colors cursor-help"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-black italic uppercase text-xs md:text-sm truncate">{getLocalized(move)}</div>
                        <div className="text-[8px] md:text-[10px] text-slate-400 font-bold italic truncate">
                          {t('power')}: {move.power || '--'} / {t('accuracy')}: {move.accuracy || '--'} / {t('pp')}: {move.pp || '--'}
                        </div>
                      </div>
                      <TypeBadge type={move.type} size="xs" />
                    </div>
                  ))}
                </div>

                <AnimatePresence>
                  {hoveredMove && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 right-0 mb-2 md:mb-4 bg-slate-900 text-white p-3 md:p-4 shadow-2xl z-50 border-t-4 border-blue-500"
                    >
                      <div className="flex justify-between items-center mb-1 md:mb-2">
                        <div className="font-black italic text-sm md:text-lg">{getLocalized(hoveredMove)}</div>
                        <div className="text-[8px] md:text-[10px] px-2 py-0.5 bg-white text-slate-900 font-bold uppercase">
                          {hoveredMove.damage_class === 'special' ? t('special') : t('physical')}
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs text-slate-300 leading-relaxed italic">{getLocalizedDesc(hoveredMove)}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 p-3 md:p-4 flex justify-end flex-none">
          <button
            onClick={() => setGameState(prevGameState)}
            className="px-6 md:px-8 py-2 bg-white text-slate-900 font-black italic skew-x-[-12deg] hover:bg-blue-500 hover:text-white transition-all text-sm md:text-base"
          >
            <span className="skew-x-[12deg]">{t('back')}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
