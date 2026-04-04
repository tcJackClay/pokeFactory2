import { useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import type { GameViewSectionProps } from './shared';
import factoryBallSprite from '../../../../assets/loading/factory-ball.png';
import gearSprite from '../../../../assets/loading/gear.png';

export function BootLoadingScreen({ viewModel }: GameViewSectionProps) {
  const {
    bootProgress,
    canEnterProject,
    setGameState,
    t,
  } = viewModel;

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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 min-h-0 relative overflow-hidden bg-[#020d2a] text-white"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(17,82,214,0.45),transparent_55%),radial-gradient(circle_at_50%_72%,rgba(67,56,202,0.28),transparent_60%),linear-gradient(180deg,#02103a_0%,#020a23_62%,#02061a_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(56,189,248,0.2)_0%,transparent_12%,transparent_88%,rgba(167,139,250,0.2)_100%)]" />

      <motion.img
        src={gearSprite}
        alt=""
        aria-hidden="true"
        className="absolute -top-10 -left-10 w-28 h-28 opacity-45 [image-rendering:pixelated]"
        animate={{ rotate: 360 }}
        transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
      />
      <motion.img
        src={gearSprite}
        alt=""
        aria-hidden="true"
        className="absolute -right-8 top-10 w-24 h-24 opacity-40 [image-rendering:pixelated]"
        animate={{ rotate: -360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      />
      <motion.img
        src={gearSprite}
        alt=""
        aria-hidden="true"
        className="absolute -left-8 bottom-28 w-24 h-24 opacity-35 [image-rendering:pixelated]"
        animate={{ rotate: -360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
      <motion.img
        src={gearSprite}
        alt=""
        aria-hidden="true"
        className="absolute -right-10 -bottom-10 w-28 h-28 opacity-45 [image-rendering:pixelated]"
        animate={{ rotate: 360 }}
        transition={{ duration: 17, repeat: Infinity, ease: 'linear' }}
      />

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-5 py-8">
        <div className="text-center">
          <p className="text-[15px] font-black tracking-[0.35em] text-cyan-100/95 drop-shadow-[0_0_16px_rgba(34,211,238,0.8)]">
            BATTLE
          </p>
          <p className="-mt-1 text-[34px] leading-none font-black tracking-[0.12em] text-slate-100 drop-shadow-[0_0_18px_rgba(56,189,248,0.95)]">
            FACTORY
          </p>
        </div>

        <div className="relative mt-10 flex items-center justify-center">
          <motion.div
            className="absolute h-44 w-44 rounded-full border border-cyan-300/40"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute h-52 w-52 rounded-full border border-violet-300/30"
            animate={{ rotate: -360 }}
            transition={{ duration: 11, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.25)_0%,rgba(14,116,144,0.06)_55%,transparent_80%)]"
            animate={{ scale: [0.95, 1.04, 0.95], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.img
            src={factoryBallSprite}
            alt=""
            aria-hidden="true"
            className="relative z-10 w-32 h-32 [image-rendering:pixelated] drop-shadow-[0_0_30px_rgba(56,189,248,0.95)]"
            animate={{ y: [0, -4, 0], rotate: [0, 4, 0, -4, 0] }}
            transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="mt-14 w-full max-w-[330px]">
          <div className="rounded-2xl border border-cyan-300/55 bg-[#04103a]/75 p-1 shadow-[0_0_20px_rgba(56,189,248,0.5)]">
            <div className="h-7 rounded-xl bg-[#06153f]/90 relative overflow-hidden">
              <motion.div
                className={`h-full transition-all ${canEnterProject ? 'bg-[linear-gradient(90deg,#f8f269_0%,#fde047_35%,#38bdf8_100%)]' : 'bg-[linear-gradient(90deg,#f8f269_0%,#facc15_40%,#38bdf8_100%)]'}`}
                style={{ width: `${progressValue}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-[20px] font-black tracking-wide text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
                {Math.round(progressValue)}%
              </div>
            </div>
          </div>

          <p className="mt-3 text-center text-[12px] font-semibold tracking-wide text-cyan-100/90">
            {t(flavorKey)}
          </p>
        </div>

        <p className="mt-5 text-[34px] leading-none font-black tracking-[0.04em] text-cyan-100/95 drop-shadow-[0_0_18px_rgba(56,189,248,0.9)]">
          Loading...
        </p>
      </div>
    </motion.div>
  );
}
