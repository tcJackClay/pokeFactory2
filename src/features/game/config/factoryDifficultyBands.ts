export interface FactoryBstBand {
  min: number;
  max: number;
}

const LV50_BST_BANDS: FactoryBstBand[] = [
  { min: 220, max: 430 },
  { min: 260, max: 470 },
  { min: 300, max: 510 },
  { min: 340, max: 550 },
  { min: 380, max: 590 },
  { min: 420, max: 630 },
  { min: 460, max: 700 },
  { min: 500, max: 780 },
];

const OPEN_BST_BANDS: FactoryBstBand[] = [
  { min: 320, max: 520 },
  { min: 350, max: 560 },
  { min: 380, max: 600 },
  { min: 420, max: 640 },
  { min: 460, max: 680 },
  { min: 500, max: 720 },
  { min: 530, max: 760 },
  { min: 560, max: 800 },
];

export function getFactoryBstBand(level: number, challengeNum: number, useBetterRange: boolean): FactoryBstBand {
  const bands = level > 50 ? OPEN_BST_BANDS : LV50_BST_BANDS;
  const maxIdx = bands.length - 1;
  const baseIdx = Math.max(0, Math.min(maxIdx, challengeNum));
  const effectiveIdx = useBetterRange ? Math.min(maxIdx, baseIdx + 1) : baseIdx;
  return bands[effectiveIdx];
}

