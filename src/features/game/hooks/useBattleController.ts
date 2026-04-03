import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { BattleMenuTab, GamePokemon, GameState, Item, Move, Weather } from '../../../types';
import { TYPE_CHART } from '../../../constants';
import { ACC_EVA_STAGE_MODIFIERS, STAT_STAGE_MODIFIERS } from '../../../uiAppConstants';
import { getFactoryTokenReward } from '../config/factoryRewards';
import {
  applyMoveSecondaryEffects as resolveMoveSecondaryEffects,
  applyStatusResidualDamage as resolveStatusResidualDamage,
  applyWeatherChipDamage as resolveWeatherChipDamage,
  findNextLivingLeadIndex,
  moveTeamMemberToFront,
} from '../lib/battleResolution';
import type {
  BattleAnimation,
  BattleSpecialMode,
  BattleSpecialUsageState,
  BattleTurn,
  FactoryAiTier,
  LocalizeFn,
  TranslateFn,
} from '../view-model';

interface UseBattleControllerParams {
  gameState: GameState;
  turn: BattleTurn;
  isMessageProcessing: boolean;
  inventory: Item[];
  playerTeam: GamePokemon[];
  enemy: GamePokemon | null;
  enemyTeam: GamePokemon[];
  activeBuffs: { atk: boolean; def: boolean };
  enemyBuffs: { atk: boolean; def: boolean };
  weather: Weather;
  stage: number;
  streak: number;
  enemyAiTier: FactoryAiTier;
  specialModeUnlocked: boolean;
  specialBossBattleActive: boolean;
  battleSpecialUsage: BattleSpecialUsageState;
  t: TranslateFn;
  getLocalized: LocalizeFn;
  setCoins: Dispatch<SetStateAction<number>>;
  setInventory: Dispatch<SetStateAction<Item[]>>;
  setPlayerTeam: Dispatch<SetStateAction<GamePokemon[]>>;
  setEnemy: Dispatch<SetStateAction<GamePokemon | null>>;
  setEnemyTeam: Dispatch<SetStateAction<GamePokemon[]>>;
  setActiveBuffs: Dispatch<SetStateAction<{ atk: boolean; def: boolean }>>;
  setEnemyBuffs: Dispatch<SetStateAction<{ atk: boolean; def: boolean }>>;
  setIsMessageProcessing: Dispatch<SetStateAction<boolean>>;
  setBattleLog: Dispatch<SetStateAction<string[]>>;
  setTurn: Dispatch<SetStateAction<BattleTurn>>;
  setBattleMenuTab: Dispatch<SetStateAction<BattleMenuTab>>;
  setPlayerAnim: Dispatch<SetStateAction<BattleAnimation>>;
  setEnemyAnim: Dispatch<SetStateAction<BattleAnimation>>;
  setActiveMoveType: Dispatch<SetStateAction<string | null>>;
  setIsCatching: Dispatch<SetStateAction<boolean>>;
  setCatchSuccess: Dispatch<SetStateAction<boolean | null>>;
  setShowReplaceUI: Dispatch<SetStateAction<GamePokemon | null>>;
  setGameState: Dispatch<SetStateAction<GameState>>;
  setStreak: Dispatch<SetStateAction<number>>;
  setRoundResult: Dispatch<SetStateAction<'WIN' | 'LOSS' | null>>;
  setLastTokenGain: Dispatch<SetStateAction<number>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setSpecialModeUnlocked: Dispatch<SetStateAction<boolean>>;
  setSpecialBossBattleActive: Dispatch<SetStateAction<boolean>>;
  setBattleSpecialUsage: Dispatch<SetStateAction<BattleSpecialUsageState>>;
}

export function useBattleController({
  gameState,
  turn,
  isMessageProcessing,
  inventory,
  playerTeam,
  enemy,
  enemyTeam,
  activeBuffs,
  enemyBuffs,
  weather,
  stage,
  streak,
  enemyAiTier,
  specialModeUnlocked,
  specialBossBattleActive,
  battleSpecialUsage,
  t,
  getLocalized,
  setCoins,
  setInventory,
  setPlayerTeam,
  setEnemy,
  setEnemyTeam,
  setActiveBuffs,
  setEnemyBuffs,
  setIsMessageProcessing,
  setBattleLog,
  setTurn,
  setBattleMenuTab,
  setPlayerAnim,
  setEnemyAnim,
  setActiveMoveType,
  setIsCatching,
  setCatchSuccess,
  setShowReplaceUI,
  setGameState,
  setStreak,
  setRoundResult,
  setLastTokenGain,
  setLoading,
  setSpecialModeUnlocked,
  setSpecialBossBattleActive,
  setBattleSpecialUsage,
}: UseBattleControllerParams) {
  const addMessagesSequentially = useCallback(async (messages: string[]) => {
    setIsMessageProcessing(true);

    for (const message of messages) {
      setBattleLog((prev) => [...prev, message]);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    setIsMessageProcessing(false);
  }, [setBattleLog, setIsMessageProcessing]);

  const setMainBattleTurn = useCallback((nextTurn: BattleTurn) => {
    setTurn(nextTurn);
    setBattleMenuTab('MAIN');
  }, [setBattleMenuTab, setTurn]);

  const syncEnemyLead = useCallback((nextEnemy: GamePokemon, currentEnemyTeam: GamePokemon[] = enemyTeam) => {
    const nextEnemyTeam = [...currentEnemyTeam];
    nextEnemyTeam[0] = nextEnemy;
    setEnemy(nextEnemy);
    setEnemyTeam(nextEnemyTeam);
    return nextEnemyTeam;
  }, [enemyTeam, setEnemy, setEnemyTeam]);

  const syncPlayerLead = useCallback((nextPlayer: GamePokemon, currentPlayerTeam: GamePokemon[] = playerTeam) => {
    const nextPlayerTeam = [...currentPlayerTeam];
    nextPlayerTeam[0] = nextPlayer;
    setPlayerTeam(nextPlayerTeam);
    return nextPlayerTeam;
  }, [playerTeam, setPlayerTeam]);

  const announceHpChange = useCallback(async (displayName: string, hpChange: number) => {
    if (hpChange > 0) {
      await addMessagesSequentially([`${displayName} recovered some HP!`]);
    } else if (hpChange < 0) {
      await addMessagesSequentially([`${displayName} was hurt by recoil!`]);
    }
  }, [addMessagesSequentially]);

  const applyWeatherChipDamage = useCallback(async (pokemon: GamePokemon) => {
    const result = resolveWeatherChipDamage({ pokemon, weather, getLocalized });
    if (result.messages.length > 0) {
      await addMessagesSequentially(result.messages);
    }
    return result.pokemon;
  }, [addMessagesSequentially, getLocalized, weather]);

  const applyResidualStatusDamage = useCallback(async (pokemon: GamePokemon) => {
    const result = resolveStatusResidualDamage(pokemon, getLocalized);
    if (result.messages.length > 0) {
      await addMessagesSequentially(result.messages);
    }
    return result;
  }, [addMessagesSequentially, getLocalized]);

  const applyMoveSecondaryEffects = useCallback(async ({
    move,
    actingSide,
    playerTeam: currentPlayerTeam,
    enemyTeam: currentEnemyTeam,
  }: {
    move: Move;
    actingSide: 'player' | 'enemy';
    playerTeam: GamePokemon[];
    enemyTeam: GamePokemon[];
  }) => {
    const result = resolveMoveSecondaryEffects({
      move,
      actingSide,
      teams: {
        playerTeam: currentPlayerTeam,
        enemyTeam: currentEnemyTeam,
      },
      getLocalized,
    });

    if (result.messages.length > 0) {
      await addMessagesSequentially(result.messages);
    }

    return result;
  }, [addMessagesSequentially, getLocalized]);

  const resolvePreTurnStatus = useCallback(async ({
    combatant,
    isEnemy,
    currentPlayerTeam,
    currentEnemyTeam,
  }: {
    combatant: GamePokemon;
    isEnemy: boolean;
    currentPlayerTeam?: GamePokemon[];
    currentEnemyTeam?: GamePokemon[];
  }) => {
    let nextCombatant = combatant;
    let nextPlayerTeam = currentPlayerTeam;
    let nextEnemyTeam = currentEnemyTeam;
    const displayName = isEnemy ? `Enemy ${getLocalized(combatant)}` : getLocalized(combatant);

    if (combatant.status === 'sleep') {
      await addMessagesSequentially([`${displayName} is fast asleep...`]);
      if (Math.random() < 0.33) {
        nextCombatant = { ...nextCombatant, status: undefined };
        if (isEnemy) {
          nextEnemyTeam = syncEnemyLead(nextCombatant, currentEnemyTeam);
        } else {
          nextPlayerTeam = syncPlayerLead(nextCombatant, currentPlayerTeam);
        }
        await addMessagesSequentially([`${displayName} woke up!`]);
      } else {
        setMainBattleTurn(isEnemy ? 'PLAYER' : 'ENEMY');
        return { canAct: false, combatant, playerTeam: nextPlayerTeam, enemyTeam: nextEnemyTeam };
      }
    }

    if (nextCombatant.status === 'freeze') {
      await addMessagesSequentially([`${displayName} is frozen solid...`]);
      if (Math.random() < 0.2) {
        nextCombatant = { ...nextCombatant, status: undefined };
        if (isEnemy) {
          nextEnemyTeam = syncEnemyLead(nextCombatant, nextEnemyTeam);
        } else {
          nextPlayerTeam = syncPlayerLead(nextCombatant, nextPlayerTeam);
        }
        await addMessagesSequentially([`${displayName} thawed out!`]);
      } else {
        setMainBattleTurn(isEnemy ? 'PLAYER' : 'ENEMY');
        return { canAct: false, combatant: nextCombatant, playerTeam: nextPlayerTeam, enemyTeam: nextEnemyTeam };
      }
    }

    if (nextCombatant.status === 'paralysis' && Math.random() < 0.25) {
      await addMessagesSequentially([`${displayName} is paralyzed and cannot move!`]);
      setMainBattleTurn(isEnemy ? 'PLAYER' : 'ENEMY');
      return { canAct: false, combatant: nextCombatant, playerTeam: nextPlayerTeam, enemyTeam: nextEnemyTeam };
    }

    return { canAct: true, combatant: nextCombatant, playerTeam: nextPlayerTeam, enemyTeam: nextEnemyTeam };
  }, [
    addMessagesSequentially,
    getLocalized,
    setMainBattleTurn,
    syncEnemyLead,
    syncPlayerLead,
  ]);

  const resolveBattleResult = useCallback(async (result: 'WIN' | 'LOSS') => {
    setLoading(true);

    try {
      const nextStreak = result === 'WIN' ? streak + 1 : streak;
      const tokens = getFactoryTokenReward(stage, result);

      if (result === 'WIN') {
        setStreak(nextStreak);
      }

      setCoins((prev) => prev + tokens);
      setRoundResult(result);
      setLastTokenGain(tokens);
      setGameState('ROUND_RESULT');

      const summary = result === 'WIN'
        ? t('battleSettlementWin', {
            streak: nextStreak,
            coins: tokens,
          })
        : t('battleSettlementLoss', { coins: tokens });

      if (result === 'WIN' && specialBossBattleActive && !specialModeUnlocked) {
        setSpecialModeUnlocked(true);
        setSpecialBossBattleActive(false);
        await addMessagesSequentially([
          summary,
          t('specialModeUnlock'),
        ]);
      } else {
        if (specialBossBattleActive) {
          setSpecialBossBattleActive(false);
        }
        await addMessagesSequentially([summary]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [
    addMessagesSequentially,
    setCoins,
    setGameState,
    setLastTokenGain,
    setLoading,
    setSpecialBossBattleActive,
    setSpecialModeUnlocked,
    setRoundResult,
    setStreak,
    specialBossBattleActive,
    specialModeUnlocked,
    stage,
    streak,
    t,
  ]);

  const winBattle = useCallback(async () => {
    await resolveBattleResult('WIN');
  }, [resolveBattleResult]);

  const loseBattle = useCallback(async () => {
    await resolveBattleResult('LOSS');
  }, [resolveBattleResult]);

  const sendOutNextEnemy = useCallback(async (currentEnemyTeam: GamePokemon[], excludedId: number) => {
    const nextEnemyIdx = findNextLivingLeadIndex(currentEnemyTeam, { excludeId: excludedId });
    if (nextEnemyIdx === -1) {
      setTimeout(() => void winBattle(), 500);
      return false;
    }

    const nextEnemyTeam = [...currentEnemyTeam];
    [nextEnemyTeam[0], nextEnemyTeam[nextEnemyIdx]] = [nextEnemyTeam[nextEnemyIdx], nextEnemyTeam[0]];
    setEnemyTeam(nextEnemyTeam);
    setEnemy(nextEnemyTeam[0]);
    await addMessagesSequentially([t('enemySentOut').replace('{name}', getLocalized(nextEnemyTeam[0]))]);
    setMainBattleTurn('PLAYER');
    return true;
  }, [addMessagesSequentially, getLocalized, setEnemy, setEnemyTeam, setMainBattleTurn, t, winBattle]);

  const sendOutNextPlayer = useCallback(async (currentPlayerTeam: GamePokemon[]) => {
    const aliveIdx = findNextLivingLeadIndex(currentPlayerTeam);
    if (aliveIdx === -1) {
      setTimeout(() => void loseBattle(), 500);
      return false;
    }

    const nextTeam = aliveIdx === 0 ? [...currentPlayerTeam] : moveTeamMemberToFront(currentPlayerTeam, aliveIdx);
    setPlayerTeam(nextTeam);
    await addMessagesSequentially([t('playerSentOut').replace('{name}', getLocalized(nextTeam[0]))]);
    setMainBattleTurn('PLAYER');
    return true;
  }, [addMessagesSequentially, getLocalized, loseBattle, setMainBattleTurn, setPlayerTeam, t]);

  const calculateDamage = useCallback((
    move: Move,
    attacker: GamePokemon,
    defender: GamePokemon,
    atkBuff: boolean,
    defBuff: boolean,
  ) => {
    if (move.damage_class === 'status') {
      return { damage: 0, multiplier: 1, isMiss: false, isCrit: false };
    }

    const basePower = move.power || 40;
    const levelMultiplier = (2 * attacker.level / 5) + 2;

    let attack = 50;
    let defense = 50;

    if (move.damage_class === 'special') {
      attack = attacker.calculatedStats.spAtk * (STAT_STAGE_MODIFIERS[attacker.statStages.spAtk as keyof typeof STAT_STAGE_MODIFIERS] || 1);
      defense = defender.calculatedStats.spDef * (STAT_STAGE_MODIFIERS[defender.statStages.spDef as keyof typeof STAT_STAGE_MODIFIERS] || 1);
    } else {
      attack = attacker.calculatedStats.attack * (STAT_STAGE_MODIFIERS[attacker.statStages.attack as keyof typeof STAT_STAGE_MODIFIERS] || 1);
      defense = defender.calculatedStats.defense * (STAT_STAGE_MODIFIERS[defender.statStages.defense as keyof typeof STAT_STAGE_MODIFIERS] || 1);
    }

    if (attacker.status === 'burn' && move.damage_class === 'physical') {
      attack *= 0.5;
    }

    let multiplier = 1;
    defender.types.forEach((typeSlot) => {
      const typeMultiplier = TYPE_CHART[move.type]?.[typeSlot.type.name];
      if (typeMultiplier !== undefined) {
        multiplier *= typeMultiplier;
      }
    });

    if (weather === 'sunny') {
      if (move.type === 'fire') multiplier *= 1.5;
      if (move.type === 'water') multiplier *= 0.5;
    } else if (weather === 'rainy') {
      if (move.type === 'water') multiplier *= 1.5;
      if (move.type === 'fire') multiplier *= 0.5;
    }

    const combinedStage = Math.max(-6, Math.min(6, attacker.statStages.accuracy - defender.statStages.evasion));
    const accuracyModifier = ACC_EVA_STAGE_MODIFIERS[combinedStage as keyof typeof ACC_EVA_STAGE_MODIFIERS] || 1;
    const finalAccuracy = (move.accuracy || 100) * accuracyModifier;

    if (Math.random() * 100 > finalAccuracy && move.accuracy !== null) {
      return { damage: 0, multiplier: 0, isMiss: true, isCrit: false };
    }

    let critChance = 1 / 24;
    if (move.critRate === 1) critChance = 1 / 8;
    if (move.critRate === 2) critChance = 1 / 2;
    if (move.critRate && move.critRate >= 3) critChance = 1;

    const isCrit = Math.random() < critChance;
    const critMultiplier = isCrit ? 1.5 : 1;

    let damage = Math.floor((((levelMultiplier * basePower * attack / defense) / 50) + 2) * (Math.random() * 0.15 + 0.85) * multiplier * critMultiplier);
    if (atkBuff) damage = Math.floor(damage * 1.5);
    if (defBuff) damage = Math.floor(damage * 0.7);

    return { damage, multiplier, isMiss: false, isCrit };
  }, [weather]);

  const SPECIAL_ITEM_BY_MODE: Record<BattleSpecialMode, string> = {
    MEGA: 'special_mega_stone',
    DYNAMAX: 'special_dmax_band',
    TERA: 'special_tera_orb',
  };
  const SPECIAL_MODES: BattleSpecialMode[] = ['MEGA', 'DYNAMAX', 'TERA'];

  const getSpecialLabel = useCallback((mode: BattleSpecialMode) => {
    if (mode === 'MEGA') return t('specialMega');
    if (mode === 'DYNAMAX') return t('specialDynamax');
    return t('specialTera');
  }, [t]);

  const applySpecialBoost = useCallback((pokemon: GamePokemon, mode: BattleSpecialMode): GamePokemon => {
    if (pokemon.specialBoostActive) return pokemon;
    const multiplier = mode === 'MEGA' ? 1.26 : 1.2;
    const hpBonus = mode === 'DYNAMAX' ? 0.35 : 0.12;

    const calculatedStats = {
      hp: pokemon.calculatedStats.hp,
      attack: Math.floor(pokemon.calculatedStats.attack * multiplier),
      defense: Math.floor(pokemon.calculatedStats.defense * multiplier),
      spAtk: Math.floor(pokemon.calculatedStats.spAtk * multiplier),
      spDef: Math.floor(pokemon.calculatedStats.spDef * multiplier),
      speed: Math.floor(pokemon.calculatedStats.speed * (mode === 'DYNAMAX' ? 1.05 : multiplier)),
    };
    const newMaxHp = Math.floor(pokemon.maxHp * (1 + hpBonus));
    const healAmount = Math.floor(newMaxHp * 0.2);

    const nextTypes = mode === 'TERA'
      ? [{ type: { name: pokemon.teraType || pokemon.types[0]?.type.name || 'normal' } }]
      : pokemon.types;

    return {
      ...pokemon,
      calculatedStats,
      maxHp: newMaxHp,
      currentHp: Math.min(newMaxHp, pokemon.currentHp + healAmount),
      specialBoostActive: true,
      specialBoostMode: mode,
      types: nextTypes,
      dynamaxTurnsLeft: mode === 'DYNAMAX' ? 3 : undefined,
    };
  }, []);

  const getSpecialItemCount = useCallback((mode: BattleSpecialMode) => {
    const targetId = SPECIAL_ITEM_BY_MODE[mode];
    return inventory.filter((item) => item.id === targetId).length;
  }, [inventory]);

  const consumeSpecialItem = useCallback((mode: BattleSpecialMode) => {
    const targetId = SPECIAL_ITEM_BY_MODE[mode];
    const itemIndex = inventory.findIndex((item) => item.id === targetId);
    if (itemIndex < 0) return null;
    const consumed = inventory[itemIndex];
    const nextInventory = [...inventory];
    nextInventory.splice(itemIndex, 1);
    setInventory(nextInventory);
    return consumed;
  }, [inventory, setInventory]);

  const canPlayerUseSpecialByMode = useCallback((mode: BattleSpecialMode) => {
    if (gameState !== 'BATTLE' || turn !== 'PLAYER' || isMessageProcessing) return false;
    if (!playerTeam[0]) return false;
    if (battleSpecialUsage[mode]) return false;
    if (!specialModeUnlocked) return false;
    return getSpecialItemCount(mode) > 0;
  }, [
    battleSpecialUsage,
    gameState,
    getSpecialItemCount,
    isMessageProcessing,
    playerTeam,
    specialModeUnlocked,
    turn,
  ]);

  const hasMatchingMegaStone = useCallback((pokemon: GamePokemon) => {
    const held = pokemon.factoryHeldItemId?.toLowerCase() ?? '';
    if (!held) return false;
    return held.includes('ite') || held === 'red_orb' || held === 'blue_orb';
  }, []);

  const canUseBattleSpecialByMode: Record<BattleSpecialMode, boolean> = {
    MEGA: canPlayerUseSpecialByMode('MEGA'),
    DYNAMAX: canPlayerUseSpecialByMode('DYNAMAX'),
    TERA: canPlayerUseSpecialByMode('TERA'),
  };
  const canUseBattleSpecial = SPECIAL_MODES.some((mode) => canUseBattleSpecialByMode[mode]);

  const triggerBattleSpecial = useCallback(async (mode: BattleSpecialMode) => {
    if (!canPlayerUseSpecialByMode(mode)) return;
    if (mode === 'MEGA' && !hasMatchingMegaStone(playerTeam[0])) {
      await addMessagesSequentially([t('specialMegaStoneMismatch')]);
      return;
    }
    const consumedItem = consumeSpecialItem(mode);
    if (!consumedItem) return;
    const sourceTeam = [...playerTeam];
    if (!sourceTeam[0]) return;
    const boostedLead = applySpecialBoost(sourceTeam[0], mode);
    sourceTeam[0] = boostedLead;
    setPlayerTeam(sourceTeam);
    setBattleSpecialUsage((prev) => ({ ...prev, [mode]: true }));
    await addMessagesSequentially([
      t('youUsed').replace('{name}', getLocalized(consumedItem)),
      t('specialActivated').replace('{mode}', getSpecialLabel(mode)).replace('{name}', getLocalized(boostedLead)),
    ]);
    setMainBattleTurn('ENEMY');
  }, [
    addMessagesSequentially,
    applySpecialBoost,
    canPlayerUseSpecialByMode,
    consumeSpecialItem,
    getLocalized,
    getSpecialLabel,
    hasMatchingMegaStone,
    playerTeam,
    setBattleSpecialUsage,
    setMainBattleTurn,
    setPlayerTeam,
    t,
  ]);

  const useItem = useCallback(async (item: Item, index: number) => {
    if (gameState !== 'BATTLE' || turn !== 'PLAYER' || isMessageProcessing || !enemy) return;

    await addMessagesSequentially([t('youUsed').replace('{name}', getLocalized(item))]);

    if (item.isSpecialTriggerItem) {
      await addMessagesSequentially([t('specialUseMenuHint')]);
      return;
    }

    if (item.isBall) {
      await addMessagesSequentially([t('cannotCatchFactory')]);
      setMainBattleTurn('ENEMY');
      return;
    }

    const newInventory = [...inventory];
    newInventory.splice(index, 1);
    setInventory(newInventory);

    const updatedTeam = [...playerTeam];
    updatedTeam[0] = item.effect(updatedTeam[0]);
    setPlayerTeam(updatedTeam);

    if (item.id === 'battle_atk') setActiveBuffs((prev) => ({ ...prev, atk: true }));
    if (item.id === 'battle_def') setActiveBuffs((prev) => ({ ...prev, def: true }));

    setMainBattleTurn('ENEMY');
  }, [
    addMessagesSequentially,
    enemy,
    gameState,
    getLocalized,
    inventory,
    isMessageProcessing,
    playerTeam,
    setActiveBuffs,
    setBattleMenuTab,
    setCatchSuccess,
    setInventory,
    setIsCatching,
    setPlayerTeam,
    setShowReplaceUI,
    setMainBattleTurn,
    t,
    turn,
    winBattle,
  ]);

  const switchPokemon = useCallback(async (index: number) => {
    if (gameState !== 'BATTLE' || turn !== 'PLAYER' || index === 0 || isMessageProcessing) return;

    const newTeam = [...playerTeam];
    const currentLead = newTeam[0];
    newTeam[0] = newTeam[index];
    newTeam[index] = currentLead;

    setPlayerTeam(newTeam);
    await addMessagesSequentially([
      t('withdrew').replace('{name}', getLocalized(currentLead)),
      t('playerSentOut').replace('{name}', getLocalized(newTeam[0])),
    ]);
    setMainBattleTurn('ENEMY');
  }, [
    addMessagesSequentially,
    gameState,
    getLocalized,
    isMessageProcessing,
    playerTeam,
    setMainBattleTurn,
    setPlayerTeam,
    t,
    turn,
  ]);

  const executeTurn = useCallback(async ({
    actingSide,
    move,
    actor,
    actorTeam,
    defender,
    defenderTeam,
  }: {
    actingSide: 'player' | 'enemy';
    move: Move;
    actor: GamePokemon;
    actorTeam: GamePokemon[];
    defender: GamePokemon;
    defenderTeam: GamePokemon[];
  }) => {
    const isPlayerActing = actingSide === 'player';
    const defendingSide: 'player' | 'enemy' = isPlayerActing ? 'enemy' : 'player';
    const attackBuffApplied = isPlayerActing ? activeBuffs.atk : enemyBuffs.atk;
    const defenseBuffApplied = isPlayerActing ? enemyBuffs.def : activeBuffs.def;
    const actorLabel = isPlayerActing ? getLocalized(actor) : `Enemy ${getLocalized(actor)}`;

    let nextPlayerTeam = isPlayerActing ? [...actorTeam] : [...defenderTeam];
    let nextEnemyTeam = isPlayerActing ? [...defenderTeam] : [...actorTeam];
    let updatedActor = actor;
    let updatedDefender = defender;

    const syncPlayerLeadLocally = (pokemon: GamePokemon) => {
      nextPlayerTeam = [...nextPlayerTeam];
      nextPlayerTeam[0] = pokemon;
      setPlayerTeam(nextPlayerTeam);
      return nextPlayerTeam;
    };

    const syncLeadBySide = (side: 'player' | 'enemy', pokemon: GamePokemon) => {
      if (side === 'player') {
        return syncPlayerLeadLocally(pokemon);
      }

      nextEnemyTeam = syncEnemyLead(pokemon, nextEnemyTeam);
      return nextEnemyTeam;
    };

    if (isPlayerActing) {
      setPlayerAnim('attack');
    } else {
      setEnemyAnim('attack');
    }
    setActiveMoveType(move.type);

    await addMessagesSequentially([
      isPlayerActing
        ? t('usedMove').replace('{name}', getLocalized(actor)).replace('{move}', getLocalized(move))
        : t('enemyUsedMove').replace('{name}', getLocalized(actor)).replace('{move}', getLocalized(move)),
    ]);

    const { damage, multiplier, isMiss, isCrit } = calculateDamage(move, actor, defender, attackBuffApplied, defenseBuffApplied);

    if (isMiss) {
      await addMessagesSequentially([`${actorLabel}'s attack missed!`]);
      if (isPlayerActing) {
        setPlayerAnim('idle');
        setMainBattleTurn('ENEMY');
      } else {
        setEnemyAnim('idle');
        setMainBattleTurn('PLAYER');
      }
      setActiveMoveType(null);
      return;
    }

    if (isCrit) {
      await addMessagesSequentially(['Critical hit!']);
    }

    const newDefenderHp = Math.max(0, defender.currentHp - damage);
    updatedDefender = { ...defender, currentHp: newDefenderHp };
    if (damage > 0) {
      if (isPlayerActing) {
        setEnemyAnim('hit');
      } else {
        setPlayerAnim('hit');
      }
    }
    syncLeadBySide(defendingSide, updatedDefender);

    let actorHpChange = 0;
    if (move.drain !== 0 && damage > 0) actorHpChange += Math.floor(damage * move.drain / 100);
    if (move.healing !== 0) actorHpChange += Math.floor(actor.maxHp * move.healing / 100);

    updatedActor = {
      ...actor,
      currentHp: Math.max(0, Math.min(actor.maxHp, actor.currentHp + actorHpChange)),
    };
    syncLeadBySide(actingSide, updatedActor);
    await announceHpChange(actorLabel, actorHpChange);

    if (updatedDefender.currentHp > 0) {
      updatedDefender = await applyWeatherChipDamage(updatedDefender);
      syncLeadBySide(defendingSide, updatedDefender);
    }

    if (isPlayerActing) {
      setPlayerAnim('idle');
      setActiveBuffs((prev) => ({ ...prev, atk: false }));
    } else {
      setEnemyAnim('idle');
      setActiveBuffs((prev) => ({ ...prev, def: false }));
    }
    setActiveMoveType(null);

    const effectMessages: string[] = [];
    if (damage > 0) {
      if (multiplier > 1) effectMessages.push(t('superEffective'));
      if (multiplier < 1 && multiplier > 0) effectMessages.push(t('notVeryEffective'));
      if (multiplier === 0) effectMessages.push(t('noEffect'));
    }
    if (effectMessages.length > 0) {
      await addMessagesSequentially(effectMessages);
    }
    if (damage > 0) {
      await addMessagesSequentially([
        (isPlayerActing ? t('causedDamage') : t('enemyCausedDamage'))
          .replace('{name}', getLocalized(actor))
          .replace('{damage}', damage.toString()),
      ]);
    }

    if (updatedDefender.currentHp > 0) {
      const secondaryEffects = await applyMoveSecondaryEffects({
        move,
        actingSide,
        playerTeam: nextPlayerTeam,
        enemyTeam: nextEnemyTeam,
      });
      nextPlayerTeam = secondaryEffects.playerTeam;
      nextEnemyTeam = secondaryEffects.enemyTeam;
      setPlayerTeam(nextPlayerTeam);
      nextEnemyTeam = syncEnemyLead(nextEnemyTeam[0], nextEnemyTeam);
      updatedDefender = defendingSide === 'player' ? nextPlayerTeam[0] : nextEnemyTeam[0];

      if (secondaryEffects.flinched) {
        if (defendingSide === 'player') {
          setPlayerAnim('idle');
          setMainBattleTurn('ENEMY');
        } else {
          setEnemyAnim('idle');
          setMainBattleTurn('PLAYER');
        }
        return;
      }
    }

    if (updatedDefender.currentHp > 0 && (updatedDefender.status === 'poison' || updatedDefender.status === 'burn')) {
      const residualResult = await applyResidualStatusDamage(updatedDefender);
      updatedDefender = residualResult.pokemon;
      if (defendingSide === 'player') {
        syncPlayerLeadLocally(updatedDefender);
      } else {
        nextEnemyTeam = syncEnemyLead(updatedDefender, nextEnemyTeam);
      }

      if (residualResult.fainted) {
        await addMessagesSequentially([t('fainted').replace('{name}', getLocalized(updatedDefender))]);
        if (defendingSide === 'player') {
          await sendOutNextPlayer(nextPlayerTeam);
        } else {
          await sendOutNextEnemy(nextEnemyTeam, defender.id);
        }
        return;
      }
    }

    if (defendingSide === 'player') {
      setPlayerAnim('idle');
    } else {
      setEnemyAnim('idle');
    }

    if (newDefenderHp <= 0) {
      await addMessagesSequentially([t('fainted').replace('{name}', getLocalized(defender))]);
      if (defendingSide === 'player') {
        await sendOutNextPlayer(nextPlayerTeam);
      } else {
        await sendOutNextEnemy(nextEnemyTeam, defender.id);
      }
      return;
    }

    setMainBattleTurn(isPlayerActing ? 'ENEMY' : 'PLAYER');
  }, [
    activeBuffs.atk,
    activeBuffs.def,
    addMessagesSequentially,
    announceHpChange,
    applyMoveSecondaryEffects,
    applyResidualStatusDamage,
    applyWeatherChipDamage,
    calculateDamage,
    enemyBuffs.atk,
    enemyBuffs.def,
    getLocalized,
    sendOutNextEnemy,
    sendOutNextPlayer,
    setActiveBuffs,
    setActiveMoveType,
    setEnemyAnim,
    setMainBattleTurn,
    setPlayerAnim,
    setPlayerTeam,
    syncEnemyLead,
    t,
  ]);

  const handleAttack = useCallback(async (move: Move) => {
    if (!enemy || gameState !== 'BATTLE' || turn !== 'PLAYER' || isMessageProcessing) return;

    const preTurnResult = await resolvePreTurnStatus({
      combatant: playerTeam[0],
      isEnemy: false,
      currentPlayerTeam: playerTeam,
    });
    if (!preTurnResult.canAct) return;

    await executeTurn({
      actingSide: 'player',
      move,
      actor: preTurnResult.combatant,
      actorTeam: preTurnResult.playerTeam ?? playerTeam,
      defender: enemy,
      defenderTeam: enemyTeam,
    });
  }, [enemy, enemyTeam, executeTurn, gameState, isMessageProcessing, playerTeam, resolvePreTurnStatus, turn]);

  const getMoveTypeMultiplier = useCallback((move: Move, defender: GamePokemon) => {
    let multiplier = 1;
    defender.types.forEach((typeSlot) => {
      const typeMultiplier = TYPE_CHART[move.type]?.[typeSlot.type.name];
      if (typeMultiplier !== undefined) {
        multiplier *= typeMultiplier;
      }
    });
    return multiplier;
  }, []);

  const estimateEnemyMoveScore = useCallback((move: Move, attacker: GamePokemon, defender: GamePokemon) => {
    const isStatus = move.damage_class === 'status';
    const typeMultiplier = getMoveTypeMultiplier(move, defender);
    const stab = attacker.types.some((slot) => slot.type.name === move.type) ? 1.25 : 1;
    const accuracy = (move.accuracy ?? 100) / 100;
    const basePower = move.power ?? 0;
    const offensiveStat = move.damage_class === 'special' ? attacker.calculatedStats.spAtk : attacker.calculatedStats.attack;
    const defensiveStat = move.damage_class === 'special' ? defender.calculatedStats.spDef : defender.calculatedStats.defense;
    const expectedDamage = isStatus
      ? 0
      : Math.max(1, ((basePower * offensiveStat) / Math.max(1, defensiveStat)) * typeMultiplier * stab * accuracy / 12);
    const wouldKO = expectedDamage >= defender.currentHp;

    let score = expectedDamage;
    if (wouldKO) score += 140;
    if (typeMultiplier > 1) score += 18;
    if (typeMultiplier === 0) score -= 40;

    if (isStatus) {
      score += 8;
      if (move.ailment && !defender.status) score += 30;
      if (move.statChanges?.some((change) => change.change > 0)) score += 18;
      if (move.healing && attacker.currentHp < attacker.maxHp * 0.5) score += 22;
    }

    return score;
  }, [getMoveTypeMultiplier]);

  const chooseEnemyMove = useCallback((actingEnemy: GamePokemon, defender: GamePokemon) => {
    if (enemyAiTier === 'RANDOM') {
      return actingEnemy.selectedMoves[Math.floor(Math.random() * actingEnemy.selectedMoves.length)];
    }

    const sortedMoves = [...actingEnemy.selectedMoves]
      .map((move) => ({ move, score: estimateEnemyMoveScore(move, actingEnemy, defender) }))
      .sort((a, b) => b.score - a.score);

    if (enemyAiTier === 'BASIC') {
      // 保留一定随机性，避免前中期 AI 过于“读心”。
      const pool = sortedMoves.slice(0, Math.min(2, sortedMoves.length));
      return pool[Math.floor(Math.random() * pool.length)].move;
    }

    if (enemyAiTier === 'ADVANCED') {
      const top = sortedMoves.slice(0, Math.min(3, sortedMoves.length));
      return top[Math.floor(Math.random() * top.length)].move;
    }

    // BOSS：使用评分最高技能。
    return sortedMoves[0].move;
  }, [enemyAiTier, estimateEnemyMoveScore]);

  const enemyTurn = useCallback(async () => {
    if (!enemy || !playerTeam[0] || turn !== 'ENEMY' || isMessageProcessing) return;

    const actingEnemyLead = enemy;
    const enemyTeamForTurn = enemyTeam;

    const preTurnResult = await resolvePreTurnStatus({
      combatant: actingEnemyLead,
      isEnemy: true,
      currentEnemyTeam: enemyTeamForTurn,
    });
    if (!preTurnResult.canAct) return;

    const actingEnemy = preTurnResult.combatant;
    const move = chooseEnemyMove(actingEnemy, playerTeam[0]);

    await executeTurn({
      actingSide: 'enemy',
      move,
      actor: actingEnemy,
      actorTeam: preTurnResult.enemyTeam ?? enemyTeamForTurn,
      defender: playerTeam[0],
      defenderTeam: playerTeam,
    });
  }, [
    chooseEnemyMove,
    enemy,
    enemyTeam,
    executeTurn,
    gameState,
    isMessageProcessing,
    playerTeam,
    resolvePreTurnStatus,
    turn,
  ]);

  useEffect(() => {
    if (turn === 'ENEMY' && gameState === 'BATTLE') {
      void enemyTurn();
    }
  }, [enemyTurn, gameState, turn]);

  useEffect(() => {
    if (turn !== 'PLAYER' || gameState !== 'BATTLE') return;
    const lead = playerTeam[0];
    if (!lead || lead.specialBoostMode !== 'DYNAMAX' || !lead.specialBoostActive) return;

    const turnsLeft = (lead.dynamaxTurnsLeft ?? 0) - 1;
    if (turnsLeft > 0) {
      const nextTeam = [...playerTeam];
      nextTeam[0] = { ...lead, dynamaxTurnsLeft: turnsLeft };
      setPlayerTeam(nextTeam);
      return;
    }

    const revertedStats = {
      hp: lead.calculatedStats.hp,
      attack: Math.max(1, Math.floor(lead.calculatedStats.attack / 1.2)),
      defense: Math.max(1, Math.floor(lead.calculatedStats.defense / 1.2)),
      spAtk: Math.max(1, Math.floor(lead.calculatedStats.spAtk / 1.2)),
      spDef: Math.max(1, Math.floor(lead.calculatedStats.spDef / 1.2)),
      speed: Math.max(1, Math.floor(lead.calculatedStats.speed / 1.05)),
    };
    const revertedMaxHp = Math.max(1, Math.floor(lead.maxHp / 1.35));
    const revertedHp = Math.max(1, Math.min(revertedMaxHp, Math.floor(lead.currentHp / 1.35)));
    const revertedLead: GamePokemon = {
      ...lead,
      calculatedStats: revertedStats,
      maxHp: revertedMaxHp,
      currentHp: revertedHp,
      specialBoostActive: false,
      specialBoostMode: undefined,
      dynamaxTurnsLeft: undefined,
    };
    const nextTeam = [...playerTeam];
    nextTeam[0] = revertedLead;
    setPlayerTeam(nextTeam);
    void addMessagesSequentially([t('specialDynamaxEnd').replace('{name}', getLocalized(revertedLead))]);
  }, [addMessagesSequentially, gameState, getLocalized, playerTeam, setPlayerTeam, t, turn]);

  const forfeitChallenge = useCallback(() => {
    if (gameState !== 'BATTLE' || isMessageProcessing) return;
    void loseBattle();
  }, [gameState, isMessageProcessing, loseBattle]);

  return {
    addMessagesSequentially,
    useItem,
    switchPokemon,
    handleAttack,
    triggerBattleSpecial,
    canUseBattleSpecial,
    canUseBattleSpecialByMode,
    forfeitChallenge,
  };
}
