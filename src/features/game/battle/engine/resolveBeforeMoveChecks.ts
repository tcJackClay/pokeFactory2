import type { GamePokemon, Move } from '../../../../types';
import { battleLine, battleMoveName } from '../battleLogText';
import { clearNonVolatileStatus, clearVolatileStatus, getNonVolatileStatusId, getVolatileStatus, hasVolatileStatus, setNonVolatileStatus, setVolatileStatus } from '../../utils/battleStatus';
import type { BattleSnapshot, BeforeMoveCheckResult, EngineBattleSide } from './types';

interface ResolveBeforeMoveChecksOptions {
  snapshot: BattleSnapshot;
  side: EngineBattleSide;
  combatant: GamePokemon;
  move?: Move;
  displayName: string;
  currentLanguage?: string;
  hasAbilityEffect: (pokemon: GamePokemon | null | undefined, effectId: string) => boolean;
  isMoveUsableWhileAsleep: (move?: Move | null) => boolean;
  getEncoredMove: (pokemon: GamePokemon | null | undefined) => Move | null;
  getMoveCurrentPp: (move: Move) => number;
  tryConsumeStatusCureBerry: (pokemon: GamePokemon | null | undefined) => { pokemon: GamePokemon | null | undefined; message: string | null };
  tryConsumeMentalHerb: (pokemon: GamePokemon | null | undefined) => { pokemon: GamePokemon | null | undefined; message: string | null };
  calculateConfusionSelfHitDamage: (pokemon: GamePokemon, random?: () => number) => number;
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
  currentLanguage,
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
  const localizedMoveName = (name: string) => {
    const selectedMove = nextCombatant.selectedMoves.find((candidate) => candidate.name === name);
    return selectedMove ? battleMoveName(selectedMove, currentLanguage) : name;
  };

  if (
    getNonVolatileStatusId(nextCombatant) === 'sleep'
    && activeUproarSource
    && !hasAbilityEffect(nextCombatant, 'SOUNDPROOF')
  ) {
    syncCombatant(clearVolatileStatus(clearNonVolatileStatus(nextCombatant), 'nightmare'));
    events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} woke up in the uproar!`, `${displayName}被吵闹声惊醒了！`) });
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
      events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} is fast asleep...`, `${displayName}睡得正香……`) });
      if (!isMoveUsableWhileAsleep(move)) {
        return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
      }
    } else {
      syncCombatant(clearVolatileStatus(clearNonVolatileStatus(nextCombatant), 'nightmare'));
      events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} woke up!`, `${displayName}醒来了！`) });
    }
  }

  if (getNonVolatileStatusId(nextCombatant) === 'freeze') {
    if (move?.battleData?.thawsUser) {
      syncCombatant(clearNonVolatileStatus(nextCombatant));
      events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} thawed out by using ${move.name}!`, `${displayName}使用${battleMoveName(move, currentLanguage)}解冻了！`) });
    } else {
      const freezeTurnsRemaining = Math.max(0, nextCombatant.nonVolatileStatus?.turnsRemaining ?? 3) - 1;
      if (random() < 0.25 || freezeTurnsRemaining <= 0) {
        syncCombatant(clearNonVolatileStatus(nextCombatant));
        events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} thawed out!`, `${displayName}解冻了！`) });
      } else {
        syncCombatant(setNonVolatileStatus(nextCombatant, 'freeze', {
          turnsRemaining: freezeTurnsRemaining,
          sourceMoveName: nextCombatant.nonVolatileStatus?.sourceMoveName,
        }));
        events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} is frozen solid...`, `${displayName}被冻住了，无法行动！`) });
        return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
      }
    }
  }

  if (hasVolatileStatus(nextCombatant, 'flinch')) {
    syncCombatant(clearVolatileStatus(nextCombatant, 'flinch'));
    events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} flinched and couldn't move!`, `${displayName}畏缩了，无法行动！`) });
    return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
  }

  const encoredMove = getEncoredMove(nextCombatant);
  if (hasVolatileStatus(nextCombatant, 'encore')) {
    if (!encoredMove || getMoveCurrentPp(encoredMove) <= 0) {
      syncCombatant(clearVolatileStatus(nextCombatant, 'encore'));
    } else if (move && move.name !== encoredMove.name) {
      events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} must use ${encoredMove.name} due to Encore!`, `${displayName}受到再来一次影响，只能使用${battleMoveName(encoredMove, currentLanguage)}！`) });
      return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
    }
  }

  const disabledMoveName = getVolatileStatus(nextCombatant, 'disable')?.linkedMoveName;
  if (move && disabledMoveName && move.name === disabledMoveName) {
    events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName}'s ${disabledMoveName} is disabled!`, `${displayName}的${localizedMoveName(disabledMoveName)}被封住了！`) });
    return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
  }

  if (move && hasVolatileStatus(nextCombatant, 'taunt') && move.damage_class === 'status') {
    events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} can't use status moves due to Taunt!`, `${displayName}受到挑衅，无法使用变化招式！`) });
    return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
  }

  if (
    move
    && hasVolatileStatus(nextCombatant, 'torment')
    && nextCombatant.factoryLastUsedMoveName
    && nextCombatant.factoryLastUsedMoveName === move.name
  ) {
    events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} can't use ${move.name} twice in a row due to Torment!`, `${displayName}受到无理取闹影响，无法连续使用${battleMoveName(move, currentLanguage)}！`) });
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
      events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} is confused!`, `${displayName}陷入了混乱！`) });

      if (random() < (1 / 3)) {
        const selfHitDamage = Math.min(nextCombatant.currentHp, calculateConfusionSelfHitDamage(nextCombatant, random));
        syncCombatant({
          ...nextCombatant,
          currentHp: Math.max(0, nextCombatant.currentHp - selfHitDamage),
        });
        events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} hurt itself in its confusion!`, `${displayName}因混乱伤害了自己！`) });
        events.push({ type: 'hp-change', displayName, amount: -selfHitDamage });
        return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
      }
    } else {
      syncCombatant(clearVolatileStatus(nextCombatant, 'confusion'));
      events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} snapped out of confusion!`, `${displayName}从混乱中清醒了！`) });
    }
  }

  if (getNonVolatileStatusId(nextCombatant) === 'paralysis' && random() < 0.125) {
    events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} is paralyzed and cannot move!`, `${displayName}因麻痹无法行动！`) });
    return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
  }

  const activeOpposingCombatant = side === 'enemy' ? activePlayerLead : activeEnemyLead;
  const infatuationState = getVolatileStatus(nextCombatant, 'infatuation') ?? getVolatileStatus(nextCombatant, 'attract');
  if (infatuationState) {
    if (!activeOpposingCombatant || infatuationState.linkedPokemonId !== activeOpposingCombatant.id) {
      syncCombatant(clearVolatileStatus(clearVolatileStatus(nextCombatant, 'infatuation'), 'attract'));
    } else {
      events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} is in love!`, `${displayName}陷入了着迷状态！`) });
      if (random() < 0.5) {
        events.push({ type: 'message', message: battleLine(currentLanguage, `${displayName} is immobilized by love!`, `${displayName}因着迷无法行动！`) });
        return { canAct: false, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: side === 'enemy' ? 'PLAYER' : 'ENEMY' };
      }
    }
  }

  return { canAct: true, combatant: nextCombatant, snapshot: nextSnapshot, events, nextTurn: null };
}
