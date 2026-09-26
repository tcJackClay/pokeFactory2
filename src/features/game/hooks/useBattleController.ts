import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { completeEndTurnResolution } from './presentEndTurnResolution';
import type { BattleMenuTab, FieldState, FieldTurns, GamePokemon, GameState, Item, Move, TailwindTurns, Weather } from '../../../types';
import { getBattleIndexInSet } from '../config/factoryRewards';
import type { PendingFactorySettlement } from '../../../services/saveManager';
import {
  FACTORY_STYLE,
  type FactoryStyleId,
  getFactoryTeamStyle,
} from '../config/factoryBattleStyle';
import {
  calculateConfusionSelfHitDamage as resolveConfusionSelfHitDamage,
  calculateDamage as resolveDamageStep,
  estimateDeterministicDamageWithContext,
  evaluateAiMove,
  getBestTypePressureAgainstTarget,
  getEffectiveBattleSpeed,
  resolveActionSelection,
  resolveTailwindUse,
  resolveBeforeMoveChecks as resolveBeforeMoveChecksStep,
  clearProtectionChain,
  resolveEndTurn,
  resolveMoveStrikePlan,
  getMoveStrikeBasePower,
  resolveProtectionCollision,
  resolveProtectionMoveUse,
  resolveSecondaryEffectsStep,
  resolveTypeImmunityReaction,
  clearSwitchingBattleState,
} from '../battle/engine';
import { isRepeatFieldFailure, nextFieldStates, nextFieldTurns } from '../battle/engine/fieldEffectTransition';
import {
  getItemDamageBasedHealDenominator,
  getItemFlinchChance,
  getItemMentalStatuses,
  getMoveDrainPercent,
  getMoveFieldState,
  getMoveHealingPercent,
  getMoveRecoilPercent,
  getMoveSecondaryEffects,
  getItemBattleData,
  getItemPinchHealDenominator,
  getItemPinchStat,
  getItemPinchTriggerDenominator,
  getItemPpRestoreAmount,
  getItemPriorityProcChance,
  getItemStatusCures,
  getItemSurviveAtOneHpChance,
  getMoveTarget,
  getMoveWeather,
  hasAbilityBattleEffect,
  hasMoveBattleEffect,
  hasItemBattleEffect,
  isMegaStoneLikeItem,
  isZCrystalLikeItem,
  rollMoveHitCount,
} from '../data/battle';
import {
  findNextLivingLeadIndex,
} from '../lib/battleResolution';
import { battleAilmentName, battleHeldItemName, battleItemMessage, battleLine, battleMoveName, battleStatName, isChineseBattleLog } from '../battle/battleLogText';
import { restoreFactoryParty } from '../utils/restoreFactoryParty';
import {
  clearNonVolatileStatus,
  clearVolatileStatus,
  clearVolatileStatuses,
  getNonVolatileStatusId,
  getVolatileStatus,
  hasVolatileStatus,
  normalizeBattleStatusId,
  setNonVolatileStatus,
  setVolatileStatus,
} from '../utils/battleStatus';
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
  weatherTurns: number;
  fieldState: FieldState[];
  fieldTurns: FieldTurns;
  tailwindTurns: TailwindTurns;
  stage: number;
  streak: number;
  enemyAiTier: FactoryAiTier;
  specialModeUnlocked: boolean;
  specialBossBattleActive: boolean;
  isFrontierBrain: boolean;
  battleSpecialUsage: BattleSpecialUsageState;
  enemySpecialUsage: BattleSpecialUsageState;
  allowWildCatch: boolean;
  suppressFactoryBattleResult: boolean;
  onSuppressBattleResolved: (result: 'WIN' | 'LOSS') => void;
  factoryRunId: string | null;
  pendingSettlement: PendingFactorySettlement | null;
  settleFactoryBattle: (runId: string, stage: number, result: 'WIN' | 'LOSS', isFrontierBrain: boolean, finalTeams: { playerTeam: GamePokemon[]; enemyTeam: GamePokemon[] }) => {
    awarded: boolean;
    amount: number;
  };
  t: TranslateFn;
  currentLanguage: string;
  getLocalized: LocalizeFn;
  setInventory: Dispatch<SetStateAction<Item[]>>;
  setPlayerTeam: Dispatch<SetStateAction<GamePokemon[]>>;
  setEnemy: Dispatch<SetStateAction<GamePokemon | null>>;
  setEnemyTeam: Dispatch<SetStateAction<GamePokemon[]>>;
  setActiveBuffs: Dispatch<SetStateAction<{ atk: boolean; def: boolean }>>;
  setEnemyBuffs: Dispatch<SetStateAction<{ atk: boolean; def: boolean }>>;
  setWeather: Dispatch<SetStateAction<Weather>>;
  setWeatherTurns: Dispatch<SetStateAction<number>>;
  setFieldState: Dispatch<SetStateAction<FieldState[]>>;
  setFieldTurns: Dispatch<SetStateAction<FieldTurns>>;
  setTailwindTurns: Dispatch<SetStateAction<TailwindTurns>>;
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
const DEFAULT_WEATHER_TURNS = 5;
const UPROAR_TURNS_GEN5_PLUS = 3;
const SLEEP_TALK_BANNED_MOVE_NAMES = new Set([
  'razor-wind',
  'fly',
  'solar-beam',
  'dig',
  'mimic',
  'bide',
  'skull-bash',
  'sky-attack',
  'struggle',
  'sleep-talk',
  'uproar',
  'focus-punch',
  'nature-power',
  'assist',
  'dive',
  'bounce',
  'me-first',
  'copycat',
  'chatter',
  'shadow-force',
  'sky-drop',
  'freeze-shock',
  'ice-burn',
  'belch',
  'phantom-force',
  'geomancy',
  'celebrate',
  'hold-hands',
  'solar-blade',
  'beak-blast',
  'shell-trap',
  'dynamax-cannon',
  'meteor-beam',
  'blazing-torque',
  'wicked-torque',
  'noxious-torque',
  'combat-torque',
  'magical-torque',
  'electro-shot',
]);

const HELD_ITEM_LABELS: Record<string, string> = {
  bright_powder: 'Bright Powder',
  kings_rock: "King's Rock",
  leftovers: 'Leftovers',
  quick_claw: 'Quick Claw',
  scope_lens: 'Scope Lens',
  shell_bell: 'Shell Bell',
  sitrus_berry: 'Sitrus Berry',
  lum_berry: 'Lum Berry',
  cheri_berry: 'Cheri Berry',
  chesto_berry: 'Chesto Berry',
  pecha_berry: 'Pecha Berry',
  rawst_berry: 'Rawst Berry',
  persim_berry: 'Persim Berry',
  liechi_berry: 'Liechi Berry',
  petaya_berry: 'Petaya Berry',
  salac_berry: 'Salac Berry',
  lax_incense: 'Lax Incense',
  charcoal: 'Charcoal',
  mystic_water: 'Mystic Water',
  magnet: 'Magnet',
  black_belt: 'Black Belt',
  poison_barb: 'Poison Barb',
  never_melt_ice: 'Never-Melt Ice',
  twisted_spoon: 'Twisted Spoon',
  hard_stone: 'Hard Stone',
  sharp_beak: 'Sharp Beak',
  silver_powder: 'Silver Powder',
  metal_coat: 'Metal Coat',
  miracle_seed: 'Miracle Seed',
  soft_sand: 'Soft Sand',
  black_glasses: 'BlackGlasses',
  silk_scarf: 'Silk Scarf',
  choice_band: 'Choice Band',
  focus_band: 'Focus Band',
  white_herb: 'White Herb',
  mental_herb: 'Mental Herb',
  thick_club: 'Thick Club',
  leek: 'Leek',
  deep_sea_scale: 'Deep Sea Scale',
  leppa_berry: 'Leppa Berry',
};


interface AiMoveEval {
  move: Move;
  score: number;
  expectedDamage: number;
  wouldKo: boolean;
}

interface EnemyActionDecision {
  selectedMove: Move;
  useGimmick: boolean;
  usableGimmick: BattleSpecialMode | null;
  aiFlags: number;
  moveEvals: AiMoveEval[];
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
  weatherTurns,
  fieldState,
  fieldTurns,
  tailwindTurns,
  stage,
  streak,
  enemyAiTier,
  specialModeUnlocked,
  specialBossBattleActive,
  isFrontierBrain,
  battleSpecialUsage,
  enemySpecialUsage,
  allowWildCatch,
  suppressFactoryBattleResult,
  onSuppressBattleResolved,
  factoryRunId,
  pendingSettlement,
  settleFactoryBattle,
  t,
  currentLanguage,
  getLocalized,
  setInventory,
  setPlayerTeam,
  setEnemy,
  setEnemyTeam,
  setActiveBuffs,
  setEnemyBuffs,
  setWeather,
  setWeatherTurns,
  setFieldState,
  setFieldTurns,
  setTailwindTurns,
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
  const [settlementError, setSettlementError] = useState(Boolean(pendingSettlement));
  const pendingSettlementRef = useRef<PendingFactorySettlement | null>(pendingSettlement);
  const previousTurnRef = useRef<BattleTurn | null>(null);
  const roundEndInFlightRef = useRef<number | null>(null);
  const battleInstanceRef = useRef({ gameState, factoryRunId, stage, epoch: 0 });
  if (
    battleInstanceRef.current.gameState !== gameState
    || battleInstanceRef.current.factoryRunId !== factoryRunId
    || battleInstanceRef.current.stage !== stage
  ) {
    battleInstanceRef.current = { gameState, factoryRunId, stage, epoch: battleInstanceRef.current.epoch + 1 };
  }
  const battleMountedRef = useRef(true);
  useEffect(() => {
    battleMountedRef.current = true;
    return () => {
      battleMountedRef.current = false;
      battleInstanceRef.current.epoch += 1;
    };
  }, []);
  const pendingPlayerSwitchRef = useRef(false);
  const pendingForcedPlayerTurnRef = useRef<BattleTurn | null>(null);
  const liveBattleStateRef = useRef({
    gameState,
    turn,
    playerTeam,
    enemyTeam,
    enemy,
  });
  liveBattleStateRef.current = {
    gameState,
    turn,
    playerTeam,
    enemyTeam,
    enemy,
  };

  const normalizeHeldItemId = useCallback((itemId?: string) => {
    return (itemId ?? '').toLowerCase().replace(/-/g, '_');
  }, []);

  const getHeldItemLabel = useCallback((itemId?: string) => {
    const normalized = normalizeHeldItemId(itemId);
    const english = !normalized ? 'Held Item' : (HELD_ITEM_LABELS[normalized]
      ?? normalized
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' '));
    return battleHeldItemName(normalized, english, currentLanguage);
  }, [currentLanguage, normalizeHeldItemId]);

  const getStatusLabel = useCallback((status?: string) => {
    const normalized = normalizeBattleStatusId(status);
    return battleAilmentName(normalized || 'status', currentLanguage);
  }, [currentLanguage]);

  const isGhostType = useCallback((pokemon: GamePokemon | null | undefined) => {
    return Boolean(pokemon?.types.some((typeSlot) => typeSlot.type.name === 'ghost'));
  }, []);

  const hasPrimaryAbilityEffect = useCallback((pokemon: GamePokemon | null | undefined, effectId: string) => {
    return hasAbilityBattleEffect(pokemon?.abilities?.[0]?.ability?.name, effectId);
  }, []);

  const isSleepPreventingFieldActive = useCallback(() => {
    return fieldState.includes('electric_terrain') || fieldState.includes('misty_terrain');
  }, [fieldState]);

  const isMoveUsableWhileAsleep = useCallback((move?: Move | null) => {
    if (!move) return false;
    return hasMoveBattleEffect(move, 'SNORE') || hasMoveBattleEffect(move, 'SLEEP_TALK');
  }, []);

  const isSleepTalkBannedMove = useCallback((move?: Move | null) => {
    if (!move) return true;
    return SLEEP_TALK_BANNED_MOVE_NAMES.has(move.name);
  }, []);

  const getForcedLockedMove = useCallback((pokemon: GamePokemon | null | undefined) => {
    if (!pokemon || !hasVolatileStatus(pokemon, 'uproar')) return null;
    return pokemon.selectedMoves.find((candidate) => candidate.name === 'uproar') ?? null;
  }, []);

  const chooseSleepTalkMove = useCallback((pokemon: GamePokemon | null | undefined) => {
    if (!pokemon) return null;
    if (!hasPrimaryAbilityEffect(pokemon, 'COMATOSE') && getNonVolatileStatusId(pokemon) !== 'sleep') {
      return null;
    }

    const eligibleMoves = pokemon.selectedMoves.filter((candidate) => !isSleepTalkBannedMove(candidate));
    if (eligibleMoves.length === 0) return null;

    return eligibleMoves[Math.floor(Math.random() * eligibleMoves.length)] ?? null;
  }, [getNonVolatileStatusId, isSleepTalkBannedMove]);

  const hasHeldItem = useCallback((pokemon: GamePokemon | null | undefined, expectedId: string) => {
    if (!pokemon) return false;
    return getItemBattleData(pokemon.factoryHeldItemId)?.id === expectedId;
  }, []);

  const hasHeldItemEffect = useCallback((pokemon: GamePokemon | null | undefined, effectId: string) => {
    return hasItemBattleEffect(pokemon?.factoryHeldItemId, effectId);
  }, []);

  const consumeHeldItem = useCallback((pokemon: GamePokemon, consumedItemId: string) => {
    if (normalizeHeldItemId(pokemon.factoryHeldItemId) !== consumedItemId) return pokemon;
    return { ...pokemon, factoryHeldItemId: undefined };
  }, [normalizeHeldItemId]);

  const tryConsumeStatusCureBerry = useCallback((pokemon: GamePokemon | null | undefined) => {
    if (!pokemon) return { pokemon, message: null as string | null };
    const nonVolatileStatusId = getNonVolatileStatusId(pokemon);
    const confused = hasVolatileStatus(pokemon, 'confusion');
    if (!nonVolatileStatusId && !confused) return { pokemon, message: null as string | null };

    const heldId = normalizeHeldItemId(pokemon.factoryHeldItemId);
    const curedByItem = getItemStatusCures(heldId);
    if (curedByItem.length === 0) return { pokemon, message: null as string | null };

    let shouldCure = false;
    const curedStatuses: string[] = [];

    shouldCure = (
      curedByItem.includes('any-status') && Boolean(nonVolatileStatusId || confused)
    ) || (
      Boolean(nonVolatileStatusId) && curedByItem.includes(nonVolatileStatusId)
    ) || (
      confused && curedByItem.includes('confusion')
    );

    if (!shouldCure) return { pokemon, message: null as string | null };

    let nextPokemon = consumeHeldItem(pokemon, heldId);
    if (curedByItem.includes('any-status')) {
      if (nonVolatileStatusId) {
        nextPokemon = clearNonVolatileStatus(nextPokemon);
        if (nonVolatileStatusId === 'sleep') {
          nextPokemon = clearVolatileStatus(nextPokemon, 'nightmare');
        }
        curedStatuses.push(getStatusLabel(nonVolatileStatusId));
      }
      if (confused) {
        nextPokemon = clearVolatileStatus(nextPokemon, 'confusion');
        curedStatuses.push(getStatusLabel('confusion'));
      }
    } else if (confused && curedByItem.includes('confusion')) {
      nextPokemon = clearVolatileStatus(nextPokemon, 'confusion');
      curedStatuses.push(getStatusLabel('confusion'));
    } else if (nonVolatileStatusId) {
      nextPokemon = clearNonVolatileStatus(nextPokemon);
      if (nonVolatileStatusId === 'sleep') {
        nextPokemon = clearVolatileStatus(nextPokemon, 'nightmare');
      }
      curedStatuses.push(getStatusLabel(nonVolatileStatusId));
    }

    const curedStatus = curedStatuses.join(isChineseBattleLog(currentLanguage) ? '和' : ' and ');
    return {
      pokemon: nextPokemon,
      message: battleItemMessage(currentLanguage, 'cure', getLocalized(nextPokemon), getHeldItemLabel(heldId), curedStatus),
    };
  }, [consumeHeldItem, currentLanguage, getHeldItemLabel, getLocalized, getStatusLabel, normalizeHeldItemId]);

  const tryActivateSitrusBerry = useCallback((pokemon: GamePokemon | null | undefined) => {
    if (!pokemon) return { pokemon, message: null as string | null };
    const heldId = normalizeHeldItemId(pokemon.factoryHeldItemId);
    const triggerDenominator = getItemPinchTriggerDenominator(heldId);
    const healDenominator = getItemPinchHealDenominator(heldId);
    if (!hasHeldItemEffect(pokemon, 'SITRUS_BERRY') || !triggerDenominator || !healDenominator) {
      return { pokemon, message: null as string | null };
    }
    if (pokemon.currentHp <= 0) return { pokemon, message: null as string | null };
    const triggerThreshold = Math.floor(pokemon.maxHp / triggerDenominator);
    if (pokemon.currentHp > triggerThreshold) return { pokemon, message: null as string | null };

    const maxRecover = Math.floor(pokemon.maxHp / healDenominator);
    const recover = Math.max(1, Math.min(maxRecover, pokemon.maxHp - pokemon.currentHp));
    if (recover <= 0) return { pokemon, message: null as string | null };

    const consumed = consumeHeldItem(pokemon, heldId);
    const nextPokemon = { ...consumed, currentHp: Math.min(consumed.maxHp, consumed.currentHp + recover) };
    return {
      pokemon: nextPokemon,
      message: battleItemMessage(currentLanguage, 'heal', getLocalized(nextPokemon), getHeldItemLabel(heldId)),
    };
  }, [consumeHeldItem, currentLanguage, getHeldItemLabel, getLocalized, hasHeldItemEffect, normalizeHeldItemId]);

  const tryActivatePinchStatBerry = useCallback((pokemon: GamePokemon | null | undefined) => {
    if (!pokemon) return { pokemon, message: null as string | null };
    if (pokemon.currentHp <= 0) return { pokemon, message: null as string | null };

    const heldId = normalizeHeldItemId(pokemon.factoryHeldItemId);
    const targetStat = getItemPinchStat(heldId);
    const triggerDenominator = getItemPinchTriggerDenominator(heldId);
    if (!targetStat || !triggerDenominator) return { pokemon, message: null as string | null };

    const triggerThreshold = Math.floor(pokemon.maxHp / triggerDenominator);
    if (pokemon.currentHp > triggerThreshold) return { pokemon, message: null as string | null };

    const currentStage = pokemon.statStages[targetStat];
    const nextStage = Math.min(6, currentStage + 1);
    if (nextStage <= currentStage) return { pokemon, message: null as string | null };

    const consumed = consumeHeldItem(pokemon, heldId);
    const nextPokemon = {
      ...consumed,
      statStages: {
        ...consumed.statStages,
        [targetStat]: nextStage,
      },
    };
    return {
      pokemon: nextPokemon,
      message: battleItemMessage(currentLanguage, 'stat', getLocalized(nextPokemon), getHeldItemLabel(heldId), battleStatName(targetStat, currentLanguage)),
    };
  }, [consumeHeldItem, currentLanguage, getHeldItemLabel, getLocalized, normalizeHeldItemId]);

  const tryActivateWhiteHerb = useCallback((before: GamePokemon | null | undefined, after: GamePokemon | null | undefined) => {
    if (!before || !after) return { pokemon: after, message: null as string | null };
    if (!hasHeldItem(after, 'white_herb')) return { pokemon: after, message: null as string | null };

    const keys: (keyof GamePokemon['statStages'])[] = ['attack', 'defense', 'spAtk', 'spDef', 'speed', 'accuracy', 'evasion'];
    let shouldRestore = false;
    const restoredStages = { ...after.statStages };
    for (const key of keys) {
      if (after.statStages[key] < before.statStages[key]) {
        restoredStages[key] = before.statStages[key];
        shouldRestore = true;
      }
    }
    if (!shouldRestore) return { pokemon: after, message: null as string | null };

    const consumed = consumeHeldItem(after, 'white_herb');
    const nextPokemon = { ...consumed, statStages: restoredStages };
    return {
      pokemon: nextPokemon,
      message: battleItemMessage(currentLanguage, 'restoreStats', getLocalized(nextPokemon), getHeldItemLabel('white_herb')),
    };
  }, [consumeHeldItem, currentLanguage, getHeldItemLabel, getLocalized, hasHeldItem]);

  const tryConsumeMentalHerb = useCallback((pokemon: GamePokemon | null | undefined) => {
    if (!pokemon) return { pokemon, message: null as string | null };
    const heldId = normalizeHeldItemId(pokemon.factoryHeldItemId);
    const mentalStatuses = getItemMentalStatuses(heldId);
    if (!hasHeldItemEffect(pokemon, 'MENTAL_HERB') || mentalStatuses.length === 0) {
      return { pokemon, message: null as string | null };
    }
    const activeMentalStatuses = [...mentalStatuses].filter((statusId) => hasVolatileStatus(pokemon, statusId));
    if (activeMentalStatuses.length === 0) return { pokemon, message: null as string | null };

    const nextPokemon = clearVolatileStatuses(consumeHeldItem(pokemon, heldId), activeMentalStatuses);
    return {
      pokemon: nextPokemon,
      message: battleItemMessage(currentLanguage, 'mentalCure', getLocalized(nextPokemon), getHeldItemLabel(heldId), getStatusLabel(activeMentalStatuses[0])),
    };
  }, [consumeHeldItem, currentLanguage, getHeldItemLabel, getLocalized, getItemMentalStatuses, getStatusLabel, hasHeldItemEffect, normalizeHeldItemId]);

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

  const getMoveMaxPp = useCallback((move: Move) => move.maxPp ?? move.pp ?? 0, []);
  const getMoveCurrentPp = useCallback((move: Move) => move.currentPp ?? getMoveMaxPp(move), [getMoveMaxPp]);

  const getEncoredMove = useCallback((pokemon: GamePokemon | null | undefined) => {
    const linkedMoveName = getVolatileStatus(pokemon, 'encore')?.linkedMoveName;
    if (!pokemon || !linkedMoveName) return null;
    return pokemon.selectedMoves.find((candidate) => candidate.name === linkedMoveName) ?? null;
  }, []);

  const isMoveBlockedByRestrictions = useCallback((pokemon: GamePokemon | null | undefined, move: Move | null | undefined) => {
    if (!pokemon || !move) return false;

    const encoredMove = getEncoredMove(pokemon);
    if (encoredMove && move.name !== encoredMove.name) return true;

    const disabledMoveName = getVolatileStatus(pokemon, 'disable')?.linkedMoveName;
    if (disabledMoveName && move.name === disabledMoveName) return true;

    if (hasVolatileStatus(pokemon, 'taunt') && move.damage_class === 'status') return true;

    if (hasVolatileStatus(pokemon, 'torment') && pokemon.factoryLastUsedMoveName === move.name) return true;

    return false;
  }, [getEncoredMove]);

  const applyFieldEffect = useCallback((nextField: FieldState) => {
    setFieldState((prev) => nextFieldStates(prev, nextField));
    setFieldTurns((prev) => nextFieldTurns(prev, nextField));
  }, [setFieldState, setFieldTurns]);

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
      await addMessagesSequentially([battleLine(currentLanguage, `${displayName} recovered some HP!`, `${displayName}恢复了一些体力！`)]);
    } else if (hpChange < 0) {
      await addMessagesSequentially([battleLine(currentLanguage, `${displayName} was hurt by recoil!`, `${displayName}受到了反作用力的伤害！`)]);
    }
  }, [addMessagesSequentially, currentLanguage]);

  const calculateConfusionSelfHitDamage = useCallback((pokemon: GamePokemon) => {
    return resolveConfusionSelfHitDamage(pokemon);
  }, []);

  const applyMoveSecondaryEffects = useCallback(async ({
    move,
    actingSide,
    playerTeam: currentPlayerTeam,
    enemyTeam: currentEnemyTeam,
    targetHasActedThisTurn,
    extraFlinchChance,
    allowUserEffects,
    allowTargetEffects,
  }: {
    move: Move;
    actingSide: 'player' | 'enemy';
    playerTeam: GamePokemon[];
    enemyTeam: GamePokemon[];
    targetHasActedThisTurn?: boolean;
    extraFlinchChance?: number;
    allowUserEffects?: boolean;
    allowTargetEffects?: boolean;
  }) => {
    const result = resolveSecondaryEffectsStep({
      move,
      actingSide,
      playerTeam: currentPlayerTeam,
      enemyTeam: currentEnemyTeam,
      fieldState,
      weather,
      getLocalized,
      currentLanguage,
      targetHasActedThisTurn,
      extraFlinchChance,
      allowUserEffects,
      allowTargetEffects,
    });

    const messages = result.events
      .filter((event) => event.type === 'message')
      .map((event) => event.message);
    if (messages.length > 0) {
      await addMessagesSequentially(messages);
    }

    return result;
  }, [addMessagesSequentially, currentLanguage, fieldState, getLocalized, weather]);

  const resolvePreTurnStatus = useCallback(async ({
    combatant,
    isEnemy,
    currentPlayerTeam,
    currentEnemyTeam,
    move,
  }: {
    combatant: GamePokemon;
    isEnemy: boolean;
    currentPlayerTeam?: GamePokemon[];
    currentEnemyTeam?: GamePokemon[];
    move?: Move;
  }) => {
    const displayName = isEnemy
      ? currentLanguage === 'zh-hant'
        ? `對手${getLocalized(combatant)}`
        : currentLanguage.startsWith('zh')
          ? `对手${getLocalized(combatant)}`
          : `Enemy ${getLocalized(combatant)}`
      : getLocalized(combatant);
    const result = resolveBeforeMoveChecksStep({
      snapshot: {
        playerTeam: [...(currentPlayerTeam ?? playerTeam)],
        enemyTeam: [...(currentEnemyTeam ?? enemyTeam)],
        weather,
        weatherTurns,
        fieldState,
        fieldTurns,
        tailwindTurns,
      },
      side: isEnemy ? 'enemy' : 'player',
      combatant,
      move,
      displayName,
      currentLanguage,
      hasAbilityEffect: hasPrimaryAbilityEffect,
      isMoveUsableWhileAsleep,
      getEncoredMove,
      getMoveCurrentPp,
      tryConsumeStatusCureBerry,
      tryConsumeMentalHerb,
      calculateConfusionSelfHitDamage,
    });

    setPlayerTeam(result.snapshot.playerTeam);
    setEnemyTeam(result.snapshot.enemyTeam);
    setEnemy(result.snapshot.enemyTeam[0] ?? null);

    const messages = result.events
      .filter((event) => event.type === 'message')
      .map((event) => event.message);
    if (messages.length > 0) {
      await addMessagesSequentially(messages);
    }
    if (result.nextTurn) {
      setMainBattleTurn(result.nextTurn);
    }

    return {
      canAct: result.canAct,
      combatant: result.combatant,
      playerTeam: result.snapshot.playerTeam,
      enemyTeam: result.snapshot.enemyTeam,
    };
  }, [
    addMessagesSequentially,
    calculateConfusionSelfHitDamage,
    currentLanguage,
    enemyTeam,
    fieldState,
    fieldTurns,
    tailwindTurns,
    getEncoredMove,
    getLocalized,
    getMoveCurrentPp,
    isMoveUsableWhileAsleep,
    playerTeam,
    setEnemy,
    setEnemyTeam,
    setMainBattleTurn,
    setPlayerTeam,
    weather,
    weatherTurns,
    tryConsumeMentalHerb,
    tryConsumeStatusCureBerry,
  ]);

  const resolveBattleResult = useCallback(async (result: 'WIN' | 'LOSS', retryPending?: PendingFactorySettlement | null) => {
    setLoading(true);

    try {
      if (suppressFactoryBattleResult) {
        onSuppressBattleResolved(result);
        return;
      }

      const nextStreak = result === 'WIN' ? streak + 1 : streak;
      const brainOpponent = retryPending?.runId === factoryRunId && retryPending.stage === stage && retryPending.result === result
        ? retryPending.isFrontierBrain
        : isFrontierBrain;
      let creditedTokens: number;
      const restoredPlayerTeam = restoreFactoryParty(liveBattleStateRef.current.playerTeam);
      try {
        if (!factoryRunId) throw new Error('Factory run ID is missing.');
        const settlement = settleFactoryBattle(factoryRunId, stage, result, brainOpponent, {
          playerTeam: restoredPlayerTeam,
          enemyTeam: liveBattleStateRef.current.enemyTeam,
        });
        creditedTokens = settlement.amount;
        pendingSettlementRef.current = null;
        setSettlementError(false);
      } catch (error) {
        console.error('Factory settlement failed', error);
        if (factoryRunId) pendingSettlementRef.current = { runId: factoryRunId, stage, result, isFrontierBrain: brainOpponent };
        setSettlementError(true);
        return;
      }

      liveBattleStateRef.current.playerTeam = restoredPlayerTeam;
      setPlayerTeam(restoredPlayerTeam);

      if (result === 'WIN') {
        setStreak(nextStreak);
      } else {
        setStreak(0);
      }

      setRoundResult(result);
      setLastTokenGain(creditedTokens);
      setGameState('ROUND_RESULT');

      const summary = result === 'WIN'
        ? getBattleIndexInSet(stage) === 7 ? t('battleSettlementWin', {
            streak: nextStreak,
            coins: creditedTokens,
          }) : t('battleResultWin')
        : t('battleSettlementLoss', { coins: creditedTokens });

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
    factoryRunId,
    onSuppressBattleResolved,
    settleFactoryBattle,
    setGameState,
    setLastTokenGain,
    setLoading,
    setSpecialBossBattleActive,
    setSpecialModeUnlocked,
    setRoundResult,
    setPlayerTeam,
    setStreak,
    suppressFactoryBattleResult,
    specialBossBattleActive,
    isFrontierBrain,
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

  const retrySettlement = useCallback(async () => {
    const pending = pendingSettlementRef.current;
    if (pending) await resolveBattleResult(pending.result, pending);
  }, [resolveBattleResult]);

  const sendOutNextEnemy = useCallback(async (
    currentEnemyTeam: GamePokemon[],
    excludedId: number,
    options?: { preservePlayerSwitchMenu?: boolean },
  ) => {
    const nextEnemyIdx = findNextLivingLeadIndex(currentEnemyTeam, { excludeId: excludedId });
    if (nextEnemyIdx === -1) {
      setTimeout(() => void winBattle(), 500);
      return false;
    }

    const nextEnemyTeam = [...currentEnemyTeam];
    [nextEnemyTeam[0], nextEnemyTeam[nextEnemyIdx]] = [nextEnemyTeam[nextEnemyIdx], nextEnemyTeam[0]];
    nextEnemyTeam[0] = clearSwitchingBattleState(nextEnemyTeam[0]);
    setEnemyTeam(nextEnemyTeam);
    setEnemy(nextEnemyTeam[0]);
    await addMessagesSequentially([t('enemySentOut').replace('{name}', getLocalized(nextEnemyTeam[0]))]);
    if (options?.preservePlayerSwitchMenu) setTurn('PLAYER');
    else setMainBattleTurn('PLAYER');
    return true;
  }, [addMessagesSequentially, clearSwitchingBattleState, getLocalized, setEnemy, setEnemyTeam, setMainBattleTurn, setTurn, t, winBattle]);

  const sendOutNextPlayer = useCallback(async (
    currentPlayerTeam: GamePokemon[],
    options?: { nextTurnAfterSwitch?: BattleTurn },
  ) => {
    const aliveIdx = findNextLivingLeadIndex(currentPlayerTeam);
    pendingPlayerSwitchRef.current = false;
    if (aliveIdx === -1) {
      setTimeout(() => void loseBattle(), 500);
      return false;
    }

    pendingForcedPlayerTurnRef.current = options?.nextTurnAfterSwitch ?? 'PLAYER';
    const nextPlayerTeam = [...currentPlayerTeam];
    nextPlayerTeam[0] = clearSwitchingBattleState(nextPlayerTeam[0]);
    setPlayerTeam(nextPlayerTeam);
    setTurn('PLAYER');
    setBattleMenuTab('POKEMON');
    return true;
  }, [clearSwitchingBattleState, loseBattle, setBattleMenuTab, setPlayerTeam, setTurn]);

  const calculateDamage = useCallback((
    move: Move,
    attacker: GamePokemon,
    defender: GamePokemon,
    atkBuff: boolean,
    defBuff: boolean,
    options?: {
      basePowerOverride?: number;
      skipAccuracyCheck?: boolean;
    },
  ) => {
    return resolveDamageStep({
      move,
      attacker,
      defender,
      weather,
      fieldState,
      atkBuff,
      defBuff,
      basePowerOverride: options?.basePowerOverride,
      skipAccuracyCheck: options?.skipAccuracyCheck,
    });
  }, [fieldState, weather]);

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
    if (mode === 'TERA') {
      return {
        ...pokemon,
        specialBoostActive: true,
        specialBoostMode: mode,
        types: [{ type: { name: pokemon.teraType || pokemon.baseTypes?.[0]?.type.name || pokemon.types[0]?.type.name || 'normal' } }],
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

    return {
      ...pokemon,
      calculatedStats,
      maxHp: newMaxHp,
      currentHp: Math.min(newMaxHp, pokemon.currentHp + healAmount),
      specialBoostActive: true,
      specialBoostMode: mode,
      types: pokemon.types,
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
    return (
      hasMoveBattleEffect(move, 'PROTECT')
      || hasMoveBattleEffect(move, 'DETECT')
      || hasMoveBattleEffect(move, 'KINGS_SHIELD')
      || hasMoveBattleEffect(move, 'SPIKY_SHIELD')
    );
  }, []);

  const hasMatchingZCrystal = useCallback((pokemon: GamePokemon) => {
    return isZCrystalLikeItem(pokemon.factoryHeldItemId);
  }, []);

  const evaluateEnemyMoves = useCallback((
    actingEnemy: GamePokemon,
    defender: GamePokemon,
    preferredStyle: FactoryStyleId,
    gimmickMode: BattleSpecialMode | 'NONE',
  ): AiMoveEval[] => {
    return actingEnemy.selectedMoves.map((move) => {
      const evaluation = evaluateAiMove({
        move,
        attacker: actingEnemy,
        defender,
        preferredStyle,
        fieldState,
        attackerGimmick: gimmickMode,
        defenderGimmick: 'NONE',
      });
      const expectedDamage = evaluation.expectedDamage;
      const wouldKo = evaluation.wouldKo;
      let score = evaluation.score;
      if (wouldKo) score += 80;
      if ((getAiFlagsForTier(enemyAiTier) & AI_FLAG_TRY_TO_FAINT) !== 0) score += expectedDamage * 0.25;
      return { move, score, expectedDamage, wouldKo };
    });
  }, [enemyAiTier, evaluateAiMove, fieldState, getAiFlagsForTier]);

  const getEnemyUsableGimmick = useCallback((
    actingEnemy: GamePokemon,
  ): BattleSpecialMode | null => {
    const mode = actingEnemy.factoryPlannedSpecialMode;
    if (!mode) return null;
    if (actingEnemy.specialBoostActive) return null;
    if (enemySpecialUsage[mode]) return null;
    if (mode === 'MEGA') {
      if (!isMegaStoneLikeItem(actingEnemy.factoryHeldItemId)) return null;
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
    if (playerTeam[0].currentHp <= 0) return false;
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
    return isMegaStoneLikeItem(pokemon.factoryHeldItemId);
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
    if (gameState !== 'BATTLE' || turn !== 'PLAYER' || isMessageProcessing || !enemy || playerTeam[0]?.currentHp <= 0) return;

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
        await addMessagesSequentially([battleLine(currentLanguage, `${getLocalized(enemy)} was caught!`, `收服了${getLocalized(enemy)}！`)]);
        setTimeout(() => void winBattle(), 300);
      } else {
        await addMessagesSequentially([battleLine(currentLanguage, `${getLocalized(enemy)} broke free!`, `${getLocalized(enemy)}挣脱了！`)]);
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
    currentLanguage,
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
    const incomingPokemon = newTeam[index];
    if (!currentLead || !incomingPokemon || incomingPokemon.currentHp <= 0) return;
    if (getForcedLockedMove(currentLead)) {
      await addMessagesSequentially([battleLine(currentLanguage, `${getLocalized(currentLead)} cannot switch out during the uproar!`, `${getLocalized(currentLead)}正在大闹，无法替换！`)]);
      return;
    }
    if (currentLead.currentHp > 0 && (hasVolatileStatus(currentLead, 'trapped') || hasVolatileStatus(currentLead, 'ingrain'))) {
      await addMessagesSequentially([battleLine(currentLanguage, `${getLocalized(currentLead)} cannot switch out!`, `${getLocalized(currentLead)}无法替换！`)]);
      return;
    }
    const withdrawnLead = clearSwitchingBattleState(currentLead);

    const currentLeadFainted = currentLead.currentHp <= 0;
    newTeam[0] = clearSwitchingBattleState(newTeam[index]);
    newTeam[index] = withdrawnLead;

    setPlayerTeam(newTeam);
    if (currentLeadFainted) {
      await addMessagesSequentially([t('playerSentOut').replace('{name}', getLocalized(newTeam[0]))]);
      setMainBattleTurn(pendingForcedPlayerTurnRef.current ?? 'PLAYER');
      pendingForcedPlayerTurnRef.current = null;
      return;
    }

    await addMessagesSequentially([
      t('withdrew').replace('{name}', getLocalized(currentLead)),
      t('playerSentOut').replace('{name}', getLocalized(newTeam[0])),
    ]);
    setMainBattleTurn('ENEMY');
  }, [
    addMessagesSequentially,
    clearSwitchingBattleState,
    currentLanguage,
    gameState,
    getForcedLockedMove,
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
    targetHasActedThisTurn = false,
  }: {
    actingSide: 'player' | 'enemy';
    move: Move;
    actor: GamePokemon;
    actorTeam: GamePokemon[];
    defender: GamePokemon;
    defenderTeam: GamePokemon[];
    targetHasActedThisTurn?: boolean;
  }) => {
    const isPlayerActing = actingSide === 'player';
    const defendingSide: 'player' | 'enemy' = isPlayerActing ? 'enemy' : 'player';
    const attackBuffApplied = isPlayerActing ? activeBuffs.atk : enemyBuffs.atk;
    const defenseBuffApplied = isPlayerActing ? enemyBuffs.def : activeBuffs.def;
    const actorLabel = isPlayerActing
      ? getLocalized(actor)
      : battleLine(currentLanguage, `Enemy ${getLocalized(actor)}`, `对手${getLocalized(actor)}`);
    const selectedMove = move;

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
    setActiveMoveType(selectedMove.type);

    await addMessagesSequentially([
      isPlayerActing
        ? t('usedMove').replace('{name}', getLocalized(actor)).replace('{move}', getLocalized(selectedMove))
        : t('enemyUsedMove').replace('{name}', getLocalized(actor)).replace('{move}', getLocalized(selectedMove)),
    ]);

    const actorMoveIndex = actor.selectedMoves.findIndex(
      (candidate) => candidate === selectedMove || (candidate.name === selectedMove.name && candidate.type === selectedMove.type),
    );
    let leppaMessage: string | null = null;
    const isContinuingUproar = hasMoveBattleEffect(selectedMove, 'UPROAR') && hasVolatileStatus(actor, 'uproar');

    if (actorMoveIndex >= 0 && !isContinuingUproar) {
      updatedActor = {
        ...actor,
        selectedMoves: actor.selectedMoves.map((candidate, index) => {
          if (index !== actorMoveIndex) return candidate;
          const maxPp = getMoveMaxPp(candidate);
          const currentPp = getMoveCurrentPp(candidate);
          return {
            ...candidate,
            maxPp,
            currentPp: Math.max(0, currentPp - 1),
          };
        }),
      };
      if (hasHeldItemEffect(updatedActor, 'CHOICE_BAND') && !updatedActor.factoryChoiceLockedMoveName) {
        updatedActor = {
          ...updatedActor,
          factoryChoiceLockedMoveName: selectedMove.name,
        };
      }
      if (hasHeldItemEffect(updatedActor, 'LEPPA_BERRY')) {
        const ppRestoreAmount = getItemPpRestoreAmount(updatedActor.factoryHeldItemId);
        const selectedMove = updatedActor.selectedMoves[actorMoveIndex];
        const maxPp = getMoveMaxPp(selectedMove);
        const currentPp = getMoveCurrentPp(selectedMove);
        if (maxPp > 0 && currentPp <= 0 && ppRestoreAmount > 0) {
          updatedActor = {
            ...updatedActor,
            selectedMoves: updatedActor.selectedMoves.map((candidate, index) => {
              if (index !== actorMoveIndex) return candidate;
              return {
                ...candidate,
                maxPp,
                currentPp: Math.min(maxPp, ppRestoreAmount),
              };
            }),
          };
          updatedActor = consumeHeldItem(updatedActor, 'leppa_berry');
          leppaMessage = battleLine(currentLanguage,
            `${actorLabel}'s ${getHeldItemLabel('leppa_berry')} restored PP!`,
            `${actorLabel}使用${getHeldItemLabel('leppa_berry')}恢复了招式点数！`);
        }
      }
      syncLeadBySide(actingSide, updatedActor);
    }
    if (leppaMessage) {
      await addMessagesSequentially([leppaMessage]);
    }

    let resolvedMove = selectedMove;
    if (hasMoveBattleEffect(selectedMove, 'SLEEP_TALK')) {
      const calledMove = chooseSleepTalkMove(updatedActor);
      if (!calledMove) {
        await addMessagesSequentially([battleLine(currentLanguage, `${actorLabel}'s Sleep Talk failed!`, `${actorLabel}的梦话失败了！`)]);
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

      resolvedMove = calledMove;
      setActiveMoveType(calledMove.type);
      await addMessagesSequentially([battleLine(currentLanguage,
        `${actorLabel}'s Sleep Talk used ${battleMoveName(calledMove, currentLanguage)}!`,
        `${actorLabel}的梦话使出了${battleMoveName(calledMove, currentLanguage)}！`)]);
    }
    if (hasMoveBattleEffect(resolvedMove, 'SNORE') && getNonVolatileStatusId(updatedActor) !== 'sleep') {
      await addMessagesSequentially([battleLine(currentLanguage, `${actorLabel}'s Snore failed!`, `${actorLabel}的打鼾失败了！`)]);
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

    const previousMoveName = updatedActor.factoryLastUsedMoveName;
    updatedActor = {
      ...updatedActor,
      factoryLastUsedMoveName: resolvedMove.name,
      factoryConsecutiveMoveCount: previousMoveName === resolvedMove.name
        ? (updatedActor.factoryConsecutiveMoveCount ?? 0) + 1
        : 1,
    };
    if (!isProtectLikeMove(resolvedMove)) {
      updatedActor = clearProtectionChain(updatedActor);
    }
    syncLeadBySide(actingSide, updatedActor);

    const activeUproarSource = [nextPlayerTeam[0], nextEnemyTeam[0]]
      .find((pokemon) => pokemon && hasVolatileStatus(pokemon, 'uproar'));

    if (isProtectLikeMove(resolvedMove)) {
      const protectionResult = resolveProtectionMoveUse(updatedActor, resolvedMove);
      updatedActor = protectionResult.pokemon;
      syncLeadBySide(actingSide, updatedActor);
      await addMessagesSequentially([
        protectionResult.succeeded
          ? battleLine(currentLanguage, `${actorLabel} protected itself!`, `${actorLabel}保护了自己！`)
          : battleLine(currentLanguage, `${actorLabel}'s protection failed!`, `${actorLabel}的守住失败了！`),
      ]);
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

    if (hasMoveBattleEffect(resolvedMove, 'TAILWIND')) {
      const result = resolveTailwindUse(tailwindTurns, actingSide);
      if (result.succeeded) setTailwindTurns(result.turns);
      await addMessagesSequentially([
        result.succeeded
          ? battleLine(currentLanguage, `${actorLabel}'s team gained a Tailwind!`, `${actorLabel}一方吹起了顺风！`)
          : battleLine(currentLanguage, `${actorLabel}'s Tailwind failed!`, `${actorLabel}的顺风失败了！`),
      ]);
      if (isPlayerActing) setPlayerAnim('idle');
      else setEnemyAnim('idle');
      setActiveMoveType(null);
      setMainBattleTurn(isPlayerActing ? 'ENEMY' : 'PLAYER');
      return;
    }

    if (hasMoveBattleEffect(resolvedMove, 'REST')) {
      const restBlocked = (
        getNonVolatileStatusId(updatedActor) === 'sleep'
        || hasPrimaryAbilityEffect(updatedActor, 'COMATOSE')
        || updatedActor.currentHp >= updatedActor.maxHp
        || hasPrimaryAbilityEffect(updatedActor, 'INSOMNIA')
        || hasPrimaryAbilityEffect(updatedActor, 'VITAL_SPIRIT')
        || hasPrimaryAbilityEffect(updatedActor, 'PURIFYING_SALT')
        || isSleepPreventingFieldActive()
        || Boolean(activeUproarSource && !hasPrimaryAbilityEffect(updatedActor, 'SOUNDPROOF'))
      );

      if (restBlocked) {
        await addMessagesSequentially([battleLine(currentLanguage, `${actorLabel}'s Rest failed!`, `${actorLabel}的睡觉失败了！`)]);
      } else {
        updatedActor = setNonVolatileStatus({
          ...updatedActor,
          currentHp: updatedActor.maxHp,
        }, 'sleep', {
          turnsRemaining: 3,
          sourceMoveName: resolvedMove.name,
        });
        updatedActor = clearVolatileStatus(updatedActor, 'nightmare');
        syncLeadBySide(actingSide, updatedActor);
        await addMessagesSequentially([battleLine(currentLanguage, `${actorLabel} slept and became healthy!`, `${actorLabel}睡着了，并恢复了体力！`)]);
      }

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

    if (hasMoveBattleEffect(resolvedMove, 'SUBSTITUTE')) {
      const substituteAlreadyActive = hasVolatileStatus(updatedActor, 'substitute');
      const substituteHpCost = Math.max(1, Math.floor(updatedActor.maxHp / 4));
      const substituteBlocked = substituteAlreadyActive || updatedActor.currentHp <= substituteHpCost;

      if (substituteBlocked) {
        await addMessagesSequentially([battleLine(currentLanguage, `${actorLabel}'s Substitute failed!`, `${actorLabel}的替身失败了！`)]);
      } else {
        updatedActor = setVolatileStatus({
          ...updatedActor,
          currentHp: updatedActor.currentHp - substituteHpCost,
        }, 'substitute', {
          counter: substituteHpCost,
          sourceMoveName: resolvedMove.name,
        });
        syncLeadBySide(actingSide, updatedActor);
        await addMessagesSequentially([battleLine(currentLanguage, `${actorLabel} put in a substitute!`, `${actorLabel}制造了替身！`)]);
      }

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

    if (hasMoveBattleEffect(resolvedMove, 'CURSE') && isGhostType(updatedActor)) {
      if (hasVolatileStatus(updatedDefender, 'curse')) {
        await addMessagesSequentially([battleLine(currentLanguage, `${actorLabel}'s Curse failed!`, `${actorLabel}的诅咒失败了！`)]);
      } else {
        updatedDefender = setVolatileStatus(updatedDefender, 'curse', {
          sourceMoveName: resolvedMove.name,
          linkedPokemonId: updatedActor.id,
        });
        syncLeadBySide(defendingSide, updatedDefender);

        const curseSelfDamage = Math.max(1, Math.floor(updatedActor.maxHp / 2));
        updatedActor = {
          ...updatedActor,
          currentHp: Math.max(0, updatedActor.currentHp - curseSelfDamage),
        };
        syncLeadBySide(actingSide, updatedActor);
        await addMessagesSequentially([battleLine(currentLanguage,
          `${actorLabel} cut its own HP and laid a curse on ${getLocalized(updatedDefender)}!`,
          `${actorLabel}削减了自己的体力，诅咒了${getLocalized(updatedDefender)}！`)]);
      }

      if (isPlayerActing) {
        setPlayerAnim('idle');
      } else {
        setEnemyAnim('idle');
      }
      setActiveMoveType(null);

      if (updatedActor.currentHp <= 0) {
        await addMessagesSequentially([t('fainted').replace('{name}', getLocalized(updatedActor))]);
        if (isPlayerActing) {
          await sendOutNextPlayer(nextPlayerTeam, { nextTurnAfterSwitch: 'ENEMY' });
        } else {
          await sendOutNextEnemy(nextEnemyTeam, updatedActor.id);
        }
        return;
      }

      setMainBattleTurn(isPlayerActing ? 'ENEMY' : 'PLAYER');
      return;
    }

    const moveFlinchChance = getMoveSecondaryEffects(resolvedMove)
      .filter((effect) => effect.kind === 'flinch')
      .reduce((maxChance, effect) => Math.max(maxChance, effect.chance), 0);
    const kingsRockFlinchChance = (
      resolvedMove.damage_class !== 'status'
      && hasHeldItemEffect(updatedActor, 'KINGS_ROCK')
    )
      ? getItemFlinchChance(updatedActor.factoryHeldItemId)
      : 0;

    const resolvePostHitSecondaryEffects = async ({
      extraFlinchChance,
      allowUserEffects,
      allowTargetEffects,
    }: {
      extraFlinchChance: number;
      allowUserEffects: boolean;
      allowTargetEffects: boolean;
    }) => {
      if (!allowUserEffects && !allowTargetEffects) return;
      const preSecondaryPlayerLead = nextPlayerTeam[0];
      const preSecondaryEnemyLead = nextEnemyTeam[0];
      const secondaryEffects = await applyMoveSecondaryEffects({
        move: resolvedMove,
        actingSide,
        playerTeam: nextPlayerTeam,
        enemyTeam: nextEnemyTeam,
        targetHasActedThisTurn,
        extraFlinchChance,
        allowUserEffects,
        allowTargetEffects,
        currentLanguage,
      });
      nextPlayerTeam = secondaryEffects.playerTeam;
      nextEnemyTeam = secondaryEffects.enemyTeam;
      const itemResolutionMessages: string[] = [];
      const playerWhiteHerbResult = tryActivateWhiteHerb(preSecondaryPlayerLead, nextPlayerTeam[0]);
      if (playerWhiteHerbResult.message && playerWhiteHerbResult.pokemon) {
        nextPlayerTeam = [...nextPlayerTeam];
        nextPlayerTeam[0] = playerWhiteHerbResult.pokemon;
        itemResolutionMessages.push(playerWhiteHerbResult.message);
      }
      const enemyWhiteHerbResult = tryActivateWhiteHerb(preSecondaryEnemyLead, nextEnemyTeam[0]);
      if (enemyWhiteHerbResult.message && enemyWhiteHerbResult.pokemon) {
        nextEnemyTeam = [...nextEnemyTeam];
        nextEnemyTeam[0] = enemyWhiteHerbResult.pokemon;
        itemResolutionMessages.push(enemyWhiteHerbResult.message);
      }
      const playerMentalHerbResult = tryConsumeMentalHerb(nextPlayerTeam[0]);
      if (playerMentalHerbResult.message && playerMentalHerbResult.pokemon) {
        nextPlayerTeam = [...nextPlayerTeam];
        nextPlayerTeam[0] = playerMentalHerbResult.pokemon;
        itemResolutionMessages.push(playerMentalHerbResult.message);
      }
      const enemyMentalHerbResult = tryConsumeMentalHerb(nextEnemyTeam[0]);
      if (enemyMentalHerbResult.message && enemyMentalHerbResult.pokemon) {
        nextEnemyTeam = [...nextEnemyTeam];
        nextEnemyTeam[0] = enemyMentalHerbResult.pokemon;
        itemResolutionMessages.push(enemyMentalHerbResult.message);
      }
      const playerStatusBerryResult = tryConsumeStatusCureBerry(nextPlayerTeam[0]);
      if (playerStatusBerryResult.message && playerStatusBerryResult.pokemon) {
        nextPlayerTeam = [...nextPlayerTeam];
        nextPlayerTeam[0] = playerStatusBerryResult.pokemon;
        itemResolutionMessages.push(playerStatusBerryResult.message);
      }
      const enemyStatusBerryResult = tryConsumeStatusCureBerry(nextEnemyTeam[0]);
      if (enemyStatusBerryResult.message && enemyStatusBerryResult.pokemon) {
        nextEnemyTeam = [...nextEnemyTeam];
        nextEnemyTeam[0] = enemyStatusBerryResult.pokemon;
        itemResolutionMessages.push(enemyStatusBerryResult.message);
      }
      const playerPinchResult = tryActivatePinchStatBerry(nextPlayerTeam[0]);
      if (playerPinchResult.message && playerPinchResult.pokemon) {
        nextPlayerTeam = [...nextPlayerTeam];
        nextPlayerTeam[0] = playerPinchResult.pokemon;
        itemResolutionMessages.push(playerPinchResult.message);
      }
      const enemyPinchResult = tryActivatePinchStatBerry(nextEnemyTeam[0]);
      if (enemyPinchResult.message && enemyPinchResult.pokemon) {
        nextEnemyTeam = [...nextEnemyTeam];
        nextEnemyTeam[0] = enemyPinchResult.pokemon;
        itemResolutionMessages.push(enemyPinchResult.message);
      }
      setPlayerTeam(nextPlayerTeam);
      nextEnemyTeam = syncEnemyLead(nextEnemyTeam[0], nextEnemyTeam);
      updatedDefender = defendingSide === 'player' ? nextPlayerTeam[0] : nextEnemyTeam[0];
      if (itemResolutionMessages.length > 0) {
        await addMessagesSequentially(itemResolutionMessages);
      }
      if (extraFlinchChance > 0 && secondaryEffects.flinched && moveFlinchChance < extraFlinchChance) {
        await addMessagesSequentially([battleLine(currentLanguage, `${actorLabel}'s King's Rock triggered!`, `${actorLabel}的王者之证生效了！`)]);
      }
    };

    const strikePlan = resolvedMove.damage_class === 'status'
      ? { plannedHits: 1, usesIndependentAccuracy: false }
      : resolveMoveStrikePlan({
        move: resolvedMove,
        attacker: updatedActor,
      });
    let hitCount = 0;
    let totalDamage = 0;
    let totalSubstituteDamage = 0;
    let multiplier = 1;
    let anyCrit = false;
    let moveHadNoEffect = false;
    let focusBandTriggered = false;
    let newDefenderHp = updatedDefender.currentHp;

    for (let hitIndex = 0; hitIndex < strikePlan.plannedHits; hitIndex += 1) {
      const hitResult = calculateDamage(
        resolvedMove,
        updatedActor,
        updatedDefender,
        attackBuffApplied,
        defenseBuffApplied,
        {
          basePowerOverride: getMoveStrikeBasePower(resolvedMove, hitIndex),
          skipAccuracyCheck: hitIndex > 0 && !strikePlan.usesIndependentAccuracy,
        },
      );
      multiplier = hitResult.multiplier;

      if (hitResult.blockedByProtect) {
        await addMessagesSequentially([battleLine(currentLanguage, `${getLocalized(updatedDefender)} protected itself!`, `${getLocalized(updatedDefender)}保护了自己！`)]);
        if (!hitResult.protectReducedDamage) {
          updatedActor = { ...updatedActor, factoryConsecutiveMoveCount: 0 };
          const protectionCollisionResult = resolveProtectionCollision(updatedActor, updatedDefender, resolvedMove, currentLanguage);
          updatedActor = protectionCollisionResult.attacker;
          syncLeadBySide(actingSide, updatedActor);
          if (protectionCollisionResult.messages.length > 0) {
            await addMessagesSequentially(protectionCollisionResult.messages.map((message) => message.replace(updatedActor.name, actorLabel)));
          }
          if (updatedActor.currentHp <= 0) {
            await addMessagesSequentially([t('fainted').replace('{name}', getLocalized(updatedActor))]);
            if (actingSide === 'player') {
              await sendOutNextPlayer(nextPlayerTeam, { nextTurnAfterSwitch: 'ENEMY' });
            } else {
              await sendOutNextEnemy(nextEnemyTeam, updatedActor.id);
            }
            return;
          }
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
      }

      if (hitResult.blockedBySubstitute && resolvedMove.damage_class === 'status') {
        await addMessagesSequentially([battleLine(currentLanguage, `${getLocalized(updatedDefender)}'s substitute blocked the move!`, `${getLocalized(updatedDefender)}的替身挡住了招式！`)]);
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

      if (hitResult.isMiss) {
        if (hitCount === 0) {
          updatedActor = { ...updatedActor, factoryConsecutiveMoveCount: 0 };
          syncLeadBySide(actingSide, updatedActor);
          await addMessagesSequentially([battleLine(currentLanguage, `${actorLabel}'s attack missed!`, `${actorLabel}的攻击没有命中！`)]);
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
        break;
      }

      if (hitResult.multiplier === 0) {
        updatedActor = { ...updatedActor, factoryConsecutiveMoveCount: 0 };
        syncLeadBySide(actingSide, updatedActor);
        const immunityReaction = resolveTypeImmunityReaction(resolvedMove, updatedDefender, fieldState, updatedActor, currentLanguage);
        updatedDefender = immunityReaction.defender;
        syncLeadBySide(defendingSide, updatedDefender);
        if (immunityReaction.message) {
          await addMessagesSequentially([
            immunityReaction.message.replace(updatedDefender.name, getLocalized(updatedDefender)),
          ]);
        }
        moveHadNoEffect = true;
        break;
      }

      hitCount += 1;
      anyCrit = anyCrit || hitResult.isCrit;

      if ((hitResult.targetHealing ?? 0) > 0) {
        const targetHealing = hitResult.targetHealing ?? 0;
        updatedDefender = {
          ...updatedDefender,
          currentHp: Math.min(updatedDefender.maxHp, updatedDefender.currentHp + targetHealing),
        };
        newDefenderHp = updatedDefender.currentHp;
        syncLeadBySide(defendingSide, updatedDefender);
        await addMessagesSequentially([battleLine(currentLanguage, `${getLocalized(updatedDefender)} regained health!`, `${getLocalized(updatedDefender)}恢复了体力！`)]);
        break;
      }

      if (hitResult.blockedBySubstitute) {
        const substituteState = getVolatileStatus(updatedDefender, 'substitute');
        totalSubstituteDamage += Math.max(0, hitResult.substituteDamage);
        if (substituteState) {
          updatedDefender = hitResult.substituteHpRemaining && hitResult.substituteHpRemaining > 0
            ? setVolatileStatus(updatedDefender, 'substitute', {
              counter: hitResult.substituteHpRemaining,
              turnsRemaining: substituteState.turnsRemaining,
              sourceMoveName: substituteState.sourceMoveName,
              linkedMoveName: substituteState.linkedMoveName,
              linkedPokemonId: substituteState.linkedPokemonId,
            })
            : clearVolatileStatus(updatedDefender, 'substitute');
        }
        syncLeadBySide(defendingSide, updatedDefender);
        await addMessagesSequentially([battleLine(currentLanguage, `${getLocalized(updatedDefender)}'s substitute took the damage!`, `${getLocalized(updatedDefender)}的替身承受了伤害！`)]);
        if (hitResult.substituteBroke) {
          await addMessagesSequentially([battleLine(currentLanguage, `${getLocalized(updatedDefender)}'s substitute broke!`, `${getLocalized(updatedDefender)}的替身消失了！`)]);
        }
        await resolvePostHitSecondaryEffects({
          extraFlinchChance: kingsRockFlinchChance,
          allowUserEffects: hitResult.applyUserSecondaryEffects,
          allowTargetEffects: false,
        });
        continue;
      }

      const defenderHpBeforeHit = updatedDefender.currentHp;
      newDefenderHp = Math.max(0, defenderHpBeforeHit - Math.max(0, hitResult.damage));
      if (
        newDefenderHp <= 0
        && hitResult.damage > 0
        && hasHeldItemEffect(updatedDefender, 'FOCUS_BAND')
        && Math.random() < getItemSurviveAtOneHpChance(updatedDefender.factoryHeldItemId)
      ) {
        newDefenderHp = 1;
        updatedDefender = consumeHeldItem(updatedDefender, 'focus_band');
        focusBandTriggered = true;
      }

      updatedDefender = {
        ...updatedDefender,
        currentHp: newDefenderHp,
        factoryHeldItemId: focusBandTriggered ? undefined : updatedDefender.factoryHeldItemId,
        factoryLastDamageReceived: (updatedDefender.factoryLastDamageReceived ?? 0) + Math.max(0, defenderHpBeforeHit - newDefenderHp),
        factoryLastDamageCategory: newDefenderHp < defenderHpBeforeHit
          ? (resolvedMove.damage_class === 'special' ? 'special' : 'physical')
          : updatedDefender.factoryLastDamageCategory,
        factoryDamagedThisTurn: updatedDefender.factoryDamagedThisTurn || newDefenderHp < defenderHpBeforeHit,
      };
      totalDamage += Math.max(0, hitResult.damage);
      syncLeadBySide(defendingSide, updatedDefender);

      await resolvePostHitSecondaryEffects({
        extraFlinchChance: kingsRockFlinchChance,
        allowUserEffects: hitResult.applyUserSecondaryEffects,
        allowTargetEffects: hitResult.applyTargetSecondaryEffects && updatedDefender.currentHp > 0,
      });

      if (hasMoveBattleEffect(resolvedMove, 'SMELLING_SALTS') && getNonVolatileStatusId(updatedDefender) === 'paralysis') {
        updatedDefender = clearNonVolatileStatus(updatedDefender);
        syncLeadBySide(defendingSide, updatedDefender);
        await addMessagesSequentially([battleLine(currentLanguage, `${getLocalized(updatedDefender)} was cured of paralysis!`, `${getLocalized(updatedDefender)}的麻痹被治好了！`)]);
      }
      if (
        hasMoveBattleEffect(resolvedMove, 'KNOCK_OFF')
        && updatedDefender.factoryHeldItemId
        && updatedDefender.currentHp > 0
        && (
          updatedDefender.abilities?.[0]?.ability?.name !== 'sticky-hold'
          || ['mold-breaker', 'teravolt', 'turboblaze'].includes(updatedActor.abilities?.[0]?.ability?.name ?? '')
        )
      ) {
        const knockedOffItem = updatedDefender.factoryHeldItemId;
        updatedDefender = { ...updatedDefender, factoryHeldItemId: undefined };
        syncLeadBySide(defendingSide, updatedDefender);
        await addMessagesSequentially([battleLine(currentLanguage, `${getLocalized(updatedDefender)} lost ${getHeldItemLabel(knockedOffItem)}!`, `${getLocalized(updatedDefender)}失去了${getHeldItemLabel(knockedOffItem)}！`)]);
      }

      if (updatedDefender.currentHp <= 0) {
        break;
      }
    }

    if (anyCrit) {
      await addMessagesSequentially([battleLine(currentLanguage, 'Critical hit!', '击中要害！')]);
    }

    if (totalDamage > 0 || totalSubstituteDamage > 0) {
      if (isPlayerActing) {
        setEnemyAnim('hit');
      } else {
        setPlayerAnim('hit');
      }
    }

    if (focusBandTriggered) {
      await addMessagesSequentially([battleLine(currentLanguage, `${getLocalized(updatedDefender)} hung on with ${getHeldItemLabel('focus_band')}!`, `${getLocalized(updatedDefender)}靠${getHeldItemLabel('focus_band')}挺住了！`)]);
    }
    if (totalDamage > 0) {
      const defenderSitrusResult = tryActivateSitrusBerry(updatedDefender);
      if (defenderSitrusResult.message) {
        updatedDefender = defenderSitrusResult.pokemon;
        syncLeadBySide(defendingSide, updatedDefender);
        await addMessagesSequentially([defenderSitrusResult.message]);
      }
      const defenderPinchResult = tryActivatePinchStatBerry(updatedDefender);
      if (defenderPinchResult.message) {
        updatedDefender = defenderPinchResult.pokemon;
        syncLeadBySide(defendingSide, updatedDefender);
        await addMessagesSequentially([defenderPinchResult.message]);
      }
    }

    let actorHpChange = 0;
    const moveDrainPercent = getMoveDrainPercent(resolvedMove);
    const moveRecoilPercent = getMoveRecoilPercent(resolvedMove, updatedActor);
    const weatherSuppressedForHealing = hasPrimaryAbilityEffect(updatedActor, 'WEATHER_SUPPRESSION')
      || hasPrimaryAbilityEffect(updatedDefender, 'WEATHER_SUPPRESSION');
    const moveHealingPercent = getMoveHealingPercent(resolvedMove, weatherSuppressedForHealing ? 'none' : weather);
    if (moveDrainPercent !== 0 && totalDamage > 0) actorHpChange += Math.floor(totalDamage * moveDrainPercent / 100);
    if (moveRecoilPercent !== 0 && totalDamage > 0) actorHpChange -= Math.max(1, Math.floor(totalDamage * moveRecoilPercent / 100));
    if (moveHealingPercent !== 0) actorHpChange += Math.floor(updatedActor.maxHp * moveHealingPercent / 100);
    if (hasMoveBattleEffect(resolvedMove, 'SWALLOW')) {
      const stockpileCount = Math.max(0, Math.min(3, updatedActor.factoryStockpileCount ?? 0));
      const healRatio = stockpileCount === 1 ? 0.25 : stockpileCount === 2 ? 0.5 : stockpileCount >= 3 ? 1 : 0;
      actorHpChange += Math.floor(updatedActor.maxHp * healRatio);
    }
    const shellBellHealDenominator = getItemDamageBasedHealDenominator(updatedActor.factoryHeldItemId);
    const shellBellRecover = (
      totalDamage > 0
      && resolvedMove.damage_class !== 'status'
      && hasHeldItemEffect(updatedActor, 'SHELL_BELL')
      && shellBellHealDenominator
    )
      ? Math.max(1, Math.floor(totalDamage / shellBellHealDenominator))
      : 0;
    actorHpChange += shellBellRecover;

    updatedActor = {
      ...updatedActor,
      currentHp: Math.max(0, Math.min(updatedActor.maxHp, updatedActor.currentHp + actorHpChange)),
      factoryStockpileCount: hasMoveBattleEffect(resolvedMove, 'SPIT_UP') || hasMoveBattleEffect(resolvedMove, 'SWALLOW')
        ? 0
        : updatedActor.factoryStockpileCount,
    };
    const attackerAbilityName = (updatedActor.abilities?.[0]?.ability?.name ?? '').trim().toLowerCase().replace(/_/g, '-');
    const defenderAbilityName = (updatedDefender.abilities?.[0]?.ability?.name ?? '').trim().toLowerCase().replace(/_/g, '-');
    const selfDestructBlockedByDamp = attackerAbilityName === 'damp'
      || (defenderAbilityName === 'damp' && !['mold-breaker', 'teravolt', 'turboblaze'].includes(attackerAbilityName));
    if (hasMoveBattleEffect(resolvedMove, 'SELF_DESTRUCT') && !selfDestructBlockedByDamp) {
      updatedActor = {
        ...updatedActor,
        currentHp: 0,
      };
    }
    if (updatedActor.specialBoostActive && updatedActor.specialBoostMode === 'ZMOVE') {
      updatedActor = {
        ...updatedActor,
        specialBoostActive: false,
        specialBoostMode: undefined,
      };
    }
    syncLeadBySide(actingSide, updatedActor);
    await announceHpChange(actorLabel, actorHpChange);
    if (shellBellRecover > 0) {
      await addMessagesSequentially([battleLine(currentLanguage, `${actorLabel} restored HP with ${getHeldItemLabel('shell_bell')}!`, `${actorLabel}靠${getHeldItemLabel('shell_bell')}恢复了体力！`)]);
    }
    const actorSitrusResult = tryActivateSitrusBerry(updatedActor);
    if (actorSitrusResult.message) {
      updatedActor = actorSitrusResult.pokemon;
      syncLeadBySide(actingSide, updatedActor);
      await addMessagesSequentially([actorSitrusResult.message]);
    }
    const actorPinchResult = tryActivatePinchStatBerry(updatedActor);
    if (actorPinchResult.message) {
      updatedActor = actorPinchResult.pokemon;
      syncLeadBySide(actingSide, updatedActor);
      await addMessagesSequentially([actorPinchResult.message]);
    }

    if (updatedActor.currentHp <= 0) {
      await addMessagesSequentially([t('fainted').replace('{name}', getLocalized(updatedActor))]);
      if (actingSide === 'player') {
        await sendOutNextPlayer(nextPlayerTeam, { nextTurnAfterSwitch: 'ENEMY' });
      } else {
        await sendOutNextEnemy(nextEnemyTeam, updatedActor.id);
      }
      setActiveMoveType(null);
      return;
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
    if (moveHadNoEffect || multiplier === 0) {
      effectMessages.push(t('noEffect'));
    } else if (totalDamage > 0 || totalSubstituteDamage > 0) {
      if (multiplier > 1) effectMessages.push(t('superEffective'));
      if (multiplier < 1 && multiplier > 0) effectMessages.push(t('notVeryEffective'));
    }
    if (effectMessages.length > 0) {
      await addMessagesSequentially(effectMessages);
    }
    if (totalDamage > 0) {
      await addMessagesSequentially([
        (isPlayerActing ? t('causedDamage') : t('enemyCausedDamage'))
          .replace('{name}', getLocalized(actor))
          .replace('{damage}', totalDamage.toString()),
      ]);
    }
    if ((totalDamage > 0 || totalSubstituteDamage > 0) && hitCount > 1) {
      await addMessagesSequentially([battleLine(currentLanguage, `${actorLabel}'s attack hit ${hitCount} times!`, `${actorLabel}的攻击命中了${hitCount}次！`)]);
    }

    if (hasMoveBattleEffect(resolvedMove, 'UPROAR') && !hasVolatileStatus(updatedActor, 'uproar')) {
      updatedActor = setVolatileStatus(updatedActor, 'uproar', {
        turnsRemaining: UPROAR_TURNS_GEN5_PLUS,
        linkedMoveName: 'uproar',
      });
      syncLeadBySide(actingSide, updatedActor);
      await addMessagesSequentially([battleLine(currentLanguage, `${actorLabel} caused an uproar!`, `${actorLabel}开始大闹！`)]);
    }

    const nextWeather = getMoveWeather(resolvedMove);
    if (nextWeather) {
      setWeather(nextWeather);
      setWeatherTurns(DEFAULT_WEATHER_TURNS);
    }

    const nextField = getMoveFieldState(resolvedMove);
    if (nextField) {
      if (isRepeatFieldFailure(fieldState, nextField)) {
        await addMessagesSequentially([battleLine(currentLanguage, 'But it failed!', '但是失败了！')]);
      } else {
        applyFieldEffect(nextField);
      }
    }

    if (defendingSide === 'player') {
      setPlayerAnim('idle');
    } else {
      setEnemyAnim('idle');
    }

    if (newDefenderHp <= 0) {
      if (defendingSide === 'player') {
        if (isPlayerActing) {
          await addMessagesSequentially([t('fainted').replace('{name}', getLocalized(defender))]);
          await sendOutNextPlayer(nextPlayerTeam);
        } else {
          pendingPlayerSwitchRef.current = true;
          await addMessagesSequentially([t('fainted').replace('{name}', getLocalized(defender))]);
          setTurn('PLAYER');
          setBattleMenuTab('POKEMON');
        }
      } else {
        await addMessagesSequentially([t('fainted').replace('{name}', getLocalized(defender))]);
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
    calculateDamage,
    clearSwitchingBattleState,
    currentLanguage,
    enemyBuffs.atk,
    enemyBuffs.def,
    fieldState,
    getLocalized,
    getHeldItemLabel,
    hasHeldItem,
    getMoveCurrentPp,
    getMoveMaxPp,
    sendOutNextEnemy,
    sendOutNextPlayer,
    setActiveBuffs,
    setActiveMoveType,
    setEnemyAnim,
    applyFieldEffect,
    setMainBattleTurn,
    setPlayerAnim,
    setPlayerTeam,
    setWeather,
    setWeatherTurns,
    setTailwindTurns,
    tailwindTurns,
    syncEnemyLead,
    t,
    isProtectLikeMove,
    getMoveFieldState,
    getMoveWeather,
    tryActivateSitrusBerry,
    tryConsumeStatusCureBerry,
  ]);

  const chooseEnemyMove = useCallback((actingEnemy: GamePokemon, defender: GamePokemon) => {
    const forcedLockedMove = getForcedLockedMove(actingEnemy);
    if (forcedLockedMove) {
      const aiFlags = getAiFlagsForTier(enemyAiTier);
      return {
        selectedMove: forcedLockedMove,
        useGimmick: false,
        usableGimmick: null,
        aiFlags,
        moveEvals: [],
      };
    }

    const usableMoves = actingEnemy.selectedMoves.filter((move) => getMoveCurrentPp(move) > 0);
    const baseCandidateMoves = usableMoves.length > 0 ? usableMoves : actingEnemy.selectedMoves;
    const lockedMoveName = actingEnemy.factoryChoiceLockedMoveName;
    const candidateMoves = (
      hasHeldItemEffect(actingEnemy, 'CHOICE_BAND')
      && lockedMoveName
      && baseCandidateMoves.some((move) => move.name === lockedMoveName)
    )
      ? baseCandidateMoves.filter((move) => move.name === lockedMoveName)
      : baseCandidateMoves;
    const legalCandidateMoves = candidateMoves.filter((move) => !isMoveBlockedByRestrictions(actingEnemy, move));
    const selectableMoves = legalCandidateMoves.length > 0 ? legalCandidateMoves : candidateMoves;
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
    )
      .filter((entry) => selectableMoves.some((move) => move === entry.move || (move.name === entry.move.name && move.type === entry.move.type)))
      .sort((a, b) => b.score - a.score);

    const pickFromTop = (topN: number) => {
      const pool = moveEvals.slice(0, Math.min(topN, moveEvals.length));
      return pool[Math.floor(Math.random() * pool.length)]?.move ?? selectableMoves[0];
    };

    let selectedMove: Move;
    if (enemyAiTier === 'RANDOM') {
      selectedMove = selectableMoves[Math.floor(Math.random() * selectableMoves.length)];
    } else if (enemyAiTier === 'BASIC') {
      selectedMove = pickFromTop(2);
    } else if (enemyAiTier === 'ADVANCED') {
      selectedMove = pickFromTop(3);
    } else {
      selectedMove = moveEvals[0]?.move ?? selectableMoves[0];
    }

    useGimmick = reconsiderGimmickAfterMove(useGimmick, usableGimmick, selectedMove);
    return { selectedMove, useGimmick, usableGimmick, aiFlags, moveEvals };
  }, [
    decideEnemyGimmickUse,
    enemyAiTier,
    enemyTeam,
    evaluateEnemyMoves,
    getForcedLockedMove,
    getAiFlagsForTier,
    getEnemyUsableGimmick,
    getMoveCurrentPp,
    hasHeldItemEffect,
    isMoveBlockedByRestrictions,
    reconsiderGimmickAfterMove,
  ]);

  const getBestTypePressure = useCallback((attacker: GamePokemon, defender: GamePokemon) => {
    return getBestTypePressureAgainstTarget(attacker, defender);
  }, [getBestTypePressureAgainstTarget]);

  const chooseEnemySwitchIndex = useCallback((actingEnemy: GamePokemon, defender: GamePokemon, aiFlags: number) => {
    if (getForcedLockedMove(actingEnemy)) return -1;
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
  }, [enemyTeam, getBestTypePressure, getForcedLockedMove]);

  const shouldQuickClawActivate = useCallback((pokemon: GamePokemon | null | undefined) => {
    return hasHeldItemEffect(pokemon, 'QUICK_CLAW') && Math.random() < getItemPriorityProcChance(pokemon.factoryHeldItemId);
  }, [hasHeldItemEffect]);

  const shouldEnemyActFirst = useCallback((options: {
    playerPokemon: GamePokemon;
    playerMove: Move;
    enemyPokemon: GamePokemon;
    enemyMove: Move;
    playerQuickClawActivated: boolean;
    enemyQuickClawActivated: boolean;
  }) => {
    const {
      playerPokemon,
      playerMove,
      enemyPokemon,
      enemyMove,
      playerQuickClawActivated,
      enemyQuickClawActivated,
    } = options;

    return resolveActionSelection({
      playerPokemon,
      playerMove,
      enemyPokemon,
      enemyMove,
      fieldState,
      tailwindTurns,
      weather,
      playerQuickClawActivated,
      enemyQuickClawActivated,
    }).enemyActsFirst;
  }, [fieldState, tailwindTurns, weather]);

  const runEnemyAutoAction = useCallback(async (options?: {
    defenderLead?: GamePokemon;
    playerTeamForTurn?: GamePokemon[];
    decisionOverride?: EnemyActionDecision;
  }) => {
    const playerLeadForDecision = options?.defenderLead ?? playerTeam[0];
    const playerTeamForTurn = options?.playerTeamForTurn ?? playerTeam;
    if (!enemy || !playerLeadForDecision || isMessageProcessing) return false;

    const actingEnemyLead = enemy;
    let enemyTeamForTurn = enemyTeam;
    const aiFlags = getAiFlagsForTier(enemyAiTier);
    const switchIndex = chooseEnemySwitchIndex(actingEnemyLead, playerLeadForDecision, aiFlags);
    if (switchIndex > 0) {
      const switchedTeam = [...enemyTeamForTurn];
      const withdrawn = switchedTeam[0];
      const clearedWithdrawn = clearSwitchingBattleState(withdrawn);
      switchedTeam[0] = clearedWithdrawn;
      [switchedTeam[0], switchedTeam[switchIndex]] = [switchedTeam[switchIndex], switchedTeam[0]];
      switchedTeam[0] = clearSwitchingBattleState(switchedTeam[0]);
      setEnemyTeam(switchedTeam);
      setEnemy(switchedTeam[0]);
      await addMessagesSequentially([
        t('withdrew').replace('{name}', getLocalized(withdrawn)),
        t('enemySentOut').replace('{name}', getLocalized(switchedTeam[0])),
      ]);
      setMainBattleTurn('PLAYER');
      return true;
    }

    const decision = options?.decisionOverride ?? chooseEnemyMove(actingEnemyLead, playerLeadForDecision);
    const preTurnResult = await resolvePreTurnStatus({
      combatant: actingEnemyLead,
      isEnemy: true,
      currentEnemyTeam: enemyTeamForTurn,
      move: decision.selectedMove,
    });
    if (!preTurnResult.canAct) return true;

    let actingEnemy = preTurnResult.combatant;
    enemyTeamForTurn = preTurnResult.enemyTeam ?? enemyTeamForTurn;
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
      defender: playerLeadForDecision,
      defenderTeam: playerTeamForTurn,
      targetHasActedThisTurn: !options?.defenderLead,
    });
    return true;
  }, [
    addMessagesSequentially,
    applySpecialBoost,
    chooseEnemyMove,
    chooseEnemySwitchIndex,
    clearSwitchingBattleState,
    enemy,
    enemyAiTier,
    enemyTeam,
    executeTurn,
    getAiFlagsForTier,
    getLocalized,
    getSpecialLabel,
    isMessageProcessing,
    playerTeam,
    resolvePreTurnStatus,
    setEnemy,
    setEnemySpecialUsage,
    setEnemyTeam,
    setMainBattleTurn,
    t,
  ]);

  const enemyTurn = useCallback(async () => {
    if (!enemy || !playerTeam[0] || turn !== 'ENEMY' || isMessageProcessing) return;
    await runEnemyAutoAction();
  }, [
    enemy,
    isMessageProcessing,
    playerTeam,
    runEnemyAutoAction,
    turn,
  ]);

  const handleAttack = useCallback(async (move: Move) => {
    if (!enemy || gameState !== 'BATTLE' || turn !== 'PLAYER' || isMessageProcessing) return;

    const forcedLockedMove = getForcedLockedMove(playerTeam[0]);
    if (forcedLockedMove && move.name !== forcedLockedMove.name) {
      await addMessagesSequentially([battleLine(currentLanguage, `${getLocalized(playerTeam[0])} must keep making an uproar!`, `${getLocalized(playerTeam[0])}必须继续大闹！`)]);
      return;
    }
    if (!forcedLockedMove && getMoveCurrentPp(move) <= 0) return;

    const preTurnResult = await resolvePreTurnStatus({
      combatant: playerTeam[0],
      isEnemy: false,
      currentPlayerTeam: playerTeam,
      move,
    });
    if (!preTurnResult.canAct) return;

    const actingPlayerLead = preTurnResult.combatant;
    const actingPlayerTeam = preTurnResult.playerTeam ?? playerTeam;
    const playerLockedMoveName = actingPlayerLead.factoryChoiceLockedMoveName;
    if (
      hasHeldItemEffect(actingPlayerLead, 'CHOICE_BAND')
      && playerLockedMoveName
      && playerLockedMoveName !== move.name
    ) {
      const lockedMove = actingPlayerLead.selectedMoves.find((candidate) => candidate.name === playerLockedMoveName);
      const lockedMoveLabel = battleMoveName(lockedMove, currentLanguage) || playerLockedMoveName;
      await addMessagesSequentially([battleLine(currentLanguage,
        `${getLocalized(actingPlayerLead)} is locked into ${lockedMoveLabel}!`,
        `${getLocalized(actingPlayerLead)}只能使出${lockedMoveLabel}！`)]);
      return;
    }
    const enemyDecision = chooseEnemyMove(enemy, actingPlayerLead);
    const playerQuickClawActivated = shouldQuickClawActivate(actingPlayerLead);
    const enemyQuickClawActivated = shouldQuickClawActivate(enemy);
    const enemyActsFirst = shouldEnemyActFirst({
      playerPokemon: actingPlayerLead,
      playerMove: move,
      enemyPokemon: enemy,
      enemyMove: enemyDecision.selectedMove,
      playerQuickClawActivated,
      enemyQuickClawActivated,
    });

    if (playerQuickClawActivated) {
      await addMessagesSequentially([battleLine(currentLanguage, `${getLocalized(actingPlayerLead)}'s Quick Claw activated!`, `${getLocalized(actingPlayerLead)}的先制之爪生效了！`)]);
    }

    if (enemyQuickClawActivated) {
      await addMessagesSequentially([battleLine(currentLanguage, `Enemy ${getLocalized(enemy)}'s Quick Claw activated!`, `对手${getLocalized(enemy)}的先制之爪生效了！`)]);
    }

    if (enemyActsFirst) {
      await runEnemyAutoAction({
        defenderLead: actingPlayerLead,
        playerTeamForTurn: actingPlayerTeam,
        decisionOverride: enemyDecision,
      });

      const liveState = liveBattleStateRef.current;
      if (liveState.gameState !== 'BATTLE' || liveState.turn !== 'PLAYER') return;
      const latestPlayerLead = liveState.playerTeam[0];
      const latestEnemyLead = liveState.enemy;
      if (!latestPlayerLead || !latestEnemyLead || latestPlayerLead.currentHp <= 0) return;
      if (getMoveCurrentPp(move) <= 0) return;
      const latestLockedMoveName = latestPlayerLead.factoryChoiceLockedMoveName;
      if (
      hasHeldItemEffect(latestPlayerLead, 'CHOICE_BAND')
        && latestLockedMoveName
        && latestLockedMoveName !== move.name
      ) {
        const lockedMove = latestPlayerLead.selectedMoves.find((candidate) => candidate.name === latestLockedMoveName);
        const lockedMoveLabel = battleMoveName(lockedMove, currentLanguage) || latestLockedMoveName;
        await addMessagesSequentially([battleLine(currentLanguage,
          `${getLocalized(latestPlayerLead)} is locked into ${lockedMoveLabel}!`,
          `${getLocalized(latestPlayerLead)}只能使出${lockedMoveLabel}！`)]);
        return;
      }

      const postInterceptionResult = await resolvePreTurnStatus({
        combatant: latestPlayerLead,
        isEnemy: false,
        currentPlayerTeam: liveState.playerTeam,
        move,
      });
      if (!postInterceptionResult.canAct) return;

    await executeTurn({
      actingSide: 'player',
      move,
      actor: postInterceptionResult.combatant,
      actorTeam: postInterceptionResult.playerTeam ?? liveState.playerTeam,
      defender: latestEnemyLead,
      defenderTeam: liveState.enemyTeam,
      targetHasActedThisTurn: true,
    });
      return;
    }

    await executeTurn({
      actingSide: 'player',
      move,
      actor: actingPlayerLead,
      actorTeam: actingPlayerTeam,
      defender: enemy,
      defenderTeam: enemyTeam,
      targetHasActedThisTurn: false,
    });
  }, [
    addMessagesSequentially,
    chooseEnemyMove,
    currentLanguage,
    enemy,
    enemyTeam,
    executeTurn,
    gameState,
    getLocalized,
    getForcedLockedMove,
    getMoveCurrentPp,
    hasHeldItem,
    isMessageProcessing,
    playerTeam,
    resolvePreTurnStatus,
    runEnemyAutoAction,
    shouldEnemyActFirst,
    shouldQuickClawActivate,
    turn,
  ]);

  useEffect(() => {
    if (turn === 'ENEMY' && gameState === 'BATTLE' && !settlementError) {
      void enemyTurn();
    }
  }, [enemyTurn, gameState, settlementError, turn]);

  useEffect(() => {
    const prevTurn = previousTurnRef.current;
    previousTurnRef.current = turn;

    if (gameState !== 'BATTLE' || isMessageProcessing || settlementError) return;
    if (prevTurn !== 'ENEMY' || turn !== 'PLAYER') return;
    if (!playerTeam[0] || !enemyTeam[0]) return;
    const battleEpoch = battleInstanceRef.current.epoch;
    if (roundEndInFlightRef.current === battleEpoch) return;
    roundEndInFlightRef.current = battleEpoch;
    const isCurrentBattle = () => battleMountedRef.current
      && battleInstanceRef.current.epoch === battleEpoch
      && liveBattleStateRef.current.gameState === 'BATTLE';

    const handleRoundEnd = async () => {
      const endTurnResult = resolveEndTurn({
        snapshot: {
          playerTeam: [...playerTeam],
          enemyTeam: [...enemyTeam],
          weather,
          weatherTurns,
          fieldState,
          fieldTurns,
          tailwindTurns,
        },
        getLocalized,
        currentLanguage,
        formatDynamaxEndMessage: (pokemon) => t('specialDynamaxEnd').replace('{name}', getLocalized(pokemon)),
        getMoveCurrentPp,
        tryActivateSitrusBerry,
        tryActivatePinchStatBerry,
      });

      await completeEndTurnResolution({
        result: endTurnResult,
        commitSnapshot: (snapshot) => {
          setPlayerTeam(snapshot.playerTeam);
          setEnemyTeam(snapshot.enemyTeam);
          setEnemy(snapshot.enemyTeam[0] ?? null);
          setWeather(snapshot.weather);
          setWeatherTurns(snapshot.weatherTurns);
          setFieldState(snapshot.fieldState);
          setFieldTurns(snapshot.fieldTurns);
          setTailwindTurns(snapshot.tailwindTurns);
        },
        presentMessages: addMessagesSequentially,
        isCurrentBattle,
        shouldAnnouncePlayerFaint: () => {
          if (!pendingPlayerSwitchRef.current) return true;
          pendingPlayerSwitchRef.current = false;
          return false;
        },
        playerFaintMessage: t('fainted').replace('{name}', getLocalized(endTurnResult.playerLead)),
        enemyFaintMessage: t('fainted').replace('{name}', getLocalized(endTurnResult.enemyLead)),
        sendOutNextPlayer,
        sendOutNextEnemy,
      });
    };

    void handleRoundEnd()
      .catch((error: unknown) => console.error('End-turn resolution failed', error))
      .finally(() => {
        if (roundEndInFlightRef.current === battleEpoch) roundEndInFlightRef.current = null;
      });
  }, [
    addMessagesSequentially,
    currentLanguage,
    enemyTeam,
    fieldState,
    fieldTurns,
    tailwindTurns,
    gameState,
    getLocalized,
    hasHeldItem,
    isMessageProcessing,
    playerTeam,
    settlementError,
    sendOutNextEnemy,
    sendOutNextPlayer,
    setEnemy,
    setEnemyTeam,
    setFieldState,
    setFieldTurns,
    setTailwindTurns,
    setPlayerTeam,
    setWeather,
    setWeatherTurns,
    t,
    turn,
    weather,
    weatherTurns,
    tryActivateSitrusBerry,
  ]);

  const forfeitChallenge = useCallback(() => {
    if (gameState !== 'BATTLE' || isMessageProcessing) return;
    void loseBattle();
  }, [gameState, isMessageProcessing, loseBattle]);

  const devWinBattle = useCallback(() => {
    if (gameState !== 'BATTLE' || isMessageProcessing) return;
    void winBattle();
  }, [gameState, isMessageProcessing, winBattle]);

  return {
    settlementError,
    retrySettlement,
    addMessagesSequentially,
    useItem,
    switchPokemon,
    handleAttack,
    triggerBattleSpecial,
    canUseBattleSpecial,
    canUseBattleSpecialByMode,
    forfeitChallenge,
    devWinBattle,
  };
}

