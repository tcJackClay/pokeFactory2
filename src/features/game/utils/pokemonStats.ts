import type { GamePokemon, Stats } from '../../../types';

const MAX_IV = 31;
const MAX_EV_PER_STAT = 252;
const MAX_EV_TOTAL = 510;

export type StatKey = keyof Stats;

function getNatureModifier(statName: Exclude<StatKey, 'hp'>, plus: string, minus: string): number {
  if (plus === statName) return 1.1;
  if (minus === statName) return 0.9;
  return 1;
}

function calculateStat(base: number, iv: number, ev: number, level: number, isHp: boolean, natureMod = 1): number {
  const evPart = Math.floor(ev / 4);
  if (isHp) {
    return Math.floor(((base * 2 + iv + evPart) * level) / 100) + level + 10;
  }
  return Math.floor((Math.floor(((base * 2 + iv + evPart) * level) / 100) + 5) * natureMod);
}

export function sanitizeEvs(evs: Stats): Stats {
  const normalized: Stats = {
    hp: Math.max(0, Math.min(MAX_EV_PER_STAT, Math.floor(evs.hp || 0))),
    attack: Math.max(0, Math.min(MAX_EV_PER_STAT, Math.floor(evs.attack || 0))),
    defense: Math.max(0, Math.min(MAX_EV_PER_STAT, Math.floor(evs.defense || 0))),
    spAtk: Math.max(0, Math.min(MAX_EV_PER_STAT, Math.floor(evs.spAtk || 0))),
    spDef: Math.max(0, Math.min(MAX_EV_PER_STAT, Math.floor(evs.spDef || 0))),
    speed: Math.max(0, Math.min(MAX_EV_PER_STAT, Math.floor(evs.speed || 0))),
  };

  let total = normalized.hp + normalized.attack + normalized.defense + normalized.spAtk + normalized.spDef + normalized.speed;
  if (total <= MAX_EV_TOTAL) return normalized;

  const order: StatKey[] = ['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed'];
  for (const stat of order) {
    if (total <= MAX_EV_TOTAL) break;
    const cut = Math.min(normalized[stat], total - MAX_EV_TOTAL);
    normalized[stat] -= cut;
    total -= cut;
  }
  return normalized;
}

export function recalculatePokemonStats(pokemon: GamePokemon, preserveHpRatio = true): GamePokemon {
  const evs = sanitizeEvs(pokemon.evs);
  const ivs: Stats = {
    hp: Math.max(0, Math.min(MAX_IV, Math.floor(pokemon.ivs.hp || 0))),
    attack: Math.max(0, Math.min(MAX_IV, Math.floor(pokemon.ivs.attack || 0))),
    defense: Math.max(0, Math.min(MAX_IV, Math.floor(pokemon.ivs.defense || 0))),
    spAtk: Math.max(0, Math.min(MAX_IV, Math.floor(pokemon.ivs.spAtk || 0))),
    spDef: Math.max(0, Math.min(MAX_IV, Math.floor(pokemon.ivs.spDef || 0))),
    speed: Math.max(0, Math.min(MAX_IV, Math.floor(pokemon.ivs.speed || 0))),
  };

  const calculatedStats: Stats = {
    hp: calculateStat(pokemon.baseStats.hp, ivs.hp, evs.hp, pokemon.level, true),
    attack: calculateStat(pokemon.baseStats.attack, ivs.attack, evs.attack, pokemon.level, false, getNatureModifier('attack', pokemon.nature.plus, pokemon.nature.minus)),
    defense: calculateStat(pokemon.baseStats.defense, ivs.defense, evs.defense, pokemon.level, false, getNatureModifier('defense', pokemon.nature.plus, pokemon.nature.minus)),
    spAtk: calculateStat(pokemon.baseStats.spAtk, ivs.spAtk, evs.spAtk, pokemon.level, false, getNatureModifier('spAtk', pokemon.nature.plus, pokemon.nature.minus)),
    spDef: calculateStat(pokemon.baseStats.spDef, ivs.spDef, evs.spDef, pokemon.level, false, getNatureModifier('spDef', pokemon.nature.plus, pokemon.nature.minus)),
    speed: calculateStat(pokemon.baseStats.speed, ivs.speed, evs.speed, pokemon.level, false, getNatureModifier('speed', pokemon.nature.plus, pokemon.nature.minus)),
  };

  const hpRatio = preserveHpRatio ? pokemon.currentHp / Math.max(1, pokemon.maxHp) : 1;
  const nextMaxHp = calculatedStats.hp;
  const nextCurrentHp = preserveHpRatio
    ? Math.max(1, Math.min(nextMaxHp, Math.floor(nextMaxHp * hpRatio)))
    : nextMaxHp;

  return {
    ...pokemon,
    ivs,
    evs,
    calculatedStats,
    maxHp: nextMaxHp,
    currentHp: nextCurrentHp,
  };
}

export function addEvToPokemon(pokemon: GamePokemon, stat: StatKey, amount: number): GamePokemon {
  if (amount <= 0) return pokemon;
  const next = { ...pokemon, evs: { ...pokemon.evs } };
  const currentTotal = Object.values(next.evs).reduce((sum, value) => sum + value, 0);
  const roomByTotal = Math.max(0, MAX_EV_TOTAL - currentTotal);
  const roomByStat = Math.max(0, MAX_EV_PER_STAT - next.evs[stat]);
  const gain = Math.min(amount, roomByTotal, roomByStat);
  if (gain <= 0) return pokemon;
  next.evs[stat] += gain;
  return recalculatePokemonStats(next);
}

export function addIvToPokemon(pokemon: GamePokemon, stat: StatKey, amount = 1): GamePokemon {
  if (amount <= 0) return pokemon;
  const nextValue = Math.min(MAX_IV, pokemon.ivs[stat] + amount);
  if (nextValue === pokemon.ivs[stat]) return pokemon;
  return recalculatePokemonStats({
    ...pokemon,
    ivs: {
      ...pokemon.ivs,
      [stat]: nextValue,
    },
  });
}
