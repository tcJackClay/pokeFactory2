import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnemyActionGate } from './enemyActionGate';

test('one enemy phase is claimed once despite rerenders before message playback', () => {
  const gate = createEnemyActionGate();
  assert.equal(gate.claim(0), true);
  assert.equal(gate.claim(0), false, 'pre-turn team updates must not start the same action twice');
  assert.equal(gate.claim(0), false, 'message completion must not restart the same action');
  gate.reset(); // The turn left ENEMY and reached PLAYER.
  assert.equal(gate.claim(0), true, 'the next enemy phase is a new action');
  assert.equal(gate.claim(0), false);
  assert.equal(gate.claim(1), true, 'a different battle must not inherit the previous claim');
  assert.equal(gate.claim(1), false);
});
