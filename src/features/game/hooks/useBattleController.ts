import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { BattleMenuTab, GamePokemon, GameState, Item, Move, Weather } from '../../../types';
import { TYPE_CHART } from '../../../constants';
import { ACC_EVA_STAGE_MODIFIERS, STAT_STAGE_MODIFIERS } from '../../../uiAppConstants';
import { getFactoryTokenReward } from '../config/factoryRewards';
import {
  FACTORY_STYLE,
  type FactoryStyleId,
  getFactoryStyleAffinityBonus,
  getFactoryTeamStyle,
} from '../config/factoryBattleStyle';
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
  enemySpecialUsage: BattleSpecialUsageState;
  allowWildCatch: boolean;
  suppressFactoryBattleResult: boolean;
  onSuppressBattleResolved: (result: 'WIN' | 'LOSS') => void;
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
  setEnemySpecialUsage: Dispatch<SetStateAction<BattleSpecialUsageState>>;
}

const AI_FLAG_CHECK_BAD_MOVE = 1 << 0;
const AI_FLAG_TRY_TO_FAINT = 1 << 1;
const AI_FLAG_CHECK_VIABILITY = 1 << 2;
const AI_FLAG_SMART_SWITCHING = 1 << 3;
const AI_FLAG_SMART_TERA = 1 << 4;
const AI_FLAG_RANDOMIZE_SWITCHIN = 1 << 5;

const AI_FLAG_BASIC_TRAINER =
  AI_FLAG_CHECK_BAD_MOVE
  | AI_FLAG_TRY_TO_FAINT
  | AI_FLAG_CHECK_VIABILITY;

const AI_FLAG_SMART_TRAINER =
  AI_FLAG_BASIC_TRAINER
  | AI_FLAG_SMART_SWITCHING
  | AI_FLAG_SMART_TERA
  | AI_FLAG_RANDOMIZE_SWITCHIN;

const AI_CONSERVE_GIMMICK_CHANCE_PER_MON = 10;
const AI_GIMMICK_PREDICT_CHANCE = 40;

interface AiMoveEval {
  move: Move;
  score: number;
  expectedDamage: number;
  wouldKo: boolean;
}

interface GimmickAltCalcs {
  dealtWithout: number[];
  dealtWith: number[];
  takenWithout: number[];
  takenWith: number[];
}

interface GimmickTurnScore {
  score: number;
  hpRatio: number;
  enablesKo: boolean;
  savedFromKo: boolean;
  getsPunishedByCoverage: boolean;
  improvesOffensiveSpread: boolean;
  improvesDefensiveSpread: boolean;
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
  enemySpecialUsage,
  allowWildCatch,
  suppressFactoryBattleResult,
  onSuppressBattleResolved,
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
  setEnemySpecialUsage,
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
      if (suppressFactoryBattleResult) {
        onSuppressBattleResolved(result);
        return;
      }

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
    onSuppressBattleResolved,
    setCoins,
    setGameState,
    setLastTokenGain,
    setLoading,
    setSpecialBossBattleActive,
    setSpecialModeUnlocked,
    setRoundResult,
    setStreak,
    suppressFactoryBattleResult,
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

    const zMoveBoost = attacker.specialBoostActive && attacker.specialBoostMode === 'ZMOVE' && move.damage_class !== 'status'
      ? 1.55
      : 1;
    let damage = Math.floor((((levelMultiplier * basePower * attack / defense) / 50) + 2) * (Math.random() * 0.15 + 0.85) * multiplier * critMultiplier * zMoveBoost);
    if (atkBuff) damage = Math.floor(damage * 1.5);
    if (defBuff) damage = Math.floor(damage * 0.7);

    return { damage, multiplier, isMiss: false, isCrit };
  }, [weather]);

  const SPECIAL_ITEM_BY_MODE: Record<BattleSpecialMode, string> = {
    MEGA: 'special_mega_stone',
    DYNAMAX: 'special_dmax_band',
    TERA: 'special_tera_orb',
    ZMOVE: 'special_z_crystal',
  };
  const SPECIAL_MODES: BattleSpecialMode[] = ['MEGA', 'DYNAMAX', 'TERA', 'ZMOVE'];

  const getSpecialLabel = useCallback((mode: BattleSpecialMode) => {
    if (mode === 'MEGA') return t('specialMega');
    if (mode === 'DYNAMAX') return t('specialDynamax');
    if (mode === 'TERA') return t('specialTera');
    return t('specialZMove');
  }, [t]);

  const applySpecialBoost = useCallback((pokemon: GamePokemon, mode: BattleSpecialMode): GamePokemon => {
    if (pokemon.specialBoostActive) return pokemon;
    if (mode === 'ZMOVE') {
      return {
        ...pokemon,
        specialBoostActive: true,
        specialBoostMode: mode,
      };
    }
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

  const getAiFlagsForTier = useCallback((tier: FactoryAiTier) => {
    if (tier === 'RANDOM') return AI_FLAG_CHECK_BAD_MOVE;
    if (tier === 'BASIC') return AI_FLAG_BASIC_TRAINER;
    if (tier === 'ADVANCED') return AI_FLAG_SMART_TRAINER;
    return AI_FLAG_SMART_TRAINER | AI_FLAG_TRY_TO_FAINT;
  }, []);

  const isProtectLikeMove = useCallback((move: Move) => {
    return move.name === 'protect' || move.name === 'detect' || move.name === 'kings-shield' || move.name === 'spiky-shield';
  }, []);

  const hasMatchingZCrystal = useCallback((pokemon: GamePokemon) => {
    const held = pokemon.factoryHeldItemId?.toLowerCase() ?? '';
    if (!held) return false;
    return held.endsWith('-z') || held.endsWith('_z') || held.includes('ium-z') || held.includes('ium_z');
  }, []);

  const estimateDeterministicDamage = useCallback((
    move: Move,
    attacker: GamePokemon,
    defender: GamePokemon,
    gimmickMode: BattleSpecialMode | 'NONE',
  ) => {
    if (move.damage_class === 'status') return 0;

    const attackStat = move.damage_class === 'special'
      ? attacker.calculatedStats.spAtk
      : attacker.calculatedStats.attack;
    const defenseStat = move.damage_class === 'special'
      ? defender.calculatedStats.spDef
      : defender.calculatedStats.defense;
    const basePower = move.power ?? 0;
    const levelScale = ((2 * attacker.level) / 5) + 2;
    let multiplier = 1;
    defender.types.forEach((slot) => {
      const typeMultiplier = TYPE_CHART[move.type]?.[slot.type.name];
      if (typeMultiplier !== undefined) multiplier *= typeMultiplier;
    });
    const stab = attacker.types.some((slot) => slot.type.name === move.type) ? 1.25 : 1;
    const accuracy = (move.accuracy ?? 100) / 100;
    const gimmickBoost = gimmickMode === 'MEGA'
      ? 1.26
      : gimmickMode === 'DYNAMAX'
        ? 1.2
        : gimmickMode === 'ZMOVE'
          ? 1.55
        : gimmickMode === 'TERA' && move.type === (attacker.teraType || attacker.types[0]?.type.name || 'normal')
          ? 1.5
          : 1;
    const raw = (((levelScale * basePower * Math.max(1, attackStat)) / Math.max(1, defenseStat)) / 50) + 2;
    return Math.max(1, Math.floor(raw * multiplier * stab * accuracy * gimmickBoost));
  }, []);

  const estimateDeterministicDamageWithContext = useCallback((
    move: Move,
    attacker: GamePokemon,
    defender: GamePokemon,
    options?: {
      attackerGimmick?: BattleSpecialMode | 'NONE';
      defenderGimmick?: BattleSpecialMode | 'NONE';
    },
  ) => {
    if (move.damage_class === 'status') return 0;
    const attackerGimmick = options?.attackerGimmick ?? 'NONE';
    const defenderGimmick = options?.defenderGimmick ?? 'NONE';

    const attackStat = move.damage_class === 'special'
      ? attacker.calculatedStats.spAtk
      : attacker.calculatedStats.attack;
    const defenseStat = move.damage_class === 'special'
      ? defender.calculatedStats.spDef
      : defender.calculatedStats.defense;
    const basePower = move.power ?? 0;
    const levelScale = ((2 * attacker.level) / 5) + 2;

    const defenderTypes = defenderGimmick === 'TERA'
      ? [{ type: { name: defender.teraType || defender.types[0]?.type.name || 'normal' } }]
      : defender.types;

    let multiplier = 1;
    defenderTypes.forEach((slot) => {
      const typeMultiplier = TYPE_CHART[move.type]?.[slot.type.name];
      if (typeMultiplier !== undefined) multiplier *= typeMultiplier;
    });

    const attackerBaseStab = attacker.types.some((slot) => slot.type.name === move.type) ? 1.25 : 1;
    const attackerTeraType = attacker.teraType || attacker.types[0]?.type.name || 'normal';
    const attackerTeraStab = move.type === attackerTeraType ? 1.5 : 1;
    const stab = attackerGimmick === 'TERA'
      ? Math.max(attackerBaseStab, attackerTeraStab)
      : attackerBaseStab;

    const accuracy = (move.accuracy ?? 100) / 100;
    const attackBoost = attackerGimmick === 'MEGA'
      ? 1.26
      : attackerGimmick === 'DYNAMAX'
        ? 1.2
        : attackerGimmick === 'ZMOVE'
          ? 1.55
        : 1;
    const raw = (((levelScale * basePower * Math.max(1, attackStat) * attackBoost) / Math.max(1, defenseStat)) / 50) + 2;
    return Math.max(1, Math.floor(raw * multiplier * stab * accuracy));
  }, []);

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

  const estimateEnemyMoveScore = useCallback((
    move: Move,
    attacker: GamePokemon,
    defender: GamePokemon,
    preferredStyle: FactoryStyleId,
  ) => {
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

    score += getFactoryStyleAffinityBonus(move, preferredStyle);

    return score;
  }, [getMoveTypeMultiplier]);

  const evaluateEnemyMoves = useCallback((
    actingEnemy: GamePokemon,
    defender: GamePokemon,
    preferredStyle: FactoryStyleId,
    gimmickMode: BattleSpecialMode | 'NONE',
  ): AiMoveEval[] => {
    return actingEnemy.selectedMoves.map((move) => {
      const baseScore = estimateEnemyMoveScore(move, actingEnemy, defender, preferredStyle);
      const expectedDamage = estimateDeterministicDamage(move, actingEnemy, defender, gimmickMode);
      const wouldKo = expectedDamage >= defender.currentHp;
      let score = baseScore;
      if (wouldKo) score += 80;
      if ((getAiFlagsForTier(enemyAiTier) & AI_FLAG_TRY_TO_FAINT) !== 0) score += expectedDamage * 0.25;
      return { move, score, expectedDamage, wouldKo };
    });
  }, [enemyAiTier, estimateDeterministicDamage, estimateEnemyMoveScore, getAiFlagsForTier]);

  const getEnemyUsableGimmick = useCallback((
    actingEnemy: GamePokemon,
  ): BattleSpecialMode | null => {
    const mode = actingEnemy.factoryPlannedSpecialMode;
    if (!mode) return null;
    if (actingEnemy.specialBoostActive) return null;
    if (enemySpecialUsage[mode]) return null;
    if (mode === 'MEGA') {
      const held = actingEnemy.factoryHeldItemId?.toLowerCase() ?? '';
      if (!(held.includes('ite') || held === 'red_orb' || held === 'blue_orb')) return null;
    }
    if (mode === 'ZMOVE' && !hasMatchingZCrystal(actingEnemy)) return null;
    if (mode === 'TERA' && !actingEnemy.teraType) return null;
    return mode;
  }, [enemySpecialUsage, hasMatchingZCrystal]);

  const getProjectedHpAfterGimmick = useCallback((
    pokemon: GamePokemon,
    gimmick: BattleSpecialMode,
    withGimmick: boolean,
  ) => {
    if (!withGimmick) return pokemon.currentHp;
    if (gimmick === 'ZMOVE') return pokemon.currentHp;

    if (gimmick === 'DYNAMAX') {
      const boostedMaxHp = Math.max(1, Math.floor(pokemon.maxHp * 1.35));
      const healedHp = pokemon.currentHp + Math.floor(boostedMaxHp * 0.2);
      return Math.max(1, Math.min(boostedMaxHp, healedHp));
    }

    const boostedMaxHp = Math.max(1, Math.floor(pokemon.maxHp * 1.12));
    const healedHp = pokemon.currentHp + Math.floor(boostedMaxHp * 0.2);
    return Math.max(1, Math.min(boostedMaxHp, healedHp));
  }, []);

  const buildGimmickAltCalcs = useCallback((
    actingEnemy: GamePokemon,
    defender: GamePokemon,
    gimmick: BattleSpecialMode,
  ): GimmickAltCalcs => {
    const dealtWithout = actingEnemy.selectedMoves.map((move) => estimateDeterministicDamageWithContext(move, actingEnemy, defender, {
      attackerGimmick: 'NONE',
      defenderGimmick: 'NONE',
    }));
    const dealtWith = actingEnemy.selectedMoves.map((move) => estimateDeterministicDamageWithContext(move, actingEnemy, defender, {
      attackerGimmick: gimmick,
      defenderGimmick: 'NONE',
    }));
    const takenWithout = defender.selectedMoves.map((move) => estimateDeterministicDamageWithContext(move, defender, actingEnemy, {
      attackerGimmick: 'NONE',
      defenderGimmick: 'NONE',
    }));
    const takenWith = defender.selectedMoves.map((move) => estimateDeterministicDamageWithContext(move, defender, actingEnemy, {
      attackerGimmick: 'NONE',
      defenderGimmick: gimmick === 'TERA' ? 'TERA' : 'NONE',
    }));

    return {
      dealtWithout,
      dealtWith,
      takenWithout,
      takenWith,
    };
  }, [estimateDeterministicDamageWithContext]);

  const scoreEnemyGimmickTurn = useCallback((
    actingEnemy: GamePokemon,
    defender: GamePokemon,
    gimmick: BattleSpecialMode,
    calcs: GimmickAltCalcs,
  ): GimmickTurnScore => {
    const aiHpWithout = getProjectedHpAfterGimmick(actingEnemy, gimmick, false);
    const aiHpWith = getProjectedHpAfterGimmick(actingEnemy, gimmick, true);
    const oppHp = defender.currentHp;
    const hpRatio = actingEnemy.currentHp / Math.max(1, actingEnemy.maxHp);

    const maxDealtWithout = Math.max(0, ...calcs.dealtWithout);
    const maxDealtWith = Math.max(0, ...calcs.dealtWith);
    const maxTakenWithout = Math.max(0, ...calcs.takenWithout);
    const maxTakenWith = Math.max(0, ...calcs.takenWith);
    const minTakenWithout = Math.min(...calcs.takenWithout.filter((value) => value > 0), maxTakenWithout || 0);
    const minTakenWith = Math.min(...calcs.takenWith.filter((value) => value > 0), maxTakenWith || 0);

    const hasKoWithout = maxDealtWithout >= oppHp;
    const enablesKo = maxDealtWith >= oppHp && !hasKoWithout;
    const facingLikelyKoWithout = maxTakenWithout >= aiHpWithout;
    const savedFromKo = facingLikelyKoWithout && maxTakenWith < aiHpWith;
    const stillGetsKoedByAnyMove = minTakenWith >= aiHpWith;
    const getsPunishedByCoverage = savedFromKo && stillGetsKoedByAnyMove;
    const improvesDefensiveSpread = maxTakenWith < maxTakenWithout || minTakenWith < minTakenWithout;
    const improvesOffensiveSpread = maxDealtWith > maxDealtWithout * 1.12;

    let score = 0;
    score += Math.max(0, maxDealtWith - maxDealtWithout) * 0.45;
    score += Math.max(0, maxTakenWithout - maxTakenWith) * 0.3;
    if (enablesKo) score += 90;
    if (savedFromKo) score += 85;
    if (getsPunishedByCoverage) score -= 55;
    if (improvesOffensiveSpread) score += 12;
    if (improvesDefensiveSpread) score += 10;
    if (hpRatio <= 0.35 && improvesDefensiveSpread) score += 12;

    if (gimmick === 'DYNAMAX') score += 8;
    if (gimmick === 'MEGA') score += 5;
    if (gimmick === 'ZMOVE' && !enablesKo) score -= 10;

    return {
      score,
      hpRatio,
      enablesKo,
      savedFromKo,
      getsPunishedByCoverage,
      improvesOffensiveSpread,
      improvesDefensiveSpread,
    };
  }, [getProjectedHpAfterGimmick]);

  const decideEnemyGimmickUse = useCallback((
    usableGimmick: BattleSpecialMode | null,
    actingEnemy: GamePokemon,
    defender: GamePokemon,
    aiFlags: number,
  ) => {
    if (!usableGimmick) return false;
    if (usableGimmick === 'TERA' && (aiFlags & AI_FLAG_SMART_TERA) === 0) return true;

    const calcs = buildGimmickAltCalcs(actingEnemy, defender, usableGimmick);
    const turnScore = scoreEnemyGimmickTurn(actingEnemy, defender, usableGimmick, calcs);

    const remainingPlannedUsers = Math.max(
      1,
      enemyTeam.filter((member) =>
        member.currentHp > 0
        && member.factoryPlannedSpecialMode === usableGimmick,
      ).length,
    );
    const conserveChance = Math.min(70, AI_CONSERVE_GIMMICK_CHANCE_PER_MON * Math.max(0, remainingPlannedUsers - 1));
    if (Math.random() * 100 < conserveChance && !turnScore.savedFromKo && !turnScore.enablesKo) {
      return false;
    }

    if (turnScore.getsPunishedByCoverage) {
      return Math.random() * 100 < AI_GIMMICK_PREDICT_CHANCE;
    }

    if (turnScore.savedFromKo || turnScore.enablesKo) return true;
    if (turnScore.hpRatio <= 0.35 && turnScore.improvesDefensiveSpread) return true;

    const thresholdByMode: Record<BattleSpecialMode, number> = {
      MEGA: 16,
      DYNAMAX: 14,
      TERA: 18,
      ZMOVE: 22,
    };
    const hpPressureAdjust = turnScore.hpRatio <= 0.5 ? -4 : 0;
    const threshold = thresholdByMode[usableGimmick] + hpPressureAdjust;

    return turnScore.score >= threshold;
  }, [buildGimmickAltCalcs, enemyTeam, scoreEnemyGimmickTurn]);

  const reconsiderGimmickAfterMove = useCallback((
    useGimmick: boolean,
    gimmick: BattleSpecialMode | null,
    selectedMove: Move,
  ) => {
    if (!useGimmick || !gimmick) return false;
    if (gimmick === 'TERA' && isProtectLikeMove(selectedMove)) return false;
    if (gimmick === 'ZMOVE' && (selectedMove.damage_class === 'status' || isProtectLikeMove(selectedMove))) return false;
    return true;
  }, [isProtectLikeMove]);

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
    ZMOVE: canPlayerUseSpecialByMode('ZMOVE'),
  };
  const canUseBattleSpecial = SPECIAL_MODES.some((mode) => canUseBattleSpecialByMode[mode]);

  const triggerBattleSpecial = useCallback(async (mode: BattleSpecialMode) => {
    if (!canPlayerUseSpecialByMode(mode)) return;
    if (mode === 'MEGA' && !hasMatchingMegaStone(playerTeam[0])) {
      await addMessagesSequentially([t('specialMegaStoneMismatch')]);
      return;
    }
    if (mode === 'ZMOVE' && !hasMatchingZCrystal(playerTeam[0])) {
      await addMessagesSequentially([t('specialZCrystalMismatch')]);
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
    hasMatchingZCrystal,
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
      if (!allowWildCatch) {
        await addMessagesSequentially([t('cannotCatchFactory')]);
        setMainBattleTurn('ENEMY');
        return;
      }

      setIsCatching(true);
      const hpFactor = 1 - (enemy.currentHp / Math.max(1, enemy.maxHp));
      const catchRate = Math.max(0.08, Math.min(0.95, 0.25 + hpFactor * 0.55 + ((item.catchRate ?? 1) - 1) * 0.18));
      const caught = Math.random() < catchRate;
      const newInventory = [...inventory];
      newInventory.splice(index, 1);
      setInventory(newInventory);
      setCatchSuccess(caught);
      setIsCatching(false);

      if (caught) {
        const maybeAdd = [...playerTeam];
        if (maybeAdd.length < 6) {
          maybeAdd.push(enemy);
          setPlayerTeam(maybeAdd);
        } else {
          setShowReplaceUI(enemy);
        }
        setEnemy({ ...enemy, currentHp: 0 });
        setEnemyTeam((prev) => {
          if (prev.length === 0) return prev;
          const next = [...prev];
          next[0] = { ...next[0], currentHp: 0 };
          return next;
        });
        await addMessagesSequentially([`${getLocalized(enemy)} was caught!`]);
        setTimeout(() => void winBattle(), 300);
      } else {
        await addMessagesSequentially([`${getLocalized(enemy)} broke free!`]);
        setMainBattleTurn('ENEMY');
      }
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
    allowWildCatch,
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
    if (updatedActor.specialBoostActive && updatedActor.specialBoostMode === 'ZMOVE') {
      updatedActor = {
        ...updatedActor,
        specialBoostActive: false,
        specialBoostMode: undefined,
      };
    }
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

  const chooseEnemyMove = useCallback((actingEnemy: GamePokemon, defender: GamePokemon) => {
    const aiFlags = getAiFlagsForTier(enemyAiTier);
    const usableGimmick = getEnemyUsableGimmick(actingEnemy);
    let useGimmick = decideEnemyGimmickUse(usableGimmick, actingEnemy, defender, aiFlags);

    const teamStyle = getFactoryTeamStyle(enemyTeam);
    const effectiveStyle = teamStyle === FACTORY_STYLE.NO_SINGULAR ? FACTORY_STYLE.NONE : teamStyle;
    const moveEvals = evaluateEnemyMoves(
      actingEnemy,
      defender,
      effectiveStyle,
      useGimmick && usableGimmick ? usableGimmick : 'NONE',
    ).sort((a, b) => b.score - a.score);

    const pickFromTop = (topN: number) => {
      const pool = moveEvals.slice(0, Math.min(topN, moveEvals.length));
      return pool[Math.floor(Math.random() * pool.length)]?.move ?? actingEnemy.selectedMoves[0];
    };

    let selectedMove: Move;
    if (enemyAiTier === 'RANDOM') {
      selectedMove = actingEnemy.selectedMoves[Math.floor(Math.random() * actingEnemy.selectedMoves.length)];
    } else if (enemyAiTier === 'BASIC') {
      selectedMove = pickFromTop(2);
    } else if (enemyAiTier === 'ADVANCED') {
      selectedMove = pickFromTop(3);
    } else {
      selectedMove = moveEvals[0]?.move ?? actingEnemy.selectedMoves[0];
    }

    useGimmick = reconsiderGimmickAfterMove(useGimmick, usableGimmick, selectedMove);
    return { selectedMove, useGimmick, usableGimmick, aiFlags, moveEvals };
  }, [
    decideEnemyGimmickUse,
    enemyAiTier,
    enemyTeam,
    evaluateEnemyMoves,
    getAiFlagsForTier,
    getEnemyUsableGimmick,
    reconsiderGimmickAfterMove,
  ]);

  const getBestTypePressure = useCallback((attacker: GamePokemon, defender: GamePokemon) => {
    return attacker.selectedMoves.reduce((best, move) => {
      if (move.damage_class === 'status') return best;
      return Math.max(best, getMoveTypeMultiplier(move, defender));
    }, 0);
  }, [getMoveTypeMultiplier]);

  const chooseEnemySwitchIndex = useCallback((actingEnemy: GamePokemon, defender: GamePokemon, aiFlags: number) => {
    if ((aiFlags & AI_FLAG_SMART_SWITCHING) === 0) return -1;
    const hpRatio = actingEnemy.currentHp / Math.max(1, actingEnemy.maxHp);
    if (hpRatio > 0.35) return -1;
    const currentPressure = getBestTypePressure(actingEnemy, defender);
    const benchCandidates = enemyTeam
      .map((pokemon, index) => ({ pokemon, index }))
      .filter(({ index, pokemon }) => index !== 0 && pokemon.currentHp > 0);
    const ranked = benchCandidates
      .map(({ pokemon, index }) => ({
        index,
        pressure: getBestTypePressure(pokemon, defender),
        hpRatio: pokemon.currentHp / Math.max(1, pokemon.maxHp),
      }))
      .filter((entry) => entry.pressure > currentPressure + 0.6 && entry.hpRatio > 0.4)
      .sort((a, b) => b.pressure - a.pressure);
    if (ranked.length === 0) return -1;
    if ((aiFlags & AI_FLAG_RANDOMIZE_SWITCHIN) !== 0) {
      const topPool = ranked.slice(0, Math.min(2, ranked.length));
      return topPool[Math.floor(Math.random() * topPool.length)]?.index ?? -1;
    }
    return ranked[0].index;
  }, [enemyTeam, getBestTypePressure]);

  const enemyTurn = useCallback(async () => {
    if (!enemy || !playerTeam[0] || turn !== 'ENEMY' || isMessageProcessing) return;

    const actingEnemyLead = enemy;
    let enemyTeamForTurn = enemyTeam;

    const preTurnResult = await resolvePreTurnStatus({
      combatant: actingEnemyLead,
      isEnemy: true,
      currentEnemyTeam: enemyTeamForTurn,
    });
    if (!preTurnResult.canAct) return;

    let actingEnemy = preTurnResult.combatant;
    enemyTeamForTurn = preTurnResult.enemyTeam ?? enemyTeamForTurn;
    const aiFlags = getAiFlagsForTier(enemyAiTier);
    const switchIndex = chooseEnemySwitchIndex(actingEnemy, playerTeam[0], aiFlags);
    if (switchIndex > 0) {
      const switchedTeam = [...enemyTeamForTurn];
      const withdrawn = switchedTeam[0];
      [switchedTeam[0], switchedTeam[switchIndex]] = [switchedTeam[switchIndex], switchedTeam[0]];
      setEnemyTeam(switchedTeam);
      setEnemy(switchedTeam[0]);
      await addMessagesSequentially([
        t('withdrew').replace('{name}', getLocalized(withdrawn)),
        t('enemySentOut').replace('{name}', getLocalized(switchedTeam[0])),
      ]);
      setMainBattleTurn('PLAYER');
      return;
    }

    const decision = chooseEnemyMove(actingEnemy, playerTeam[0]);
    if (decision.useGimmick && decision.usableGimmick) {
      const boostedEnemy = applySpecialBoost(actingEnemy, decision.usableGimmick);
      const nextEnemyTeam = [...enemyTeamForTurn];
      nextEnemyTeam[0] = boostedEnemy;
      setEnemyTeam(nextEnemyTeam);
      setEnemy(boostedEnemy);
      enemyTeamForTurn = nextEnemyTeam;
      actingEnemy = boostedEnemy;
      setEnemySpecialUsage((prev) => ({
        ...prev,
        [decision.usableGimmick]: true,
      }));
      await addMessagesSequentially([
        t('specialActivated').replace('{mode}', getSpecialLabel(decision.usableGimmick)).replace('{name}', getLocalized(boostedEnemy)),
      ]);
    }

    await executeTurn({
      actingSide: 'enemy',
      move: decision.selectedMove,
      actor: actingEnemy,
      actorTeam: preTurnResult.enemyTeam ?? enemyTeamForTurn,
      defender: playerTeam[0],
      defenderTeam: playerTeam,
    });
  }, [
    addMessagesSequentially,
    applySpecialBoost,
    chooseEnemySwitchIndex,
    chooseEnemyMove,
    enemy,
    enemyAiTier,
    enemyTeam,
    executeTurn,
    getAiFlagsForTier,
    getLocalized,
    getSpecialLabel,
    gameState,
    isMessageProcessing,
    playerTeam,
    resolvePreTurnStatus,
    setEnemy,
    setEnemyTeam,
    setEnemySpecialUsage,
    setMainBattleTurn,
    t,
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

  useEffect(() => {
    if (turn !== 'PLAYER' || gameState !== 'BATTLE') return;
    const lead = enemyTeam[0];
    if (!lead || lead.specialBoostMode !== 'DYNAMAX' || !lead.specialBoostActive) return;

    const turnsLeft = (lead.dynamaxTurnsLeft ?? 0) - 1;
    if (turnsLeft > 0) {
      const nextTeam = [...enemyTeam];
      const nextLead = { ...lead, dynamaxTurnsLeft: turnsLeft };
      nextTeam[0] = nextLead;
      setEnemyTeam(nextTeam);
      setEnemy(nextLead);
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
    const nextTeam = [...enemyTeam];
    nextTeam[0] = revertedLead;
    setEnemyTeam(nextTeam);
    setEnemy(revertedLead);
    void addMessagesSequentially([t('specialDynamaxEnd').replace('{name}', getLocalized(revertedLead))]);
  }, [addMessagesSequentially, enemyTeam, gameState, getLocalized, setEnemy, setEnemyTeam, t, turn]);

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

