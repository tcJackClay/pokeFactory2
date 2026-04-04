import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Dna, Package, RefreshCw, ShieldCheck } from 'lucide-react';
import TypeBadge from '../../../../../components/TypeBadge';
import { TYPE_COLORS } from '../../../../../uiAppConstants';
import type { GameViewSectionProps } from '../shared';

const LIGHT_MOVE_TYPES = new Set(['normal', 'electric', 'ground', 'flying', 'ice', 'steel', 'rock']);

export function BattleMainMenu({ viewModel }: GameViewSectionProps) {
  const {
    t,
    playerTeam,
    battleMenuTab,
    currentLanguage,
    getLocalized,
    handleAttack,
    setBattleMenuTab,
    forfeitChallenge,
  } = viewModel;
  const player = playerTeam[0];
  const [runConfirmPending, setRunConfirmPending] = useState(false);

  useEffect(() => {
    if (!runConfirmPending) return;
    const timer = window.setTimeout(() => setRunConfirmPending(false), 2200);
    return () => window.clearTimeout(timer);
  }, [runConfirmPending]);

  if (!player) return null;

  const runLabel = runConfirmPending
    ? (currentLanguage.startsWith('zh') ? '确认逃跑' : 'Confirm')
    : t('run');

  return (
    <motion.div
      key="main-menu"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="space-y-2"
    >
      <div className="grid grid-cols-2 grid-rows-2 gap-2">
        {player.selectedMoves.map((move, index) => (
          <button
            key={`${move.name}-${index}`}
            onClick={() => handleAttack(move)}
            className={`group relative min-h-[58px] overflow-hidden border-2 p-2 text-left transition-all active:translate-y-[1px] ${
              LIGHT_MOVE_TYPES.has(move.type)
                ? 'border-slate-950/15 text-slate-950'
                : 'border-white/15 text-white'
            }`}
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${TYPE_COLORS[move.type] ?? 'var(--type-normal)'} 94%, white 6%) 0%, color-mix(in srgb, ${TYPE_COLORS[move.type] ?? 'var(--type-normal)'} 78%, black 22%) 100%)`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/16 via-transparent to-black/12" />
            <div className="absolute top-0 right-0 h-full w-12 translate-x-6 skew-x-[-20deg] bg-white/20 transition-transform group-hover:translate-x-3" />
            <div className="relative z-10 flex h-full flex-col justify-center">
              <div className="truncate text-sm font-black italic tracking-tighter uppercase">
                {getLocalized(move)}
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-1">
                <TypeBadge type={move.type} size="xs" className={LIGHT_MOVE_TYPES.has(move.type) ? '!bg-black/12' : '!bg-white/12'} />
                <span className={`text-[8px] font-black ${LIGHT_MOVE_TYPES.has(move.type) ? 'text-slate-900/70' : 'text-white/70'}`}>
                  {t('power')}: {move.power || '--'}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => {
            setRunConfirmPending(false);
            setBattleMenuTab('STATUS');
          }}
          className={`group relative flex min-h-[48px] items-center justify-center gap-1.5 border-2 border-slate-900 bg-gradient-to-b p-2 font-black tracking-wide text-white transition-all active:translate-y-[1px] ${
            battleMenuTab === 'STATUS'
              ? 'from-cyan-500 to-sky-700'
              : 'from-cyan-400 to-sky-600 hover:from-cyan-500 hover:to-sky-700'
          }`}
        >
          <span className="absolute inset-x-0 top-0 h-[2px] bg-white/40" />
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span className="text-[11px] sm:text-sm">{currentLanguage.startsWith('zh') ? '状态' : 'Status'}</span>
        </button>

        <button
          onClick={() => {
            setRunConfirmPending(false);
            setBattleMenuTab('BAG');
          }}
          className={`group relative flex min-h-[48px] items-center justify-center gap-1.5 border-2 border-slate-900 bg-gradient-to-b p-2 font-black tracking-wide text-white transition-all active:translate-y-[1px] ${
            battleMenuTab === 'BAG'
              ? 'from-yellow-500 to-amber-700'
              : 'from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700'
          }`}
        >
          <span className="absolute inset-x-0 top-0 h-[2px] bg-white/40" />
          <Package className="h-4 w-4 shrink-0" />
          <span className="text-[11px] sm:text-sm">{t('bag')}</span>
        </button>

        <button
          onClick={() => {
            setRunConfirmPending(false);
            setBattleMenuTab('POKEMON');
          }}
          className={`group relative flex min-h-[48px] items-center justify-center gap-1.5 border-2 border-slate-900 bg-gradient-to-b p-2 font-black tracking-wide text-white transition-all active:translate-y-[1px] ${
            battleMenuTab === 'POKEMON'
              ? 'from-emerald-500 to-emerald-700'
              : 'from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700'
          }`}
        >
          <span className="absolute inset-x-0 top-0 h-[2px] bg-white/40" />
          <Dna className="h-4 w-4 shrink-0" />
          <span className="text-[11px] sm:text-sm">{t('pokemon')}</span>
        </button>

        <button
          onClick={() => {
            if (runConfirmPending) {
              setRunConfirmPending(false);
              forfeitChallenge();
              return;
            }
            setRunConfirmPending(true);
          }}
          className={`group relative flex min-h-[48px] items-center justify-center gap-1.5 border-2 border-slate-900 bg-gradient-to-b p-2 font-black tracking-wide text-white transition-all active:translate-y-[1px] ${
            runConfirmPending
              ? 'from-red-600 to-red-800 hover:from-red-700 hover:to-red-900'
              : 'from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800'
          }`}
        >
          <span className="absolute inset-x-0 top-0 h-[2px] bg-white/40" />
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span className="text-[11px] sm:text-sm">{runLabel}</span>
        </button>
      </div>
    </motion.div>
  );
}
