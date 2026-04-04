export interface FactoryReferenceRange {
  min: number;
  max: number;
}

// Directly aligned with reference `sInitialRentalMonRanges`:
// battle_factory.c (Level 50 first 8 rows, Open Level next 8 rows).
export const FACTORY_REFERENCE_LV50_RANGES: FactoryReferenceRange[] = [
  { min: 110, max: 199 },
  { min: 162, max: 266 },
  { min: 267, max: 371 },
  { min: 372, max: 467 },
  { min: 468, max: 563 },
  { min: 564, max: 659 },
  { min: 660, max: 755 },
  { min: 372, max: 849 },
];

export const FACTORY_REFERENCE_OPEN_RANGES: FactoryReferenceRange[] = [
  { min: 372, max: 467 },
  { min: 468, max: 563 },
  { min: 564, max: 659 },
  { min: 660, max: 755 },
  { min: 372, max: 881 },
  { min: 372, max: 881 },
  { min: 372, max: 881 },
  { min: 372, max: 881 },
];

export function getReferenceRangeByChallenge(level: number, challengeNum: number, useBetterRange: boolean): FactoryReferenceRange {
  const ranges = level > 50 ? FACTORY_REFERENCE_OPEN_RANGES : FACTORY_REFERENCE_LV50_RANGES;
  const maxIdx = ranges.length - 1;
  const baseIdx = Math.max(0, Math.min(maxIdx, challengeNum));
  const effectiveIdx = useBetterRange ? Math.min(maxIdx, baseIdx + 1) : baseIdx;
  return ranges[effectiveIdx];
}

export function inReferenceRange(monId: number, range: FactoryReferenceRange): boolean {
  return monId >= range.min && monId <= range.max;
}

