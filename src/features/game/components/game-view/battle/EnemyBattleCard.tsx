import { motion } from 'motion/react';
import TypeBadge from '../../../../../components/TypeBadge';
import { AILMENT_ZH } from '../../../../../uiAppConstants';
import type { GamePokemon } from '../../../../../types';
import type { BattleAnimation, LocalizeFn } from '../../../view-model';

interface EnemyBattleCardProps {
  enemy: GamePokemon;
  enemyAnim: BattleAnimation;
  isCatching: boolean;
  getLocalized: LocalizeFn;
}

export function EnemyBattleCard({ enemy, enemyAnim, isCatching, getLocalized }: EnemyBattleCardProps) {
  return (
    <div className="absolute top-4 sm:top-8 right-4 sm:right-12 flex flex-col items-end">
      <div className="bg-white p-2 sm:p-3 shadow-lg border-r-8 border-red-500 w-48 sm:w-72 skew-x-[-10deg] mb-2 sm:mb-4">
        <div className="skew-x-[10deg] flex flex-col gap-0.5 sm:gap-1">
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="font-black text-sm sm:text-xl italic uppercase truncate max-w-[80px] sm:max-w-none">
                {getLocalized(enemy)}
              </span>
              {enemy.status && (
                <span className="bg-slate-900 text-white text-[6px] sm:text-[8px] px-1 py-0.5 font-black uppercase tracking-tighter">
                  {AILMENT_ZH[enemy.status] || enemy.status}
                </span>
              )}
            </div>
            <span className="text-[8px] sm:text-xs font-bold bg-slate-900 text-white px-1.5 sm:px-2 py-0.5">
              Lv.{enemy.level}
            </span>
          </div>
          <div className="flex gap-1 mb-0.5 sm:mb-1">
            {enemy.types.map((typeSlot) => (
              <TypeBadge key={typeSlot.type.name} type={typeSlot.type.name} size="xs" />
            ))}
          </div>
          <div className="h-1.5 sm:h-2 bg-slate-200 rounded-none relative overflow-hidden border border-slate-300">
            <motion.div
              animate={{ width: `${(enemy.currentHp / enemy.maxHp) * 100}%` }}
              className={`h-full transition-colors ${
                enemy.currentHp / enemy.maxHp < 0.2
                  ? 'bg-red-500'
                  : enemy.currentHp / enemy.maxHp < 0.5
                    ? 'bg-yellow-500'
                    : 'bg-emerald-500'
              }`}
            />
          </div>
          <div className="text-right text-[8px] sm:text-[10px] font-black italic text-slate-300">??? / ???</div>
        </div>
      </div>

      <motion.img
        animate={
          isCatching
            ? { scale: 0, opacity: 0 }
            : enemyAnim === 'attack'
              ? { x: -40, scale: 1, opacity: 1 }
              : enemyAnim === 'hit'
                ? { x: [0, 10, -10, 10, 0], opacity: [1, 0.5, 1], scale: 1 }
                : { y: [0, -5, 0], scale: 1, opacity: 1 }
        }
        transition={
          isCatching
            ? { duration: 0.5 }
            : enemyAnim === 'idle'
              ? { y: { repeat: Infinity, duration: 2 }, scale: { duration: 0.3 }, opacity: { duration: 0.3 } }
              : { duration: 0.3 }
        }
        src={enemy.sprites.front_default}
        className="w-32 h-32 sm:w-48 sm:h-48 object-contain drop-shadow-2xl"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
