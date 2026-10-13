import type { GamePokemon } from '../../../../types';
import { getItemPinchHealDenominator, getItemPinchTriggerDenominator, hasItemBattleEffect } from '../../data/battle';
import { isHealingBlocked } from './resolveHealBlock';

export function resolveSitrusBerry(pokemon: GamePokemon) {
  const trigger = getItemPinchTriggerDenominator(pokemon.factoryHeldItemId);
  const recovery = getItemPinchHealDenominator(pokemon.factoryHeldItemId);
  if (!trigger || !recovery || !hasItemBattleEffect(pokemon.factoryHeldItemId, 'SITRUS_BERRY')
    || isHealingBlocked(pokemon) || pokemon.currentHp <= 0 || pokemon.currentHp > Math.floor(pokemon.maxHp / trigger)) {
    return { pokemon, activated: false };
  }
  const amount = Math.min(pokemon.maxHp - pokemon.currentHp, Math.max(1, Math.floor(pokemon.maxHp / recovery)));
  if (amount <= 0) return { pokemon, activated: false };
  return { pokemon: { ...pokemon, currentHp: pokemon.currentHp + amount, factoryHeldItemId: undefined }, activated: true };
}
