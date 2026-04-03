import { Coins, Dna, Package, Zap } from 'lucide-react';
import TypeBadge from '../../../../../components/TypeBadge';
import type { GameReward } from '../../../view-model';
import type { GameViewSectionProps } from '../shared';

interface RewardCardProps extends GameViewSectionProps {
  reward: GameReward;
  index: number;
}

export function RewardCard({ viewModel, reward, index }: RewardCardProps) {
  const { coins, rewardChoiceMade, t, getLocalized, getLocalizedDesc, selectReward } = viewModel;
  const isShop = reward.type === 'SHOP_ITEM';
  const isClaimed = rewardChoiceMade && !isShop;
  const canAfford = !isShop || coins >= reward.data.price;

  return (
    <button
      key={`${reward.type}-${index}`}
      disabled={isClaimed || !canAfford}
      onClick={() => selectReward(reward)}
      className={`group relative bg-white p-5 shadow-lg transition-all border-b-4 flex flex-col items-center justify-between min-h-[240px] ${
        isClaimed
          ? 'opacity-40 grayscale cursor-not-allowed border-slate-200'
          : !canAfford
            ? 'opacity-60 grayscale cursor-not-allowed border-orange-200'
            : isShop
              ? 'hover:border-orange-500 hover:-translate-y-1 border-orange-100'
              : 'hover:border-blue-500 hover:-translate-y-1 border-blue-100'
      }`}
    >
      <div className={`absolute top-0 left-0 px-3 py-1 text-[9px] font-black italic text-white skew-x-[-10deg] z-20 ${isShop ? 'bg-orange-500' : 'bg-blue-500'}`}>
        <span className="skew-x-[10deg] inline-block uppercase">{isShop ? t('mysteryShop') : t('randomRewards')}</span>
      </div>

      <div className="w-full flex flex-col items-center pt-4">
        {reward.type === 'ITEM' ? (
          <>
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Package className="w-8 h-8 text-blue-500" />
            </div>
            <h4 className="text-base font-black italic mb-1 leading-tight text-center">{getLocalized(reward.data)}</h4>
            <p className="text-[10px] text-slate-400 font-bold line-clamp-2 text-center px-2">{getLocalizedDesc(reward.data)}</p>
          </>
        ) : reward.type === 'MOVE' ? (
          <>
            <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Zap className="w-8 h-8 text-yellow-500" />
            </div>
            <h4 className="text-base font-black italic mb-1 leading-tight text-center">{t('learnMove')}</h4>
            <p className="text-[10px] text-slate-400 font-bold line-clamp-2 text-center px-2">{t('learnMoveDesc')}</p>
          </>
        ) : reward.type === 'EVOLUTION' ? (
          <>
            <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Dna className="w-8 h-8 text-purple-500" />
            </div>
            <h4 className="text-base font-black italic mb-1 leading-tight text-center">{t('evolutionReward')}</h4>
            <p className="text-[10px] text-slate-400 font-bold line-clamp-2 text-center px-2">{t('evolutionRewardDesc')}</p>
          </>
        ) : reward.type === 'POKEMON' ? (
          <>
            <div className="relative mb-2 group-hover:scale-110 transition-transform">
              <img
                src={reward.data.sprites.front_default}
                alt={reward.data.name}
                className="w-20 h-20 object-contain mx-auto relative z-10 drop-shadow-md"
                referrerPolicy="no-referrer"
              />
            </div>
            <h4 className="text-base font-black italic mb-1 uppercase leading-tight text-center">{getLocalized(reward.data)}</h4>
            <div className="flex justify-center gap-1 mt-1">
              {reward.data.types.map((typeSlot: any) => (
                <TypeBadge key={typeSlot.type.name} type={typeSlot.type.name} size="xs" />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Package className="w-8 h-8 text-orange-500" />
            </div>
            <h4 className="text-base font-black italic mb-1 leading-tight text-center">{getLocalized(reward.data.item)}</h4>
            <p className="text-[10px] text-slate-400 font-bold line-clamp-2 text-center px-2">{getLocalizedDesc(reward.data.item)}</p>
            <div className="mt-3 flex items-center gap-2 bg-orange-100 px-3 py-1 rounded-full">
              <Coins className="w-3 h-3 text-orange-600" />
              <span className="text-xs font-black text-orange-700">{reward.data.price}</span>
            </div>
          </>
        )}
      </div>

      <div
        className={`mt-6 w-full py-2 px-4 text-white font-black italic skew-x-[-10deg] transition-all text-xs shadow-md ${
          isClaimed
            ? 'bg-slate-300'
            : !canAfford
              ? 'bg-slate-400'
              : isShop
                ? 'bg-orange-600 group-hover:bg-orange-700'
                : 'bg-slate-900 group-hover:bg-blue-600'
        }`}
      >
        <span className="skew-x-[10deg] inline-block uppercase">
          {isClaimed ? 'CLAIMED' : isShop ? (canAfford ? t('buyItem') : t('insufficientCoins')) : t('selectThis')}
        </span>
      </div>
    </button>
  );
}
