import type { GamePokemon } from '../../../../types';
import { hasAbilityBattleEffect, hasItemBattleEffect, getItemEndTurnHealDenominator } from '../../data/battle';
import {
  applyStatusResidualDamage,
  applyCurseResidualDamage,
  applyNightmareResidualDamage,
  applyWeatherChipDamage,
  resolveYawnEndTurn,
} from '../../lib/battleResolution';
import { clearNonVolatileStatus, clearVolatileStatus, getNonVolatileStatusId, getVolatileStatus, hasVolatileStatus, setVolatileStatus } from '../../utils/battleStatus';
import type { LocalizeFn } from '../../view-model';
import type { BattleSnapshot, EndTurnResolutionResult } from './types';

const UPROAR_TURNS_GEN5_PLUS = 3;

interface ResolveEndTurnOptions {
  snapshot: BattleSnapshot;
  getLocalized: LocalizeFn;
  formatDynamaxEndMessage: (pokemon: GamePokemon) => string;
  getMoveCurrentPp: (move: { currentPp?: number; pp?: number }) => number;
  tryActivateSitrusBerry: (pokemon: GamePokemon | null | undefined) => { pokemon: GamePokemon | null | undefined; message: string | null };
  tryActivatePinchStatBerry: (pokemon: GamePokemon | null | undefined) => { pokemon: GamePokemon | null | undefined; message: string | null };
}

export function resolveEndTurn({
  snapshot,
  getLocalized,
  formatDynamaxEndMessage,
  getMoveCurrentPp,
  tryActivateSitrusBerry,
  tryActivatePinchStatBerry,
}: ResolveEndTurnOptions): EndTurnResolutionResult {
  let nextSnapshot: BattleSnapshot = {
    ...snapshot,
    playerTeam: [...snapshot.playerTeam],
    enemyTeam: [...snapshot.enemyTeam],
    fieldState: [...snapshot.fieldState],
    fieldTurns: { ...snapshot.fieldTurns },
  };
  let playerLead = nextSnapshot.playerTeam[0];
  let enemyLead = nextSnapshot.enemyTeam[0];
  const events: EndTurnResolutionResult['events'] = [];

  const syncPlayerLead = (pokemon: GamePokemon) => {
    playerLead = pokemon;
    nextSnapshot.playerTeam[0] = pokemon;
  };
  const syncEnemyLead = (pokemon: GamePokemon) => {
    enemyLead = pokemon;
    nextSnapshot.enemyTeam[0] = pokemon;
  };

  const resolveDynamaxExpiry = (pokemon: GamePokemon) => {
    if (pokemon?.specialBoostMode !== 'DYNAMAX' || !pokemon.specialBoostActive) return pokemon;
    const turnsLeft = (pokemon.dynamaxTurnsLeft ?? 0) - 1;
    if (turnsLeft > 0) {
      return { ...pokemon, dynamaxTurnsLeft: turnsLeft };
    }

    const revertedStats = {
      hp: pokemon.calculatedStats.hp,
      attack: Math.max(1, Math.floor(pokemon.calculatedStats.attack / 1.2)),
      defense: Math.max(1, Math.floor(pokemon.calculatedStats.defense / 1.2)),
      spAtk: Math.max(1, Math.floor(pokemon.calculatedStats.spAtk / 1.2)),
      spDef: Math.max(1, Math.floor(pokemon.calculatedStats.spDef / 1.2)),
      speed: Math.max(1, Math.floor(pokemon.calculatedStats.speed / 1.05)),
    };
    const revertedMaxHp = Math.max(1, Math.floor(pokemon.maxHp / 1.35));
    const revertedHp = Math.max(1, Math.min(revertedMaxHp, Math.floor(pokemon.currentHp / 1.35)));
    const reverted = {
      ...pokemon,
      calculatedStats: revertedStats,
      maxHp: revertedMaxHp,
      currentHp: revertedHp,
      specialBoostActive: false,
      specialBoostMode: undefined,
      dynamaxTurnsLeft: undefined,
    };
    events.push({ type: 'message', message: formatDynamaxEndMessage(reverted) });
    return reverted;
  };

  syncPlayerLead(resolveDynamaxExpiry(playerLead));
  syncEnemyLead(resolveDynamaxExpiry(enemyLead));

  const applyResidual = (
    pokemon: GamePokemon,
    applyFn: (pokemon: GamePokemon, getLocalized: LocalizeFn) => { pokemon: GamePokemon; messages: string[]; fainted?: boolean },
  ) => {
    const result = applyFn(pokemon, getLocalized);
    result.messages.forEach((message) => events.push({ type: 'message', message }));
    return result.pokemon;
  };

  syncPlayerLead(applyResidual(playerLead, applyStatusResidualDamage));
  syncEnemyLead(applyResidual(enemyLead, applyStatusResidualDamage));
  syncPlayerLead(applyResidual(playerLead, applyNightmareResidualDamage));
  syncPlayerLead(applyResidual(playerLead, applyCurseResidualDamage));
  syncEnemyLead(applyResidual(enemyLead, applyNightmareResidualDamage));
  syncEnemyLead(applyResidual(enemyLead, applyCurseResidualDamage));

  if (hasVolatileStatus(playerLead, 'protect')) syncPlayerLead(clearVolatileStatus(playerLead, 'protect'));
  if (hasVolatileStatus(enemyLead, 'protect')) syncEnemyLead(clearVolatileStatus(enemyLead, 'protect'));

  const resolveTimedStatus = (
    pokemon: GamePokemon,
    statusId: 'taunt' | 'torment' | 'encore' | 'disable',
  ) => {
    const state = getVolatileStatus(pokemon, statusId);
    if (!state) return pokemon;

    const turnsRemaining = Math.max(0, state.turnsRemaining ?? 0);
    if (statusId === 'encore') {
      const linkedMove = state.linkedMoveName
        ? pokemon.selectedMoves.find((candidate) => candidate.name === state.linkedMoveName)
        : null;
      if (!linkedMove) return clearVolatileStatus(pokemon, 'encore');
      if (turnsRemaining > 1 && getMoveCurrentPp(linkedMove) > 0) {
        return setVolatileStatus(pokemon, 'encore', {
          turnsRemaining: turnsRemaining - 1,
          linkedMoveName: state.linkedMoveName,
          sourceMoveName: state.sourceMoveName,
        });
      }
      const clearedPokemon = clearVolatileStatus(pokemon, 'encore');
      events.push({ type: 'message', message: `${getLocalized(clearedPokemon)}'s Encore ended.` });
      return clearedPokemon;
    }

    if (statusId === 'disable') {
      const linkedMove = state.linkedMoveName
        ? pokemon.selectedMoves.find((candidate) => candidate.name === state.linkedMoveName)
        : null;
      if (!linkedMove) return clearVolatileStatus(pokemon, 'disable');
      if (turnsRemaining > 1) {
        return setVolatileStatus(pokemon, 'disable', {
          turnsRemaining: turnsRemaining - 1,
          linkedMoveName: state.linkedMoveName,
          sourceMoveName: state.sourceMoveName,
        });
      }
      const clearedPokemon = clearVolatileStatus(pokemon, 'disable');
      events.push({ type: 'message', message: `${getLocalized(clearedPokemon)} is no longer disabled.` });
      return clearedPokemon;
    }

    if (turnsRemaining > 1) {
      return setVolatileStatus(pokemon, statusId, {
        turnsRemaining: turnsRemaining - 1,
        sourceMoveName: state.sourceMoveName,
      });
    }

    const clearedPokemon = clearVolatileStatus(pokemon, statusId);
    if (statusId === 'taunt') {
      events.push({ type: 'message', message: `${getLocalized(clearedPokemon)} shook off the taunt.` });
    } else if (statusId === 'torment') {
      events.push({ type: 'message', message: `${getLocalized(clearedPokemon)} is no longer tormented.` });
    }
    return clearedPokemon;
  };

  syncPlayerLead(resolveTimedStatus(resolveTimedStatus(resolveTimedStatus(resolveTimedStatus(playerLead, 'taunt'), 'torment'), 'encore'), 'disable'));
  syncEnemyLead(resolveTimedStatus(resolveTimedStatus(resolveTimedStatus(resolveTimedStatus(enemyLead, 'taunt'), 'torment'), 'encore'), 'disable'));

  const playerYawnResult = resolveYawnEndTurn({
    pokemon: playerLead,
    playerTeam: nextSnapshot.playerTeam,
    enemyTeam: nextSnapshot.enemyTeam,
    fieldState: nextSnapshot.fieldState,
    getLocalized,
  });
  playerYawnResult.messages.forEach((message) => events.push({ type: 'message', message }));
  syncPlayerLead(playerYawnResult.pokemon);

  const enemyYawnResult = resolveYawnEndTurn({
    pokemon: enemyLead,
    playerTeam: nextSnapshot.playerTeam,
    enemyTeam: nextSnapshot.enemyTeam,
    fieldState: nextSnapshot.fieldState,
    getLocalized,
  });
  enemyYawnResult.messages.forEach((message) => events.push({ type: 'message', message }));
  syncEnemyLead(enemyYawnResult.pokemon);

  const wakeFromUproar = (pokemon: GamePokemon) => {
    if (getNonVolatileStatusId(pokemon) !== 'sleep' || hasAbilityBattleEffect(pokemon?.abilities?.[0]?.ability?.name, 'SOUNDPROOF')) {
      return pokemon;
    }
    const awakened = clearVolatileStatus(clearNonVolatileStatus(pokemon), 'nightmare');
    events.push({ type: 'message', message: `${getLocalized(awakened)} woke up in the uproar!` });
    return awakened;
  };

  const resolveUproar = (pokemon: GamePokemon) => {
    const uproarState = getVolatileStatus(pokemon, 'uproar');
    if (!uproarState) return pokemon;

    syncPlayerLead(wakeFromUproar(playerLead));
    syncEnemyLead(wakeFromUproar(enemyLead));

    const turnsRemaining = Math.max(0, uproarState.turnsRemaining ?? UPROAR_TURNS_GEN5_PLUS);
    if (turnsRemaining > 1 && pokemon.currentHp > 0) {
      const continued = setVolatileStatus(pokemon, 'uproar', {
        turnsRemaining: turnsRemaining - 1,
        linkedMoveName: 'uproar',
      });
      events.push({ type: 'message', message: `${getLocalized(continued)} is making an uproar!` });
      return continued;
    }

    const ended = clearVolatileStatus(pokemon, 'uproar');
    events.push({ type: 'message', message: `${getLocalized(ended)} calmed down.` });
    return ended;
  };

  syncPlayerLead(resolveUproar(playerLead));
  syncEnemyLead(resolveUproar(enemyLead));

  if (nextSnapshot.weather !== 'none') {
    const playerWeatherResult = applyWeatherChipDamage({ pokemon: playerLead, weather: nextSnapshot.weather, getLocalized });
    playerWeatherResult.messages.forEach((message) => events.push({ type: 'message', message }));
    syncPlayerLead(playerWeatherResult.pokemon);

    const enemyWeatherResult = applyWeatherChipDamage({ pokemon: enemyLead, weather: nextSnapshot.weather, getLocalized });
    enemyWeatherResult.messages.forEach((message) => events.push({ type: 'message', message }));
    syncEnemyLead(enemyWeatherResult.pokemon);
  }

  const playerSitrusResult = tryActivateSitrusBerry(playerLead);
  if (playerSitrusResult.message && playerSitrusResult.pokemon) {
    syncPlayerLead(playerSitrusResult.pokemon);
    events.push({ type: 'message', message: playerSitrusResult.message });
  }
  const playerPinchResult = tryActivatePinchStatBerry(playerLead);
  if (playerPinchResult.message && playerPinchResult.pokemon) {
    syncPlayerLead(playerPinchResult.pokemon);
    events.push({ type: 'message', message: playerPinchResult.message });
  }
  const enemySitrusResult = tryActivateSitrusBerry(enemyLead);
  if (enemySitrusResult.message && enemySitrusResult.pokemon) {
    syncEnemyLead(enemySitrusResult.pokemon);
    events.push({ type: 'message', message: enemySitrusResult.message });
  }
  const enemyPinchResult = tryActivatePinchStatBerry(enemyLead);
  if (enemyPinchResult.message && enemyPinchResult.pokemon) {
    syncEnemyLead(enemyPinchResult.pokemon);
    events.push({ type: 'message', message: enemyPinchResult.message });
  }

  const applyLeftoversRecovery = (pokemon: GamePokemon) => {
    if (pokemon.currentHp <= 0) return { pokemon, message: null as string | null };
    const healDenominator = getItemEndTurnHealDenominator(pokemon.factoryHeldItemId);
        if (!hasItemBattleEffect(pokemon.factoryHeldItemId, 'LEFTOVERS') || !healDenominator) {
      return { pokemon, message: null as string | null };
    }
    const maxRecover = Math.floor(pokemon.maxHp / healDenominator);
    const recover = Math.max(1, Math.min(maxRecover, pokemon.maxHp - pokemon.currentHp));
    if (recover <= 0) return { pokemon, message: null as string | null };
    const nextPokemon = { ...pokemon, currentHp: Math.min(pokemon.maxHp, pokemon.currentHp + recover) };
    return {
      pokemon: nextPokemon,
      message: `${getLocalized(nextPokemon)} restored HP with Leftovers!`,
    };
  };

  const playerLeftoversResult = applyLeftoversRecovery(playerLead);
  if (playerLeftoversResult.message) {
    syncPlayerLead(playerLeftoversResult.pokemon);
    events.push({ type: 'message', message: playerLeftoversResult.message });
  }
  const enemyLeftoversResult = applyLeftoversRecovery(enemyLead);
  if (enemyLeftoversResult.message) {
    syncEnemyLead(enemyLeftoversResult.pokemon);
    events.push({ type: 'message', message: enemyLeftoversResult.message });
  }

  if (nextSnapshot.weather !== 'none' && nextSnapshot.weatherTurns > 0) {
    const nextTurns = nextSnapshot.weatherTurns - 1;
    if (nextTurns <= 0) {
      nextSnapshot.weather = 'none';
      nextSnapshot.weatherTurns = 0;
    } else {
      nextSnapshot.weatherTurns = nextTurns;
    }
  }

  if (nextSnapshot.fieldState.length > 0) {
    const nextFieldTurns = { ...nextSnapshot.fieldTurns };
    const remainingFieldState = [] as typeof nextSnapshot.fieldState;

    for (const state of nextSnapshot.fieldState) {
      const currentTurns = nextSnapshot.fieldTurns[state] ?? 0;
      if (currentTurns <= 0) continue;
      const nextTurns = currentTurns - 1;
      if (nextTurns > 0) {
        nextFieldTurns[state] = nextTurns;
        remainingFieldState.push(state);
      } else {
        delete nextFieldTurns[state];
      }
    }

    nextSnapshot.fieldState = remainingFieldState;
    nextSnapshot.fieldTurns = nextFieldTurns;
  }

  return {
    snapshot: nextSnapshot,
    events,
    playerLead,
    enemyLead,
    playerLeadFainted: playerLead.currentHp <= 0,
    enemyLeadFainted: enemyLead.currentHp <= 0,
  };
}
