import { Pokemon, Move, GamePokemon, Stats, Nature } from '../types';
import { GENERATIONS, NATURES } from '../constants';
import { DIRECT_SPECIAL_FORMS, SPECIAL_FORM_RANDOM_RATE } from '../features/game/config/specialForms';
import type { FactoryReferenceSet } from '../features/game/config/factoryReferenceSets';
import {
  buildPokeApiUrl,
  fetchPokeApiJson,
  fetchPokeApiJsonByResourceUrl,
  normalizePokeApiResourceUrl,
} from './pokeApiEndpoint';

export type PokemonIdentifier = number | string;
const moveByNameCache = new Map<string, Move>();
const pokemonSpeciesCache = new Map<number, any>();
const abilityNamesCache = new Map<string, any[]>();
const abilityNamesInFlightCache = new Map<string, Promise<any[]>>();
const UNOWN_FORM_IDENTIFIER_REGEX = /^unown-(?:[a-z]|question|exclamation)$/;

export async function getRandomPokemonId(selectedGens: number[] = [1]): Promise<number> {
  const possibleGens = GENERATIONS.filter(g => selectedGens.includes(g.id));
  const targetGen = possibleGens[Math.floor(Math.random() * possibleGens.length)] || GENERATIONS[0];
  const [start, end] = targetGen.range;
  return Math.floor(Math.random() * (end - start + 1)) + start;
}

function weightedPick<T>(items: T[], getWeight: (item: T) => number): T | null {
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + Math.max(0, getWeight(item)), 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)] ?? null;

  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Math.max(0, getWeight(item));
    if (roll <= 0) return item;
  }
  return items[items.length - 1] ?? null;
}

export async function getRandomPokemonIdentifier(selectedGens: number[] = [1]): Promise<PokemonIdentifier> {
  const shouldPickSpecial = Math.random() < SPECIAL_FORM_RANDOM_RATE;
  if (!shouldPickSpecial) return getRandomPokemonId(selectedGens);

  const specialPool = DIRECT_SPECIAL_FORMS.filter((form) => selectedGens.includes(form.gen));
  const picked = weightedPick(specialPool, (form) => form.weight ?? 1);
  if (!picked) return getRandomPokemonId(selectedGens);
  return picked.pokeApiName;
}

function getZhName(names: any[]): string | undefined {
  const zhHans = names.find((n: any) => n.language.name === 'zh-hans')?.name;
  if (zhHans) return zhHans;
  const zhHant = names.find((n: any) => n.language.name === 'zh-hant')?.name;
  return zhHant;
}

function getZhDescription(entries: any[]): string | undefined {
  // Filter for Chinese entries
  const zhEntries = entries.filter((e: any) => e.language.name === 'zh-hans' || e.language.name === 'zh-hant');
  if (zhEntries.length === 0) return undefined;
  
  // Prefer zh-hans
  const zhHans = zhEntries.find((e: any) => e.language.name === 'zh-hans')?.flavor_text;
  if (zhHans) return zhHans;
  
  // Fallback to zh-hant
  return zhEntries[zhEntries.length - 1].flavor_text;
}

function parsePokeApiNumericId(url: string | undefined): number | null {
  if (!url) return null;
  const match = /\/(\d+)\/?$/.exec(url);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function fetchPokemon(identifier: PokemonIdentifier): Promise<Pokemon> {
  const normalizedIdentifier = typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';
  let data: any;

  if (UNOWN_FORM_IDENTIFIER_REGEX.test(normalizedIdentifier)) {
    const formData = await fetchPokeApiJson(`pokemon-form/${normalizedIdentifier}`);
    const baseData = await fetchPokeApiJson(`pokemon/${formData.pokemon.name}`);
    data = {
      ...baseData,
      name: formData.name ?? normalizedIdentifier,
      sprites: {
        ...baseData.sprites,
        front_default: formData.sprites?.front_default ?? baseData.sprites?.front_default ?? '',
        back_default: formData.sprites?.back_default ?? baseData.sprites?.back_default ?? '',
      },
    };
  } else {
    data = await fetchPokeApiJson(`pokemon/${identifier}`);
  }
  
  // Fetch Chinese name from species
  try {
    const speciesData = await fetchPokeApiJsonByResourceUrl(normalizePokeApiResourceUrl(data.species.url));
    const speciesId = parsePokeApiNumericId(data.species.url);
    if (speciesId) {
      pokemonSpeciesCache.set(speciesId, speciesData);
    }
    data.names = speciesData.names;
    const zhName = getZhName(speciesData.names);
    data.zhName = zhName || data.name;
    
    // Fetch ability names
    for (const a of data.abilities) {
      a.ability.names = await fetchAbilityNames(a.ability.url);
      a.ability.zhName = getZhName(a.ability.names);
    }
  } catch (e) {
    data.zhName = data.name;
  }
  
  return data;
}

export async function fetchAbilityNames(url: string): Promise<any[]> {
  const normalizedUrl = normalizePokeApiResourceUrl(url);
  const cached = abilityNamesCache.get(normalizedUrl);
  if (cached) return cached;

  const inFlight = abilityNamesInFlightCache.get(normalizedUrl);
  if (inFlight) return inFlight;

  const request = (async () => {
    try {
      const data = await fetchPokeApiJsonByResourceUrl(normalizePokeApiResourceUrl(url));
      const names = Array.isArray(data.names) ? data.names : [];
      abilityNamesCache.set(normalizedUrl, names);
      return names;
    } catch (e) {
      return [];
    } finally {
      abilityNamesInFlightCache.delete(normalizedUrl);
    }
  })();

  abilityNamesInFlightCache.set(normalizedUrl, request);
  try {
    return await request;
  } catch (e) {
    return [];
  }
}

export async function fetchAbility(url: string): Promise<string> {
  try {
    const data = await fetchPokeApiJsonByResourceUrl(normalizePokeApiResourceUrl(url));
    const zhName = getZhName(data.names);
    return zhName || data.name;
  } catch (e) {
    return '';
  }
}

export async function fetchMove(url: string): Promise<Move> {
  const data = await fetchPokeApiJsonByResourceUrl(normalizePokeApiResourceUrl(url));
  
  const zhName = getZhName(data.names);
  const zhDescription = getZhDescription(data.flavor_text_entries);
  
  const statChanges = data.stat_changes?.map((sc: any) => {
    let statName = sc.stat.name;
    if (statName === 'special-attack') statName = 'spAtk';
    if (statName === 'special-defense') statName = 'spDef';
    return {
      change: sc.change,
      stat: statName
    };
  });

  return {
    name: data.name,
    names: data.names,
    zhName: zhName || data.name,
    power: data.power,
    accuracy: data.accuracy,
    type: data.type.name,
    damage_class: data.damage_class.name,
    pp: data.pp,
    zhDescription: zhDescription || '暂无描述',
    flavor_text_entries: data.flavor_text_entries,
    ailment: data.meta?.ailment?.name !== 'none' ? data.meta?.ailment?.name : undefined,
    ailmentChance: data.meta?.ailment_chance || 0,
    flinchChance: data.meta?.flinch_chance || 0,
    statChanges: statChanges?.length > 0 ? statChanges : undefined,
    drain: data.meta?.drain || 0,
    healing: data.meta?.healing || 0,
    critRate: data.meta?.crit_rate || 0,
    target: data.target?.name,
  };
}

export async function fetchEvolutionChain(pokemonId: number): Promise<number[]> {
  try {
    const speciesData = await fetchPokemonSpeciesById(pokemonId);
    const evolutionData = await fetchPokeApiJsonByResourceUrl(normalizePokeApiResourceUrl(speciesData.evolution_chain.url));
    
    const evolutions: number[] = [];
    let current = evolutionData.chain;
    
    const findNext = (node: any): boolean => {
      const id = parseInt(node.species.url.split('/').filter(Boolean).pop());
      if (id === pokemonId) {
        node.evolves_to.forEach((next: any) => {
          const nextId = parseInt(next.species.url.split('/').filter(Boolean).pop());
          evolutions.push(nextId);
        });
        return true;
      }
      for (const next of node.evolves_to) {
        if (findNext(next)) return true;
      }
      return false;
    };
    
    findNext(current);
    return evolutions;
  } catch (e) {
    return [];
  }
}

export async function fetchPokemonSpeciesById(id: number): Promise<any> {
  const cached = pokemonSpeciesCache.get(id);
  if (cached) return cached;
  const data = await fetchPokeApiJson(`pokemon-species/${id}`);
  pokemonSpeciesCache.set(id, data);
  return data;
}

export async function isEvolutionChainBaseSpecies(id: number): Promise<boolean> {
  try {
    const species = await fetchPokemonSpeciesById(id);
    return !species?.evolves_from_species;
  } catch {
    return false;
  }
}

export async function fetchMoveByName(moveName: string): Promise<Move> {
  const normalized = moveName.trim().toLowerCase();
  const cached = moveByNameCache.get(normalized);
  if (cached) return cached;

  const data = await fetchPokeApiJson(`move/${normalized}`);

  const zhName = getZhName(data.names);
  const zhDescription = getZhDescription(data.flavor_text_entries);
  const statChanges = data.stat_changes?.map((sc: any) => {
    let statName = sc.stat.name;
    if (statName === 'special-attack') statName = 'spAtk';
    if (statName === 'special-defense') statName = 'spDef';
    return {
      change: sc.change,
      stat: statName,
    };
  });

  const move: Move = {
    name: data.name,
    names: data.names,
    zhName: zhName || data.name,
    power: data.power,
    accuracy: data.accuracy,
    type: data.type.name,
    damage_class: data.damage_class.name,
    pp: data.pp,
    zhDescription: zhDescription || '暂无描述',
    flavor_text_entries: data.flavor_text_entries,
    ailment: data.meta?.ailment?.name !== 'none' ? data.meta?.ailment?.name : undefined,
    ailmentChance: data.meta?.ailment_chance || 0,
    flinchChance: data.meta?.flinch_chance || 0,
    statChanges: statChanges?.length > 0 ? statChanges : undefined,
    drain: data.meta?.drain || 0,
    healing: data.meta?.healing || 0,
    critRate: data.meta?.crit_rate || 0,
    target: data.target?.name,
  };

  moveByNameCache.set(normalized, move);
  return move;
}

export async function fetchAvailableEvolutionChain(pokemonId: number): Promise<number[]> {
  return fetchEvolutionChain(pokemonId);
}

export async function getLearnableMoves(pokemon: any, currentMoves: Move[], count: number = 3): Promise<Move[]> {
  const currentNames = currentMoves.map(m => m.name);
  const potentialMoves = pokemon.moves.filter((m: any) => !currentNames.includes(m.move.name));
  
  const shuffled = potentialMoves.sort(() => 0.5 - Math.random());
  const selected = [];
  
  for (const m of shuffled) {
    try {
      const move = await fetchMoveByName(m.move.name);
      selected.push(move);
      if (selected.length >= count) break;
    } catch (e) {
      continue;
    }
  }
  
  return selected;
}

function calculateStat(base: number, iv: number, level: number, isHp: boolean = false, natureMod: number = 1): number {
  if (isHp) {
    return Math.floor((base * 2 + iv) * level / 100) + level + 10;
  }
  return Math.floor((Math.floor((base * 2 + iv) * level / 100) + 5) * natureMod);
}

export async function getProcessedPokemon(identifier: PokemonIdentifier, level: number = 50): Promise<GamePokemon> {
  const raw = await fetchPokemon(identifier);
  const normalizedIdentifier = typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';
  const speciesId = parsePokeApiNumericId((raw as any)?.species?.url) ?? raw.id;
  const speciesFromRaw = typeof (raw as any)?.species?.name === 'string'
    ? String((raw as any).species.name).toLowerCase()
    : '';
  const speciesName = speciesFromRaw || String(raw.name ?? '').toLowerCase();
  const pokeApiName = String(raw.name ?? '').toLowerCase();
  const formLedgerSlug = normalizedIdentifier || pokeApiName || speciesName;
  const teraTypePool = raw.types.map((slot) => slot.type.name);
  const teraType = teraTypePool[Math.floor(Math.random() * teraTypePool.length)] || 'normal';
  
  // Pick random moves that have power
  const validMoves: Move[] = [];
  const shuffledMoves = raw.moves.sort(() => 0.5 - Math.random());
  
  for (const m of shuffledMoves) {
    try {
      const move = await fetchMoveByName(m.move.name);
      validMoves.push(move);
      if (validMoves.length >= 4) break;
    } catch (e) {
      continue;
    }
  }
  
  if (validMoves.length === 0) {
    validMoves.push({
      name: 'tackle',
      zhName: '撞击',
      power: 40,
      accuracy: 100,
      type: 'normal',
      damage_class: 'physical',
      pp: 35,
      zhDescription: '用整个身体撞向对手进行攻击。',
    });
  }

  // Generate IVs
  const ivs: Stats = {
    hp: Math.floor(Math.random() * 32),
    attack: Math.floor(Math.random() * 32),
    defense: Math.floor(Math.random() * 32),
    spAtk: Math.floor(Math.random() * 32),
    spDef: Math.floor(Math.random() * 32),
    speed: Math.floor(Math.random() * 32),
  };
  
  const evs: Stats = {
    hp: 0,
    attack: 0,
    defense: 0,
    spAtk: 0,
    spDef: 0,
    speed: 0,
  };

  // Pick Nature
  const nature = NATURES[Math.floor(Math.random() * NATURES.length)];

  // Base Stats
  const baseStats: Stats = {
    hp: raw.stats.find(s => s.stat.name === 'hp')?.base_stat || 50,
    attack: raw.stats.find(s => s.stat.name === 'attack')?.base_stat || 50,
    defense: raw.stats.find(s => s.stat.name === 'defense')?.base_stat || 50,
    spAtk: raw.stats.find(s => s.stat.name === 'special-attack')?.base_stat || 50,
    spDef: raw.stats.find(s => s.stat.name === 'special-defense')?.base_stat || 50,
    speed: raw.stats.find(s => s.stat.name === 'speed')?.base_stat || 50,
  };

  // Calculate Final Stats
  const getMod = (statName: string) => {
    if (nature.plus === statName) return 1.1;
    if (nature.minus === statName) return 0.9;
    return 1;
  };

  const calculatedStats: Stats = {
    hp: calculateStat(baseStats.hp, ivs.hp, level, true),
    attack: calculateStat(baseStats.attack, ivs.attack, level, false, getMod('attack')),
    defense: calculateStat(baseStats.defense, ivs.defense, level, false, getMod('defense')),
    spAtk: calculateStat(baseStats.spAtk, ivs.spAtk, level, false, getMod('spAtk')),
    spDef: calculateStat(baseStats.spDef, ivs.spDef, level, false, getMod('spDef')),
    speed: calculateStat(baseStats.speed, ivs.speed, level, false, getMod('speed')),
  };

  return {
    ...raw,
    level,
    speciesId,
    speciesName,
    pokeApiName,
    formLedgerSlug,
    maxHp: calculatedStats.hp,
    currentHp: calculatedStats.hp,
    selectedMoves: validMoves,
    nature,
    ivs,
    evs,
    baseStats,
    calculatedStats,
    teraType,
    statStages: {
      attack: 0,
      defense: 0,
      spAtk: 0,
      spDef: 0,
      speed: 0,
      accuracy: 0,
      evasion: 0,
    }
  };
}

export async function getProcessedPokemonFromReferenceSet(set: FactoryReferenceSet, level: number = 50): Promise<GamePokemon> {
  const raw = await fetchPokemon(set.speciesId);
  const speciesId = parsePokeApiNumericId((raw as any)?.species?.url) ?? set.speciesId;
  const speciesName = String(raw.name ?? '').toLowerCase();
  const setBaseKey = set.key.replace(/-\d+$/, '').toLowerCase();
  const inferredFormSlug = setBaseKey.startsWith(`${speciesName}-`) ? setBaseKey : speciesName;
  const pokeApiName = inferredFormSlug;
  const formLedgerSlug = inferredFormSlug;
  const teraTypePool = raw.types.map((slot) => slot.type.name);
  const teraType = teraTypePool[Math.floor(Math.random() * teraTypePool.length)] || 'normal';

  const selectedMoves: Move[] = [];
  for (const moveName of set.moveNames) {
    try {
      const move = await fetchMoveByName(moveName);
      selectedMoves.push(move);
    } catch {
      continue;
    }
  }

  if (selectedMoves.length === 0) {
    return getProcessedPokemon(set.speciesId, level);
  }

  const ivs: Stats = {
    hp: Math.floor(Math.random() * 32),
    attack: Math.floor(Math.random() * 32),
    defense: Math.floor(Math.random() * 32),
    spAtk: Math.floor(Math.random() * 32),
    spDef: Math.floor(Math.random() * 32),
    speed: Math.floor(Math.random() * 32),
  };

  
  const evs: Stats = {
    hp: 0,
    attack: 0,
    defense: 0,
    spAtk: 0,
    spDef: 0,
    speed: 0,
  };

  const nature: Nature = NATURES[Math.floor(Math.random() * NATURES.length)];
  const baseStats: Stats = {
    hp: raw.stats.find((s) => s.stat.name === 'hp')?.base_stat || 50,
    attack: raw.stats.find((s) => s.stat.name === 'attack')?.base_stat || 50,
    defense: raw.stats.find((s) => s.stat.name === 'defense')?.base_stat || 50,
    spAtk: raw.stats.find((s) => s.stat.name === 'special-attack')?.base_stat || 50,
    spDef: raw.stats.find((s) => s.stat.name === 'special-defense')?.base_stat || 50,
    speed: raw.stats.find((s) => s.stat.name === 'speed')?.base_stat || 50,
  };

  const getMod = (statName: string) => {
    if (nature.plus === statName) return 1.1;
    if (nature.minus === statName) return 0.9;
    return 1;
  };

  const calculatedStats: Stats = {
    hp: calculateStat(baseStats.hp, ivs.hp, level, true),
    attack: calculateStat(baseStats.attack, ivs.attack, level, false, getMod('attack')),
    defense: calculateStat(baseStats.defense, ivs.defense, level, false, getMod('defense')),
    spAtk: calculateStat(baseStats.spAtk, ivs.spAtk, level, false, getMod('spAtk')),
    spDef: calculateStat(baseStats.spDef, ivs.spDef, level, false, getMod('spDef')),
    speed: calculateStat(baseStats.speed, ivs.speed, level, false, getMod('speed')),
  };

  return {
    ...raw,
    level,
    speciesId,
    speciesName,
    pokeApiName,
    formLedgerSlug,
    maxHp: calculatedStats.hp,
    currentHp: calculatedStats.hp,
    selectedMoves: selectedMoves.slice(0, 4),
    nature,
    ivs,
    evs,
    baseStats,
    calculatedStats,
    teraType,
    statStages: {
      attack: 0,
      defense: 0,
      spAtk: 0,
      spDef: 0,
      speed: 0,
      accuracy: 0,
      evasion: 0,
    },
  };
}


