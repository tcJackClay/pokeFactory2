import type { GameSaveData } from '../../../services/saveManager';

type TrainerHistory = GameSaveData['factory']['trainerIdsBySet'];

export function hydrateTrainerHistoryOnce(
  hydratedRef: { current: boolean },
  savedHistory: TrainerHistory,
  importHistory: (history: TrainerHistory) => void,
): void {
  if (hydratedRef.current) return;
  importHistory(savedHistory);
  hydratedRef.current = true;
}
