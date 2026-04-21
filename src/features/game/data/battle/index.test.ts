import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import type { Move } from '../../../../types';
import {
  getItemAccuracyMultiplier,
  buildMoveBattleDataFromPokeApiMove,
  getItemCritStageBonus,
  getItemMentalStatuses,
  getItemPinchHealDenominator,
  getItemPinchStat,
  getItemPinchTriggerDenominator,
  getItemPpRestoreAmount,
  getItemPriorityProcChance,
  getItemSpeciesIds,
  getItemStatusCures,
  getItemSurviveAtOneHpChance,
  getItemTypeBoostMultiplier,
  getItemTypeBoostType,
  getMoveFieldState,
  getMoveAccuracy,
  getMoveCritStage,
  getMoveDrainPercent,
  getMoveHealingPercent,
  getMoveSecondaryEffects,
  getAbilityBattleData,
  getExpectedMoveHitCount,
  getItemBattleData,
  getMovePriority,
  getMoveTarget,
  getMoveWeather,
  getMoveSubstituteInteraction,
  hasAbilityBattleEffect,
  hasItemBattleEffect,
  hasMoveBattleEffect,
  isMegaStoneLikeItem,
  isZCrystalLikeItem,
  itemHasHook,
  rollMoveHitCount,
} from './index';

test('buildMoveBattleDataFromPokeApiMove merges pokeapi flags and local overrides', () => {
  const moveBattleData = buildMoveBattleDataFromPokeApiMove({
    name: 'sleep-talk',
    priority: 0,
    target: { name: 'user' },
    meta: {
      drain: 0,
      healing: 0,
      crit_rate: 0,
      min_hits: null,
      max_hits: null,
    },
    flags: [{ name: 'protect' }, { name: 'mirror' }, { name: 'sound' }],
  });

  assert.equal(moveBattleData.effectId, 'SLEEP_TALK');
  assert.equal(moveBattleData.target, 'user');
  assert.equal(moveBattleData.soundMove, true);
  assert.deepEqual(moveBattleData.flags, ['protect', 'mirror', 'sound']);
});

test('buildMoveBattleDataFromPokeApiMove derives multi-hit and recoil data', () => {
  const moveBattleData = buildMoveBattleDataFromPokeApiMove({
    name: 'double-slap',
    priority: 0,
    target: { name: 'selected-pokemon' },
    meta: {
      drain: -25,
      healing: 0,
      crit_rate: 1,
      min_hits: 2,
      max_hits: 5,
    },
    flags: [{ name: 'contact' }, { name: 'protect' }],
  });

  assert.equal(moveBattleData.effectId, 'NONE');
  assert.equal(moveBattleData.strikeMode, 'multi-hit');
  assert.equal(moveBattleData.minHits, 2);
  assert.equal(moveBattleData.maxHits, 5);
  assert.equal(moveBattleData.recoilPercent, 25);
  assert.equal(moveBattleData.makesContact, true);
});

test('ability and item battle lookups normalize ids', () => {
  assert.equal(getAbilityBattleData('Early_Bird')?.effectId, 'EARLY_BIRD');
  assert.equal(getItemBattleData('choice-band')?.effectId, 'CHOICE_BAND');
  assert.equal(getAbilityBattleData('skill-link')?.effectId, 'SKILL_LINK');
  assert.equal(getItemBattleData('loaded-dice')?.effectId, 'LOADED_DICE');
  assert.equal(getItemBattleData('unknown-item')?.effectId, 'NONE');
  assert.equal(hasAbilityBattleEffect('soundproof', 'SOUNDPROOF'), true);
  assert.equal(hasItemBattleEffect('shell-bell', 'SHELL_BELL'), true);
  assert.equal(itemHasHook('special-z-crystal', 'zmove-mode'), true);
  assert.equal(isMegaStoneLikeItem('red-orb'), true);
  assert.equal(isZCrystalLikeItem('electrium-z'), true);
});

test('item battle helpers expose structured metadata', () => {
  assert.equal(getItemAccuracyMultiplier('bright-powder'), 0.9);
  assert.deepEqual(getItemStatusCures('lum-berry'), ['any-status', 'confusion']);
  assert.equal(getItemPinchTriggerDenominator('sitrus-berry'), 2);
  assert.equal(getItemPinchHealDenominator('sitrus-berry'), 4);
  assert.equal(getItemPinchStat('salac-berry'), 'speed');
  assert.deepEqual(getItemMentalStatuses('mental-herb'), ['attract', 'infatuation', 'taunt', 'encore', 'torment', 'disable']);
  assert.equal(getItemCritStageBonus('scope-lens'), 1);
  assert.equal(getItemPpRestoreAmount('leppa-berry'), 10);
  assert.equal(getItemPriorityProcChance('quick-claw'), 0.2);
  assert.equal(getItemSurviveAtOneHpChance('focus-band'), 0.1);
  assert.equal(getItemTypeBoostType('charcoal'), 'fire');
  assert.equal(getItemTypeBoostMultiplier('charcoal'), 1.1);
  assert.deepEqual(getItemSpeciesIds('thick-club'), [104, 105]);
});

test('hasMoveBattleEffect reads move battle metadata', () => {
  const move: Move = {
    name: 'rest',
    power: null,
    accuracy: null,
    type: 'psychic',
    damage_class: 'status',
    battleData: buildMoveBattleDataFromPokeApiMove({
      name: 'rest',
      priority: 0,
      target: { name: 'user' },
      meta: {},
      flags: [],
    }),
  };

  assert.equal(hasMoveBattleEffect(move, 'REST'), true);
  assert.equal(hasMoveBattleEffect(move, 'UPROAR'), false);
});

test('move battle helpers expose priority and hit counts', () => {
  const move: Move = {
    name: 'protect',
    power: null,
    accuracy: null,
    type: 'normal',
    damage_class: 'status',
    battleData: buildMoveBattleDataFromPokeApiMove({
      name: 'double-slap',
      priority: 0,
      target: { name: 'selected-pokemon' },
      meta: { min_hits: 2, max_hits: 5 },
      flags: [],
    }),
  };
  move.battleData.priority = 3;

  assert.equal(getMovePriority(move), 3);
  assert.equal(getExpectedMoveHitCount(move), 3);
  assert.equal(rollMoveHitCount(move, () => 0), 2);
  assert.equal(rollMoveHitCount(move, () => 0.7), 4);
  assert.equal(rollMoveHitCount(move, () => 0.999999), 5);
});

test('multi-hit helpers account for skill link and loaded dice', () => {
  const move: Move = {
    name: 'rock-blast',
    power: 25,
    accuracy: 90,
    type: 'rock',
    damage_class: 'physical',
    battleData: buildMoveBattleDataFromPokeApiMove({
      name: 'rock-blast',
      priority: 0,
      target: { name: 'selected-pokemon' },
      meta: { min_hits: 2, max_hits: 5 },
      flags: [],
    }),
  };

  assert.equal(getExpectedMoveHitCount(move, {
    abilities: [{ ability: { name: 'skill-link' } }],
  }), 5);
  assert.equal(getExpectedMoveHitCount(move, {
    abilities: [{ ability: { name: 'run-away' } }],
    factoryHeldItemId: 'loaded-dice',
  }), 4.5);
});

test('move battle helpers prefer battle metadata over legacy fields', () => {
  const move: Move = {
    name: 'rest',
    power: null,
    accuracy: 85,
    type: 'psychic',
    damage_class: 'status',
    target: 'selected-pokemon',
    critRate: 1,
    drain: 50,
    healing: 25,
    battleData: {
      effectId: 'REST',
      priority: 0,
      target: 'user',
      flags: [],
      critStage: 3,
      drainPercent: 75,
      recoilPercent: 0,
      healingPercent: 100,
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
      ignoreAccuracyCheck: true,
    },
  };

  assert.equal(getMoveTarget(move), 'user');
  assert.equal(getMoveAccuracy(move), null);
  assert.equal(getMoveCritStage(move), 3);
  assert.equal(getMoveDrainPercent(move), 75);
  assert.equal(getMoveHealingPercent(move), 100);
});

test('move battle data includes secondary effects and field metadata', () => {
  const moveBattleData = buildMoveBattleDataFromPokeApiMove({
    name: 'thunder-wave',
    priority: 0,
    target: { name: 'selected-pokemon' },
    meta: {
      ailment: { name: 'paralysis' },
      ailment_chance: 100,
      flinch_chance: 0,
      crit_rate: 0,
      drain: 0,
      healing: 0,
      min_hits: null,
      max_hits: null,
    },
    stat_changes: [{ change: -1, stat: { name: 'speed' } }],
    flags: [{ name: 'protect' }],
  });

  assert.equal(moveBattleData.secondaryEffects.length, 2);
  assert.equal(moveBattleData.secondaryEffects[0]?.kind, 'status');
  assert.equal(moveBattleData.secondaryEffects[1]?.kind, 'stat-stage');
  assert.equal(moveBattleData.substituteInteraction, 'blocked');

  const weatherMove: Move = {
    name: 'sunny-day',
    power: null,
    accuracy: null,
    type: 'fire',
    damage_class: 'status',
    battleData: buildMoveBattleDataFromPokeApiMove({
      name: 'sunny-day',
      priority: 0,
      target: { name: 'entire-field' },
      meta: {},
      flags: [],
    }),
  };

  const fieldMove: Move = {
    name: 'electric-terrain',
    power: null,
    accuracy: null,
    type: 'electric',
    damage_class: 'status',
    battleData: buildMoveBattleDataFromPokeApiMove({
      name: 'electric-terrain',
      priority: 0,
      target: { name: 'entire-field' },
      meta: {},
      flags: [],
    }),
  };

  assert.equal(getMoveWeather(weatherMove), 'sunny');
  assert.equal(getMoveFieldState(fieldMove), 'electric_terrain');
  assert.deepEqual(getMoveSecondaryEffects(weatherMove), []);
  assert.equal(getMoveSubstituteInteraction(fieldMove), 'blocked');
});

test('move battle data normalizes stat chances and self-targeting overrides', () => {
  const psychicBattleData = buildMoveBattleDataFromPokeApiMove({
    name: 'psychic',
    priority: 0,
    target: { name: 'selected-pokemon' },
    damage_class: { name: 'special' },
    meta: {
      stat_chance: 10,
    },
    stat_changes: [{ change: -1, stat: { name: 'special-defense' } }],
    flags: [{ name: 'protect' }],
  });
  const overheatBattleData = buildMoveBattleDataFromPokeApiMove({
    name: 'overheat',
    priority: 0,
    target: { name: 'selected-pokemon' },
    damage_class: { name: 'special' },
    meta: {
      stat_chance: 100,
    },
    stat_changes: [{ change: -2, stat: { name: 'special-attack' } }],
    flags: [{ name: 'protect' }],
  });

  assert.deepEqual(psychicBattleData.secondaryEffects, [{
    kind: 'stat-stage',
    chance: 10,
    group: 'stat-stage',
    appliesTo: 'target',
    isPrimary: false,
    requiresHit: true,
    blockedBySubstitute: true,
    stat: 'spDef',
    change: -1,
  }]);
  assert.deepEqual(overheatBattleData.secondaryEffects, [{
    kind: 'stat-stage',
    chance: 100,
    group: 'overheat-drop',
    appliesTo: 'user',
    isPrimary: true,
    requiresHit: true,
    blockedBySubstitute: false,
    stat: 'spAtk',
    change: -2,
  }]);
});

test('every held item in factory reference chunks has an explicit battle metadata entry', () => {
  const chunksDir = path.resolve(process.cwd(), 'src/features/game/config/factoryReferenceSets/chunks');
  const chunkFiles = readdirSync(chunksDir).filter((file) => file.endsWith('.ts'));
  const heldItems = new Set<string>();

  for (const chunkFile of chunkFiles) {
    const chunkSource = readFileSync(path.join(chunksDir, chunkFile), 'utf8');
    for (const match of chunkSource.matchAll(/heldItemId: '([^']+)'/g)) {
      heldItems.add(match[1]);
    }
  }

  for (const heldItemId of heldItems) {
    assert.equal(
      getItemBattleData(heldItemId)?.id,
      heldItemId.replace(/-/g, '_'),
      `missing explicit item metadata for ${heldItemId}`,
    );
  }
});
