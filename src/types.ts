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

export interface GamePokemon extends Pokemon {
  currentHp: number;
  maxHp: number;
  selectedMoves: Move[];
  level: number;
  speciesName?: string;
  pokeApiName?: string;
  formLedgerSlug?: string;
  nature: Nature;
  ivs: Stats;
  baseStats: Stats;
  calculatedStats: Stats;
  isGym?: boolean;
  factoryHeldItemId?: string;
  status?: string;
  statStages: StatStages;
  specialBoostActive?: boolean;
  specialBoostMode?: 'MEGA' | 'DYNAMAX' | 'TERA';
  teraType?: string;
  dynamaxTurnsLeft?: number;
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

export type GameState = 'START' | 'MENU' | 'BASE' | 'BATTLE' | 'REWARD' | 'LEARN_MOVE' | 'POKEMON_INFO' | 'GAMEOVER' | 'STARTER_SELECT' | 'EVOLUTION' | 'FACTORY_SELECT' | 'FACTORY_SWAP' | 'ROUND_RESULT' | 'COLLECTION' | 'SETTINGS';
export type BattleMenuTab = 'MAIN' | 'MOVES' | 'POKEMON' | 'BAG';

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
