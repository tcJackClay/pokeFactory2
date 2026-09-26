import type { FieldState, GamePokemon, Move, StatStages } from '../../../../types';
import { getMoveTypeMultiplier, getTypeEffectivenessMultiplierForTypes } from './resolveTypeEffectiveness';
import { setVolatileStatus } from '../../utils/battleStatus';
import { getResolvedBattleMoveType } from './resolveMoveType';

export interface TypeImmunityReactionResult {
  defender: GamePokemon;
  message: string | null;
}

function getAbilityName(pokemon: GamePokemon) {
  return (pokemon.abilities?.[0]?.ability?.name ?? '').trim().toLowerCase().replace(/_/g, '-');
}

function raiseStage(pokemon: GamePokemon, stat: keyof StatStages, amount: number) {
  return {
    ...pokemon,
    statStages: {
      ...pokemon.statStages,
      [stat]: Math.min(6, pokemon.statStages[stat] + amount),
    },
  };
}

export function resolveTypeImmunityReaction(
  move: Move,
  defender: GamePokemon,
  fieldState: FieldState[] = [],
  attacker?: GamePokemon,
): TypeImmunityReactionResult {
  if (getMoveTypeMultiplier(move, defender, attacker, fieldState) !== 0) {
    return { defender, message: null };
  }
  const moveType = getResolvedBattleMoveType(move, attacker);
  const ignoresFlyingImmunity = move.battleData?.effectId === 'THOUSAND_ARROWS' || fieldState.includes('gravity');
  const baseMultiplier = getTypeEffectivenessMultiplierForTypes(
    moveType,
    ignoresFlyingImmunity
      ? defender.types.filter((slot) => !(moveType === 'ground' && slot.type.name === 'flying'))
      : defender.types,
  );
  if (baseMultiplier === 0) return { defender, message: null };

  const ability = getAbilityName(defender);
  const healAbilities = new Set([
    'dry-skin',
    'earth-eater',
    'volt-absorb',
    'water-absorb',
  ]);
  const abilityMatchesMove = (
    ((ability === 'dry-skin' || ability === 'water-absorb') && moveType === 'water')
    || (ability === 'earth-eater' && moveType === 'ground')
    || (ability === 'volt-absorb' && moveType === 'electric')
    || ((ability === 'lightning-rod' || ability === 'motor-drive') && moveType === 'electric')
    || (ability === 'storm-drain' && moveType === 'water')
    || (ability === 'sap-sipper' && moveType === 'grass')
    || ((ability === 'flash-fire' || ability === 'well-baked-body') && moveType === 'fire')
  );
  if (!abilityMatchesMove) return { defender, message: null };

  if (healAbilities.has(ability)) {
    const heal = Math.max(0, Math.min(Math.floor(defender.maxHp / 4), defender.maxHp - defender.currentHp));
    return {
      defender: heal > 0 ? { ...defender, currentHp: defender.currentHp + heal } : defender,
      message: `${defender.name}'s ${ability} absorbed the attack${heal > 0 ? ' and restored HP' : ''}!`,
    };
  }
  if (ability === 'lightning-rod' || ability === 'storm-drain') {
    return {
      defender: raiseStage(defender, 'spAtk', 1),
      message: `${defender.name}'s ${ability} raised its Special Attack!`,
    };
  }
  if (ability === 'motor-drive') {
    return {
      defender: raiseStage(defender, 'speed', 1),
      message: `${defender.name}'s motor-drive raised its Speed!`,
    };
  }
  if (ability === 'sap-sipper') {
    return {
      defender: raiseStage(defender, 'attack', 1),
      message: `${defender.name}'s sap-sipper raised its Attack!`,
    };
  }
  if (ability === 'well-baked-body') {
    return {
      defender: raiseStage(defender, 'defense', 2),
      message: `${defender.name}'s well-baked-body sharply raised its Defense!`,
    };
  }
  if (ability === 'flash-fire') {
    return {
      defender: setVolatileStatus(defender, 'flash-fire'),
      message: `${defender.name}'s flash-fire was activated!`,
    };
  }
  return { defender, message: null };
}
