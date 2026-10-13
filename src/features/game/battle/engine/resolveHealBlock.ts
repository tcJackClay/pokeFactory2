import type { GamePokemon, Move } from '../../../../types';
import { TARGET_HEAL_RULES } from '../../config/heldItemRules';
import { hasVolatileStatus } from '../../utils/battleStatus';

export function isHealingBlocked(pokemon: GamePokemon | null | undefined) {
  return hasVolatileStatus(pokemon, 'heal_block');
}

export function isMoveHealBlocked(pokemon: GamePokemon, move: Move) {
  return isHealingBlocked(pokemon) && Boolean(move.battleData?.healBlockBanned);
}

export function isTargetHealingMove(move: Move) {
  return move.name === 'heal-pulse' || move.name === 'floral-healing';
}

export function getTargetMoveHealing(move: Move, actor: GamePokemon, target: GamePokemon, grassy: boolean) {
  if (!isTargetHealingMove(move) || isHealingBlocked(actor) || isHealingBlocked(target) || target.currentHp <= 0) return 0;
  const boosted = move.name === 'floral-healing' && grassy;
  const pulseBoosted = move.name === 'heal-pulse' && actor.abilities?.[0]?.ability?.name === 'mega-launcher';
  return Math.max(0, Math.min(target.maxHp - target.currentHp, Math.max(1, Math.floor(target.maxHp * (pulseBoosted ? TARGET_HEAL_RULES.megaLauncherPulse : boosted ? TARGET_HEAL_RULES.grassyFloral : TARGET_HEAL_RULES.ordinary)))));
}
