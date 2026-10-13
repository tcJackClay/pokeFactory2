import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTORY_EVOLUTION_ITEM_IDS } from './factoryEvolutionItems';
import { FACTORY_EVOLUTION_RELATIONS } from './factoryEvolutionRelations.generated';

test('pinned Rogue expansion item evolutions are exactly 39 items and 94 distinct relations', () => {
  assert.equal(FACTORY_EVOLUTION_RELATIONS.length, 94);
  assert.deepEqual(new Set(FACTORY_EVOLUTION_RELATIONS.map((row) => row.itemId)), new Set(FACTORY_EVOLUTION_ITEM_IDS));
  const keys = FACTORY_EVOLUTION_RELATIONS.map((row) => [row.itemId, row.fromSymbol, row.toSymbol, row.gender].join(':'));
  assert.equal(new Set(keys).size, 94);
  assert.equal(FACTORY_EVOLUTION_RELATIONS.some((row) => String(row.itemId) === 'kings_rock'), false);
});

test('pinned relations retain trade replacement, branches, regional forms and gender restrictions', () => {
  assert.ok(FACTORY_EVOLUTION_RELATIONS.some((row) => row.itemId === 'linking_cord'
    && row.fromSlug === 'haunter' && row.toSlug === 'gengar'));
  assert.ok(FACTORY_EVOLUTION_RELATIONS.some((row) => row.itemId === 'dawn_stone'
    && row.fromSlug === 'kirlia' && row.toSlug === 'gallade' && row.gender === 'male'));
  assert.ok(FACTORY_EVOLUTION_RELATIONS.some((row) => row.itemId === 'dawn_stone'
    && row.fromSlug === 'snorunt' && row.toSlug === 'froslass' && row.gender === 'female'));
  assert.ok(FACTORY_EVOLUTION_RELATIONS.some((row) => row.itemId === 'fire_stone'
    && row.fromSlug === 'growlithe-hisui' && row.toSlug === 'arcanine-hisui'));
  assert.equal(FACTORY_EVOLUTION_RELATIONS.filter((row) => row.fromSlug === 'eevee').length >= 3, true);
});
