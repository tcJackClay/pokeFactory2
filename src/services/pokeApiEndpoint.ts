const DEFAULT_POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';
const DEFAULT_DEV_POKEAPI_PROXY_BASE_URL = '/api/pokeapi';
const DEFAULT_POKEAPI_CSV_BASE_URL = 'https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv';
const DEFAULT_POKEAPI_SPRITE_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const POKEAPI_PROXY_PATH_PREFIX = '/api/pokeapi/';
const POKEAPI_RETRY_DELAYS_MS = [0, 250, 750];
const inFlightPokeApiRequests = new Map<string, Promise<any>>();

class PokeApiHttpError extends Error {
  status: number;

  constructor(url: string, status: number) {
    super(`Failed to fetch ${url}: HTTP ${status}`);
    this.name = 'PokeApiHttpError';
    this.status = status;
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function cleanEnvValue(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimTrailingSlash(trimmed) : null;
}

function isTruthyEnvFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

const preferDevProxy = isTruthyEnvFlag(import.meta.env.VITE_POKEAPI_USE_PROXY);

export const POKEAPI_BASE_URL = cleanEnvValue(import.meta.env.VITE_POKEAPI_BASE_URL)
  ?? (import.meta.env.DEV && preferDevProxy ? DEFAULT_DEV_POKEAPI_PROXY_BASE_URL : DEFAULT_POKEAPI_BASE_URL);
export const POKEAPI_CSV_BASE_URL = cleanEnvValue(import.meta.env.VITE_POKEAPI_CSV_BASE_URL) ?? DEFAULT_POKEAPI_CSV_BASE_URL;
export const POKEAPI_SPRITE_BASE_URL = cleanEnvValue(import.meta.env.VITE_POKEAPI_SPRITE_BASE_URL) ?? DEFAULT_POKEAPI_SPRITE_BASE_URL;

function normalizePokeApiPath(path: string): string {
  const raw = String(path || '').trim();
  if (!raw) return '';

  const withoutLeadingSlash = raw.replace(/^\/+/, '');
  const queryIndex = withoutLeadingSlash.indexOf('?');
  const pathname = queryIndex >= 0 ? withoutLeadingSlash.slice(0, queryIndex) : withoutLeadingSlash;
  const query = queryIndex >= 0 ? withoutLeadingSlash.slice(queryIndex) : '';
  const normalizedPathname = pathname.replace(/\/+$/, '');

  if (!normalizedPathname) return query ? `/${query}` : '';
  return `${normalizedPathname}/${query}`;
}

export function buildPokeApiUrl(path: string): string {
  const normalizedPath = normalizePokeApiPath(path);
  return `${POKEAPI_BASE_URL}/${normalizedPath}`;
}

export function buildOfficialPokeApiUrl(path: string): string {
  const normalizedPath = normalizePokeApiPath(path);
  return `${DEFAULT_POKEAPI_BASE_URL}/${normalizedPath}`;
}

function parsePokeApiPathFromUrl(url: string): string | null {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) return null;

  if (normalizedUrl.startsWith(POKEAPI_PROXY_PATH_PREFIX)) {
    return normalizePokeApiPath(normalizedUrl.slice(POKEAPI_PROXY_PATH_PREFIX.length));
  }

  try {
    const parsed = new URL(normalizedUrl);
    const matchedPath = parsed.pathname.match(/\/api\/v2\/(.+)/i);
    if (matchedPath?.[1]) return normalizePokeApiPath(matchedPath[1]);
    if (parsed.hostname.toLowerCase().includes('pokeapi.co')) {
      return normalizePokeApiPath(parsed.pathname);
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
      const resourcePath = matchedPath?.[1] ?? parsed.pathname;
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

function isRetriablePokeApiError(error: unknown): boolean {
  if (error instanceof PokeApiHttpError) {
    return error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
  }
  return error instanceof TypeError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function fetchPokeApiJsonFromUrl(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new PokeApiHttpError(url, response.status);
  }

  return response.json();
}

async function fetchPokeApiJsonWithRetry(normalizedPath: string): Promise<any> {
  const primaryUrl = buildPokeApiUrl(normalizedPath);
  const fallbackUrl = buildOfficialPokeApiUrl(normalizedPath);
  const candidateUrls = primaryUrl === fallbackUrl ? [primaryUrl] : [primaryUrl, fallbackUrl];
  let lastError: unknown = new Error(`Failed to fetch ${normalizedPath}`);

  for (let attempt = 0; attempt < POKEAPI_RETRY_DELAYS_MS.length; attempt += 1) {
    const retryDelay = POKEAPI_RETRY_DELAYS_MS[attempt];
    if (retryDelay > 0) {
      await delay(retryDelay);
    }

    for (let index = 0; index < candidateUrls.length; index += 1) {
      const url = candidateUrls[index];
      try {
        return await fetchPokeApiJsonFromUrl(url);
      } catch (error) {
        lastError = error;
        const hasNextUrl = index < candidateUrls.length - 1;
        if (hasNextUrl) {
          continue;
        }
        const hasNextAttempt = attempt < POKEAPI_RETRY_DELAYS_MS.length - 1;
        if (!hasNextAttempt || !isRetriablePokeApiError(error)) {
          throw error;
        }
      }
    }
  }

  throw lastError;
}

export async function fetchPokeApiJson(path: string): Promise<any> {
  const normalizedPath = normalizePokeApiPath(path);
  const inFlight = inFlightPokeApiRequests.get(normalizedPath);
  if (inFlight) {
    return inFlight;
  }

  const request = fetchPokeApiJsonWithRetry(normalizedPath);
  inFlightPokeApiRequests.set(normalizedPath, request);

  try {
    return await request;
  } finally {
    inFlightPokeApiRequests.delete(normalizedPath);
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
