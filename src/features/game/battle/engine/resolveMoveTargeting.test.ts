import test from 'node:test';
import assert from 'node:assert/strict';
import type { Move } from '../../../../types';
import { buildMoveBattleDataFromPokeApiMove } from '../../data/battle';
import { isNonOpponentStatusMove } from './resolveMoveTargeting';

function convertedMove(name: string, target: string): Move {
  return {
    name, type: 'normal', damage_class: 'status', power: 0, accuracy: null,
    battleData: buildMoveBattleDataFromPokeApiMove({ name, target: { name: target }, damage_class: { name: 'status' } }),
  };
}

test('status targeting uses converted target overrides and actual field effects', () => {
  for (const [name, target] of [
    ['calm-mind', 'user'], ['light-screen', 'users-field'],
    ['rain-dance', 'entire-field'], ['trick-room', 'entire-field'],
    ['toxic-spikes', 'opponents-field'], ['stealth-rock', 'opponents-field'],
    ['haze', 'all-pokemon'],
  ]) {
    assert.equal(isNonOpponentStatusMove(convertedMove(name, target)), true, name);
  }
  const legacyWeather = convertedMove('rain-dance', 'selected-pokemon');
  assert.equal(isNonOpponentStatusMove(legacyWeather), true);
  for (const target of ['user-field', 'users-field']) {
    assert.equal(isNonOpponentStatusMove(convertedMove('mist', target)), true);
  }
  const legacyHaze = convertedMove('haze', 'all-pokemon');
  legacyHaze.battleData!.target = 'all-pokemon';
  assert.equal(isNonOpponentStatusMove(legacyHaze), true);
});

test('multiple Pokemon and unknown labels never imply a field-effect bypass', () => {
  for (const [name, target] of [
    ['teeter-dance', 'all-pokemon'], ['feather-dance', 'selected-pokemon'],
    ['growl', 'all-opponents'], ['unclassified', 'unknown-target'],
  ]) assert.equal(isNonOpponentStatusMove(convertedMove(name, target)), false, name);
  assert.equal(isNonOpponentStatusMove({ ...convertedMove('calm-mind', 'user'), damage_class: 'physical' }), false);
});
