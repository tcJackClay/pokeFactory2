import type { GamePokemon, Stats } from '../../../types';
import type { EventRegionConfig } from '../config/events';
import { IV_TRAIN_BATTLE_THRESHOLD } from '../config/events';
import { addEvToPokemon, addIvToPokemon, type StatKey } from './pokemonStats';

export type DispatchOutcome = 'item' | 'join' | 'battle';

export interface DispatchTrainingResult {
  team: GamePokemon[];
  stat: StatKey;
  evGain: number;
  ivGain: number;
  trained: boolean;
}

const TYPE_STAT_MAP: Record<string, StatKey> = {
  normal: 'hp',
  fire: 'spAtk',
  water: 'spDef',
  electric: 'speed',
  grass: 'spAtk',
  ice: 'spAtk',
  fighting: 'attack',
  poison: 'spDef',
  ground: 'defense',
  flying: 'speed',
  psychic: 'spAtk',
  bug: 'speed',
  rock: 'defense',
  ghost: 'spAtk',
  dragon: 'attack',
  dark: 'attack',
  steel: 'defense',
  fairy: 'spDef',
};

export function rollDispatchOutcome(category: EventRegionConfig['category'], rng = Math.random): DispatchOutcome {
  const roll = rng();
  if (category === 'rare_hunt') {
    if (roll < 0.48) return 'item';
    if (roll < 0.74) return 'join';
    return 'battle';
  }
  if (category === 'ev_train') {
    if (roll < 0.42) return 'item';
    if (roll < 0.72) return 'join';
    return 'battle';
  }
  if (roll < 0.58) return 'item';
  if (roll < 0.88) return 'join';
  return 'battle';
}

export function getDispatchTrainingStat(region: EventRegionConfig): StatKey {
  const preferredType = region.requiredTypes[0] ?? 'normal';
  return TYPE_STAT_MAP[preferredType] ?? 'hp';
}

export function getStatLabel(stat: keyof Stats): string {
  switch (stat) {
    case 'hp':
      return 'HP';
    case 'attack':
      return '攻击';
    case 'defense':
      return '防御';
    case 'spAtk':
      return '特攻';
    case 'spDef':
      return '特防';
    case 'speed':
      return '速度';
    default:
      return String(stat);
  }
}

export function applyDispatchTrainingToTeam(
  team: GamePokemon[],
  pokemonId: number | null | undefined,
  region: EventRegionConfig,
  completedBattleCount = 0,
): DispatchTrainingResult {
  const stat = getDispatchTrainingStat(region);
  const evGain = region.category === 'ev_train' ? region.baseEvGain : Math.max(1, Math.floor(region.baseEvGain / 2));
  const shouldGainIv = completedBattleCount > 0 && completedBattleCount % IV_TRAIN_BATTLE_THRESHOLD === 0;
  const ivGain = shouldGainIv ? 1 : 0;
  if (!pokemonId) {
    return { team, stat, evGain, ivGain: 0, trained: false };
  }

  let trained = false;
  const nextTeam = team.map((pokemon) => {
    if (pokemon.id !== pokemonId) return pokemon;
    trained = true;
    const evTrained = addEvToPokemon(pokemon, stat, evGain);
    return ivGain > 0 ? addIvToPokemon(evTrained, stat, ivGain) : evTrained;
  });

  return {
    team: trained ? nextTeam : team,
    stat,
    evGain,
    ivGain: trained ? ivGain : 0,
    trained,
  };
}
