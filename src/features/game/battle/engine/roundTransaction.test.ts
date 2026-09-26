import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beginRoundAction,
  claimRoundEndTurn,
  completeRound,
  currentRoundSide,
  finishRoundAction,
  resumeRoundReplacement,
  roundMatches,
  startRound,
  waitForRoundReplacement,
  executeRoundTransaction,
} from './roundTransaction';

for (const firstSide of ['player', 'enemy'] as const) {
  test(`${firstSide} first: one action per side, one end turn, then DONE`, () => {
    const secondSide = firstSide === 'player' ? 'enemy' : 'player';
    const selected = startRound(4, 12, firstSide);
    assert.equal(currentRoundSide(selected), firstSide);
    const first = beginRoundAction(selected, firstSide)!;
    assert.equal(beginRoundAction(first, firstSide), null);
    const secondPending = finishRoundAction(first, firstSide, 'ACTED')!;
    assert.equal(currentRoundSide(secondPending), secondSide);
    assert.equal(beginRoundAction(secondPending, firstSide), null);
    const second = beginRoundAction(secondPending, secondSide)!;
    const end = finishRoundAction(second, secondSide, 'SKIPPED')!;
    assert.equal(end.player === 'PENDING' || end.enemy === 'PENDING', false);
    const claimed = claimRoundEndTurn(end)!;
    assert.equal(claimRoundEndTurn(claimed), null);
    assert.equal(completeRound(claimed)?.phase, 'DONE');
    assert.equal(beginRoundAction(claimed, firstSide), null);
  });
}

test('replacement pauses the second action and cannot erase the first action', () => {
  const selected = startRound(3, 7, 'enemy');
  const first = beginRoundAction(selected, 'enemy')!;
  const secondPending = finishRoundAction(first, 'enemy', 'ACTED')!;
  const waiting = waitForRoundReplacement(secondPending)!;
  assert.equal(currentRoundSide(waiting), null);
  assert.equal(beginRoundAction(waiting, 'player'), null);
  const resumed = resumeRoundReplacement(waiting)!;
  assert.equal(currentRoundSide(resumed), 'player');
  assert.equal(resumed.enemy, 'ACTED');
  assert.equal(resumeRoundReplacement(resumed), null);
});

test('stale battle epoch and round id cannot own the transaction', () => {
  const selected = startRound(8, 2, 'player');
  assert.equal(roundMatches(selected, 8, 2), true);
  assert.equal(roundMatches(selected, 9, 2), false);
  assert.equal(roundMatches(selected, 8, 3), false);
  assert.equal(claimRoundEndTurn(selected), null);
});

test('enemy first keeps player action before a single end-turn commit, even after a long log', async () => {
  const events: string[] = [];
  let release!: () => void;
  const log = new Promise<void>((resolve) => { release = resolve; });
  const work = executeRoundTransaction(startRound(1, 1, 'enemy'), {
    isCurrent: () => true,
    runAction: async (side) => {
      events.push(side);
      if (side === 'enemy') await log;
      return { status: 'ACTED' };
    },
    runEndTurn: async () => { events.push('end'); return {}; },
  });
  await Promise.resolve();
  assert.deepEqual(events, ['enemy']);
  release();
  assert.equal((await work).phase, 'DONE');
  assert.deepEqual(events, ['enemy', 'player', 'end']);
});

test('fainted original actor skips its action after replacement, and total team loss stops the round', async () => {
  const events: string[] = [];
  let release!: () => void;
  const replacement = new Promise<void>((resolve) => { release = resolve; });
  const work = executeRoundTransaction(startRound(2, 1, 'enemy'), {
    isCurrent: () => true,
    runAction: async (side) => {
      events.push(side);
      return side === 'enemy' ? { status: 'ACTED', replacement } : { status: 'SKIPPED' };
    },
    runEndTurn: async () => { events.push('end'); return {}; },
  });
  await Promise.resolve();
  assert.deepEqual(events, ['enemy']);
  release();
  assert.equal((await work).phase, 'DONE');
  assert.deepEqual(events, ['enemy', 'player', 'end']);

  const lostEvents: string[] = [];
  const lost = await executeRoundTransaction(startRound(2, 2, 'player'), {
    isCurrent: () => true,
    runAction: async (side) => { lostEvents.push(side); return { status: 'ACTED', battleEnded: true }; },
    runEndTurn: async () => { lostEvents.push('end'); return {}; },
  });
  assert.equal(lost.phase, 'DONE');
  assert.deepEqual(lostEvents, ['player']);
});

test('epoch invalidation during asynchronous action prevents second action and end turn', async () => {
  let current = true;
  const events: string[] = [];
  const round = await executeRoundTransaction(startRound(3, 2, 'player'), {
    isCurrent: () => current,
    runAction: async (side) => { events.push(side); current = false; return { status: 'ACTED' }; },
    runEndTurn: async () => { events.push('end'); return {}; },
  });
  assert.equal(round.phase, 'FIRST_ACTION');
  assert.deepEqual(events, ['player']);
});

const flushMacrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test('a replacement raised during END_TURN resumes the commit exactly once', async () => {
  const events: string[] = [];
  let release!: () => void;
  const replacement = new Promise<void>((resolve) => { release = resolve; });
  const work = executeRoundTransaction(startRound(5, 9, 'player'), {
    isCurrent: () => true,
    runAction: async (side) => { events.push(side); return { status: 'ACTED' }; },
    runEndTurn: async () => { events.push('end'); return { replacement }; },
  });
  await flushMacrotasks();
  assert.deepEqual(events, ['player', 'enemy', 'end'], 'end turn must wait for the replacement before completing');
  release();
  const round = await work;
  assert.equal(round.phase, 'DONE');
  assert.equal(round.endTurnCommitted, true);
  assert.deepEqual(events, ['player', 'enemy', 'end'], 'the end turn must not run a second time');
});

test('claimRoundEndTurn refuses a non-END_TURN round and never double-commits', () => {
  const selected = startRound(1, 1, 'player');
  assert.equal(claimRoundEndTurn(selected), null, 'SELECTED phase is not an end turn');
  const afterFirst = finishRoundAction(beginRoundAction(selected, 'player')!, 'player', 'ACTED')!;
  assert.equal(claimRoundEndTurn(afterFirst), null, 'a PENDING side and SECOND_ACTION phase cannot claim the end turn');
  const end = finishRoundAction(beginRoundAction(afterFirst, 'enemy')!, 'enemy', 'ACTED')!;
  const claimed = claimRoundEndTurn(end)!;
  assert.equal(claimed.endTurnCommitted, true);
  assert.equal(claimRoundEndTurn(claimed), null, 'a second submit must be rejected');
});

test('phase guards reject illegal transitions', () => {
  const selected = startRound(1, 1, 'player');
  assert.equal(beginRoundAction(selected, 'enemy'), null, 'only the current side may begin');
  assert.equal(finishRoundAction(selected, 'player', 'ACTED'), null, 'cannot finish before the action begins');
  assert.equal(resumeRoundReplacement(selected), null, 'not waiting for a replacement');
  assert.equal(completeRound(selected), null, 'cannot complete before claiming the end turn');
  assert.equal(waitForRoundReplacement(startRound(1, 2, 'enemy')), null, 'SELECTED cannot enter replacement wait');

  const waiting = waitForRoundReplacement(beginRoundAction(startRound(1, 3, 'player')!, 'player'))!;
  assert.equal(currentRoundSide(waiting), null);
  assert.equal(beginRoundAction(waiting, 'enemy'), null, 'no action may begin while waiting for a replacement');
});

test('finishRoundAction rejects a side that is not the current actor', () => {
  const selected = startRound(2, 4, 'enemy');
  const first = beginRoundAction(selected, 'enemy')!;
  assert.equal(finishRoundAction(first, 'player', 'ACTED'), null, 'the waiting side cannot resolve before the first actor');
  const afterEnemy = finishRoundAction(first, 'enemy', 'ACTED')!;
  assert.equal(afterEnemy.phase, 'SECOND_ACTION');
  assert.equal(finishRoundAction(afterEnemy, 'enemy', 'ACTED'), null, 'a resolved side cannot be finished twice');
  assert.equal(finishRoundAction(afterEnemy, 'player', 'ACTED')!.phase, 'END_TURN', 'the second side resolves normally');
});

test('two consecutive early-exit rounds each settle exactly one end turn', async () => {
  const endTurns: number[] = [];
  for (let index = 0; index < 2; index += 1) {
    const round = await executeRoundTransaction(startRound(6, index + 1, 'enemy'), {
      isCurrent: () => true,
      runAction: async () => ({ status: 'SKIPPED' }),
      runEndTurn: async () => { endTurns.push(index + 1); return {}; },
    });
    assert.equal(round.phase, 'DONE');
    assert.equal(round.player, 'SKIPPED');
    assert.equal(round.enemy, 'SKIPPED');
  }
  assert.deepEqual(endTurns, [1, 2]);
});

