import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronRight, Coins, Dna, RefreshCw, Sparkles } from 'lucide-react';
import { EvolutionOverlay } from './reward/EvolutionOverlay';
import { LearnMoveOverlay } from './reward/LearnMoveOverlay';
import { ReplacePokemonModal } from './reward/ReplacePokemonModal';
import { RewardCardsGrid } from './reward/RewardCardsGrid';
import { RewardHeader } from './reward/RewardHeader';
import type { GameViewSectionProps } from './shared';

export function RewardScreen({ viewModel }: GameViewSectionProps) {
  const {
    coins,
    rewardChoiceMade,
    rerollCount,
    pendingRewardAction,
    showReplaceUI,
    loading,
    isTransitioning,
    gameState,
    rewards,
    currentLanguage,
    getLocalized,
    t,
    selectReward,
    rerollRewards,
    nextStage,
    setInfoPokemonIdx,
    setInfoPokemonSource,
    setPrevGameState,
    setGameState,
  } = viewModel;
  const shouldReduceMotion = useReducedMotion();
  const isZh = currentLanguage.startsWith('zh');
  const rewardEntries = useMemo(
    () => rewards.filter((reward) => reward.type !== 'EVOLUTION' || (Array.isArray(reward.data?.eligibleIndexes) && reward.data.eligibleIndexes.length > 0)),
    [rewards],
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    const entries = rewardEntries.map((reward, index) => ({ reward, key: `${reward.type}-${index}` }));
    if (entries.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !entries.some((entry) => entry.key === selectedKey)) {
      setSelectedKey(entries[0]?.key ?? null);
    }
  }, [rewardEntries, selectedKey]);

  const entries = useMemo(
    () => rewardEntries.map((reward, index) => ({ reward, key: `${reward.type}-${index}` })),
    [rewardEntries],
  );
  const selectedEntry = entries.find((entry) => entry.key === selectedKey) ?? null;
  const selectedReward = selectedEntry?.reward ?? null;
  const selectedTitle = selectedReward
    ? selectedReward.type === 'TM'
      ? `TM: ${getLocalized(selectedReward.data.move)}`
      : selectedReward.type === 'EVOLUTION'
        ? t('evolutionReward')
        : getLocalized(selectedReward.data)
    : null;
  const canRerollRewards = coins >= 50 + rerollCount * 50;
  const canConfirmSelection = Boolean(selectedReward && !loading && !rewardChoiceMade);
  const confirmLabel = isZh ? '\u786e\u8ba4\u9886\u53d6' : 'Confirm Reward';
  const selectedLabel = isZh ? '\u5df2\u9009\u5956\u52b1' : 'Selected Reward';

  return (
    <motion.div
      key="reward"
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="pf-scroll-y flex flex-1 flex-col overflow-hidden px-2 py-2 sm:px-3 sm:py-3 md:overflow-hidden"
    >
      <div className="pf-celebration-shell relative flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
        <RewardHeader
          viewModel={viewModel}
          rewardCount={rewardEntries.length}
        />

        <RewardCardsGrid
          viewModel={viewModel}
          rewardsToShow={entries}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
        />

        <div className="mt-3">
          <div className="pf-command-bar">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="min-w-0 flex-1 rounded-[14px] border border-slate-200 bg-white/[0.92] px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
                    <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{selectedLabel}</div>
                    <div className="mt-1 truncate text-[13px] font-black text-slate-900">
                      {selectedTitle ?? (isZh ? '\u672a\u9009\u62e9' : 'Not Selected')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setInfoPokemonIdx(0);
                    setInfoPokemonSource('PLAYER');
                    setPrevGameState(gameState);
                    setGameState('POKEMON_INFO');
                  }}
                  className="pf-action-button px-3 py-2"
                >
                  <Dna className="h-4 w-4" />
                  <span>{t('viewTeam')}</span>
                </button>

                {!rewardChoiceMade && (
                  <button
                    type="button"
                    onClick={rerollRewards}
                    disabled={!canRerollRewards || loading || isTransitioning}
                    className="pf-action-button px-3 py-2"
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
                  disabled={!canConfirmSelection || isTransitioning}
                  onClick={() => {
                    if (!selectedReward || !canConfirmSelection) return;
                    selectReward(selectedReward);
                  }}
                  className="pf-action-button px-4 py-2"
                  data-tone="primary"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{confirmLabel}</span>
                </button>

                {rewardChoiceMade && !pendingRewardAction && (
                  <button
                    type="button"
                    data-tone="primary"
                    onClick={nextStage}
                    disabled={loading || isTransitioning}
                    className="pf-action-button px-4 py-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{t('nextStep')}</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {pendingRewardAction === 'MOVE' && <LearnMoveOverlay viewModel={viewModel} />}
        {pendingRewardAction === 'EVOLUTION' && <EvolutionOverlay viewModel={viewModel} />}
      </AnimatePresence>

      <AnimatePresence>
        {showReplaceUI && <ReplacePokemonModal viewModel={viewModel} />}
      </AnimatePresence>
    </motion.div>
  );
}
