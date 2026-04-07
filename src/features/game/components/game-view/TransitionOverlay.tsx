import { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { FACTORY_REWARD_CONFIG, getBattleIndexInSet, getSetNoByStage } from '../../config/factoryRewards';
import { getFactoryTrainerPresentation } from '../../config/factoryTrainerPresentation';
import type { GameViewSectionProps } from './shared';

function getTransitionCopy(
  currentLanguage: string,
  stage: number,
  setNo: number,
  battleInSet: number,
  isSetBoss: boolean,
  isSpecialBoss: boolean,
) {
  const isZh = currentLanguage.startsWith('zh');

  if (isZh) {
    if (isSpecialBoss) {
      return {
        stageLabel: `第 ${setNo} 组 · 特别战`,
        trainerCue: '特别解锁 BOSS',
        introLine: '特别许可对战已开启。让我看看你是否配得上继续前进。',
      };
    }

    if (isSetBoss) {
      return {
        stageLabel: `第 ${setNo} 组 · 第 ${battleInSet} 战`,
        trainerCue: '组末强敌接入',
        introLine: '这一组的终点由我把守。想继续前进，就先赢过我。',
      };
    }

    if (battleInSet === 1 && stage > 1) {
      return {
        stageLabel: `第 ${setNo} 组 · 第 ${battleInSet} 战`,
        trainerCue: '新组开幕',
        introLine: '新一组已经开始了。先让我看看你这次准备了什么。',
      };
    }

    if (battleInSet >= FACTORY_REWARD_CONFIG.battlesPerSet - 2) {
      return {
        stageLabel: `第 ${setNo} 组 · 第 ${battleInSet} 战`,
        trainerCue: '中后段强敌',
        introLine: '你已经走到后半段了。从这里开始，我不会给你试错空间。',
      };
    }

    return {
      stageLabel: `第 ${setNo} 组 · 第 ${battleInSet} 战`,
      trainerCue: '下一位训练家',
      introLine: '轮到我了。准备好开始这场对战吧。',
    };
  }

  if (isSpecialBoss) {
    return {
      stageLabel: `Set ${setNo} · Special Battle`,
      trainerCue: 'Special boss incoming',
      introLine: 'Special clearance battle accepted. Show me whether you deserve to advance.',
    };
  }

  if (isSetBoss) {
    return {
      stageLabel: `Set ${setNo} · Battle ${battleInSet}`,
      trainerCue: 'Set boss approaching',
      introLine: 'I guard the end of this set. Defeat me first if you want to keep climbing.',
    };
  }

  if (battleInSet === 1 && stage > 1) {
    return {
      stageLabel: `Set ${setNo} · Battle ${battleInSet}`,
      trainerCue: 'A new set begins',
      introLine: 'A fresh set starts here. Let me see what kind of rhythm you brought this time.',
    };
  }

  if (battleInSet >= FACTORY_REWARD_CONFIG.battlesPerSet - 2) {
    return {
      stageLabel: `Set ${setNo} · Battle ${battleInSet}`,
      trainerCue: 'Late-set pressure',
      introLine: 'You are deep into the set now. From here on, I will not leave room for mistakes.',
    };
  }

  return {
    stageLabel: `Set ${setNo} · Battle ${battleInSet}`,
    trainerCue: 'Next trainer up',
    introLine: 'My turn. Get ready to start this battle.',
  };
}

export function TransitionOverlay({ viewModel }: GameViewSectionProps) {
  const shouldReduceMotion = useReducedMotion();
  const {
    currentEnemyTrainer,
    currentLanguage,
    developerMode,
    specialBossBattleActive,
    enemyAiTier,
    stage,
  } = viewModel;

  const battleInSet = getBattleIndexInSet(stage);
  const setNo = getSetNoByStage(stage);
  const isSetBoss = battleInSet === FACTORY_REWARD_CONFIG.battlesPerSet;
  const presentation = currentEnemyTrainer ? getFactoryTrainerPresentation(currentEnemyTrainer) : null;
  const copy = getTransitionCopy(
    currentLanguage,
    stage,
    setNo,
    battleInSet,
    isSetBoss,
    specialBossBattleActive,
  );
  const debugEnabled = import.meta.env.DEV || developerMode;
  const portraitDelay = shouldReduceMotion ? 0.12 : 0.7;
  const cueDelay = shouldReduceMotion ? 0.14 : 0.86;
  const dialogueDelay = shouldReduceMotion ? 0.16 : 0.98;

  useEffect(() => {
    if (!debugEnabled) return;

    console.info('[FactoryUI:transitionOverlay]', {
      phase: 'trainer-dialogue-intro',
      stage,
      setNo,
      battleInSet,
      isSetBoss,
      specialBossBattleActive,
      enemyAiTier,
      trainerId: currentEnemyTrainer?.id ?? null,
      trainerName: currentEnemyTrainer?.trainerName ?? null,
    });
  }, [
    battleInSet,
    currentEnemyTrainer?.id,
    currentEnemyTrainer?.trainerName,
    debugEnabled,
    enemyAiTier,
    isSetBoss,
    setNo,
    specialBossBattleActive,
    stage,
  ]);

  return (
    <motion.div
      key="transition-overlay"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: shouldReduceMotion ? 0.65 : 1.35 }}
      className="fixed inset-0 z-[100] overflow-hidden pointer-events-none"
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.36),rgba(15,23,42,0.7))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.14),transparent_30%)]" />

      <div className="absolute inset-x-0 bottom-0 h-[43%] bg-[linear-gradient(180deg,rgba(15,23,42,0),rgba(15,23,42,0.12)_18%,rgba(20,83,45,0.42)_19%,rgba(21,128,61,0.56)_60%,rgba(20,83,45,0.7)_100%)]" />
      <div className="absolute right-[12%] top-[21%] h-12 w-40 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.55)_0%,transparent_72%)] blur-2xl" />
      <div className="absolute left-[18%] bottom-[25%] h-10 w-56 rounded-full bg-black/20 blur-xl" />
      <div className="absolute right-[18%] bottom-[13%] h-16 w-64 rounded-full bg-black/30 blur-2xl" />

      {specialBossBattleActive && (
        <>
          <motion.div
            animate={shouldReduceMotion ? { opacity: 0.24 } : { opacity: [0.22, 0.38, 0.24] }}
            transition={{ duration: shouldReduceMotion ? 0.01 : 1.8, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.24),transparent_22%),radial-gradient(circle_at_left,rgba(244,63,94,0.22),transparent_28%)]"
          />
          <motion.div
            animate={shouldReduceMotion ? { scale: 1, opacity: 0.22 } : { scale: [0.94, 1.06, 0.98], opacity: [0.14, 0.3, 0.18] }}
            transition={{ duration: shouldReduceMotion ? 0.01 : 2.2, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
            className="absolute right-[9%] top-[10%] h-[420px] w-[420px] rounded-full border border-amber-300/30"
          />
        </>
      )}

      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 90 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 72 }}
        transition={{ duration: shouldReduceMotion ? 0.12 : 0.42, delay: portraitDelay, ease: 'easeOut' }}
        className="absolute right-2 top-[10%] z-10 w-[220px] sm:right-8 sm:top-[11%] sm:w-[280px] md:right-12 md:top-[12%] md:w-[320px] lg:right-14 lg:top-[13%] lg:w-[360px]"
      >
        <div className="relative">
          {specialBossBattleActive && !shouldReduceMotion && (
            <motion.div
              animate={{ rotate: [0, 4, -3, 0], scale: [1, 1.03, 1] }}
              transition={{ duration: 2.3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-x-6 bottom-10 top-8 rounded-[42px] bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_52%),linear-gradient(180deg,rgba(244,63,94,0.16),transparent_60%)] blur-xl"
            />
          )}

          <div className="absolute bottom-4 left-1/2 h-9 w-[72%] -translate-x-1/2 rounded-full bg-black/28 blur-xl" />

          <motion.img
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: shouldReduceMotion ? 0.12 : 0.34, delay: portraitDelay + (shouldReduceMotion ? 0.02 : 0.08), ease: 'easeOut' }}
            src={presentation?.portraitPath ?? '/trainers/factory-trainer-generic.svg'}
            alt={presentation?.displayName ?? 'Factory Trainer'}
            className={`relative z-10 h-auto w-full object-contain drop-shadow-[0_26px_42px_rgba(15,23,42,0.5)] ${
              specialBossBattleActive ? 'saturate-[1.08] contrast-[1.04]' : ''
            }`}
          />

          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 22 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.12 : 0.24, delay: cueDelay }}
            className="absolute right-1 top-3 text-right text-white"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200/80 drop-shadow-[0_2px_6px_rgba(15,23,42,0.55)]">
              {copy.trainerCue}
            </div>
            <div className="mt-1 text-[18px] font-black uppercase tracking-[0.08em] drop-shadow-[0_4px_10px_rgba(15,23,42,0.7)]">
              {presentation?.displayName ?? (currentLanguage.startsWith('zh') ? '训练家' : 'Trainer')}
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70 drop-shadow-[0_2px_6px_rgba(15,23,42,0.6)]">
              {presentation?.classLabel ?? (currentLanguage.startsWith('zh') ? '工厂训练家' : 'Factory Trainer')}
            </div>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: shouldReduceMotion ? 0.12 : 0.34, delay: dialogueDelay, ease: 'easeOut' }}
        className="absolute bottom-[8%] left-4 right-[20%] md:bottom-[10%] md:left-8 md:right-[30%]"
      >
        <div className={`relative rounded-[26px] border px-5 py-4 shadow-[0_20px_48px_rgba(15,23,42,0.24)] backdrop-blur ${
          specialBossBattleActive
            ? 'border-amber-300/34 bg-slate-950/84 text-white'
            : 'border-slate-200/80 bg-white/92 text-slate-950'
        }`}>
          <div className={`mb-2 text-[10px] font-black uppercase tracking-[0.22em] ${
            specialBossBattleActive ? 'text-amber-200' : 'text-rose-600'
          }`}>
            {presentation?.classLabel ?? (currentLanguage.startsWith('zh') ? '工厂训练家' : 'Factory Trainer')} · {presentation?.displayName ?? (currentLanguage.startsWith('zh') ? '训练家' : 'Trainer')}
          </div>
          <div className="pr-8 text-sm font-semibold leading-7 md:text-[17px]">
            「{copy.introLine}」
          </div>
          <div className={`absolute -right-1 bottom-6 h-5 w-5 rotate-45 border-r border-b ${
            specialBossBattleActive
              ? 'border-amber-300/34 bg-slate-950/84'
              : 'border-slate-200/80 bg-white/92'
          }`} />
        </div>
      </motion.div>
    </motion.div>
  );
}
