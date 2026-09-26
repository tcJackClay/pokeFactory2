import type { BattleHazards, GamePokemon } from '../../../../types';
import { hasAbilityBattleEffect, hasItemBattleEffect } from '../../data/battle';
import { getTypeEffectivenessMultiplierForTypes } from './resolveTypeEffectiveness';
import type { EngineBattleSide } from './types';

export function createEmptyBattleHazards(): BattleHazards {
  return {
    player: { stealthRock: false, toxicSpikesLayers: 0 },
    enemy: { stealthRock: false, toxicSpikesLayers: 0 },
  };
}

export function resolveStealthRockUse(hazards: BattleHazards, actingSide: EngineBattleSide) {
  const targetSide = actingSide === 'player' ? 'enemy' : 'player';
  if (hazards[targetSide].stealthRock) return { succeeded: false, hazards };
  return {
    succeeded: true,
    hazards: {
      ...hazards,
      [targetSide]: { ...hazards[targetSide], stealthRock: true },
    },
  };
}

export function resolveEntryHazards(pokemon: GamePokemon, side: EngineBattleSide, hazards: BattleHazards) {
  if (pokemon.currentHp <= 0 || !hazards[side].stealthRock) {
    return { pokemon, damage: 0, fainted: false };
  }
  if (
    hasAbilityBattleEffect(pokemon.abilities?.[0]?.ability?.name, 'MAGIC_GUARD')
    || hasItemBattleEffect(pokemon.factoryHeldItemId, 'HEAVY_DUTY_BOOTS')
  ) {
    return { pokemon, damage: 0, fainted: false };
  }

  const multiplier = getTypeEffectivenessMultiplierForTypes('rock', pokemon.types);
  if (multiplier <= 0) return { pokemon, damage: 0, fainted: false };
  const rawDamage = Math.max(1, Math.floor(pokemon.maxHp * multiplier / 8));
  const currentHp = Math.max(0, pokemon.currentHp - rawDamage);
  return {
    pokemon: { ...pokemon, currentHp },
    damage: pokemon.currentHp - currentHp,
    fainted: currentHp <= 0,
  };
}
