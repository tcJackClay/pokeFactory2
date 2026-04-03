import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { TYPE_COLORS, TYPE_ICONS } from '../../../../../uiAppConstants';
import type { BattleAnimation } from '../../../view-model';

interface BattleMoveEffectProps {
  playerAnim: BattleAnimation;
  enemyAnim: BattleAnimation;
  activeMoveType: string | null;
}

export function BattleMoveEffect({ playerAnim, enemyAnim, activeMoveType }: BattleMoveEffectProps) {
  return (
    <AnimatePresence>
      {(playerAnim === 'attack' || enemyAnim === 'attack') && activeMoveType && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
          animate={{ opacity: 1, scale: 1.5, rotate: 0 }}
          exit={{ opacity: 0, scale: 2 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
        >
          {(() => {
            const TypeIcon = TYPE_ICONS[activeMoveType] || Sparkles;
            return (
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="absolute inset-0 blur-xl rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[activeMoveType] }}
                />
                <TypeIcon
                  className="w-20 h-20 sm:w-32 sm:h-32 relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]"
                  style={{ color: TYPE_COLORS[activeMoveType] }}
                />
              </div>
            );
          })()}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
