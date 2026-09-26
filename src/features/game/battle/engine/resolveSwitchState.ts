import type { GamePokemon } from '../../../../types';
import { hasAbilityBattleEffect } from '../../data/battle';
import { clearNonVolatileStatus, clearVolatileStatuses, getNonVolatileStatusId, setNonVolatileStatus } from '../../utils/battleStatus';

export function clearSwitchingBattleState(pokemon: GamePokemon) {
  const persistentTeamStatuses = Object.fromEntries(
    ['safeguard', 'reflect', 'light_screen']
      .map((statusId) => [statusId, pokemon.volatileStatuses?.[statusId]] as const)
      .filter((entry) => entry[1]?.active),
  );
  let clearedPokemon = clearVolatileStatuses(pokemon);
  if (Object.keys(persistentTeamStatuses).length > 0) {
    clearedPokemon = {
      ...clearedPokemon,
      volatileStatuses: persistentTeamStatuses,
    };
  }
  if (getNonVolatileStatusId(clearedPokemon) === 'bad_poison') {
    clearedPokemon = setNonVolatileStatus(clearedPokemon, 'bad_poison', {
      toxicCounter: 1,
      sourceMoveName: clearedPokemon.nonVolatileStatus?.sourceMoveName,
    });
  }
  const statusId = getNonVolatileStatusId(clearedPokemon);
  const abilityName = clearedPokemon?.abilities?.[0]?.ability?.name;
  const abilityCuresStatus = (
    hasAbilityBattleEffect(abilityName, 'NATURAL_CURE')
    || hasAbilityBattleEffect(abilityName, 'PURIFYING_SALT')
    || hasAbilityBattleEffect(abilityName, 'COMATOSE')
    || (statusId === 'paralysis' && hasAbilityBattleEffect(abilityName, 'PARALYSIS_IMMUNITY'))
    || ((statusId === 'poison' || statusId === 'bad_poison') && hasAbilityBattleEffect(abilityName, 'POISON_IMMUNITY'))
    || (statusId === 'freeze' && hasAbilityBattleEffect(abilityName, 'FREEZE_IMMUNITY'))
    || (statusId === 'burn' && hasAbilityBattleEffect(abilityName, 'BURN_IMMUNITY'))
    || (statusId === 'sleep' && (
      hasAbilityBattleEffect(abilityName, 'INSOMNIA')
      || hasAbilityBattleEffect(abilityName, 'VITAL_SPIRIT')
    ))
  );
  if (abilityCuresStatus) {
    clearedPokemon = clearNonVolatileStatus(clearedPokemon);
  }
  return {
    ...clearedPokemon,
    factoryChoiceLockedMoveName: null,
    factoryLastUsedMoveName: null,
    factoryConsecutiveMoveCount: 0,
    factoryLastDamageReceived: 0,
    factoryLastDamageCategory: undefined,
    factoryDamagedThisTurn: false,
    factoryStockpileCount: 0,
  };
}
