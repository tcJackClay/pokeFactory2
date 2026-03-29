import { Pokemon, Move, GamePokemon, Stats, Nature } from '../types';
import { GENERATIONS, NATURES } from '../constants';

const BASE_URL = 'https://pokeapi.co/api/v2';

export async function getRandomPokemonId(selectedGens: number[] = [1]): Promise<number> {
  const possibleGens = GENERATIONS.filter(g => selectedGens.includes(g.id));
  const targetGen = possibleGens[Math.floor(Math.random() * possibleGens.length)] || GENERATIONS[0];
  const [start, end] = targetGen.range;
  return Math.floor(Math.random() * (end - start + 1)) + start;
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

export async function fetchPokemon(id: number): Promise<Pokemon> {
  const response = await fetch(`${BASE_URL}/pokemon/${id}`);
  if (!response.ok) throw new Error('Failed to fetch pokemon');
  const data = await response.json();
  
  // Fetch Chinese name from species
  try {
    const speciesRes = await fetch(data.species.url);
    const speciesData = await speciesRes.json();
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
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return data.names;
  } catch (e) {
    return [];
  }
}

export async function fetchAbility(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const data = await response.json();
    const zhName = getZhName(data.names);
    return zhName || data.name;
  } catch (e) {
    return '';
  }
}

export async function fetchMove(url: string): Promise<Move> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch move');
  const data = await response.json();
  
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
    const speciesRes = await fetch(`${BASE_URL}/pokemon-species/${pokemonId}`);
    if (!speciesRes.ok) return [];
    const speciesData = await speciesRes.json();
    const evolutionRes = await fetch(speciesData.evolution_chain.url);
    if (!evolutionRes.ok) return [];
    const evolutionData = await evolutionRes.json();
    
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

export async function getLearnableMoves(pokemon: any, currentMoves: Move[], count: number = 3): Promise<Move[]> {
  const currentNames = currentMoves.map(m => m.name);
  const potentialMoves = pokemon.moves.filter((m: any) => !currentNames.includes(m.move.name));
  
  const shuffled = potentialMoves.sort(() => 0.5 - Math.random());
  const selected = [];
  
  for (const m of shuffled) {
    try {
      const move = await fetchMove(m.move.url);
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

export async function getProcessedPokemon(id: number, level: number = 50): Promise<GamePokemon> {
  const raw = await fetchPokemon(id);
  
  // Pick random moves that have power
  const validMoves: Move[] = [];
  const shuffledMoves = raw.moves.sort(() => 0.5 - Math.random());
  
  for (const m of shuffledMoves) {
    try {
      const move = await fetchMove(m.move.url);
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
      zhDescription: '用整个身体撞向对手进行攻击。'
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
    maxHp: calculatedStats.hp,
    currentHp: calculatedStats.hp,
    selectedMoves: validMoves,
    nature,
    ivs,
    baseStats,
    calculatedStats,
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
