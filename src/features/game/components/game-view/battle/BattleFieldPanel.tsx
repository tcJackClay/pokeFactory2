import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { getFactoryTrainerPresentation } from '../../../config/factoryTrainerPresentation';
import type { GameViewSectionProps } from '../shared';
import { BattleMoveEffect } from './BattleMoveEffect';
import { CatchEffectOverlay } from './CatchEffectOverlay';
import { EnemyBattleCard } from './EnemyBattleCard';
import { PlayerBattleCard } from './PlayerBattleCard';
import { getBattleSceneLayout, getBattleStageMode } from './battleSceneLayout';

export function BattleFieldPanel({ viewModel }: GameViewSectionProps) {
  const {
    playerTeam,
    enemy,
    currentEnemyTrainer,
    playerAnim,
    enemyAnim,
    activeMoveType,
    isCatching,
    catchSuccess,
    getLocalized,
    trainerIntroActive,
    trainerIntroAwaitingContinue,
  } = viewModel;
  const shouldReduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageBounds, setStageBounds] = useState({ width: 0, height: 0 });

  const player = playerTeam[0];
  const trainerPresentation = currentEnemyTrainer ? getFactoryTrainerPresentation(currentEnemyTrainer) : null;
  if (!player) return null;

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;

    const updateBounds = () => {
      const { width, height } = node.getBoundingClientRect();
      setStageBounds({ width, height });
    };

    updateBounds();

    const resizeObserver = new ResizeObserver(() => {
      updateBounds();
    });
    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const isPortraitStage = stageBounds.height >= stageBounds.width;
  const sceneLayout = getBattleSceneLayout(stageBounds.width, stageBounds.height);
  const sceneScale = stageBounds.width > 0 && stageBounds.height > 0
    ? Math.min(stageBounds.width / sceneLayout.canvas.width, stageBounds.height / sceneLayout.canvas.height, 1)
    : 1;
  const stageMode = getBattleStageMode(isPortraitStage);
  const showTrainerIntro = (trainerIntroActive || trainerIntroAwaitingContinue) && trainerPresentation;

  const battleCanvasStyle = {
    width: `${sceneLayout.canvas.width}px`,
    height: `${sceneLayout.canvas.height}px`,
    transform: `translate(-50%, -50%) scale(${sceneScale})`,
    transformOrigin: 'center',
  };
  const spriteRowStyle = {
    left: '50%',
    top: sceneLayout.spriteRow.top !== undefined ? `${sceneLayout.spriteRow.top}px` : '50%',
    width: `${sceneLayout.spriteRow.width}px`,
    height: `${sceneLayout.spriteRow.height}px`,
    transform: sceneLayout.spriteRow.top !== undefined
      ? 'translateX(-50%)'
      : `translate(-50%, calc(-50% + ${sceneLayout.spriteRow.centerOffsetY ?? 0}px))`,
  };
  const enemyHudRowStyle = {
    left: `${sceneLayout.enemyHudRow.insetX ?? 0}px`,
    right: `${sceneLayout.enemyHudRow.insetX ?? 0}px`,
    top: `${sceneLayout.enemyHudRow.top ?? 0}px`,
    height: `${sceneLayout.enemyHudRow.height}px`,
  };
  const playerHudRowStyle = {
    left: `${sceneLayout.playerHudRow.insetX ?? 0}px`,
    right: `${sceneLayout.playerHudRow.insetX ?? 0}px`,
    bottom: `${sceneLayout.playerHudRow.bottom ?? 0}px`,
    height: `${sceneLayout.playerHudRow.height}px`,
  };

  return (
    <div ref={stageRef} className="pf-battle-stage-shell pf-arena-stage relative min-h-[240px] flex-1 sm:min-h-0 sm:flex-[7]">
      <div className="pf-arena-floor" aria-hidden="true" />
      <div className="absolute inset-x-6 top-6 h-10 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.66)_0%,transparent_72%)] blur-xl" aria-hidden="true" />

      <div className="pf-battle-viewport">
        <div className="pf-battle-canvas pf-battle-canvas--scaled" style={battleCanvasStyle}>
          {showTrainerIntro ? (
            <div className="pf-battle-canvas-layer" data-layer="intro">
              <div className="absolute right-[18%] bottom-[13%] h-16 w-64 rounded-full bg-black/30 blur-2xl" />
              <motion.div
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 84 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: shouldReduceMotion ? 0.12 : 0.42, ease: 'easeOut' }}
                className="absolute right-2 top-[8%] z-10 w-[188px] sm:right-8 sm:top-[11%] sm:w-[280px] md:right-12 md:top-[12%] md:w-[320px] lg:right-14 lg:top-[13%] lg:w-[360px]"
              >
                <div className="relative">
                  <div className="absolute bottom-4 left-1/2 h-9 w-[72%] -translate-x-1/2 rounded-full bg-black/28 blur-xl" />
                  <motion.img
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: shouldReduceMotion ? 0.12 : 0.34, delay: shouldReduceMotion ? 0.02 : 0.08, ease: 'easeOut' }}
                    src={trainerPresentation.portraitPath}
                    alt={trainerPresentation.displayName}
                    className="relative z-10 h-auto w-full object-contain drop-shadow-[0_26px_42px_rgba(15,23,42,0.5)]"
                  />
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="pf-battle-canvas-layer" data-layer="world">
                <div className="absolute flex items-end justify-between" style={spriteRowStyle}>
                  <div className="flex items-end gap-4">
                    {sceneLayout.playerSpriteSlots.map((slot, index) => (
                      <div
                        key={`player-sprite-slot-${index}`}
                        className="flex items-end"
                        style={{ transform: `translateY(${slot.offsetY ?? 0}px)` }}
                      >
                        <PlayerBattleCard
                          player={player}
                          playerAnim={playerAnim}
                          getLocalized={getLocalized}
                          viewModel={viewModel}
                          stageMode={stageMode}
                          layout={sceneLayout}
                          spriteSlot={slot}
                          renderLayer="canvas"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end gap-4">
                    {enemy && sceneLayout.enemySpriteSlots.map((slot, index) => (
                      <div
                        key={`enemy-sprite-slot-${index}`}
                        className="flex items-end"
                        style={{ transform: `translateY(${slot.offsetY ?? 0}px)` }}
                      >
                        <EnemyBattleCard
                          enemy={enemy}
                          trainer={currentEnemyTrainer}
                          enemyAnim={enemyAnim}
                          isCatching={isCatching}
                          getLocalized={getLocalized}
                          stageMode={stageMode}
                          layout={sceneLayout}
                          spriteSlot={slot}
                          renderLayer="canvas"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              {enemy && (
                <BattleMoveEffect
                  playerAnim={playerAnim}
                  enemyAnim={enemyAnim}
                  activeMoveType={activeMoveType}
                  stageMode={stageMode}
                />
              )}
              <CatchEffectOverlay isCatching={isCatching} catchSuccess={catchSuccess} stageMode={stageMode} layout={sceneLayout} />
            </div>
          )}
        </div>

        {!showTrainerIntro && (
          <div className="pf-battle-overlay-ui" data-layer="hud">
            {enemy && (
              <div className="absolute flex items-start justify-end gap-4" style={enemyHudRowStyle}>
                {sceneLayout.enemyHudSlots.map((slot, index) => (
                  <div key={`enemy-hud-slot-${index}`}>
                    <EnemyBattleCard
                      enemy={enemy}
                      trainer={currentEnemyTrainer}
                      enemyAnim={enemyAnim}
                      isCatching={isCatching}
                      getLocalized={getLocalized}
                      stageMode={stageMode}
                      layout={sceneLayout}
                      hudSlot={slot}
                      renderLayer="overlay"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="absolute flex items-end justify-start gap-4" style={playerHudRowStyle}>
              {sceneLayout.playerHudSlots.map((slot, index) => (
                <div key={`player-hud-slot-${index}`}>
                  <PlayerBattleCard
                    player={player}
                    playerAnim={playerAnim}
                    getLocalized={getLocalized}
                    viewModel={viewModel}
                    stageMode={stageMode}
                    layout={sceneLayout}
                    hudSlot={slot}
                    renderLayer="overlay"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
