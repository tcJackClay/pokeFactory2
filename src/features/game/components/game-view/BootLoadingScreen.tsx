import { useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { GameViewSectionProps } from './shared';
import loadingIllustration from '../../../../assets/loading/battle-factory-loading.jpg';

export function BootLoadingScreen({ viewModel }: GameViewSectionProps) {
  const {
    bootProgress,
    canEnterProject,
    setGameState,
    t,
  } = viewModel;
  const shouldReduceMotion = useReducedMotion();
  const progressValue = Math.max(0, Math.min(100, bootProgress));
  const randomFlavorKey = useMemo(() => {
    const flavorPool = [
      'bootFlavor1',
      'bootFlavor2',
      'bootFlavor3',
      'bootFlavor4',
      'bootFlavor5',
      'bootFlavor6',
      'bootFlavor7',
      'bootFlavor8',
      'bootFlavor9',
      'bootFlavor10',
      'bootFlavor11',
      'bootFlavor12',
      'bootFlavor13',
      'bootFlavor14',
      'bootFlavor15',
      'bootFlavor16',
    ];
    const index = Math.floor(Math.random() * flavorPool.length);
    return flavorPool[index] ?? 'bootFlavor1';
  }, []);
  const flavorKey = canEnterProject ? 'bootFlavorReady' : randomFlavorKey;

  useEffect(() => {
    if (!canEnterProject) return;
    const timer = window.setTimeout(() => {
      setGameState('START');
    }, 380);
    return () => window.clearTimeout(timer);
  }, [canEnterProject, setGameState]);

  return (
    <motion.div
      key="boot"
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 min-h-0 relative overflow-hidden bg-[#020d2a] text-white"
    >
      <img
        src={loadingIllustration}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.22)_0%,rgba(2,6,23,0.08)_26%,rgba(2,6,23,0.42)_58%,rgba(2,6,23,0.82)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.10),transparent_42%),radial-gradient(circle_at_bottom,rgba(37,99,235,0.24),transparent_44%)]" />

      <div className="relative z-10 flex h-full w-full flex-col justify-end px-5 py-8 md:px-8 md:py-10">
        <div className="mx-auto w-full max-w-[440px] text-center">
          <p className="text-[24px] font-black tracking-[0.12em] text-cyan-100/96 drop-shadow-[0_0_20px_rgba(56,189,248,0.9)] md:text-[30px]">
            Loading...
          </p>
          <div className="mt-5 overflow-hidden rounded-full border border-cyan-300/45 bg-slate-950/45 shadow-[0_0_24px_rgba(56,189,248,0.22)]">
            <div
              className="flex h-4 items-center justify-end rounded-full bg-[linear-gradient(90deg,#38bdf8_0%,#60a5fa_48%,#c084fc_100%)] pr-3 text-[11px] font-black text-white transition-all duration-500 ease-out"
              style={{ width: `${progressValue}%` }}
            >
              {Math.round(progressValue)}%
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold leading-7 text-cyan-50/92 drop-shadow-[0_3px_10px_rgba(2,6,23,0.92)] md:text-[15px]">
            {t(flavorKey)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
