import { EVENT_REGIONS } from '../config/events';
import type { CollectionLedger } from '../../../services/saveManager';

export interface PermanentAcquisition {
  acquisitionId: string;
  speciesId: number;
  source: 'DISPATCH_JOIN' | 'DISPATCH_CATCH';
  regionId: string;
  dispatchStartedAt: number;
  acquiredAt: number;
}

export function getDispatchAcquisitionId(regionId: string, startedAt: number): string {
  return `dispatch:${regionId}:${startedAt}`;
}

export function samePermanentAcquisition(a: PermanentAcquisition, b: PermanentAcquisition): boolean {
  return a.acquisitionId === b.acquisitionId && a.speciesId === b.speciesId
    && a.source === b.source && a.regionId === b.regionId && a.dispatchStartedAt === b.dispatchStartedAt;
}

export function validatePermanentAcquisitions(value: unknown): PermanentAcquisition[] {
  if (!Array.isArray(value)) throw new Error('Permanent acquisition records are missing.');
  const records = new Map<string, PermanentAcquisition>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid permanent acquisition record.');
    const record = raw as PermanentAcquisition;
    if (!Number.isSafeInteger(record.speciesId) || record.speciesId <= 0
      || !EVENT_REGIONS.some((region) => region.id === record.regionId)
      || !Number.isSafeInteger(record.dispatchStartedAt) || record.dispatchStartedAt <= 0
      || !Number.isSafeInteger(record.acquiredAt) || record.acquiredAt < record.dispatchStartedAt
      || !['DISPATCH_JOIN', 'DISPATCH_CATCH'].includes(record.source)
      || record.acquisitionId !== getDispatchAcquisitionId(record.regionId, record.dispatchStartedAt)) {
      throw new Error('Invalid permanent acquisition record.');
    }
    const existing = records.get(record.acquisitionId);
    if (existing && !samePermanentAcquisition(existing, record)) throw new Error('Conflicting permanent acquisition records.');
    if (!existing) records.set(record.acquisitionId, {
      acquisitionId: record.acquisitionId,
      speciesId: record.speciesId,
      source: record.source,
      regionId: record.regionId,
      dispatchStartedAt: record.dispatchStartedAt,
      acquiredAt: record.acquiredAt,
    });
  }
  return [...records.values()].sort((a, b) => a.acquisitionId.localeCompare(b.acquisitionId));
}

export function normalizePermanentCollection(ledger: CollectionLedger, companionSpeciesId: number | null): CollectionLedger {
  const acquisitions = validatePermanentAcquisitions(ledger.acquisitions);
  if (companionSpeciesId === null && acquisitions.length > 0) throw new Error('Permanent acquisition exists before companion selection.');
  const ownedIds = [...new Set([
    ...(companionSpeciesId === null ? [] : [companionSpeciesId]),
    ...acquisitions.map((record) => record.speciesId),
  ])].sort((a, b) => a - b);
  return {
    ...ledger,
    acquisitions,
    ownedIds,
    seenIds: [...new Set([...ledger.seenIds, ...ownedIds])].sort((a, b) => a - b),
  };
}
