import { motion, useReducedMotion } from 'motion/react';
import TypeBadge from '../../../../../components/TypeBadge';
import { AILMENT_ZH } from '../../../../../uiAppConstants';
import type { GamePokemon } from '../../../../../types';
import type { BattleAnimation, LocalizeFn } from '../../../view-model';
import type { GameViewSectionProps } from '../shared';
import { BattleSpecialTriggersNearHp } from './BattleSpecialTriggersNearHp';

interface PlayerBattleCardProps {
  player: GamePokemon;
  playerAnim: BattleAnimation;
  getLocalized: LocalizeFn;
  viewModel: GameViewSectionProps['viewModel'];
}

export function PlayerBattleCard({ player, playerAnim, getLocalized, viewModel }: PlayerBattleCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const hpRatio = player.maxHp > 0 ? player.currentHp / player.maxHp : 0;

  return (
    <div className="absolute bottom-3 left-4 flex flex-col items-start sm:bottom-5 sm:left-8 lg:bottom-6 lg:left-12">
      <motion.img
        animate={
          shouldReduceMotion
            ? { x: 0, y: 0, opacity: 1 }
            : playerAnim === 'attack'
              ? { x: 28 }
              : playerAnim === 'hit'
                ? { x: [0, -8, 8, -8, 0], opacity: [1, 0.6, 1] }
                : { y: [0, 4, 0] }
        }
        transition={
          shouldReduceMotion
            ? { duration: 0.01 }
            : playerAnim === 'idle'
              ? { repeat: Infinity, duration: 2, ease: 'easeInOut' }
              : { duration: 0.24, ease: 'easeOut' }
        }
        src={player.sprites.back_default || player.sprites.front_default}
        className="h-48 w-48 object-contain drop-shadow-[0_24px_32px_rgba(15,23,42,0.30)] sm:h-64 sm:w-64"
        referrerPolicy="no-referrer"
      />

      <div className="relative z-20 mt-[-22px] flex items-end gap-2 sm:mt-[-34px]">
        <div className="pf-battle-hud-card w-[230px] p-3 sm:w-[312px] sm:p-4" data-side="player">
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-base font-black text-slate-950 sm:text-[20px]">
                  {getLocalized(player)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {player.status && (
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white">
                    {AILMENT_ZH[player.status] || player.status}
                  </span>
                )}
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700">
                  Lv.{player.level}
                </span>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {player.types.map((typeSlot) => (
                <TypeBadge key={typeSlot.type.name} type={typeSlot.type.name} size="xs" />
              ))}
            </div>

            <div className="mt-3">
              <div className="mb-1 text-right text-[10px] font-black tabular-nums text-slate-500">
                {player.currentHp} / {player.maxHp}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <motion.div
                  animate={{ width: `${Math.max(0, Math.min(100, hpRatio * 100))}%` }}
                  className={`h-full rounded-full ${
                    hpRatio < 0.2
                      ? 'bg-red-500'
                      : hpRatio < 0.5
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        <BattleSpecialTriggersNearHp viewModel={viewModel} variant="dock" />
      </div>
    </div>
  );
}
