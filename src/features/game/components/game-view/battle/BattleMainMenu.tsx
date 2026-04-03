import { motion } from 'motion/react';
import { Dna, Package, RefreshCw, Sword } from 'lucide-react';
import type { GameViewSectionProps } from '../shared';

export function BattleMainMenu({ viewModel }: GameViewSectionProps) {
  const {
    t,
    setBattleMenuTab,
    forfeitChallenge,
  } = viewModel;

  const commandButtons = [
    {
      key: 'MOVES' as const,
      label: t('battle'),
      icon: Sword,
      className: 'from-red-400 to-red-600 hover:from-red-500 hover:to-red-700',
      onClick: () => setBattleMenuTab('MOVES'),
    },
    {
      key: 'BAG' as const,
      label: t('bag'),
      icon: Package,
      className: 'from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700',
      onClick: () => setBattleMenuTab('BAG'),
    },
    {
      key: 'POKEMON' as const,
      label: t('pokemon'),
      icon: Dna,
      className: 'from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700',
      onClick: () => setBattleMenuTab('POKEMON'),
    },
    {
      key: 'RUN' as const,
      label: t('run'),
      icon: RefreshCw,
      className: 'from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800',
      onClick: forfeitChallenge,
    },
  ];

  return (
    <motion.div
      key="main-menu"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="h-full"
    >
      <div className="grid grid-cols-2 grid-rows-2 gap-2 h-full">
        {commandButtons.map((button) => {
          const Icon = button.icon;

          return (
            <button
              key={button.key}
              onClick={button.onClick}
              className={`group relative border-2 border-slate-900 bg-gradient-to-b p-2 sm:p-3 font-black tracking-wide text-white transition-all active:translate-y-[1px] ${button.className}`}
            >
              <span className="absolute inset-x-0 top-0 h-[2px] bg-white/40" />
              <span className="relative z-10 flex items-center justify-center gap-2 text-sm sm:text-base">
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                {button.label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
