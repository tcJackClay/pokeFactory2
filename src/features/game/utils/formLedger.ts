import type { GamePokemon } from '../../../types';
import { SPECIAL_FORM_CATALOG } from '../config/specialForms';

const FORM_KEY_VERSION = 'form-v2';
const LEGACY_FORM_KEY_PATTERN = /^(\d+):(.+)$/;
const VERSIONED_FORM_KEY_PATTERN = /^form-v2:(\d+):(.+)$/;
const catalogByApiName = new Set(SPECIAL_FORM_CATALOG.map((entry) => entry.pokeApiName.toLowerCase()));

function normalizeSlugPart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/_+/g, '-');
}

function canonicalizeFormSlug(value: string): string {
  const normalized = normalizeSlugPart(value);
  if (catalogByApiName.has(normalized)) return normalized;
  return normalized;
}

function toFormKey(id: number, formSlug: string): string | null {
  if (!Number.isFinite(id) || id <= 0) return null;
  const normalizedForm = canonicalizeFormSlug(formSlug);
  if (!normalizedForm) return null;
  return `${FORM_KEY_VERSION}:${id}:${normalizedForm}`;
}

function normalizeLegacyFormKey(rawKey: string): string | null {
  const versionedMatch = rawKey.match(VERSIONED_FORM_KEY_PATTERN);
  if (versionedMatch) {
    const [, idPart, formPart] = versionedMatch;
    return toFormKey(Number(idPart), formPart);
  }

  const legacyMatch = rawKey.match(LEGACY_FORM_KEY_PATTERN);
  if (legacyMatch) {
    const [, idPart, namePart] = legacyMatch;
    return toFormKey(Number(idPart), namePart);
  }

  return null;
}

export function createPokemonFormLedgerKey(pokemon: GamePokemon): string | null {
  if (!Number.isFinite(pokemon.id) || pokemon.id <= 0) return null;

  const rawSlug = pokemon.formLedgerSlug ?? pokemon.pokeApiName ?? pokemon.name;
  const fallbackSpecies = pokemon.speciesName ?? pokemon.name;
  const candidate = normalizeSlugPart(rawSlug || fallbackSpecies || String(pokemon.id));
  if (!candidate) return null;

  return toFormKey(pokemon.id, candidate);
}

export function normalizeStoredFormKeys(keys: string[]): string[] {
  if (!Array.isArray(keys)) return [];
  const normalized = keys
    .map((key) => normalizeLegacyFormKey(String(key)))
    .filter((key): key is string => Boolean(key));
  return [...new Set(normalized)].sort((a, b) => a.localeCompare(b));
}
