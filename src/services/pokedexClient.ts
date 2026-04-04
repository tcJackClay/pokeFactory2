interface LocalizedName {
  name: string;
  language: { name: string };
}

export type DexFormCategory = 'BASE' | 'FORM' | 'REGIONAL' | 'GENDER';

interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface DexSnapshot {
  id: number;
  apiName: string;
  zhName?: string;
  names: LocalizedName[];
  sprite: string;
  types: string[];
  baseStats: BaseStats;
}

export interface DexCatalogEntry {
  id: number;
  apiName: string;
  formCategory: DexFormCategory;
}

const TYPE_NAMES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const;

const dexSnapshotCache = new Map<number, DexSnapshot>();
let dexCatalogCache: DexCatalogEntry[] | null = null;
let dexTypeMapCache: Record<string, string[]> | null = null;
let pokemonClientPromise: Promise<{
  getPokemonById: (id: number) => Promise<any>;
  getPokemonSpeciesById: (id: number) => Promise<any>;
  listPokemons: (offset?: number, limit?: number) => Promise<{ results: Array<{ name: string; url: string }> }>;
  getTypeByName: (typeName: string) => Promise<{ pokemon: Array<{ pokemon: { name: string } }> }>;
}> | null = null;

async function getPokemonClient() {
  if (!pokemonClientPromise) {
    pokemonClientPromise = import('pokenode-ts').then(({ PokemonClient, UtilityClient }) => {
      const pokemonClient = new PokemonClient();
      const utilityClient = new UtilityClient();
      return {
        getPokemonById: pokemonClient.getPokemonById.bind(pokemonClient),
        getPokemonSpeciesById: pokemonClient.getPokemonSpeciesById.bind(pokemonClient),
        listPokemons: pokemonClient.listPokemons.bind(pokemonClient),
        getTypeByName: utilityClient.getTypeByName.bind(utilityClient),
      };
    });
  }
  return pokemonClientPromise;
}

function toBaseStats(stats: Array<{ base_stat: number; stat: { name: string } }>): BaseStats {
  return {
    hp: stats.find((item) => item.stat.name === 'hp')?.base_stat ?? 0,
    attack: stats.find((item) => item.stat.name === 'attack')?.base_stat ?? 0,
    defense: stats.find((item) => item.stat.name === 'defense')?.base_stat ?? 0,
    spAtk: stats.find((item) => item.stat.name === 'special-attack')?.base_stat ?? 0,
    spDef: stats.find((item) => item.stat.name === 'special-defense')?.base_stat ?? 0,
    speed: stats.find((item) => item.stat.name === 'speed')?.base_stat ?? 0,
  };
}

function getZhName(names: LocalizedName[]): string | undefined {
  const zhHans = names.find((entry) => entry.language.name === 'zh-hans')?.name;
  if (zhHans) return zhHans;
  return names.find((entry) => entry.language.name === 'zh-hant')?.name;
}

function parseIdFromUrl(url: string): number | null {
  const match = /\/(\d+)\/?$/.exec(url);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function classifyFormCategory(apiName: string): DexFormCategory {
  const normalized = apiName.toLowerCase();
  if (!normalized.includes('-')) return 'BASE';
  if (normalized.includes('-alola') || normalized.includes('-galar') || normalized.includes('-hisui') || normalized.includes('-paldea')) {
    return 'REGIONAL';
  }
  if (
    normalized.endsWith('-female')
    || normalized.endsWith('-male')
    || normalized.endsWith('-f')
    || normalized.endsWith('-m')
  ) {
    return 'GENDER';
  }
  return 'FORM';
}

export async function fetchDexCatalogEntries(): Promise<DexCatalogEntry[]> {
  if (dexCatalogCache) return dexCatalogCache;

  try {
    const pokemonClient = await getPokemonClient();
    const response = await pokemonClient.listPokemons(0, 20000);

    const entries = response.results
      .map((item) => {
        const id = parseIdFromUrl(item.url);
        if (!id) return null;
        return {
          id,
          apiName: item.name.toLowerCase(),
          formCategory: classifyFormCategory(item.name),
        } satisfies DexCatalogEntry;
      })
      .filter((entry): entry is DexCatalogEntry => Boolean(entry))
      .sort((a, b) => a.id - b.id || a.apiName.localeCompare(b.apiName));

    dexCatalogCache = entries;
    return entries;
  } catch (error) {
    console.error('Failed to fetch dex catalog entries', error);
    return [];
  }
}

export async function fetchDexTypeMap(): Promise<Record<string, string[]>> {
  if (dexTypeMapCache) return dexTypeMapCache;

  try {
    const pokemonClient = await getPokemonClient();
    const rawMap = new Map<string, Set<string>>();

    await Promise.all(TYPE_NAMES.map(async (typeName) => {
      const typePayload = await pokemonClient.getTypeByName(typeName);
      typePayload.pokemon.forEach(({ pokemon }) => {
        const normalizedName = pokemon.name.toLowerCase();
        const current = rawMap.get(normalizedName) ?? new Set<string>();
        current.add(typeName);
        rawMap.set(normalizedName, current);
      });
    }));

    const normalized: Record<string, string[]> = {};
    rawMap.forEach((types, name) => {
      normalized[name] = [...types].sort((a, b) => a.localeCompare(b));
    });

    dexTypeMapCache = normalized;
    return normalized;
  } catch (error) {
    console.error('Failed to build dex type map', error);
    return {};
  }
}

export async function fetchDexSnapshotById(id: number): Promise<DexSnapshot | null> {
  if (dexSnapshotCache.has(id)) {
    return dexSnapshotCache.get(id) ?? null;
  }

  try {
    const pokemonClient = await getPokemonClient();
    const [pokemon, species] = await Promise.all([
      pokemonClient.getPokemonById(id),
      pokemonClient.getPokemonSpeciesById(id),
    ]);

    const names = species.names.map((entry) => ({
      name: entry.name,
      language: { name: entry.language.name },
    }));

    const snapshot: DexSnapshot = {
      id: pokemon.id,
      apiName: pokemon.name,
      zhName: getZhName(names),
      names,
      sprite: pokemon.sprites.front_default ?? '',
      types: pokemon.types.map((slot) => slot.type.name),
      baseStats: toBaseStats(pokemon.stats),
    };

    dexSnapshotCache.set(id, snapshot);
    return snapshot;
  } catch (error) {
    console.error(`Failed to fetch dex snapshot for #${id}`, error);
    return null;
  }
}

export async function fetchDexSnapshots(ids: number[]): Promise<Record<number, DexSnapshot>> {
  const uniqueIds = [...new Set(ids)].filter((id) => Number.isFinite(id) && id > 0);
  const result: Record<number, DexSnapshot> = {};

  if (uniqueIds.length === 0) return result;

  const snapshots = await Promise.all(uniqueIds.map((id) => fetchDexSnapshotById(id)));

  snapshots.forEach((snapshot) => {
    if (!snapshot) return;
    result[snapshot.id] = snapshot;
  });

  return result;
}
