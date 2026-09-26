export type RoundSide = 'player' | 'enemy';
export type RoundActionStatus = 'PENDING' | 'ACTED' | 'SKIPPED';
export type RoundPhase = 'SELECTED' | 'FIRST_ACTION' | 'WAIT_REPLACEMENT' | 'SECOND_ACTION' | 'END_TURN' | 'DONE';

export interface RoundTransaction {
  battleEpoch: number;
  roundId: number;
  firstSide: RoundSide;
  phase: RoundPhase;
  player: RoundActionStatus;
  enemy: RoundActionStatus;
  endTurnCommitted: boolean;
  waitingAfter: 'FIRST_ACTION' | 'SECOND_ACTION' | 'END_TURN' | null;
}

export function startRound(battleEpoch: number, roundId: number, firstSide: RoundSide): RoundTransaction {
  return {
    battleEpoch,
    roundId,
    firstSide,
    phase: 'SELECTED',
    player: 'PENDING',
    enemy: 'PENDING',
    endTurnCommitted: false,
    waitingAfter: null,
  };
}

export function roundMatches(round: RoundTransaction | null, battleEpoch: number, roundId: number): round is RoundTransaction {
  return round !== null && round.battleEpoch === battleEpoch && round.roundId === roundId;
}

export function currentRoundSide(round: RoundTransaction): RoundSide | null {
  if (round.phase === 'SELECTED' || round.phase === 'FIRST_ACTION') return round.firstSide;
  if (round.phase === 'SECOND_ACTION') return round.firstSide === 'player' ? 'enemy' : 'player';
  return null;
}

export function beginRoundAction(round: RoundTransaction, side: RoundSide): RoundTransaction | null {
  if (round.phase !== 'SELECTED' && round.phase !== 'SECOND_ACTION') return null;
  if (currentRoundSide(round) !== side || round[side] !== 'PENDING') return null;
  return { ...round, phase: round.phase === 'SELECTED' ? 'FIRST_ACTION' : 'SECOND_ACTION' };
}

export function finishRoundAction(round: RoundTransaction, side: RoundSide, status: Exclude<RoundActionStatus, 'PENDING'>): RoundTransaction | null {
  const actionPhase = round.phase === 'WAIT_REPLACEMENT' ? round.waitingAfter : round.phase;
  if ((actionPhase !== 'FIRST_ACTION' && actionPhase !== 'SECOND_ACTION') || round[side] !== 'PENDING') return null;
  const expectedSide = actionPhase === 'FIRST_ACTION' ? round.firstSide : round.firstSide === 'player' ? 'enemy' : 'player';
  if (expectedSide !== side) return null;
  const nextPhase: RoundPhase = actionPhase === 'FIRST_ACTION' ? 'SECOND_ACTION' : 'END_TURN';
  return round.phase === 'WAIT_REPLACEMENT'
    ? { ...round, [side]: status, waitingAfter: nextPhase }
    : { ...round, [side]: status, phase: nextPhase };
}

export function waitForRoundReplacement(round: RoundTransaction): RoundTransaction | null {
  if (round.phase !== 'FIRST_ACTION' && round.phase !== 'SECOND_ACTION' && round.phase !== 'END_TURN') return null;
  return { ...round, waitingAfter: round.phase, phase: 'WAIT_REPLACEMENT' };
}

export function resumeRoundReplacement(round: RoundTransaction): RoundTransaction | null {
  if (round.phase !== 'WAIT_REPLACEMENT' || !round.waitingAfter) return null;
  return { ...round, phase: round.waitingAfter, waitingAfter: null };
}

export function claimRoundEndTurn(round: RoundTransaction): RoundTransaction | null {
  if (round.phase !== 'END_TURN' || round.endTurnCommitted || round.player === 'PENDING' || round.enemy === 'PENDING') return null;
  return { ...round, endTurnCommitted: true };
}

export function completeRound(round: RoundTransaction): RoundTransaction | null {
  if (round.phase !== 'END_TURN' || !round.endTurnCommitted) return null;
  return { ...round, phase: 'DONE' };
}

export function abortRound(round: RoundTransaction): RoundTransaction {
  return { ...round, phase: 'DONE', waitingAfter: null };
}

export interface RoundActionResult {
  status: Exclude<RoundActionStatus, 'PENDING'>;
  replacement?: Promise<void>;
  battleEnded?: boolean;
}

export async function executeRoundTransaction(
  initial: RoundTransaction,
  options: {
    isCurrent: () => boolean;
    runAction: (side: RoundSide) => Promise<RoundActionResult>;
    runEndTurn: () => Promise<{ replacement?: Promise<void> }>;
    onTransition?: (round: RoundTransaction) => void;
  },
): Promise<RoundTransaction> {
  let round = initial;
  const update = (next: RoundTransaction) => {
    round = next;
    options.onTransition?.(next);
  };
  while (options.isCurrent()) {
    const side = currentRoundSide(round);
    if (side) {
      const begun = beginRoundAction(round, side);
      if (!begun) break;
      update(begun);
      const result = await options.runAction(side);
      if (!options.isCurrent()) break;
      if (result.battleEnded) {
        update(abortRound(round));
        return round;
      }
      if (result.replacement) update(waitForRoundReplacement(round)!);
      update(finishRoundAction(round, side, result.status)!);
      if (result.replacement) {
        await result.replacement;
        if (!options.isCurrent()) break;
        update(resumeRoundReplacement(round)!);
      }
      continue;
    }
    if (round.phase === 'END_TURN') {
      const claimed = claimRoundEndTurn(round);
      if (!claimed) break;
      update(claimed);
      const result = await options.runEndTurn();
      if (!options.isCurrent()) break;
      if (result.replacement) {
        update(waitForRoundReplacement(round)!);
        await result.replacement;
        if (!options.isCurrent()) break;
        update(resumeRoundReplacement(round)!);
      }
      update(completeRound(round)!);
      return round;
    }
    break;
  }
  return round;
}
