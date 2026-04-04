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
  learnableMoves: string[];
}

export interface DexCatalogEntry {
  id: number;
  apiName: string;
  formCategory: DexFormCategory;
}

export interface DexMoveDetail {
  name: string;
  zhName?: string;
  enName?: string;
  type: string;
  damageClass: 'physical' | 'special' | 'status';
  power: number | null;
}

const TYPE_NAMES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const;

const dexSnapshotCache = new Map<number, DexSnapshot>();
const dexMoveCache = new Map<string, DexMoveDetail>();
let dexCatalogCache: DexCatalogEntry[] | null = null;
let dexTypeMapCache: Record<string, string[]> | null = null;
let moveNameFallbackMapPromise: Promise<Record<string, { zh?: string; en?: string }>> | null = null;
let pokemonClientPromise: Promise<{
  getPokemonById: (id: number) => Promise<any>;
  getPokemonSpeciesById: (id: number) => Promise<any>;
  listPokemons: (offset?: number, limit?: number) => Promise<{ results: Array<{ name: string; url: string }> }>;
  getTypeByName: (typeName: string) => Promise<{ pokemon: Array<{ pokemon: { name: string } }> }>;
  getMoveByName: (name: string) => Promise<any>;
}> | null = null;

async function getPokemonClient() {
  if (!pokemonClientPromise) {
    pokemonClientPromise = import('pokenode-ts').then(({ PokemonClient, MoveClient }) => {
      const pokemonClient = new PokemonClient();
      const moveClient = new MoveClient();
      return {
        getPokemonById: pokemonClient.getPokemonById.bind(pokemonClient),
        getPokemonSpeciesById: pokemonClient.getPokemonSpeciesById.bind(pokemonClient),
        listPokemons: pokemonClient.listPokemons.bind(pokemonClient),
        getTypeByName: pokemonClient.getTypeByName.bind(pokemonClient),
        getMoveByName: moveClient.getMoveByName.bind(moveClient),
      };
    }).catch((error) => {
      pokemonClientPromise = null;
      throw error;
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
  const zhHans = names.find((entry) => entry.language.name?.toLowerCase() === 'zh-hans')?.name;
  if (zhHans) return zhHans;
  return names.find((entry) => entry.language.name?.toLowerCase() === 'zh-hant')?.name;
}

function getEnName(names: LocalizedName[]): string | undefined {
  return names.find((entry) => entry.language.name?.toLowerCase() === 'en')?.name;
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    const next = content[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i += 1;
      currentRow.push(currentField);
      if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
      currentRow = [];
      currentField = '';
      continue;
    }

    currentField += ch;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
  }

  return rows;
}

async function loadMoveNameFallbackMap(): Promise<Record<string, { zh?: string; en?: string }>> {
  if (!moveNameFallbackMapPromise) {
    moveNameFallbackMapPromise = (async () => {
      const base = 'https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv';
      const [languagesRes, movesRes, moveNamesRes] = await Promise.all([
        fetch(`${base}/languages.csv`),
        fetch(`${base}/moves.csv`),
        fetch(`${base}/move_names.csv`),
      ]);

      if (!languagesRes.ok || !movesRes.ok || !moveNamesRes.ok) {
        throw new Error('Failed to fetch fallback CSV resources');
      }

      const [languagesCsv, movesCsv, moveNamesCsv] = await Promise.all([
        languagesRes.text(),
        movesRes.text(),
        moveNamesRes.text(),
      ]);

      const languageRows = parseCsvRows(languagesCsv);
      const moveRows = parseCsvRows(movesCsv);
      const moveNameRows = parseCsvRows(moveNamesCsv);

      const languageHeader = languageRows[0] ?? [];
      const moveHeader = moveRows[0] ?? [];
      const moveNameHeader = moveNameRows[0] ?? [];

      const languageIdIdx = languageHeader.indexOf('id');
      const languageIdentifierIdx = languageHeader.indexOf('identifier');
      const moveIdIdx = moveHeader.indexOf('id');
      const moveIdentifierIdx = moveHeader.indexOf('identifier');
      const moveNameMoveIdIdx = moveNameHeader.indexOf('move_id');
      const moveNameLanguageIdIdx = moveNameHeader.indexOf('local_language_id');
      const moveNameValueIdx = moveNameHeader.indexOf('name');

      if (
        languageIdIdx < 0
        || languageIdentifierIdx < 0
        || moveIdIdx < 0
        || moveIdentifierIdx < 0
        || moveNameMoveIdIdx < 0
        || moveNameLanguageIdIdx < 0
        || moveNameValueIdx < 0
      ) {
        throw new Error('Fallback CSV headers are invalid');
      }

      const langIdToIdentifier = new Map<number, string>();
      for (const row of languageRows.slice(1)) {
        const id = Number(row[languageIdIdx]);
        const identifier = String(row[languageIdentifierIdx] ?? '').trim().toLowerCase();
        if (!Number.isFinite(id) || !identifier) continue;
        langIdToIdentifier.set(id, identifier);
      }

      const moveIdToIdentifier = new Map<number, string>();
      for (const row of moveRows.slice(1)) {
        const id = Number(row[moveIdIdx]);
        const identifier = String(row[moveIdentifierIdx] ?? '').trim().toLowerCase();
        if (!Number.isFinite(id) || !identifier) continue;
        moveIdToIdentifier.set(id, identifier);
      }

      const fallback: Record<string, { zh?: string; en?: string }> = {};
      for (const row of moveNameRows.slice(1)) {
        const moveId = Number(row[moveNameMoveIdIdx]);
        const languageId = Number(row[moveNameLanguageIdIdx]);
        const moveName = String(row[moveNameValueIdx] ?? '').trim();
        if (!Number.isFinite(moveId) || !Number.isFinite(languageId) || !moveName) continue;

        const identifier = moveIdToIdentifier.get(moveId);
        const language = langIdToIdentifier.get(languageId);
        if (!identifier || !language) continue;

        const current = fallback[identifier] ?? {};
        if ((language === 'zh-hans' || language === 'zh-hant') && !current.zh) {
          current.zh = moveName;
        }
        if (language === 'en' && !current.en) {
          current.en = moveName;
        }
        fallback[identifier] = current;
      }

      return fallback;
    })().catch((error) => {
      moveNameFallbackMapPromise = null;
      throw error;
    });
  }

  return moveNameFallbackMapPromise;
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
      learnableMoves: Array.from(new Set<string>(
        pokemon.moves
          .map((entry) => entry.move?.name)
          .filter((name): name is string => typeof name === 'string' && name.length > 0),
      )),
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

export async function fetchDexMoveDetails(moveNames: string[]): Promise<Record<string, DexMoveDetail>> {
  const names = [...new Set(moveNames.map((name) => String(name || '').trim().toLowerCase()).filter(Boolean))];
  const result: Record<string, DexMoveDetail> = {};
  if (names.length === 0) return result;

  const missing = names.filter((name) => !dexMoveCache.has(name));
  if (missing.length > 0) {
    try {
      const pokemonClient = await getPokemonClient();
      const CHUNK_SIZE = 8;
      for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
        const chunk = missing.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (name) => {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              const move = await pokemonClient.getMoveByName(name);
              const moveNames = Array.isArray(move.names)
                ? move.names.map((entry: any) => ({
                    name: entry.name,
                    language: { name: entry.language?.name },
                  }))
                : [];
              const detail: DexMoveDetail = {
                name,
                zhName: getZhName(moveNames),
                enName: getEnName(moveNames),
                type: move.type?.name ?? 'normal',
                damageClass: (move.damage_class?.name ?? 'status') as DexMoveDetail['damageClass'],
                power: typeof move.power === 'number' ? move.power : null,
              };
              dexMoveCache.set(name, detail);
              return;
            } catch {
              if (attempt === 2) return;
              await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
            }
          }
        }));
      }
    } catch (error) {
      console.error('Failed to fetch dex move details', error);
    }
  }

  try {
    const fallbackMap = await loadMoveNameFallbackMap();
    names.forEach((name) => {
      const cached = dexMoveCache.get(name);
      if (!cached) return;
      const fallback = fallbackMap[name];
      if (!fallback) return;
      if (!cached.zhName && fallback.zh) {
        cached.zhName = fallback.zh;
      }
      if (!cached.enName && fallback.en) {
        cached.enName = fallback.en;
      }
      dexMoveCache.set(name, cached);
    });
  } catch {
    // Ignore fallback loading failures; primary API names still work.
  }

  names.forEach((name) => {
    const cached = dexMoveCache.get(name);
    if (!cached) return;
    result[name] = cached;
  });

  return result;
}
