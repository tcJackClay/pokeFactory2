import test from 'node:test';
import assert from 'node:assert/strict';
import type { GamePokemon, Move, TailwindTurns } from '../../../../types';
import { resolveActionSelection } from './resolveActionSelection';
import { resolveTailwindUse } from './resolveTailwind';

function pokemon(id: number, speed: number): GamePokemon {
  return {
    id,
    name: `pokemon-${id}`,
    abilities: [{ ability: { name: 'run-away', url: '' } }],
    calculatedStats: { hp: 100, attack: 80, defense: 80, spAtk: 80, spDef: 80, speed },
    statStages: { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0, evasion: 0 },
  } as GamePokemon;
}

function move(priority = 0): Move {
  return { name: 'tackle', power: 40, accuracy: 100, type: 'normal', damage_class: 'physical', battleData: { priority } } as Move;
}

function enemyActsFirst(turns: TailwindTurns, fieldState: Array<'trick_room'> = [], playerMove = move(), enemyMove = move()) {
  return resolveActionSelection({
    playerPokemon: pokemon(1, 50),
    playerMove,
    enemyPokemon: pokemon(2, 80),
    enemyMove,
    fieldState,
    tailwindTurns: turns,
    playerQuickClawActivated: false,
    enemyQuickClawActivated: false,
  }).enemyActsFirst;
}

test('Tailwind boosts only its own side and duplicate use does not refresh it', () => {
  const empty = { player: 0, enemy: 0 };
  const started = resolveTailwindUse(empty, 'player');
  assert.deepEqual(started, { succeeded: true, turns: { player: 4, enemy: 0 } });
  assert.equal(enemyActsFirst(empty), true);
  assert.equal(enemyActsFirst(started.turns), false);
  assert.equal(enemyActsFirst({ player: 0, enemy: 4 }), true);
  assert.deepEqual(resolveTailwindUse({ player: 2, enemy: 0 }, 'player'), {
    succeeded: false,
    turns: { player: 2, enemy: 0 },
  });
  assert.deepEqual(resolveTailwindUse({ player: 2, enemy: 0 }, 'enemy'), {
    succeeded: true,
    turns: { player: 2, enemy: 4 },
  });
});

test('priority is compared before Tailwind speed and Trick Room reverses final speed', () => {
  const playerTailwind = { player: 4, enemy: 0 };
  assert.equal(enemyActsFirst(playerTailwind, [], move(), move(1)), true);
  assert.equal(enemyActsFirst(playerTailwind, [], move(1), move()), false);
  assert.equal(enemyActsFirst(playerTailwind, ['trick_room']), true);
  assert.equal(enemyActsFirst({ player: 0, enemy: 0 }, ['trick_room']), false);
});
