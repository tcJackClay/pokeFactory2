import type { GamePokemon, Move, Weather } from '../../../../types';
import { getItemAccuracyMultiplier, getMoveAccuracy } from '../../data/battle';
import { hasVolatileStatus } from '../../utils/battleStatus';
import { getAccuracyStageModifier } from './stageModifiers';

interface ResolveAccuracyOptions {
  move: Move;
  attacker: GamePokemon;
  defender: GamePokemon;
  weather?: Weather;
  random?: () => number;
}

function getPrimaryAbilityName(pokemon: GamePokemon) {
  return (pokemon.abilities?.[0]?.ability?.name ?? '').trim().toLowerCase().replace(/_/g, '-');
}

export function getResolvedMoveAccuracy(move: Move, attacker: GamePokemon, defender: GamePokemon, weather: Weather = 'none') {
  let moveAccuracy = getMoveAccuracy(move);
  if (moveAccuracy === null) return null;
  const attackerAbility = getPrimaryAbilityName(attacker);
  const rawDefenderAbility = getPrimaryAbilityName(defender);
  if (['air-lock', 'cloud-nine'].includes(attackerAbility) || ['air-lock', 'cloud-nine'].includes(rawDefenderAbility)) {
    weather = 'none';
  }
  const defenderAbility = ['mold-breaker', 'teravolt', 'turboblaze'].includes(attackerAbility)
    ? ''
    : rawDefenderAbility;
  if (attackerAbility === 'no-guard' || defenderAbility === 'no-guard') return null;
  if (
    move.name === 'toxic'
    && attacker.types.some((typeSlot) => typeSlot.type.name === 'poison')
  ) return null;
  if (move.name === 'blizzard' && weather === 'hail') return null;
  if (move.name === 'thunder') {
    if (weather === 'rainy') return null;
    if (weather === 'sunny') moveAccuracy = 50;
  }
  if ((move.name === 'stomp' || move.name === 'body-slam') && hasVolatileStatus(defender, 'minimized')) {
    return null;
  }
  if (move.battleData?.effectId === 'ONE_HIT_KO' || move.battleData?.effectId === 'SHEER_COLD') {
    if (attacker.level < defender.level) return 0;
    const baseAccuracy = move.battleData.effectId === 'SHEER_COLD'
      && !attacker.types.some((slot) => slot.type.name === 'ice')
      ? 20
      : 30;
    moveAccuracy = Math.min(100, Math.max(0, baseAccuracy + 100 * (1 - defender.level / attacker.level)));
  }

  const defenderEvasion = hasVolatileStatus(defender, 'foresight') ? 0 : defender.statStages.evasion;
  const combinedStage = Math.max(-6, Math.min(6, attacker.statStages.accuracy - defenderEvasion));
  const stageModifier = getAccuracyStageModifier(combinedStage);
  const defenderItemModifier = getItemAccuracyMultiplier(defender.factoryHeldItemId);
  const compoundEyesMultiplier = attackerAbility === 'compound-eyes' ? 1.3 : 1;
  const hustleMultiplier = attackerAbility === 'hustle' && move.damage_class === 'physical' ? 0.8 : 1;
  const tangledFeetMultiplier = defenderAbility === 'tangled-feet' && hasVolatileStatus(defender, 'confusion') ? 0.5 : 1;
  const weatherEvasionMultiplier = (
    (defenderAbility === 'sand-veil' && weather === 'sandstorm')
    || (defenderAbility === 'snow-cloak' && weather === 'hail')
  ) ? 0.8 : 1;
  return moveAccuracy
    * stageModifier
    * defenderItemModifier
    * compoundEyesMultiplier
    * hustleMultiplier
    * tangledFeetMultiplier
    * weatherEvasionMultiplier;
}

export function resolveAccuracy({
  move,
  attacker,
  defender,
  weather = 'none',
  random = Math.random,
}: ResolveAccuracyOptions) {
  const finalAccuracy = getResolvedMoveAccuracy(move, attacker, defender, weather);
  if (finalAccuracy === null) {
    return {
      didHit: true,
      finalAccuracy: null,
    };
  }

  return {
    didHit: Math.floor(Math.max(0, Math.min(0.999999999, random())) * 100) < finalAccuracy,
    finalAccuracy,
  };
}
