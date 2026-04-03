import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { fetchEvolutionChain, fetchPokemon, getLearnableMoves, getProcessedPokemon, getRandomPokemonIdentifier } from '../../../services/pokeApi';
import { ALL_ITEMS } from '../../../uiAppConstants';
import type { GamePokemon, GameState, Item, Move, Pokemon } from '../../../types';
import type { GameReward, LocalizeFn, RewardAction, SelectedEvolutionPokemon, TranslateFn } from '../view-model';

interface UseRewardFlowParams {
  selectedGens: number[];
  startLevel: number;
  coins: number;
  rerollCount: number;
  rewardChoiceMade: boolean;
  playerTeam: GamePokemon[];
  showReplaceUI: GamePokemon | null;
  learningPokemonIdx: number | null;
  selectedNewMove: Move | null;
  selectedPokemonForEvolution: SelectedEvolutionPokemon | null;
  stage: number;
  t: TranslateFn;
  getLocalized: LocalizeFn;
  addMessagesSequentially: (messages: string[]) => Promise<void>;
  healAllPokemon: () => void;
  startBattleTransition: () => void;
  spawnEnemy: (currentStage: number) => Promise<void>;
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
  setSelectedPokemonForEvolution: Dispatch<SetStateAction<SelectedEvolutionPokemon | null>>;
  setEvolutionChoices: Dispatch<SetStateAction<Pokemon[]>>;
  setEvolutionTarget: Dispatch<SetStateAction<GamePokemon | null>>;
  setEvolvedPokemon: Dispatch<SetStateAction<GamePokemon | null>>;
  setIsEvolving: Dispatch<SetStateAction<boolean>>;
  setGameState: Dispatch<SetStateAction<GameState>>;
  setStage: Dispatch<SetStateAction<number>>;
}

export function useRewardFlow({
  selectedGens,
  startLevel,
  coins,
  rerollCount,
  rewardChoiceMade,
  playerTeam,
  showReplaceUI,
  learningPokemonIdx,
  selectedNewMove,
  selectedPokemonForEvolution,
  stage,
  t,
  getLocalized,
  addMessagesSequentially,
  healAllPokemon,
  startBattleTransition,
  spawnEnemy,
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
  setSelectedPokemonForEvolution,
  setEvolutionChoices,
  setEvolutionTarget,
  setEvolvedPokemon,
  setIsEvolving,
  setGameState,
  setStage,
}: UseRewardFlowParams) {
  const finishReward = useCallback(() => {
    setGameState('REWARD');
    setPendingRewardAction(null);
    setLearningPokemonIdx(null);
    setPotentialMoves([]);
    setSelectedNewMove(null);
    setSelectedPokemonForEvolution(null);
    setEvolutionChoices([]);
  }, [
    setEvolutionChoices,
    setGameState,
    setLearningPokemonIdx,
    setPendingRewardAction,
    setPotentialMoves,
    setSelectedNewMove,
    setSelectedPokemonForEvolution,
  ]);

  const generateRewardSet = useCallback(async () => {
    const newRewards: GameReward[] = [];
    const usedPokemonIds = new Set<number>();
    const usedItems = new Set<string>();
    const freeTypes: Array<'ITEM' | 'POKEMON' | 'MOVE' | 'EVOLUTION'> = ['ITEM', 'POKEMON', 'POKEMON', 'MOVE', 'EVOLUTION'];

    for (let i = 0; i < 3; i += 1) {
      const type = freeTypes[Math.floor(Math.random() * freeTypes.length)];

      if (type === 'ITEM') {
        let item: Item;
        let attempts = 0;
        do {
          item = ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)];
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
      } else {
        newRewards.push({ type, data: null });
      }
    }

    for (let i = 0; i < 3; i += 1) {
      let item: Item;
      let attempts = 0;
      do {
        item = ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)];
        attempts += 1;
      } while (usedItems.has(item.id) && attempts < 10);

      usedItems.add(item.id);
      newRewards.push({
        type: 'SHOP_ITEM',
        data: {
          item,
          price: 50 + Math.floor(Math.random() * 151),
        },
      });
    }

    return newRewards;
  }, [selectedGens, startLevel]);

  const rerollRewards = useCallback(async () => {
    const cost = 50 + rerollCount * 50;
    if (coins < cost) return;

    setLoading(true);
    try {
      setCoins((prev) => prev - cost);
      setRerollCount((prev) => prev + 1);
      setRewards(await generateRewardSet());
      setRewardChoiceMade(false);
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
    setRerollCount,
    setRewardChoiceMade,
    setRewards,
  ]);

  const selectReward = useCallback((reward: GameReward) => {
    if (reward.type === 'SHOP_ITEM') {
      if (coins < reward.data.price) return;
      setCoins((prev) => prev - reward.data.price);
      setInventory((prev) => [...prev, reward.data.item]);
      setRewards((prev) => prev.filter((entry) => entry !== reward));
      return;
    }

    if (rewardChoiceMade) return;

    if (reward.type === 'ITEM') {
      setRewardChoiceMade(true);
      setInventory((prev) => [...prev, reward.data]);
      return;
    }

    if (reward.type === 'POKEMON') {
      if (playerTeam.length < 6) {
        setRewardChoiceMade(true);
        setPlayerTeam((prev) => [...prev, reward.data]);
      } else {
        setShowReplaceUI(reward.data);
      }
      return;
    }

    if (reward.type === 'MOVE') {
      setRewardChoiceMade(true);
      setPendingRewardAction('MOVE');
      setLearningPokemonIdx(null);
      setPotentialMoves([]);
      setSelectedNewMove(null);
      return;
    }

    setRewardChoiceMade(true);
    setPendingRewardAction('EVOLUTION');
    setSelectedPokemonForEvolution(null);
    setEvolutionChoices([]);
  }, [
    coins,
    playerTeam.length,
    rewardChoiceMade,
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
  ]);

  const startEvolution = useCallback(async (pokemon: GamePokemon, index: number) => {
    setLoading(true);
    try {
      const nextEvolutionIds = await fetchEvolutionChain(pokemon.id);
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
  }, [addMessagesSequentially, setEvolutionChoices, setLoading, setSelectedPokemonForEvolution, t]);

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
  ]);

  const nextStage = useCallback(() => {
    healAllPokemon();
    setStage((prev) => prev + 1);
    startBattleTransition();
    void spawnEnemy(stage + 1);
  }, [healAllPokemon, setStage, spawnEnemy, stage, startBattleTransition]);

  const startLearningMove = useCallback(async (idx: number) => {
    setLoading(true);
    setLearningPokemonIdx(idx);
    try {
      setPotentialMoves(await getLearnableMoves(playerTeam[idx], playerTeam[idx].selectedMoves));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [playerTeam, setLearningPokemonIdx, setLoading, setPotentialMoves]);

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
    finishReward();
  }, [finishReward, learningPokemonIdx, playerTeam, selectedNewMove, setPlayerTeam]);

  const replacePokemon = useCallback((index: number) => {
    if (!showReplaceUI) return;

    const newTeam = [...playerTeam];
    newTeam[index] = showReplaceUI;
    setPlayerTeam(newTeam);
    setShowReplaceUI(null);
    setRewardChoiceMade(true);
  }, [playerTeam, setPlayerTeam, setRewardChoiceMade, setShowReplaceUI, showReplaceUI]);

  return {
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
