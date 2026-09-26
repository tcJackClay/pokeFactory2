import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRecoverableFactoryBaseCheckpoint, shouldReleaseFactoryBaseCheckpoint } from './factoryResumeCheckpoint';

test('completed set remains resumable through the next encounter loading window', () => {
  const saved = { phase: 'BASE', roundResult: 'WIN' as const, stage: 7, playerTeam: [{}], enemyTeam: [{}] };
  assert.equal(hasRecoverableFactoryBaseCheckpoint(saved, 'run:one'), true);
  assert.equal(shouldReleaseFactoryBaseCheckpoint(true, 7, null), false);
  assert.equal(shouldReleaseFactoryBaseCheckpoint(true, 7, 7), false);
  assert.equal(shouldReleaseFactoryBaseCheckpoint(true, 7, 8), true);
  assert.equal(shouldReleaseFactoryBaseCheckpoint(false, 7, 8), false);
});

test('failed generation returns to the original set checkpoint', () => {
  assert.equal(hasRecoverableFactoryBaseCheckpoint({ phase: 'BASE', roundResult: 'WIN', stage: 14, playerTeam: [{}], enemyTeam: [{}] }, 'run:one'), true);
  assert.equal(shouldReleaseFactoryBaseCheckpoint(true, 14, null), false);
  assert.equal(shouldReleaseFactoryBaseCheckpoint(true, 14, 14), false);
  assert.equal(shouldReleaseFactoryBaseCheckpoint(true, 14, 15), true);
  assert.equal(hasRecoverableFactoryBaseCheckpoint({ phase: 'BASE', roundResult: 'LOSS', stage: 7, playerTeam: [{}], enemyTeam: [{}] }, 'run:one'), false);
  assert.equal(hasRecoverableFactoryBaseCheckpoint(null, 'run:one'), false);
  assert.equal(hasRecoverableFactoryBaseCheckpoint({ phase: 'BASE', roundResult: 'WIN', stage: 7, playerTeam: [{}], enemyTeam: [{}] }, null), false);
  assert.equal(hasRecoverableFactoryBaseCheckpoint({ phase: 'BASE', roundResult: 'WIN', stage: 7, playerTeam: [], enemyTeam: [{}] }, 'run:one'), false);
});
