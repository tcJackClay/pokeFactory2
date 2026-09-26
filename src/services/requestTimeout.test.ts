import test from 'node:test';
import assert from 'node:assert/strict';
import { RequestTimeoutError, withRequestTimeout } from './requestTimeout';

test('a request that ignores abort still reaches a bounded failure and signals cancellation', async () => {
  let signal: AbortSignal | null = null;
  const startedAt = Date.now();
  await assert.rejects(
    withRequestTimeout(async (requestSignal) => {
      signal = requestSignal;
      return new Promise<string>(() => {});
    }, 25, 'stalled rental resource'),
    (error: unknown) => error instanceof RequestTimeoutError,
  );
  assert.equal(signal?.aborted, true);
  assert.ok(Date.now() - startedAt < 1000);
});

test('a completed request retains its result and is not aborted', async () => {
  let signal: AbortSignal | null = null;
  const result = await withRequestTimeout(async (requestSignal) => {
    signal = requestSignal;
    return { speciesId: 1 };
  }, 100, 'factory index');
  assert.deepEqual(result, { speciesId: 1 });
  assert.equal(signal?.aborted, false);
});
