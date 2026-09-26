import { getBattleIndexInSet } from '../config/factoryRewards';

export function hasRecoverableFactoryBaseCheckpoint(
  snapshot: {
    phase: string;
    roundResult: 'WIN' | 'LOSS' | null;
    stage: number;
    playerTeam: unknown[];
    enemyTeam: unknown[];
  } | null,
  runId: string | null | undefined,
): boolean {
  return Boolean(runId && snapshot?.phase === 'BASE'
    && snapshot.roundResult === 'WIN'
    && getBattleIndexInSet(snapshot.stage) === 7
    && snapshot.playerTeam.length > 0
    && snapshot.enemyTeam.length > 0);
}

export function shouldReleaseFactoryBaseCheckpoint(
  hasCheckpoint: boolean,
  checkpointStage: number | null,
  stableBattleStage: number | null,
): boolean {
  return hasCheckpoint && checkpointStage !== null && stableBattleStage !== null
    && stableBattleStage === checkpointStage + 1
    && getBattleIndexInSet(stableBattleStage) === 1;
}
