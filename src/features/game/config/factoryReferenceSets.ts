export interface FactoryReferenceSet {
  key: string;
  frontierMonId: number;
  speciesId: number;
  gen: number;
  tier: number;
  moveNames: string[];
  heldItemId: string;
}

// Auto-generated from reference/pokeemerald-expansion battle_frontier_mons.h
// Scope: frontierMonId 110..881.
// Total sets: 772 (chunked dynamic imports).
export const FACTORY_REFERENCE_SET_MIN_ID = 110;
export const FACTORY_REFERENCE_SET_MAX_ID = 881;

export interface FactoryReferenceChunkMeta {
  start: number;
  end: number;
  key: string;
}

export const FACTORY_REFERENCE_CHUNKS: FactoryReferenceChunkMeta[] = [
  { start: 110, end: 209, key: '110_209' },
  { start: 210, end: 309, key: '210_309' },
  { start: 310, end: 409, key: '310_409' },
  { start: 410, end: 509, key: '410_509' },
  { start: 510, end: 609, key: '510_609' },
  { start: 610, end: 709, key: '610_709' },
  { start: 710, end: 809, key: '710_809' },
  { start: 810, end: 881, key: '810_881' },
];

const chunkLoaders: Record<string, () => Promise<FactoryReferenceSet[]>> = {
  '110_209': () => import('./factoryReferenceSets/chunks/chunk_110_209').then((m) => m.FACTORY_REFERENCE_SETS_CHUNK_110_209),
  '210_309': () => import('./factoryReferenceSets/chunks/chunk_210_309').then((m) => m.FACTORY_REFERENCE_SETS_CHUNK_210_309),
  '310_409': () => import('./factoryReferenceSets/chunks/chunk_310_409').then((m) => m.FACTORY_REFERENCE_SETS_CHUNK_310_409),
  '410_509': () => import('./factoryReferenceSets/chunks/chunk_410_509').then((m) => m.FACTORY_REFERENCE_SETS_CHUNK_410_509),
  '510_609': () => import('./factoryReferenceSets/chunks/chunk_510_609').then((m) => m.FACTORY_REFERENCE_SETS_CHUNK_510_609),
  '610_709': () => import('./factoryReferenceSets/chunks/chunk_610_709').then((m) => m.FACTORY_REFERENCE_SETS_CHUNK_610_709),
  '710_809': () => import('./factoryReferenceSets/chunks/chunk_710_809').then((m) => m.FACTORY_REFERENCE_SETS_CHUNK_710_809),
  '810_881': () => import('./factoryReferenceSets/chunks/chunk_810_881').then((m) => m.FACTORY_REFERENCE_SETS_CHUNK_810_881),
};

const chunkCache = new Map<string, Promise<FactoryReferenceSet[]>>();

function loadChunkByKey(key: string): Promise<FactoryReferenceSet[]> {
  const cached = chunkCache.get(key);
  if (cached) return cached;
  const loader = chunkLoaders[key];
  if (!loader) return Promise.resolve([]);
  const pending = loader();
  chunkCache.set(key, pending);
  return pending;
}

export async function preloadReferenceChunksByRange(min: number, max: number): Promise<void> {
  const tasks = FACTORY_REFERENCE_CHUNKS
    .filter((chunk) => chunk.start <= max && chunk.end >= min)
    .map((chunk) => loadChunkByKey(chunk.key));
  await Promise.all(tasks);
}

export async function getReferenceSetsByRange(min: number, max: number): Promise<FactoryReferenceSet[]> {
  const chunks = FACTORY_REFERENCE_CHUNKS.filter((chunk) => chunk.start <= max && chunk.end >= min);
  if (chunks.length === 0) return [];
  const loaded = await Promise.all(chunks.map((chunk) => loadChunkByKey(chunk.key)));
  return loaded.flat().filter((entry) => entry.frontierMonId >= min && entry.frontierMonId <= max);
}

export function hasReferenceFrontierMonId(frontierMonId: number): boolean {
  return frontierMonId >= FACTORY_REFERENCE_SET_MIN_ID && frontierMonId <= FACTORY_REFERENCE_SET_MAX_ID;
}
