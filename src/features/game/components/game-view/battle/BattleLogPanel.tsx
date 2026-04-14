import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { GameViewSectionProps } from '../shared';
import { getFactoryTrainerIntroQuote } from '../../../config/factoryTrainerIntroQuotes';

function getTrainerIntroLine(
  currentLanguage: string,
  displayName: string,
  facilityClass: string,
  battleInSet: number,
  setNo: number,
  isSpecialBoss: boolean,
  isSetBoss: boolean,
) {
  const quote = getFactoryTrainerIntroQuote({
    currentLanguage,
    facilityClass,
    battleInSet,
    setNo,
    isSpecialBoss,
    isSetBoss,
  });

  return currentLanguage.startsWith('zh')
    ? `${displayName}：“${quote}”`
    : `${displayName}: "${quote}"`;
}

export function BattleLogPanel({ viewModel }: GameViewSectionProps) {
  const {
    battleLog,
    turn,
    isMessageProcessing,
    t,
    trainerIntroActive,
    trainerIntroAwaitingContinue,
    currentEnemyTrainer,
    currentLanguage,
    stage,
    specialBossBattleActive,
    continueTrainerIntro,
  } = viewModel;
  const shouldReduceMotion = useReducedMotion();
  const battleInSet = ((stage - 1) % 7) + 1;
  const setNo = Math.floor((stage - 1) / 7) + 1;
  const isSetBoss = battleInSet === 7;
  const introLine = (trainerIntroActive || trainerIntroAwaitingContinue) && currentEnemyTrainer
    ? getTrainerIntroLine(
      currentLanguage,
      currentEnemyTrainer.trainerName
        .toLowerCase()
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      currentEnemyTrainer.facilityClass,
      battleInSet,
      setNo,
      specialBossBattleActive,
      isSetBoss,
    )
    : null;
  const visibleLine = introLine || (battleLog.length > 0
    ? (turn === 'ENEMY' && !isMessageProcessing ? t('thinking') : battleLog[battleLog.length - 1])
    : null);

  return (
    <motion.div
      key="battle-log-box"
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => {
        if (trainerIntroAwaitingContinue) {
          continueTrainerIntro();
        }
      }}
      className="pf-battle-log absolute inset-0 flex items-center p-4 text-left sm:p-6"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#2563eb_0%,#0ea5e9_52%,#f97316_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1 bg-[linear-gradient(90deg,#ef4444_0%,#f97316_48%,#2563eb_100%)]" />

      <div className="relative z-10 w-full">
        <AnimatePresence mode="wait">
          {visibleLine && (
            <motion.div
              key={introLine ? `intro-${currentEnemyTrainer?.id ?? 'trainer'}` : battleLog.length}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              className="max-w-[760px]"
            >
              <p className="text-lg font-black leading-tight text-white sm:text-[28px]">
                {visibleLine}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
