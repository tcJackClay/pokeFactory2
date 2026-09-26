import { motion, useReducedMotion } from 'motion/react';
import TypeBadge from '../../../../../components/TypeBadge';
import type { GamePokemon } from '../../../../../types';
import type { BattleAnimation, LocalizeFn } from '../../../view-model';
import { getPrimaryBattleStatusId } from '../../../utils/battleStatus';
import { getBattleStatusLabel } from '../../../utils/battleStatusLabels';
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
  layout,
  hudSlot,
  spriteSlot,
  renderLayer = 'standalone',
}: PlayerBattleCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const hpRatio = player.maxHp > 0 ? player.currentHp / player.maxHp : 0;
  const showSprite = renderLayer !== 'overlay';
  const showHud = renderLayer !== 'canvas';
  const resolvedHudSlot = hudSlot ?? layout.playerHud;
  const resolvedSpriteSlot = spriteSlot ?? layout.playerSprite;
  const primaryStatus = getPrimaryBattleStatusId(player);
  const hpPercent = Math.max(0, Math.min(100, hpRatio * 100));
  const genderSymbol = player.gender === 'female' ? '♀' : player.gender === 'male' ? '♂' : '◇';
  const genderLabel = player.gender === 'female' ? '雌性' : player.gender === 'male' ? '雄性' : '无性别';
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
        <div className="pf-battle-player h-full w-full">
          <div
            className="pf-battle-player-dock relative z-20 h-full w-full"
            style={{
              width: `${resolvedHudSlot.width}px`,
              height: `${resolvedHudSlot.height}px`,
            }}
          >
            <div className="absolute -top-6 left-0 z-30 w-full">
              <BattleSpecialTriggersNearHp viewModel={viewModel} variant="dock" />
            </div>
            <div
              className="pf-battle-player-hud pf-battle-hud-card pf-factory-hud pf-factory-hud--player absolute inset-0"
              style={hudStyle}
              data-side="player"
              data-owner="player"
            >
              <div className="pf-factory-hud__content">
                <div className="pf-factory-hud__header">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="pf-factory-hud__name truncate">{getLocalized(player)}</span>
                    <span
                      className={`pf-factory-hud__gender ${player.gender === 'female' ? 'is-female' : player.gender === 'male' ? 'is-male' : 'is-neutral'}`}
                      title={genderLabel}
                      aria-label={genderLabel}
                    >
                      {genderSymbol}
                    </span>
                  </div>

                  <span className="pf-factory-hud__level">Lv.{player.level}</span>
                </div>

                <div className="pf-factory-hud__meta">
                  <div className="pf-factory-hud__types">
                    {player.types.map((typeSlot) => (
                      <TypeBadge
                        key={typeSlot.type.name}
                        type={typeSlot.type.name}
                        size="xs"
                        className="pf-factory-hud__type"
                      />
                    ))}
                  </div>
                  {primaryStatus && (
                    <span className="pf-factory-hud__status">
                      {getBattleStatusLabel(primaryStatus, viewModel.currentLanguage)}
                    </span>
                  )}
                </div>

                <div className="pf-factory-hp-row">
                  <span className="pf-factory-hp-label">HP</span>
                  <div className="pf-factory-hp-track">
                    <motion.div
                      animate={{ width: `${hpPercent}%` }}
                      className={`pf-factory-hp-fill ${
                        hpRatio < 0.2
                          ? 'bg-red-500'
                          : hpRatio < 0.5
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                  <span className="pf-factory-hp-value">
                    {player.currentHp}/{player.maxHp}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
