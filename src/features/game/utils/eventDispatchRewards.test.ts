import assert from 'node:assert/strict';
import test from 'node:test';
import type { GamePokemon } from '../../../types';
import type { EventRegionConfig } from '../config/events';
import { IV_TRAIN_BATTLE_THRESHOLD } from '../config/events';
import { applyDispatchTrainingToTeam, rollDispatchOutcome } from './eventDispatchRewards';

const nature = { name: 'hardy', zhName: 'Hardy', plus: 'attack', minus: 'attack' };

function makePokemon(id: number): GamePokemon {
  const baseStats = { hp: 60, attack: 60, defense: 60, spAtk: 60, spDef: 60, speed: 60 };
  return {
    id,
    name: `pokemon-${id}`,
    sprites: { front_default: '', back_default: '' },
    stats: [],
    types: [{ type: { name: 'fighting' } }],
    abilities: [],
    moves: [],
    currentHp: 100,
    maxHp: 100,
    selectedMoves: [],
    level: 50,
    nature,
    ivs: { hp: 10, attack: 10, defense: 10, spAtk: 10, spDef: 10, speed: 10 },
    evs: { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 },
    baseStats,
    calculatedStats: baseStats,
    statStages: { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0, evasion: 0 },
  };
}

const evRegion: EventRegionConfig = {
  id: 'johto',
  name: 'Johto',
  category: 'ev_train',
  dexRange: [152, 251],
  requiredTypes: ['fighting', 'psychic'],
  specialSites: [],
  dispatchHours: 6,
  baseEvGain: 12,
};

test('applyDispatchTrainingToTeam uses event region EV gain on the dispatched team Pokemon', () => {
  const [trained] = applyDispatchTrainingToTeam([makePokemon(25)], 25, evRegion).team;
  assert.equal(trained.evs.attack, 12);
  assert.equal(trained.ivs.attack, 10);
});

test('applyDispatchTrainingToTeam grants an IV point on the configured battle threshold', () => {
  const result = applyDispatchTrainingToTeam([makePokemon(25)], 25, evRegion, IV_TRAIN_BATTLE_THRESHOLD);
  assert.equal(result.team[0].evs.attack, 12);
  assert.equal(result.team[0].ivs.attack, 11);
  assert.equal(result.ivGain, 1);
});

test('rollDispatchOutcome gives rare hunts a battle branch at high rolls', () => {
  assert.equal(rollDispatchOutcome('rare_hunt', () => 0.9), 'battle');
  assert.equal(rollDispatchOutcome('normal', () => 0.9), 'battle');
  assert.equal(rollDispatchOutcome('normal', () => 0.7), 'join');
});
