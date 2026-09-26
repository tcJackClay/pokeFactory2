import test from 'node:test';
import assert from 'node:assert/strict';

import type { GamePokemon, Nature, Stats } from '../../../../types';
import { setNonVolatileStatus, setVolatileStatus } from '../../utils/battleStatus';
import { clearSwitchingBattleState } from './resolveSwitchState';

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

function createPokemon(overrides: Partial<GamePokemon> = {}): GamePokemon {
  return {
    id: 1,
    name: 'switcher',
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
    selectedMoves: [],
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
    factoryChoiceLockedMoveName: 'tackle',
    factoryLastUsedMoveName: 'tackle',
    ...overrides,
  };
}

test('clearSwitchingBattleState clears volatile restrictions and move lock state on switch', () => {
  let pokemon = createPokemon();
  pokemon = setVolatileStatus(pokemon, 'taunt');
  pokemon = setVolatileStatus(pokemon, 'encore', { linkedMoveName: 'tackle' });
  pokemon = setVolatileStatus(pokemon, 'substitute', { counter: 25 });
  pokemon = setVolatileStatus(pokemon, 'protect_chain', { counter: 2 });

  const cleared = clearSwitchingBattleState(pokemon);

  assert.deepEqual(cleared.volatileStatuses, {});
  assert.equal(cleared.factoryChoiceLockedMoveName, null);
  assert.equal(cleared.factoryLastUsedMoveName, null);
});

test('clearSwitchingBattleState preserves team-side status counters on switch', () => {
  let pokemon = setVolatileStatus(createPokemon(), 'safeguard', { turnsRemaining: 3 });
  pokemon = setVolatileStatus(pokemon, 'reflect', { turnsRemaining: 2 });
  pokemon = setVolatileStatus(pokemon, 'light-screen', { turnsRemaining: 4 });
  pokemon = setVolatileStatus(pokemon, 'taunt', { turnsRemaining: 3 });

  const cleared = clearSwitchingBattleState(pokemon);

  assert.equal(cleared.volatileStatuses?.safeguard?.turnsRemaining, 3);
  assert.equal(cleared.volatileStatuses?.reflect?.turnsRemaining, 2);
  assert.equal(cleared.volatileStatuses?.light_screen?.turnsRemaining, 4);
  assert.equal(cleared.volatileStatuses?.taunt, undefined);
});

test('clearSwitchingBattleState resets Pokerogue toxic escalation on switch', () => {
  const toxicPokemon = setNonVolatileStatus(createPokemon(), 'bad_poison', {
    toxicCounter: 6,
    sourceMoveName: 'toxic',
  });

  const cleared = clearSwitchingBattleState(toxicPokemon);

  assert.equal(cleared.nonVolatileStatus?.id, 'bad_poison');
  assert.equal(cleared.nonVolatileStatus?.toxicCounter, 1);
  assert.equal(cleared.nonVolatileStatus?.sourceMoveName, 'toxic');
});

test('clearSwitchingBattleState cures status for Natural Cure', () => {
  const poisonedPokemon = setNonVolatileStatus(createPokemon({
    abilities: [{ ability: { name: 'natural-cure', url: '' } }],
  }), 'poison');

  const cleared = clearSwitchingBattleState(poisonedPokemon);

  assert.equal(cleared.nonVolatileStatus, undefined);
});

test('clearSwitchingBattleState applies Pokerogue summon-time status cures', () => {
  const cases = [
    ['limber', 'paralysis'],
    ['immunity', 'poison'],
    ['magma-armor', 'freeze'],
    ['water-veil', 'burn'],
    ['insomnia', 'sleep'],
    ['purifying-salt', 'bad_poison'],
  ] as const;

  for (const [ability, status] of cases) {
    const pokemon = setNonVolatileStatus(createPokemon({
      abilities: [{ ability: { name: ability, url: '' } }],
    }), status);
    assert.equal(clearSwitchingBattleState(pokemon).nonVolatileStatus, undefined, ability);
  }
});
