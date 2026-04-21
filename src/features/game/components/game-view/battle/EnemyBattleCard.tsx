import { motion, useReducedMotion } from 'motion/react';
import TypeBadge from '../../../../../components/TypeBadge';
import { AILMENT_ZH } from '../../../../../uiAppConstants';
import type { GamePokemon } from '../../../../../types';
import type { FactoryTrainerTemplate } from '../../../config/factoryTrainerTemplates';
import { getPrimaryBattleStatusId } from '../../../utils/battleStatus';
import type { BattleAnimation, LocalizeFn } from '../../../view-model';
import type { BattleLayoutBox, BattleSceneLayout, BattleStageMode } from './battleSceneLayout';

interface EnemyBattleCardProps {
  enemy: GamePokemon;
  trainer: FactoryTrainerTemplate | null;
  enemyAnim: BattleAnimation;
  isCatching: boolean;
  getLocalized: LocalizeFn;
  stageMode?: BattleStageMode;
  layout: BattleSceneLayout;
  hudSlot?: BattleLayoutBox;
  spriteSlot?: BattleLayoutBox;
  renderLayer?: 'standalone' | 'canvas' | 'overlay';
}

export function EnemyBattleCard({
  enemy,
  trainer,
  enemyAnim,
  isCatching,
  getLocalized,
  stageMode = 'default',
  layout,
  hudSlot,
  spriteSlot,
  renderLayer = 'standalone',
}: EnemyBattleCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const hpRatio = enemy.maxHp > 0 ? enemy.currentHp / enemy.maxHp : 0;
  const isPortraitScaled = stageMode === 'portrait-scaled';
  const showSprite = renderLayer !== 'overlay';
  const showHud = renderLayer !== 'canvas';
  const resolvedHudSlot = hudSlot ?? layout.enemyHud;
  const resolvedSpriteSlot = spriteSlot ?? layout.enemySprite;
  const primaryStatus = getPrimaryBattleStatusId(enemy);
  const spriteStyle = {
    width: `${resolvedSpriteSlot.width}px`,
    height: `${resolvedSpriteSlot.height ?? resolvedSpriteSlot.width}px`,
  };
  const hudStyle = {
    width: `${resolvedHudSlot.width}px`,
    height: `${resolvedHudSlot.height ?? resolvedHudSlot.minHeight ?? 72}px`,
  };

  return (
    <>
      {showHud && (
        <div className="pf-battle-enemy">
          <div
            className={`pf-battle-enemy-hud pf-battle-hud-card ${
              isPortraitScaled
                ? 'shrink-0 px-3 py-2.5'
                : 'shrink-0 p-2.5 sm:px-4 sm:py-3'
            }`}
            style={hudStyle}
            data-side="enemy"
          >
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={`truncate font-black text-slate-950 ${isPortraitScaled ? 'text-[15px]' : 'text-sm sm:text-[19px]'}`}>
                    {getLocalized(enemy)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {primaryStatus && (
                    <span className="rounded-full bg-slate-900 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white">
                      {AILMENT_ZH[primaryStatus] || primaryStatus}
                    </span>
                  )}
                  <span className="rounded-full border border-red-100 bg-red-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-700 sm:text-[10px]">
                    Lv.{enemy.level}
                  </span>
                </div>
              </div>

              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="flex min-w-0 flex-nowrap gap-1 overflow-hidden">
                  {enemy.types.map((typeSlot) => (
                    <TypeBadge key={typeSlot.type.name} type={typeSlot.type.name} size="xs" />
                  ))}
                </div>
                <div className="shrink-0 text-right text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 sm:text-[10px]">??? / ???</div>
              </div>

              <div className="mt-2">
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
        </div>
      )}

      {showSprite && (
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
          className="pf-battle-enemy-sprite object-contain drop-shadow-[0_24px_32px_rgba(15,23,42,0.28)]"
          style={spriteStyle}
          referrerPolicy="no-referrer"
        />
      )}
    </>
  );
}
