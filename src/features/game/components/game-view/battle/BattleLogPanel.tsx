import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { GameViewSectionProps } from '../shared';
import { getFactoryTrainerIntroQuote } from '../../../config/factoryTrainerIntroQuotes';
import { POKEROGUE_FACTORY_ARENA_PLACEMENT } from './battleArenaAssets';

function getTrainerIntroQuote(
  currentLanguage: string,
  facilityClass: string,
  battleInSet: number,
  setNo: number,
  isSpecialBoss: boolean,
  isSetBoss: boolean,
) {
  return getFactoryTrainerIntroQuote({
    currentLanguage,
    facilityClass,
    battleInSet,
    setNo,
    isSpecialBoss,
    isSetBoss,
  });
}

function getTrainerDisplayName(trainerName: string) {
  return trainerName
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
  const isZh = currentLanguage.startsWith('zh');
  const introActive = Boolean((trainerIntroActive || trainerIntroAwaitingContinue) && currentEnemyTrainer);
  const introQuote = introActive && currentEnemyTrainer
    ? getTrainerIntroQuote(
      currentLanguage,
      currentEnemyTrainer.facilityClass,
      battleInSet,
      setNo,
      specialBossBattleActive,
      isSetBoss,
    )
    : null;
  const trainerName = currentEnemyTrainer ? getTrainerDisplayName(currentEnemyTrainer.trainerName) : '';
  const battleLines = battleLog.slice(-2);
  const visibleLines = introQuote
    ? [introQuote]
    : turn === 'ENEMY' && !isMessageProcessing
      ? [t('thinking')]
      : battleLines.length > 0
        ? battleLines
        : [isZh ? '等待战斗指令。' : 'Awaiting battle command.'];
  const panelLabel = introQuote
    ? `${isZh ? '训练家' : 'TRAINER'} // ${trainerName}`
    : isZh ? '战斗日志' : 'BATTLE LOG';

  const continueIntro = () => {
    if (trainerIntroAwaitingContinue) continueTrainerIntro();
  };

  return (
    <motion.div
      key="battle-message-panel"
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={continueIntro}
      onKeyDown={(event) => {
        if (trainerIntroAwaitingContinue && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          continueIntro();
        }
      }}
      role={trainerIntroAwaitingContinue ? 'button' : 'log'}
      tabIndex={trainerIntroAwaitingContinue ? 0 : undefined}
      aria-live={trainerIntroAwaitingContinue ? undefined : 'polite'}
      aria-label={panelLabel}
      data-dialogue={introQuote ? 'true' : 'false'}
      data-awaiting-continue={trainerIntroAwaitingContinue ? 'true' : 'false'}
      className="pf-battle-message-panel"
      style={{
        top: `${POKEROGUE_FACTORY_ARENA_PLACEMENT.messagePanel.top}px`,
        height: `${POKEROGUE_FACTORY_ARENA_PLACEMENT.messagePanel.height}px`,
      }}
    >
      <div className="pf-battle-message-frame" aria-hidden="true" />
      <div className="pf-battle-message-screen">
        <div className="pf-battle-message-header">
          <span>{panelLabel}</span>
          <span className="pf-battle-message-channel">FCT-01</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={introQuote ? `intro-${currentEnemyTrainer?.id ?? 'trainer'}` : `${battleLog.length}-${turn}-${isMessageProcessing}`}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            className="pf-battle-message-copy"
          >
            {visibleLines.map((line, index) => (
              <p
                key={`${battleLog.length}-${index}-${line}`}
                data-latest={index === visibleLines.length - 1 ? 'true' : 'false'}
              >
                {line}
              </p>
            ))}
          </motion.div>
        </AnimatePresence>
        {trainerIntroAwaitingContinue && (
          <span className="pf-battle-message-continue">
            {isZh ? '点击继续' : 'CONTINUE'}
            <span aria-hidden="true">▼</span>
          </span>
        )}
      </div>
    </motion.div>
  );
}
