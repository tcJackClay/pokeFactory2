import type { FieldState, GamePokemon, Move, Pokemon } from '../../../../types';
import { TYPE_CHART } from '../../../../constants';
import { hasAbilityBattleEffect } from '../../data/battle';
import { hasVolatileStatus } from '../../utils/battleStatus';
import { getResolvedBattleMoveType } from './resolveMoveType';

type PokemonTypeSlots = Pokemon['types'];

function getTypeSlots(pokemon: GamePokemon): PokemonTypeSlots {
  return pokemon.types;
}

export function getTypeEffectivenessMultiplierForTypes(moveType: string, defenderTypes: PokemonTypeSlots) {
  let multiplier = 1;
  defenderTypes.forEach((typeSlot) => {
    const typeMultiplier = TYPE_CHART[moveType]?.[typeSlot.type.name];
    if (typeMultiplier !== undefined) {
      multiplier *= typeMultiplier;
    }
  });
  return multiplier;
}

function getPrimaryAbilityName(pokemon: GamePokemon | null | undefined) {
  return pokemon?.abilities?.[0]?.ability?.name;
}

function getTypeMultiplierAgainstDefender(
  moveType: string,
  defender: GamePokemon,
  ignoreFlyingImmunity: boolean,
) {
  let multiplier = 1;
  for (const typeSlot of getTypeSlots(defender)) {
    const defenderType = typeSlot.type.name;
    if (ignoreFlyingImmunity && moveType === 'ground' && defenderType === 'flying') continue;
    const typeMultiplier = TYPE_CHART[moveType]?.[defenderType];
    multiplier *= typeMultiplier ?? 1;
  }
  return multiplier;
}

export function getMoveTypeMultiplier(
  move: Move,
  defender: GamePokemon,
  attacker?: GamePokemon,
  fieldState: FieldState[] = [],
) {
  const effectId = move.battleData?.effectId;
  const moveType = getResolvedBattleMoveType(move, attacker);
  if (effectId === 'SHEER_COLD' && defender.types.some((slot) => slot.type.name === 'ice')) {
    return 0;
  }
  if (moveType === 'stellar') {
    return defender.specialBoostActive && defender.specialBoostMode === 'TERA' ? 2 : 1;
  }

  const isGroundingHit = effectId === 'THOUSAND_ARROWS' || fieldState.includes('gravity');
  let multiplier = getTypeMultiplierAgainstDefender(moveType, defender, isGroundingHit);

  if (effectId === 'FREEZE_DRY' && defender.types.some((slot) => slot.type.name === 'water')) {
    const ordinaryWaterMultiplier = TYPE_CHART[moveType]?.water ?? 1;
    multiplier = (multiplier / ordinaryWaterMultiplier) * 2;
  }
  if (effectId === 'FLYING_PRESS') {
    multiplier *= getTypeMultiplierAgainstDefender('flying', defender, false);
  }

  const defenderAbility = getPrimaryAbilityName(defender);
  const attackerAbility = getPrimaryAbilityName(attacker);
  const ignoresDefenderAbility = ['mold-breaker', 'teravolt', 'turboblaze'].includes(
    (attackerAbility ?? '').trim().toLowerCase().replace(/_/g, '-'),
  );
  if (
    multiplier === 0
    && (hasAbilityBattleEffect(attackerAbility, 'SCRAPPY') || hasVolatileStatus(defender, 'foresight'))
    && (moveType === 'normal' || moveType === 'fighting')
    && defender.types.some((slot) => slot.type.name === 'ghost')
  ) {
    multiplier = getTypeMultiplierAgainstDefender(
      moveType,
      { ...defender, types: defender.types.filter((slot) => slot.type.name !== 'ghost') },
      isGroundingHit,
    );
  }

  const abilityImmunity = (
    (moveType === 'electric' && hasAbilityBattleEffect(defenderAbility, 'ELECTRIC_IMMUNITY'))
    || (moveType === 'water' && hasAbilityBattleEffect(defenderAbility, 'WATER_IMMUNITY'))
    || (moveType === 'fire' && hasAbilityBattleEffect(defenderAbility, 'FIRE_IMMUNITY'))
    || (moveType === 'grass' && hasAbilityBattleEffect(defenderAbility, 'GRASS_IMMUNITY'))
    || (
      moveType === 'ground'
      && !isGroundingHit
      && hasAbilityBattleEffect(defenderAbility, 'GROUND_IMMUNITY')
    )
    || (move.battleData?.soundMove && hasAbilityBattleEffect(defenderAbility, 'SOUNDPROOF'))
  );
  if (!ignoresDefenderAbility && abilityImmunity) return 0;
  if (!ignoresDefenderAbility && hasAbilityBattleEffect(defenderAbility, 'WONDER_GUARD') && multiplier < 2) return 0;
  return multiplier;
}
