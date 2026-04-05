import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  fetchEvolutionChain,
  fetchPokemonLite,
  fetchPokemonSpeciesById,
  getProcessedPokemon,
  getProcessedPokemonFromReferenceSet,
  getRandomPokemonIdentifier,
  type PokemonIdentifier,
} from '../../../services/pokeApi';
import {
  FACTORY_BATTLE_CONFIG,
  getAiTier,
  getFactoryChallengeNum,
  getFactoryFixedIvByChallenge,
  getFactoryQualityBiasByChallenge,
  getRentalHistoryRank,
  getSetNoByStage,
} from '../config/factoryBattle';
import { getFactoryBstBand } from '../config/factoryDifficultyBands';
import { FACTORY_REWARD_CONFIG } from '../config/factoryRewards';
import { getReferenceSetsByRange, hasReferenceFrontierMonId, type FactoryReferenceSet } from '../config/factoryReferenceSets';
import { getReferenceRangeByChallenge, inReferenceRange } from '../config/factoryReferenceRanges';
import { FACTORY_BANNED_SPECIES_IDS, isFactoryBannedSpecies } from '../config/factorySpeciesRules';
import { selectFactoryTrainerTemplate, type FactoryTrainerTemplate } from '../config/factoryTrainerTemplates';
import { getFactoryTrainerMonSetPool } from '../config/factoryTrainerMonSetPools';
import type { BattleMenuTab, FieldState, FieldTurns, GamePokemon, GameState, Item, Move, Pokemon, Stats, Weather } from '../../../types';
import type { BattleSpecialUsageState, BattleTurn, FactoryAiTier, LocalizeFn, TranslateFn } from '../view-model';

interface UseFactoryFlowParams {
  selectedGens: number[];
  startLevel: number;
  stage: number;
  totalRents: number;
  specialModeUnlocked: boolean;
  selectedRentalIndices: number[];
  factoryRentals: GamePokemon[];
  playerTeam: GamePokemon[];
  enemyTeam: GamePokemon[];
  t: TranslateFn;
  getLocalized: LocalizeFn;
  addMessagesSequentially: (messages: string[]) => Promise<void>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setFactoryRentals: Dispatch<SetStateAction<GamePokemon[]>>;
  setSelectedRentalIndices: Dispatch<SetStateAction<number[]>>;
  setInventory: Dispatch<SetStateAction<Item[]>>;
  setCoins: Dispatch<SetStateAction<number>>;
  setRoundResult: Dispatch<SetStateAction<'WIN' | 'LOSS' | null>>;
  setLastTokenGain: Dispatch<SetStateAction<number>>;
  setSwapCount: Dispatch<SetStateAction<number>>;
  setTotalRents: Dispatch<SetStateAction<number>>;
  setEnemyAiTier: Dispatch<SetStateAction<FactoryAiTier>>;
  setSpecialBossBattleActive: Dispatch<SetStateAction<boolean>>;
  setBattleSpecialUsage: Dispatch<SetStateAction<BattleSpecialUsageState>>;
  setEnemySpecialUsage: Dispatch<SetStateAction<BattleSpecialUsageState>>;
  setStage: Dispatch<SetStateAction<number>>;
  setStreak: Dispatch<SetStateAction<number>>;
  setGameState: Dispatch<SetStateAction<GameState>>;
  setPlayerTeam: Dispatch<SetStateAction<GamePokemon[]>>;
  setIsTransitioning: Dispatch<SetStateAction<boolean>>;
  setEnemyTeam: Dispatch<SetStateAction<GamePokemon[]>>;
  setEnemy: Dispatch<SetStateAction<GamePokemon | null>>;
  setCurrentEnemyTrainer: Dispatch<SetStateAction<FactoryTrainerTemplate | null>>;
  setBattleLog: Dispatch<SetStateAction<string[]>>;
  setTurn: Dispatch<SetStateAction<BattleTurn>>;
  setBattleMenuTab: Dispatch<SetStateAction<BattleMenuTab>>;
  setWeather: Dispatch<SetStateAction<Weather>>;
  setWeatherTurns: Dispatch<SetStateAction<number>>;
  setFieldState: Dispatch<SetStateAction<FieldState[]>>;
  setFieldTurns: Dispatch<SetStateAction<FieldTurns>>;
  setActiveBuffs: Dispatch<SetStateAction<{ atk: boolean; def: boolean }>>;
  setEnemyBuffs: Dispatch<SetStateAction<{ atk: boolean; def: boolean }>>;
}

interface EnemyEncounterData {
  team: GamePokemon[];
  firstEnemy: GamePokemon;
  isBoss: boolean;
  isSpecialUnlockBoss: boolean;
  aiTier: FactoryAiTier;
  setNo: number;
  trainer: FactoryTrainerTemplate;
}

interface RentalDraftCache {
  key: string;
  rentals: GamePokemon[];
}

interface RentalDraftPrefetchInFlight {
  key: string;
  promise: Promise<boolean>;
}

interface EnemyEncounterPrefetchInFlight {
  stage: number;
  key: string;
  promise: Promise<boolean>;
}

interface FactoryPoolCandidate {
  identifier: PokemonIdentifier;
  pokemonId: number;
  referenceSet?: FactoryReferenceSet;
  itemId: string;
  quality: number;
  stage: EvolutionStage;
}

type EvolutionStage = 'BASE' | 'MID' | 'FINAL';

interface EvolutionStageWeights {
  BASE: number;
  MID: number;
  FINAL: number;
}

type FactoryIvBuildMode = 'FIXED' | 'RANDOMIZED_RENTAL';

const EVOLUTION_STAGE_WEIGHTS_BY_CHALLENGE: EvolutionStageWeights[] = [
  { BASE: 100, MID: 0, FINAL: 0 },
  { BASE: 80, MID: 20, FINAL: 0 },
  { BASE: 55, MID: 35, FINAL: 10 },
  { BASE: 35, MID: 45, FINAL: 20 },
  { BASE: 22, MID: 40, FINAL: 38 },
  { BASE: 14, MID: 34, FINAL: 52 },
  { BASE: 9, MID: 28, FINAL: 63 },
  { BASE: 5, MID: 22, FINAL: 73 },
];

function getEvolutionStageWeights(challengeNum: number): EvolutionStageWeights {
  const idx = Math.max(0, Math.min(EVOLUTION_STAGE_WEIGHTS_BY_CHALLENGE.length - 1, challengeNum));
  return EVOLUTION_STAGE_WEIGHTS_BY_CHALLENGE[idx];
}

function pickEvolutionStageByWeight(weights: EvolutionStageWeights): EvolutionStage {
  const total = weights.BASE + weights.MID + weights.FINAL;
  if (total <= 0) return 'MID';
  let roll = Math.random() * total;
  roll -= weights.BASE;
  if (roll <= 0) return 'BASE';
  roll -= weights.MID;
  if (roll <= 0) return 'MID';
  return 'FINAL';
}

function getFallbackStageOrder(target: EvolutionStage): EvolutionStage[] {
  if (target === 'BASE') return ['BASE', 'MID', 'FINAL'];
  if (target === 'MID') return ['MID', 'BASE', 'FINAL'];
  return ['FINAL', 'MID', 'BASE'];
}

export interface FactoryUsedTrainerIdsBySetEntry {
  setNo: number;
  trainerIds: string[];
}

function statNatureModifier(statName: keyof Omit<Stats, 'hp'>, plus: string, minus: string): number {
  if (plus === statName) return 1.1;
  if (minus === statName) return 0.9;
  return 1;
}

function calculateStat(base: number, iv: number, level: number, isHp: boolean, natureMod = 1): number {
  if (isHp) {
    return Math.floor((base * 2 + iv) * level / 100) + level + 10;
  }
  return Math.floor((Math.floor((base * 2 + iv) * level / 100) + 5) * natureMod);
}

function scoreMove(move: Move, types: string[]): number {
  const power = move.power ?? 0;
  const accuracy = move.accuracy ?? 100;
  const stabBonus = types.includes(move.type) ? 20 : 0;
  const statusBonus = move.damage_class === 'status' ? 15 : 0;
  return power + (accuracy / 10) + stabBonus + statusBonus;
}

function scorePokemonQuality(pokemon: GamePokemon): number {
  const bst = pokemon.baseStats.hp
    + pokemon.baseStats.attack
    + pokemon.baseStats.defense
    + pokemon.baseStats.spAtk
    + pokemon.baseStats.spDef
    + pokemon.baseStats.speed;
  const typeNames = pokemon.types.map((slot) => slot.type.name);
  const moveScore = pokemon.selectedMoves.reduce((sum, move) => sum + scoreMove(move, typeNames), 0);
  return bst + moveScore;
}

function getPokemonBst(pokemon: GamePokemon): number {
  return pokemon.baseStats.hp
    + pokemon.baseStats.attack
    + pokemon.baseStats.defense
    + pokemon.baseStats.spAtk
    + pokemon.baseStats.spDef
    + pokemon.baseStats.speed;
}

function getPokemonBstFromRaw(pokemon: Pokemon): number {
  return (pokemon.stats.find((entry) => entry.stat.name === 'hp')?.base_stat ?? 0)
    + (pokemon.stats.find((entry) => entry.stat.name === 'attack')?.base_stat ?? 0)
    + (pokemon.stats.find((entry) => entry.stat.name === 'defense')?.base_stat ?? 0)
    + (pokemon.stats.find((entry) => entry.stat.name === 'special-attack')?.base_stat ?? 0)
    + (pokemon.stats.find((entry) => entry.stat.name === 'special-defense')?.base_stat ?? 0)
    + (pokemon.stats.find((entry) => entry.stat.name === 'speed')?.base_stat ?? 0);
}

function getSpeciesIdFromRawPokemon(pokemon: Pokemon): number {
  const rawSpeciesUrl = (pokemon as any)?.species?.url;
  if (typeof rawSpeciesUrl === 'string') {
    const match = /\/(\d+)\/?$/.exec(rawSpeciesUrl);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return pokemon.id;
}

function hasMatchingMegaStone(pokemon: GamePokemon): boolean {
  const held = pokemon.factoryHeldItemId?.toLowerCase() ?? '';
  if (!held) return false;
  return held.includes('ite') || held === 'red_orb' || held === 'blue_orb';
}

function hasMatchingZCrystal(pokemon: GamePokemon): boolean {
  const held = pokemon.factoryHeldItemId?.toLowerCase() ?? '';
  if (!held) return false;
  return held.endsWith('-z') || held.endsWith('_z') || held.includes('ium-z') || held.includes('ium_z');
}

function assignEnemySpecialPlan(team: GamePokemon[], aiTier: FactoryAiTier): GamePokemon[] {
  if (team.length === 0) return team;

  const tierUseChance: Record<FactoryAiTier, number> = {
    RANDOM: 0.2,
    BASIC: 0.35,
    ADVANCED: 0.6,
    BOSS: 0.9,
  };
  if (Math.random() >= tierUseChance[aiTier]) {
    return team.map((pokemon) => ({ ...pokemon, factoryPlannedSpecialMode: undefined }));
  }

  const megaCandidates = team
    .map((pokemon, index) => ({ index, pokemon }))
    .filter(({ pokemon }) => hasMatchingMegaStone(pokemon));
  const teraCandidates = team
    .map((pokemon, index) => ({ index, pokemon }))
    .filter(({ pokemon }) => Boolean(pokemon.teraType));
  const zmoveCandidates = team
    .map((pokemon, index) => ({ index, pokemon }))
    .filter(({ pokemon }) => hasMatchingZCrystal(pokemon));
  const dmaxCandidates = team.map((pokemon, index) => ({ index, pokemon }));

  const modePool: Array<{ mode: 'MEGA' | 'DYNAMAX' | 'TERA' | 'ZMOVE'; weight: number; candidates: Array<{ index: number; pokemon: GamePokemon }> }> = [];
  if (megaCandidates.length > 0) modePool.push({ mode: 'MEGA', weight: 3, candidates: megaCandidates });
  if (teraCandidates.length > 0) modePool.push({ mode: 'TERA', weight: 3, candidates: teraCandidates });
  if (zmoveCandidates.length > 0) modePool.push({ mode: 'ZMOVE', weight: 2, candidates: zmoveCandidates });
  if (dmaxCandidates.length > 0) modePool.push({ mode: 'DYNAMAX', weight: 2, candidates: dmaxCandidates });
  if (modePool.length === 0) return team;

  const totalWeight = modePool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  let pickedMode = modePool[0];
  for (const entry of modePool) {
    roll -= entry.weight;
    if (roll <= 0) {
      pickedMode = entry;
      break;
    }
  }

  const pickedTarget = [...pickedMode.candidates]
    .sort((a, b) => scorePokemonQuality(b.pokemon) - scorePokemonQuality(a.pokemon))[0];
  if (!pickedTarget) {
    return team.map((pokemon) => ({ ...pokemon, factoryPlannedSpecialMode: undefined }));
  }

  return team.map((pokemon, index) => ({
    ...pokemon,
    factoryPlannedSpecialMode: index === pickedTarget.index ? pickedMode.mode : undefined,
  }));
}

function clampFactoryIv(iv: number): number {
  return Math.max(0, Math.min(31, Math.round(iv)));
}

function buildUniformIvs(fixedIv: number): Stats {
  return {
    hp: fixedIv,
    attack: fixedIv,
    defense: fixedIv,
    spAtk: fixedIv,
    spDef: fixedIv,
    speed: fixedIv,
  };
}

function buildRandomizedRentalIvs(baseIv: number): Stats {
  const totalIv = clampFactoryIv(baseIv) * 6;
  const ivs: Stats = {
    hp: 0,
    attack: 0,
    defense: 0,
    spAtk: 0,
    spDef: 0,
    speed: 0,
  };
  const statKeys: Array<keyof Stats> = ['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed'];

  for (let remaining = totalIv; remaining > 0; remaining -= 1) {
    const availableStats = statKeys.filter((statKey) => ivs[statKey] < 31);
    const statKey = availableStats[Math.floor(Math.random() * availableStats.length)];
    if (!statKey) break;
    ivs[statKey] += 1;
  }

  return ivs;
}

function applyIvSpreadBuild(
  pokemon: GamePokemon,
  ivs: Stats,
  options?: { trimMovesToFactoryLimit?: boolean },
): GamePokemon {
  const trimMovesToFactoryLimit = options?.trimMovesToFactoryLimit ?? false;

  const nature = pokemon.nature;
  const calculatedStats: Stats = {
    hp: calculateStat(pokemon.baseStats.hp, ivs.hp, pokemon.level, true),
    attack: calculateStat(pokemon.baseStats.attack, ivs.attack, pokemon.level, false, statNatureModifier('attack', nature.plus, nature.minus)),
    defense: calculateStat(pokemon.baseStats.defense, ivs.defense, pokemon.level, false, statNatureModifier('defense', nature.plus, nature.minus)),
    spAtk: calculateStat(pokemon.baseStats.spAtk, ivs.spAtk, pokemon.level, false, statNatureModifier('spAtk', nature.plus, nature.minus)),
    spDef: calculateStat(pokemon.baseStats.spDef, ivs.spDef, pokemon.level, false, statNatureModifier('spDef', nature.plus, nature.minus)),
    speed: calculateStat(pokemon.baseStats.speed, ivs.speed, pokemon.level, false, statNatureModifier('speed', nature.plus, nature.minus)),
  };

  const hpRatio = pokemon.currentHp / Math.max(1, pokemon.maxHp);
  const typeNames = trimMovesToFactoryLimit ? pokemon.types.map((slot) => slot.type.name) : [];
  const nextMoves = trimMovesToFactoryLimit
    ? [...pokemon.selectedMoves]
      .sort((a, b) => scoreMove(b, typeNames) - scoreMove(a, typeNames))
      .slice(0, FACTORY_BATTLE_CONFIG.movesPerMon)
    : pokemon.selectedMoves;

  return {
    ...pokemon,
    ivs,
    selectedMoves: nextMoves,
    calculatedStats,
    maxHp: calculatedStats.hp,
    currentHp: Math.floor(calculatedStats.hp * hpRatio),
  };
}

function applyBossBuildEnhancement(pokemon: GamePokemon, minIv: number): GamePokemon {
  const ivs: Stats = {
    hp: Math.max(minIv, pokemon.ivs.hp),
    attack: Math.max(minIv, pokemon.ivs.attack),
    defense: Math.max(minIv, pokemon.ivs.defense),
    spAtk: Math.max(minIv, pokemon.ivs.spAtk),
    spDef: Math.max(minIv, pokemon.ivs.spDef),
    speed: Math.max(minIv, pokemon.ivs.speed),
  };

  return applyIvSpreadBuild(pokemon, ivs, { trimMovesToFactoryLimit: true });
}

function applyFixedIvBuild(pokemon: GamePokemon, fixedIv: number): GamePokemon {
  return applyIvSpreadBuild(pokemon, buildUniformIvs(fixedIv));
}

function applyFactoryIvBuild(pokemon: GamePokemon, baseIv: number, mode: FactoryIvBuildMode): GamePokemon {
  if (mode === 'RANDOMIZED_RENTAL') {
    return applyIvSpreadBuild(pokemon, buildRandomizedRentalIvs(baseIv));
  }

  return applyFixedIvBuild(pokemon, baseIv);
}

function getHeldItemBySlot(slot: number, setNo: number): string {
  const offset = (setNo - 1) * FACTORY_BATTLE_CONFIG.teamSize;
  const idx = (offset + slot) % FACTORY_BATTLE_CONFIG.heldItemPool.length;
  return FACTORY_BATTLE_CONFIG.heldItemPool[idx];
}

export function useFactoryFlow({
  selectedGens,
  startLevel,
  stage,
  totalRents,
  specialModeUnlocked,
  selectedRentalIndices,
  factoryRentals,
  playerTeam,
  enemyTeam,
  t,
  getLocalized,
  addMessagesSequentially,
  setLoading,
  setFactoryRentals,
  setSelectedRentalIndices,
  setInventory,
  setCoins,
  setRoundResult,
  setLastTokenGain,
  setSwapCount,
  setTotalRents,
  setEnemyAiTier,
  setSpecialBossBattleActive,
  setBattleSpecialUsage,
  setEnemySpecialUsage,
  setStage,
  setStreak,
  setGameState,
  setPlayerTeam,
  setIsTransitioning,
  setEnemyTeam,
  setEnemy,
  setCurrentEnemyTrainer,
  setBattleLog,
  setTurn,
  setBattleMenuTab,
  setWeather,
  setWeatherTurns,
  setFieldState,
  setFieldTurns,
  setActiveBuffs,
  setEnemyBuffs,
}: UseFactoryFlowParams) {
  const prefetchedEncounterRef = useRef<{ stage: number; key: string; data: EnemyEncounterData } | null>(null);
  const enemyPrefetchInFlightRef = useRef<EnemyEncounterPrefetchInFlight | null>(null);
  const prefetchRequestTokenRef = useRef(0);
  const prefetchedRentalsRef = useRef<RentalDraftCache | null>(null);
  const rentalPrefetchInFlightRef = useRef<RentalDraftPrefetchInFlight | null>(null);
  const rentalPrefetchTokenRef = useRef(0);
  const confirmRentalsInFlightRef = useRef(false);
  const transitionTimerRef = useRef<number | null>(null);
  const usedTrainerIdsBySetRef = useRef<Map<number, Set<string>>>(new Map());
  const evolutionStageCacheRef = useRef<Map<number, EvolutionStage>>(new Map());

  useEffect(() => () => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }
  }, []);

  const getEvolutionStage = useCallback(async (speciesId: number): Promise<EvolutionStage> => {
    const cached = evolutionStageCacheRef.current.get(speciesId);
    if (cached) return cached;

    try {
      const species = await fetchPokemonSpeciesById(speciesId);
      if (!species?.evolves_from_species) {
        evolutionStageCacheRef.current.set(speciesId, 'BASE');
        return 'BASE';
      }
      const nextEvolutions = await fetchEvolutionChain(speciesId);
      const stage: EvolutionStage = nextEvolutions.length > 0 ? 'MID' : 'FINAL';
      evolutionStageCacheRef.current.set(speciesId, stage);
      return stage;
    } catch {
      evolutionStageCacheRef.current.set(speciesId, 'MID');
      return 'MID';
    }
  }, []);

  const resetBattlePreview = useCallback(() => {
    setEnemy(null);
    setEnemyTeam([]);
    setCurrentEnemyTrainer(null);
    setBattleLog([]);
    setTurn('PLAYER');
    setBattleMenuTab('MAIN');
    setWeather('none');
    setWeatherTurns(0);
    setFieldState([]);
    setFieldTurns({});
    setActiveBuffs({ atk: false, def: false });
    setEnemyBuffs({ atk: false, def: false });
  }, [
    setActiveBuffs,
    setBattleLog,
    setBattleMenuTab,
    setCurrentEnemyTrainer,
    setEnemy,
    setEnemyBuffs,
    setEnemyTeam,
    setFieldState,
    setFieldTurns,
    setTurn,
    setWeather,
    setWeatherTurns,
  ]);

  const getUsedTrainerIdsForSet = useCallback((setNo: number) => {
    return usedTrainerIdsBySetRef.current.get(setNo) ?? new Set<string>();
  }, []);

  const markTrainerUsedForSet = useCallback((setNo: number, trainerId: string) => {
    const current = usedTrainerIdsBySetRef.current.get(setNo) ?? new Set<string>();
    current.add(trainerId);
    usedTrainerIdsBySetRef.current.set(setNo, current);

    for (const existingSetNo of [...usedTrainerIdsBySetRef.current.keys()]) {
      if (existingSetNo < setNo) {
        usedTrainerIdsBySetRef.current.delete(existingSetNo);
      }
    }
  }, []);

  const exportUsedTrainerIdsBySet = useCallback((): FactoryUsedTrainerIdsBySetEntry[] => {
    return [...usedTrainerIdsBySetRef.current.entries()]
      .map(([setNo, trainerIds]) => ({
        setNo,
        trainerIds: [...trainerIds].sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.setNo - b.setNo);
  }, []);

  const importUsedTrainerIdsBySet = useCallback((entries: FactoryUsedTrainerIdsBySetEntry[]) => {
    usedTrainerIdsBySetRef.current.clear();
    for (const entry of entries) {
      if (!Number.isFinite(entry.setNo) || entry.setNo <= 0) continue;
      const trainerIds = (entry.trainerIds ?? []).filter((id) => typeof id === 'string' && id.length > 0);
      if (trainerIds.length === 0) continue;
      usedTrainerIdsBySetRef.current.set(entry.setNo, new Set<string>(trainerIds));
    }
  }, []);

  const healAllPokemon = useCallback(() => {
    setPlayerTeam((prev) => prev.map((pokemon) => ({ ...pokemon, currentHp: pokemon.maxHp })));
  }, [setPlayerTeam]);

  const startBattleTransition = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }

    setIsTransitioning(true);
    setGameState('BATTLE');
    transitionTimerRef.current = window.setTimeout(() => {
      setIsTransitioning(false);
      transitionTimerRef.current = null;
    }, 1200);
  }, [setGameState, setIsTransitioning]);

  const buildEncounterContextKey = useCallback((currentStage: number, overrides?: { factoryPool?: GamePokemon[]; playerPool?: GamePokemon[] }) => {
    const factoryPool = overrides?.factoryPool ?? factoryRentals;
    const playerPool = overrides?.playerPool ?? playerTeam;
    const selectedGensKey = [...selectedGens].sort((a, b) => a - b).join(',');
    const factoryIds = factoryPool.map((pokemon) => pokemon.id).join(',');
    const playerIds = playerPool.map((pokemon) => pokemon.id).join(',');

    return [
      currentStage,
      startLevel,
      totalRents,
      specialModeUnlocked ? 1 : 0,
      selectedGensKey,
      factoryIds,
      playerIds,
    ].join('|');
  }, [factoryRentals, playerTeam, selectedGens, specialModeUnlocked, startLevel, totalRents]);

  const buildRentalPrefetchKey = useCallback(() => {
    const selectedGensKey = [...selectedGens].sort((a, b) => a - b).join(',');
    return [startLevel, totalRents, selectedGensKey].join('|');
  }, [selectedGens, startLevel, totalRents]);

  const buildFactoryPool = useCallback(async ({
    count,
    level,
    qualityBias,
    perSlotQualityBiases,
    referenceChallengeNum,
    useBetterRange,
    perSlotUseBetterRange,
    allowedFrontierMonIds,
    blockedSpecies = new Set<number>(),
    fixedIv,
    perSlotFixedIvs,
    perSlotIvBuildModes,
    setNo,
    isBoss,
    applyEvolutionStageWeights = false,
    requiredEvolutionStage,
  }: {
    count: number;
    level: number;
    qualityBias: number;
    perSlotQualityBiases?: number[];
    referenceChallengeNum?: number;
    useBetterRange?: boolean;
    perSlotUseBetterRange?: boolean[];
    allowedFrontierMonIds?: Set<number>;
    blockedSpecies?: Set<number>;
    fixedIv: number;
    perSlotFixedIvs?: number[];
    perSlotIvBuildModes?: FactoryIvBuildMode[];
    setNo: number;
    isBoss: boolean;
    applyEvolutionStageWeights?: boolean;
    requiredEvolutionStage?: EvolutionStage;
  }) => {
    const pickedSpecies = new Set<number>([...blockedSpecies, ...FACTORY_BANNED_SPECIES_IDS]);
    const pickedItems = new Set<string>();
    const mons: GamePokemon[] = [];
    const slotRangeSetCache = new Map<string, Awaited<ReturnType<typeof getReferenceSetsByRange>>>();
    const maxAttempts = count * 25;
    const useReferenceSets = FACTORY_BATTLE_CONFIG.useReferenceSetPool;
    let attempts = 0;

    while (mons.length < count && attempts < maxAttempts) {
      attempts += 1;
      const slotQualityBias = perSlotQualityBiases?.[mons.length] ?? qualityBias;
      const slotUseBetterRange = perSlotUseBetterRange?.[mons.length] ?? useBetterRange ?? false;
      const slotFixedIv = perSlotFixedIvs?.[mons.length] ?? fixedIv;
      const slotIvBuildMode = perSlotIvBuildModes?.[mons.length] ?? 'FIXED';
      const sampleCount = Math.max(2, 2 + slotQualityBias);
      const candidates: FactoryPoolCandidate[] = [];

      if (useReferenceSets) {
        const challengeForRange = referenceChallengeNum ?? 0;
        const slotRange = getReferenceRangeByChallenge(level, challengeForRange, slotUseBetterRange);
        const slotRangeKey = `${slotRange.min}-${slotRange.max}`;
        if (!slotRangeSetCache.has(slotRangeKey)) {
          const rangeSets = await getReferenceSetsByRange(slotRange.min, slotRange.max);
          slotRangeSetCache.set(slotRangeKey, rangeSets);
        }
        const slotRangeSets = slotRangeSetCache.get(slotRangeKey) ?? [];
        const eligibleSets = slotRangeSets.filter((entry) =>
          selectedGens.includes(entry.gen)
          && inReferenceRange(entry.frontierMonId, slotRange)
          && (!allowedFrontierMonIds || allowedFrontierMonIds.has(entry.frontierMonId))
          && !isFactoryBannedSpecies(entry.speciesId)
          && !pickedSpecies.has(entry.speciesId),
        );

        for (let i = 0; i < sampleCount; i += 1) {
          if (eligibleSets.length === 0) break;
          const picked = eligibleSets[Math.floor(Math.random() * eligibleSets.length)];
          if (!picked || pickedSpecies.has(picked.speciesId)) continue;

          try {
            const pokemon = await fetchPokemonLite(picked.speciesId);
            const stage = await getEvolutionStage(getSpeciesIdFromRawPokemon(pokemon));
            candidates.push({
              identifier: picked.speciesId,
              pokemonId: pokemon.id,
              referenceSet: picked,
              itemId: picked.heldItemId,
              quality: getPokemonBstFromRaw(pokemon),
              stage,
            });
          } catch {
            continue;
          }
        }
      }

      if (candidates.length === 0) {
        const challengeForBand = referenceChallengeNum ?? 0;
        const bstBand = getFactoryBstBand(level, challengeForBand, slotUseBetterRange);
        const strictBand = attempts < Math.floor(maxAttempts * 0.75);
        const relaxedMin = Math.max(1, bstBand.min - 35);
        const relaxedMax = bstBand.max + 45;

        for (let i = 0; i < sampleCount; i += 1) {
          const identifier = await getRandomPokemonIdentifier(selectedGens);
          if (typeof identifier === 'number' && (pickedSpecies.has(identifier) || isFactoryBannedSpecies(identifier))) continue;

          try {
            const candidate = await fetchPokemonLite(identifier);
            if (pickedSpecies.has(candidate.id) || isFactoryBannedSpecies(candidate.id)) continue;
            const bst = getPokemonBstFromRaw(candidate);
            if (strictBand) {
              if (bst < bstBand.min || bst > bstBand.max) continue;
            } else if (bst < relaxedMin || bst > relaxedMax) {
              continue;
            }
            const stage = await getEvolutionStage(getSpeciesIdFromRawPokemon(candidate));
            candidates.push({
              identifier,
              pokemonId: candidate.id,
              itemId: getHeldItemBySlot(mons.length, setNo),
              quality: bst,
              stage,
            });
          } catch {
            continue;
          }
        }
      }

      if (candidates.length === 0) continue;

      const challengeForStage = referenceChallengeNum ?? 0;
      const stageWeights = getEvolutionStageWeights(challengeForStage);
      const targetStage = requiredEvolutionStage ?? (applyEvolutionStageWeights ? pickEvolutionStageByWeight(stageWeights) : 'MID');
      const fallbackOrder = requiredEvolutionStage
        ? [requiredEvolutionStage]
        : (applyEvolutionStageWeights ? getFallbackStageOrder(targetStage) : ['MID', 'BASE', 'FINAL']);

      let stagePool: FactoryPoolCandidate[] = [];
      for (const stage of fallbackOrder) {
        const pool = candidates.filter((candidate) => candidate.stage === stage);
        if (pool.length > 0) {
          stagePool = pool;
          break;
        }
      }
      if (requiredEvolutionStage && stagePool.length === 0) {
        continue;
      }
      if (stagePool.length === 0) {
        stagePool = candidates;
      }

      const ranked = [...stagePool].sort((a, b) => b.quality - a.quality);
      const topPool = ranked.slice(0, Math.min(2, ranked.length));
      const picked = topPool[Math.floor(Math.random() * topPool.length)] ?? ranked[0];
      if (!picked) continue;

      const itemId = picked.itemId;
      const hasRealItem = itemId.length > 0 && itemId !== 'none';
      if (hasRealItem && pickedItems.has(itemId)) continue;

      const finalizedPokemon = picked.referenceSet
        ? await getProcessedPokemonFromReferenceSet(picked.referenceSet, level)
        : await getProcessedPokemon(picked.identifier, level);
      const fixedIvPokemon = applyFactoryIvBuild(finalizedPokemon, slotFixedIv, slotIvBuildMode);
      const candidatePokemon = isBoss ? applyBossBuildEnhancement(fixedIvPokemon, FACTORY_BATTLE_CONFIG.boss.minIv) : fixedIvPokemon;

      pickedSpecies.add(picked.pokemonId);
      if (hasRealItem) {
        pickedItems.add(itemId);
      }
      mons.push({ ...candidatePokemon, factoryHeldItemId: itemId });
    }

    return mons;
  }, [getEvolutionStage, selectedGens]);

  const generateRentalDraft = useCallback(async () => {
    const challengeNum = getFactoryChallengeNum(1, FACTORY_REWARD_CONFIG.battlesPerSet);
    const rentalRank = getRentalHistoryRank(totalRents);
    const perSlotQualityBiases = Array.from({ length: FACTORY_BATTLE_CONFIG.rentalsPerDraft }, (_, index) =>
      getFactoryQualityBiasByChallenge(startLevel, challengeNum, index < rentalRank),
    );
    const fixedIv = getFactoryFixedIvByChallenge(challengeNum, false);
    const perSlotFixedIvs = Array.from({ length: FACTORY_BATTLE_CONFIG.rentalsPerDraft }, (_, index) =>
      getFactoryFixedIvByChallenge(index < rentalRank ? challengeNum + 1 : challengeNum, false),
    );
    const perSlotUseBetterRange = Array.from({ length: FACTORY_BATTLE_CONFIG.rentalsPerDraft }, (_, index) => index < rentalRank);
    const perSlotIvBuildModes = Array.from({ length: FACTORY_BATTLE_CONFIG.rentalsPerDraft }, () => 'RANDOMIZED_RENTAL' as const);
    const rentals = await buildFactoryPool({
      count: FACTORY_BATTLE_CONFIG.rentalsPerDraft,
      level: startLevel,
      qualityBias: perSlotQualityBiases[0] ?? 0,
      perSlotQualityBiases,
      referenceChallengeNum: challengeNum,
      perSlotUseBetterRange,
      fixedIv,
      perSlotFixedIvs,
      perSlotIvBuildModes,
      setNo: 1,
      isBoss: false,
      applyEvolutionStageWeights: true,
      requiredEvolutionStage: 'BASE',
    });

    if (rentals.length < FACTORY_BATTLE_CONFIG.rentalsPerDraft) {
      throw new Error('Failed to generate enough rentals.');
    }

    return rentals;
  }, [buildFactoryPool, startLevel, totalRents]);

  const prefetchRentals = useCallback(async () => {
    const key = buildRentalPrefetchKey();
    const cached = prefetchedRentalsRef.current;
    if (cached && cached.key === key) {
      return true;
    }

    const inFlight = rentalPrefetchInFlightRef.current;
    if (inFlight && inFlight.key === key) {
      return inFlight.promise;
    }

    const requestToken = ++rentalPrefetchTokenRef.current;
    let promise: Promise<boolean>;
    promise = (async () => {
      try {
        const rentals = await generateRentalDraft();
        if (rentalPrefetchTokenRef.current !== requestToken) return false;
        prefetchedRentalsRef.current = { key, rentals };
        return true;
      } catch (error) {
        console.error(error);
        if (rentalPrefetchTokenRef.current === requestToken) {
          prefetchedRentalsRef.current = null;
        }
        return false;
      } finally {
        if (rentalPrefetchInFlightRef.current?.promise === promise) {
          rentalPrefetchInFlightRef.current = null;
        }
      }
    })();

    rentalPrefetchInFlightRef.current = { key, promise };
    return promise;
  }, [buildRentalPrefetchKey, generateRentalDraft]);

  const generateEnemyEncounter = useCallback(async (
    currentStage: number,
    options?: { factoryPool?: GamePokemon[]; playerPool?: GamePokemon[] },
  ): Promise<EnemyEncounterData> => {
    const battlesPerSet = FACTORY_REWARD_CONFIG.battlesPerSet;
    const battleInSet = ((currentStage - 1) % battlesPerSet) + 1;
    const setNo = getSetNoByStage(currentStage, battlesPerSet);
    const isBoss = battleInSet === battlesPerSet;
    const isSpecialUnlockBoss = currentStage === FACTORY_BATTLE_CONFIG.specialUnlock.unlockBossStage && !specialModeUnlocked;
    const aiTier = getAiTier(currentStage, battlesPerSet);
    const challengeNum = getFactoryChallengeNum(currentStage, battlesPerSet);
    const qualityBias = getFactoryQualityBiasByChallenge(startLevel, challengeNum, false);
    const fixedIv = getFactoryFixedIvByChallenge(challengeNum, isBoss);
    const usedTrainerIds = getUsedTrainerIdsForSet(setNo);
    const trainer = selectFactoryTrainerTemplate({
      challengeNum,
      isBoss,
      isSpecialUnlockBoss,
      usedTrainerIds,
    });
    const trainerMonSetPool = getFactoryTrainerMonSetPool(trainer.monSetKey);
    const trainerAllowedFrontierMonIds = trainerMonSetPool
      ? new Set<number>(
        trainerMonSetPool.frontierMonIds.filter((frontierMonId) => hasReferenceFrontierMonId(frontierMonId)),
      )
      : undefined;
    const useTrainerMonSetFilter = Boolean(trainerAllowedFrontierMonIds && trainerAllowedFrontierMonIds.size > 0);
    const level = startLevel
      + (isBoss ? FACTORY_BATTLE_CONFIG.boss.extraLevel : 0)
      + (isSpecialUnlockBoss ? FACTORY_BATTLE_CONFIG.specialUnlock.bossExtraLevel : 0);

    const factoryPool = options?.factoryPool ?? factoryRentals;
    const playerPool = options?.playerPool ?? playerTeam;
    const blockedSpecies = new Set<number>([
      ...factoryPool.map((pokemon) => pokemon.id),
      ...playerPool.map((pokemon) => pokemon.id),
    ]);

    const templateQualityBias = qualityBias + trainer.qualityBiasOffset;
    const perSlotUseBetterRange = Array.from(
      { length: FACTORY_BATTLE_CONFIG.teamSize },
      (_, index) => index < trainer.betterRangeSlots,
    );
    const perSlotQualityBiases = Array.from(
      { length: FACTORY_BATTLE_CONFIG.teamSize },
      (_, index) => templateQualityBias + (index < trainer.betterRangeSlots ? 1 : 0),
    );

    const team = await buildFactoryPool({
      count: FACTORY_BATTLE_CONFIG.teamSize,
      level,
      qualityBias: templateQualityBias + (isBoss ? 1 : 0) + (isSpecialUnlockBoss ? 2 : 0),
      perSlotQualityBiases,
      referenceChallengeNum: challengeNum,
      perSlotUseBetterRange,
      allowedFrontierMonIds: useTrainerMonSetFilter ? trainerAllowedFrontierMonIds : undefined,
      blockedSpecies,
      fixedIv,
      setNo,
      isBoss,
    });

    if (team.length < FACTORY_BATTLE_CONFIG.teamSize) {
      throw new Error('Failed to generate valid opponent team.');
    }

    const tunedTeam = isSpecialUnlockBoss
      ? team.map((pokemon) => applyBossBuildEnhancement(pokemon, FACTORY_BATTLE_CONFIG.specialUnlock.bossIvFloor))
      : team;
    const plannedTeam = assignEnemySpecialPlan(tunedTeam, isSpecialUnlockBoss ? 'BOSS' : aiTier);

    return {
      team: plannedTeam,
      firstEnemy: plannedTeam[0],
      isBoss,
      isSpecialUnlockBoss,
      aiTier,
      setNo,
      trainer,
    };
  }, [
    buildFactoryPool,
    factoryRentals,
    getUsedTrainerIdsForSet,
    playerTeam,
    specialModeUnlocked,
    startLevel,
    totalRents,
  ]);

  const prefetchEnemy = useCallback(async (
    currentStage: number,
    options?: { factoryPool?: GamePokemon[]; playerPool?: GamePokemon[] },
  ) => {
    const key = buildEncounterContextKey(currentStage, options);
    const cached = prefetchedEncounterRef.current;
    if (cached && cached.stage === currentStage && cached.key === key) {
      return true;
    }

    const inFlight = enemyPrefetchInFlightRef.current;
    if (inFlight && inFlight.stage === currentStage && inFlight.key === key) {
      return inFlight.promise;
    }

    const requestToken = ++prefetchRequestTokenRef.current;
    let promise: Promise<boolean>;
    promise = (async () => {
      try {
        const data = await generateEnemyEncounter(currentStage, options);
        if (prefetchRequestTokenRef.current !== requestToken) return false;
        prefetchedEncounterRef.current = { stage: currentStage, key, data };
        return true;
      } catch (error) {
        console.error(error);
        if (prefetchRequestTokenRef.current === requestToken) {
          prefetchedEncounterRef.current = null;
        }
        return false;
      } finally {
        if (enemyPrefetchInFlightRef.current?.promise === promise) {
          enemyPrefetchInFlightRef.current = null;
        }
      }
    })();

    enemyPrefetchInFlightRef.current = { stage: currentStage, key, promise };
    return promise;
  }, [buildEncounterContextKey, generateEnemyEncounter]);

  const spawnEnemy = useCallback(async (
    currentStage: number,
    options?: { factoryPool?: GamePokemon[]; playerPool?: GamePokemon[] },
  ) => {
    setLoading(true);
    let success = false;

    try {
      const contextKey = buildEncounterContextKey(currentStage, options);
      let cached = prefetchedEncounterRef.current;
      if (!(cached && cached.stage === currentStage && cached.key === contextKey)) {
        const inFlight = enemyPrefetchInFlightRef.current;
        if (inFlight && inFlight.stage === currentStage && inFlight.key === contextKey) {
          await inFlight.promise;
          cached = prefetchedEncounterRef.current;
        }
      }

      const encounter = cached && cached.stage === currentStage && cached.key === contextKey
        ? cached.data
        : await generateEnemyEncounter(currentStage, options);
      prefetchedEncounterRef.current = null;

      const { firstEnemy, team, isBoss, isSpecialUnlockBoss, aiTier, setNo, trainer } = encounter;
      setSpecialBossBattleActive(isSpecialUnlockBoss);
      setBattleSpecialUsage({ MEGA: false, DYNAMAX: false, TERA: false, ZMOVE: false });
      setEnemySpecialUsage({ MEGA: false, DYNAMAX: false, TERA: false, ZMOVE: false });
      setEnemyAiTier(isSpecialUnlockBoss ? 'BOSS' : aiTier);
      setEnemyTeam(team);
      setEnemy(firstEnemy);
      setCurrentEnemyTrainer(trainer);
      markTrainerUsedForSet(setNo, trainer.id);
      setBattleLog([]);

      if (isSpecialUnlockBoss) {
        await addMessagesSequentially([
          t('specialUnlockBossIntro'),
          t('gymLeaderSent').replace('{name}', getLocalized(firstEnemy)),
        ]);
      } else if (isBoss) {
        await addMessagesSequentially([t('gymLeaderSent').replace('{name}', getLocalized(firstEnemy))]);
      } else {
        await addMessagesSequentially([t('enemySentOut').replace('{name}', getLocalized(firstEnemy))]);
      }

      setTurn('PLAYER');
      setBattleMenuTab('MAIN');
      setWeather('none');
      setWeatherTurns(0);
      setFieldState([]);
      setFieldTurns({});
      setActiveBuffs({ atk: false, def: false });
      setEnemyBuffs({ atk: false, def: false });
      success = true;
    } catch (error) {
      console.error(error);
      prefetchedEncounterRef.current = null;
    } finally {
      setLoading(false);
    }

    return success;
  }, [
    addMessagesSequentially,
    buildEncounterContextKey,
    generateEnemyEncounter,
    getLocalized,
    setActiveBuffs,
    setBattleLog,
    setBattleMenuTab,
    setBattleSpecialUsage,
    setEnemySpecialUsage,
    setEnemy,
    setEnemyAiTier,
    setCurrentEnemyTrainer,
    setEnemyBuffs,
    setEnemyTeam,
    setFieldState,
    setFieldTurns,
    setLoading,
    markTrainerUsedForSet,
    setSpecialBossBattleActive,
    setTurn,
    setWeather,
    setWeatherTurns,
    t,
  ]);

  const startGame = useCallback(async () => {
    setLoading(true);

    try {
      const key = buildRentalPrefetchKey();
      const cached = prefetchedRentalsRef.current;
      let rentals: GamePokemon[];
      if (cached && cached.key === key) {
        rentals = cached.rentals;
      } else {
        const warmed = await prefetchRentals();
        const warmedCache = prefetchedRentalsRef.current;
        rentals = warmed && warmedCache && warmedCache.key === key
          ? warmedCache.rentals
          : await generateRentalDraft();
      }
      prefetchedRentalsRef.current = null;

      setFactoryRentals(rentals);
      setSelectedRentalIndices([]);
      setInventory([]);
      setCoins(0);
      setRoundResult(null);
      setLastTokenGain(0);
      setSwapCount(0);
      setSpecialBossBattleActive(false);
      setBattleSpecialUsage({ MEGA: false, DYNAMAX: false, TERA: false, ZMOVE: false });
      setEnemySpecialUsage({ MEGA: false, DYNAMAX: false, TERA: false, ZMOVE: false });
      setEnemyAiTier(getAiTier(1, FACTORY_REWARD_CONFIG.battlesPerSet));
      setStage(1);
      setStreak(0);
      setGameState('FACTORY_SELECT');
      usedTrainerIdsBySetRef.current.clear();
      void prefetchEnemy(1, { factoryPool: rentals, playerPool: [] });
      void prefetchRentals();
    } catch (error) {
      console.error(error);
      prefetchedRentalsRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [
    buildRentalPrefetchKey,
    generateRentalDraft,
    prefetchRentals,
    setCoins,
    setEnemyAiTier,
    setFactoryRentals,
    setGameState,
    setInventory,
    setLastTokenGain,
    setLoading,
    setRoundResult,
    setSelectedRentalIndices,
    setSpecialBossBattleActive,
    setStage,
    setStreak,
    setBattleSpecialUsage,
    setEnemySpecialUsage,
    setSwapCount,
    prefetchEnemy,
  ]);

  const quickStartDevBattle = useCallback(async () => {
    setLoading(true);

    try {
      const challengeNum = getFactoryChallengeNum(1, FACTORY_REWARD_CONFIG.battlesPerSet);
      const rentalRank = getRentalHistoryRank(totalRents);
      const perSlotQualityBiases = Array.from({ length: FACTORY_BATTLE_CONFIG.rentalsPerDraft }, (_, index) =>
        getFactoryQualityBiasByChallenge(startLevel, challengeNum, index < rentalRank),
      );
      const fixedIv = getFactoryFixedIvByChallenge(challengeNum, false);
      const perSlotFixedIvs = Array.from({ length: FACTORY_BATTLE_CONFIG.rentalsPerDraft }, (_, index) =>
        getFactoryFixedIvByChallenge(index < rentalRank ? challengeNum + 1 : challengeNum, false),
      );
      const perSlotUseBetterRange = Array.from({ length: FACTORY_BATTLE_CONFIG.rentalsPerDraft }, (_, index) => index < rentalRank);
      const perSlotIvBuildModes = Array.from({ length: FACTORY_BATTLE_CONFIG.rentalsPerDraft }, () => 'RANDOMIZED_RENTAL' as const);
      const rentals = await buildFactoryPool({
        count: FACTORY_BATTLE_CONFIG.rentalsPerDraft,
        level: startLevel,
        qualityBias: perSlotQualityBiases[0] ?? 0,
        perSlotQualityBiases,
        referenceChallengeNum: challengeNum,
        perSlotUseBetterRange,
        fixedIv,
        perSlotFixedIvs,
        perSlotIvBuildModes,
        setNo: 1,
        isBoss: false,
        applyEvolutionStageWeights: true,
        requiredEvolutionStage: 'BASE',
      });

      if (rentals.length < FACTORY_BATTLE_CONFIG.rentalsPerDraft) {
        throw new Error('Failed to generate enough rentals for quick start.');
      }

      const selected = [0, 1, 2];
      const team = selected.map((index) => rentals[index]);
      setFactoryRentals(rentals);
      setSelectedRentalIndices(selected);
      setPlayerTeam(team);
      setInventory([]);
      setCoins(500);
      setRoundResult(null);
      setLastTokenGain(0);
      setSwapCount(0);
      setSpecialBossBattleActive(false);
      setBattleSpecialUsage({ MEGA: false, DYNAMAX: false, TERA: false, ZMOVE: false });
      setEnemySpecialUsage({ MEGA: false, DYNAMAX: false, TERA: false, ZMOVE: false });
      setEnemyAiTier(getAiTier(1, FACTORY_REWARD_CONFIG.battlesPerSet));
      setStage(1);
      setStreak(0);
      setGameState('BATTLE');
      usedTrainerIdsBySetRef.current.clear();
      resetBattlePreview();
      await spawnEnemy(1);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [
    buildFactoryPool,
    resetBattlePreview,
    setCoins,
    setEnemyAiTier,
    setFactoryRentals,
    setGameState,
    setInventory,
    setLastTokenGain,
    setLoading,
    setPlayerTeam,
    setRoundResult,
    setSelectedRentalIndices,
    setSpecialBossBattleActive,
    setStage,
    setStreak,
    setBattleSpecialUsage,
    setEnemySpecialUsage,
    setSwapCount,
    spawnEnemy,
    startLevel,
    totalRents,
  ]);

  const toggleRental = useCallback((index: number) => {
    setSelectedRentalIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((value) => value !== index);
      }

      if (prev.length < FACTORY_BATTLE_CONFIG.teamSize) {
        return [...prev, index];
      }

      return prev;
    });
  }, [setSelectedRentalIndices]);

  const confirmRentals = useCallback(async () => {
    if (selectedRentalIndices.length !== FACTORY_BATTLE_CONFIG.teamSize) return;
    if (confirmRentalsInFlightRef.current) return;

    confirmRentalsInFlightRef.current = true;

    try {
      const team = selectedRentalIndices.map((index) => factoryRentals[index]);
      setPlayerTeam(team);
      resetBattlePreview();
      startBattleTransition();
      const enemyReady = await spawnEnemy(1, { factoryPool: factoryRentals, playerPool: [] });
      if (!enemyReady) {
        setIsTransitioning(false);
        setGameState('FACTORY_SELECT');
      }
    } finally {
      confirmRentalsInFlightRef.current = false;
    }
  }, [factoryRentals, resetBattlePreview, selectedRentalIndices, setGameState, setIsTransitioning, setPlayerTeam, spawnEnemy, startBattleTransition]);

  const nextFactoryStage = useCallback(async () => {
    healAllPokemon();
    setStage((prev) => prev + 1);
    resetBattlePreview();
    const nextStageNo = stage + 1;
    await prefetchEnemy(nextStageNo);
    startBattleTransition();
    await spawnEnemy(nextStageNo);
  }, [healAllPokemon, prefetchEnemy, resetBattlePreview, setStage, spawnEnemy, stage, startBattleTransition]);

  const performSwap = useCallback(async (playerIdx: number, enemyIdx: number) => {
    const newTeam = [...playerTeam];
    const swappedPokemon = {
      ...enemyTeam[enemyIdx],
      currentHp: enemyTeam[enemyIdx].maxHp,
    };

    newTeam[playerIdx] = swappedPokemon;
    setPlayerTeam(newTeam);
    setSwapCount((prev) => prev + 1);
    setTotalRents((prev) => prev + 1);
  }, [enemyTeam, playerTeam, setPlayerTeam, setSwapCount, setTotalRents]);

  return {
    startGame,
    quickStartDevBattle,
    toggleRental,
    confirmRentals,
    performSwap,
    nextFactoryStage,
    healAllPokemon,
    startBattleTransition,
    spawnEnemy,
    prefetchEnemy,
    prefetchRentals,
    exportUsedTrainerIdsBySet,
    importUsedTrainerIdsBySet,
  };
}

