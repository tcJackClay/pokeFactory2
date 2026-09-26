import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { GamePokemon, Move, Nature, Stats } from '../../../../types';
import { buildMoveBattleDataFromPokeApiMove } from '../../data/battle';
import { setVolatileStatus } from '../../utils/battleStatus';
import { resolveActionSelection } from './resolveActionSelection';
import { calculateDamage } from './resolveDamage';
import { resolveMoveStrikePlan } from './resolveMoveStrikes';

type CacheMove = {
  cacheBodySha256: string;
  data: {
    id: number;
    name: string;
    power: number;
    accuracy: number | null;
    pp: number;
    priority: number;
    type: { name: string };
    damage_class: { name: 'physical' | 'special' };
    target: { name: string };
    meta: { crit_rate: number; min_hits: number | null; max_hits: number | null };
    stat_changes: unknown[];
  };
};
const cache = JSON.parse(readFileSync(path.resolve(process.cwd(), 'src/features/game/battle/engine/fixtures/rogue-tm-direct-cache.json'), 'utf8')) as {
  moves: Record<string, CacheMove>;
};

const stats: Stats = { hp: 100, attack: 100, defense: 100, spAtk: 100, spDef: 100, speed: 100 };
const nature: Nature = { name: 'hardy', zhName: 'Hardy', plus: 'attack', minus: 'attack' };

function move(name: string): Move {
  const entry = cache.moves[name];
  assert.ok(entry, `missing verified cache snapshot for ${name}`);
  const data = entry.data;
  assert.match(entry.cacheBodySha256, /^[a-f0-9]{64}$/);
  assert.equal(data.name, name, `cache snapshot name differs from ${name}`);
  return {
    name: data.name,
    power: data.power,
    accuracy: data.accuracy,
    type: data.type.name,
    damage_class: data.damage_class.name,
    pp: data.pp,
    currentPp: data.pp,
    battleData: buildMoveBattleDataFromPokeApiMove(data),
  };
}

function pokemon(id: number, types: string[] = ['psychic'], speed = 100, ability = 'run-away'): GamePokemon {
  const slots = types.map((name) => ({ type: { name } }));
  return {
    id, name: `pokemon-${id}`, sprites: { front_default: '', back_default: '' },
    stats: [
      { base_stat: 100, stat: { name: 'hp' } },
      { base_stat: 100, stat: { name: 'attack' } },
      { base_stat: 100, stat: { name: 'defense' } },
      { base_stat: 100, stat: { name: 'special-attack' } },
      { base_stat: 100, stat: { name: 'special-defense' } },
      { base_stat: speed, stat: { name: 'speed' } },
    ],
    types: slots, baseTypes: slots, abilities: [{ ability: { name: ability, url: '' } }],
    moves: [], currentHp: 200, maxHp: 200, selectedMoves: [], level: 50,
    nature, ivs: stats, evs: stats, baseStats: stats,
    calculatedStats: { ...stats, speed },
    statStages: { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0, evasion: 0 },
    volatileStatuses: {}, factoryLastUsedMoveName: null,
  };
}

function hit(selectedMove: Move, attacker = pokemon(1), defender = pokemon(2), fieldState: ('gravity' | 'grassy_terrain')[] = [], randomRolls = [0, 0.9, 0.9]) {
  let index = 0;
  return calculateDamage({
    move: selectedMove, attacker, defender, weather: 'none', fieldState,
    atkBuff: false, defBuff: false, random: () => randomRolls[index++] ?? 0.9,
  });
}

test('verified PokeAPI cache conversion yields eight direct single-strike Rogue TM moves', () => {
  const expectations = [
    ['surf', 57, 'water', 'special', 90, 0, 'all-other-pokemon'],
    ['aqua-jet', 453, 'water', 'physical', 40, 1, 'selected-pokemon'],
    ['aura-sphere', 396, 'fighting', 'special', 80, 0, 'selected-pokemon'],
    ['earthquake', 89, 'ground', 'physical', 100, 0, 'all-other-pokemon'],
    ['aerial-ace', 332, 'flying', 'physical', 60, 0, 'selected-pokemon'],
    ['stone-edge', 444, 'rock', 'physical', 100, 0, 'selected-pokemon'],
    ['shadow-sneak', 425, 'ghost', 'physical', 40, 1, 'selected-pokemon'],
    ['dazzling-gleam', 605, 'fairy', 'special', 80, 0, 'all-opponents'],
  ] as const;
  for (const [name, id, type, damageClass, power, priority, target] of expectations) {
    const data = cache.moves[name].data;
    const selectedMove = move(name);
    assert.equal(data.id, id, name);
    assert.equal(selectedMove.type, type, name);
    assert.equal(selectedMove.damage_class, damageClass, name);
    assert.equal(selectedMove.power, power, name);
    assert.equal(selectedMove.battleData?.priority, priority, name);
    assert.equal(selectedMove.battleData?.target, target, name);
    assert.deepEqual(resolveMoveStrikePlan({ move: selectedMove, attacker: pokemon(1) }), { plannedHits: 1, usesIndependentAccuracy: false }, name);
    assert.equal(selectedMove.battleData?.secondaryEffects.length, 0, name);
    const forward = hit(selectedMove);
    const reverse = hit(selectedMove, pokemon(2), pokemon(1));
    assert.ok(forward.damage > 0 && reverse.damage > 0, `${name} must damage from both sides`);
    assert.equal(forward.damage, reverse.damage, name);
    const guarded = hit(selectedMove, pokemon(1), setVolatileStatus(pokemon(2), 'protect'));
    assert.equal(guarded.damage, 0, `${name} ignored Protect`);
    assert.equal(guarded.blockedByProtect, true, name);
  }
});

test('TM07 Surf and TM48 Dazzling Gleam hit one opponent once in singles', () => {
  for (const name of ['surf', 'dazzling-gleam']) {
    const selectedMove = move(name);
    const plan = resolveMoveStrikePlan({ move: selectedMove, attacker: pokemon(1) });
    assert.equal(plan.plannedHits, 1);
    const result = hit(selectedMove);
    assert.ok(result.damage > 0);
    assert.equal(Math.min(200, result.damage), result.damage);
  }
  assert.equal(hit(move('surf'), pokemon(1), pokemon(2, ['normal'], 100, 'water-absorb')).damage, 0);
  assert.equal(hit(move('dazzling-gleam'), pokemon(1), pokemon(2, ['dragon'])).multiplier, 2);
});

test('TM08 Aqua Jet and TM38 Shadow Sneak act before faster ordinary moves; higher priority still wins', () => {
  const slow = pokemon(1, ['normal'], 50);
  const fast = pokemon(2, ['normal'], 150);
  for (const name of ['aqua-jet', 'shadow-sneak']) {
    assert.equal(resolveActionSelection({ playerPokemon: slow, playerMove: move(name), enemyPokemon: fast, enemyMove: move('surf'), fieldState: [], playerQuickClawActivated: false, enemyQuickClawActivated: false }).enemyActsFirst, false);
    assert.equal(resolveActionSelection({ playerPokemon: slow, playerMove: move('surf'), enemyPokemon: fast, enemyMove: move(name), fieldState: [], playerQuickClawActivated: false, enemyQuickClawActivated: false }).enemyActsFirst, true);
    assert.equal(resolveActionSelection({ playerPokemon: slow, playerMove: move(name), enemyPokemon: fast, enemyMove: move(name), fieldState: [], playerQuickClawActivated: false, enemyQuickClawActivated: false }).enemyActsFirst, true);
    assert.equal(resolveActionSelection({ playerPokemon: slow, playerMove: move(name), enemyPokemon: fast, enemyMove: { ...move(name), battleData: { ...move(name).battleData!, priority: 2 } }, fieldState: [], playerQuickClawActivated: false, enemyQuickClawActivated: false }).enemyActsFirst, true);
    assert.ok(hit(move(name)).damage > 0);
  }
  assert.equal(hit(move('shadow-sneak'), pokemon(1), pokemon(2, ['normal'])).damage, 0);
});

test('TM21 Aura Sphere and TM27 Aerial Ace bypass evasion but not immunity or Protect', () => {
  for (const name of ['aura-sphere', 'aerial-ace']) {
    const selectedMove = move(name);
    assert.equal(selectedMove.accuracy, null);
    const elusive = pokemon(2);
    elusive.statStages.evasion = 6;
    assert.ok(hit(selectedMove, pokemon(1), elusive, [], [0.999999, 0.9]).damage > 0);
  }
  assert.equal(hit(move('aura-sphere'), pokemon(1), pokemon(2, ['ghost'])).damage, 0);
});

test('TM25 Earthquake respects Flying and Levitate immunity, gravity and grassy terrain', () => {
  const quake = move('earthquake');
  const grounded = pokemon(2, ['normal']);
  const flying = pokemon(2, ['flying']);
  assert.equal(hit(quake, pokemon(1), flying).damage, 0);
  assert.ok(hit(quake, pokemon(1), flying, ['gravity']).damage > 0);
  assert.equal(hit(quake, pokemon(1), pokemon(2, ['normal'], 100, 'levitate')).damage, 0);
  assert.ok(hit(quake, pokemon(1), pokemon(2, ['normal'], 100, 'levitate'), ['gravity']).damage > 0);
  const ordinary = hit(quake, pokemon(1), grounded);
  const grass = hit(quake, pokemon(1), grounded, ['grassy_terrain']);
  assert.ok(grass.damage > 0 && grass.damage < ordinary.damage, `${grass.damage} should be below ${ordinary.damage}`);
});

test('TM34 Stone Edge uses higher critical stage and misses at 80 accuracy', () => {
  const edge = move('stone-edge');
  assert.equal(edge.battleData?.critStage, 1);
  assert.equal(hit(edge, pokemon(1), pokemon(2), [], [0.99]).isMiss, true);
  const ordinary = move('earthquake');
  const critRolls = [0, 0.06, 0.9];
  assert.equal(hit(edge, pokemon(1), pokemon(2), [], critRolls).isCrit, true);
  assert.equal(hit(ordinary, pokemon(1), pokemon(2), [], critRolls).isCrit, false);
  const critical = hit(edge, pokemon(1), pokemon(2), [], critRolls);
  const normal = hit(edge, pokemon(1), pokemon(2), [], [0, 0.99, 0.9]);
  assert.ok(critical.damage > normal.damage);
});
