import { motion, useReducedMotion } from 'motion/react';
import TypeBadge from '../../../../../components/TypeBadge';
import { AILMENT_ZH } from '../../../../../uiAppConstants';
import type { GamePokemon } from '../../../../../types';
import type { FactoryTrainerTemplate } from '../../../config/factoryTrainerTemplates';
import type { BattleAnimation, LocalizeFn } from '../../../view-model';

interface EnemyBattleCardProps {
  enemy: GamePokemon;
  trainer: FactoryTrainerTemplate | null;
  enemyAnim: BattleAnimation;
  isCatching: boolean;
  getLocalized: LocalizeFn;
}

export function EnemyBattleCard({ enemy, trainer, enemyAnim, isCatching, getLocalized }: EnemyBattleCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const hpRatio = enemy.maxHp > 0 ? enemy.currentHp / enemy.maxHp : 0;

  return (
    <div className="absolute right-4 top-4 flex flex-col items-end sm:right-8 sm:top-6 lg:right-12 lg:top-8">
      <div className="pf-battle-hud-card mb-3 w-[220px] p-3 sm:w-[276px] sm:p-4" data-side="enemy">
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-base font-black text-slate-950 sm:text-[19px]">
                {getLocalized(enemy)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {enemy.status && (
                <span className="rounded-full bg-slate-900 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white">
                  {AILMENT_ZH[enemy.status] || enemy.status}
                </span>
              )}
              <span className="rounded-full border border-red-100 bg-red-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-red-700">
                Lv.{enemy.level}
              </span>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {enemy.types.map((typeSlot) => (
              <TypeBadge key={typeSlot.type.name} type={typeSlot.type.name} size="xs" />
            ))}
          </div>

          <div className="mt-3">
            <div className="mb-1 text-right text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">??? / ???</div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <motion.div
                animate={{ width: `${Math.max(0, Math.min(100, hpRatio * 100))}%` }}
                className={`h-full rounded-full ${
                  hpRatio < 0.2
                    ? 'bg-red-500'
                    : hpRatio < 0.5
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      <motion.img
        animate={
          shouldReduceMotion
            ? { scale: isCatching ? 0 : 1, opacity: isCatching ? 0 : 1 }
            : isCatching
              ? { scale: 0, opacity: 0 }
              : enemyAnim === 'attack'
                ? { x: -28, scale: 1, opacity: 1 }
                : enemyAnim === 'hit'
                  ? { x: [0, 8, -8, 8, 0], opacity: [1, 0.6, 1], scale: [1, 0.98, 1] }
                  : { y: [0, -5, 0], scale: 1, opacity: 1 }
        }
        transition={
          shouldReduceMotion
            ? { duration: 0.01 }
            : isCatching
              ? { duration: 0.42 }
              : enemyAnim === 'idle'
                ? { y: { repeat: Infinity, duration: 2.2, ease: 'easeInOut' }, scale: { duration: 0.2 }, opacity: { duration: 0.2 } }
                : { duration: 0.24, ease: 'easeOut' }
        }
        src={enemy.sprites.front_default}
        className="h-40 w-40 object-contain drop-shadow-[0_24px_32px_rgba(15,23,42,0.28)] sm:h-48 sm:w-48"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
