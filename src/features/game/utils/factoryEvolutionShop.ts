import type { GamePokemon, Pokemon } from '../../../types';
import { fetchPokemon } from '../../../services/pokeApi';
import { FACTORY_EVOLUTION_ITEM_IDS, type FactoryEvolutionItemId } from '../config/factoryEvolutionItems';
import { FACTORY_EVOLUTION_RELATIONS, type FactoryEvolutionRelation } from '../config/factoryEvolutionRelations.generated';
import type { FactoryShopEvolutionItemProduct, FactoryShopEvolutionTarget } from '../config/factoryRewardPool';

/** Rogue expansion's pinned relation list is the only eligibility source. */
export interface FactoryEvolutionShopBuildResult {
  products: FactoryShopEvolutionItemProduct[];
  degraded: { targetIndex: number; relation: string; reason: string }[];
}

export type FetchEvolutionTargetFn = (slug: string) => Promise<Pokemon>;

function speciesIdFromResource(pokemon: Pokemon): number | null {
  const match = /\/(\d+)\/?$/.exec(String((pokemon as Pokemon & { species?: { url?: string } }).species?.url ?? ''));
  const id = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalizeSlug(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function matchingFactoryEvolutionRelations(pokemon: GamePokemon): FactoryEvolutionRelation[] {
  const slug = normalizeSlug(pokemon.formLedgerSlug || pokemon.pokeApiName || pokemon.name);
  return FACTORY_EVOLUTION_RELATIONS.filter((relation) => (
    relation.fromSlug === slug && (relation.gender === null || relation.gender === pokemon.gender)
  ));
}

/** Build shop products from the fixed Rogue map; PokeAPI supplies target resources only. */
export async function buildFactoryEvolutionShopProducts(
  playerTeam: readonly GamePokemon[],
  fetchTarget: FetchEvolutionTargetFn = fetchPokemon,
): Promise<FactoryEvolutionShopBuildResult> {
  const targetsByItem = new Map<FactoryEvolutionItemId, FactoryShopEvolutionTarget[]>();
  const degraded: FactoryEvolutionShopBuildResult['degraded'] = [];
  const targetCache = new Map<string, Promise<Pokemon>>();

  for (let targetIndex = 0; targetIndex < playerTeam.length; targetIndex += 1) {
    const pokemon = playerTeam[targetIndex];
    for (const relation of matchingFactoryEvolutionRelations(pokemon)) {
      const key = `${relation.itemId}:${relation.fromSymbol}:${relation.toSymbol}`;
      if (!Number.isSafeInteger(pokemon.speciesId) || (pokemon.speciesId ?? 0) <= 0) {
        degraded.push({ targetIndex, relation: key, reason: 'missing-source-species-id' });
        continue;
      }
      try {
        let pending = targetCache.get(relation.toSlug);
        if (!pending) {
          pending = fetchTarget(relation.toSlug);
          targetCache.set(relation.toSlug, pending);
        }
        const targetPokemon = await pending;
        const toSpeciesId = speciesIdFromResource(targetPokemon);
        if (!toSpeciesId || normalizeSlug(targetPokemon.name) !== relation.toSlug) {
          degraded.push({ targetIndex, relation: key, reason: 'target-form-resource-mismatch' });
          continue;
        }
        const targets = targetsByItem.get(relation.itemId) ?? [];
        if (!targets.some((target) => target.targetIndex === targetIndex && target.toPokeApiName === relation.toSlug)) {
          targets.push({
            targetIndex,
            fromSpeciesId: pokemon.speciesId!,
            fromPokeApiName: relation.fromSlug,
            toSpeciesId,
            toPokeApiName: relation.toSlug,
            toNameZh: targetPokemon.zhName || targetPokemon.name,
            toNameEn: targetPokemon.name,
          });
        }
        targetsByItem.set(relation.itemId, targets);
      } catch {
        degraded.push({ targetIndex, relation: key, reason: 'target-resource-unavailable' });
      }
    }
  }

  return {
    products: FACTORY_EVOLUTION_ITEM_IDS
      .filter((itemId) => targetsByItem.has(itemId))
      .map((itemId) => ({
        kind: 'EVOLUTION_ITEM' as const,
        itemId,
        targets: [...(targetsByItem.get(itemId) ?? [])].sort((a, b) => (
          a.targetIndex - b.targetIndex || a.toPokeApiName.localeCompare(b.toPokeApiName)
        )),
      })),
    degraded,
  };
}

export function getActiveEvolutionTargets(
  product: FactoryShopEvolutionItemProduct,
  team: readonly GamePokemon[],
): FactoryShopEvolutionTarget[] {
  return product.targets.filter((target) => {
    const pokemon = team[target.targetIndex];
    return pokemon?.speciesId === target.fromSpeciesId
      && normalizeSlug(pokemon.formLedgerSlug || pokemon.pokeApiName || pokemon.name) === target.fromPokeApiName;
  });
}
