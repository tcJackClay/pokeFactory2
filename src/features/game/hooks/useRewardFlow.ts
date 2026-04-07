import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { fetchAvailableEvolutionChain, fetchPokemon, getLearnableMoves, getProcessedPokemon, getRandomPokemonIdentifier } from '../../../services/pokeApi';
import type { GamePokemon, GameState, Item, Move, Pokemon } from '../../../types';
import { FREE_REWARD_TYPE_WEIGHTS, getFreeRewardItemPool, getShopRewardItemPool, pickWeightedRewardType } from '../config/rewardPools';
import type { GameReward, LocalizeFn, RewardAction, SelectedEvolutionPokemon, TranslateFn } from '../view-model';

interface UseRewardFlowParams {
  selectedGens: number[];
  startLevel: number;
  coins: number;
  rerollCount: number;
  rewardChoiceMade: boolean;
  teamCapacity: number;
  playerTeam: GamePokemon[];
  showReplaceUI: GamePokemon | null;
  learningPokemonIdx: number | null;
  selectedNewMove: Move | null;
  pendingTmMove: Move | null;
  pendingTmLearnerIndexes: number[];
  pendingEvolutionEligibleIndexes: number[];
  selectedPokemonForEvolution: SelectedEvolutionPokemon | null;
  stage: number;
  t: TranslateFn;
  getLocalized: LocalizeFn;
  addMessagesSequentially: (messages: string[]) => Promise<void>;
  healAllPokemon: () => void;
  startBattleTransition: () => void;
  spawnEnemy: (
    currentStage: number,
    options?: { factoryPool?: GamePokemon[]; playerPool?: GamePokemon[]; playTrainerIntro?: boolean },
  ) => Promise<boolean>;
  prefetchEnemy: (currentStage: number) => Promise<boolean>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setCoins: Dispatch<SetStateAction<number>>;
  setRerollCount: Dispatch<SetStateAction<number>>;
  setRewards: Dispatch<SetStateAction<GameReward[]>>;
  setRewardChoiceMade: Dispatch<SetStateAction<boolean>>;
  setInventory: Dispatch<SetStateAction<Item[]>>;
  setPlayerTeam: Dispatch<SetStateAction<GamePokemon[]>>;
  setShowReplaceUI: Dispatch<SetStateAction<GamePokemon | null>>;
  setPendingRewardAction: Dispatch<SetStateAction<RewardAction>>;
  setLearningPokemonIdx: Dispatch<SetStateAction<number | null>>;
  setPotentialMoves: Dispatch<SetStateAction<Move[]>>;
  setSelectedNewMove: Dispatch<SetStateAction<Move | null>>;
  setPendingTmMove: Dispatch<SetStateAction<Move | null>>;
  setPendingTmLearnerIndexes: Dispatch<SetStateAction<number[]>>;
  setPendingEvolutionEligibleIndexes: Dispatch<SetStateAction<number[]>>;
  setSelectedPokemonForEvolution: Dispatch<SetStateAction<SelectedEvolutionPokemon | null>>;
  setEvolutionChoices: Dispatch<SetStateAction<Pokemon[]>>;
  setEvolutionTarget: Dispatch<SetStateAction<GamePokemon | null>>;
  setEvolvedPokemon: Dispatch<SetStateAction<GamePokemon | null>>;
  setIsEvolving: Dispatch<SetStateAction<boolean>>;
  setGameState: Dispatch<SetStateAction<GameState>>;
  setStage: Dispatch<SetStateAction<number>>;
  setTeamCapacity: Dispatch<SetStateAction<number>>;
}

export function useRewardFlow({
  selectedGens,
  startLevel,
  coins,
  rerollCount,
  rewardChoiceMade,
  teamCapacity,
  playerTeam,
  showReplaceUI,
  learningPokemonIdx,
  selectedNewMove,
  pendingTmMove,
  pendingTmLearnerIndexes,
  pendingEvolutionEligibleIndexes,
  selectedPokemonForEvolution,
  stage,
  t,
  getLocalized,
  addMessagesSequentially,
  healAllPokemon,
  startBattleTransition,
  spawnEnemy,
  prefetchEnemy,
  setLoading,
  setCoins,
  setRerollCount,
  setRewards,
  setRewardChoiceMade,
  setInventory,
  setPlayerTeam,
  setShowReplaceUI,
  setPendingRewardAction,
  setLearningPokemonIdx,
  setPotentialMoves,
  setSelectedNewMove,
  setPendingTmMove,
  setPendingTmLearnerIndexes,
  setPendingEvolutionEligibleIndexes,
  setSelectedPokemonForEvolution,
  setEvolutionChoices,
  setEvolutionTarget,
  setEvolvedPokemon,
  setIsEvolving,
  setGameState,
  setStage,
  setTeamCapacity,
}: UseRewardFlowParams) {
  const TEAM_CAPACITY_ITEM_ID = 'team_capacity_permit';
  const MAX_TEAM_CAPACITY = 6;

  const canGainTeamCapacity = teamCapacity < MAX_TEAM_CAPACITY;

  const grantItemReward = useCallback((item: Item) => {
    if (item.id === TEAM_CAPACITY_ITEM_ID) {
      if (!canGainTeamCapacity) return false;
      setTeamCapacity((prev) => Math.min(MAX_TEAM_CAPACITY, prev + 1));
      return true;
    }

    setInventory((prev) => [...prev, item]);
    return true;
  }, [canGainTeamCapacity, setInventory, setTeamCapacity]);

  const getShopPrice = useCallback((item: Item) => {
    if (item.id === TEAM_CAPACITY_ITEM_ID) {
      return 22 + Math.floor(Math.random() * 7);
    }
    return 8 + Math.floor(Math.random() * 21);
  }, []);

  const finishReward = useCallback(() => {
    setGameState('REWARD');
    setPendingRewardAction(null);
    setLearningPokemonIdx(null);
    setPotentialMoves([]);
    setSelectedNewMove(null);
    setPendingTmMove(null);
    setPendingTmLearnerIndexes([]);
    setPendingEvolutionEligibleIndexes([]);
    setSelectedPokemonForEvolution(null);
    setEvolutionChoices([]);
  }, [
    setEvolutionChoices,
    setGameState,
    setLearningPokemonIdx,
    setPendingEvolutionEligibleIndexes,
    setPendingTmLearnerIndexes,
    setPendingTmMove,
    setPendingRewardAction,
    setPotentialMoves,
    setSelectedNewMove,
    setSelectedPokemonForEvolution,
  ]);

  const getEvolvableIndices = useCallback(async () => {
    const checks = await Promise.all(
      playerTeam.map(async (pokemon, index) => {
        try {
          const nextEvolutionIds = await fetchAvailableEvolutionChain(pokemon.id);
          return nextEvolutionIds.length > 0 ? index : -1;
        } catch {
          return -1;
        }
      }),
    );

    return checks.filter((index) => index >= 0);
  }, [playerTeam]);

  const buildTmReward = useCallback(async () => {
    const teamMoves = await Promise.all(
      playerTeam.map(async (pokemon, index) => {
        try {
          const moves = await getLearnableMoves(pokemon, pokemon.selectedMoves, 5);
          return { index, moves };
        } catch {
          return { index, moves: [] as Move[] };
        }
      }),
    );

    const moveMap = new Map<string, { move: Move; learnerIndexes: Set<number> }>();

    teamMoves.forEach(({ index, moves }) => {
      moves.forEach((move) => {
        const existing = moveMap.get(move.name);
        if (existing) {
          existing.learnerIndexes.add(index);
          return;
        }

        moveMap.set(move.name, {
          move,
          learnerIndexes: new Set([index]),
        });
      });
    });

    const candidates = [...moveMap.values()].filter((entry) => entry.learnerIndexes.size > 0);
    if (candidates.length === 0) return null;

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    return {
      move: picked.move,
      learnerIndexes: [...picked.learnerIndexes],
    };
  }, [playerTeam]);

  const generateRewardSet = useCallback(async () => {
    const newRewards: GameReward[] = [];
    const usedPokemonIds = new Set<number>();
    const usedItems = new Set<string>();
    const freeRewardItemPool = getFreeRewardItemPool(canGainTeamCapacity);
    const shopRewardItemPool = getShopRewardItemPool(canGainTeamCapacity);
    if (freeRewardItemPool.length === 0 || shopRewardItemPool.length === 0) return newRewards;
    const evolvableIndices = await getEvolvableIndices();
    const tmReward = await buildTmReward();
    const freeTypes: Array<'ITEM' | 'POKEMON' | 'TM' | 'EVOLUTION'> = ['ITEM', 'POKEMON'];
    if (tmReward) freeTypes.push('TM');
    if (evolvableIndices.length > 0) freeTypes.push('EVOLUTION');
    const oneTimeTypes = new Set(['TM', 'EVOLUTION']);

    for (let i = 0; i < 3; i += 1) {
      if (freeTypes.length === 0) break;
      const type = pickWeightedRewardType(FREE_REWARD_TYPE_WEIGHTS, freeTypes);

      if (type === 'ITEM') {
        let item: Item;
        let attempts = 0;
        do {
          item = freeRewardItemPool[Math.floor(Math.random() * freeRewardItemPool.length)];
          attempts += 1;
        } while (usedItems.has(item.id) && attempts < 10);

        usedItems.add(item.id);
        newRewards.push({ type, data: item });
      } else if (type === 'POKEMON') {
        let rewardPokemon: GamePokemon | null = null;
        let attempts = 0;

        while (attempts < 10 && !rewardPokemon) {
          const identifier = await getRandomPokemonIdentifier(selectedGens);
          attempts += 1;

          try {
            const candidate = await getProcessedPokemon(identifier, startLevel);
            if (usedPokemonIds.has(candidate.id)) continue;
            rewardPokemon = candidate;
          } catch {
            continue;
          }
        }

        if (!rewardPokemon) continue;
        usedPokemonIds.add(rewardPokemon.id);
        newRewards.push({ type, data: rewardPokemon });
      } else if (type === 'TM') {
        if (!tmReward) continue;
        newRewards.push({ type, data: tmReward });
      } else {
        newRewards.push({
          type,
          data: {
            eligibleIndexes: evolvableIndices,
          },
        });
      }

      if (oneTimeTypes.has(type)) {
        const idx = freeTypes.indexOf(type);
        if (idx >= 0) freeTypes.splice(idx, 1);
      }
    }

    for (let i = 0; i < 3; i += 1) {
      let item: Item;
      let attempts = 0;
      do {
        item = shopRewardItemPool[Math.floor(Math.random() * shopRewardItemPool.length)];
        attempts += 1;
      } while (usedItems.has(item.id) && attempts < 10);

      usedItems.add(item.id);
      newRewards.push({
        type: 'SHOP_ITEM',
        data: {
          item,
          price: getShopPrice(item),
        },
      });
    }

    return newRewards;
  }, [buildTmReward, canGainTeamCapacity, getEvolvableIndices, getShopPrice, selectedGens, startLevel]);

  const openRewardStage = useCallback(async () => {
    setLoading(true);
    try {
      setRewards(await generateRewardSet());
      setRewardChoiceMade(false);
      setRerollCount(0);
      setPendingRewardAction(null);
      setLearningPokemonIdx(null);
      setPotentialMoves([]);
      setSelectedNewMove(null);
      setPendingTmMove(null);
      setPendingTmLearnerIndexes([]);
      setPendingEvolutionEligibleIndexes([]);
      setSelectedPokemonForEvolution(null);
      setEvolutionChoices([]);
      setShowReplaceUI(null);
      setGameState('REWARD');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [
    generateRewardSet,
    setEvolutionChoices,
    setGameState,
    setLearningPokemonIdx,
    setLoading,
    setPendingRewardAction,
    setPendingEvolutionEligibleIndexes,
    setPendingTmLearnerIndexes,
    setPendingTmMove,
    setPotentialMoves,
    setRerollCount,
    setRewardChoiceMade,
    setRewards,
    setSelectedNewMove,
    setSelectedPokemonForEvolution,
    setShowReplaceUI,
  ]);

  const rerollRewards = useCallback(async () => {
    const cost = 50 + rerollCount * 50;
    if (coins < cost) return;

    setLoading(true);
    try {
      setCoins((prev) => prev - cost);
      setRerollCount((prev) => prev + 1);
      setRewards(await generateRewardSet());
      setRewardChoiceMade(false);
      setPendingTmMove(null);
      setPendingTmLearnerIndexes([]);
      setPendingEvolutionEligibleIndexes([]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [
    coins,
    generateRewardSet,
    rerollCount,
    setCoins,
    setLoading,
    setPendingEvolutionEligibleIndexes,
    setPendingTmLearnerIndexes,
    setPendingTmMove,
    setRerollCount,
    setRewardChoiceMade,
    setRewards,
  ]);

  const selectReward = useCallback((reward: GameReward) => {
    if (reward.type === 'SHOP_ITEM') {
      if (coins < reward.data.price) return;
      if (!grantItemReward(reward.data.item)) return;
      setCoins((prev) => prev - reward.data.price);
      setRewards((prev) => prev.filter((entry) => entry !== reward));
      return;
    }

    if (rewardChoiceMade) return;

    if (reward.type === 'ITEM') {
      if (!grantItemReward(reward.data)) return;
      setRewardChoiceMade(true);
      return;
    }

    if (reward.type === 'POKEMON') {
      if (playerTeam.length < Math.min(teamCapacity, 6)) {
        setRewardChoiceMade(true);
        setPlayerTeam((prev) => [...prev, reward.data]);
      } else {
        setShowReplaceUI(reward.data);
      }
      return;
    }

    if (reward.type === 'TM') {
      setPendingRewardAction('MOVE');
      setLearningPokemonIdx(null);
      setPotentialMoves([]);
      setSelectedNewMove(null);
      setPendingTmMove(reward.data.move);
      setPendingTmLearnerIndexes(reward.data.learnerIndexes ?? []);
      return;
    }

    if (!Array.isArray(reward.data?.eligibleIndexes) || reward.data.eligibleIndexes.length === 0) return;
    setPendingRewardAction('EVOLUTION');
    setPendingEvolutionEligibleIndexes(reward.data.eligibleIndexes);
    setSelectedPokemonForEvolution(null);
    setEvolutionChoices([]);
  }, [
    coins,
    playerTeam.length,
    rewardChoiceMade,
    setPendingEvolutionEligibleIndexes,
    setPendingTmLearnerIndexes,
    setPendingTmMove,
    setCoins,
    setEvolutionChoices,
    setInventory,
    setLearningPokemonIdx,
    setPendingRewardAction,
    setPlayerTeam,
    setPotentialMoves,
    setRewardChoiceMade,
    setRewards,
    setSelectedNewMove,
    setSelectedPokemonForEvolution,
    setShowReplaceUI,
    teamCapacity,
    grantItemReward,
  ]);

  const startEvolution = useCallback(async (pokemon: GamePokemon, index: number) => {
    if (pendingEvolutionEligibleIndexes.length > 0 && !pendingEvolutionEligibleIndexes.includes(index)) {
      return;
    }
    setLoading(true);
    try {
      const nextEvolutionIds = await fetchAvailableEvolutionChain(pokemon.id);
      if (nextEvolutionIds.length === 0) {
        await addMessagesSequentially([t('cannotEvolve')]);
        return;
      }

      const choices = await Promise.all(nextEvolutionIds.map((id) => fetchPokemon(id)));
      setSelectedPokemonForEvolution({ pokemon, index });
      setEvolutionChoices(choices);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [addMessagesSequentially, pendingEvolutionEligibleIndexes, setEvolutionChoices, setLoading, setSelectedPokemonForEvolution, t]);

  const performEvolution = useCallback(async (evolvedId: number) => {
    if (!selectedPokemonForEvolution) return;

    const { pokemon, index } = selectedPokemonForEvolution;
    setLoading(true);

    try {
      const evolved = await getProcessedPokemon(evolvedId, pokemon.level);
      const hpPercent = pokemon.currentHp / pokemon.maxHp;
      evolved.currentHp = Math.floor(evolved.maxHp * hpPercent);

      setEvolutionTarget(pokemon);
      setEvolvedPokemon(evolved);
      setIsEvolving(true);

      setTimeout(() => {
        setPlayerTeam((prev) => {
          const newTeam = [...prev];
          newTeam[index] = evolved;
          return newTeam;
        });
        setRewardChoiceMade(true);

        setTimeout(() => {
          setIsEvolving(false);
          finishReward();
        }, 3000);
      }, 4000);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [
    finishReward,
    selectedPokemonForEvolution,
    setEvolvedPokemon,
    setEvolutionTarget,
    setIsEvolving,
    setLoading,
    setPlayerTeam,
    setRewardChoiceMade,
  ]);

  const nextStage = useCallback(async () => {
    const nextStageNo = stage + 1;
    healAllPokemon();
    setStage((prev) => prev + 1);
    await prefetchEnemy(nextStageNo);
    startBattleTransition();
    await spawnEnemy(nextStageNo, { playTrainerIntro: true });
    setPendingTmMove(null);
    setPendingTmLearnerIndexes([]);
    setPendingEvolutionEligibleIndexes([]);
  }, [healAllPokemon, prefetchEnemy, setPendingEvolutionEligibleIndexes, setPendingTmLearnerIndexes, setPendingTmMove, setStage, spawnEnemy, stage, startBattleTransition]);

  const startLearningMove = useCallback(async (idx: number) => {
    setLoading(true);
    setLearningPokemonIdx(idx);
    try {
      if (pendingTmMove) {
        const canLearnTm = pendingTmLearnerIndexes.includes(idx);
        if (!canLearnTm) {
          setLearningPokemonIdx(null);
          return;
        }

        const pokemon = playerTeam[idx];
        const alreadyKnows = pokemon.selectedMoves.some((move) => move.name === pendingTmMove.name);
        if (alreadyKnows) {
          setLearningPokemonIdx(null);
          return;
        }

        if (pokemon.selectedMoves.length < 4) {
          const newTeam = [...playerTeam];
          newTeam[idx] = {
            ...pokemon,
            selectedMoves: [...pokemon.selectedMoves, pendingTmMove],
          };
          setPlayerTeam(newTeam);
          setRewardChoiceMade(true);
          finishReward();
          return;
        }

        setSelectedNewMove(pendingTmMove);
        return;
      }

      setPotentialMoves(await getLearnableMoves(playerTeam[idx], playerTeam[idx].selectedMoves));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [
    finishReward,
    pendingTmLearnerIndexes,
    pendingTmMove,
    playerTeam,
    setLearningPokemonIdx,
    setLoading,
    setPlayerTeam,
    setPotentialMoves,
    setSelectedNewMove,
  ]);

  const handleLearnMove = useCallback((move: Move) => {
    if (learningPokemonIdx === null) return;

    const pokemon = playerTeam[learningPokemonIdx];
    if (pokemon.selectedMoves.length < 4) {
      const newTeam = [...playerTeam];
      newTeam[learningPokemonIdx] = {
        ...pokemon,
        selectedMoves: [...pokemon.selectedMoves, move],
      };
      setPlayerTeam(newTeam);
      finishReward();
      return;
    }

    setSelectedNewMove(move);
  }, [finishReward, learningPokemonIdx, playerTeam, setPlayerTeam, setSelectedNewMove]);

  const replaceMove = useCallback((oldMoveIdx: number) => {
    if (learningPokemonIdx === null || !selectedNewMove) return;

    const newTeam = [...playerTeam];
    const pokemon = { ...newTeam[learningPokemonIdx] };
    const newMoves = [...pokemon.selectedMoves];
    newMoves[oldMoveIdx] = selectedNewMove;
    pokemon.selectedMoves = newMoves;
    newTeam[learningPokemonIdx] = pokemon;
    setPlayerTeam(newTeam);
    setRewardChoiceMade(true);
    finishReward();
  }, [finishReward, learningPokemonIdx, playerTeam, selectedNewMove, setPlayerTeam, setRewardChoiceMade]);

  const replacePokemon = useCallback((index: number) => {
    if (!showReplaceUI) return;

    const newTeam = [...playerTeam];
    newTeam[index] = showReplaceUI;
    setPlayerTeam(newTeam);
    setShowReplaceUI(null);
    setRewardChoiceMade(true);
  }, [playerTeam, setPlayerTeam, setRewardChoiceMade, setShowReplaceUI, showReplaceUI]);

  return {
    openRewardStage,
    rerollRewards,
    selectReward,
    startEvolution,
    performEvolution,
    nextStage,
    startLearningMove,
    handleLearnMove,
    replaceMove,
    replacePokemon,
  };
}
