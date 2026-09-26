export const FACTORY_BRAIN_TRAINER_ID = 'TRAINER_NOLAND';

// Factory singles: first and second symbols at 21 and 42 wins. Once both
// symbols are held, the Brain returns every 21 wins (including 21 and 42).
export function isFactoryBrainStage(stage: number, symbols: number): boolean {
  if (!Number.isSafeInteger(stage) || stage < 1 || !Number.isSafeInteger(symbols) || symbols < 0) return false;
  if (symbols === 0) return stage === 21;
  if (symbols === 1) return stage === 42;
  return stage % 21 === 0;
}
