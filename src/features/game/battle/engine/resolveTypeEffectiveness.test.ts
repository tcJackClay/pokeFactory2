import test from 'node:test';
import assert from 'node:assert/strict';

import type { GamePokemon, Move, MoveBattleData, Nature, Stats } from '../../../../types';
import { setVolatileStatus } from '../../utils/battleStatus';
import { getResolvedMoveAccuracy } from './resolveAccuracy';
import { getMoveTypeMultiplier } from './resolveTypeEffectiveness';
import { resolveTypeImmunityReaction } from './resolveTypeImmunityReaction';

const TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const;

const REFERENCE_NON_NEUTRAL: Record<string, Record<string, number>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

const DEFAULT_STATS: Stats = { hp: 100, attack: 100, defense: 100, spAtk: 100, spDef: 100, speed: 100 };
const DEFAULT_NATURE: Nature = { name: 'hardy', zhName: 'Hardy', plus: 'attack', minus: 'attack' };

function createBattleData(effectId: string = 'NONE'): MoveBattleData {
  return {
    effectId,
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
  };
}

function createMove(type: string, effectId = 'NONE'): Move {
  return {
    name: effectId.toLowerCase(),
    power: 80,
    accuracy: 100,
    type,
    damage_class: 'special',
    pp: 10,
    currentPp: 10,
    battleData: createBattleData(effectId),
  };
}

function createPokemon(types: string[], ability = 'run-away', overrides: Partial<GamePokemon> = {}): GamePokemon {
  const typeSlots = types.map((type) => ({ type: { name: type } }));
  return {
    id: 1,
    name: 'target',
    sprites: { front_default: '', back_default: '' },
    stats: [],
    types: typeSlots,
    baseTypes: typeSlots,
    abilities: [{ ability: { name: ability, url: '' } }],
    moves: [],
    currentHp: 100,
    maxHp: 100,
    selectedMoves: [],
    level: 50,
    nature: DEFAULT_NATURE,
    ivs: DEFAULT_STATS,
    evs: DEFAULT_STATS,
    baseStats: DEFAULT_STATS,
    calculatedStats: DEFAULT_STATS,
    statStages: { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0, evasion: 0 },
    volatileStatuses: {},
    ...overrides,
  };
}

test('type effectiveness matches all 324 Pokerogue base chart pairs', () => {
  for (const attackType of TYPES) {
    for (const defendType of TYPES) {
      const expected = REFERENCE_NON_NEUTRAL[attackType]?.[defendType] ?? 1;
      assert.equal(
        getMoveTypeMultiplier(createMove(attackType), createPokemon([defendType])),
        expected,
        `${attackType} -> ${defendType}`,
      );
    }
  }
});

test('type effectiveness multiplies dual types and applies Pokerogue special overrides', () => {
  assert.equal(getMoveTypeMultiplier(createMove('ice'), createPokemon(['grass', 'flying'])), 4);
  assert.equal(getMoveTypeMultiplier(createMove('ice', 'FREEZE_DRY'), createPokemon(['water', 'flying'])), 4);
  assert.equal(getMoveTypeMultiplier(createMove('fighting', 'FLYING_PRESS'), createPokemon(['normal', 'grass'])), 4);
  assert.equal(getMoveTypeMultiplier(createMove('ground', 'THOUSAND_ARROWS'), createPokemon(['flying'])), 1);
  assert.equal(getMoveTypeMultiplier(createMove('stellar'), createPokemon(['normal'])), 1);
  assert.equal(getMoveTypeMultiplier(createMove('stellar'), createPokemon(['normal'], 'run-away', {
    specialBoostActive: true,
    specialBoostMode: 'TERA',
  })), 2);
  assert.equal(
    getMoveTypeMultiplier(
      createMove('normal', 'HIDDEN_POWER'),
      createPokemon(['normal']),
      createPokemon(['normal'], 'run-away', { ivs: { ...DEFAULT_STATS, hp: 0, attack: 0, defense: 0, speed: 0, spAtk: 0, spDef: 0 } }),
    ),
    2,
  );
  assert.equal(
    getMoveTypeMultiplier(
      createMove('normal', 'HIDDEN_POWER'),
      createPokemon(['psychic']),
      createPokemon(['normal'], 'run-away', { ivs: { ...DEFAULT_STATS, hp: 31, attack: 31, defense: 31, speed: 31, spAtk: 31, spDef: 31 } }),
    ),
    2,
  );
});

test('type effectiveness includes Pokerogue immunity abilities and bypasses', () => {
  const attacker = createPokemon(['normal']);
  assert.equal(getMoveTypeMultiplier(createMove('ground'), createPokemon(['electric'], 'levitate'), attacker), 0);
  assert.equal(getMoveTypeMultiplier(createMove('ground'), createPokemon(['electric'], 'levitate'), attacker, ['gravity']), 2);
  assert.equal(getMoveTypeMultiplier(createMove('electric'), createPokemon(['water'], 'volt-absorb'), attacker), 0);
  assert.equal(getMoveTypeMultiplier(createMove('water'), createPokemon(['fire'], 'water-absorb'), attacker), 0);
  assert.equal(getMoveTypeMultiplier(createMove('fire'), createPokemon(['grass'], 'flash-fire'), attacker), 0);
  assert.equal(getMoveTypeMultiplier(createMove('grass'), createPokemon(['water'], 'sap-sipper'), attacker), 0);
  assert.equal(getMoveTypeMultiplier(createMove('normal'), createPokemon(['ghost']), createPokemon(['normal'], 'scrappy')), 1);
  assert.equal(getMoveTypeMultiplier(createMove('normal'), createPokemon(['normal'], 'wonder-guard'), attacker), 0);
  assert.equal(getMoveTypeMultiplier(createMove('fighting'), createPokemon(['normal'], 'wonder-guard'), attacker), 2);
  assert.equal(
    getMoveTypeMultiplier(createMove('electric'), createPokemon(['water'], 'volt-absorb'), createPokemon(['ground'], 'mold-breaker')),
    2,
  );
});

test('Foresight removes Ghost immunity and ignores evasion for accuracy', () => {
  const ghost = setVolatileStatus(createPokemon(['ghost'], 'run-away', {
    statStages: {
      attack: 0,
      defense: 0,
      spAtk: 0,
      spDef: 0,
      speed: 0,
      accuracy: 0,
      evasion: 6,
    },
  }), 'foresight');
  const normalMove = createMove('normal');

  assert.equal(getMoveTypeMultiplier(normalMove, ghost), 1);
  assert.equal(getResolvedMoveAccuracy(normalMove, createPokemon(['normal']), ghost), 100);
});

test('type immunity abilities apply Pokerogue absorption reactions', () => {
  const waterAbsorb = createPokemon(['fire'], 'water-absorb', { currentHp: 50, maxHp: 100 });
  const stormDrain = createPokemon(['fire'], 'storm-drain');
  const sapSipper = createPokemon(['water'], 'sap-sipper');
  const wellBakedBody = createPokemon(['grass'], 'well-baked-body');
  const flashFire = createPokemon(['grass'], 'flash-fire');

  assert.equal(resolveTypeImmunityReaction(createMove('water'), waterAbsorb).defender.currentHp, 75);
  assert.equal(resolveTypeImmunityReaction(createMove('water'), stormDrain).defender.statStages.spAtk, 1);
  assert.equal(resolveTypeImmunityReaction(createMove('grass'), sapSipper).defender.statStages.attack, 1);
  assert.equal(resolveTypeImmunityReaction(createMove('fire'), wellBakedBody).defender.statStages.defense, 2);
  assert.equal(resolveTypeImmunityReaction(createMove('fire'), flashFire).defender.volatileStatuses?.flash_fire?.active, true);

  const groundTypeWithVoltAbsorb = createPokemon(['ground'], 'volt-absorb', { currentHp: 50, maxHp: 100 });
  assert.equal(
    resolveTypeImmunityReaction(createMove('electric'), groundTypeWithVoltAbsorb).defender.currentHp,
    50,
  );
});
