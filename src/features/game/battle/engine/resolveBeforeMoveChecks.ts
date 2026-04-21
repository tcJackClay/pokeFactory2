import type { GamePokemon, Move } from '../../../../types';
import { clearNonVolatileStatus, clearVolatileStatus, getNonVolatileStatusId, getVolatileStatus, hasVolatileStatus, setNonVolatileStatus, setVolatileStatus } from '../../utils/battleStatus';
import type { BattleSnapshot, BeforeMoveCheckResult, EngineBattleSide } from './types';

interface ResolveBeforeMoveChecksOptions {
  snapshot: BattleSnapshot;
  side: EngineBattleSide;
  combatant: GamePokemon;
  move?: Move;
  displayName: string;
  hasAbilityEffect: (pokemon: GamePokemon | null | undefined, effectId: string) => boolean;
  isMoveUsableWhileAsleep: (move?: Move | null) => boolean;
  getEncoredMove: (pokemon: GamePokemon | null | undefined) => Move | null;
  getMoveCurrentPp: (move: Move) => number;
  tryConsumeStatusCureBerry: (pokemon: GamePokemon | null | undefined) => { pokemon: GamePokemon | null | undefined; message: string | null };
  tryConsumeMentalHerb: (pokemon: GamePokemon | null | undefined) => { pokemon: GamePokemon | null | undefined; message: string | null };
  calculateConfusionSelfHitDamage: (pokemon: GamePokemon) => number;
  random?: () => number;
}

function replaceLead(snapshot: BattleSnapshot, side: EngineBattleSide, pokemon: GamePokemon) {
  const nextSnapshot: BattleSnapshot = {
    ...snapshot,
    playerTeam: [...snapshot.playerTeam],
    enemyTeam: [...snapshot.enemyTeam],
  };
  if (side === 'player') {
    nextSnapshot.playerTeam[0] = pokemon;
  } else {
    nextSnapshot.enemyTeam[0] = pokemon;
  }
  return nextSnapshot;
}

export function resolveBeforeMoveChecks({
  snapshot,
  side,
  combatant,
  move,
  displayName,
  hasAbilityEffect,
  isMoveUsableWhileAsleep,
  getEncoredMove,
  getMoveCurrentPp,
  tryConsumeStatusCureBerry,
  tryConsumeMentalHerb,
  calculateConfusionSelfHitDamage,
  random = Math.random,
}: ResolveBeforeMoveChecksOptions): BeforeMoveCheckResult {
  let nextSnapshot = {
    ...snapshot,
    playerTeam: [...snapshot.playerTeam],
    enemyTeam: [...snapshot.enemyTeam],
  };
  let nextCombatant = combatant;
  const events: BeforeMoveCheckResult['events'] = [];
  const activePlayerLead = nextSnapshot.playerTeam[0];
  const activeEnemyLead = nextSnapshot.enemyTeam[0];
  const activeUproarSource = [activePlayerLead, activeEnemyLead]
    .find((pokemon) => pokemon && hasVolatileStatus(pokemon, 'uproar'));

  const syncCombatant = (pokemon: GamePokemon) => {
    nextCombatant = pokemon;
    nextSnapshot = replaceLead(nextSnapshot, side, pokemon);
  };

  if (
    getNonVolatileStatusId(nextCombatant) === 'sleep'
    && activeUproarSource
    && !hasAbilityEffect(nextCombatant, 'SOUNDPROOF')
  ) {
    syncCombatant(clearVolatileStatus(clearNonVolatileStatus(nextCombatant), 'nightmare'));
    events.push({ type: 'message', message: `${displayName} woke up in the uproar!` });
  }

  const statusBerryResult = tryConsumeStatusCureBerry(nextCombatant);
  if (statusBerryResult.message && statusBerryResult.pokemon) {
    syncCombatant(statusBerryResult.pokemon);
    events.push({ type: 'message', message: statusBerryResult.message });
  }

  const mentalHerbResult = tryConsumeMentalHerb(nextCombatant);
  if (mentalHerbResult.message && mentalHerbResult.pokemon) {
    syncCombatant(mentalHerbResult.pokemon);
    events.push({ type: 'message', message: mentalHerbResult.message });
  }

  if (getNonVolatileStatusId(nextCombatant) === 'sleep') {
    const sleepTurnsRemaining = Math.max(0, nextCombatant.nonVolatileStatus?.turnsRemaining ?? 0);
    const sleepTurnsToSubtract = hasAbilityEffect(nextCombatant, 'EARLY_BIRD') ? 2 : 1;

    if (sleepTurnsRemaining > sleepTurnsToSubtract) {
      syncCombatant(setNonVolatileStatus(nextCombatant, 'sleep', {
        turnsRemaining: sleepTurnsRemaining - sleepTurnsToSubtract,
        sourceMoveName: nextCombatant.nonVolatileStatus?.sourceMoveName,
      }));
      events.push({ type: 'message', message: `${displayName} is fast asleep...` });
      if (!isMoveUsableWhileAsleep(move)) {
        return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
      }
    } else {
      syncCombatant(clearVolatileStatus(clearNonVolatileStatus(nextCombatant), 'nightmare'));
      events.push({ type: 'message', message: `${displayName} woke up!` });
    }
  }

  if (getNonVolatileStatusId(nextCombatant) === 'freeze') {
    events.push({ type: 'message', message: `${displayName} is frozen solid...` });
    if (random() < 0.2) {
      syncCombatant(clearNonVolatileStatus(nextCombatant));
      events.push({ type: 'message', message: `${displayName} thawed out!` });
    } else {
      return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
    }
  }

  if (hasVolatileStatus(nextCombatant, 'flinch')) {
    syncCombatant(clearVolatileStatus(nextCombatant, 'flinch'));
    events.push({ type: 'message', message: `${displayName} flinched and couldn't move!` });
    return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
  }

  const encoredMove = getEncoredMove(nextCombatant);
  if (hasVolatileStatus(nextCombatant, 'encore')) {
    if (!encoredMove || getMoveCurrentPp(encoredMove) <= 0) {
      syncCombatant(clearVolatileStatus(nextCombatant, 'encore'));
    } else if (move && move.name !== encoredMove.name) {
      events.push({ type: 'message', message: `${displayName} must use ${encoredMove.name} due to Encore!` });
      return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
    }
  }

  const disabledMoveName = getVolatileStatus(nextCombatant, 'disable')?.linkedMoveName;
  if (move && disabledMoveName && move.name === disabledMoveName) {
    events.push({ type: 'message', message: `${displayName}'s ${disabledMoveName} is disabled!` });
    return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
  }

  if (move && hasVolatileStatus(nextCombatant, 'taunt') && move.damage_class === 'status') {
    events.push({ type: 'message', message: `${displayName} can't use status moves due to Taunt!` });
    return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
  }

  if (
    move
    && hasVolatileStatus(nextCombatant, 'torment')
    && nextCombatant.factoryLastUsedMoveName
    && nextCombatant.factoryLastUsedMoveName === move.name
  ) {
    events.push({ type: 'message', message: `${displayName} can't use ${move.name} twice in a row due to Torment!` });
    return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
  }

  const confusionState = getVolatileStatus(nextCombatant, 'confusion');
  if (confusionState) {
    const confusionTurnsRemaining = Math.max(0, confusionState.turnsRemaining ?? 0);
    if (confusionTurnsRemaining > 1) {
      syncCombatant(setVolatileStatus(nextCombatant, 'confusion', {
        turnsRemaining: confusionTurnsRemaining - 1,
        sourceMoveName: confusionState.sourceMoveName,
      }));
      events.push({ type: 'message', message: `${displayName} is confused!` });

      if (random() < 0.5) {
        const selfHitDamage = Math.min(nextCombatant.currentHp, calculateConfusionSelfHitDamage(nextCombatant));
        syncCombatant({
          ...nextCombatant,
          currentHp: Math.max(0, nextCombatant.currentHp - selfHitDamage),
        });
        events.push({ type: 'message', message: `${displayName} hurt itself in its confusion!` });
        events.push({ type: 'hp-change', displayName, amount: -selfHitDamage });
        return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
      }
    } else {
      syncCombatant(clearVolatileStatus(nextCombatant, 'confusion'));
      events.push({ type: 'message', message: `${displayName} snapped out of confusion!` });
    }
  }

  if (getNonVolatileStatusId(nextCombatant) === 'paralysis' && random() < 0.25) {
    events.push({ type: 'message', message: `${displayName} is paralyzed and cannot move!` });
    return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
  }

  const activeOpposingCombatant = side === 'enemy' ? activePlayerLead : activeEnemyLead;
  const infatuationState = getVolatileStatus(nextCombatant, 'infatuation') ?? getVolatileStatus(nextCombatant, 'attract');
  if (infatuationState) {
    if (!activeOpposingCombatant || infatuationState.linkedPokemonId !== activeOpposingCombatant.id) {
      syncCombatant(clearVolatileStatus(clearVolatileStatus(nextCombatant, 'infatuation'), 'attract'));
    } else {
      events.push({ type: 'message', message: `${displayName} is in love!` });
      if (random() < 0.5) {
        events.push({ type: 'message', message: `${displayName} is immobilized by love!` });
        return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
      }
    }
  }

  return { canAct: true, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: null };
}
