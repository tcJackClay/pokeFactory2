import { ChevronRight, Coins, Dna, RefreshCw, Sparkles, Trophy } from 'lucide-react';
import type { GameViewSectionProps } from '../shared';

export function RewardHeader({ viewModel }: GameViewSectionProps) {
  const {
    coins,
    rewardChoiceMade,
    rerollCount,
    pendingRewardAction,
    loading,
    gameState,
    currentLanguage,
    t,
    rerollRewards,
    nextStage,
    setInfoPokemonIdx,
    setPrevGameState,
    setGameState,
  } = viewModel;

  const isZh = currentLanguage.startsWith('zh');
  const canRerollRewards = coins >= 50 + rerollCount * 50;

  return (
    <div className="relative z-10 mb-4 flex flex-col gap-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-700 shadow-sm">
              <Trophy className="h-4 w-4" />
              {t('victory')}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-black text-slate-700 shadow-sm">
              <Coins className="h-4 w-4 text-amber-500" />
              {coins}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!rewardChoiceMade && (
            <button
              type="button"
              onClick={rerollRewards}
              disabled={!canRerollRewards || loading}
              className="pf-action-button px-4"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{t('reroll')}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/6 px-2 py-0.5 text-[10px] tracking-normal">
                <Coins className="h-3 w-3" />
                {50 + rerollCount * 50}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setInfoPokemonIdx(0);
              setPrevGameState(gameState);
              setGameState('POKEMON_INFO');
            }}
            className="pf-action-button px-4"
          >
            <Dna className="h-4 w-4" />
            <span>{t('viewTeam')}</span>
          </button>

          {rewardChoiceMade && !pendingRewardAction && (
            <button
              type="button"
              data-tone="primary"
              onClick={nextStage}
              className="pf-action-button px-5"
            >
              <Sparkles className="h-4 w-4" />
              <span>{t('nextStep')}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
