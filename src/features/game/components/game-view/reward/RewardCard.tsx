import { Dna, Package, Zap } from 'lucide-react';
import TypeBadge from '../../../../../components/TypeBadge';
import type { GameReward } from '../../../view-model';
import type { GameViewSectionProps } from '../shared';

interface RewardCardProps extends GameViewSectionProps {
  reward: GameReward;
  isSelected: boolean;
  onSelect: () => void;
}

function RewardIndicator({ active }: { active: boolean }) {
  return (
    <span
      className={`relative block h-5 w-5 overflow-hidden rounded-full border border-slate-500 ${
        active ? 'shadow-[0_0_0_2px_rgba(37,99,235,0.16)]' : 'opacity-[0.65]'
      }`}
      aria-hidden="true"
    >
      <span className={`${active ? 'bg-red-500' : 'bg-slate-300'} absolute left-0 top-0 h-1/2 w-full`} />
      <span className="absolute bottom-0 left-0 h-1/2 w-full bg-white" />
      <span className="absolute left-0 top-1/2 h-[1px] w-full -translate-y-1/2 bg-slate-700" />
      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-700 bg-white" />
    </span>
  );
}

function RewardVisual({ reward }: { reward: GameReward }) {
  if (reward.type === 'POKEMON') {
    return (
      <img
        src={reward.data.sprites.front_default}
        alt={reward.data.name}
        className="h-[88px] w-[88px] object-contain drop-shadow-[0_12px_14px_rgba(15,23,42,0.16)] transition-transform duration-200 group-hover:scale-105 sm:h-[96px] sm:w-[96px]"
        referrerPolicy="no-referrer"
      />
    );
  }

  const iconMap = {
    ITEM: { Icon: Package, tone: 'text-blue-500', shell: 'border-blue-100 bg-blue-50' },
    TM: { Icon: Zap, tone: 'text-cyan-500', shell: 'border-cyan-100 bg-cyan-50' },
    EVOLUTION: { Icon: Dna, tone: 'text-violet-500', shell: 'border-violet-100 bg-violet-50' },
  } as const;

  const entry = reward.type === 'ITEM' ? iconMap.ITEM : reward.type === 'TM' ? iconMap.TM : iconMap.EVOLUTION;
  const Icon = entry.Icon;

  return (
    <div className={`flex h-[88px] w-[88px] items-center justify-center rounded-full border shadow-sm sm:h-[96px] sm:w-[96px] ${entry.shell}`}>
      <Icon className={`h-11 w-11 sm:h-12 sm:w-12 ${entry.tone}`} />
    </div>
  );
}

export function RewardCard({ viewModel, reward, isSelected, onSelect }: RewardCardProps) {
  const { rewardChoiceMade, currentLanguage, t, getLocalized, getLocalizedDesc } = viewModel;
  const isZh = currentLanguage.startsWith('zh');
  const isClaimed = rewardChoiceMade;
  const isInteractive = !isClaimed;

  const ctaLabel = isClaimed
    ? (isZh ? '\u5df2\u9886\u53d6' : 'Claimed')
    : isSelected
      ? (isZh ? '\u5df2\u9009\u5b9a' : 'Selected')
      : (isZh ? '\u9009\u62e9\u5956\u52b1' : 'Select Reward');

  const ribbonLabel = 'REWARD';
  const title = reward.type === 'TM'
    ? `TM: ${getLocalized(reward.data.move)}`
    : reward.type === 'EVOLUTION'
      ? t('evolutionReward')
      : getLocalized(reward.data);

  const description = reward.type === 'ITEM'
    ? getLocalizedDesc(reward.data)
    : reward.type === 'TM'
      ? getLocalizedDesc(reward.data.move)
      : reward.type === 'EVOLUTION'
        ? t('evolutionRewardDesc')
        : null;
  const isLongTitle = title.length > 16;

  return (
    <button
      type="button"
      data-selected={isSelected ? 'true' : 'false'}
      data-claimed={isClaimed ? 'true' : 'false'}
      disabled={!isInteractive}
      onClick={onSelect}
      className={`pf-battle-card group relative aspect-[1.02] p-1 text-left sm:aspect-[1.08] sm:p-1.5 ${
        isInteractive ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
      } ${isSelected ? 'border-orange-200 shadow-[0_24px_42px_rgba(249,115,22,0.22)]' : ''}`}
    >
      <div className="pf-battle-ribbon">
        <span className="inline-block skew-x-[10deg]">{ribbonLabel}</span>
      </div>

      <div className="absolute right-1.5 top-1.5 z-20">
        <RewardIndicator active={isInteractive} />
      </div>

      {reward.type === 'POKEMON' && (
        <div className="absolute left-1.5 top-1/2 z-20 -translate-y-1/2">
          <div className="flex flex-col items-start gap-1">
            {reward.data.types.map((typeSlot: any) => (
              <TypeBadge key={`${reward.data.id}-${typeSlot.type.name}`} type={typeSlot.type.name} size="xs" />
            ))}
          </div>
        </div>
      )}

      <div className="relative z-10 flex h-full flex-col items-center justify-between gap-1 px-1.5 pb-1 pt-4 sm:px-2">
        <div className="flex min-h-[28px] w-full items-start justify-center px-7 text-center sm:min-h-[32px] sm:px-8">
          <h4 className={`line-clamp-2 leading-tight text-slate-950 ${
            isZh
              ? isLongTitle ? 'text-[11px] font-black' : 'text-[12px] font-black'
              : isLongTitle ? 'text-[10px] font-black uppercase tracking-[0.03em]' : 'text-[11px] font-black uppercase tracking-[0.04em]'
          }`}>
            {title}
          </h4>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <RewardVisual reward={reward} />
        </div>

        <div className="flex min-h-[34px] w-full items-center justify-center px-1 text-center sm:min-h-[40px] sm:px-2">
          {description ? (
            <p className="line-clamp-2 text-[10px] font-semibold leading-3.5 text-slate-500 sm:text-[11px] sm:leading-4">
              {description}
            </p>
          ) : (
            <div className="min-h-[18px] sm:min-h-[22px]" />
          )}
        </div>

        <div className="flex min-h-[28px] items-center justify-center px-2 text-center sm:min-h-[34px] sm:px-3">
          <span
            className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.14em] ${
              isClaimed
                ? 'border-slate-200 bg-slate-100 text-slate-400'
                : 'border-slate-200 bg-slate-900 text-white'
            }`}
          >
            {ctaLabel}
          </span>
        </div>
      </div>
    </button>
  );
}
