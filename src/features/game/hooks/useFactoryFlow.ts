import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { getProcessedPokemon, getRandomPokemonIdentifier } from '../../../services/pokeApi';
import { FACTORY_BATTLE_CONFIG, getAiTier, getRentalHistoryRank, getSetNoByStage } from '../config/factoryBattle';
import { FACTORY_REWARD_CONFIG } from '../config/factoryRewards';
import type { BattleMenuTab, GamePokemon, GameState, Item, Move, Stats } from '../../../types';
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
  setStage: Dispatch<SetStateAction<number>>;
  setStreak: Dispatch<SetStateAction<number>>;
  setGameState: Dispatch<SetStateAction<GameState>>;
  setPlayerTeam: Dispatch<SetStateAction<GamePokemon[]>>;
  setIsTransitioning: Dispatch<SetStateAction<boolean>>;
  setEnemyTeam: Dispatch<SetStateAction<GamePokemon[]>>;
  setEnemy: Dispatch<SetStateAction<GamePokemon | null>>;
  setBattleLog: Dispatch<SetStateAction<string[]>>;
  setTurn: Dispatch<SetStateAction<BattleTurn>>;
  setBattleMenuTab: Dispatch<SetStateAction<BattleMenuTab>>;
  setActiveBuffs: Dispatch<SetStateAction<{ atk: boolean; def: boolean }>>;
  setEnemyBuffs: Dispatch<SetStateAction<{ atk: boolean; def: boolean }>>;
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

function applyBossBuildEnhancement(pokemon: GamePokemon, minIv: number): GamePokemon {
  const ivs: Stats = {
    hp: Math.max(minIv, pokemon.ivs.hp),
    attack: Math.max(minIv, pokemon.ivs.attack),
    defense: Math.max(minIv, pokemon.ivs.defense),
    spAtk: Math.max(minIv, pokemon.ivs.spAtk),
    spDef: Math.max(minIv, pokemon.ivs.spDef),
    speed: Math.max(minIv, pokemon.ivs.speed),
  };

  const nature = pokemon.nature;
  const calculatedStats: Stats = {
    hp: calculateStat(pokemon.baseStats.hp, ivs.hp, pokemon.level, true),
    attack: calculateStat(pokemon.baseStats.attack, ivs.attack, pokemon.level, false, statNatureModifier('attack', nature.plus, nature.minus)),
    defense: calculateStat(pokemon.baseStats.defense, ivs.defense, pokemon.level, false, statNatureModifier('defense', nature.plus, nature.minus)),
    spAtk: calculateStat(pokemon.baseStats.spAtk, ivs.spAtk, pokemon.level, false, statNatureModifier('spAtk', nature.plus, nature.minus)),
    spDef: calculateStat(pokemon.baseStats.spDef, ivs.spDef, pokemon.level, false, statNatureModifier('spDef', nature.plus, nature.minus)),
    speed: calculateStat(pokemon.baseStats.speed, ivs.speed, pokemon.level, false, statNatureModifier('speed', nature.plus, nature.minus)),
  };

  const typeNames = pokemon.types.map((slot) => slot.type.name);
  const moves = [...pokemon.selectedMoves].sort((a, b) => scoreMove(b, typeNames) - scoreMove(a, typeNames)).slice(0, FACTORY_BATTLE_CONFIG.movesPerMon);
  const hpRatio = pokemon.currentHp / Math.max(1, pokemon.maxHp);

  return {
    ...pokemon,
    ivs,
    selectedMoves: moves,
    calculatedStats,
    maxHp: calculatedStats.hp,
    currentHp: Math.floor(calculatedStats.hp * hpRatio),
  };
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
  setStage,
  setStreak,
  setGameState,
  setPlayerTeam,
  setIsTransitioning,
  setEnemyTeam,
  setEnemy,
  setBattleLog,
  setTurn,
  setBattleMenuTab,
  setActiveBuffs,
  setEnemyBuffs,
}: UseFactoryFlowParams) {
  const resetBattlePreview = useCallback(() => {
    setEnemy(null);
    setEnemyTeam([]);
    setBattleLog([]);
    setTurn('PLAYER');
    setBattleMenuTab('MAIN');
    setActiveBuffs({ atk: false, def: false });
    setEnemyBuffs({ atk: false, def: false });
  }, [
    setActiveBuffs,
    setBattleLog,
    setBattleMenuTab,
    setEnemy,
    setEnemyBuffs,
    setEnemyTeam,
    setTurn,
  ]);

  const healAllPokemon = useCallback(() => {
    setPlayerTeam((prev) => prev.map((pokemon) => ({ ...pokemon, currentHp: pokemon.maxHp })));
  }, [setPlayerTeam]);

  const startBattleTransition = useCallback(() => {
    setIsTransitioning(true);

    setTimeout(() => {
      setGameState('BATTLE');
      setTimeout(() => setIsTransitioning(false), 400);
    }, 800);
  }, [setGameState, setIsTransitioning]);

  const buildFactoryPool = useCallback(async ({
    count,
    level,
    qualityBias,
    blockedSpecies = new Set<number>(),
    setNo,
    isBoss,
  }: {
    count: number;
    level: number;
    qualityBias: number;
    blockedSpecies?: Set<number>;
    setNo: number;
    isBoss: boolean;
  }) => {
    const pickedSpecies = new Set<number>(blockedSpecies);
    const pickedItems = new Set<string>();
    const mons: GamePokemon[] = [];
    const maxAttempts = count * 25;
    let attempts = 0;

    while (mons.length < count && attempts < maxAttempts) {
      attempts += 1;
      const sampleCount = Math.max(2, 2 + qualityBias);
      const candidates: GamePokemon[] = [];

      for (let i = 0; i < sampleCount; i += 1) {
        const identifier = await getRandomPokemonIdentifier(selectedGens);
        if (typeof identifier === 'number' && pickedSpecies.has(identifier)) continue;

        try {
          const candidate = await getProcessedPokemon(identifier, level);
          if (pickedSpecies.has(candidate.id)) continue;
          candidates.push(isBoss ? applyBossBuildEnhancement(candidate, FACTORY_BATTLE_CONFIG.boss.minIv) : candidate);
        } catch {
          // 某些特殊形态在 PokeAPI 名称可能不可用，直接跳过并重试。
          continue;
        }
      }

      if (candidates.length === 0) continue;

      const best = candidates.sort((a, b) => scorePokemonQuality(b) - scorePokemonQuality(a))[0];
      const itemId = getHeldItemBySlot(mons.length, setNo);
      if (pickedItems.has(itemId)) continue;

      pickedSpecies.add(best.id);
      pickedItems.add(itemId);
      mons.push({ ...best, factoryHeldItemId: itemId });
    }

    return mons;
  }, [selectedGens]);

  const spawnEnemy = useCallback(async (currentStage: number) => {
    setLoading(true);

    try {
      const battlesPerSet = FACTORY_REWARD_CONFIG.battlesPerSet;
      const battleInSet = ((currentStage - 1) % battlesPerSet) + 1;
      const setNo = getSetNoByStage(currentStage, battlesPerSet);
      const isBoss = battleInSet === battlesPerSet;
      const isSpecialUnlockBoss = currentStage === FACTORY_BATTLE_CONFIG.specialUnlock.unlockBossStage && !specialModeUnlocked;
      const aiTier = getAiTier(currentStage, battlesPerSet);
      const qualityBias = Math.min(
        FACTORY_BATTLE_CONFIG.stageTierBonusCap,
        Math.floor((currentStage - 1) / battlesPerSet) + getRentalHistoryRank(totalRents),
      );
      const level = startLevel
        + (isBoss ? FACTORY_BATTLE_CONFIG.boss.extraLevel : 0)
        + (isSpecialUnlockBoss ? FACTORY_BATTLE_CONFIG.specialUnlock.bossExtraLevel : 0);

      const blockedSpecies = new Set<number>([
        ...factoryRentals.map((pokemon) => pokemon.id),
        ...playerTeam.map((pokemon) => pokemon.id),
      ]);

      const team = await buildFactoryPool({
        count: FACTORY_BATTLE_CONFIG.teamSize,
        level,
        qualityBias: qualityBias + (isBoss ? 1 : 0) + (isSpecialUnlockBoss ? 2 : 0),
        blockedSpecies,
        setNo,
        isBoss,
      });

      if (team.length < FACTORY_BATTLE_CONFIG.teamSize) {
        throw new Error('Failed to generate valid opponent team.');
      }

      const tunedTeam = isSpecialUnlockBoss
        ? team.map((pokemon) => applyBossBuildEnhancement(pokemon, FACTORY_BATTLE_CONFIG.specialUnlock.bossIvFloor))
        : team;
      const firstEnemy = tunedTeam[0];
      setSpecialBossBattleActive(isSpecialUnlockBoss);
      setBattleSpecialUsage({ MEGA: false, DYNAMAX: false, TERA: false });
      setEnemyAiTier(isSpecialUnlockBoss ? 'BOSS' : aiTier);
      setEnemyTeam(tunedTeam);
      setEnemy(firstEnemy);
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
      setActiveBuffs({ atk: false, def: false });
      setEnemyBuffs({ atk: false, def: false });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [
    addMessagesSequentially,
    buildFactoryPool,
    factoryRentals,
    getLocalized,
    playerTeam,
    specialModeUnlocked,
    setActiveBuffs,
    setBattleLog,
    setBattleMenuTab,
    setBattleSpecialUsage,
    setEnemy,
    setEnemyAiTier,
    setEnemyBuffs,
    setEnemyTeam,
    setLoading,
    setSpecialBossBattleActive,
    setTurn,
    startLevel,
    t,
    totalRents,
  ]);

  const startGame = useCallback(async () => {
    setLoading(true);

    try {
      const qualityBias = getRentalHistoryRank(totalRents);
      const rentals = await buildFactoryPool({
        count: FACTORY_BATTLE_CONFIG.rentalsPerDraft,
        level: startLevel,
        qualityBias,
        setNo: 1,
        isBoss: false,
      });

      if (rentals.length < FACTORY_BATTLE_CONFIG.rentalsPerDraft) {
        throw new Error('Failed to generate enough rentals.');
      }

      setFactoryRentals(rentals);
      setSelectedRentalIndices([]);
      setInventory([]);
      setCoins(0);
      setRoundResult(null);
      setLastTokenGain(0);
      setSwapCount(0);
      setSpecialBossBattleActive(false);
      setBattleSpecialUsage({ MEGA: false, DYNAMAX: false, TERA: false });
      setEnemyAiTier(getAiTier(1, FACTORY_REWARD_CONFIG.battlesPerSet));
      setStage(1);
      setStreak(0);
      setGameState('FACTORY_SELECT');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [
    buildFactoryPool,
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
    setSwapCount,
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

    const team = selectedRentalIndices.map((index) => factoryRentals[index]);
    setPlayerTeam(team);
    resetBattlePreview();
    startBattleTransition();
    await spawnEnemy(1);
  }, [factoryRentals, resetBattlePreview, selectedRentalIndices, setPlayerTeam, spawnEnemy, startBattleTransition]);

  const nextFactoryStage = useCallback(async () => {
    healAllPokemon();
    setStage((prev) => prev + 1);
    resetBattlePreview();
    startBattleTransition();
    await spawnEnemy(stage + 1);
  }, [healAllPokemon, resetBattlePreview, setStage, spawnEnemy, stage, startBattleTransition]);

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
    await nextFactoryStage();
  }, [enemyTeam, nextFactoryStage, playerTeam, setPlayerTeam, setSwapCount, setTotalRents]);

  return {
    startGame,
    toggleRental,
    confirmRentals,
    performSwap,
    nextFactoryStage,
    healAllPokemon,
    startBattleTransition,
    spawnEnemy,
  };
}
