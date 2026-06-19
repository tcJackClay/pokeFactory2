export interface Pokemon {
  id: number;
  name: string;
  names?: { name: string; language: { name: string } }[];
  zhName?: string; // Keep for backward compatibility
  sprites: {
    front_default: string;
    back_default: string;
  };
  stats: {
    base_stat: number;
    stat: {
      name: string;
    };
  }[];
  types: {
    type: {
      name: string;
    };
  }[];
  abilities: {
    ability: {
      name: string;
      url: string;
      zhName?: string;
      names?: { name: string; language: { name: string } }[];
    };
  }[];
  moves: {
    move: {
      name: string;
      url: string;
    };
  }[];
}

export interface Move {
  name: string;
  names?: { name: string; language: { name: string } }[];
  zhName?: string;
  power: number | null;
  accuracy: number | null;
  type: string;
  damage_class: string;
  pp?: number;
  currentPp?: number;
  maxPp?: number;
  zhDescription?: string;
  flavor_text_entries?: { flavor_text: string; language: { name: string } }[];
  ailment?: string;
  ailmentChance?: number;
  flinchChance?: number;
  statChanges?: { change: number; stat: string }[];
  drain?: number;
  healing?: number;
  critRate?: number;
  target?: string;
  battleData?: MoveBattleData;
}

export interface Nature {
  name: string;
  zhName: string;
  plus: string;
  minus: string;
}

export interface Stats {
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface StatStages {
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
  accuracy: number;
  evasion: number;
}

export type MoveBattleFlag =
  | 'contact'
  | 'protect'
  | 'mirror'
  | 'sound'
  | 'punch'
  | 'powder'
  | 'ballistic'
  | 'bypass-protect'
  | 'ignore-accuracy-check';

export type MoveBattleTarget =
  | 'selected-pokemon'
  | 'user'
  | 'all-opponents'
  | 'entire-field'
  | (string & {});

export type MoveEffectId =
  | 'NONE'
  | 'REST'
  | 'SLEEP_TALK'
  | 'SNORE'
  | 'UPROAR'
  | 'SUBSTITUTE'
  | 'TRIPLE_KICK'
  | 'POPULATION_BOMB'
  | 'YAWN'
  | 'NIGHTMARE'
  | 'TAUNT'
  | 'TORMENT'
  | 'DISABLE'
  | 'ENCORE'
  | 'ATTRACT'
  | 'CURSE'
  | 'PROTECT'
  | 'DETECT'
  | 'KINGS_SHIELD'
  | 'SPIKY_SHIELD'
  | 'DRAGON_RAGE'
  | 'SONIC_BOOM'
  | 'LEVEL_DAMAGE'
  | 'HALF_HP'
  | 'ENDEAVOR'
  | 'LOW_HP_POWER'
  | 'HIGH_HP_POWER'
  | 'FACADE'
  | 'SELF_DESTRUCT'
  | (string & {});

export interface MoveBattleData {
  effectId: MoveEffectId;
  priority: number;
  target: MoveBattleTarget;
  flags: MoveBattleFlag[];
  critStage: number;
  drainPercent: number;
  recoilPercent: number;
  healingPercent: number;
  strikeMode: 'single' | 'multi-hit' | 'progressive-multi-hit' | 'multi-hit-per-accuracy';
  minHits: number;
  maxHits: number;
  guaranteedHits?: number;
  secondaryEffects: MoveSecondaryEffect[];
  substituteInteraction: 'blocked' | 'bypass';
  makesContact: boolean;
  soundMove: boolean;
  powderMove: boolean;
  ballisticMove: boolean;
  punchMove: boolean;
  bypassProtect: boolean;
  ignoreAccuracyCheck: boolean;
  weather?: Weather;
  fieldState?: FieldState;
}

export interface MoveSecondaryEffect {
  kind: 'status' | 'volatile-status' | 'flinch' | 'stat-stage';
  chance: number;
  group?: string;
  appliesTo?: 'user' | 'target';
  isPrimary?: boolean;
  requiresHit?: boolean;
  blockedBySubstitute?: boolean;
  statusId?: string;
  stat?: string;
  change?: number;
}

export type AbilityEffectId =
  | 'NONE'
  | 'EARLY_BIRD'
  | 'BATTLE_ARMOR'
  | 'SKILL_LINK'
  | 'SOUNDPROOF'
  | 'SHELL_ARMOR'
  | 'COMATOSE'
  | 'INSOMNIA'
  | 'VITAL_SPIRIT'
  | 'PURIFYING_SALT'
  | 'OBLIVIOUS'
  | (string & {});

export interface AbilityBattleData {
  id: string;
  effectId: AbilityEffectId;
  hooks?: string[];
}

export type ItemEffectId =
  | 'NONE'
  | 'BRIGHT_POWDER'
  | 'LAX_INCENSE'
  | 'LOADED_DICE'
  | 'KINGS_ROCK'
  | 'LEFTOVERS'
  | 'QUICK_CLAW'
  | 'SCOPE_LENS'
  | 'SHELL_BELL'
  | 'SITRUS_BERRY'
  | 'STATUS_CURE_BERRY'
  | 'PINCH_STAT_BERRY'
  | 'CHOICE_BAND'
  | 'FOCUS_BAND'
  | 'WHITE_HERB'
  | 'MENTAL_HERB'
  | 'THICK_CLUB'
  | 'LEEK'
  | 'DEEP_SEA_SCALE'
  | 'LEPPA_BERRY'
  | 'TYPE_BOOST'
  | (string & {});

export interface ItemBattleData {
  id: string;
  effectId: ItemEffectId;
  hooks?: string[];
  accuracyMultiplier?: number;
  flinchChance?: number;
  endTurnHealDenominator?: number;
  pinchTriggerDenominator?: number;
  pinchHealDenominator?: number;
  pinchStat?: keyof StatStages;
  statusCures?: string[];
  mentalStatuses?: string[];
  critStageBonus?: number;
  ppRestoreAmount?: number;
  priorityProcChance?: number;
  surviveAtOneHpChance?: number;
  physicalAttackMultiplier?: number;
  specialDefenseMultiplier?: number;
  damageBasedHealDenominator?: number;
  typeBoostType?: string;
  typeBoostMultiplier?: number;
  speciesIds?: number[];
}

export type NonVolatileStatus =
  | 'sleep'
  | 'poison'
  | 'bad_poison'
  | 'burn'
  | 'paralysis'
  | 'freeze';

export type KnownVolatileStatus =
  | 'confusion'
  | 'flinch'
  | 'attract'
  | 'infatuation'
  | 'taunt'
  | 'encore'
  | 'torment'
  | 'disable'
  | 'nightmare'
  | 'curse'
  | 'yawn'
  | 'uproar'
  | 'protect'
  | 'substitute';

export type VolatileStatusId = KnownVolatileStatus | (string & {});
export type PokemonGender = 'male' | 'female' | 'genderless';

export interface NonVolatileStatusState {
  id: NonVolatileStatus;
  turnsRemaining?: number;
  toxicCounter?: number;
  sourceMoveName?: string;
}

export interface VolatileStatusState {
  id: VolatileStatusId;
  active: boolean;
  turnsRemaining?: number;
  counter?: number;
  sourceMoveName?: string;
  linkedMoveName?: string;
  linkedPokemonId?: number;
}

export type VolatileStatusMap = Partial<Record<string, VolatileStatusState>>;

export interface GamePokemon extends Pokemon {
  currentHp: number;
  maxHp: number;
  speciesId?: number;
  baseTypes?: Pokemon['types'];
  selectedMoves: Move[];
  level: number;
  speciesName?: string;
  pokeApiName?: string;
  formLedgerSlug?: string;
  nature: Nature;
  ivs: Stats;
  evs: Stats;
  baseStats: Stats;
  calculatedStats: Stats;
  gender?: PokemonGender;
  isGym?: boolean;
  factoryHeldItemId?: string;
  nonVolatileStatus?: NonVolatileStatusState;
  volatileStatuses?: VolatileStatusMap;
  statStages: StatStages;
  specialBoostActive?: boolean;
  specialBoostMode?: 'MEGA' | 'DYNAMAX' | 'TERA' | 'ZMOVE';
  teraType?: string;
  dynamaxTurnsLeft?: number;
  factoryPlannedSpecialMode?: 'MEGA' | 'DYNAMAX' | 'TERA' | 'ZMOVE';
  factoryChoiceLockedMoveName?: string | null;
  factoryLastUsedMoveName?: string | null;
}

export interface Item {
  id: string;
  name: string;
  zhName: string;
  description: string;
  zhDescription: string;
  effect: (pokemon: GamePokemon) => GamePokemon;
  isBattleItem?: boolean;
  isBall?: boolean;
  isSpecialTriggerItem?: boolean;
  catchRate?: number;
}

export type Weather = 'none' | 'sunny' | 'rainy' | 'sandstorm' | 'hail';
export type FieldState =
  | 'electric_terrain'
  | 'grassy_terrain'
  | 'misty_terrain'
  | 'psychic_terrain'
  | 'trick_room'
  | 'magic_room'
  | 'wonder_room'
  | 'gravity'
  | 'fairy_lock';
export type FieldTurns = Partial<Record<FieldState, number>>;

export type GameState = 'BOOT' | 'START' | 'MENU' | 'BASE' | 'BATTLE' | 'REWARD' | 'LEARN_MOVE' | 'POKEMON_INFO' | 'GAMEOVER' | 'STARTER_SELECT' | 'EVOLUTION' | 'FACTORY_SELECT' | 'FACTORY_SWAP' | 'ROUND_RESULT' | 'COLLECTION' | 'EVENTS' | 'SETTINGS';
export type BattleMenuTab = 'MAIN' | 'MOVES' | 'POKEMON' | 'BAG' | 'STATUS';

export interface LanguageConfig {
  code: string;
  name: string;
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  { code: 'zh-hans', name: '简体中文' },
  { code: 'zh-hant', name: '繁體中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
];
