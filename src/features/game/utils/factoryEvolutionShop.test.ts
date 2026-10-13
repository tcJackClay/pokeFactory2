import test from 'node:test';
import assert from 'node:assert/strict';
import type { GamePokemon, Pokemon } from '../../../types';
import { buildFactoryEvolutionShopProducts, matchingFactoryEvolutionRelations } from './factoryEvolutionShop';

function teammate(slug: string, speciesId: number, gender: GamePokemon['gender'] = 'male'): GamePokemon {
  return { name: slug, pokeApiName: slug, formLedgerSlug: slug, speciesId, gender } as GamePokemon;
}

function target(slug: string, id: number): Pokemon {
  return { name: slug, zhName: slug, species: { url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` } } as unknown as Pokemon;
}

test('shop eligibility follows fixed Rogue rows, including gender and form', () => {
  assert.ok(matchingFactoryEvolutionRelations(teammate('kirlia', 281, 'male'))
    .some((row) => row.itemId === 'dawn_stone' && row.toSlug === 'gallade'));
  assert.equal(matchingFactoryEvolutionRelations(teammate('kirlia', 281, 'female'))
    .some((row) => row.itemId === 'dawn_stone' && row.toSlug === 'gallade'), false);
  assert.ok(matchingFactoryEvolutionRelations(teammate('growlithe-hisui', 58))
    .some((row) => row.itemId === 'fire_stone' && row.toSlug === 'arcanine-hisui'));
  assert.equal(matchingFactoryEvolutionRelations(teammate('growlithe', 58))
    .some((row) => row.toSlug === 'arcanine-hisui'), false);
});

test('shop lists only resource-backed Rogue targets and reports exact missing resource', async () => {
  const result = await buildFactoryEvolutionShopProducts([teammate('eevee', 133)], async (slug) => {
    if (slug === 'flareon') throw new Error('offline');
    const ids: Record<string, number> = { vaporeon: 134, jolteon: 135, glaceon: 471, leafeon: 470 };
    return target(slug, ids[slug] ?? 1);
  });
  assert.equal(result.products.some((product) => product.itemId === 'fire_stone'), false);
  assert.ok(result.degraded.some((row) => row.relation.startsWith('fire_stone:')
    && row.reason === 'target-resource-unavailable'));
  assert.ok(result.products.some((product) => product.itemId === 'water_stone'
    && product.targets.some((row) => row.toPokeApiName === 'vaporeon' && row.fromSpeciesId === 133)));
  assert.equal(result.products.some((product) => String(product.itemId) === 'kings_rock'), false);
});

test('a mismatched target form is never offered under its source relation', async () => {
  const result = await buildFactoryEvolutionShopProducts([teammate('growlithe-hisui', 58)], async () => target('arcanine', 59));
  assert.equal(result.products.some((product) => product.itemId === 'fire_stone'), false);
  assert.ok(result.degraded.some((row) => row.reason === 'target-form-resource-mismatch'));
});
