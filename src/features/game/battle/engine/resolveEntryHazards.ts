import type { BattleHazards, FieldState, GamePokemon, Weather } from '../../../../types';
import { hasAbilityBattleEffect, hasItemBattleEffect } from '../../data/battle';
import { getNonVolatileStatusId, getVolatileStatus, setNonVolatileStatus } from '../../utils/battleStatus';
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

export function resolveToxicSpikesUse(hazards: BattleHazards, actingSide: EngineBattleSide) {
  const targetSide = actingSide === 'player' ? 'enemy' : 'player';
  const currentLayers = hazards[targetSide].toxicSpikesLayers;
  if (currentLayers >= 2) return { succeeded: false, hazards };
  const layers = (currentLayers + 1) as 1 | 2;
  return {
    succeeded: true,
    hazards: { ...hazards, [targetSide]: { ...hazards[targetSide], toxicSpikesLayers: layers } },
  };
}

export type EntryHazardEvent = 'stealth-rock' | 'fainted' | 'toxic-spikes-absorbed' | 'poison' | 'bad-poison';

export function resolveEntryHazards(
  pokemon: GamePokemon,
  side: EngineBattleSide,
  hazards: BattleHazards,
  fieldState: FieldState[] = [],
  weather: Weather = 'none',
) {
  let entrant = pokemon;
  let nextHazards = hazards;
  let damage = 0;
  const events: EntryHazardEvent[] = [];
  if (entrant.currentHp <= 0) return { pokemon: entrant, hazards: nextHazards, damage, fainted: true, events };

  const ability = (entrant.abilities?.[0]?.ability?.name ?? '').trim().toLowerCase().replace(/_/g, '-');
  const hasType = (type: string) => entrant.types.some((slot) => slot.type.name === type);
  const boots = hasItemBattleEffect(entrant.factoryHeldItemId, 'HEAVY_DUTY_BOOTS');
  if (hazards[side].stealthRock && !boots && !hasAbilityBattleEffect(ability, 'MAGIC_GUARD')) {
    const multiplier = getTypeEffectivenessMultiplierForTypes('rock', entrant.types);
    if (multiplier > 0) {
      const rawDamage = Math.max(1, Math.floor(entrant.maxHp * multiplier / 8));
      const currentHp = Math.max(0, entrant.currentHp - rawDamage);
      damage = entrant.currentHp - currentHp;
      entrant = { ...entrant, currentHp };
      if (damage > 0) events.push('stealth-rock');
      if (currentHp <= 0) {
        events.push('fainted');
        return { pokemon: entrant, hazards: nextHazards, damage, fainted: true, events };
      }
    }
  }

  const layers = hazards[side].toxicSpikesLayers;
  const grounded = fieldState.includes('gravity') || (!hasType('flying') && ability !== 'levitate' && ability !== 'eelevate');
  if (layers > 0 && grounded) {
    if (hasType('poison')) {
      nextHazards = { ...hazards, [side]: { ...hazards[side], toxicSpikesLayers: 0 } };
      events.push('toxic-spikes-absorbed');
    } else if (
      !boots
      && !hasType('steel')
      && !getNonVolatileStatusId(entrant)
      && !getVolatileStatus(entrant, 'safeguard')
      && !fieldState.includes('misty_terrain')
      && !hasAbilityBattleEffect(ability, 'POISON_IMMUNITY')
      && !hasAbilityBattleEffect(ability, 'PURIFYING_SALT')
      && !hasAbilityBattleEffect(ability, 'COMATOSE')
      && !(hasAbilityBattleEffect(ability, 'LEAF_GUARD') && weather === 'sunny')
      && ability !== 'pastel-veil'
    ) {
      const status = layers === 2 ? 'bad_poison' : 'poison';
      entrant = setNonVolatileStatus(entrant, status);
      events.push(status === 'poison' ? 'poison' : 'bad-poison');
    }
  }

  return { pokemon: entrant, hazards: nextHazards, damage, fainted: false, events };
}
