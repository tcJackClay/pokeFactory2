export const COMPANION_CANDIDATES = [
  { id: 25, zhName: '皮卡丘', enName: 'Pikachu' },
  { id: 133, zhName: '伊布', enName: 'Eevee' },
  { id: 175, zhName: '波克比', enName: 'Togepi' },
  { id: 447, zhName: '利欧路', enName: 'Riolu' },
  { id: 744, zhName: '岩狗狗', enName: 'Rockruff' },
  { id: 921, zhName: '布拨', enName: 'Pawmi' },
] as const;

export type CompanionSpeciesId = (typeof COMPANION_CANDIDATES)[number]['id'];

export function isCompanionSpeciesId(value: unknown): value is CompanionSpeciesId {
  return COMPANION_CANDIDATES.some((candidate) => candidate.id === value);
}

export function getCompanionCandidate(id: CompanionSpeciesId) {
  return COMPANION_CANDIDATES.find((candidate) => candidate.id === id)!;
}
