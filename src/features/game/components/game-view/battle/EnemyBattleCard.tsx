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
  layout,
  hudSlot,
  spriteSlot,
  renderLayer = 'standalone',
}: EnemyBattleCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const hpRatio = enemy.maxHp > 0 ? enemy.currentHp / enemy.maxHp : 0;
  const showSprite = renderLayer !== 'overlay';
  const showHud = renderLayer !== 'canvas';
  const resolvedHudSlot = hudSlot ?? layout.enemyHud;
  const resolvedSpriteSlot = spriteSlot ?? layout.enemySprite;
  const primaryStatus = getPrimaryBattleStatusId(enemy);
  const hpPercent = Math.max(0, Math.min(100, hpRatio * 100));
  const genderSymbol = enemy.gender === 'female' ? '♀' : enemy.gender === 'male' ? '♂' : '◇';
  const genderLabel = enemy.gender === 'female' ? '雌性' : enemy.gender === 'male' ? '雄性' : '无性别';
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
            className="pf-battle-enemy-hud pf-battle-hud-card pf-factory-hud pf-factory-hud--enemy shrink-0"
            style={hudStyle}
            data-side="enemy"
            data-owner="enemy"
          >
            <div className="pf-factory-hud__content">
              <div className="pf-factory-hud__header">
                <div className="flex min-w-0 items-center gap-1">
                  <span className="pf-factory-hud__name truncate">{getLocalized(enemy)}</span>
                  <span
                    className={`pf-factory-hud__gender ${enemy.gender === 'female' ? 'is-female' : enemy.gender === 'male' ? 'is-male' : 'is-neutral'}`}
                    title={genderLabel}
                    aria-label={genderLabel}
                  >
                    {genderSymbol}
                  </span>
                </div>
                <span className="pf-factory-hud__level">
                  Lv.{enemy.level}
                </span>
              </div>

              <div className="pf-factory-hud__meta">
                <div className="pf-factory-hud__types">
                  {enemy.types.map((typeSlot) => (
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
                    {AILMENT_ZH[primaryStatus] || primaryStatus}
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
                <span className="pf-factory-hp-percent">{Math.round(hpPercent)}%</span>
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
