import test from 'node:test';
import assert from 'node:assert/strict';

import type { GamePokemon, Move, MoveBattleData, Nature, Stats } from '../../../../types';
import { setVolatileStatus } from '../../utils/battleStatus';
import { clearProtectionChain, resolveProtectionCollision, resolveProtectionMoveUse } from './resolveProtection';

const DEFAULT_NATURE: Nature = {
  name: 'hardy',
  zhName: 'Hardy',
  plus: 'attack',
  minus: 'attack',
};

const DEFAULT_STATS: Stats = {
  hp: 100,
  attack: 100,
  defense: 100,
  spAtk: 100,
  spDef: 100,
  speed: 100,
};

function createBattleData(overrides: Partial<MoveBattleData> = {}): MoveBattleData {
  return {
    effectId: 'NONE',
    priority: 0,
    target: 'selected-pokemon',
    flags: [],
    critStage: 0,
    drainPercent: 0,
    recoilPercent: 0,
    healingPercent: 0,
    strikeMode: 'single',
    minHits: 1,
    maxHits: 1,
    secondaryEffects: [],
    substituteInteraction: 'blocked',
    makesContact: false,
    soundMove: false,
    powderMove: false,
    ballisticMove: false,
    punchMove: false,
    bypassProtect: false,
    ignoreAccuracyCheck: false,
    ...overrides,
  };
}

function createMove(overrides: Partial<Move> = {}): Move {
  return {
    name: 'protect',
    power: null,
    accuracy: null,
    type: 'normal',
    damage_class: 'status',
    battleData: createBattleData(overrides.battleData),
    ...overrides,
  };
}

function createPokemon(overrides: Partial<GamePokemon> = {}): GamePokemon {
  return {
    id: 1,
    name: 'protector',
    sprites: { front_default: '', back_default: '' },
    stats: [
      { base_stat: 100, stat: { name: 'hp' } },
      { base_stat: 100, stat: { name: 'attack' } },
      { base_stat: 100, stat: { name: 'defense' } },
      { base_stat: 100, stat: { name: 'special-attack' } },
      { base_stat: 100, stat: { name: 'special-defense' } },
      { base_stat: 100, stat: { name: 'speed' } },
    ],
    types: [{ type: { name: 'normal' } }],
    baseTypes: [{ type: { name: 'normal' } }],
    abilities: [{ ability: { name: 'run-away', url: '' } }],
    moves: [{ move: { name: 'protect', url: '' } }],
    currentHp: 100,
    maxHp: 100,
    selectedMoves: [createMove()],
    level: 50,
    nature: DEFAULT_NATURE,
    ivs: DEFAULT_STATS,
    evs: DEFAULT_STATS,
    baseStats: DEFAULT_STATS,
    calculatedStats: DEFAULT_STATS,
    statStages: {
      attack: 0,
      defense: 0,
      spAtk: 0,
      spDef: 0,
      speed: 0,
      accuracy: 0,
      evasion: 0,
    },
    volatileStatuses: {},
    factoryLastUsedMoveName: null,
    ...overrides,
  };
}

test('resolveProtectionMoveUse tracks consecutive protection attempts across protect-like moves', () => {
  const protectMove = createMove({
    name: 'protect',
    battleData: createBattleData({ effectId: 'PROTECT' }),
  });
  const kingsShield = createMove({
    name: 'kings-shield',
    battleData: createBattleData({ effectId: 'KINGS_SHIELD' }),
  });

  const first = resolveProtectionMoveUse(createPokemon(), protectMove, () => 0);
  assert.equal(first.succeeded, true);
  assert.equal(first.pokemon.volatileStatuses?.protect?.sourceMoveName, 'protect');
  assert.equal(first.pokemon.volatileStatuses?.protect_chain?.counter, 1);

  const second = resolveProtectionMoveUse(first.pokemon, kingsShield, () => 0.75);
  assert.equal(second.succeeded, false);
  assert.equal(second.pokemon.volatileStatuses?.protect, undefined);
  assert.equal(second.pokemon.volatileStatuses?.protect_chain?.counter, 2);

  const cleared = clearProtectionChain(second.pokemon);
  assert.equal(cleared.volatileStatuses?.protect_chain, undefined);
});

test('resolveProtectionCollision applies king shield and spiky shield contact penalties', () => {
  const contactMove = createMove({
    name: 'tackle',
    power: 40,
    accuracy: 100,
    damage_class: 'physical',
    battleData: createBattleData({
      effectId: 'NONE',
      makesContact: true,
    }),
  });
  const attacker = createPokemon({ name: 'attacker' });

  const kingsShieldDefender = setVolatileStatus(createPokemon({ id: 2, name: 'shield' }), 'protect', {
    sourceMoveName: 'kings-shield',
  });
  const kingShieldResult = resolveProtectionCollision(attacker, kingsShieldDefender, contactMove);
  assert.equal(kingShieldResult.attacker.statStages.attack, -2);

  const spikyShieldDefender = setVolatileStatus(createPokemon({ id: 3, name: 'spikes' }), 'protect', {
    sourceMoveName: 'spiky-shield',
  });
  const spikyShieldResult = resolveProtectionCollision(attacker, spikyShieldDefender, contactMove);
  assert.equal(spikyShieldResult.attacker.currentHp, 88);
  assert.equal(spikyShieldResult.hpChange, -12);
});
