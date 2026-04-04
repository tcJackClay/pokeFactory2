// Factory-specific species bans aligned with reference Battle Factory rules.
// Unown is excluded from rental/opponent generation.
export const FACTORY_BANNED_SPECIES = [201] as const;

export const FACTORY_BANNED_SPECIES_IDS = new Set<number>(FACTORY_BANNED_SPECIES);

export function isFactoryBannedSpecies(speciesId: number): boolean {
  return FACTORY_BANNED_SPECIES_IDS.has(speciesId);
}
