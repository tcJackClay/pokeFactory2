import type { GamePokemon } from '../../../../types';
import { getItemSurviveAtOneHpChance, hasItemBattleEffect } from '../../data/battle';

/** One direct hit only. Residual damage never enters this path. Neither item field is consumed. */
export function resolveHeldItemHit(defender: GamePokemon, damage: number, random: () => number = Math.random) {
  const hp = Math.max(0, defender.currentHp - Math.max(0, damage));
  const focusBandTriggered = defender.currentHp > 0 && damage > 0 && hp === 0
    && hasItemBattleEffect(defender.factoryHeldItemId, 'FOCUS_BAND')
    && random() < getItemSurviveAtOneHpChance(defender.factoryHeldItemId);
  return { hp: focusBandTriggered ? 1 : hp, focusBandTriggered };
}
