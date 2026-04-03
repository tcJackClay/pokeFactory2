import { Circle, Flame, Droplets, Leaf, Zap, Snowflake, Swords, Skull, Mountain, Wind, Eye, Bug, Gem, Ghost, Dna, Shield, Heart, Moon } from 'lucide-react';
import { Item } from './types';

export const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A77A',
  fire: '#EE8130',
  water: '#6390F0',
  electric: '#F7D02C',
  grass: '#7AC74C',
  ice: '#96D9D6',
  fighting: '#C22E28',
  poison: '#A33EA1',
  ground: '#E2BF65',
  flying: '#A98FF3',
  psychic: '#F95587',
  bug: '#A6B91A',
  rock: '#B6A136',
  ghost: '#735797',
  dragon: '#6F35FC',
  dark: '#705746',
  steel: '#B7B7CE',
  fairy: '#D685AD',
};

export const TYPE_ICONS: Record<string, any> = {
  normal: Circle,
  fire: Flame,
  water: Droplets,
  grass: Leaf,
  electric: Zap,
  ice: Snowflake,
  fighting: Swords,
  poison: Skull,
  ground: Mountain,
  flying: Wind,
  psychic: Eye,
  bug: Bug,
  rock: Gem,
  ghost: Ghost,
  dragon: Dna,
  steel: Shield,
  fairy: Heart,
  dark: Moon,
};

export const AILMENT_ZH: Record<string, string> = {
  poison: '中毒',
  paralysis: '麻痹',
  burn: '灼伤',
  freeze: '冰冻',
  sleep: '睡眠',
  confusion: '混乱',
  infatuation: '着迷',
  trap: '束缚',
  nightmare: '噩梦',
  leech_seed: '寄生种子',
};

export const STAT_ZH: Record<string, string> = {
  attack: '攻击',
  defense: '防御',
  spAtk: '特攻',
  spDef: '特防',
  speed: '速度',
  accuracy: '命中',
  evasion: '闪避',
};

export const STAT_STAGE_MODIFIERS: Record<number, number> = {
  '-6': 2 / 8,
  '-5': 2 / 7,
  '-4': 2 / 6,
  '-3': 2 / 5,
  '-2': 2 / 4,
  '-1': 2 / 3,
  '0': 1,
  '1': 1.5,
  '2': 2,
  '3': 2.5,
  '4': 3,
  '5': 3.5,
  '6': 4,
};

export const ACC_EVA_STAGE_MODIFIERS: Record<number, number> = {
  '-6': 3 / 9,
  '-5': 3 / 8,
  '-4': 3 / 7,
  '-3': 3 / 6,
  '-2': 3 / 5,
  '-1': 3 / 4,
  '0': 1,
  '1': 4 / 3,
  '2': 5 / 3,
  '3': 6 / 3,
  '4': 7 / 3,
  '5': 8 / 3,
  '6': 9 / 3,
};

export const ALL_ITEMS: Item[] = [
  {
    id: 'potion',
    name: 'Potion',
    zhName: '回复药',
    description: 'Heal 50 HP',
    zhDescription: '恢复50点HP',
    effect: (p) => ({ ...p, currentHp: Math.min(p.maxHp, p.currentHp + 50) })
  },
  {
    id: 'pokeball',
    name: 'Poke Ball',
    zhName: '精灵球',
    description: 'Used to catch wild Pokemon',
    zhDescription: '用于捕捉野生宝可梦',
    isBall: true,
    catchRate: 1.0,
    effect: (p) => p
  },
  {
    id: 'greatball',
    name: 'Great Ball',
    zhName: '超级球',
    description: 'Higher catch rate than Poke Ball',
    zhDescription: '比精灵球更容易捕捉',
    isBall: true,
    catchRate: 1.5,
    effect: (p) => p
  },
  {
    id: 'ultraball',
    name: 'Ultra Ball',
    zhName: '高级球',
    description: 'Very high catch rate',
    zhDescription: '捕捉概率非常高',
    isBall: true,
    catchRate: 2.0,
    effect: (p) => p
  },
  {
    id: 'masterball',
    name: 'Master Ball',
    zhName: '大师球',
    description: 'The ultimate ball that never fails',
    zhDescription: '绝对能捕捉到宝可梦的终极球',
    isBall: true,
    catchRate: 255,
    effect: (p) => p
  },
  {
    id: 'protein',
    name: 'Protein',
    zhName: '攻击增强',
    description: 'Increase Attack by 10%',
    zhDescription: '攻击力提升10%',
    effect: (p) => ({ ...p, calculatedStats: { ...p.calculatedStats, attack: Math.floor(p.calculatedStats.attack * 1.1) } })
  },
  {
    id: 'iron',
    name: 'Iron',
    zhName: '防御增强',
    description: 'Increase Defense by 10%',
    zhDescription: '防御力提升10%',
    effect: (p) => ({ ...p, calculatedStats: { ...p.calculatedStats, defense: Math.floor(p.calculatedStats.defense * 1.1) } })
  },
  {
    id: 'calcium',
    name: 'Calcium',
    zhName: '特攻增强',
    description: 'Increase Sp. Atk by 10%',
    zhDescription: '特攻提升10%',
    effect: (p) => ({ ...p, calculatedStats: { ...p.calculatedStats, spAtk: Math.floor(p.calculatedStats.spAtk * 1.1) } })
  },
  {
    id: 'zinc_item',
    name: 'Zinc',
    zhName: '特防增强',
    description: 'Increase Sp. Def by 10%',
    zhDescription: '特防提升10%',
    effect: (p) => ({ ...p, calculatedStats: { ...p.calculatedStats, spDef: Math.floor(p.calculatedStats.spDef * 1.1) } })
  },
  {
    id: 'carbos',
    name: 'Carbos',
    zhName: '速度增强',
    description: 'Increase Speed by 10%',
    zhDescription: '速度提升10%',
    effect: (p) => ({ ...p, calculatedStats: { ...p.calculatedStats, speed: Math.floor(p.calculatedStats.speed * 1.1) } })
  },
  {
    id: 'hp_up',
    name: 'HP Up',
    zhName: 'HP增强',
    description: 'Increase Max HP by 20%',
    zhDescription: '最大HP提升20%',
    effect: (p) => {
      const bonus = Math.floor(p.maxHp * 0.2);
      return { ...p, maxHp: p.maxHp + bonus, currentHp: Math.min(p.currentHp + bonus, p.maxHp + bonus) };
    }
  },
  {
    id: 'attack_up',
    name: 'Protein',
    zhName: '攻击增强',
    description: 'All moves power +10',
    zhDescription: '所有技能威力+10',
    effect: (p) => ({
      ...p,
      selectedMoves: p.selectedMoves.map(m => ({ ...m, power: (m.power || 0) + 10 }))
    })
  },
  {
    id: 'heal',
    name: 'Full Restore',
    zhName: '全复药',
    description: 'Fully heal your Pokemon',
    zhDescription: '完全恢复HP',
    effect: (p) => ({ ...p, currentHp: p.maxHp })
  },
  {
    id: 'battle_atk',
    name: 'X Attack',
    zhName: '力量强化',
    description: 'Next attack deals 50% more damage',
    zhDescription: '下一次攻击伤害提升50%',
    isBattleItem: true,
    effect: (p) => p
  },
  {
    id: 'battle_def',
    name: 'X Defense',
    zhName: '防御强化',
    description: 'Reduce incoming damage by 30% for one turn',
    zhDescription: '本回合受到的伤害降低30%',
    isBattleItem: true,
    effect: (p) => p
  },
  {
    id: 'special_mega_stone',
    name: 'Mega Trigger Stone',
    zhName: 'Mega触发石',
    description: 'Consume in battle to activate Mega trigger once',
    zhDescription: '战斗中消耗，触发一次 Mega 强化',
    isSpecialTriggerItem: true,
    effect: (p) => p
  },
  {
    id: 'special_dmax_band',
    name: 'Dynamax Band Core',
    zhName: '极巨核心腕带',
    description: 'Consume in battle to activate Dynamax trigger once',
    zhDescription: '战斗中消耗，触发一次极巨化强化',
    isSpecialTriggerItem: true,
    effect: (p) => p
  },
  {
    id: 'special_tera_orb',
    name: 'Tera Orb Charge',
    zhName: '太晶珠充能',
    description: 'Consume in battle to activate Tera trigger once',
    zhDescription: '战斗中消耗，触发一次太晶化强化',
    isSpecialTriggerItem: true,
    effect: (p) => p
  }
];
