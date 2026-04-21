import test from 'node:test';
import assert from 'node:assert/strict';

import type { GamePokemon, Nature, Stats } from '../../../../types';
import { setVolatileStatus } from '../../utils/battleStatus';
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
