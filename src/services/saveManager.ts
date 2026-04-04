const SAVE_STORAGE_KEY = 'pokefactory_save_v1';
const SAVE_SCHEMA_VERSION = 1 as const;

export interface CollectionLedger {
  seenIds: number[];
  ownedIds: number[];
  formKeys: string[];
}

export interface GameSaveData {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  updatedAt: string;
  progress: {
    totalRents: number;
    highestStreak: number;
    specialModeUnlocked: boolean;
  };
  settings: {
    currentLanguage: string;
    selectedGens: number[];
    startLevel: number;
    developerMode: boolean;
  };
  collection: CollectionLedger;
}

interface SaveDraftInput {
  totalRents: number;
  highestStreak: number;
  specialModeUnlocked: boolean;
  currentLanguage: string;
  selectedGens: number[];
  startLevel: number;
  developerMode: boolean;
  collection: CollectionLedger;
}

function sanitizePositiveInt(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function sanitizeIntArray(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map((value) => (typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : NaN))
    .filter((value) => Number.isFinite(value) && value > 0);
  return [...new Set(normalized)];
}

function sanitizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);
  return [...new Set(normalized)];
}

function sanitizeLanguage(value: unknown, fallback = 'zh-hans') {
  if (typeof value !== 'string' || value.trim().length === 0) return fallback;
  return value.trim();
}

function sanitizeLevel(value: unknown, fallback = 50) {
  const normalized = sanitizePositiveInt(value, fallback);
  return Math.max(1, normalized);
}

function sanitizeCollectionLedger(value: unknown): CollectionLedger {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    seenIds: sanitizeIntArray(source.seenIds),
    ownedIds: sanitizeIntArray(source.ownedIds),
    formKeys: sanitizeStringArray(source.formKeys),
  };
}

function normalizeSaveData(value: unknown): GameSaveData {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const progress = source.progress && typeof source.progress === 'object'
    ? (source.progress as Record<string, unknown>)
    : {};
  const settings = source.settings && typeof source.settings === 'object'
    ? (source.settings as Record<string, unknown>)
    : {};

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    progress: {
      totalRents: sanitizePositiveInt(progress.totalRents, 0),
      highestStreak: sanitizePositiveInt(progress.highestStreak, 0),
      specialModeUnlocked: Boolean(progress.specialModeUnlocked),
    },
    settings: {
      currentLanguage: sanitizeLanguage(settings.currentLanguage, 'zh-hans'),
      selectedGens: sanitizeIntArray(settings.selectedGens),
      startLevel: sanitizeLevel(settings.startLevel, 50),
      developerMode: Boolean(settings.developerMode),
    },
    collection: sanitizeCollectionLedger(source.collection),
  };
}

function readLegacySaveFallback(): Partial<GameSaveData> {
  if (typeof window === 'undefined') return {};

  const totalRents = Number(window.localStorage.getItem('pokefactory_total_rents') ?? 0);
  const highestStreak = Number(window.localStorage.getItem('pokefactory_highest_streak') ?? 0);
  const specialModeUnlocked = window.localStorage.getItem('pokefactory_special_mode_unlocked') === '1';
  const developerMode = window.localStorage.getItem('pokefactory_developer_mode') === '1';

  return {
    progress: {
      totalRents: Number.isFinite(totalRents) ? Math.max(0, Math.floor(totalRents)) : 0,
      highestStreak: Number.isFinite(highestStreak) ? Math.max(0, Math.floor(highestStreak)) : 0,
      specialModeUnlocked,
    },
    settings: {
      currentLanguage: 'zh-hans',
      selectedGens: [],
      startLevel: 50,
      developerMode,
    },
    collection: {
      seenIds: [],
      ownedIds: [],
      formKeys: [],
    },
  };
}

export function createSaveData(input: SaveDraftInput): GameSaveData {
  return normalizeSaveData({
    schemaVersion: SAVE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    progress: {
      totalRents: input.totalRents,
      highestStreak: input.highestStreak,
      specialModeUnlocked: input.specialModeUnlocked,
    },
    settings: {
      currentLanguage: input.currentLanguage,
      selectedGens: input.selectedGens,
      startLevel: input.startLevel,
      developerMode: input.developerMode,
    },
    collection: input.collection,
  });
}

export function parseSaveDataFromText(text: string): GameSaveData {
  const parsed = JSON.parse(text) as unknown;
  return normalizeSaveData(parsed);
}

export function loadSaveData(): GameSaveData | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
  if (!raw) {
    const legacy = readLegacySaveFallback();
    const normalized = normalizeSaveData(legacy);
    if (normalized.progress.totalRents > 0 || normalized.progress.highestStreak > 0 || normalized.progress.specialModeUnlocked || normalized.settings.developerMode) {
      persistSaveData(normalized);
      return normalized;
    }
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeSaveData(parsed);
    return normalized;
  } catch (error) {
    console.error('Failed to parse save data from localStorage', error);
    return null;
  }
}

export function persistSaveData(saveData: GameSaveData) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(saveData));
}

export function buildSaveExportFilename() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `pokefactory-save-${yyyy}${mm}${dd}-${hh}${min}.json`;
}

export function triggerJsonDownload(text: string, filename: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
