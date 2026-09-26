import assert from 'node:assert/strict';
import test from 'node:test';
import {
  restoreFactoryBattlePresentation,
  type FactoryBattlePresentation,
  type FactoryBattlePresentationSetters,
} from './factoryBattleRollback';

test('failed next battle restores every prior result-page presentation field', () => {
  const before: FactoryBattlePresentation = {
    enemy: null,
    enemyTeam: [],
    currentEnemyTrainer: null,
    nextEnemyPreviewTeam: [],
    nextEnemyPreviewTrainer: null,
    specialBossBattleActive: true,
    enemyAiTier: 'BOSS',
    battleSpecialUsage: { MEGA: true, DYNAMAX: false, TERA: false, ZMOVE: false },
    enemySpecialUsage: { MEGA: false, DYNAMAX: true, TERA: false, ZMOVE: false },
    battleLog: ['此前的战斗记录'],
    turn: 'ENEMY',
    battleMenuTab: 'POKEMON',
    weather: 'sunny',
    weatherTurns: 3,
    fieldState: ['electric_terrain'],
    fieldTurns: { electric_terrain: 2 },
    activeBuffs: { atk: true, def: false },
    enemyBuffs: { atk: false, def: true },
  };
  const restored: Record<string, unknown> = {};
  const setters = Object.fromEntries(Object.keys(before).map((key) => [
    `set${key[0].toUpperCase()}${key.slice(1)}`,
    (value: unknown) => { restored[key] = value; },
  ])) as FactoryBattlePresentationSetters;

  restoreFactoryBattlePresentation(before, setters);
  assert.deepEqual(restored, before);
});
