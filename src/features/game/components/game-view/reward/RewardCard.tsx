import { Coins, Dna, Package, Sparkles, Zap } from 'lucide-react';
import TypeBadge from '../../../../../components/TypeBadge';
import type { GameReward } from '../../../view-model';
import type { GameViewSectionProps } from '../shared';

interface RewardCardProps extends GameViewSectionProps {
  reward: GameReward;
  index: number;
}

export function RewardCard({ viewModel, reward, index }: RewardCardProps) {
  const { coins, rewardChoiceMade, currentLanguage, t, getLocalized, getLocalizedDesc, selectReward } = viewModel;
  const isZh = currentLanguage.startsWith('zh');
  const isShop = reward.type === 'SHOP_ITEM';
  const isClaimed = rewardChoiceMade && !isShop;
  const canAfford = !isShop || coins >= reward.data.price;
  const isFocalCard = index === 0 && !isClaimed;
  const ctaLabel = isClaimed
    ? (isZh ? '已领取' : 'Claimed')
    : isShop
      ? (canAfford ? t('buyItem') : t('insufficientCoins'))
      : t('selectThis');

  const cardTone = isShop ? 'Mystery Shop' : t('randomRewards');

  return (
    <button
      type="button"
      data-claimed={isClaimed ? 'true' : 'false'}
      disabled={isClaimed || !canAfford}
      onClick={() => selectReward(reward)}
      className={`pf-reward-card flex min-h-[280px] flex-col justify-between p-5 text-left ${
        !isClaimed && canAfford ? '' : 'cursor-not-allowed'
      } ${isFocalCard ? 'border-orange-200 shadow-[0_24px_42px_rgba(249,115,22,0.22)]' : ''}`}
    >
      <div className="pf-reward-ribbon">
        <span className="inline-block skew-x-[10deg]">{cardTone}</span>
      </div>

      <div className="pt-6">
        {reward.type === 'ITEM' ? (
          <>
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-blue-100 bg-blue-50 shadow-sm">
              <Package className="h-8 w-8 text-blue-500" />
            </div>
            <h4 className="text-lg font-black text-slate-950">{getLocalized(reward.data)}</h4>
            <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-500">{getLocalizedDesc(reward.data)}</p>
          </>
        ) : reward.type === 'TM' ? (
          <>
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-100 bg-cyan-50 shadow-sm">
              <Zap className="h-8 w-8 text-cyan-500" />
            </div>
            <h4 className="text-lg font-black text-slate-950">TM: {getLocalized(reward.data.move)}</h4>
            <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-500">{getLocalizedDesc(reward.data.move)}</p>
          </>
        ) : reward.type === 'EVOLUTION' ? (
          <>
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-violet-100 bg-violet-50 shadow-sm">
              <Dna className="h-8 w-8 text-violet-500" />
            </div>
            <h4 className="text-lg font-black text-slate-950">{t('evolutionReward')}</h4>
            <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-500">{t('evolutionRewardDesc')}</p>
          </>
        ) : reward.type === 'POKEMON' ? (
          <>
            <div className="mb-3 flex justify-center rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] px-3 py-4">
              <img
                src={reward.data.sprites.front_default}
                alt={reward.data.name}
                className="h-24 w-24 object-contain drop-shadow-[0_12px_18px_rgba(15,23,42,0.18)]"
                referrerPolicy="no-referrer"
              />
            </div>
            <h4 className="text-lg font-black text-slate-950">{getLocalized(reward.data)}</h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {reward.data.types.map((typeSlot: any) => (
                <TypeBadge key={typeSlot.type.name} type={typeSlot.type.name} size="xs" />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-orange-100 bg-orange-50 shadow-sm">
              <Sparkles className="h-8 w-8 text-orange-500" />
            </div>
            <h4 className="text-lg font-black text-slate-950">{getLocalized(reward.data.item)}</h4>
            <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-500">{getLocalizedDesc(reward.data.item)}</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-sm font-black text-orange-700">
              <Coins className="h-4 w-4" />
              {reward.data.price}
            </div>
          </>
        )}
      </div>

      <div className="mt-5">
        <div
          className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-[16px] border px-4 py-3 text-center text-sm font-black uppercase tracking-[0.14em] ${
            isClaimed
              ? 'border-slate-200 bg-slate-100 text-slate-400'
              : !canAfford
                ? 'border-slate-200 bg-slate-100 text-slate-400'
                : isShop
                  ? 'border-orange-200 bg-orange-500 text-white'
                  : 'border-slate-200 bg-slate-900 text-white'
          }`}
        >
          {ctaLabel}
        </div>
      </div>
    </button>
  );
}
