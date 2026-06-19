import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import type { BattleSceneLayout, BattleStageMode } from './battleSceneLayout';

interface CatchEffectOverlayProps {
  isCatching: boolean;
  catchSuccess: boolean | null;
  stageMode?: BattleStageMode;
  layout: BattleSceneLayout;
}

export function CatchEffectOverlay({ isCatching, catchSuccess, stageMode = 'default', layout }: CatchEffectOverlayProps) {
  const isPortraitScaled = stageMode === 'portrait-scaled';
  const catchStyle = {
    left: `${layout.catchEffect.left}px`,
    top: `${layout.catchEffect.top}px`,
  };
  const ballSize = `${layout.catchEffect.size}px`;
  const innerSize = isPortraitScaled ? 'h-6 w-6' : 'h-8 w-8';
  const coreSize = isPortraitScaled ? 'h-2 w-2' : 'h-3 w-3';

  return (
    <AnimatePresence>
      {isCatching && (
        <motion.div
          initial={{ x: -400, y: 200, opacity: 0, scale: 0.5, rotate: -360 }}
          animate={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 1.2 }}
          className="absolute z-50 flex flex-col items-center"
          style={catchStyle}
        >
          <motion.div
            animate={catchSuccess === false ? { rotate: [0, -15, 15, -15, 15, 0], x: [0, -5, 5, -5, 5, 0] } : {}}
            transition={{ repeat: Infinity, duration: 0.5, repeatDelay: 1 }}
            className="relative overflow-hidden rounded-full border-4 border-slate-900 bg-white shadow-2xl"
            style={{ width: ballSize, height: ballSize }}
          >
            <div className="absolute top-0 left-0 w-full h-1/2 bg-red-500 border-b-4 border-slate-900" />
            <div className={`absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-slate-900 bg-white ${innerSize}`}>
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-200 ${coreSize}`} />
            </div>
            {catchSuccess === true && (
              <motion.div
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 bg-yellow-400/20"
              />
            )}
          </motion.div>

          {catchSuccess === true && (
            <div className="absolute inset-0 flex items-center justify-center">
              {[...Array(8)].map((_, index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0, x: 0, y: 0 }}
                  animate={{ scale: [0, 1, 0], x: Math.cos((index * Math.PI) / 4) * 60, y: Math.sin((index * Math.PI) / 4) * 60, rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: index * 0.1 }}
                  className="absolute"
                >
                  <Sparkles className={`fill-yellow-400 text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)] ${
                    isPortraitScaled ? 'h-4 w-4' : 'h-4 w-4 sm:h-5 sm:w-5'
                  }`} />
                </motion.div>
              ))}
            </div>
          )}

          {catchSuccess === false && (
            <div className="absolute inset-0 flex items-center justify-center">
              {[...Array(16)].map((_, index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0, x: 0, y: 0 }}
                  animate={{ scale: [0, 1.5, 0], x: (Math.random() - 0.5) * 200, y: (Math.random() - 0.5) * 200 }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.01 }}
                  className={`absolute rounded-full border border-white/50 bg-blue-200/40 shadow-sm backdrop-blur-[2px] ${
                    isPortraitScaled ? 'h-4 w-4' : 'h-4 w-4 sm:h-6 sm:w-6'
                  }`}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
