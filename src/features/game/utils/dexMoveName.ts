import type { DexMoveDetail } from '../../../services/pokedexClient';

export interface DexMoveNameFallback {
  zh?: string;
  en?: string;
}

function formatMoveIdentifier(name: string): string {
  return name
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

export function getDexMoveDisplayName(
  move: string,
  detail: DexMoveDetail | undefined,
  fallback: DexMoveNameFallback | undefined,
  language: string,
): string {
  const en = detail?.enName?.trim() || fallback?.en?.trim() || formatMoveIdentifier(move);
  if (!language.startsWith('zh')) return en;
  return detail?.zhName?.trim() || fallback?.zh?.trim() || en;
}
