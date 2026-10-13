import test from 'node:test';
import assert from 'node:assert/strict';
import { getDispatchAcquisitionId, normalizePermanentCollection, validatePermanentAcquisitions, type PermanentAcquisition } from './permanentCollection';

function record(speciesId: number, startedAt = 100): PermanentAcquisition {
  return { acquisitionId: getDispatchAcquisitionId('kanto', startedAt), speciesId, source: 'DISPATCH_JOIN', regionId: 'kanto', dispatchStartedAt: startedAt, acquiredAt: startedAt + 1 };
}

test('rentals, swaps and evolved rental IDs remain seen without a permanent source', () => {
  const ledger = { seenIds: [1, 2, 3], ownedIds: [1, 2, 3], formKeys: ['3:venusaur'], acquisitions: [] };
  const collection = normalizePermanentCollection(ledger, 25);
  assert.deepEqual(collection.ownedIds, [25]);
  assert.deepEqual(collection.seenIds, [1, 2, 3, 25]);
  assert.deepEqual(collection.formKeys, ledger.formKeys);
  assert.deepEqual(normalizePermanentCollection(ledger, null).ownedIds, []);
});

test('permanent ownership is the species union of the companion and distinct successful dispatches', () => {
  const collection = normalizePermanentCollection({ seenIds: [], ownedIds: [999], formKeys: [], acquisitions: [record(25), record(133, 200), record(133, 300)] }, 25);
  assert.deepEqual(collection.ownedIds, [25, 133]);
  assert.deepEqual(collection.seenIds, [25, 133]);
  assert.equal(collection.acquisitions.length, 3);
});

test('receipt retries retain original acquisition time and conflicting dispatch claims fail', () => {
  const original = record(133);
  assert.deepEqual(validatePermanentAcquisitions([original, { ...original, acquiredAt: 999 }]), [original]);
  assert.throws(() => validatePermanentAcquisitions([original, { ...original, speciesId: 25 }]), /Conflicting/);
  assert.throws(() => validatePermanentAcquisitions([original, { ...original, source: 'DISPATCH_CATCH' }]), /Conflicting/);
  assert.throws(() => validatePermanentAcquisitions([{ ...original, regionId: 'unknown' }]), /Invalid/);
  assert.throws(() => validatePermanentAcquisitions([{ ...original, acquisitionId: 'arbitrary' }]), /Invalid/);
  assert.throws(() => validatePermanentAcquisitions(undefined), /missing/);
});
