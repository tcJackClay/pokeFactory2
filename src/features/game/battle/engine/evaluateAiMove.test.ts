import test from 'node:test';
import assert from 'node:assert/strict';

import type { GamePokemon, Move, MoveBattleData, Nature, Stats } from '../../../../types';
import { FACTORY_STYLE } from '../../config/factoryBattleStyle';
import { setVolatileStatus } from '../../utils/battleStatus';
import { evaluateAiMove } from './evaluateAiMove';
import { estimateDeterministicDamage } from './resolveDamage';

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
    name: 'tackle',
    power: 50,
    accuracy: 100,
    type: 'normal',
    damage_class: 'physical',
    battleData: createBattleData(overrides.battleData),
    ...overrides,
  };
}

function createPokemon(id: number, overrides: Partial<GamePokemon> = {}): GamePokemon {
  return {
    id,
    name: `mon-${id}`,
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
    moves: [{ move: { name: 'tackle', url: '' } }],
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

test('estimateDeterministicDamage accounts for skill link and loaded dice hit expectations', () => {
  const move = createMove({
    name: 'rock-blast',
    power: 25,
    accuracy: 90,
    type: 'rock',
    battleData: createBattleData({
      strikeMode: 'multi-hit',
      minHits: 2,
      maxHits: 5,
    }),
  });
  const defender = createPokemon(2);

  const baseline = estimateDeterministicDamage(move, createPokemon(1), defender, 'NONE');
  const skillLink = estimateDeterministicDamage(move, createPokemon(1, {
    abilities: [{ ability: { name: 'skill-link', url: '' } }],
  }), defender, 'NONE');
  const loadedDice = estimateDeterministicDamage(move, createPokemon(1, {
    factoryHeldItemId: 'loaded-dice',
  }), defender, 'NONE');

  assert.ok(skillLink > baseline);
  assert.ok(loadedDice > baseline);
});

test('evaluateAiMove heavily penalizes attacks into active protect', () => {
  const attacker = createPokemon(1);
  const defender = setVolatileStatus(createPokemon(2), 'protect', {
    sourceMoveName: 'protect',
  });
  const move = createMove();

  const result = evaluateAiMove({
    move,
    attacker,
    defender,
    preferredStyle: FACTORY_STYLE.NONE,
    fieldState: [],
  });

  assert.equal(result.expectedDamage, 0);
  assert.ok(result.score < 0);
});

test('evaluateAiMove marks taunted status moves and wrong choice-lock picks as blocked', () => {
  const statusMove = createMove({
    name: 'recover',
    power: null,
    accuracy: null,
    damage_class: 'status',
    battleData: createBattleData({
      target: 'user',
      healingPercent: 50,
    }),
  });

  const taunted = setVolatileStatus(createPokemon(1), 'taunt');
  const tauntResult = evaluateAiMove({
    move: statusMove,
    attacker: taunted,
    defender: createPokemon(2),
    preferredStyle: FACTORY_STYLE.NONE,
    fieldState: [],
  });
  assert.equal(tauntResult.blockedReason, 'taunt');

  const wrongChoiceMove = createMove({ name: 'earthquake', type: 'ground' });
  const choiceLocked = createPokemon(1, {
    factoryHeldItemId: 'choice-band',
    factoryChoiceLockedMoveName: 'rock-slide',
  });
  const choiceResult = evaluateAiMove({
    move: wrongChoiceMove,
    attacker: choiceLocked,
    defender: createPokemon(2),
    preferredStyle: FACTORY_STYLE.NONE,
    fieldState: [],
  });
  assert.equal(choiceResult.blockedReason, 'choice-lock');
});

test('evaluateAiMove avoids sleep utility into immunity or sleep-preventing field', () => {
  const sleepMove = createMove({
    name: 'hypnosis',
    power: null,
    accuracy: 60,
    type: 'psychic',
    damage_class: 'status',
    battleData: createBattleData({
      secondaryEffects: [{
        kind: 'status',
        chance: 100,
        appliesTo: 'target',
        requiresHit: true,
        blockedBySubstitute: true,
        statusId: 'sleep',
      }],
    }),
  });
  const insomniaTarget = createPokemon(2, {
    abilities: [{ ability: { name: 'insomnia', url: '' } }],
  });

  const immuneResult = evaluateAiMove({
    move: sleepMove,
    attacker: createPokemon(1),
    defender: insomniaTarget,
    preferredStyle: FACTORY_STYLE.NONE,
    fieldState: [],
  });
  const fieldBlockedResult = evaluateAiMove({
    move: sleepMove,
    attacker: createPokemon(1),
    defender: createPokemon(2),
    preferredStyle: FACTORY_STYLE.NONE,
    fieldState: ['electric_terrain'],
  });

  assert.equal(immuneResult.blockedReason, 'status-immune');
  assert.equal(fieldBlockedResult.blockedReason, 'status-immune');
});
