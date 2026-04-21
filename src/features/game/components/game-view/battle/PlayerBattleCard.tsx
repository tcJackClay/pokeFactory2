import { motion, useReducedMotion } from 'motion/react';
import TypeBadge from '../../../../../components/TypeBadge';
import { AILMENT_ZH } from '../../../../../uiAppConstants';
import type { GamePokemon } from '../../../../../types';
import type { BattleAnimation, LocalizeFn } from '../../../view-model';
import { getPrimaryBattleStatusId } from '../../../utils/battleStatus';
import type { GameViewSectionProps } from '../shared';
import { BattleSpecialTriggersNearHp } from './BattleSpecialTriggersNearHp';
import type { BattleLayoutBox, BattleSceneLayout, BattleStageMode } from './battleSceneLayout';

interface PlayerBattleCardProps {
  player: GamePokemon;
  playerAnim: BattleAnimation;
  getLocalized: LocalizeFn;
  viewModel: GameViewSectionProps['viewModel'];
  stageMode?: BattleStageMode;
  layout: BattleSceneLayout;
  hudSlot?: BattleLayoutBox;
  spriteSlot?: BattleLayoutBox;
  renderLayer?: 'standalone' | 'canvas' | 'overlay';
}

export function PlayerBattleCard({
  player,
  playerAnim,
  getLocalized,
  viewModel,
  stageMode = 'default',
  layout,
  hudSlot,
  spriteSlot,
  renderLayer = 'standalone',
}: PlayerBattleCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const hpRatio = player.maxHp > 0 ? player.currentHp / player.maxHp : 0;
  const isPortraitScaled = stageMode === 'portrait-scaled';
  const showSprite = renderLayer !== 'overlay';
  const showHud = renderLayer !== 'canvas';
  const resolvedHudSlot = hudSlot ?? layout.playerHud;
  const resolvedSpriteSlot = spriteSlot ?? layout.playerSprite;
  const primaryStatus = getPrimaryBattleStatusId(player);
  const spriteStyle = {
    width: `${resolvedSpriteSlot.width}px`,
    height: `${resolvedSpriteSlot.height ?? resolvedSpriteSlot.width}px`,
  };
  const hudStyle = {
    width: `${resolvedHudSlot.width}px`,
    height: `${resolvedHudSlot.height ?? resolvedHudSlot.minHeight ?? 74}px`,
  };

  return (
    <>
      {showSprite && (
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
          className="pf-battle-player-sprite object-contain drop-shadow-[0_24px_32px_rgba(15,23,42,0.30)]"
          style={spriteStyle}
          referrerPolicy="no-referrer"
        />
      )}

      {showHud && (
        <div className="pf-battle-player">
            <div
            className="pf-battle-player-dock relative z-20 flex flex-col items-start gap-1"
            style={{ width: `${resolvedHudSlot.width}px` }}
          >
            <BattleSpecialTriggersNearHp viewModel={viewModel} variant="dock" />
            <div
              className={`pf-battle-player-hud pf-battle-hud-card ${
                isPortraitScaled
                  ? 'shrink-0 px-3 py-2.5'
                  : 'shrink-0 p-2.5 sm:px-4 sm:py-3'
              }`}
              style={hudStyle}
              data-side="player"
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`truncate font-black text-slate-950 ${isPortraitScaled ? 'text-[15px]' : 'text-sm sm:text-[20px]'}`}>
                      {getLocalized(player)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {primaryStatus && (
                      <span className="rounded-full bg-slate-900 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white">
                        {AILMENT_ZH[primaryStatus] || primaryStatus}
                      </span>
                    )}
                    <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-blue-700 sm:text-[10px]">
                      Lv.{player.level}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="flex min-w-0 flex-nowrap gap-1 overflow-hidden">
                    {player.types.map((typeSlot) => (
                      <TypeBadge key={typeSlot.type.name} type={typeSlot.type.name} size="xs" />
                    ))}
                  </div>
                  <div className="shrink-0 text-right text-[9px] font-black tabular-nums text-slate-500 sm:text-[10px]">
                    {player.currentHp} / {player.maxHp}
                  </div>
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
                            : 'bg-blue-500'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
