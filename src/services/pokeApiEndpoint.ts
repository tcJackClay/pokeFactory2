import { RequestTimeoutError, withRequestTimeout } from './requestTimeout';

const DEFAULT_POKEAPI_BASE_URL = '/api/pokeapi';
const DEFAULT_POKEAPI_CSV_BASE_URL = '/api/pokedex-csv';
const DEFAULT_POKEAPI_SPRITE_BASE_URL = '/api/pokeapi-sprites/pokemon';
const DEFAULT_POKEAPI_HOME_SPRITE_BASE_URL = '/api/pokeapi-sprites/pokemon/other/home';
const DEFAULT_POKEAPI_ARTWORK_BASE_URL = '/api/pokeapi-sprites/pokemon/other/official-artwork';
const POKEAPI_PROXY_PATH_PREFIX = '/api/pokeapi/';
const POKEAPI_RETRY_DELAYS_MS = [0, 250, 750];
export const POKEAPI_REQUEST_TIMEOUT_MS = 6000;
export const POKEAPI_RESOURCE_TIMEOUT_MS = 8000;
const inFlightPokeApiRequests = new Map<string, Promise<any>>();
const runtimeEnv: Partial<ImportMetaEnv> = import.meta.env ?? {};

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

export const POKEAPI_BASE_URL = cleanEnvValue(runtimeEnv.VITE_POKEAPI_BASE_URL)
  ?? DEFAULT_POKEAPI_BASE_URL;
export const POKEAPI_CSV_BASE_URL = cleanEnvValue(runtimeEnv.VITE_POKEAPI_CSV_BASE_URL) ?? DEFAULT_POKEAPI_CSV_BASE_URL;
export const POKEAPI_SPRITE_BASE_URL = cleanEnvValue(runtimeEnv.VITE_POKEAPI_SPRITE_BASE_URL) ?? DEFAULT_POKEAPI_SPRITE_BASE_URL;

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

export function proxyExternalResourceUrl(url: string): string {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl || normalizedUrl.startsWith('/')) return normalizedUrl;

  try {
    const parsed = new URL(normalizedUrl);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;

    if (host === 'pokeapi.co' || host.endsWith('.pokeapi.co')) {
      const matchedPath = path.match(/\/api\/v2\/(.+)/i);
      return matchedPath?.[1] ? buildPokeApiUrl(`${matchedPath[1]}${parsed.search}`) : normalizedUrl;
    }

    if (host === 'raw.githubusercontent.com') {
      const pokeApiSprites = path.match(/^\/PokeAPI\/sprites\/master\/sprites\/(.+)/i);
      if (pokeApiSprites?.[1]) {
        return `/api/pokeapi-sprites/${pokeApiSprites[1]}${parsed.search}`;
      }

      const pokedexCsv = path.match(/^\/veekun\/pokedex\/master\/pokedex\/data\/csv\/(.+)/i);
      if (pokedexCsv?.[1]) {
        return `/api/pokedex-csv/${pokedexCsv[1]}${parsed.search}`;
      }

      const pokeApiCry = path.match(/^\/PokeAPI\/cries\/main\/cries\/(.+)/i);
      if (pokeApiCry?.[1]) {
        return `/api/pokeapi-cries/${pokeApiCry[1]}${parsed.search}`;
      }
    }

    return normalizedUrl;
  } catch {
    return normalizedUrl;
  }
}

export function proxyExternalResourceUrls<T>(value: T): T {
  if (typeof value === 'string') {
    return proxyExternalResourceUrl(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => proxyExternalResourceUrls(entry)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => [key, proxyExternalResourceUrls(entry)]),
    ) as T;
  }
  return value;
}

export function getPokemonSpriteUrl(id: number): string {
  return `${POKEAPI_SPRITE_BASE_URL}/${id}.png`;
}

export function getPokemonHomeSpriteUrl(id: number): string {
  return `${DEFAULT_POKEAPI_HOME_SPRITE_BASE_URL}/${id}.png`;
}

export function getPokemonOfficialArtworkUrl(id: number): string {
  return `${DEFAULT_POKEAPI_ARTWORK_BASE_URL}/${id}.png`;
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

async function fetchPokeApiJsonFromUrl(url: string, timeoutMs = POKEAPI_REQUEST_TIMEOUT_MS): Promise<any> {
  return withRequestTimeout(async (signal) => {
    const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
      signal,
    });

    if (!response.ok) {
      throw new PokeApiHttpError(url, response.status);
    }

    return proxyExternalResourceUrls(await response.json());
  }, timeoutMs, url);
}

async function fetchPokeApiJsonWithRetry(normalizedPath: string): Promise<any> {
  const primaryUrl = buildPokeApiUrl(normalizedPath);
  const deadlineAt = Date.now() + POKEAPI_RESOURCE_TIMEOUT_MS;
  let lastError: unknown = new Error(`Failed to fetch ${normalizedPath}`);

  for (let attempt = 0; attempt < POKEAPI_RETRY_DELAYS_MS.length; attempt += 1) {
    const retryDelay = POKEAPI_RETRY_DELAYS_MS[attempt];
    if (retryDelay > 0) {
      if (Date.now() + retryDelay >= deadlineAt) break;
      await delay(retryDelay);
    }

    try {
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs <= 0) break;
      return await fetchPokeApiJsonFromUrl(primaryUrl, Math.min(POKEAPI_REQUEST_TIMEOUT_MS, remainingMs));
    } catch (error) {
      lastError = error;
      const hasNextAttempt = attempt < POKEAPI_RETRY_DELAYS_MS.length - 1;
      if (!hasNextAttempt || (!isRetriablePokeApiError(error) && !(error instanceof RequestTimeoutError))) {
        throw error;
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

export async function fetchPokeApiJsonByResourceUrl(url: string, timeoutMs = POKEAPI_RESOURCE_TIMEOUT_MS): Promise<any> {
  const path = parsePokeApiPathFromUrl(url);
  if (path) {
    return withRequestTimeout(() => fetchPokeApiJson(path), timeoutMs, url);
  }

  return withRequestTimeout(async (signal) => {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch resource: ${response.status}`);
    }
    return proxyExternalResourceUrls(await response.json());
  }, timeoutMs, url);
}
