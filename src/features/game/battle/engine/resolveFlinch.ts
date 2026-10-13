import type { GamePokemon, Move } from '../../../../types';
import { hasAbilityBattleEffect } from '../../data/battle';
import { hasVolatileStatus } from '../../utils/battleStatus';

export function resolveFlinch({ move, actor, target, nativeChance, itemChance, targetHasActed, allowTargetEffects, random = Math.random }: {
  move: Move; actor: GamePokemon; target: GamePokemon; nativeChance: number; itemChance: number;
  targetHasActed: boolean; allowTargetEffects: boolean; random?: () => number;
}) {
  const ability = actor.abilities?.[0]?.ability?.name;
  const targetAbility = target.abilities?.[0]?.ability?.name;
  const bypass = ['mold-breaker', 'teravolt', 'turboblaze'].includes(ability ?? '');
  const boost = hasAbilityBattleEffect(ability, 'SERENE_GRACE') ? 2 : 1;
  const sheerForce = hasAbilityBattleEffect(ability, 'SHEER_FORCE') && Boolean(move.battleData?.sheerForceBoost);
  const blocked = !allowTargetEffects || targetHasActed || target.currentHp <= 0
    || hasVolatileStatus(target, 'flinch') || target.specialBoostMode === 'DYNAMAX' && target.specialBoostActive
    || (!bypass && (hasAbilityBattleEffect(targetAbility, 'INNER_FOCUS') || hasAbilityBattleEffect(targetAbility, 'SHIELD_DUST')))
    || sheerForce;
  const nativeRoll = nativeChance > 0 && allowTargetEffects && target.currentHp > 0
    && random() * 100 < Math.min(100, nativeChance * boost);
  // Fixed source draws before Stench and SetMoveEffect's post-roll immunity checks.
  // The caller supplies itemChance only for a living target actually hit in its body.
  const itemRoll = itemChance > 0 && !move.battleData?.ignoresKingsRock && target.currentHp > 0
    && random() * 100 < Math.min(100, itemChance * boost);
  const fromMove = nativeRoll && !blocked;
  const fromItem = itemRoll && ability !== 'stench' && !blocked;
  return { flinched: fromMove || fromItem, kingsRockFlinched: fromItem && !fromMove };
}
