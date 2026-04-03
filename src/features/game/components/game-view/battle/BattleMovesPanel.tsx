import { motion } from 'motion/react';
import { Zap } from 'lucide-react';
import TypeBadge from '../../../../../components/TypeBadge';
import type { GameViewSectionProps } from '../shared';

export function BattleMovesPanel({ viewModel }: GameViewSectionProps) {
  const { playerTeam, t, getLocalized, handleAttack, setBattleMenuTab } = viewModel;
  const player = playerTeam[0];
  if (!player) return null;

  return (
    <motion.div key="moves" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-black italic flex items-center gap-2 text-sm">
          <Zap className="w-4 h-4" /> {t('selectMove')}
        </h3>
        <button onClick={() => setBattleMenuTab('MAIN')} className="text-[10px] font-bold text-slate-400 hover:text-slate-900 underline">
          {t('back')}
        </button>
      </div>
      <div className="grid grid-cols-2 grid-rows-2 gap-2 flex-1 min-h-0">
        {player.selectedMoves.map((move, index) => (
          <button
            key={`${move.name}-${index}`}
            onClick={() => handleAttack(move)}
            className="relative p-2 bg-slate-900 text-white hover:bg-blue-600 transition-all text-left overflow-hidden group flex flex-col justify-center"
          >
            <div className="absolute top-0 right-0 w-12 h-full opacity-10 skew-x-[-20deg] bg-white translate-x-6 group-hover:translate-x-3 transition-transform" />
            <div className="relative z-10 w-full">
              <div className="font-black text-sm italic tracking-tighter uppercase truncate">{getLocalized(move)}</div>
              <div className="flex justify-between items-center mt-0.5">
                <TypeBadge type={move.type} size="xs" />
                <span className="text-[8px] font-black opacity-60">{t('power')}: {move.power || '--'}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
