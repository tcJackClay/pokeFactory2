import type { GamePokemon, Move } from '../../../../types';

const HIDDEN_POWER_TYPES = [
  'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
  'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark',
] as const;

export function getResolvedBattleMoveType(move: Move, attacker?: GamePokemon) {
  if (move.battleData?.effectId !== 'HIDDEN_POWER' || !attacker) return move.type;
  const ivValue = Math.floor((
    ((attacker.ivs.hp & 1)
      + (attacker.ivs.attack & 1) * 2
      + (attacker.ivs.defense & 1) * 4
      + (attacker.ivs.speed & 1) * 8
      + (attacker.ivs.spAtk & 1) * 16
      + (attacker.ivs.spDef & 1) * 32)
    * 15
  ) / 63);
  return HIDDEN_POWER_TYPES[ivValue] ?? move.type;
}

export function resolveBattleMoveType(move: Move, attacker?: GamePokemon): Move {
  const type = getResolvedBattleMoveType(move, attacker);
  return type === move.type ? move : { ...move, type };
}
