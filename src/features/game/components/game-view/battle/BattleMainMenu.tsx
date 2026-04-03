import { motion } from 'motion/react';
import { Dna, Package, RefreshCw, Sparkles, Sword } from 'lucide-react';
import type { GameViewSectionProps } from '../shared';

export function BattleMainMenu({ viewModel }: GameViewSectionProps) {
  const {
    t,
    setBattleMenuTab,
    forfeitChallenge,
    triggerBattleSpecial,
    canUseBattleSpecial,
    canUseBattleSpecialByMode,
    specialModeUnlocked,
    battleSpecialUsage,
  } = viewModel;

  return (
    <motion.div key="main-menu" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="grid grid-cols-2 gap-2 sm:gap-3 h-full">
      <button onClick={() => setBattleMenuTab('MOVES')} className="group relative bg-red-500 text-white p-2 sm:p-3 font-black italic text-base sm:text-xl skew-x-[-10deg] hover:bg-red-600 transition-all overflow-hidden">
        <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
        <span className="relative z-10 skew-x-[10deg] flex items-center justify-center gap-2">
          <Sword className="w-4 h-4 sm:w-5 sm:h-5" />
          {t('battle')}
        </span>
      </button>
      <button onClick={() => setBattleMenuTab('BAG')} className="group relative bg-yellow-500 text-white p-2 sm:p-3 font-black italic text-base sm:text-xl skew-x-[-10deg] hover:bg-yellow-600 transition-all overflow-hidden">
        <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
        <span className="relative z-10 skew-x-[10deg] flex items-center justify-center gap-2">
          <Package className="w-4 h-4 sm:w-5 sm:h-5" />
          {t('bag')}
        </span>
      </button>
      <button onClick={() => setBattleMenuTab('POKEMON')} className="group relative bg-emerald-500 text-white p-2 sm:p-3 font-black italic text-base sm:text-xl skew-x-[-10deg] hover:bg-emerald-600 transition-all overflow-hidden">
        <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
        <span className="relative z-10 skew-x-[10deg] flex items-center justify-center gap-2">
          <Dna className="w-4 h-4 sm:w-5 sm:h-5" />
          {t('pokemon')}
        </span>
      </button>
      <button onClick={forfeitChallenge} className="group relative bg-slate-500 text-white p-2 sm:p-3 font-black italic text-base sm:text-xl skew-x-[-10deg] hover:bg-slate-600 transition-all overflow-hidden">
        <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
        <span className="relative z-10 skew-x-[10deg] flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
          {t('run')}
        </span>
      </button>
      <button
        onClick={() => void triggerBattleSpecial('MEGA')}
        disabled={!canUseBattleSpecialByMode.MEGA}
        className={`group relative p-2 sm:p-3 font-black italic text-sm sm:text-base skew-x-[-10deg] transition-all overflow-hidden ${
          canUseBattleSpecialByMode.MEGA
            ? 'bg-fuchsia-600 text-white hover:bg-fuchsia-700'
            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
        }`}
      >
        <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
        <span className="relative z-10 skew-x-[10deg] flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          {battleSpecialUsage.MEGA ? t('specialMegaUsed') : t('specialMega')}
        </span>
      </button>
      <button
        onClick={() => void triggerBattleSpecial('DYNAMAX')}
        disabled={!canUseBattleSpecialByMode.DYNAMAX}
        className={`group relative p-2 sm:p-3 font-black italic text-sm sm:text-base skew-x-[-10deg] transition-all overflow-hidden ${
          canUseBattleSpecialByMode.DYNAMAX
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
        }`}
      >
        <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
        <span className="relative z-10 skew-x-[10deg] flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          {battleSpecialUsage.DYNAMAX ? t('specialDynamaxUsed') : t('specialDynamax')}
        </span>
      </button>
      <button
        onClick={() => void triggerBattleSpecial('TERA')}
        disabled={!canUseBattleSpecialByMode.TERA}
        className={`group relative p-2 sm:p-3 font-black italic text-sm sm:text-base skew-x-[-10deg] transition-all overflow-hidden ${
          canUseBattleSpecialByMode.TERA
            ? 'bg-cyan-600 text-white hover:bg-cyan-700'
            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
        }`}
      >
        <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
        <span className="relative z-10 skew-x-[10deg] flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          {battleSpecialUsage.TERA ? t('specialTeraUsed') : t('specialTera')}
        </span>
      </button>
      <button
        onClick={() => setBattleMenuTab('MAIN')}
        disabled={!canUseBattleSpecial}
        className={`col-span-2 group relative p-2 sm:p-3 font-black italic text-base sm:text-xl skew-x-[-10deg] transition-all overflow-hidden ${
          canUseBattleSpecial
            ? 'bg-violet-600 text-white'
            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
        }`}
      >
        <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
        <span className="relative z-10 skew-x-[10deg] flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          {!specialModeUnlocked
            ? t('specialLocked')
            : t('specialTriggerHint')}
        </span>
      </button>
    </motion.div>
  );
}
