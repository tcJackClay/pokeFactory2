import test from 'node:test';
import assert from 'node:assert/strict';
import type { Move } from '../types';
import { fetchRequiredMovesInOrder } from './pokeApi';

function move(name: string): Move {
  return { name, power: 40, accuracy: 100, type: 'normal', damage_class: 'physical' };
}

test('strict rental move details start together and retain sampled order despite reverse completion', async () => {
  const sampledOrder = ['first', 'second', 'third', 'fourth'];
  const pending = new Map<string, (value: Move) => void>();
  const requested: string[] = [];
  const resultPromise = fetchRequiredMovesInOrder(sampledOrder, (name) => {
    requested.push(name);
    return new Promise<Move>((resolve) => pending.set(name, resolve));
  });

  assert.deepEqual(requested, sampledOrder);
  const details = Object.fromEntries(sampledOrder.map((name) => [name, move(name)]));
  for (const name of [...sampledOrder].reverse()) pending.get(name)!(details[name]);
  const result = await resultPromise;
  assert.deepEqual(result.map((entry) => entry.name), sampledOrder);
  assert.ok(result.every((entry, index) => entry === details[sampledOrder[index]]));
});

test('strict rental move lookup rejects missing details instead of returning a partial set', async () => {
  const requested: string[] = [];
  await assert.rejects(
    fetchRequiredMovesInOrder(['known', 'missing', 'later'], async (name) => {
      requested.push(name);
      if (name === 'missing') throw new Error('missing move data');
      return move(name);
    }),
    /missing move data/,
  );
  assert.deepEqual(requested, ['known', 'missing', 'later']);
});
