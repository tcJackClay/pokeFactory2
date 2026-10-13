import { tms } from './generated';
import type { FixedTmAdmission } from './types';

// All fixed TMs remain pending. Source compatibility cannot open this gate.
const admissions = new Map(tms.map((entry) => [entry.moveName, Object.freeze({
  tm: Object.freeze({ ...entry }),
  status: 'pending' as const,
  fixedContentEvidence: null,
  battleEvidence: null,
  price: null,
})]));

export function getFixedTmAdmission(moveName: string): FixedTmAdmission | null {
  return admissions.get(moveName) ?? null;
}
