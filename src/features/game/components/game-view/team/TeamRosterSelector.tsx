import type { GamePokemon } from '../../../../../types';

interface TeamRosterSelectorProps {
  team: GamePokemon[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  getLocalized: (obj: any) => string;
  title: string;
}

export function TeamRosterSelector({
  team,
  selectedIndex,
  onSelect,
  getLocalized,
  title,
}: TeamRosterSelectorProps) {
  if (team.length === 0) return null;

  return (
    <div className="px-4 md:px-8 pt-4 md:pt-6 pb-2 border-b border-slate-100">
      <div className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
        {title}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {team.map((pokemon, index) => {
          const active = index === selectedIndex;
          return (
            <button
              key={`${pokemon.id}-${index}`}
              onClick={() => onSelect(index)}
              className={`flex-shrink-0 min-w-[110px] px-2 py-2 border-b-4 transition-all flex items-center gap-2 ${
                active
                  ? 'bg-blue-50 border-blue-500'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-400'
              }`}
            >
              <img
                src={pokemon.sprites.front_default}
                className="w-10 h-10 object-contain"
                referrerPolicy="no-referrer"
              />
              <div className="text-left min-w-0">
                <div className="font-black italic uppercase text-[10px] truncate">
                  {getLocalized(pokemon)}
                </div>
                <div className="text-[8px] font-bold text-slate-500">
                  HP {pokemon.currentHp}/{pokemon.maxHp}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
