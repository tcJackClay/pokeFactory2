import test from 'node:test';
import assert from 'node:assert/strict';
import type { GamePokemon } from '../../../types';
import {
  canAdvanceClassicStage,
  createClassicActionGate,
  getClassicPostBattleDestination,
  swapDefeatedPokemon,
} from './classicFlow';

test('Classic routes wins 1–6 to one optional swap and seventh win or loss to base', () => {
  for (const stage of [1, 3, 4, 6]) {
    assert.equal(getClassicPostBattleDestination(stage, 'WIN'), 'FACTORY_SWAP');
    assert.equal(canAdvanceClassicStage(stage, 'FACTORY_SWAP', 'WIN', false), true);
    assert.equal(canAdvanceClassicStage(stage, 'REWARD', 'WIN', false), false);
    assert.equal(getClassicPostBattleDestination(stage, 'LOSS'), 'BASE');
    assert.equal(canAdvanceClassicStage(stage, 'FACTORY_SWAP', 'LOSS', false), false);
  }
  assert.equal(getClassicPostBattleDestination(7, 'WIN'), 'BASE');
  assert.equal(canAdvanceClassicStage(7, 'FACTORY_SWAP', 'WIN', false), false);
  assert.equal(canAdvanceClassicStage(7, 'BASE', 'WIN', true), true);
  assert.equal(canAdvanceClassicStage(7, 'BASE', 'WIN', false), false);
  assert.equal(getClassicPostBattleDestination(14, 'WIN'), 'BASE');
});

test('Classic swap takes exactly one member of the defeated team and restores its HP', () => {
  const pokemon = (id: number, hp: number) => ({ id, currentHp: hp, maxHp: 100 } as GamePokemon);
  const team = [pokemon(1, 75), pokemon(2, 65), pokemon(3, 40)];
  const defeated = [pokemon(4, 0), pokemon(5, 0), pokemon(6, 0)];
  const swapped = swapDefeatedPokemon(team, defeated, 1, 2);
  assert.deepEqual(swapped?.map((entry) => entry.id), [1, 6, 3]);
  assert.equal(swapped?.[1].currentHp, 100);
  assert.equal(defeated[2].currentHp, 0);
  assert.equal(swapDefeatedPokemon(team, defeated, 1, 3), null);
});

test('skip and swap share one gate, so double taps advance only once', async () => {
  const gate = createClassicActionGate();
  let advanceCount = 0;
  let swapCount = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const first = gate('run:one:3:FACTORY_SWAP', async () => {
    advanceCount += 1;
    await pending;
    return true;
  });
  const duplicate = await gate('run:one:3:FACTORY_SWAP', async () => {
    swapCount += 1;
    advanceCount += 1;
    return true;
  });
  assert.equal(duplicate, false);
  release();
  assert.equal(await first, true);
  assert.equal(await gate('run:one:3:FACTORY_SWAP', async () => { advanceCount += 1; return true; }), false);
  assert.equal(advanceCount, 1);
  assert.equal(swapCount, 0);
  assert.equal(await gate('run:one:4:FACTORY_SWAP', async () => { advanceCount += 1; return true; }), true);
  assert.equal(advanceCount, 2);
});

test('failed encounter leaves the action gate available for retry', async () => {
  const gate = createClassicActionGate();
  assert.equal(await gate('run:one:4:FACTORY_SWAP', async () => false), false);
  assert.equal(await gate('run:one:4:FACTORY_SWAP', async () => true), true);
});
