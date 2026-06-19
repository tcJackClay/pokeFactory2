import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { BattleMenuTab, FieldState, FieldTurns, GamePokemon, GameState, Item, Move, Weather } from '../../../types';
import { getFactoryTokenReward } from '../config/factoryRewards';
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
  resolveBeforeMoveChecks as resolveBeforeMoveChecksStep,
  clearProtectionChain,
  resolveEndTurn,
  resolveMoveStrikePlan,
  getMoveStrikeBasePower,
  resolveProtectionCollision,
  resolveProtectionMoveUse,
  resolveSecondaryEffectsStep,
  clearSwitchingBattleState,
} from '../battle/engine';
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
  setWeather: Dispatch<SetStateAction<Weather>>;
  setWeatherTurns: Dispatch<SetStateAction<number>>;
  setFieldState: Dispatch<SetStateAction<FieldState[]>>;
  setFieldTurns: Dispatch<SetStateAction<FieldTurns>>;
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
const DEFAULT_FIELD_TURNS = 5;
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

const TERRAIN_FIELD_STATES: FieldState[] = ['electric_terrain', 'grassy_terrain', 'misty_terrain', 'psychic_terrain'];
const FIELD_TURN_BY_STATE: Record<FieldState, number> = {
  electric_terrain: 5,
  grassy_terrain: 5,
  misty_terrain: 5,
  psychic_terrain: 5,
  trick_room: 5,
  magic_room: 5,
  wonder_room: 5,
  gravity: 5,
  fairy_lock: 2,
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
  setWeather,
  setWeatherTurns,
  setFieldState,
  setFieldTurns,
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
  const previousTurnRef = useRef<BattleTurn | null>(null);
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
    if (!normalized) return 'Held Item';
    return HELD_ITEM_LABELS[normalized]
      ?? normalized
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
  }, [normalizeHeldItemId]);

  const getStatusLabel = useCallback((status?: string) => {
    const normalized = normalizeBattleStatusId(status);
    if (normalized === 'paralysis') return 'paralysis';
    if (normalized === 'sleep') return 'sleep';
    if (normalized === 'poison' || normalized === 'bad_poison') return 'poison';
    if (normalized === 'burn') return 'burn';
    if (normalized === 'freeze') return 'freeze';
    if (normalized === 'confusion') return 'confusion';
    return normalized || 'status';
  }, []);

  const getStageLabel = useCallback((stageKey: keyof GamePokemon['statStages']) => {
    if (stageKey === 'attack') return 'Attack';
    if (stageKey === 'defense') return 'Defense';
    if (stageKey === 'spAtk') return 'Sp. Atk';
    if (stageKey === 'spDef') return 'Sp. Def';
    if (stageKey === 'speed') return 'Speed';
    if (stageKey === 'accuracy') return 'Accuracy';
    return 'Evasion';
  }, []);

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

    const curedStatus = curedStatuses.join(' and ');
    return {
      pokemon: nextPokemon,
      message: `${getLocalized(nextPokemon)} cured its ${curedStatus} with ${getHeldItemLabel(heldId)}!`,
    };
  }, [consumeHeldItem, getHeldItemLabel, getLocalized, getStatusLabel, normalizeHeldItemId]);

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
      message: `${getLocalized(nextPokemon)} restored HP with ${getHeldItemLabel(heldId)}!`,
    };
  }, [consumeHeldItem, getHeldItemLabel, getLocalized, hasHeldItemEffect, normalizeHeldItemId]);

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
      message: `${getLocalized(nextPokemon)}'s ${getStageLabel(targetStat)} rose with ${getHeldItemLabel(heldId)}!`,
    };
  }, [consumeHeldItem, getHeldItemLabel, getLocalized, getStageLabel, normalizeHeldItemId]);

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
      message: `${getLocalized(nextPokemon)} restored its lowered stats with ${getHeldItemLabel('white_herb')}!`,
    };
  }, [consumeHeldItem, getHeldItemLabel, getLocalized, hasHeldItem]);

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
      message: `${getLocalized(nextPokemon)} recovered from ${getStatusLabel(activeMentalStatuses[0])} with ${getHeldItemLabel(heldId)}!`,
    };
  }, [consumeHeldItem, getHeldItemLabel, getLocalized, getItemMentalStatuses, getStatusLabel, hasHeldItemEffect, normalizeHeldItemId]);

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
    setFieldState((prev) => {
      const withoutTerrain = TERRAIN_FIELD_STATES.includes(nextField)
        ? prev.filter((field) => !TERRAIN_FIELD_STATES.includes(field))
        : [...prev];
      return withoutTerrain.includes(nextField) ? withoutTerrain : [...withoutTerrain, nextField];
    });
    setFieldTurns((prev) => {
      const nextTurns: FieldTurns = { ...prev };
      if (TERRAIN_FIELD_STATES.includes(nextField)) {
        for (const terrain of TERRAIN_FIELD_STATES) {
          delete nextTurns[terrain];
        }
      }
      nextTurns[nextField] = FIELD_TURN_BY_STATE[nextField] ?? DEFAULT_FIELD_TURNS;
      return nextTurns;
    });
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
      await addMessagesSequentially([`${displayName} recovered some HP!`]);
    } else if (hpChange < 0) {
      await addMessagesSequentially([`${displayName} was hurt by recoil!`]);
    }
  }, [addMessagesSequentially]);

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
      getLocalized,
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
  }, [addMessagesSequentially, fieldState, getLocalized]);

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
    const displayName = isEnemy ? `Enemy ${getLocalized(combatant)}` : getLocalized(combatant);
    const result = resolveBeforeMoveChecksStep({
      snapshot: {
        playerTeam: [...(currentPlayerTeam ?? playerTeam)],
        enemyTeam: [...(currentEnemyTeam ?? enemyTeam)],
        weather,
        weatherTurns,
        fieldState,
        fieldTurns,
      },
      side: isEnemy ? 'enemy' : 'player',
      combatant,
      move,
      displayName,
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
    enemyTeam,
    fieldState,
    fieldTurns,
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
    nextEnemyTeam[0] = clearSwitchingBattleState(nextEnemyTeam[0]);
    setEnemyTeam(nextEnemyTeam);
    setEnemy(nextEnemyTeam[0]);
    await addMessagesSequentially([t('enemySentOut').replace('{name}', getLocalized(nextEnemyTeam[0]))]);
    setMainBattleTurn('PLAYER');
    return true;
  }, [addMessagesSequentially, clearSwitchingBattleState, getLocalized, setEnemy, setEnemyTeam, setMainBattleTurn, t, winBattle]);

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
    const incomingPokemon = newTeam[index];
    if (!currentLead || !incomingPokemon || incomingPokemon.currentHp <= 0) return;
    if (getForcedLockedMove(currentLead)) {
      await addMessagesSequentially([`${getLocalized(currentLead)} cannot switch out during the uproar!`]);
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
    const actorLabel = isPlayerActing ? getLocalized(actor) : `Enemy ${getLocalized(actor)}`;
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
          leppaMessage = `${actorLabel}'s ${getHeldItemLabel('leppa_berry')} restored PP!`;
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
        await addMessagesSequentially([`${actorLabel}'s Sleep Talk failed!`]);
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
      await addMessagesSequentially([`${actorLabel}'s Sleep Talk used ${getLocalized(calledMove)}!`]);
    }
    if (hasMoveBattleEffect(resolvedMove, 'SNORE') && getNonVolatileStatusId(updatedActor) !== 'sleep') {
      await addMessagesSequentially([`${actorLabel}'s Snore failed!`]);
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

    updatedActor = {
      ...updatedActor,
      factoryLastUsedMoveName: resolvedMove.name,
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
          ? `${actorLabel} protected itself!`
          : `${actorLabel}'s protection failed!`,
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
        await addMessagesSequentially([`${actorLabel}'s Rest failed!`]);
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
        await addMessagesSequentially([`${actorLabel} slept and became healthy!`]);
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
        await addMessagesSequentially([`${actorLabel}'s Substitute failed!`]);
      } else {
        updatedActor = setVolatileStatus({
          ...updatedActor,
          currentHp: updatedActor.currentHp - substituteHpCost,
        }, 'substitute', {
          counter: substituteHpCost,
          sourceMoveName: resolvedMove.name,
        });
        syncLeadBySide(actingSide, updatedActor);
        await addMessagesSequentially([`${actorLabel} put in a substitute!`]);
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
        await addMessagesSequentially([`${actorLabel}'s Curse failed!`]);
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
        await addMessagesSequentially([`${actorLabel} cut its own HP and laid a curse on ${getLocalized(updatedDefender)}!`]);
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
        await addMessagesSequentially([`${actorLabel}'s King's Rock triggered!`]);
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
        await addMessagesSequentially([`${getLocalized(updatedDefender)} protected itself!`]);
        if (!hitResult.protectReducedDamage) {
          const protectionCollisionResult = resolveProtectionCollision(updatedActor, updatedDefender, resolvedMove);
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
        await addMessagesSequentially([`${getLocalized(updatedDefender)}'s substitute blocked the move!`]);
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
        break;
      }

      if (hitResult.multiplier === 0) {
        moveHadNoEffect = true;
        break;
      }

      hitCount += 1;
      anyCrit = anyCrit || hitResult.isCrit;

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
        await addMessagesSequentially([`${getLocalized(updatedDefender)}'s substitute took the damage!`]);
        if (hitResult.substituteBroke) {
          await addMessagesSequentially([`${getLocalized(updatedDefender)}'s substitute broke!`]);
        }
        await resolvePostHitSecondaryEffects({
          extraFlinchChance: kingsRockFlinchChance,
          allowUserEffects: hitResult.applyUserSecondaryEffects,
          allowTargetEffects: false,
        });
        continue;
      }

      newDefenderHp = Math.max(0, updatedDefender.currentHp - Math.max(0, hitResult.damage));
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
      };
      totalDamage += Math.max(0, hitResult.damage);
      syncLeadBySide(defendingSide, updatedDefender);

      await resolvePostHitSecondaryEffects({
        extraFlinchChance: kingsRockFlinchChance,
        allowUserEffects: hitResult.applyUserSecondaryEffects,
        allowTargetEffects: hitResult.applyTargetSecondaryEffects && updatedDefender.currentHp > 0,
      });

      if (updatedDefender.currentHp <= 0) {
        break;
      }
    }

    if (anyCrit) {
      await addMessagesSequentially(['Critical hit!']);
    }

    if (totalDamage > 0 || totalSubstituteDamage > 0) {
      if (isPlayerActing) {
        setEnemyAnim('hit');
      } else {
        setPlayerAnim('hit');
      }
    }

    if (focusBandTriggered) {
      await addMessagesSequentially([`${getLocalized(updatedDefender)} hung on with ${getHeldItemLabel('focus_band')}!`]);
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
    const moveRecoilPercent = getMoveRecoilPercent(resolvedMove);
    const moveHealingPercent = getMoveHealingPercent(resolvedMove);
    if (moveDrainPercent !== 0 && totalDamage > 0) actorHpChange += Math.floor(totalDamage * moveDrainPercent / 100);
    if (moveRecoilPercent !== 0 && totalDamage > 0) actorHpChange -= Math.max(1, Math.floor(totalDamage * moveRecoilPercent / 100));
    if (moveHealingPercent !== 0) actorHpChange += Math.floor(updatedActor.maxHp * moveHealingPercent / 100);
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
    };
    if (hasMoveBattleEffect(resolvedMove, 'SELF_DESTRUCT')) {
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
      await addMessagesSequentially([`${actorLabel} restored HP with ${getHeldItemLabel('shell_bell')}!`]);
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
      await addMessagesSequentially([`${actorLabel}'s attack hit ${hitCount} times!`]);
    }

    if (hasMoveBattleEffect(resolvedMove, 'UPROAR') && !hasVolatileStatus(updatedActor, 'uproar')) {
      updatedActor = setVolatileStatus(updatedActor, 'uproar', {
        turnsRemaining: UPROAR_TURNS_GEN5_PLUS,
        linkedMoveName: 'uproar',
      });
      syncLeadBySide(actingSide, updatedActor);
      await addMessagesSequentially([`${actorLabel} caused an uproar!`]);
    }

    const nextWeather = getMoveWeather(resolvedMove);
    if (nextWeather) {
      setWeather(nextWeather);
      setWeatherTurns(DEFAULT_WEATHER_TURNS);
    }

    const nextField = getMoveFieldState(resolvedMove);
    if (nextField) {
      applyFieldEffect(nextField);
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
    enemyBuffs.atk,
    enemyBuffs.def,
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
      playerQuickClawActivated,
      enemyQuickClawActivated,
    }).enemyActsFirst;
  }, [fieldState]);

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
      await addMessagesSequentially([`${getLocalized(playerTeam[0])} must keep making an uproar!`]);
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
      await addMessagesSequentially([`${getLocalized(actingPlayerLead)} is locked into ${playerLockedMoveName}!`]);
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
      await addMessagesSequentially([`${getLocalized(actingPlayerLead)}'s Quick Claw activated!`]);
    }

    if (enemyQuickClawActivated) {
      await addMessagesSequentially([`Enemy ${getLocalized(enemy)}'s Quick Claw activated!`]);
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
        await addMessagesSequentially([`${getLocalized(latestPlayerLead)} is locked into ${latestLockedMoveName}!`]);
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
    if (turn === 'ENEMY' && gameState === 'BATTLE') {
      void enemyTurn();
    }
  }, [enemyTurn, gameState, turn]);

  useEffect(() => {
    const prevTurn = previousTurnRef.current;
    previousTurnRef.current = turn;

    if (gameState !== 'BATTLE' || isMessageProcessing) return;
    if (prevTurn !== 'ENEMY' || turn !== 'PLAYER') return;
    if (!playerTeam[0] || !enemyTeam[0]) return;

    let cancelled = false;

    const handleRoundEnd = async () => {
      const endTurnResult = resolveEndTurn({
        snapshot: {
          playerTeam: [...playerTeam],
          enemyTeam: [...enemyTeam],
          weather,
          weatherTurns,
          fieldState,
          fieldTurns,
        },
        getLocalized,
        formatDynamaxEndMessage: (pokemon) => t('specialDynamaxEnd').replace('{name}', getLocalized(pokemon)),
        getMoveCurrentPp,
        tryActivateSitrusBerry,
        tryActivatePinchStatBerry,
      });

      const nextPlayerTeam = endTurnResult.snapshot.playerTeam;
      const nextEnemyTeam = endTurnResult.snapshot.enemyTeam;
      const playerLead = endTurnResult.playerLead;
      const enemyLead = endTurnResult.enemyLead;
      const endTurnMessages = endTurnResult.events
        .filter((event) => event.type === 'message')
        .map((event) => event.message);

      setPlayerTeam(nextPlayerTeam);
      setEnemyTeam(nextEnemyTeam);
      setEnemy(nextEnemyTeam[0] ?? null);

      if (endTurnMessages.length > 0) {
        await addMessagesSequentially(endTurnMessages);
      }
      if (cancelled) return;

      if (endTurnResult.playerLeadFainted) {
        if (pendingPlayerSwitchRef.current) {
          pendingPlayerSwitchRef.current = false;
        } else {
          await addMessagesSequentially([t('fainted').replace('{name}', getLocalized(playerLead))]);
          if (cancelled) return;
        }
        await sendOutNextPlayer(nextPlayerTeam);
      }

      if (endTurnResult.enemyLeadFainted) {
        await addMessagesSequentially([t('fainted').replace('{name}', getLocalized(enemyLead))]);
        if (cancelled) return;
        await sendOutNextEnemy(nextEnemyTeam, enemyLead.id);
      }

      setWeather(endTurnResult.snapshot.weather);
      setWeatherTurns(endTurnResult.snapshot.weatherTurns);
      setFieldState(endTurnResult.snapshot.fieldState);
      setFieldTurns(endTurnResult.snapshot.fieldTurns);
    };

    void handleRoundEnd();

    return () => {
      cancelled = true;
    };
  }, [
    addMessagesSequentially,
    enemyTeam,
    fieldState,
    fieldTurns,
    gameState,
    getLocalized,
    hasHeldItem,
    isMessageProcessing,
    playerTeam,
    sendOutNextEnemy,
    sendOutNextPlayer,
    setEnemy,
    setEnemyTeam,
    setFieldState,
    setFieldTurns,
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

