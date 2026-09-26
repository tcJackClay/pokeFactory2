import type { BattleMenuTab, FieldState, FieldTurns, GamePokemon, TailwindTurns, Weather } from '../../../types';
import type { FactoryTrainerTemplate } from '../config/factoryTrainerTemplates';
import type { BattleSpecialUsageState, BattleTurn, FactoryAiTier } from '../view-model';

export interface FactoryBattlePresentation {
  enemy: GamePokemon | null;
  enemyTeam: GamePokemon[];
  currentEnemyTrainer: FactoryTrainerTemplate | null;
  nextEnemyPreviewTeam: GamePokemon[];
  nextEnemyPreviewTrainer: FactoryTrainerTemplate | null;
  specialBossBattleActive: boolean;
  enemyAiTier: FactoryAiTier;
  battleSpecialUsage: BattleSpecialUsageState;
  enemySpecialUsage: BattleSpecialUsageState;
  battleLog: string[];
  turn: BattleTurn;
  battleMenuTab: BattleMenuTab;
  weather: Weather;
  weatherTurns: number;
  fieldState: FieldState[];
  fieldTurns: FieldTurns;
  tailwindTurns: TailwindTurns;
  activeBuffs: { atk: boolean; def: boolean };
  enemyBuffs: { atk: boolean; def: boolean };
}

export type FactoryBattlePresentationSetters = {
  [Key in keyof FactoryBattlePresentation as `set${Capitalize<Key>}`]: (value: FactoryBattlePresentation[Key]) => void;
};

export function restoreFactoryBattlePresentation(
  snapshot: FactoryBattlePresentation,
  setters: FactoryBattlePresentationSetters,
): void {
  setters.setEnemy(snapshot.enemy);
  setters.setEnemyTeam(snapshot.enemyTeam);
  setters.setCurrentEnemyTrainer(snapshot.currentEnemyTrainer);
  setters.setNextEnemyPreviewTeam(snapshot.nextEnemyPreviewTeam);
  setters.setNextEnemyPreviewTrainer(snapshot.nextEnemyPreviewTrainer);
  setters.setSpecialBossBattleActive(snapshot.specialBossBattleActive);
  setters.setEnemyAiTier(snapshot.enemyAiTier);
  setters.setBattleSpecialUsage(snapshot.battleSpecialUsage);
  setters.setEnemySpecialUsage(snapshot.enemySpecialUsage);
  setters.setBattleLog(snapshot.battleLog);
  setters.setTurn(snapshot.turn);
  setters.setBattleMenuTab(snapshot.battleMenuTab);
  setters.setWeather(snapshot.weather);
  setters.setWeatherTurns(snapshot.weatherTurns);
  setters.setFieldState(snapshot.fieldState);
  setters.setFieldTurns(snapshot.fieldTurns);
  setters.setTailwindTurns(snapshot.tailwindTurns);
  setters.setActiveBuffs(snapshot.activeBuffs);
  setters.setEnemyBuffs(snapshot.enemyBuffs);
}
