import type { PokemonIdentifier } from '../../../services/pokeApi';

export type FactorySpeciesEvolutionStage = 'BASE' | 'MID' | 'FINAL';

export interface FactorySpeciesIndexEntry {
  identifier: string;
  speciesId: number;
  pokemonId: number;
  gen: number;
  bst: number;
  evolutionStage: FactorySpeciesEvolutionStage;
}

let factorySpeciesIndexPromise: Promise<Map<string, FactorySpeciesIndexEntry>> | null = null;
const FACTORY_SPECIES_INDEX_URL = `${import.meta.env.BASE_URL}data/factorySpeciesIndex.json`;

async function loadFactorySpeciesIndexMap(): Promise<Map<string, FactorySpeciesIndexEntry>> {
  if (!factorySpeciesIndexPromise) {
    factorySpeciesIndexPromise = fetch(FACTORY_SPECIES_INDEX_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load factory species index: HTTP ${response.status}`);
        }
        const entries = await response.json() as FactorySpeciesIndexEntry[];
        return new Map(entries.map((entry) => [entry.identifier, entry] as const));
      })
      .catch((error) => {
        factorySpeciesIndexPromise = null;
        throw error;
      });
  }

  return factorySpeciesIndexPromise;
}

export async function preloadFactorySpeciesIndex(): Promise<void> {
  await loadFactorySpeciesIndexMap();
}

export async function getFactorySpeciesIndexEntry(
  identifier: PokemonIdentifier,
): Promise<FactorySpeciesIndexEntry | null> {
  const key = typeof identifier === 'string'
    ? identifier.trim().toLowerCase()
    : String(identifier);

  const index = await loadFactorySpeciesIndexMap();
  return index.get(key) ?? null;
}
