import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Dna, Package, RefreshCw, ShieldCheck, Swords } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GameViewSectionProps } from '../shared';

interface CommandButtonConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  variant?: 'default' | 'danger';
  onClick: () => void;
  active: boolean;
}

export function BattleMainMenu({ viewModel }: GameViewSectionProps) {
  const {
    t,
    battleMenuTab,
    setBattleMenuTab,
    forfeitChallenge,
  } = viewModel;

  const shouldReduceMotion = useReducedMotion();
  const [runConfirmPending, setRunConfirmPending] = useState(false);

  useEffect(() => {
    if (!runConfirmPending) return undefined;
    const timer = window.setTimeout(() => setRunConfirmPending(false), 2200);
    return () => window.clearTimeout(timer);
  }, [runConfirmPending]);

  const runLabel = runConfirmPending ? t('confirm') : t('run');

  const buttons = useMemo<CommandButtonConfig[]>(
    () => [
      {
        key: 'battle',
        label: t('battle'),
        icon: Swords,
        onClick: () => {
          setRunConfirmPending(false);
          setBattleMenuTab('MAIN');
        },
        active: battleMenuTab === 'MAIN' || battleMenuTab === 'MOVES',
      },
      {
        key: 'status',
        label: t('status'),
        icon: ShieldCheck,
        onClick: () => {
          setRunConfirmPending(false);
          setBattleMenuTab('STATUS');
        },
        active: battleMenuTab === 'STATUS',
      },
      {
        key: 'bag',
        label: t('bag'),
        icon: Package,
        onClick: () => {
          setRunConfirmPending(false);
          setBattleMenuTab('BAG');
        },
        active: battleMenuTab === 'BAG',
      },
      {
        key: 'pokemon',
        label: t('pokemon'),
        icon: Dna,
        onClick: () => {
          setRunConfirmPending(false);
          setBattleMenuTab('POKEMON');
        },
        active: battleMenuTab === 'POKEMON',
      },
      {
        key: 'run',
        label: runLabel,
        icon: RefreshCw,
        variant: 'danger',
        onClick: () => {
          if (runConfirmPending) {
            setRunConfirmPending(false);
            forfeitChallenge();
            return;
          }
          setRunConfirmPending(true);
        },
        active: runConfirmPending,
      },
    ],
    [battleMenuTab, forfeitChallenge, runConfirmPending, setBattleMenuTab, t],
  );

  return (
    <motion.div
      key="main-menu"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.18, ease: 'easeOut' }}
      className="pf-battle-command-grid"
    >
      {buttons.map((button) => {
        const Icon = button.icon;
        return (
          <button
            key={button.key}
            type="button"
            data-active={button.active ? 'true' : 'false'}
            data-variant={button.variant ?? 'default'}
            onClick={button.onClick}
            className="pf-battle-command-button"
          >
            <Icon className={`h-4 w-4 shrink-0 ${button.key === 'run' && runConfirmPending ? 'animate-spin' : ''}`} />
            <span className="truncate">{button.label}</span>
          </button>
        );
      })}
    </motion.div>
  );
}
