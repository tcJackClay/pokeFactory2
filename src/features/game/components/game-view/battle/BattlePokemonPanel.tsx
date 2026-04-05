import { motion, useReducedMotion } from 'motion/react';
import { Info, RotateCcw } from 'lucide-react';
import type { GameViewSectionProps } from '../shared';

export function BattlePokemonPanel({ viewModel }: GameViewSectionProps) {
  const { playerTeam, gameState, t, getLocalized, switchPokemon, setInfoPokemonIdx, setPrevGameState, setGameState } = viewModel;
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      key="pokemon-list"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.18, ease: 'easeOut' }}
      className="flex h-full flex-col p-3 sm:p-4"
    >
      <div className="custom-scrollbar grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {playerTeam.map((pokemon, index) => {
          const hpRatio = pokemon.maxHp > 0 ? pokemon.currentHp / pokemon.maxHp : 0;
          const canSwitch = pokemon.currentHp > 0 && index !== 0;

          return (
            <div
              key={`${pokemon.id}-${index}`}
              className={`rounded-[20px] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] ${
                index === 0
                  ? 'border-blue-200 bg-blue-50/80'
                  : pokemon.currentHp <= 0
                    ? 'border-slate-200 bg-slate-100/80 opacity-70'
                    : 'border-slate-200 bg-white/90'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/80 bg-white/85 shadow-sm">
                  <img
                    src={pokemon.sprites.front_default}
                    className="h-12 w-12 object-contain"
                    referrerPolicy="no-referrer"
                    alt={pokemon.name}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-black text-slate-900">{getLocalized(pokemon)}</div>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.10em] text-slate-500">
                      Lv.{pokemon.level}
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${
                        hpRatio < 0.2 ? 'bg-red-500' : hpRatio < 0.5 ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, hpRatio * 100))}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] font-bold text-slate-500">
                    HP {pokemon.currentHp}/{pokemon.maxHp}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!canSwitch}
                  onClick={() => switchPokemon(index)}
                  className={`inline-flex min-h-[40px] items-center justify-center gap-1 rounded-[14px] border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-all ${
                    canSwitch
                      ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'border-slate-200 bg-slate-100 text-slate-400'
                  }`}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('switch')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInfoPokemonIdx(index);
                    setPrevGameState(gameState);
                    setGameState('POKEMON_INFO');
                  }}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-[14px] border border-slate-200 bg-white text-[10px] font-black uppercase tracking-[0.12em] text-slate-700 transition-all hover:bg-slate-50"
                >
                  <Info className="h-3.5 w-3.5" />
                  {t('info')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
