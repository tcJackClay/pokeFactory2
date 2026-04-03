import { motion } from 'motion/react';
import TypeBadge from '../../../../../components/TypeBadge';
import { AILMENT_ZH } from '../../../../../uiAppConstants';
import type { GamePokemon } from '../../../../../types';
import type { BattleAnimation, LocalizeFn } from '../../../view-model';

interface PlayerBattleCardProps {
  player: GamePokemon;
  playerAnim: BattleAnimation;
  getLocalized: LocalizeFn;
}

export function PlayerBattleCard({ player, playerAnim, getLocalized }: PlayerBattleCardProps) {
  return (
    <div className="absolute bottom-2 sm:bottom-4 left-4 sm:left-12 flex flex-col items-start">
      <motion.img
        animate={
          playerAnim === 'attack'
            ? { x: 40 }
            : playerAnim === 'hit'
              ? { x: [0, -10, 10, -10, 0], opacity: [1, 0.5, 1] }
              : { y: [0, 5, 0] }
        }
        transition={playerAnim === 'idle' ? { repeat: Infinity, duration: 2 } : { duration: 0.3 }}
        src={player.sprites.back_default || player.sprites.front_default}
        className="w-40 h-40 sm:w-64 sm:h-64 object-contain drop-shadow-2xl"
        referrerPolicy="no-referrer"
      />

      <div className="bg-white p-2 sm:p-3 shadow-lg border-l-8 border-blue-500 w-48 sm:w-72 skew-x-[-10deg] mt-[-20px] sm:mt-[-40px] relative z-20">
        <div className="skew-x-[10deg] flex flex-col gap-0.5 sm:gap-1">
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="font-black text-sm sm:text-xl italic uppercase truncate max-w-[80px] sm:max-w-none">
                {getLocalized(player)}
              </span>
              {player.status && (
                <span className="bg-slate-900 text-white text-[6px] sm:text-[8px] px-1 py-0.5 font-black uppercase tracking-tighter">
                  {AILMENT_ZH[player.status] || player.status}
                </span>
              )}
            </div>
            <span className="text-[8px] sm:text-xs font-bold bg-slate-900 text-white px-1.5 sm:px-2 py-0.5">
              Lv.{player.level}
            </span>
          </div>
          <div className="flex gap-1 mb-0.5 sm:mb-1">
            {player.types.map((typeSlot) => (
              <TypeBadge key={typeSlot.type.name} type={typeSlot.type.name} size="xs" />
            ))}
          </div>
          <div className="h-1.5 sm:h-2 bg-slate-200 rounded-none relative overflow-hidden border border-slate-300">
            <motion.div
              animate={{ width: `${(player.currentHp / player.maxHp) * 100}%` }}
              className={`h-full transition-colors ${
                player.currentHp / player.maxHp < 0.2
                  ? 'bg-red-500'
                  : player.currentHp / player.maxHp < 0.5
                    ? 'bg-yellow-500'
                    : 'bg-blue-500'
              }`}
            />
          </div>
          <div className="text-right text-[8px] sm:text-[10px] font-black italic">
            {player.currentHp} / {player.maxHp}
          </div>
        </div>
      </div>
    </div>
  );
}
