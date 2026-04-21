import type { MoveBattleFlag } from '../../../../types';

const POKEAPI_MOVE_FLAG_MAP: Partial<Record<string, MoveBattleFlag>> = {
  contact: 'contact',
  protect: 'protect',
  mirror: 'mirror',
  sound: 'sound',
  punch: 'punch',
  powder: 'powder',
  bullet: 'ballistic',
  authentic: 'bypass-protect',
};

export function mapPokeApiMoveFlags(flagNames: string[] = []): MoveBattleFlag[] {
  const mappedFlags = flagNames
    .map((flagName) => POKEAPI_MOVE_FLAG_MAP[flagName])
    .filter((flag): flag is MoveBattleFlag => Boolean(flag));

  return [...new Set(mappedFlags)];
}
