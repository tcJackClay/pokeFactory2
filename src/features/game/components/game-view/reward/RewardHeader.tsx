import { ChevronRight, Coins, Dna, RefreshCw } from 'lucide-react';
import type { GameViewSectionProps } from '../shared';

export function RewardHeader({ viewModel }: GameViewSectionProps) {
  const {
    coins,
    rewardChoiceMade,
    rerollCount,
    pendingRewardAction,
    loading,
    gameState,
    t,
    rerollRewards,
    nextStage,
    setInfoPokemonIdx,
    setPrevGameState,
    setGameState,
  } = viewModel;

  const canRerollRewards = coins >= 50 + rerollCount * 50;

  return (
    <div className="flex justify-between items-center mb-6 px-4 flex-none">
      <div className="flex items-center gap-4">
        <div className="bg-yellow-400 px-6 py-2 skew-x-[-12deg] shadow-lg">
          <h2 className="text-2xl font-black italic tracking-tighter skew-x-[12deg] text-white uppercase">{t('victory')}</h2>
        </div>
        <div className="bg-slate-900 px-4 py-2 skew-x-[-10deg] shadow-md flex items-center gap-2">
          <Coins className="w-4 h-4 text-yellow-400 skew-x-[10deg]" />
          <span className="text-white font-black italic text-sm skew-x-[10deg]">{coins}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!rewardChoiceMade && (
          <button
            onClick={rerollRewards}
            disabled={!canRerollRewards || loading}
            className={`px-3 md:px-4 py-2 font-black italic text-[10px] md:text-xs transition-all skew-x-[-10deg] flex items-center gap-2 ${
              !canRerollRewards
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-yellow-400 text-slate-900 hover:bg-yellow-500 shadow-md'
            }`}
          >
            <span className="skew-x-[10deg] inline-block flex items-center gap-1 md:gap-2">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              {t('reroll')}
              <span className="bg-slate-900/10 px-1.5 py-0.5 rounded text-[8px] md:text-[10px] flex items-center gap-1">
                <Coins className="w-2 h-2" />
                {50 + rerollCount * 50}
              </span>
            </span>
          </button>
        )}
        <button
          onClick={() => {
            setInfoPokemonIdx(0);
            setPrevGameState(gameState);
            setGameState('POKEMON_INFO');
          }}
          className="px-4 py-2 bg-slate-100 text-slate-500 font-black italic text-xs hover:bg-slate-200 transition-all skew-x-[-10deg]"
        >
          <span className="skew-x-[10deg] inline-block flex items-center gap-2">
            <Dna className="w-3 h-3" /> {t('viewTeam')}
          </span>
        </button>
        {rewardChoiceMade && !pendingRewardAction && (
          <button
            onClick={nextStage}
            className="px-8 py-2 bg-blue-600 text-white font-black italic text-sm hover:bg-blue-700 transition-all skew-x-[-10deg] shadow-lg animate-pulse"
          >
            <span className="skew-x-[10deg] inline-block flex items-center gap-2">
              {t('nextStep')} <ChevronRight className="w-4 h-4" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
