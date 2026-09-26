import type { GamePokemon, GameState } from '../../../types';
import { FACTORY_REWARD_CONFIG, getBattleIndexInSet } from './factoryRewards';

export type ClassicRoundResult = 'WIN' | 'LOSS';
export type ClassicPostBattleDestination = 'FACTORY_SWAP' | 'BASE';

export function getClassicPostBattleDestination(stage: number, result: ClassicRoundResult): ClassicPostBattleDestination {
  return result === 'WIN' && getBattleIndexInSet(stage) < FACTORY_REWARD_CONFIG.battlesPerSet
    ? 'FACTORY_SWAP'
    : 'BASE';
}

export function canAdvanceClassicStage(
  stage: number,
  gameState: GameState,
  result: ClassicRoundResult | null,
  hasFactoryRunToResume: boolean,
): boolean {
  const battleInSet = getBattleIndexInSet(stage);
  return (gameState === 'FACTORY_SWAP' && result === 'WIN' && battleInSet < FACTORY_REWARD_CONFIG.battlesPerSet)
    || (gameState === 'BASE' && hasFactoryRunToResume && battleInSet === FACTORY_REWARD_CONFIG.battlesPerSet);
}

export function createClassicActionGate() {
  let inFlight = false;
  let completedKey: string | null = null;
  return async (key: string, action: () => Promise<boolean>): Promise<boolean> => {
    if (inFlight || completedKey === key) return false;
    inFlight = true;
    try {
      if (!await action()) return false;
      completedKey = key;
      return true;
    } finally {
      inFlight = false;
    }
  };
}

export function swapDefeatedPokemon(
  playerTeam: GamePokemon[],
  defeatedEnemyTeam: GamePokemon[],
  playerIndex: number,
  enemyIndex: number,
): GamePokemon[] | null {
  if (!Number.isInteger(playerIndex) || playerIndex < 0 || playerIndex >= playerTeam.length
    || !Number.isInteger(enemyIndex) || enemyIndex < 0 || enemyIndex >= defeatedEnemyTeam.length) return null;
  return playerTeam.map((pokemon, index) => index === playerIndex
    ? { ...defeatedEnemyTeam[enemyIndex], currentHp: defeatedEnemyTeam[enemyIndex].maxHp }
    : pokemon);
}
