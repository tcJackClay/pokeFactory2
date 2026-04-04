const DEFAULT_POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';
const DEFAULT_POKEAPI_CSV_BASE_URL = 'https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv';
const DEFAULT_POKEAPI_SPRITE_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function cleanEnvValue(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimTrailingSlash(trimmed) : null;
}

export const POKEAPI_BASE_URL = cleanEnvValue(import.meta.env.VITE_POKEAPI_BASE_URL) ?? DEFAULT_POKEAPI_BASE_URL;
export const POKEAPI_CSV_BASE_URL = cleanEnvValue(import.meta.env.VITE_POKEAPI_CSV_BASE_URL) ?? DEFAULT_POKEAPI_CSV_BASE_URL;
export const POKEAPI_SPRITE_BASE_URL = cleanEnvValue(import.meta.env.VITE_POKEAPI_SPRITE_BASE_URL) ?? DEFAULT_POKEAPI_SPRITE_BASE_URL;

export function buildPokeApiUrl(path: string): string {
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  return `${POKEAPI_BASE_URL}/${normalizedPath}`;
}

export function buildOfficialPokeApiUrl(path: string): string {
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  return `${DEFAULT_POKEAPI_BASE_URL}/${normalizedPath}`;
}

function parsePokeApiPathFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const matchedPath = parsed.pathname.match(/\/api\/v2\/(.+)/i);
    if (matchedPath?.[1]) return matchedPath[1];
    if (parsed.hostname.toLowerCase().includes('pokeapi.co')) {
      return parsed.pathname.replace(/^\/+/, '');
    }
    return null;
  } catch {
    return null;
  }
}

export function normalizePokeApiResourceUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('pokeapi.co')) {
      const matchedPath = parsed.pathname.match(/\/api\/v2\/(.+)/i);
      const resourcePath = matchedPath?.[1] ?? parsed.pathname.replace(/^\/+/, '');
      return buildPokeApiUrl(resourcePath);
    }
    return url;
  } catch {
    return url;
  }
}

export function getPokemonSpriteUrl(id: number): string {
  return `${POKEAPI_SPRITE_BASE_URL}/${id}.png`;
}

export async function fetchPokeApiJson(path: string): Promise<any> {
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  const primaryUrl = buildPokeApiUrl(normalizedPath);
  const fallbackUrl = buildOfficialPokeApiUrl(normalizedPath);

  try {
    const response = await fetch(primaryUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    if (primaryUrl === fallbackUrl) throw error;
    const fallbackResponse = await fetch(fallbackUrl);
    if (!fallbackResponse.ok) {
      throw new Error(`Failed to fetch ${normalizedPath}: ${fallbackResponse.status}`);
    }
    return fallbackResponse.json();
  }
}

export async function fetchPokeApiJsonByResourceUrl(url: string): Promise<any> {
  const path = parsePokeApiPathFromUrl(url);
  if (path) {
    return fetchPokeApiJson(path);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch resource: ${response.status}`);
  }
  return response.json();
}
