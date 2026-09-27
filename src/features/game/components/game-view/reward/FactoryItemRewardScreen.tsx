import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Gift, ShieldCheck, ShoppingCart, Ticket } from 'lucide-react';
import type { GamePokemon } from '../../../../../types';
import type { FactoryRewardHeldItemId, FactoryShopProduct } from '../../../config/factoryRewardPool';
import {
  getFactoryHeldItemShopPrice,
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
  white_herb: 'White Herb',
  mental_herb: 'Mental Herb',
};

/**
 * 商品功能一句话说明（数据源：`data/battle/itemEffects.ts` 的 effectId / hooks 与数值，
 * 文案须与其保持一致；档位价格另由 `factoryRewardPool.getFactoryHeldItemShopPrice` 驱动）。
 */
const ITEM_EFFECT_ZH: Record<FactoryRewardHeldItemId, string> = {
  scope_lens: '命中要害等级 +1，稳定提高暴击概率。',
  quick_claw: '每回合有 20% 概率抢先出手。',
  kings_rock: '攻击命中时，有 10% 概率使对手畏缩。',
  choice_band: '物理招式威力 ×1.5，代价是只能连续使用同一招式。',
  focus_band: '受到致命一击时，有 10% 概率以 1 HP 挺住；本场不消耗，可反复判定。',
  heavy_duty_boots: '免疫入场陷阱（隐形岩、毒菱）的伤害与状态。',
  loaded_dice: '提高 2–5 次连续攻击招式的命中次数。',
  white_herb: '复原被对手降低的能力等级，随后消耗掉自己。',
  mental_herb: '解除挑衅、再来一次、定身法等妨碍状态，随后消耗掉自己。',
};

const ITEM_EFFECT_EN: Record<FactoryRewardHeldItemId, string> = {
  scope_lens: 'Crit stage +1: consistently raises critical-hit chance.',
  quick_claw: 'Each turn has a 20% chance to strike first.',
  kings_rock: 'Hits have a 10% chance to make the foe flinch.',
  choice_band: 'Physical moves ×1.5, but you must repeat the same move.',
  focus_band: 'Survives a lethal hit at 1 HP with 10% chance; never consumed in-battle.',
  heavy_duty_boots: 'Immune to entry hazards (Stealth Rock, Toxic Spikes).',
  loaded_dice: 'Raises the hit count of 2-5 hit multi-hit moves.',
  white_herb: 'Restores lowered stat stages once, then is consumed.',
  mental_herb: 'Cures Taunt, Encore, Disable and similar, then is consumed.',
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
    supplyTickets,
    currentLanguage,
    getLocalized,
    purchaseFactoryShopItem,
    clearFactoryItemRewardError,
    continueAfterFactoryReward,
    retryFactoryItemRewardPrepare,
  } = viewModel;
  const [selectedItem, setSelectedItem] = useState<FactoryRewardHeldItemId | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const claimedHeadingRef = useRef<HTMLHeadingElement>(null);
  const isZh = currentLanguage.startsWith('zh');
  const copy = {
    pendingTitle: isZh ? '奖励待准备' : 'Reward pending',
    pendingBody: isZh
      ? '换怪结果已保存，货架尚未准备完成。请保留存档，稍后继续。'
      : 'Your swap result is saved. The shop shelf is not ready yet. Keep this save and continue later.',
    retryPrepare: isZh ? '重新准备货架' : 'Prepare the shop shelf again',
    shopHeading: isZh ? '交换商店' : 'Exchange shop',
    shopHint: isZh
      ? '用兑换券兑换持有物。一次可买多件，也可以一件不买直接离开。'
      : 'Spend tickets on held items. Buy several, or leave without buying anything.',
    ticketBalance: (tickets: number) => (isZh ? `兑换券余额：${tickets} 张` : `Tickets: ${tickets}`),
    shelfLabel: isZh ? '货架' : 'Shelf',
    priceLabel: (price: number) => (isZh ? `${price} 券` : `${price} ticket${price === 1 ? '' : 's'}`),
    insufficient: isZh ? '券不足' : 'Not enough tickets',
    purchasedLabel: isZh ? '已兑换' : 'Purchased',
    noTarget: isZh ? '无可装备队员' : 'No legal teammate',
    redeem: isZh ? '兑换' : 'Redeem',
    teammateHeading: isZh ? '选择装备队员' : 'Choose a teammate',
    pickProductFirst: isZh ? '先选择一件要兑换的商品。' : 'Choose a product to redeem first.',
    targetBlocked: isZh
      ? '同款装备或会造成队内重复的队员不可选择。'
      : 'Teammates who already have this item or would create a duplicate cannot be selected.',
    confirmHeading: isZh ? '确认兑换' : 'Confirm purchase',
    confirmNote: isZh
      ? '先扣券、再装备；原装备会被替换，不会放入背包。'
      : 'Tickets are spent first, then the item is equipped; the previous item is replaced and not bagged.',
    confirmPurchase: (price: number) => (isZh ? `扣 ${price} 券兑换` : `Spend ${price} ticket${price === 1 ? '' : 's'} and redeem`),
    retryPurchase: isZh ? '重试兑换' : 'Retry purchase',
    backToShop: isZh ? '返回商店' : 'Back to shop',
    leaveShop: isZh ? '离开商店' : 'Leave shop',
    closedTitle: isZh ? '商店已关闭' : 'Shop closed',
    closedBodyEmpty: isZh
      ? '本次没有兑换任何商品，兑换券保留到组末结算（1 券 = 1 BP）。'
      : 'Nothing was purchased. Your tickets carry over to the settlement (1 ticket = 1 BP).',
    closedBody: (item: string, recipient: string, price: number) => (isZh
      ? `${item}已装备给${recipient}（花费 ${price} 券）。结果已保存。`
      : `${item} is equipped to ${recipient} (${price} ticket${price === 1 ? '' : 's'} spent). Your choice is saved.`),
    continue: isZh ? '继续挑战' : 'Continue challenge',
    retryContinue: isZh ? '重试进入下一战' : 'Retry next battle',
    continuing: isZh ? '正在进入下一战…' : 'Loading next battle…',
  };

  useEffect(() => {
    if (confirming) confirmButtonRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    if (rewardCheckpoint?.status === 'CLAIMED') claimedHeadingRef.current?.focus();
  }, [rewardCheckpoint?.status]);

  // PENDING：未生成货架（正常）或枚举/落盘失败（缺陷态，可重试）。
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
    return (
      <section className="pf-scroll-y flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-6 text-center" aria-live="polite">
        <ShieldCheck className="h-10 w-10 text-emerald-600" aria-hidden="true" />
        <h2 ref={claimedHeadingRef} tabIndex={-1} className="text-xl font-black text-slate-900">{copy.closedTitle}</h2>
        {rewardCheckpoint.purchases.length === 0 ? (
          <p className="max-w-md text-sm text-slate-700">{copy.closedBodyEmpty}</p>
        ) : (
          <ul className="max-w-md list-disc space-y-1 pl-5 text-left text-sm text-slate-700">
            {rewardCheckpoint.purchases.map((purchase) => (
              <li key={purchase.itemId}>
                {copy.closedBody(
                  itemName(purchase.itemId, isZh),
                  localizedPokemonName(playerTeam[purchase.targetIndex], getLocalized),
                  purchase.ticketsSpent,
                )}
              </li>
            ))}
          </ul>
        )}
        {rewardContinueError && <p role="alert" className="max-w-md rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{rewardContinueError}</p>}
        <button type="button" disabled={rewardContinueBusy} onClick={() => void continueAfterFactoryReward()} className="pf-action-button min-h-12 px-5 py-3" data-tone="primary">
          {rewardContinueBusy
            ? copy.continuing
            : rewardContinueError || rewardCheckpoint.continueRequested ? copy.retryContinue : copy.continue}
        </button>
      </section>
    );
  }

  // READY：商店（货架 6 件，一次可买多件，也可一件不买直接离开）。
  const shelf: FactoryShopProduct[] = rewardCheckpoint.shelf;
  const purchasedItemIds = new Set(rewardCheckpoint.purchases.map((purchase) => purchase.itemId));
  const activeItem = selectedItem && shelf.some((product) => product.kind === 'HELD_ITEM' && product.itemId === selectedItem)
    && !purchasedItemIds.has(selectedItem) ? selectedItem : null;
  const activeTarget = activeItem !== null && selectedTarget !== null
    && canEquipRewardItem(playerTeam, activeItem, selectedTarget) ? selectedTarget : null;
  const targetPokemon = activeTarget !== null ? playerTeam[activeTarget] : null;
  const chooseProduct = (itemId: FactoryRewardHeldItemId) => {
    clearFactoryItemRewardError();
    setSelectedItem(itemId);
    setSelectedTarget(null);
    setConfirming(false);
  };
  const cancelConfirmation = () => {
    setConfirming(false);
  };

  /**
   * 卡面适用性（PRD F5 / 裁决）：判定**全部**委托 `getRewardApplicability`（单一真值源），
   * 本组件只负责把它翻译成文案。
   * 卡面口径 = 取队内最优：只要有一名队员「有效」就按有效呈现（并具名列出受影响队员），
   * 全员都无触发场景时才呈现「可装备，但当前无对应触发场景」。
   * 白色香草 / 心灵香草按 `CONDITIONAL` 处理，**不得**标成无条件有效。
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
   * 商品说明诚实性（PRD F5）：可装备但当局无触发场景 / 条件性收益时必须如实标注，
   * **不得**为凑满货架谎称当局有效。
   */
  const productApplicabilityNote = (itemId: FactoryRewardHeldItemId): string | null => {
    const applicability = cardApplicability(itemId);
    if (itemId === 'heavy_duty_boots') {
      return applicability === 'CONDITIONAL'
        ? (isZh
          ? '条件性：仅在入场时已铺设隐形岩 / 毒菱时有收益；接地毒属性仍吸收毒菱。'
          : 'Conditional: only pays off when Stealth Rock or Toxic Spikes are already set on entry; grounded Poison-types still absorb Toxic Spikes.')
        : null;
    }
    if (itemId === 'white_herb') {
      return isZh
        ? '条件性：只有对手降低过持有者的能力等级才有收益；没人降你能力就是白装。'
        : 'Conditional: only pays off when the foe lowers the holder\'s stat stages; nothing to restore otherwise.';
    }
    if (itemId === 'mental_herb') {
      return isZh
        ? '条件性：只有对手造成过挑衅、再来一次等妨碍状态才有收益；对手不放就是白装。'
        : 'Conditional: only pays off when the foe inflicts Taunt, Encore or similar; nothing to cure otherwise.';
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

  const ticketBalance = Math.max(0, Math.floor(Number.isFinite(supplyTickets) ? supplyTickets : 0));

  return (
    <section className="pf-scroll-y custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4" aria-labelledby="factory-reward-title">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 pb-4">
        <div className="pf-panel flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h2 id="factory-reward-title" className="flex items-center gap-2 text-lg font-black text-slate-900">
              <ShoppingCart className="h-5 w-5 text-slate-700" aria-hidden="true" />
              {copy.shopHeading}
            </h2>
            <p className="mt-1 text-xs text-slate-600">{copy.shopHint}</p>
          </div>
          <p
            data-testid="shop-ticket-balance"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-black text-amber-900"
          >
            <Ticket className="h-4 w-4 text-amber-700" aria-hidden="true" />
            {copy.ticketBalance(ticketBalance)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2" role="group" aria-label={copy.shelfLabel}>
          {shelf.map((product) => {
            if (product.kind !== 'HELD_ITEM') return null;
            const itemId = product.itemId;
            const price = getFactoryHeldItemShopPrice(itemId) ?? 0;
            const purchased = purchasedItemIds.has(itemId);
            const hasLegalTarget = playerTeam.some((_, index) => canEquipRewardItem(playerTeam, itemId, index));
            const insufficientTickets = !purchased && ticketBalance < price;
            const redeemable = !purchased && hasLegalTarget && !insufficientTickets;
            const selected = activeItem === itemId;
            const note = productApplicabilityNote(itemId);
            const effect = isZh ? ITEM_EFFECT_ZH[itemId] : ITEM_EFFECT_EN[itemId];
            return (
              <div
                key={itemId}
                data-testid="shop-product"
                data-state={purchased ? 'purchased' : insufficientTickets ? 'insufficient' : !hasLegalTarget ? 'no-target' : 'available'}
                aria-label={itemName(itemId, isZh)}
                className={`pf-panel flex min-h-28 flex-col gap-1.5 rounded-2xl border-2 px-2.5 py-3 text-center ${selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-center justify-center gap-2">
                  <HeldItemIcon itemId={itemId} isZh={isZh} />
                  <span className="text-sm font-bold text-slate-900">{itemName(itemId, isZh)}</span>
                </div>
                <p
                  className={`text-lg font-black ${insufficientTickets ? 'text-red-600 line-through decoration-red-400' : purchased ? 'text-slate-400' : 'text-amber-700'}`}
                  aria-label={copy.priceLabel(price)}
                >
                  {copy.priceLabel(price)}
                </p>
                <p className="text-[10px] font-semibold leading-tight text-slate-600">{effect}</p>
                {note && <p className="text-[10px] font-semibold leading-tight text-amber-800">{note}</p>}
                {purchased ? (
                  <p className="mt-auto flex items-center justify-center gap-1 text-xs font-black text-emerald-700" data-testid="shop-product-purchased">
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    {copy.purchasedLabel}
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={!redeemable || rewardClaimBusy}
                    onClick={() => chooseProduct(itemId)}
                    className={`pf-action-button mt-auto min-h-10 w-full justify-center px-3 py-2 text-sm ${insufficientTickets ? 'cursor-not-allowed opacity-50 grayscale' : ''}`}
                    data-tone={redeemable ? 'primary' : undefined}
                    data-testid="shop-redeem-button"
                  >
                    {insufficientTickets ? copy.insufficient : !hasLegalTarget ? copy.noTarget : copy.redeem}
                  </button>
                )}
              </div>
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
                  onClick={() => { clearFactoryItemRewardError(); setSelectedTarget(index); setConfirming(true); }}
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
          {!activeItem && <p className="mt-2 text-xs text-slate-500">{copy.pickProductFirst}</p>}
          {activeItem && activeTarget === null && <p className="mt-2 text-xs text-slate-500">{copy.targetBlocked}</p>}
        </div>

        {confirming && activeItem && targetPokemon ? (
          <div className="pf-panel border-amber-300 bg-amber-50 px-4 py-3" role="group" aria-label={copy.confirmHeading}>
            <h3 className="text-sm font-black text-slate-900">{copy.confirmHeading}</h3>
            <p className="mt-1 text-sm text-slate-700">
              {`${localizedPokemonName(targetPokemon, getLocalized)}：${itemName(targetPokemon.factoryEquippedHeldItemId, isZh)} → ${itemName(activeItem, isZh)}（${copy.priceLabel(getFactoryHeldItemShopPrice(activeItem) ?? 0)}）`}
            </p>
            <p className="mt-1 text-xs text-slate-600">{copy.confirmNote}</p>
            {rewardClaimError && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{rewardClaimError}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                ref={confirmButtonRef}
                type="button"
                disabled={rewardClaimBusy}
                onClick={async () => {
                  const purchasedOk = await purchaseFactoryShopItem(activeItem, activeTarget!);
                  if (purchasedOk) {
                    setConfirming(false);
                    setSelectedTarget(null);
                    setSelectedItem(null);
                  }
                }}
                className="pf-action-button min-h-11 px-4 py-2"
                data-tone="primary"
              >
                {rewardClaimError ? copy.retryPurchase : copy.confirmPurchase(getFactoryHeldItemShopPrice(activeItem) ?? 0)}
              </button>
              <button type="button" disabled={rewardClaimBusy} onClick={cancelConfirmation} className="pf-action-button min-h-11 px-4 py-2">
                {copy.backToShop}
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          disabled={rewardContinueBusy}
          onClick={() => void continueAfterFactoryReward()}
          className="pf-action-button min-h-12 w-full justify-center px-4 py-3"
          data-testid="shop-leave-button"
        >
          {rewardContinueBusy ? copy.continuing : copy.leaveShop}
        </button>
      </div>
    </section>
  );
}
