import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { TYPE_COLORS, TYPE_ICONS } from '../../../../../uiAppConstants';
import type { BattleAnimation } from '../../../view-model';
import type { BattleSceneLayout } from './battleSceneLayout';

interface BattleMoveEffectProps {
  playerAnim: BattleAnimation;
  enemyAnim: BattleAnimation;
  activeMoveType: string | null;
  layout: BattleSceneLayout;
}

export function BattleMoveEffect({ playerAnim, enemyAnim, activeMoveType, layout }: BattleMoveEffectProps) {
  const targetSlot = playerAnim === 'attack'
    ? layout.enemySpriteSlots[0]
    : layout.playerSpriteSlots[0];
  const targetStyle = targetSlot
    ? {
        left: `${targetSlot.x}px`,
        top: `${targetSlot.y - targetSlot.height / 2}px`,
      }
    : undefined;

  return (
    <AnimatePresence>
      {(playerAnim === 'attack' || enemyAnim === 'attack') && activeMoveType && (
        <div
          className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-1/2"
          style={targetStyle}
          data-effect-target={playerAnim === 'attack' ? 'enemy' : 'player'}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
            animate={{ opacity: 1, scale: 1.5, rotate: 0 }}
            exit={{ opacity: 0, scale: 2 }}
          >
            {(() => {
              const TypeIcon = TYPE_ICONS[activeMoveType] || Sparkles;
              return (
                <div className="relative">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                    className="absolute inset-0 rounded-full blur-xl"
                    style={{ backgroundColor: TYPE_COLORS[activeMoveType] }}
                  />
                  <TypeIcon
                    className="relative z-10 h-16 w-16 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]"
                    style={{ color: TYPE_COLORS[activeMoveType] }}
                  />
                </div>
              );
            })()}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
