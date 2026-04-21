export const STAT_STAGE_MODIFIERS: Record<number, number> = {
  '-6': 2 / 8,
  '-5': 2 / 7,
  '-4': 2 / 6,
  '-3': 2 / 5,
  '-2': 2 / 4,
  '-1': 2 / 3,
  '0': 1,
  '1': 1.5,
  '2': 2,
  '3': 2.5,
  '4': 3,
  '5': 3.5,
  '6': 4,
};

export const ACC_EVA_STAGE_MODIFIERS: Record<number, number> = {
  '-6': 3 / 9,
  '-5': 3 / 8,
  '-4': 3 / 7,
  '-3': 3 / 6,
  '-2': 3 / 5,
  '-1': 3 / 4,
  '0': 1,
  '1': 4 / 3,
  '2': 5 / 3,
  '3': 6 / 3,
  '4': 7 / 3,
  '5': 8 / 3,
  '6': 9 / 3,
};

export function getStatStageModifier(stage: number) {
  return STAT_STAGE_MODIFIERS[Math.max(-6, Math.min(6, stage)) as keyof typeof STAT_STAGE_MODIFIERS] ?? 1;
}

export function getAccuracyStageModifier(stage: number) {
  return ACC_EVA_STAGE_MODIFIERS[Math.max(-6, Math.min(6, stage)) as keyof typeof ACC_EVA_STAGE_MODIFIERS] ?? 1;
}
