import type { GamePokemon, Move } from '../../../../types';
import { buildMoveBattleDataFromPokeApiMove, hasItemBattleEffect } from '../../data/battle';
import { getVolatileStatus, hasVolatileStatus } from '../../utils/battleStatus';
import { STRUGGLE_RULES } from '../../config/heldItemRules';
import { resolveMentalHerb } from './resolveMentalHerb';
import { isMoveHealBlocked } from './resolveHealBlock';

export const STRUGGLE_MOVE: Move = {
  name: 'struggle', zhName: '挣扎', power: STRUGGLE_RULES.power, accuracy: null,
  type: 'normal', damage_class: 'physical', pp: 1,
  battleData: buildMoveBattleDataFromPokeApiMove({ name: 'struggle', priority: STRUGGLE_RULES.priority,
    damage_class: { name: 'physical' }, type: { name: 'normal' }, target: { name: 'selected-pokemon' } }),
};

export const currentMovePp = (move: Move) => move.currentPp ?? move.maxPp ?? move.pp ?? 0;

export function isMoveRestricted(pokemon: GamePokemon, move: Move) {
  if (move.name === 'struggle') return false;
  const encore = getVolatileStatus(pokemon, 'encore')?.linkedMoveName;
  const encoredMove = pokemon.selectedMoves.find((entry) => entry.name === encore);
  return Boolean(
    (encoredMove && currentMovePp(encoredMove) > 0 && move.name !== encore)
    || (getVolatileStatus(pokemon, 'disable')?.linkedMoveName === move.name)
    || (hasVolatileStatus(pokemon, 'taunt') && move.damage_class === 'status')
    || (hasVolatileStatus(pokemon, 'torment') && pokemon.factoryLastUsedMoveName === move.name)
    || isMoveHealBlocked(pokemon, move)
    || (hasItemBattleEffect(pokemon.factoryHeldItemId, 'CHOICE_BAND')
      && pokemon.factoryChoiceLockedMoveName && pokemon.factoryChoiceLockedMoveName !== move.name)
  );
}

/** Selection uses the same imminent Mental Herb cure as before-move execution, without mutating state. */
export function resolveLegalMoves(pokemon: GamePokemon): { moves: Move[]; struggle: boolean } {
  const prepared = resolveMentalHerb(pokemon).pokemon;
  const uproar = getVolatileStatus(prepared, 'uproar')?.sourceMoveName;
  const forced = prepared.selectedMoves.find((move) => move.name === (uproar ?? 'uproar'));
  if (hasVolatileStatus(prepared, 'uproar') && forced) return { moves: [forced], struggle: false };
  const moves = prepared.selectedMoves.filter((move) => currentMovePp(move) > 0 && !isMoveRestricted(prepared, move));
  return moves.length ? { moves, struggle: false } : { moves: [STRUGGLE_MOVE], struggle: true };
}

export function struggleRecoil(pokemon: GamePokemon) {
  if (pokemon.abilities?.[0]?.ability?.name === 'magic-guard') return 0;
  return Math.max(1, Math.floor(pokemon.maxHp / STRUGGLE_RULES.recoilDenominator));
}
