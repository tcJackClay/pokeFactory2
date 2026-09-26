export type PoolSource = 'reference' | 'trainer-pool' | 'global-pool';
export type PoolRejectReason = 'banned' | 'species-conflict' | 'generation' | 'item-conflict' | 'evolution-stage' | 'quality-band' | 'missing-meta' | 'details';
export type PoolRejectCounts = Record<PoolRejectReason, number>;

export interface PoolCandidate {
  pokemonId: number;
  speciesId: number;
  gen: number | null;
  itemId: string;
  quality: number;
  stage: 'BASE' | 'MID' | 'FINAL';
  source: PoolSource;
}

export function emptyPoolRejectCounts(): PoolRejectCounts {
  return { banned: 0, 'species-conflict': 0, generation: 0, 'item-conflict': 0, 'evolution-stage': 0, 'quality-band': 0, 'missing-meta': 0, details: 0 };
}

export function normalizePoolItemId(itemId: string): string {
  return itemId.trim().toLowerCase().replace(/-/g, '_');
}

export function rejectPoolCandidate(candidate: PoolCandidate, options: {
  selectedGeneration: number;
  pickedSpecies: ReadonlySet<number>;
  pickedItems: ReadonlySet<string>;
  bannedSpecies: ReadonlySet<number>;
  requiredStage?: PoolCandidate['stage'];
  minQuality?: number;
  maxQuality?: number;
}): PoolRejectReason | null {
  if (options.bannedSpecies.has(candidate.speciesId) || options.bannedSpecies.has(candidate.pokemonId)) return 'banned';
  if (options.pickedSpecies.has(candidate.speciesId) || options.pickedSpecies.has(candidate.pokemonId)) return 'species-conflict';
  if (candidate.gen !== options.selectedGeneration) return 'generation';
  if (options.requiredStage && candidate.stage !== options.requiredStage) return 'evolution-stage';
  if (options.minQuality !== undefined && candidate.quality < options.minQuality) return 'quality-band';
  if (options.maxQuality !== undefined && candidate.quality > options.maxQuality) return 'quality-band';
  const itemId = normalizePoolItemId(candidate.itemId);
  if (itemId && itemId !== 'none' && options.pickedItems.has(itemId)) return 'item-conflict';
  return null;
}

export function choosePoolCandidates<T extends PoolCandidate>(
  candidates: readonly T[],
  options: Parameters<typeof rejectPoolCandidate>[1],
  rejected: PoolRejectCounts,
): T[] {
  return candidates.filter((candidate) => {
    const reason = rejectPoolCandidate(candidate, options);
    if (reason) rejected[reason] += 1;
    return reason === null;
  });
}
