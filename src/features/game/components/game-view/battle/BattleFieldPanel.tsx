import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { getFactoryTrainerPresentation } from '../../../config/factoryTrainerPresentation';
import type { GameViewSectionProps } from '../shared';
import { BattleMoveEffect } from './BattleMoveEffect';
import { BattleLogPanel } from './BattleLogPanel';
import { CatchEffectOverlay } from './CatchEffectOverlay';
import { EnemyBattleCard } from './EnemyBattleCard';
import { PlayerBattleCard } from './PlayerBattleCard';
import {
  POKEROGUE_FACTORY_ARENA,
  POKEROGUE_FACTORY_ARENA_PLACEMENT,
} from './battleArenaAssets';
import {
  getBattleSceneLayout,
  getBattleStageMode,
  type BattlePositionedSlot,
} from './battleSceneLayout';

function getSlotStyle(slot: BattlePositionedSlot) {
  return {
    left: `${slot.x}px`,
    top: `${slot.y}px`,
    width: `${slot.width}px`,
    height: `${slot.height}px`,
    transform: slot.anchor === 'center-bottom'
      ? 'translate(-50%, -100%)'
      : 'translate(-100%, -50%)',
  };
}

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

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;

    const updateBounds = () => {
      const { width, height } = node.getBoundingClientRect();
      setStageBounds({ width, height });
    };

    updateBounds();

    const resizeObserver = new ResizeObserver(updateBounds);
    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  if (!player) return null;

  const sceneLayout = getBattleSceneLayout();
  const sceneScale = stageBounds.width > 0 && stageBounds.height > 0
    ? Math.min(stageBounds.width / sceneLayout.canvas.width, stageBounds.height / sceneLayout.canvas.height)
    : 1;
  const stageMode = getBattleStageMode();
  const showTrainerIntro = (trainerIntroActive || trainerIntroAwaitingContinue) && trainerPresentation;

  const battleCanvasStyle = {
    width: `${sceneLayout.canvas.width}px`,
    height: `${sceneLayout.canvas.height}px`,
    transform: `translate(-50%, -50%) scale(${sceneScale})`,
    transformOrigin: 'center',
  };
  return (
    <div ref={stageRef} className="pf-battle-stage-shell relative h-full min-h-0 w-full overflow-hidden" data-battle-logical-size="320x180">
      <div className="pf-battle-viewport">
        <div
          className="pf-battle-canvas pf-battle-canvas--scaled pf-arena-stage"
          style={battleCanvasStyle}
          data-battle-canvas="logical"
        >
          <img
            src={POKEROGUE_FACTORY_ARENA.background.src}
            alt=""
            className="pf-pokerogue-factory-bg"
            aria-hidden="true"
          />
          {showTrainerIntro ? (
            <div className="pf-battle-canvas-layer" data-layer="intro">
              <div className="absolute bottom-3 right-4 h-8 w-32 rounded-full bg-black/30 blur-xl" />
              <motion.div
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 42 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: shouldReduceMotion ? 0.12 : 0.42, ease: 'easeOut' }}
                className="absolute right-2 top-2 z-10 w-[174px]"
              >
                <div className="relative">
                  <div className="absolute bottom-2 left-1/2 h-5 w-[72%] -translate-x-1/2 rounded-full bg-black/28 blur-lg" />
                  <motion.img
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: shouldReduceMotion ? 0.12 : 0.34, delay: shouldReduceMotion ? 0.02 : 0.08, ease: 'easeOut' }}
                    src={trainerPresentation.portraitPath}
                    alt={trainerPresentation.displayName}
                    className="relative z-10 h-auto w-full object-contain drop-shadow-[0_13px_21px_rgba(15,23,42,0.5)]"
                  />
                </div>
              </motion.div>
            </div>
          ) : (
            <>
              <div className="pf-battle-canvas-layer" data-layer="world">
                <img
                  src={POKEROGUE_FACTORY_ARENA.playerBase.src}
                  alt=""
                  className="pf-pokerogue-arena-base"
                  style={{
                    transform: `translate(${POKEROGUE_FACTORY_ARENA_PLACEMENT.playerBase.translateX}px, ${POKEROGUE_FACTORY_ARENA_PLACEMENT.playerBase.translateY}px)`,
                  }}
                  data-side="player"
                  data-visual-center-x={POKEROGUE_FACTORY_ARENA_PLACEMENT.playerBase.visualCenterX + POKEROGUE_FACTORY_ARENA_PLACEMENT.playerBase.translateX}
                  aria-hidden="true"
                />
                <img
                  src={POKEROGUE_FACTORY_ARENA.enemyBase.src}
                  alt=""
                  className="pf-pokerogue-arena-base"
                  style={{
                    transform: `translate(${POKEROGUE_FACTORY_ARENA_PLACEMENT.enemyBase.translateX}px, ${POKEROGUE_FACTORY_ARENA_PLACEMENT.enemyBase.translateY}px)`,
                  }}
                  data-side="enemy"
                  data-visual-center-x={POKEROGUE_FACTORY_ARENA_PLACEMENT.enemyBase.visualCenterX + POKEROGUE_FACTORY_ARENA_PLACEMENT.enemyBase.translateX}
                  aria-hidden="true"
                />

                {sceneLayout.playerSpriteSlots.map((slot) => (
                  <div
                    key={`player-sprite-slot-${slot.fieldPosition}`}
                    className="absolute z-10"
                    style={getSlotStyle(slot)}
                    data-side="player"
                    data-field-position={slot.fieldPosition}
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

                {enemy && sceneLayout.enemySpriteSlots.map((slot) => (
                  <div
                    key={`enemy-sprite-slot-${slot.fieldPosition}`}
                    className="absolute z-10"
                    style={getSlotStyle(slot)}
                    data-side="enemy"
                    data-field-position={slot.fieldPosition}
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

                {enemy && (
                  <BattleMoveEffect
                    playerAnim={playerAnim}
                    enemyAnim={enemyAnim}
                    activeMoveType={activeMoveType}
                    layout={sceneLayout}
                  />
                )}
                <CatchEffectOverlay isCatching={isCatching} catchSuccess={catchSuccess} layout={sceneLayout} />
              </div>

              <div className="pf-battle-canvas-layer pf-battle-canvas-hud" data-layer="hud">
                {enemy && sceneLayout.enemyHudSlots.map((slot) => (
                  <div
                    key={`enemy-hud-slot-${slot.fieldPosition}`}
                    className="absolute"
                    style={getSlotStyle(slot)}
                    data-side="enemy"
                    data-field-position={slot.fieldPosition}
                  >
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

                {sceneLayout.playerHudSlots.map((slot) => (
                  <div
                    key={`player-hud-slot-${slot.fieldPosition}`}
                    className="absolute"
                    style={getSlotStyle(slot)}
                    data-side="player"
                    data-field-position={slot.fieldPosition}
                  >
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
            </>
          )}
          <BattleLogPanel viewModel={viewModel} />
        </div>
      </div>
    </div>
  );
}
