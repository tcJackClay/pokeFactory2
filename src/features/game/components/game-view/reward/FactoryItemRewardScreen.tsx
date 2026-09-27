import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Gift, ShieldCheck } from 'lucide-react';
import type { GamePokemon } from '../../../../../types';
import type { FactoryRewardHeldItemId } from '../../../config/factoryRewardPool';
import {
  getRewardApplicability,
  isFactoryRewardHeldItemId,
  normalizeFactoryHeldItemId,
  type FactoryRewardApplicability,
} from '../../../config/factoryRewardPool';
import { getFactoryHeldItemIcon } from '../../../config/factoryHeldItemIcons';
import { battleHeldItemName } from '../../../battle/battleLogText';
import { canEquipRewardItem } from '../../../../../services/saveManager';
import type { GameViewSectionProps } from '../shared';

const ITEM_NAME_EN: Record<FactoryRewardHeldItemId, string> = {
  scope_lens: 'Scope Lens',
  quick_claw: 'Quick Claw',
  kings_rock: "King's Rock",
  choice_band: 'Choice Band',
  focus_band: 'Focus Band',
  heavy_duty_boots: 'Heavy-Duty Boots',
  loaded_dice: 'Loaded Dice',
};

function englishFromItemId(itemId: string): string {
  return itemId.split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function itemName(itemId: string | null | undefined, isZh: boolean): string {
  const normalized = normalizeFactoryHeldItemId(itemId);
  if (!normalized) return isZh ? '无' : 'None';
  const english = isFactoryRewardHeldItemId(normalized) ? ITEM_NAME_EN[normalized] : englishFromItemId(normalized);
  return battleHeldItemName(normalized, english, isZh ? 'zh-hans' : 'en');
}

function localizedPokemonName(pokemon: GamePokemon | undefined, getLocalized: (value: unknown) => string): string {
  if (!pokemon) return '';
  return getLocalized(pokemon) || pokemon.pokeApiName || pokemon.name;
}

/**
 * 持有物图标：`getFactoryHeldItemIcon` 对实测 404 的两件返回 `null`，
 * 此时降级为文字徽标；即便返回了 URL 也在加载失败时再降级一次，**不得出现破图**。
 */
function HeldItemIcon({ itemId, isZh }: { itemId: string; isZh: boolean }) {
  const iconUrl = getFactoryHeldItemIcon(itemId);
  const [failed, setFailed] = useState(false);
  if (!iconUrl || failed) {
    return (
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[10px] font-black text-slate-600"
      >
        {itemName(itemId, isZh).slice(0, 2)}
      </span>
    );
  }
  return (
    <img
      src={iconUrl}
      alt=""
      aria-hidden="true"
      className="h-9 w-9 object-contain"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function FactoryItemRewardScreen({ viewModel }: GameViewSectionProps) {
  const {
    rewardCheckpoint,
    rewardClaimError,
    rewardClaimBusy,
    rewardContinueError,
    rewardContinueBusy,
    rewardPrepareError,
    playerTeam,
    currentLanguage,
    getLocalized,
    claimFactoryItemReward,
    clearFactoryItemRewardError,
    continueAfterFactoryReward,
    retryFactoryItemRewardPrepare,
  } = viewModel;
  const [selectedItem, setSelectedItem] = useState<FactoryRewardHeldItemId | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const openConfirmButtonRef = useRef<HTMLButtonElement>(null);
  const claimedHeadingRef = useRef<HTMLHeadingElement>(null);
  const isZh = currentLanguage.startsWith('zh');
  const copy = {
    pendingTitle: isZh ? '奖励待准备' : 'Reward pending',
    pendingBody: isZh
      ? '换怪结果已保存，奖励卡尚未准备完成。请保留存档，稍后继续。'
      : 'Your swap result is saved. Reward cards are not ready yet. Keep this save and continue later.',
    retryPrepare: isZh ? '重新准备奖励卡' : 'Prepare reward cards again',
    claimedTitle: isZh ? '奖励已领取' : 'Reward claimed',
    noItem: isZh ? '无' : 'None',
    chooseHeading: isZh ? '选择一件持有物' : 'Choose a held item',
    chooseHint: isZh ? '四选一，选定后为当前队伍的一名成员装备。' : 'Choose one of four cards, then equip it to a teammate.',
    cardsLabel: isZh ? '奖励卡' : 'Reward cards',
    teammateHeading: isZh ? '选择装备队员' : 'Choose a teammate',
    pickCardFirst: isZh ? '先选择一张奖励卡。' : 'Choose a reward card first.',
    targetBlocked: isZh
      ? '同款装备或会造成队内重复的队员不可选择。'
      : 'Teammates who already have this item or would create a duplicate cannot be selected.',
    confirmHeading: isZh ? '确认替换持有物' : 'Confirm replacement',
    confirmNote: isZh ? '原装备会被替换，不会放入背包。' : 'The previous item is replaced and is not added to your bag.',
    confirmClaim: isZh ? '确认替换并领取' : 'Replace and claim',
    retrySave: isZh ? '重试保存' : 'Retry save',
    backToSelection: isZh ? '返回选择' : 'Back to selection',
    review: isZh ? '查看替换内容' : 'Review replacement',
    continue: isZh ? '继续挑战' : 'Continue challenge',
    retryContinue: isZh ? '重试进入下一战' : 'Retry next battle',
    continuing: isZh ? '正在进入下一战…' : 'Loading next battle…',
    claimedBody: (item: string, recipient: string) => (isZh
      ? `${item}已装备给${recipient}；原装备已直接移除、未进入背包。领取结果已保存。`
      : `${item} is equipped to ${recipient}. The previous item was removed instead of being bagged. Your choice is saved.`),
  };

  useEffect(() => {
    if (confirming) confirmButtonRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    if (rewardCheckpoint?.status === 'CLAIMED') claimedHeadingRef.current?.focus();
  }, [rewardCheckpoint?.status]);

  // PENDING：未生成候选（正常）或枚举/落盘失败（缺陷态，可重试）。
  if (!rewardCheckpoint || rewardCheckpoint.status === 'PENDING') {
    return (
      <section className="pf-scroll-y flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-6 text-center" aria-live="polite">
        {rewardPrepareError
          ? <AlertTriangle className="h-9 w-9 text-amber-600" aria-hidden="true" />
          : <Gift className="h-9 w-9 text-slate-500" aria-hidden="true" />}
        <h2 className="text-xl font-black text-slate-900">{copy.pendingTitle}</h2>
        <p className="max-w-md text-sm text-slate-600">{copy.pendingBody}</p>
        {rewardPrepareError && (
          <>
            <p role="alert" className="max-w-md rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{rewardPrepareError}</p>
            <button type="button" onClick={retryFactoryItemRewardPrepare} className="pf-action-button min-h-12 px-5 py-3" data-tone="primary">
              {copy.retryPrepare}
            </button>
          </>
        )}
      </section>
    );
  }

  if (rewardCheckpoint.status === 'CLAIMED') {
    const { itemId, targetIndex } = rewardCheckpoint.claim;
    const recipient = playerTeam[targetIndex];
    return (
      <section className="pf-scroll-y flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-6 text-center" aria-live="polite">
        <ShieldCheck className="h-10 w-10 text-emerald-600" aria-hidden="true" />
        <h2 ref={claimedHeadingRef} tabIndex={-1} className="text-xl font-black text-slate-900">{copy.claimedTitle}</h2>
        <p className="max-w-md text-sm text-slate-700">
          {copy.claimedBody(itemName(itemId, isZh), localizedPokemonName(recipient, getLocalized))}
        </p>
        {rewardContinueError && <p role="alert" className="max-w-md rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{rewardContinueError}</p>}
        <button type="button" disabled={rewardContinueBusy} onClick={() => void continueAfterFactoryReward()} className="pf-action-button min-h-12 px-5 py-3" data-tone="primary">
          {rewardContinueBusy
            ? copy.continuing
            : rewardContinueError || rewardCheckpoint.continueRequested ? copy.retryContinue : copy.continue}
        </button>
      </section>
    );
  }

  const activeItem = selectedItem && rewardCheckpoint.cardItemIds.includes(selectedItem) ? selectedItem : null;
  const activeTarget = activeItem !== null && selectedTarget !== null
    && canEquipRewardItem(playerTeam, activeItem, selectedTarget) ? selectedTarget : null;
  const targetPokemon = activeTarget !== null ? playerTeam[activeTarget] : null;
  const chooseCard = (itemId: FactoryRewardHeldItemId) => {
    clearFactoryItemRewardError();
    setSelectedItem(itemId);
    setSelectedTarget(null);
    setConfirming(false);
  };
  const cancelConfirmation = () => {
    setConfirming(false);
    requestAnimationFrame(() => openConfirmButtonRef.current?.focus());
  };

  /**
   * 卡面适用性（PRD §3.6 / 裁决）：判定**全部**委托 `getRewardApplicability`（单一真值源），
   * 本组件只负责把它翻译成文案。
   * 卡面口径 = 取队内最优：只要有一名队员「有效」就按有效呈现（并具名列出受影响队员），
   * 全员都无触发场景时才呈现「可装备，但当前无对应触发场景」。
   */
  const cardApplicability = (itemId: FactoryRewardHeldItemId): FactoryRewardApplicability => {
    const evaluations = playerTeam.map((pokemon) => getRewardApplicability(pokemon, itemId));
    if (evaluations.includes('APPLICABLE')) return 'APPLICABLE';
    if (evaluations.includes('CONDITIONAL')) return 'CONDITIONAL';
    return 'NO_TRIGGER';
  };

  const loadedDiceTeammates = playerTeam
    .map((pokemon, index) => ({ pokemon, index }))
    .filter(({ pokemon }) => getRewardApplicability(pokemon, 'loaded_dice') === 'APPLICABLE');

  /**
   * 卡面诚实性（PRD §3.6 / 裁决）：可装备但当局无触发场景时必须如实标注，
   * **不得**为凑满四张谎称当局有效。
   */
  const cardApplicabilityNote = (itemId: FactoryRewardHeldItemId): string | null => {
    const applicability = cardApplicability(itemId);
    if (itemId === 'heavy_duty_boots') {
      return applicability === 'CONDITIONAL'
        ? (isZh
          ? '条件性：仅在入场时已铺设隐形岩 / 毒菱时有收益；接地毒属性仍吸收毒菱。'
          : 'Conditional: only pays off when Stealth Rock or Toxic Spikes are already set on entry; grounded Poison-types still absorb Toxic Spikes.')
        : null;
    }
    if (itemId !== 'loaded_dice') return null;
    if (applicability === 'NO_TRIGGER') {
      return isZh
        ? '可装备，但当前无对应触发场景：队伍中没有 2–5 次连续攻击招式，或持有该招式的队员已有「连续攻击」特性（此时骰子不改变命中次数）。'
        : 'Equippable, but nothing triggers it now: your team has no 2-5 hit move, or its holder already has Skill Link (then the dice cannot change the hit count).';
    }
    const names = loadedDiceTeammates.map(({ pokemon }) => localizedPokemonName(pokemon, getLocalized)).join('、');
    return isZh
      ? `仅对持有 2–5 次连续攻击招式的队员改变命中次数：${names}。`
      : `Only changes hit counts for teammates with a 2-5 hit move: ${names}.`;
  };

  return (
    <section className="pf-scroll-y custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4" aria-labelledby="factory-reward-title">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 pb-4">
        <div className="pf-panel px-4 py-3">
          <h2 id="factory-reward-title" className="text-lg font-black text-slate-900">{copy.chooseHeading}</h2>
          <p className="mt-1 text-xs text-slate-600">{copy.chooseHint}</p>
        </div>

        <div className="grid grid-cols-2 gap-2" role="group" aria-label={copy.cardsLabel}>
          {rewardCheckpoint.cardItemIds.map((itemId) => {
            const canClaim = playerTeam.some((_, index) => canEquipRewardItem(playerTeam, itemId, index));
            const selected = activeItem === itemId;
            const note = cardApplicabilityNote(itemId);
            return (
              <button
                key={itemId}
                type="button"
                disabled={!canClaim || rewardClaimBusy}
                aria-pressed={selected}
                onClick={() => chooseCard(itemId)}
                className={`pf-panel flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'} disabled:opacity-50`}
              >
                <HeldItemIcon itemId={itemId} isZh={isZh} />
                <span className="text-sm font-bold text-slate-900">{itemName(itemId, isZh)}</span>
                {note && <span className="text-[10px] font-semibold leading-tight text-amber-800">{note}</span>}
                {selected && <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <div className="pf-panel px-3 py-3">
          <h3 className="mb-2 text-sm font-black text-slate-900">{copy.teammateHeading}</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {playerTeam.map((pokemon, index) => {
              const eligible = activeItem !== null && canEquipRewardItem(playerTeam, activeItem, index);
              const teammateNoTrigger = activeItem === 'loaded_dice'
                && getRewardApplicability(pokemon, 'loaded_dice') === 'NO_TRIGGER';
              return (
                <button
                  key={`${pokemon.id}-${index}`}
                  type="button"
                  disabled={!eligible || rewardClaimBusy}
                  aria-pressed={activeTarget === index}
                  onClick={() => { clearFactoryItemRewardError(); setSelectedTarget(index); setConfirming(false); }}
                  className={`flex min-h-14 items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${activeTarget === index ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'} disabled:opacity-50`}
                >
                  <span className="min-w-0 truncate text-sm font-bold text-slate-900">{localizedPokemonName(pokemon, getLocalized)}</span>
                  <span className="shrink-0 text-right text-[11px] text-slate-600">
                    <span className="block">{itemName(pokemon.factoryEquippedHeldItemId, isZh)}</span>
                    {teammateNoTrigger && (
                      <span className="block font-semibold text-amber-800">
                        {isZh ? '无对应触发场景' : 'Nothing to trigger'}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {!activeItem && <p className="mt-2 text-xs text-slate-500">{copy.pickCardFirst}</p>}
          {activeItem && activeTarget === null && <p className="mt-2 text-xs text-slate-500">{copy.targetBlocked}</p>}
        </div>

        {confirming && activeItem && targetPokemon ? (
          <div className="pf-panel border-amber-300 bg-amber-50 px-4 py-3" role="group" aria-label={copy.confirmHeading}>
            <h3 className="text-sm font-black text-slate-900">{copy.confirmHeading}</h3>
            <p className="mt-1 text-sm text-slate-700">
              {`${localizedPokemonName(targetPokemon, getLocalized)}：${itemName(targetPokemon.factoryEquippedHeldItemId, isZh)} → ${itemName(activeItem, isZh)}`}
            </p>
            <p className="mt-1 text-xs text-slate-600">{copy.confirmNote}</p>
            {rewardClaimError && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{rewardClaimError}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button ref={confirmButtonRef} type="button" disabled={rewardClaimBusy} onClick={() => void claimFactoryItemReward(activeItem, activeTarget!)} className="pf-action-button min-h-11 px-4 py-2" data-tone="primary">
                {rewardClaimError ? copy.retrySave : copy.confirmClaim}
              </button>
              <button type="button" disabled={rewardClaimBusy} onClick={cancelConfirmation} className="pf-action-button min-h-11 px-4 py-2">
                {copy.backToSelection}
              </button>
            </div>
          </div>
        ) : (
          <button
            ref={openConfirmButtonRef}
            type="button"
            disabled={activeItem === null || activeTarget === null || rewardClaimBusy}
            onClick={() => setConfirming(true)}
            className="pf-action-button min-h-12 w-full justify-center px-4 py-3"
            data-tone="primary"
          >
            {copy.review}
          </button>
        )}
      </div>
    </section>
  );
}
