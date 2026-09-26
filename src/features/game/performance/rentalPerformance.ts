const enabled = import.meta.env?.DEV === true;

type ContentKind = 'index' | 'pokemon' | 'pokemon-species' | 'ability' | 'move' | 'other';
type ContentStore = 'VERSION' | 'RUNTIME' | 'UPSTREAM' | 'UNKNOWN';

let activeCaptures = 0;
let startAt: number | null = null;
let cardsReported = false;
let confirmAt: number | null = null;

export function rentalNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function rentalDuration(startedAt: number) {
  return Math.round((rentalNow() - startedAt) * 10) / 10;
}

export function reportRentalPerformance(event: string, values: Record<string, number | string | boolean | null> = {}) {
  if (!enabled) return;
  console.info('[rental-perf]', event, values);
}

export function beginRentalNetworkCapture() {
  if (!enabled) return () => {};
  activeCaptures += 1;
  return () => { activeCaptures = Math.max(0, activeCaptures - 1); };
}

export function classifyRentalContentRequest(url: string): ContentKind {
  const path = url.split('?')[0].replace(/\/$/, '');
  if (path.endsWith('/api/data/factory-species-index')) return 'index';
  const matched = path.match(/\/api\/pokeapi\/(pokemon-species|pokemon|ability|move)(?:\/|$)/);
  return (matched?.[1] as ContentKind | undefined) ?? 'other';
}

export function recordRentalContentResponse(url: string, response: Response, startedAt: number) {
  if (!enabled || activeCaptures === 0) return;
  const kind = classifyRentalContentRequest(url);
  if (kind === 'other') return;
  const rawStore = response.headers.get('X-Content-Store')?.toUpperCase();
  const store: ContentStore = rawStore === 'VERSION' || rawStore === 'RUNTIME' || rawStore === 'UPSTREAM'
    ? rawStore
    : 'UNKNOWN';
  const lengthHeader = response.headers.get('Content-Length');
  const rawLength = lengthHeader === null ? null : Number(lengthHeader);
  reportRentalPerformance('content-response-in-capture-window', {
    kind,
    store,
    status: response.status,
    durationMs: rentalDuration(startedAt),
    contentLengthHeaderBytes: rawLength !== null && Number.isFinite(rawLength) && rawLength >= 0 ? rawLength : null,
  });
}

export function markRentalStart() {
  if (!enabled) return;
  startAt = rentalNow();
  cardsReported = false;
  reportRentalPerformance('start-clicked');
}

export function markRentalCardsActionable() {
  if (!enabled || startAt === null || cardsReported) return;
  cardsReported = true;
  reportRentalPerformance('six-cards-actionable', { fromStartMs: rentalDuration(startAt) });
}

export function markRentalConfirm() {
  if (!enabled) return;
  confirmAt = rentalNow();
  reportRentalPerformance('confirm-clicked');
}

export function clearRentalConfirm() {
  if (!enabled) return;
  confirmAt = null;
}

export function markFirstCommandActionable() {
  if (!enabled || confirmAt === null) return;
  reportRentalPerformance('first-command-actionable', { fromConfirmMs: rentalDuration(confirmAt) });
  confirmAt = null;
}
