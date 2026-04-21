import type {
  GamePokemon,
  NonVolatileStatus,
  NonVolatileStatusState,
  VolatileStatusId,
  VolatileStatusState,
} from '../../../types';

const STATUS_ALIAS_MAP: Record<string, string> = {
  badly_poisoned: 'bad_poison',
  paralyzed: 'paralysis',
  toxic: 'bad_poison',
};

const NON_VOLATILE_STATUS_IDS = new Set<NonVolatileStatus>([
  'sleep',
  'poison',
  'bad_poison',
  'burn',
  'paralysis',
  'freeze',
]);

const DEFAULT_VOLATILE_TURNS: Partial<Record<string, number>> = {
  disable: 4,
  encore: 3,
  flinch: 1,
  protect: 1,
  taunt: 3,
  torment: 3,
  uproar: 3,
  yawn: 2,
};

const PREFERRED_VOLATILE_STATUS_ORDER = [
  'confusion',
  'flinch',
  'taunt',
  'encore',
  'disable',
  'torment',
  'attract',
  'infatuation',
  'nightmare',
  'curse',
  'yawn',
  'uproar',
  'protect',
  'substitute',
];

const GEN5_SLEEP_TURN_MIN = 2;
const GEN5_SLEEP_TURN_MAX = 4;
const CONFUSION_TURN_MIN = 2;
const CONFUSION_TURN_MAX = 5;

export function rollSleepTurns(random: () => number = Math.random): number {
  const roll = Math.max(0, Math.min(0.999999999, random()));
  return GEN5_SLEEP_TURN_MIN + Math.floor(roll * (GEN5_SLEEP_TURN_MAX - GEN5_SLEEP_TURN_MIN + 1));
}

export function rollConfusionTurns(random: () => number = Math.random): number {
  const roll = Math.max(0, Math.min(0.999999999, random()));
  return CONFUSION_TURN_MIN + Math.floor(roll * (CONFUSION_TURN_MAX - CONFUSION_TURN_MIN + 1));
}

export function normalizeBattleStatusId(status?: string): string {
  const normalized = (status ?? '').trim().toLowerCase().replace(/-/g, '_');
  return STATUS_ALIAS_MAP[normalized] ?? normalized;
}

export function normalizeNonVolatileStatusId(status?: string): NonVolatileStatus | null {
  const normalized = normalizeBattleStatusId(status);
  return NON_VOLATILE_STATUS_IDS.has(normalized as NonVolatileStatus)
    ? normalized as NonVolatileStatus
    : null;
}

export function normalizeVolatileStatusId(status?: string): VolatileStatusId | null {
  const normalized = normalizeBattleStatusId(status);
  return normalized ? normalized as VolatileStatusId : null;
}

export function getNonVolatileStatus(pokemon: GamePokemon | null | undefined): NonVolatileStatusState | undefined {
  return pokemon?.nonVolatileStatus;
}

export function getNonVolatileStatusId(pokemon: GamePokemon | null | undefined): NonVolatileStatus | undefined {
  return pokemon?.nonVolatileStatus?.id;
}

export function hasNonVolatileStatus(pokemon: GamePokemon | null | undefined): boolean {
  return Boolean(getNonVolatileStatusId(pokemon));
}

export function getVolatileStatus(
  pokemon: GamePokemon | null | undefined,
  status: VolatileStatusId,
): VolatileStatusState | undefined {
  const normalized = normalizeVolatileStatusId(status);
  if (!pokemon || !normalized) return undefined;
  const state = pokemon.volatileStatuses?.[normalized];
  return state?.active ? state : undefined;
}

export function hasVolatileStatus(pokemon: GamePokemon | null | undefined, status: VolatileStatusId): boolean {
  return Boolean(getVolatileStatus(pokemon, status));
}

export function setNonVolatileStatus(
  pokemon: GamePokemon,
  status: NonVolatileStatus | string,
  overrides: Partial<NonVolatileStatusState> = {},
  random: () => number = Math.random,
): GamePokemon {
  const normalized = normalizeNonVolatileStatusId(status);
  if (!normalized) return pokemon;

  const existing = pokemon.nonVolatileStatus;
  return {
    ...pokemon,
    nonVolatileStatus: {
      id: normalized,
      turnsRemaining: overrides.turnsRemaining ?? existing?.turnsRemaining ?? (normalized === 'sleep' ? rollSleepTurns(random) : undefined),
      toxicCounter: overrides.toxicCounter ?? existing?.toxicCounter ?? (normalized === 'bad_poison' ? 1 : undefined),
      sourceMoveName: overrides.sourceMoveName ?? existing?.sourceMoveName,
    },
  };
}

export function clearNonVolatileStatus(pokemon: GamePokemon): GamePokemon {
  if (!pokemon.nonVolatileStatus) return pokemon;
  return {
    ...pokemon,
    nonVolatileStatus: undefined,
  };
}

export function setVolatileStatus(
  pokemon: GamePokemon,
  status: VolatileStatusId | string,
  overrides: Partial<VolatileStatusState> = {},
  random: () => number = Math.random,
): GamePokemon {
  const normalized = normalizeVolatileStatusId(status);
  if (!normalized) return pokemon;

  const existing = pokemon.volatileStatuses?.[normalized];
  return {
    ...pokemon,
    volatileStatuses: {
      ...(pokemon.volatileStatuses ?? {}),
      [normalized]: {
        id: normalized,
        active: overrides.active ?? true,
        turnsRemaining: overrides.turnsRemaining
          ?? existing?.turnsRemaining
          ?? (normalized === 'confusion' ? rollConfusionTurns(random) : DEFAULT_VOLATILE_TURNS[normalized]),
        counter: overrides.counter ?? existing?.counter,
        sourceMoveName: overrides.sourceMoveName ?? existing?.sourceMoveName,
        linkedMoveName: overrides.linkedMoveName ?? existing?.linkedMoveName,
        linkedPokemonId: overrides.linkedPokemonId ?? existing?.linkedPokemonId,
      },
    },
  };
}

export function clearVolatileStatus(
  pokemon: GamePokemon,
  status: VolatileStatusId | string,
): GamePokemon {
  const normalized = normalizeVolatileStatusId(status);
  if (!normalized || !pokemon.volatileStatuses?.[normalized]) return pokemon;

  const nextStatuses = { ...(pokemon.volatileStatuses ?? {}) };
  delete nextStatuses[normalized];
  return {
    ...pokemon,
    volatileStatuses: nextStatuses,
  };
}

export function clearVolatileStatuses(
  pokemon: GamePokemon,
  statuses?: Array<VolatileStatusId | string>,
): GamePokemon {
  if (!statuses || statuses.length === 0) {
    if (!pokemon.volatileStatuses || Object.keys(pokemon.volatileStatuses).length === 0) return pokemon;
    return {
      ...pokemon,
      volatileStatuses: {},
    };
  }

  let nextPokemon = pokemon;
  for (const status of statuses) {
    nextPokemon = clearVolatileStatus(nextPokemon, status);
  }
  return nextPokemon;
}

export function getPrimaryBattleStatusId(pokemon: GamePokemon | null | undefined): string | undefined {
  const nonVolatileStatus = getNonVolatileStatusId(pokemon);
  if (nonVolatileStatus) return nonVolatileStatus;
  if (!pokemon?.volatileStatuses) return undefined;

  for (const status of PREFERRED_VOLATILE_STATUS_ORDER) {
    if (pokemon.volatileStatuses[status]?.active) {
      return status;
    }
  }

  const firstActive = Object.values(pokemon.volatileStatuses).find((entry) => entry?.active);
  return firstActive?.id;
}

export function hasAnyBattleStatus(pokemon: GamePokemon | null | undefined): boolean {
  return Boolean(getPrimaryBattleStatusId(pokemon));
}
