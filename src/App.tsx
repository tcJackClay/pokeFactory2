/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sword, 
  Shield, 
  Heart, 
  Zap, 
  Trophy, 
  Skull, 
  RefreshCw, 
  ChevronRight,
  Info,
  Dna,
  Package,
  Target,
  Sparkles,
  Flame,
  Droplets,
  Leaf,
  Snowflake,
  Swords,
  Mountain,
  Wind,
  Eye,
  Bug,
  Gem,
  Ghost,
  Moon,
  Circle,
  ShoppingCart,
  ArrowRight,
  Coins
} from 'lucide-react';
import { getProcessedPokemon, getRandomPokemonId, getLearnableMoves, fetchEvolutionChain, fetchPokemon } from './services/pokeApi';
import { GamePokemon, GameState, Item, Move, BattleMenuTab, SUPPORTED_LANGUAGES, Nature, StatStages, Weather, Pokemon } from './types';
import { TYPE_CHART, TYPE_ZH, GENERATIONS } from './constants';

// 属性颜色映射
const TYPE_COLORS: Record<string, string> = {
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

const TYPE_ICONS: Record<string, any> = {
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

const AILMENT_ZH: Record<string, string> = {
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

const STAT_ZH: Record<string, string> = {
  attack: '攻击',
  defense: '防御',
  spAtk: '特攻',
  spDef: '特防',
  speed: '速度',
  accuracy: '命中',
  evasion: '闪避',
};

const STAT_STAGE_MODIFIERS: Record<number, number> = {
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

const ACC_EVA_STAGE_MODIFIERS: Record<number, number> = {
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

const TypeBadge: React.FC<{ type: string, size?: 'xs' | 'sm' | 'md' | 'lg', className?: string }> = ({ type, size = 'sm', className = "" }) => {
  const Icon = TYPE_ICONS[type] || Sparkles;
  const color = TYPE_COLORS[type] || '#ccc';
  
  // 这里可以根据 currentLanguage 返回对应的属性名，但目前 TYPE_ZH 只有中文
  // 简单处理：如果是 en，返回 type 原名，否则返回 TYPE_ZH
  const getTypeName = () => {
    return TYPE_ZH[type] || type;
  };
  
  const sizeClasses = {
    xs: 'text-[8px] px-1.5 py-0.5 gap-1',
    sm: 'text-[10px] px-2 py-1 gap-1.5',
    md: 'text-xs px-3 py-1 gap-2',
    lg: 'text-sm px-5 py-1.5 gap-2.5',
  };

  const iconSizes = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <div 
      className={`flex items-center text-white font-black italic uppercase shadow-md ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: color }}
    >
      <Icon className={`${iconSizes[size]} drop-shadow-sm`} />
      <span>{getTypeName()}</span>
    </div>
  );
};

// 道具列表
const ALL_ITEMS: Item[] = [
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
    catchRate: 255, // 255 is guaranteed catch in my formula
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
    effect: (p) => p // Effect handled in damage calc
  },
  {
    id: 'battle_def',
    name: 'X Defense',
    zhName: '防御强化',
    description: 'Reduce incoming damage by 30% for one turn',
    zhDescription: '本回合受到的伤害降低30%',
    isBattleItem: true,
    effect: (p) => p
  }
];

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [startStep, setStartStep] = useState(0); // 0: Title, 1: Region, 2: Level
  const [coins, setCoins] = useState(0);
  const [shopItems, setShopItems] = useState<{item: Item, price: number}[]>([]);
  const [rewardChoiceMade, setRewardChoiceMade] = useState(false);
  const [rerollCount, setRerollCount] = useState(0);
  const [playerTeam, setPlayerTeam] = useState<GamePokemon[]>([]);
  const [rewards, setRewards] = useState<{ type: 'ITEM' | 'POKEMON' | 'MOVE' | 'EVOLUTION' | 'SHOP_ITEM', data: any }[]>([]);
  const [activeBuffs, setActiveBuffs] = useState<{ atk: boolean, def: boolean }>({ atk: false, def: false });
  const [enemyBuffs, setEnemyBuffs] = useState<{ atk: boolean, def: boolean }>({ atk: false, def: false });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMessageProcessing, setIsMessageProcessing] = useState(false);
  const [showReplaceUI, setShowReplaceUI] = useState<GamePokemon | null>(null);
  const [learningPokemonIdx, setLearningPokemonIdx] = useState<number | null>(null);
  const [potentialMoves, setPotentialMoves] = useState<Move[]>([]);
  const [selectedNewMove, setSelectedNewMove] = useState<Move | null>(null);
  const [selectedGens, setSelectedGens] = useState<number[]>([1]);
  const [startLevel, setStartLevel] = useState<number>(50);
  const [hoveredMove, setHoveredMove] = useState<Move | null>(null);
  const [infoPokemonIdx, setInfoPokemonIdx] = useState<number | null>(null);
  const [prevGameState, setPrevGameState] = useState<GameState>('START');
  const [showLogHistory, setShowLogHistory] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('zh-hans');
  const [pendingRewardAction, setPendingRewardAction] = useState<'MOVE' | 'EVOLUTION' | null>(null);
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<Item[]>([]);
  const [stage, setStage] = useState(1);
  const [enemy, setEnemy] = useState<GamePokemon | null>(null);
  const [enemyTeam, setEnemyTeam] = useState<GamePokemon[]>([]);
  const [streak, setStreak] = useState(0);
  const [factoryRentals, setFactoryRentals] = useState<GamePokemon[]>([]);
  const [selectedRentalIndices, setSelectedRentalIndices] = useState<number[]>([]);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [turn, setTurn] = useState<'PLAYER' | 'ENEMY'>('PLAYER');
  const [battleMenuTab, setBattleMenuTab] = useState<BattleMenuTab>('MAIN');

  const [weather, setWeather] = useState<Weather>('none');
  const [weatherTurns, setWeatherTurns] = useState(0);
  const [evolutionTarget, setEvolutionTarget] = useState<GamePokemon | null>(null);
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolvedPokemon, setEvolvedPokemon] = useState<GamePokemon | null>(null);
  const [evolutionChoices, setEvolutionChoices] = useState<Pokemon[]>([]);
  const [selectedPokemonForEvolution, setSelectedPokemonForEvolution] = useState<{pokemon: GamePokemon, index: number} | null>(null);

  const uiStrings: Record<string, Record<string, string>> = {
    'zh-hans': {
      stage: '关卡',
      switch: '出战',
      info: '详情',
      selectMove: '选择技能',
      back: '返回',
      victory: '胜利！',
      chooseReward: '选择一项奖励以继续你的冒险',
      viewTeam: '查看我的队伍',
      randomRewards: '随机奖励',
      getItem: '获得道具',
      learnMove: '学习新技能',
      learnMoveDesc: '让队伍中的一只宝可梦学习一个新技能',
      evolutionReward: '宝可梦进化',
      evolutionRewardDesc: '让队伍中的一只宝可梦进化到下一阶段',
      specialReward: '特殊奖励',
      joinTeam: '加入队伍',
      selectThis: '选择此项',
      mysteryShop: '神秘商店 (使用金币购买)',
      insufficientCoins: '金币不足',
      buyItem: '购买道具',
      teamFull: '队伍已满！',
      replacePartner: '选择一只宝可梦进行替换，以加入新的伙伴',
      power: '威力',
      accuracy: '命中',
      pp: 'PP',
      nature: '性格',
      ability: '特性',
      none: '无',
      stats: '能力值',
      currentMoves: '当前技能',
      base: '种族',
      iv: '个体',
      physical: '物理',
      special: '特攻',
      status: '变化',
      confirm: '确认',
      cancel: '取消',
      battleLog: '战斗记录',
      hp: 'HP',
      attack: '攻击',
      defense: '防御',
      spAtk: '特攻',
      spDef: '特防',
      speed: '速度',
      catchSuccess: '捕捉成功！获得了 {coins} 金币！',
      battleVictory: '战斗胜利！获得了 {coins} 金币！',
      selectToLearn: '选择一只宝可梦来学习新的力量',
      retrievingMoves: '正在检索可学习的技能...',
      replaceWhichMove: '替换哪个技能？',
      alreadyKnows4: '{name} 已经学会了4个技能。',
      selectOldToReplace: '请选择一个旧技能来替换为 {move}。',
      movesCount: '{count}/4 技能',
      learnMoveBtn: '学习技能',
      cancelReplace: '取消替换',
      searchingPokemon: '正在寻找宝可梦...',
      battleHistory: '对战历史',
      chooseStarter: '选择你的初始伙伴',
      chooseStarterDesc: '从这三只随机宝可梦中选择一只开始你的冒险',
      startingMoves: '初始技能',
      viewDetails: '查看详情',
      iChooseYou: '就决定是你了！',
      gymLeaderSent: '道馆馆主 派出了 {name}！',
      wildPokemonAppeared: '野生的 {name} 出现了！',
      youUsed: '你使用了 {name}！',
      cannotCatchGym: '不能捕捉道馆馆主的宝可梦！',
      catching: '正在捕捉...',
      catchSuccessMsg: '成功捕捉了 {name}！',
      joinedTeam: '{name} 已加入你的队伍！',
      brokeFree: '{name} 挣脱了！',
      withdrew: '你收回了 {name}！',
      sentOut: '你派出了 {name}！',
      usedMove: '{name} 使用了 {move}！',
      superEffective: '这一击效果绝佳！',
      notVeryEffective: '这一击收效甚微...',
      noEffect: '似乎没有效果...',
      causedDamage: '{name} 造成了 {damage} 点伤害。',
      fainted: '{name} 倒下了！',
      enemyUsedMove: '对手的 {name} 使用了 {move}！',
      enemyCausedDamage: '对手的 {name} 造成了 {damage} 点伤害。',
      noRecords: '尚无记录',
      rogueJourney: 'PokeFactory 之旅：在无尽的挑战中生存',
      startBattle: '开始对战',
      selectRegion: '选择你的冒险地区',
      nextStep: '下一步：选择等级',
      setDifficulty: '设定初始挑战难度',
      startAdventure: '开启冒险之旅',
      thinking: '对手正在思考...',
      commandPhase: '指令阶段',
      whatToDo: '该怎么办呢？',
      atkUp: '攻击↑',
      defUp: '防御↑',
      battle: '战斗',
      bag: '背包',
      pokemon: '宝可梦',
      run: '逃跑',
      myBag: '我的背包',
      myTeam: '我的队伍',
      bagEmpty: '背包空空如也',
      backToMoves: '返回选择技能',
      evolution: '进化',
      evolveSuccess: '{name} 进化成了 {target}！',
      cannotEvolve: '这只宝可梦目前无法进化。',
      selectToEvolve: '选择一只宝可梦进行进化',
      chooseEvolution: '选择进化形态',
      evolve: '进化',
      shop: '商店',
      price: '价格',
      learningNewMove: '正在学习新技能...',
      learnThisMove: '学习此技能',
      noMoreMoves: '这只宝可梦暂时没有更多可学习的技能了。',
      reselectPokemon: '重新选择宝可梦',
      challengeEnd: '挑战结束',
      fellAtStage: '你在第 {stage} 关倒下了',
      restart: '重新开始',
      weather_none: '天气：无',
      weather_sunny: '天气：大晴天',
      weather_rainy: '天气：下雨',
      weather_sandstorm: '天气：沙暴',
      weather_hail: '天气：冰雹',
      weather_sunny_effect: '阳光增强了火属性技能，削弱了水属性技能。',
      weather_rainy_effect: '降雨增强了水属性技能，削弱了火属性技能。',
      weather_sandstorm_effect: '沙暴正在肆虐！岩石、地面和钢属性以外的宝可梦会受到伤害。',
      weather_hail_effect: '冰雹正在降下！冰属性以外的宝可梦会受到伤害。',
      reroll: '重新选择',
      rerollCost: '消耗 {cost} 金币',
      reachedFloor: '你在第 {stage} 关倒下了',
      gameOver: '挑战结束',
      factorySelect: '对战工厂：租赁宝可梦',
      factorySelectDesc: '从以下6只宝可梦中选择3只作为你的初始队伍。',
      factorySwap: '对战工厂：交换宝可梦',
      factorySwapDesc: '你可以选择一只自己的宝可梦与对手的一只进行交换。',
      confirmSelection: '确认选择 ({count}/3)',
      skipSwap: '跳过交换',
      swapWith: '交换',
      currentTeam: '当前队伍',
      opponentTeam: '对手队伍',
      streak: '连胜数: {count}',
      playerSentOut: '你派出了 {name}！',
      enemySentOut: '对手 派出了 {name}！',
    },
    'zh-hant': {
      stage: '關卡',
      switch: '出戰',
      info: '詳情',
      selectMove: '選擇技能',
      back: '返回',
      victory: '勝利！',
      chooseReward: '選擇一項獎勵以繼續你的冒險',
      viewTeam: '查看我的隊伍',
      randomRewards: '隨機獎勵',
      getItem: '獲得道具',
      learnMove: '學習新技能',
      learnMoveDesc: '讓隊伍中的一隻寶可夢學習一個新技能',
      evolutionReward: '寶可夢進化',
      evolutionRewardDesc: '讓隊伍中的一隻寶可夢進化到下一階段',
      specialReward: '特殊獎勵',
      joinTeam: '加入隊伍',
      selectThis: '選擇此項',
      mysteryShop: '神秘商店 (使用金幣購買)',
      insufficientCoins: '金幣不足',
      buyItem: '購買道具',
      teamFull: '隊伍已滿！',
      replacePartner: '選擇一隻寶可夢進行替換，以加入新的夥伴',
      power: '威力',
      accuracy: '命中',
      pp: 'PP',
      nature: '性格',
      ability: '特性',
      none: '無',
      stats: '能力值',
      currentMoves: '當前技能',
      base: '種族',
      iv: '個體',
      physical: '物理',
      special: '特攻',
      status: '變化',
      confirm: '確認',
      cancel: '取消',
      battleLog: '戰鬥記錄',
      hp: 'HP',
      attack: '攻擊',
      defense: '防禦',
      spAtk: '特攻',
      spDef: '特防',
      speed: '速度',
      catchSuccess: '捕捉成功！獲得了 {coins} 金幣！',
      battleVictory: '戰鬥勝利！獲得了 {coins} 金幣！',
      selectToLearn: '選擇一隻寶可夢來學習新的力量',
      retrievingMoves: '正在檢索可學習的技能...',
      replaceWhichMove: '替換哪個技能？',
      alreadyKnows4: '{name} 已經學會了4個技能。',
      selectOldToReplace: '請選擇一個舊技能來替換為 {move}。',
      movesCount: '{count}/4 技能',
      learnMoveBtn: '學習技能',
      cancelReplace: '取消替換',
      searchingPokemon: '正在尋找寶可夢...',
      battleHistory: '對戰歷史',
      chooseStarter: '選擇你的初始夥伴',
      chooseStarterDesc: '從這三隻隨機寶可夢中選擇一隻開始你的冒險',
      startingMoves: '初始技能',
      viewDetails: '查看詳情',
      iChooseYou: '就決定是你了！',
      gymLeaderSent: '道館館主 派出了 {name}！',
      wildPokemonAppeared: '野生的 {name} 出現了！',
      youUsed: '你使用了 {name}！',
      cannotCatchGym: '不能捕捉道館館主的寶可夢！',
      catching: '正在捕捉...',
      catchSuccessMsg: '成功捕捉了 {name}！',
      joinedTeam: '{name} 已加入你的隊伍！',
      brokeFree: '{name} 掙脫了！',
      withdrew: '你收回了 {name}！',
      sentOut: '你派出了 {name}！',
      usedMove: '{name} 使用了 {move}！',
      superEffective: '這一擊效果絕佳！',
      notVeryEffective: '這一擊收效甚微...',
      noEffect: '似乎沒有效果...',
      causedDamage: '{name} 造成了 {damage} 點傷害。',
      fainted: '{name} 倒下了！',
      enemyUsedMove: '對手的 {name} 使用了 {move}！',
      enemyCausedDamage: '對手的 {name} 造成了 {damage} 點傷害。',
      noRecords: '尚無記錄',
      rogueJourney: 'PokeFactory 之旅：在無盡的挑戰中生存',
      startBattle: '開始對戰',
      selectRegion: '選擇你的冒險地區',
      nextStep: '下一步：選擇等級',
      setDifficulty: '設定初始挑戰難度',
      startAdventure: '開啟冒險之旅',
      thinking: '對手正在思考...',
      commandPhase: '指令階段',
      whatToDo: '該怎麼辦呢？',
      atkUp: '攻擊↑',
      defUp: '防禦↑',
      battle: '戰鬥',
      bag: '背包',
      pokemon: '寶可夢',
      run: '逃跑',
      myBag: '我的背包',
      myTeam: '我的隊伍',
      bagEmpty: '背包空空如也',
      backToMoves: '返回選擇技能',
      evolution: '進化',
      evolveSuccess: '{name} 進化成了 {target}！',
      cannotEvolve: '這隻寶可夢目前無法進化。',
      selectToEvolve: '選擇一隻寶可夢進行進化',
      chooseEvolution: '選擇進化形態',
      evolve: '進化',
      shop: '商店',
      price: '價格',
      learningNewMove: '正在學習新技能...',
      learnThisMove: '學習此技能',
      noMoreMoves: '這隻寶可夢暫時沒有更多可學習的技能了。',
      reselectPokemon: '重新選擇寶可夢',
      challengeEnd: '挑戰結束',
      fellAtStage: '你在第 {stage} 關倒下了',
      restart: '重新開始',
      weather_none: '天氣：無',
      weather_sunny: '天氣：大晴天',
      weather_rainy: '天氣：下雨',
      weather_sandstorm: '天氣：沙暴',
      weather_hail: '天氣：冰雹',
      weather_sunny_effect: '陽光增強了火屬性技能，削弱了水屬性技能。',
      weather_rainy_effect: '降雨增強了水屬性技能，削弱了火屬性技能。',
      weather_sandstorm_effect: '沙暴正在肆虐！岩石、地面和鋼屬性以外的寶可夢會受到傷害。',
      weather_hail_effect: '冰雹正在降下！冰屬性以外的寶可夢會受到傷害。',
      reroll: '重新選擇',
      rerollCost: '消耗 {cost} 點金幣',
      reachedFloor: '你在第 {stage} 關倒下了',
      gameOver: '挑戰結束',
      factorySelect: '對戰工廠：租賃寶可夢',
      factorySelectDesc: '從以下6隻寶可夢中選擇3隻作為你的初始隊伍。',
      factorySwap: '對戰工廠：交換寶可夢',
      factorySwapDesc: '你可以選擇一隻自己的寶可夢與對手的一隻進行交換。',
      confirmSelection: '確認選擇 ({count}/3)',
      skipSwap: '跳過交換',
      swapWith: '交換',
      currentTeam: '當前隊伍',
      opponentTeam: '對手隊伍',
      streak: '連勝數: {count}',
      playerSentOut: '你派出了 {name}！',
      enemySentOut: '對手 派出了 {name}！',
    },
    'en': {
      stage: 'Stage',
      switch: 'Switch',
      info: 'Info',
      selectMove: 'Select Move',
      back: 'Back',
      victory: 'Victory!',
      chooseReward: 'Choose a reward to continue your adventure',
      viewTeam: 'View My Team',
      randomRewards: 'Random Rewards',
      getItem: 'Get Item',
      learnMove: 'Learn New Move',
      learnMoveDesc: 'Let a Pokemon in your team learn a new move',
      evolutionReward: 'Pokemon Evolution',
      evolutionRewardDesc: 'Let a Pokemon in your team evolve to the next stage',
      specialReward: 'Special Reward',
      joinTeam: 'Join Team',
      selectThis: 'Select This',
      mysteryShop: 'Mystery Shop (Buy with Coins)',
      insufficientCoins: 'Insufficient Coins',
      buyItem: 'Buy Item',
      teamFull: 'Team Full!',
      replacePartner: 'Select a Pokemon to replace with the new partner',
      power: 'Power',
      accuracy: 'Accuracy',
      pp: 'PP',
      nature: 'Nature',
      ability: 'Ability',
      none: 'None',
      stats: 'Stats',
      currentMoves: 'Current Moves',
      base: 'Base',
      iv: 'IV',
      physical: 'Physical',
      special: 'Special',
      status: 'Status',
      confirm: 'Confirm',
      cancel: 'Cancel',
      battleLog: 'Battle Log',
      hp: 'HP',
      attack: 'Attack',
      defense: 'Defense',
      spAtk: 'Sp. Atk',
      spDef: 'Sp. Def',
      speed: 'Speed',
      catchSuccess: 'Caught successfully! Earned {coins} coins!',
      battleVictory: 'Victory! Earned {coins} coins!',
      selectToLearn: 'Select a Pokemon to learn new power',
      retrievingMoves: 'Retrieving learnable moves...',
      replaceWhichMove: 'Replace which move?',
      alreadyKnows4: '{name} already knows 4 moves.',
      selectOldToReplace: 'Please select an old move to replace with {move}.',
      movesCount: '{count}/4 Moves',
      learnMoveBtn: 'Learn Move',
      cancelReplace: 'Cancel',
      searchingPokemon: 'Searching for Pokemon...',
      battleHistory: 'Battle History',
      chooseStarter: 'Choose Your Starter',
      chooseStarterDesc: 'Choose one of these three random Pokemon to start your adventure',
      startingMoves: 'Starting Moves',
      viewDetails: 'View Details',
      iChooseYou: 'I choose you!',
      gymLeaderSent: 'Gym Leader sent out {name}!',
      wildPokemonAppeared: 'A wild {name} appeared!',
      youUsed: 'You used {name}!',
      cannotCatchGym: 'Cannot catch Gym Leader\'s Pokemon!',
      catching: 'Catching...',
      catchSuccessMsg: 'Caught {name} successfully!',
      joinedTeam: '{name} joined your team!',
      brokeFree: '{name} broke free!',
      withdrew: 'You withdrew {name}!',
      sentOut: 'You sent out {name}!',
      usedMove: '{name} used {move}!',
      superEffective: 'It\'s super effective!',
      notVeryEffective: 'It\'s not very effective...',
      noEffect: 'It had no effect...',
      causedDamage: '{name} caused {damage} damage.',
      fainted: '{name} fainted!',
      enemyUsedMove: 'Enemy {name} used {move}!',
      enemyCausedDamage: 'Enemy {name} caused {damage} damage.',
      noRecords: 'No records',
      rogueJourney: 'PokeFactory Journey: Survive in endless challenges',
      startBattle: 'Start Battle',
      selectRegion: 'Select Your Region',
      nextStep: 'Next: Select Level',
      setDifficulty: 'Set Initial Difficulty',
      startAdventure: 'Start Adventure',
      thinking: 'Enemy is thinking...',
      commandPhase: 'Command Phase',
      whatToDo: 'What will you do?',
      atkUp: 'Atk↑',
      defUp: 'Def↑',
      battle: 'Battle',
      bag: 'Bag',
      pokemon: 'Pokemon',
      run: 'Run',
      myBag: 'My Bag',
      myTeam: 'My Team',
      bagEmpty: 'Bag is empty',
      backToMoves: 'Back to Moves',
      evolution: 'Evolution',
      evolveSuccess: '{name} evolved into {target}!',
      cannotEvolve: 'This Pokemon cannot evolve at this time.',
      selectToEvolve: 'Select a Pokemon to evolve',
      chooseEvolution: 'Choose Evolution Form',
      evolve: 'Evolve',
      shop: 'Shop',
      price: 'Price',
      learningNewMove: 'Learning new move...',
      learnThisMove: 'Learn this move',
      noMoreMoves: 'This Pokemon has no more learnable moves for now.',
      reselectPokemon: 'Reselect Pokemon',
      challengeEnd: 'Challenge Ended',
      fellAtStage: 'You fell at Stage {stage}',
      restart: 'Restart',
      weather_none: 'Weather: None',
      weather_sunny: 'Weather: Sunny',
      weather_rainy: 'Weather: Rainy',
      weather_sandstorm: 'Weather: Sandstorm',
      weather_hail: 'Weather: Hail',
      weather_sunny_effect: 'The sunlight is strong! Fire moves are boosted, Water moves are weakened.',
      weather_rainy_effect: 'It is raining! Water moves are boosted, Fire moves are weakened.',
      weather_sandstorm_effect: 'A sandstorm is raging! Non-Rock/Ground/Steel Pokemon take damage.',
      weather_hail_effect: 'Hail is falling! Non-Ice Pokemon take damage.',
      reroll: 'Reroll',
      rerollCost: 'Cost {cost} Coins',
      reachedFloor: 'You reached floor {stage}',
      gameOver: 'GAME OVER',
      factorySelect: 'Battle Factory: Rent Pokemon',
      factorySelectDesc: 'Choose 3 Pokemon from the 6 available to start your challenge.',
      factorySwap: 'Battle Factory: Swap Pokemon',
      factorySwapDesc: 'You can swap one of your Pokemon with one of your opponent\'s.',
      confirmSelection: 'Confirm Selection ({count}/3)',
      skipSwap: 'Skip Swap',
      swapWith: 'Swap',
      currentTeam: 'Current Team',
      opponentTeam: 'Opponent Team',
      streak: 'Streak: {count}',
      playerSentOut: 'You sent out {name}!',
      enemySentOut: 'Opponent sent out {name}!',
    }
  };

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    const lang = currentLanguage.startsWith('zh') ? currentLanguage : (uiStrings[currentLanguage] ? currentLanguage : 'en');
    let str = uiStrings[lang]?.[key] || uiStrings['en']?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  }, [currentLanguage]);
  const [showLangMenu, setShowLangMenu] = useState(false);

  // 本地化辅助函数
  const getLocalized = useCallback((obj: any, key: string = 'name') => {
    if (!obj) return '';
    
    // 如果是道具，直接返回 zhName (目前道具是硬编码的)
    if (obj.id && (obj.id === 'potion' || obj.id === 'pokeball' || obj.isBall || obj.isBattleItem)) {
      return currentLanguage.startsWith('zh') ? obj.zhName : obj.name;
    }

    // 查找 names 数组
    if (obj.names && Array.isArray(obj.names)) {
      const entry = obj.names.find((n: any) => n.language.name === currentLanguage);
      if (entry) return entry.name;
      
      // 备选方案：如果是中文，尝试找另一种中文
      if (currentLanguage === 'zh-hans') {
        const alt = obj.names.find((n: any) => n.language.name === 'zh-hant');
        if (alt) return alt.name;
      } else if (currentLanguage === 'zh-hant') {
        const alt = obj.names.find((n: any) => n.language.name === 'zh-hans');
        if (alt) return alt.name;
      }
      
      // 默认返回英文
      const en = obj.names.find((n: any) => n.language.name === 'en');
      if (en) return en.name;
    }

    // 默认回退
    return obj.zhName || obj.name || '';
  }, [currentLanguage]);

  const getLocalizedDesc = useCallback((obj: any) => {
    if (!obj) return '';
    
    // 道具回退
    if (obj.id && (obj.id === 'potion' || obj.id === 'pokeball' || obj.isBall || obj.isBattleItem)) {
      return currentLanguage.startsWith('zh') ? obj.zhDescription : obj.description;
    }

    if (obj.flavor_text_entries && Array.isArray(obj.flavor_text_entries)) {
      const entry = obj.flavor_text_entries.find((e: any) => e.language.name === currentLanguage);
      if (entry) return entry.flavor_text.replace(/\f/g, ' ');

      // 备选方案
      if (currentLanguage === 'zh-hans') {
        const alt = obj.flavor_text_entries.find((e: any) => e.language.name === 'zh-hant');
        if (alt) return alt.flavor_text.replace(/\f/g, ' ');
      } else if (currentLanguage === 'zh-hant') {
        const alt = obj.flavor_text_entries.find((e: any) => e.language.name === 'zh-hans');
        if (alt) return alt.flavor_text.replace(/\f/g, ' ');
      }

      const en = obj.flavor_text_entries.find((e: any) => e.language.name === 'en');
      if (en) return en.flavor_text.replace(/\f/g, ' ');
    }

    return obj.zhDescription || obj.description || '';
  }, [currentLanguage]);

  const getLocalizedNature = useCallback((nature: Nature) => {
    if (currentLanguage.startsWith('zh')) return nature.zhName;
    return nature.name;
  }, [currentLanguage]);

  const getStatName = useCallback((stat: string) => {
    return t(stat) || stat;
  }, [t]);

  // 动画状态
  const [playerAnim, setPlayerAnim] = useState<'idle' | 'attack' | 'hit'>('idle');
  const [enemyAnim, setEnemyAnim] = useState<'idle' | 'attack' | 'hit'>('idle');
  const [activeMoveType, setActiveMoveType] = useState<string | null>(null);
  const [isCatching, setIsCatching] = useState(false);
  const [catchSuccess, setCatchSuccess] = useState<boolean | null>(null);

  const startGame = async () => {
    setLoading(true);
    try {
      // 对战工厂模式：生成6个随机宝可梦供选择
      const rentalIds = [];
      for (let i = 0; i < 6; i++) {
        rentalIds.push(await getRandomPokemonId(selectedGens));
      }
      const rentals = await Promise.all(rentalIds.map(id => getProcessedPokemon(id, startLevel)));
      setFactoryRentals(rentals);
      setSelectedRentalIndices([]);
      
      // 初始道具：对战工厂通常没有背包道具，或者只有固定道具
      setInventory([]);
      setCoins(0);
      setStage(1);
      setStreak(0);
      setGameState('FACTORY_SELECT');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRental = (index: number) => {
    setSelectedRentalIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      if (prev.length < 3) {
        return [...prev, index];
      }
      return prev;
    });
  };

  const confirmRentals = async () => {
    if (selectedRentalIndices.length !== 3) return;
    const team = selectedRentalIndices.map(i => factoryRentals[i]);
    setPlayerTeam(team);
    startBattleTransition();
    await spawnEnemy(1);
  };

  const performSwap = async (playerIdx: number, enemyIdx: number) => {
    const newTeam = [...playerTeam];
    // 恢复满血再加入
    const swappedPoke = { ...enemyTeam[enemyIdx], currentHp: enemyTeam[enemyIdx].maxHp };
    newTeam[playerIdx] = swappedPoke;
    setPlayerTeam(newTeam);
    await nextFactoryStage();
  };

  const nextFactoryStage = async () => {
    healAllPokemon();
    setStage(prev => prev + 1);
    startBattleTransition();
    await spawnEnemy(stage + 1);
  };

  const healAllPokemon = () => {
    setPlayerTeam(prev => prev.map(p => ({ ...p, currentHp: p.maxHp })));
  };

  const startBattleTransition = () => {
    setIsTransitioning(true);
    // 延长闭合时间，确保状态切换在完全闭合后发生
    setTimeout(() => {
      setGameState('BATTLE');
      // 稍微停顿一下，然后开始缓慢打开
      setTimeout(() => setIsTransitioning(false), 400);
    }, 800);
  };

  const spawnEnemy = async (currentStage: number) => {
    setLoading(true);
    try {
      const isGym = currentStage % 7 === 0; // 对战工厂通常每7场一个循环
      const teamSize = 3;
      const enemyIds = [];
      for (let i = 0; i < teamSize; i++) {
        enemyIds.push(await getRandomPokemonId(selectedGens));
      }
      
      const team = await Promise.all(enemyIds.map(async (id) => {
        const level = isGym ? startLevel + 2 : startLevel;
        let p = await getProcessedPokemon(id, level);
        if (isGym) {
          p = {
            ...p,
            maxHp: Math.floor(p.maxHp * 1.2),
            currentHp: Math.floor(p.maxHp * 1.2),
            calculatedStats: {
              ...p.calculatedStats,
              attack: Math.floor(p.calculatedStats.attack * 1.1),
              defense: Math.floor(p.calculatedStats.defense * 1.1),
              spAtk: Math.floor(p.calculatedStats.spAtk * 1.1),
              spDef: Math.floor(p.calculatedStats.spDef * 1.1),
              speed: Math.floor(p.calculatedStats.speed * 1.1),
            }
          };
        }
        return p;
      }));
      
      setEnemyTeam(team);
      const firstEnemy = team[0];
      setEnemy(firstEnemy);
      setBattleLog([]);
      
      if (isGym) {
        await addMessagesSequentially([`工厂头领 派出了 ${getLocalized(firstEnemy)}！`]);
      } else {
        await addMessagesSequentially([`对手 派出了 ${getLocalized(firstEnemy)}！`]);
      }
      
      setTurn('PLAYER');
      setBattleMenuTab('MAIN');
      setActiveBuffs({ atk: false, def: false });
      setEnemyBuffs({ atk: false, def: false });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const useItem = async (item: Item, index: number) => {
    if (gameState !== 'BATTLE' || turn !== 'PLAYER' || isMessageProcessing) return;

    // 消耗道具
    const newInventory = [...inventory];
    newInventory.splice(index, 1);
    setInventory(newInventory);

    await addMessagesSequentially([`你使用了 ${getLocalized(item)}！`]);

    if (item.isBall) {
      if (enemy?.isGym) {
        await addMessagesSequentially(["不能捕捉道馆馆主的宝可梦！"]);
        setTurn('ENEMY');
        setBattleMenuTab('MAIN');
        return;
      }

      // 捕捉逻辑
      // 简化公式: catchRate = ((3 * maxHP - 2 * currentHP) * rate * ballModifier) / (3 * maxHP)
      const ballModifier = item.catchRate || 1;
      // 基础捕捉率 100
      const catchRate = ((3 * enemy!.maxHp - 2 * enemy!.currentHp) * 100 * ballModifier) / (3 * enemy!.maxHp);
      const random = Math.random() * 255; 

      const isSuccess = random < catchRate;
      setIsCatching(true);
      setCatchSuccess(isSuccess);
      
      await addMessagesSequentially(["正在捕捉..."]);
      
      if (isSuccess) {
        await addMessagesSequentially([`成功捕捉了 ${getLocalized(enemy!)}！`]);
        
        // 加入队伍
        if (playerTeam.length < 6) {
          setPlayerTeam(prev => [...prev, { ...enemy!, currentHp: enemy!.maxHp }]);
          await addMessagesSequentially([`${getLocalized(enemy!)} 已加入你的队伍！`]);
          setTimeout(() => {
            winBattle(true);
            setIsCatching(false);
            setCatchSuccess(null);
          }, 500);
        } else {
          setShowReplaceUI({ ...enemy!, currentHp: enemy!.maxHp });
          setTimeout(() => {
            winBattle(true);
            setIsCatching(false);
            setCatchSuccess(null);
          }, 500);
        }
      } else {
        await addMessagesSequentially([`${getLocalized(enemy!)} 挣脱了！`]);
        // 立即恢复精灵展示，不再等待气泡动画完全结束
        setIsCatching(false);
        setCatchSuccess(null);
        setTurn('ENEMY');
        setBattleMenuTab('MAIN');
      }
      return;
    }

    // 非球类道具逻辑
    const updatedTeam = [...playerTeam];
    updatedTeam[0] = item.effect(updatedTeam[0]);
    setPlayerTeam(updatedTeam);

    if (item.id === 'battle_atk') setActiveBuffs(prev => ({ ...prev, atk: true }));
    if (item.id === 'battle_def') setActiveBuffs(prev => ({ ...prev, def: true }));

    setTurn('ENEMY');
    setBattleMenuTab('MAIN');
  };

  const switchPokemon = async (index: number) => {
    if (gameState !== 'BATTLE' || turn !== 'PLAYER' || index === 0 || isMessageProcessing) return;
    
    const newTeam = [...playerTeam];
    const temp = newTeam[0];
    newTeam[0] = newTeam[index];
    newTeam[index] = temp;
    
    setPlayerTeam(newTeam);
    await addMessagesSequentially([t('withdrew').replace('{name}', getLocalized(temp)), t('playerSentOut').replace('{name}', getLocalized(newTeam[0]))]);
    setTurn('ENEMY');
    setBattleMenuTab('MAIN');
  };

  const addMessagesSequentially = async (messages: string[]) => {
    setIsMessageProcessing(true);
    for (const msg of messages) {
      setBattleLog(prev => [...prev, msg]);
      await new Promise(resolve => setTimeout(resolve, 1500)); // 每条消息停留1.5秒
    }
    setIsMessageProcessing(false);
  };

  const handleAttack = async (move: Move) => {
    if (!enemy || gameState !== 'BATTLE' || turn !== 'PLAYER' || isMessageProcessing) return;

    const player = playerTeam[0];
    
    // 检查异常状态限制 (如麻痹、睡眠、冰冻)
    if (player.status === 'sleep') {
      await addMessagesSequentially([`${getLocalized(player)} 正在呼呼大睡...`]);
      if (Math.random() < 0.33) {
        const updatedTeam = [...playerTeam];
        updatedTeam[0] = { ...player, status: undefined };
        setPlayerTeam(updatedTeam);
        await addMessagesSequentially([`${getLocalized(player)} 醒过来了！`]);
      } else {
        setTurn('ENEMY');
        return;
      }
    }
    if (player.status === 'freeze') {
      await addMessagesSequentially([`${getLocalized(player)} 冻得严严实实...`]);
      if (Math.random() < 0.2) {
        const updatedTeam = [...playerTeam];
        updatedTeam[0] = { ...player, status: undefined };
        setPlayerTeam(updatedTeam);
        await addMessagesSequentially([`${getLocalized(player)} 的冰融化了！`]);
      } else {
        setTurn('ENEMY');
        return;
      }
    }
    if (player.status === 'paralysis' && Math.random() < 0.25) {
      await addMessagesSequentially([`${getLocalized(player)} 麻痹了，无法动弹！`]);
      setTurn('ENEMY');
      return;
    }

    setActiveMoveType(move.type);
    setPlayerAnim('attack');
    
    // 1. 使用技能消息
    await addMessagesSequentially([t('usedMove').replace('{name}', getLocalized(player)).replace('{move}', getLocalized(move))]);
    
    const { damage, multiplier, isMiss, isCrit } = calculateDamage(move, player, enemy, activeBuffs.atk, enemyBuffs.def);
    
    if (isMiss) {
      await addMessagesSequentially([`${getLocalized(player)} 的攻击落空了！`]);
      setPlayerAnim('idle');
      setActiveMoveType(null);
      setTurn('ENEMY');
      return;
    }

    if (isCrit) {
      await addMessagesSequentially(['击中了要害！']);
    }

    const newEnemyHp = Math.max(0, enemy.currentHp - damage);
    
    if (damage > 0) {
      setEnemyAnim('hit');
    }
    let updatedEnemy = { ...enemy, currentHp: newEnemyHp };
    
    // 同步更新 enemyTeam
    const updatedEnemyTeam = [...enemyTeam];
    updatedEnemyTeam[0] = updatedEnemy;
    setEnemyTeam(updatedEnemyTeam);
    
    // 处理吸血
    let playerHpChange = 0;
    if (move.drain !== 0 && damage > 0) {
      const drainAmount = Math.floor(damage * move.drain / 100);
      playerHpChange += drainAmount;
    }
    // 处理回血
    if (move.healing !== 0) {
      const healAmount = Math.floor(player.maxHp * move.healing / 100);
      playerHpChange += healAmount;
    }

    const finalPlayerHp = Math.max(0, Math.min(player.maxHp, player.currentHp + playerHpChange));
    const updatedTeam = [...playerTeam];
    updatedTeam[0] = { ...player, currentHp: finalPlayerHp };
    setPlayerTeam(updatedTeam);

    if (playerHpChange > 0) {
      await addMessagesSequentially([`${getLocalized(player)} 恢复了体力！`]);
    } else if (playerHpChange < 0) {
      await addMessagesSequentially([`${getLocalized(player)} 受到了反作用力伤害！`]);
    }

    // 5. 天气伤害
    if (weather === 'sandstorm' || weather === 'hail') {
      const isRockGroundSteel = (p: GamePokemon) => p.types.some(t => ['rock', 'ground', 'steel'].includes(t.type.name));
      const isIce = (p: GamePokemon) => p.types.some(t => t.type.name === 'ice');
      
      if (weather === 'sandstorm' && !isRockGroundSteel(updatedEnemy) && newEnemyHp > 0) {
        const weatherDmg = Math.floor(updatedEnemy.maxHp / 16);
        updatedEnemy.currentHp = Math.max(0, updatedEnemy.currentHp - weatherDmg);
        await addMessagesSequentially([t('weatherDamage').replace('{name}', getLocalized(updatedEnemy))]);
      } else if (weather === 'hail' && !isIce(updatedEnemy) && newEnemyHp > 0) {
        const weatherDmg = Math.floor(updatedEnemy.maxHp / 16);
        updatedEnemy.currentHp = Math.max(0, updatedEnemy.currentHp - weatherDmg);
        await addMessagesSequentially([t('weatherDamage').replace('{name}', getLocalized(updatedEnemy))]);
      }
    }

    setEnemy(updatedEnemy);
    setPlayerAnim('idle');
    setActiveMoveType(null);
    setActiveBuffs(prev => ({ ...prev, atk: false }));

    // 2. 效果消息
    const effectMessages = [];
    if (damage > 0) {
      if (multiplier > 1) effectMessages.push(t('superEffective'));
      if (multiplier < 1 && multiplier > 0) effectMessages.push(t('notVeryEffective'));
      if (multiplier === 0) effectMessages.push(t('noEffect'));
    }
    
    if (effectMessages.length > 0) {
      await addMessagesSequentially(effectMessages);
    }

    // 3. 伤害消息
    if (damage > 0) {
      await addMessagesSequentially([t('causedDamage').replace('{name}', getLocalized(player)).replace('{damage}', damage.toString())]);
    }
    
    // 4. 处理附加效果 (异常状态和能力变化)
    if (newEnemyHp > 0) {
      const isTargetUser = move.target === 'user';
      const targetPokemon = isTargetUser ? updatedTeam[0] : updatedEnemy;
      const isEnemyTarget = !isTargetUser;

      // 异常状态
      if (move.ailment && !targetPokemon.status && Math.random() * 100 < (move.ailmentChance || 100)) {
        targetPokemon.status = move.ailment;
        if (isEnemyTarget) {
          setEnemy({ ...targetPokemon });
          const newEnemyTeam = [...enemyTeam];
          newEnemyTeam[0] = { ...targetPokemon };
          setEnemyTeam(newEnemyTeam);
        } else {
          updatedTeam[0] = { ...targetPokemon };
          setPlayerTeam([...updatedTeam]);
        }
        await addMessagesSequentially([`${getLocalized(targetPokemon)} ${AILMENT_ZH[move.ailment] || move.ailment}了！`]);
      }
      
      // 能力变化
      if (move.statChanges) {
        const newStatStages = { ...targetPokemon.statStages };
        let changed = false;
        for (const sc of move.statChanges) {
          const statKey = sc.stat as keyof StatStages;
          if (newStatStages[statKey] !== undefined) {
            const oldStage = newStatStages[statKey];
            const newStage = Math.max(-6, Math.min(6, oldStage + sc.change));
            if (newStage !== oldStage) {
              newStatStages[statKey] = newStage;
              changed = true;
              const changeText = sc.change > 0 ? '提升' : '下降';
              const statName = STAT_ZH[sc.stat] || sc.stat;
              await addMessagesSequentially([`${getLocalized(targetPokemon)} 的 ${statName} ${changeText}了！`]);
            }
          }
        }
        if (changed) {
          targetPokemon.statStages = newStatStages;
          if (isEnemyTarget) {
            setEnemy({ ...targetPokemon });
            const newEnemyTeam = [...enemyTeam];
            newEnemyTeam[0] = { ...targetPokemon };
            setEnemyTeam(newEnemyTeam);
          } else {
            updatedTeam[0] = { ...targetPokemon };
            setPlayerTeam([...updatedTeam]);
          }
        }
      }

      // 畏缩 (这里简单处理，直接跳过对手回合)
      if (Math.random() * 100 < (move.flinchChance || 0)) {
        await addMessagesSequentially([`${getLocalized(updatedEnemy)} 畏缩了，无法动弹！`]);
        // 畏缩只持续一回合，这里通过不切换 turn 来实现
        setEnemyAnim('idle');
        return; 
      }
    }

    // 5. 状态回合结束伤害 (中毒, 灼伤)
    if (newEnemyHp > 0 && (updatedEnemy.status === 'poison' || updatedEnemy.status === 'burn')) {
      const statusDamage = Math.floor(updatedEnemy.maxHp / 8);
      const finalEnemyHpStatus = Math.max(0, updatedEnemy.currentHp - statusDamage);
      updatedEnemy.currentHp = finalEnemyHpStatus;
      setEnemy({ ...updatedEnemy });
      await addMessagesSequentially([`${getLocalized(updatedEnemy)} 受到了 ${AILMENT_ZH[updatedEnemy.status]} 伤害！`]);
      
      if (finalEnemyHpStatus <= 0) {
        await addMessagesSequentially([t('fainted').replace('{name}', getLocalized(updatedEnemy))]);
        
        // 检查对手是否还有剩余宝可梦
        const nextEnemyIdx = enemyTeam.findIndex(p => p.currentHp > 0 && p.id !== enemy.id);
        if (nextEnemyIdx !== -1) {
          const nextEnemy = enemyTeam[nextEnemyIdx];
          // 将新宝可梦换到首位
          const newEnemyTeam = [...enemyTeam];
          const temp = newEnemyTeam[0];
          newEnemyTeam[0] = newEnemyTeam[nextEnemyIdx];
          newEnemyTeam[nextEnemyIdx] = temp;
          setEnemyTeam(newEnemyTeam);
          setEnemy(newEnemyTeam[0]);
          await addMessagesSequentially([t('enemySentOut').replace('{name}', getLocalized(newEnemyTeam[0]))]);
          setTurn('PLAYER');
          setBattleMenuTab('MAIN');
        } else {
          setTimeout(() => winBattle(), 500);
        }
        return;
      }
    }

    setEnemyAnim('idle');
    
    if (newEnemyHp <= 0) {
      await addMessagesSequentially([t('fainted').replace('{name}', getLocalized(enemy))]);
      
      // 检查对手是否还有剩余宝可梦
      const nextEnemyIdx = enemyTeam.findIndex(p => p.currentHp > 0 && p.id !== enemy.id);
      if (nextEnemyIdx !== -1) {
        const nextEnemy = enemyTeam[nextEnemyIdx];
        // 将新宝可梦换到首位
        const newEnemyTeam = [...enemyTeam];
        const temp = newEnemyTeam[0];
        newEnemyTeam[0] = newEnemyTeam[nextEnemyIdx];
        newEnemyTeam[nextEnemyIdx] = temp;
        setEnemyTeam(newEnemyTeam);
        setEnemy(newEnemyTeam[0]);
        await addMessagesSequentially([t('enemySentOut').replace('{name}', getLocalized(newEnemyTeam[0]))]);
        setTurn('PLAYER');
        setBattleMenuTab('MAIN');
      } else {
        setTimeout(() => winBattle(), 500);
      }
      return;
    }

    setTurn('ENEMY');
    setBattleMenuTab('MAIN');
  };

  const enemyTurn = useCallback(async () => {
    if (!enemy || !playerTeam[0] || turn !== 'ENEMY' || isMessageProcessing) return;

    const player = playerTeam[0];
    
    // 检查异常状态限制
    if (enemy.status === 'sleep') {
      await addMessagesSequentially([`对手的 ${getLocalized(enemy)} 正在呼呼大睡...`]);
      if (Math.random() < 0.33) {
        setEnemy({ ...enemy, status: undefined });
        await addMessagesSequentially([`对手的 ${getLocalized(enemy)} 醒过来了！`]);
      } else {
        setTurn('PLAYER');
        return;
      }
    }
    if (enemy.status === 'freeze') {
      await addMessagesSequentially([`对手的 ${getLocalized(enemy)} 冻得严严实实...`]);
      if (Math.random() < 0.2) {
        setEnemy({ ...enemy, status: undefined });
        await addMessagesSequentially([`对手的 ${getLocalized(enemy)} 的冰融化了！`]);
      } else {
        setTurn('PLAYER');
        return;
      }
    }
    if (enemy.status === 'paralysis' && Math.random() < 0.25) {
      await addMessagesSequentially([`对手的 ${getLocalized(enemy)} 麻痹了，无法动弹！`]);
      setTurn('PLAYER');
      return;
    }

    const move = enemy.selectedMoves[Math.floor(Math.random() * enemy.selectedMoves.length)];
    setActiveMoveType(move.type);
    setEnemyAnim('attack');
    
    // 1. 对手使用技能
    await addMessagesSequentially([t('enemyUsedMove').replace('{name}', getLocalized(enemy)).replace('{move}', getLocalized(move))]);

    const { damage, multiplier, isMiss, isCrit } = calculateDamage(move, enemy, player, enemyBuffs.atk, activeBuffs.def);
    
    if (isMiss) {
      await addMessagesSequentially([`对手的 ${getLocalized(enemy)} 的攻击落空了！`]);
      setEnemyAnim('idle');
      setActiveMoveType(null);
      setTurn('PLAYER');
      return;
    }

    if (isCrit) {
      await addMessagesSequentially(['击中了要害！']);
    }

    const newPlayerHp = Math.max(0, player.currentHp - damage);
    
    if (damage > 0) {
      setPlayerAnim('hit');
    }
    const updatedTeam = [...playerTeam];
    let updatedPlayer = { ...player, currentHp: newPlayerHp };
    
    // 处理吸血和回血
    let enemyHpChange = 0;
    if (move.drain !== 0 && damage > 0) {
      enemyHpChange += Math.floor(damage * move.drain / 100);
    }
    if (move.healing !== 0) {
      enemyHpChange += Math.floor(enemy.maxHp * move.healing / 100);
    }
    
    const finalEnemyHp = Math.max(0, Math.min(enemy.maxHp, enemy.currentHp + enemyHpChange));
    setEnemy({ ...enemy, currentHp: finalEnemyHp });

    if (enemyHpChange > 0) {
      await addMessagesSequentially([`对手的 ${getLocalized(enemy)} 恢复了体力！`]);
    } else if (enemyHpChange < 0) {
      await addMessagesSequentially([`对手的 ${getLocalized(enemy)} 受到了反作用力伤害！`]);
    }

    // 5. 天气伤害
    if (weather === 'sandstorm' || weather === 'hail') {
      const isRockGroundSteel = (p: GamePokemon) => p.types.some(t => ['rock', 'ground', 'steel'].includes(t.type.name));
      const isIce = (p: GamePokemon) => p.types.some(t => t.type.name === 'ice');
      
      if (weather === 'sandstorm' && !isRockGroundSteel(updatedPlayer) && newPlayerHp > 0) {
        const weatherDmg = Math.floor(updatedPlayer.maxHp / 16);
        updatedPlayer.currentHp = Math.max(0, updatedPlayer.currentHp - weatherDmg);
        await addMessagesSequentially([t('weatherDamage').replace('{name}', getLocalized(updatedPlayer))]);
      } else if (weather === 'hail' && !isIce(updatedPlayer) && newPlayerHp > 0) {
        const weatherDmg = Math.floor(updatedPlayer.maxHp / 16);
        updatedPlayer.currentHp = Math.max(0, updatedPlayer.currentHp - weatherDmg);
        await addMessagesSequentially([t('weatherDamage').replace('{name}', getLocalized(updatedPlayer))]);
      }
    }

    updatedTeam[0] = updatedPlayer;
    setPlayerTeam(updatedTeam);
    setEnemyAnim('idle');
    setActiveMoveType(null);
    setActiveBuffs(prev => ({ ...prev, def: false }));

    // 2. 效果消息
    const effectMessages = [];
    if (damage > 0) {
      if (multiplier > 1) effectMessages.push(t('superEffective'));
      if (multiplier < 1 && multiplier > 0) effectMessages.push(t('notVeryEffective'));
      if (multiplier === 0) effectMessages.push(t('noEffect'));
    }
    
    if (effectMessages.length > 0) {
      await addMessagesSequentially(effectMessages);
    }

    // 3. 伤害消息
    if (damage > 0) {
      await addMessagesSequentially([t('enemyCausedDamage').replace('{name}', getLocalized(enemy)).replace('{damage}', damage.toString())]);
    }

    // 4. 附加效果
    if (newPlayerHp > 0) {
      const isTargetUser = move.target === 'user';
      const targetPokemon = isTargetUser ? { ...enemy, currentHp: finalEnemyHp } : updatedPlayer;
      const isPlayerTarget = !isTargetUser;

      // 异常状态
      if (move.ailment && !targetPokemon.status && Math.random() * 100 < (move.ailmentChance || 100)) {
        targetPokemon.status = move.ailment;
        if (isPlayerTarget) {
          updatedTeam[0] = { ...targetPokemon };
          setPlayerTeam([...updatedTeam]);
        } else {
          setEnemy({ ...targetPokemon });
        }
        await addMessagesSequentially([`${getLocalized(targetPokemon)} ${AILMENT_ZH[move.ailment] || move.ailment}了！`]);
      }
      
      // 能力变化
      if (move.statChanges) {
        const newStatStages = { ...targetPokemon.statStages };
        let changed = false;
        for (const sc of move.statChanges) {
          const statKey = sc.stat as keyof StatStages;
          if (newStatStages[statKey] !== undefined) {
            const oldStage = newStatStages[statKey];
            const newStage = Math.max(-6, Math.min(6, oldStage + sc.change));
            if (newStage !== oldStage) {
              newStatStages[statKey] = newStage;
              changed = true;
              const changeText = sc.change > 0 ? '提升' : '下降';
              const statName = STAT_ZH[sc.stat] || sc.stat;
              await addMessagesSequentially([`${getLocalized(targetPokemon)} 的 ${statName} ${changeText}了！`]);
            }
          }
        }
        if (changed) {
          targetPokemon.statStages = newStatStages;
          if (isPlayerTarget) {
            updatedTeam[0] = { ...targetPokemon };
            setPlayerTeam([...updatedTeam]);
          } else {
            setEnemy({ ...targetPokemon });
          }
        }
      }

      // 畏缩
      if (Math.random() * 100 < (move.flinchChance || 0)) {
        await addMessagesSequentially([`${getLocalized(updatedPlayer)} 畏缩了，无法动弹！`]);
        setPlayerAnim('idle');
        return;
      }
    }

    // 5. 状态回合结束伤害
    if (updatedPlayer.currentHp > 0 && (updatedPlayer.status === 'poison' || updatedPlayer.status === 'burn')) {
      const statusDamage = Math.floor(updatedPlayer.maxHp / 8);
      const finalPlayerHpStatus = Math.max(0, updatedPlayer.currentHp - statusDamage);
      updatedPlayer.currentHp = finalPlayerHpStatus;
      updatedTeam[0] = { ...updatedPlayer };
      setPlayerTeam([...updatedTeam]);
      await addMessagesSequentially([`${getLocalized(updatedPlayer)} 受到了 ${AILMENT_ZH[updatedPlayer.status]} 伤害！`]);
      
      if (finalPlayerHpStatus <= 0) {
        await addMessagesSequentially([t('fainted').replace('{name}', getLocalized(updatedPlayer))]);
        
        const aliveIdx = updatedTeam.findIndex(p => p.currentHp > 0);
        if (aliveIdx === -1) {
          setTimeout(() => setGameState('GAMEOVER'), 500);
        } else {
          const newTeam = [...updatedTeam];
          const temp = newTeam[0];
          newTeam[0] = newTeam[aliveIdx];
          newTeam[aliveIdx] = temp;
          setPlayerTeam(newTeam);
          await addMessagesSequentially([t('playerSentOut').replace('{name}', getLocalized(newTeam[0]))]);
          setTurn('PLAYER');
          setBattleMenuTab('MAIN');
        }
        return;
      }
    }

    setPlayerAnim('idle');
    
    if (newPlayerHp <= 0) {
      await addMessagesSequentially([t('fainted').replace('{name}', getLocalized(player))]);
      
      const aliveIdx = updatedTeam.findIndex(p => p.currentHp > 0);
      if (aliveIdx === -1) {
        setTimeout(() => setGameState('GAMEOVER'), 500);
      } else {
        // 自动切换
        const newTeam = [...updatedTeam];
        // 将活着的宝可梦换到首位
        const alivePoke = newTeam.splice(aliveIdx, 1)[0];
        newTeam.unshift(alivePoke);
        
        setPlayerTeam(newTeam);
        await addMessagesSequentially([t('playerSentOut').replace('{name}', getLocalized(newTeam[0]))]);
        setTurn('PLAYER');
        setBattleMenuTab('MAIN');
      }
      return;
    }

    setTurn('PLAYER');
    setBattleMenuTab('MAIN');
  }, [enemy, playerTeam, turn, enemyBuffs, activeBuffs, isMessageProcessing, gameState]);

  useEffect(() => {
    if (turn === 'ENEMY' && gameState === 'BATTLE') {
      enemyTurn();
    }
  }, [turn, gameState, enemyTurn]);

  const calculateDamage = (move: Move, attacker: GamePokemon, defender: GamePokemon, atkBuff: boolean, defBuff: boolean) => {
    if (move.damage_class === 'status') {
      return { damage: 0, multiplier: 1, isMiss: false, isCrit: false };
    }

    const basePower = move.power || 40;
    const levelMult = (2 * attacker.level / 5) + 2;
    
    let atk = 50;
    let def = 50;
    
    if (move.damage_class === 'special') {
      atk = attacker.calculatedStats.spAtk * (STAT_STAGE_MODIFIERS[attacker.statStages.spAtk as keyof typeof STAT_STAGE_MODIFIERS] || 1);
      def = defender.calculatedStats.spDef * (STAT_STAGE_MODIFIERS[defender.statStages.spDef as keyof typeof STAT_STAGE_MODIFIERS] || 1);
    } else {
      atk = attacker.calculatedStats.attack * (STAT_STAGE_MODIFIERS[attacker.statStages.attack as keyof typeof STAT_STAGE_MODIFIERS] || 1);
      def = defender.calculatedStats.defense * (STAT_STAGE_MODIFIERS[defender.statStages.defense as keyof typeof STAT_STAGE_MODIFIERS] || 1);
    }
    
    // 异常状态影响
    if (attacker.status === 'burn' && move.damage_class === 'physical') {
      atk *= 0.5;
    }
    if (attacker.status === 'paralysis') {
      // 速度减半在先手判断中处理，这里不影响伤害
    }

    // 属性克制
    let multiplier = 1;
    defender.types.forEach(t => {
      const typeMult = TYPE_CHART[move.type]?.[t.type.name];
      if (typeMult !== undefined) {
        multiplier *= typeMult;
      }
    });

    // 天气影响
    if (weather === 'sunny') {
      if (move.type === 'fire') multiplier *= 1.5;
      if (move.type === 'water') multiplier *= 0.5;
    } else if (weather === 'rainy') {
      if (move.type === 'water') multiplier *= 1.5;
      if (move.type === 'fire') multiplier *= 0.5;
    }

    // 命中判断
    const accStage = attacker.statStages.accuracy;
    const evaStage = defender.statStages.evasion;
    const combinedStage = Math.max(-6, Math.min(6, accStage - evaStage));
    const accuracyMod = ACC_EVA_STAGE_MODIFIERS[combinedStage as keyof typeof ACC_EVA_STAGE_MODIFIERS] || 1;
    const finalAccuracy = (move.accuracy || 100) * accuracyMod;
    
    if (Math.random() * 100 > finalAccuracy && move.accuracy !== null) {
      return { damage: 0, multiplier: 0, isMiss: true, isCrit: false };
    }

    // 会心一击判断
    let critChance = 1/24;
    if (move.critRate === 1) critChance = 1/8;
    if (move.critRate === 2) critChance = 1/2;
    if (move.critRate >= 3) critChance = 1;
    
    const isCrit = Math.random() < critChance;
    const critMult = isCrit ? 1.5 : 1;

    let damage = Math.floor((((levelMult * basePower * atk / def) / 50) + 2) * (Math.random() * 0.15 + 0.85) * multiplier * critMult);
    
    if (atkBuff) damage = Math.floor(damage * 1.5);
    if (defBuff) damage = Math.floor(damage * 0.7);
    
    return { damage, multiplier, isMiss: false, isCrit };
  };

  const generateRewardSet = async () => {
    const newRewards = [];
    const usedPokemonIds = new Set();
    const usedItems = new Set();

    // 3 Free Rewards (Adventure Rewards)
    // Increase POKEMON probability slightly to allow multiple choices more often
    const freeTypes: ('ITEM' | 'POKEMON' | 'MOVE' | 'EVOLUTION')[] = ['ITEM', 'POKEMON', 'POKEMON', 'MOVE', 'EVOLUTION'];
    
    for (let i = 0; i < 3; i++) {
      let type = freeTypes[Math.floor(Math.random() * freeTypes.length)];
      
      if (type === 'ITEM') {
        let item;
        let attempts = 0;
        do {
          item = ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)];
          attempts++;
        } while (usedItems.has(item.id) && attempts < 10);
        usedItems.add(item.id);
        newRewards.push({ type, data: item });
      } else if (type === 'POKEMON') {
        let pokeId;
        let attempts = 0;
        do {
          pokeId = await getRandomPokemonId(selectedGens);
          attempts++;
        } while (usedPokemonIds.has(pokeId) && attempts < 10);
        usedPokemonIds.add(pokeId);
        const newPoke = await getProcessedPokemon(pokeId, startLevel);
        newRewards.push({ type, data: newPoke });
      } else if (type === 'MOVE') {
        newRewards.push({ type, data: null });
      } else if (type === 'EVOLUTION') {
        newRewards.push({ type, data: null });
      }
    }
    
    // 3 Shop Items (Mystery Shop)
    for (let i = 0; i < 3; i++) {
      let item;
      let attempts = 0;
      do {
        item = ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)];
        attempts++;
      } while (usedItems.has(item.id) && attempts < 10);
      usedItems.add(item.id);
      
      newRewards.push({ 
        type: 'SHOP_ITEM', 
        data: { 
          item, 
          price: 50 + Math.floor(Math.random() * 151) 
        } 
      });
    }
    return newRewards;
  };

  const rerollRewards = async () => {
    const cost = 50 + rerollCount * 50; // Increasing cost: 50, 100, 150...
    if (coins < cost) return;
    
    setLoading(true);
    try {
      setCoins(prev => prev - cost);
      setRerollCount(prev => prev + 1);
      const newRewards = await generateRewardSet();
      setRewards(newRewards);
      setRewardChoiceMade(false); // Allow picking a new free reward
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const winBattle = async (isCatch = false) => {
    setLoading(true);
    try {
      const currentStreak = streak + 1;
      setStreak(currentStreak);
      
      // 对战工厂：胜利后可以进行交换
      setGameState('FACTORY_SWAP');
      
      const winMsg = `战斗胜利！当前的连胜纪录：${currentStreak}`;
      await addMessagesSequentially([winMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectReward = (reward: any) => {
    if (reward.type === 'SHOP_ITEM') {
      if (coins < reward.data.price) return;
      setCoins(prev => prev - reward.data.price);
      setInventory(prev => [...prev, reward.data.item]);
      // Remove this item from the rewards list so it can't be bought again
      setRewards(prev => prev.filter(r => r !== reward));
      return;
    }

    if (rewardChoiceMade) return;
    
    if (reward.type === 'ITEM') {
      setRewardChoiceMade(true);
      setInventory(prev => [...prev, reward.data]);
    } else if (reward.type === 'POKEMON') {
      if (playerTeam.length < 6) {
        setRewardChoiceMade(true);
        setPlayerTeam(prev => [...prev, reward.data]);
      } else {
        setShowReplaceUI(reward.data);
      }
    } else if (reward.type === 'MOVE') {
      setRewardChoiceMade(true);
      setPendingRewardAction('MOVE');
      setLearningPokemonIdx(null);
      setPotentialMoves([]);
      setSelectedNewMove(null);
    } else if (reward.type === 'EVOLUTION') {
      setRewardChoiceMade(true);
      setPendingRewardAction('EVOLUTION');
      setSelectedPokemonForEvolution(null);
      setEvolutionChoices([]);
    }
  };

  const startEvolution = async (pokemon: GamePokemon, index: number) => {
    setLoading(true);
    try {
      const nextEvolutionIds = await fetchEvolutionChain(pokemon.id);
      if (nextEvolutionIds.length === 0) {
        await addMessagesSequentially([t('cannotEvolve')]);
        return;
      }
      
      // Fetch full data for each choice
      const choices = await Promise.all(nextEvolutionIds.map(id => fetchPokemon(id)));
      
      setSelectedPokemonForEvolution({ pokemon, index });
      setEvolutionChoices(choices);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const performEvolution = async (evolvedId: number) => {
    if (!selectedPokemonForEvolution) return;
    const { pokemon, index } = selectedPokemonForEvolution;
    setLoading(true);
    try {
      const evolved = await getProcessedPokemon(evolvedId, pokemon.level);
      
      // Keep current HP percentage
      const hpPercent = pokemon.currentHp / pokemon.maxHp;
      evolved.currentHp = Math.floor(evolved.maxHp * hpPercent);
      
      setEvolutionTarget(pokemon);
      setEvolvedPokemon(evolved);
      setIsEvolving(true);
      
      // Animation sequence
      setTimeout(() => {
        setPlayerTeam(prev => {
          const newTeam = [...prev];
          newTeam[index] = evolved;
          return newTeam;
        });
        setTimeout(() => {
          setIsEvolving(false);
          finishReward();
        }, 3000);
      }, 4000);
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const nextStage = () => {
    healAllPokemon();
    setStage(prev => prev + 1);
    startBattleTransition();
    spawnEnemy(stage + 1);
  };

  const startLearningMove = async (idx: number) => {
    setLoading(true);
    setLearningPokemonIdx(idx);
    try {
      const moves = await getLearnableMoves(playerTeam[idx], playerTeam[idx].selectedMoves);
      setPotentialMoves(moves);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLearnMove = (move: Move) => {
    if (learningPokemonIdx === null) return;
    const pokemon = playerTeam[learningPokemonIdx];
    
    if (pokemon.selectedMoves.length < 4) {
      const newTeam = [...playerTeam];
      newTeam[learningPokemonIdx] = {
        ...pokemon,
        selectedMoves: [...pokemon.selectedMoves, move]
      };
      setPlayerTeam(newTeam);
      finishReward();
    } else {
      setSelectedNewMove(move);
    }
  };

  const replaceMove = (oldMoveIdx: number) => {
    if (learningPokemonIdx === null || !selectedNewMove) return;
    const newTeam = [...playerTeam];
    const pokemon = { ...newTeam[learningPokemonIdx] };
    const newMoves = [...pokemon.selectedMoves];
    newMoves[oldMoveIdx] = selectedNewMove;
    pokemon.selectedMoves = newMoves;
    newTeam[learningPokemonIdx] = pokemon;
    setPlayerTeam(newTeam);
    finishReward();
  };

  const finishReward = () => {
    setGameState('REWARD');
    setPendingRewardAction(null);
    setLearningPokemonIdx(null);
    setPotentialMoves([]);
    setSelectedNewMove(null);
    setSelectedPokemonForEvolution(null);
    setEvolutionChoices([]);
  };

  const replacePokemon = (index: number) => {
    if (!showReplaceUI) return;
    const newTeam = [...playerTeam];
    newTeam[index] = showReplaceUI;
    setPlayerTeam(newTeam);
    setShowReplaceUI(null);
    setRewardChoiceMade(true);
  };

  if (loading && gameState === 'START') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-900 font-sans">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <RefreshCw className="animate-spin w-16 h-16 text-blue-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Target className="w-6 h-6 text-red-500" />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tighter uppercase italic">{t('searchingPokemon')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[#f0f0f0] text-slate-900 font-sans overflow-hidden select-none">
      {/* 剑盾风格背景装饰 */}
      <div className="fixed inset-0 pointer-events-none opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,#00a0e9_25%,transparent_25%,transparent_50%,#00a0e9_50%,#00a0e9_75%,transparent_75%,transparent)] bg-[length:100px_100px] animate-barber-pole"></div>
      </div>

      <div className="max-w-6xl mx-auto h-full flex flex-col p-2 md:p-4 relative z-10 overflow-hidden">
        
        {/* 顶部状态栏 */}
        <header className="flex justify-between items-center flex-none mb-4 relative z-50">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 px-6 py-2 skew-x-[-12deg] shadow-xl border-l-4 border-blue-500">
              <h1 className="text-xl font-black italic tracking-tighter skew-x-[12deg] text-white uppercase">PokeFactory</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 语言切换器 */}
            <div className="relative">
              <button 
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="bg-white px-4 py-1.5 skew-x-[-12deg] shadow-sm border border-slate-200 hover:border-blue-500 transition-all group flex items-center gap-2 pointer-events-auto"
              >
                <div className="skew-x-[12deg] flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                    {SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage)?.name}
                  </span>
                </div>
              </button>
              
              <AnimatePresence>
                {showLangMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-40 bg-white shadow-2xl border-4 border-slate-900 overflow-hidden z-[100] pointer-events-auto"
                  >
                    <div className="p-1 grid grid-cols-1">
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setCurrentLanguage(lang.code);
                            setShowLangMenu(false);
                          }}
                          className={`px-4 py-2 text-left text-[10px] font-black italic uppercase transition-all ${
                            currentLanguage === lang.code 
                              ? 'bg-slate-900 text-white' 
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {lang.name}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {gameState !== 'START' && (
              <>
                <div className="bg-white px-4 py-1.5 skew-x-[-12deg] shadow-sm border-r-4 border-yellow-500">
                  <span className="font-black italic skew-x-[12deg] inline-block flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-yellow-500" /> {coins}
                  </span>
                </div>
                <div className="bg-white px-4 py-1.5 skew-x-[-12deg] shadow-sm border-r-4 border-red-500">
                  <span className="font-black italic skew-x-[12deg] inline-block text-sm uppercase tracking-widest">
                    {currentLanguage.startsWith('zh') ? '关卡' : 'Stage'} {stage}
                  </span>
                </div>
              </>
            )}

            {gameState === 'BATTLE' && (
              <button 
                onClick={() => setShowLogHistory(!showLogHistory)}
                className={`p-2 skew-x-[-12deg] transition-all shadow-sm border pointer-events-auto ${showLogHistory ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-slate-200 hover:border-slate-900'}`}
                title={t('battleHistory')}
              >
                <RefreshCw className={`w-4 h-4 skew-x-[12deg] ${showLogHistory ? 'rotate-180' : ''} transition-transform duration-500`} />
              </button>
            )}
          </div>
        </header>

        {/* 对战历史悬浮窗 */}
        <AnimatePresence>
          {showLogHistory && gameState === 'BATTLE' && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-20 right-4 z-[60] w-80 bg-white shadow-2xl border-4 border-slate-900 p-4 max-h-[400px] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                <h3 className="font-black italic text-sm uppercase tracking-widest text-slate-400">对战历史</h3>
                <button onClick={() => setShowLogHistory(false)} className="text-slate-400 hover:text-slate-900"><Skull className="w-4 h-4" /></button>
              </div>
              <div className="space-y-2">
                {battleLog.slice().reverse().map((log, i) => (
                  <div key={i} className={`text-xs font-bold italic ${i === 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                    {i === 0 ? '> ' : ''}{log}
                  </div>
                ))}
                {battleLog.length === 0 && <div className="text-center py-8 text-slate-300 italic">尚无记录</div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {isTransitioning && (
            <motion.div 
              key="transition-overlay"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 1.2 }}
              className="fixed inset-0 z-[100] flex flex-col pointer-events-none"
            >
              {/* 上半部分 (红色) */}
              <motion.div 
                initial={{ y: '-100%' }}
                animate={{ y: '0%' }}
                exit={{ y: '-100%' }}
                transition={{ 
                  duration: 0.6, 
                  ease: 'circOut',
                  exit: { duration: 1.2, ease: [0.45, 0, 0.55, 1] } 
                }}
                className="flex-1 bg-red-600 border-b-[12px] border-slate-900 relative"
              >
                {/* 精灵球中心按钮 */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-40 h-40 bg-white rounded-full border-[12px] border-slate-900 z-10 flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.3)]">
                  <div className="w-16 h-16 rounded-full border-[8px] border-slate-100 bg-white shadow-inner"></div>
                </div>
              </motion.div>

              {/* 下半部分 (白色) */}
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: '0%' }}
                exit={{ y: '100%' }}
                transition={{ 
                  duration: 0.6, 
                  ease: 'circOut',
                  exit: { duration: 1.2, ease: [0.45, 0, 0.55, 1] } 
                }}
                className="flex-1 bg-white border-t-[12px] border-slate-900"
              ></motion.div>
            </motion.div>
          )}

          {gameState === 'START' && (
            <motion.div 
              key="start"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, x: -100 }}
              className="flex-1 flex flex-col items-center justify-center py-4 text-center overflow-y-auto custom-scrollbar"
            >
              {startStep === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center"
                >
                  <div className="relative mb-6">
                    <div className="w-48 h-48 bg-white rounded-full shadow-2xl flex items-center justify-center relative overflow-hidden border-8 border-slate-100">
                      <Dna className="w-24 h-24 text-blue-500 relative z-10" />
                      <div className="absolute top-0 left-0 w-full h-1/2 bg-red-500 opacity-10"></div>
                    </div>
                    <div className="absolute -bottom-4 -right-4 bg-red-500 text-white p-4 rounded-full shadow-lg">
                      <Sword className="w-8 h-8" />
                    </div>
                  </div>
                  <h2 className="text-4xl sm:text-6xl font-black mb-6 tracking-tighter italic text-slate-900 uppercase">PokeFactory</h2>
                  <p className="text-slate-500 max-w-md mb-12 text-base sm:text-lg font-medium italic px-4">
                    {t('rogueJourney')}
                  </p>
                  <button 
                    onClick={() => setStartStep(1)}
                    className="group relative px-10 sm:px-16 py-4 sm:py-6 bg-slate-900 text-white rounded-none skew-x-[-12deg] font-black text-xl sm:text-3xl transition-all hover:bg-blue-600 hover:scale-105 active:scale-95 shadow-[12px_12px_0px_#00000022]"
                  >
                    <span className="flex items-center gap-3 skew-x-[12deg]">
                      开始对战 <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" />
                    </span>
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="w-full max-w-3xl"
                >
                  <div className="mb-8 flex items-center justify-between">
                    <button onClick={() => setStartStep(prev => prev - 1)} className="text-slate-400 font-black italic hover:text-slate-900 flex items-center gap-2">
                      <ChevronRight className="w-5 h-5 rotate-180" /> 返回
                    </button>
                    <div className="flex gap-2">
                      {[1, 2].map(i => (
                        <div key={i} className={`w-3 h-3 rounded-full ${startStep >= i ? 'bg-blue-500' : 'bg-slate-200'}`} />
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-6 md:p-10 shadow-2xl border-b-8 border-slate-900 mb-6 md:mb-12">
                    {startStep === 1 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h3 className="text-xl md:text-2xl font-black italic mb-6 md:mb-8 uppercase tracking-tighter flex items-center gap-3">
                          <Dna className="w-5 h-5 md:w-6 md:h-6 text-blue-500" /> 选择你的冒险地区
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                          {GENERATIONS.map((gen) => (
                            <button
                              key={gen.id}
                              onClick={() => {
                                setSelectedGens(prev => 
                                  prev.includes(gen.id) 
                                    ? (prev.length > 1 ? prev.filter(id => id !== gen.id) : prev)
                                    : [...prev, gen.id]
                                );
                              }}
                              className={`p-3 md:p-4 border-2 md:border-4 skew-x-[-4deg] transition-all relative overflow-hidden group ${
                                selectedGens.includes(gen.id)
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105'
                                  : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                              }`}
                            >
                              <div className="skew-x-[4deg] relative z-10">
                                <div className="font-black text-base md:text-lg italic">{gen.name}</div>
                                <div className="text-[8px] md:text-[10px] font-bold opacity-60 uppercase tracking-widest">{gen.region}</div>
                              </div>
                              {selectedGens.includes(gen.id) && (
                                <div className="absolute top-0 right-0 w-6 h-6 md:w-8 md:h-8 bg-blue-500 flex items-center justify-center skew-x-[4deg] -translate-y-1 md:-translate-y-2 translate-x-1 md:translate-x-2">
                                  <Sparkles className="w-2 h-2 md:w-3 md:h-3 text-white" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                        <button 
                          onClick={() => setStartStep(2)}
                          className="mt-8 md:mt-12 w-full py-4 md:py-5 bg-blue-600 text-white font-black text-lg md:text-xl italic skew-x-[-10deg] hover:bg-blue-700 transition-all shadow-lg"
                        >
                          <span className="skew-x-[10deg] inline-block">下一步：选择等级</span>
                        </button>
                      </motion.div>
                    )}

                    {startStep === 2 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h3 className="text-xl md:text-2xl font-black italic mb-6 md:mb-8 uppercase tracking-tighter flex items-center gap-3">
                          <Zap className="w-5 h-5 md:w-6 md:h-6 text-yellow-500" /> 设定初始挑战难度
                        </h3>
                        <div className="flex flex-col sm:flex-row justify-center gap-4 md:gap-6">
                          {[30, 50].map((lv) => (
                            <button
                              key={lv}
                              onClick={() => setStartLevel(lv)}
                              className={`flex-1 py-6 md:py-8 px-8 md:px-10 text-3xl md:text-4xl font-black italic transition-all skew-x-[-10deg] border-2 md:border-4 ${
                                startLevel === lv
                                  ? 'bg-yellow-400 text-white border-yellow-400 shadow-2xl scale-105'
                                  : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                              }`}
                            >
                              <div className="skew-x-[10deg]">
                                <div className="text-[10px] md:text-sm uppercase opacity-60 mb-1 md:mb-2">Level</div>
                                <div>{lv}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                        <button 
                          onClick={startGame}
                          disabled={loading}
                          className="mt-8 md:mt-12 w-full py-5 md:py-6 bg-slate-900 text-white font-black text-xl md:text-2xl italic skew-x-[-10deg] hover:bg-red-600 transition-all shadow-xl disabled:opacity-50"
                        >
                          <span className="skew-x-[10deg] inline-block flex items-center justify-center gap-3">
                            {loading ? <RefreshCw className="animate-spin w-5 h-5 md:w-6 md:h-6" /> : '开启冒险之旅'}
                          </span>
                        </button>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {gameState === 'BATTLE' && playerTeam[0] && enemy && (
            <motion.div 
              key="battle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col gap-4 min-h-0"
            >
              {/* 战斗场景 */}
              <div className="relative flex-[6] bg-white rounded-none skew-x-[-1deg] shadow-2xl overflow-hidden border-y-8 border-slate-900 min-h-0">
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#e0e0e0,#ffffff)]"></div>
                <div className="absolute bottom-0 left-0 w-full h-1/3 bg-slate-100 skew-y-[-2deg] origin-left"></div>
                
                {/* 敌人 */}
                <div className="absolute top-4 sm:top-8 right-4 sm:right-12 flex flex-col items-end">
                  <div className="bg-white p-2 sm:p-3 shadow-lg border-r-8 border-red-500 w-48 sm:w-72 skew-x-[-10deg] mb-2 sm:mb-4">
                    <div className="skew-x-[10deg] flex flex-col gap-0.5 sm:gap-1">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className="font-black text-sm sm:text-xl italic uppercase truncate max-w-[80px] sm:max-w-none">{getLocalized(enemy)}</span>
                          {enemy.status && (
                            <span className="bg-slate-900 text-white text-[6px] sm:text-[8px] px-1 py-0.5 font-black uppercase tracking-tighter">
                              {AILMENT_ZH[enemy.status] || enemy.status}
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] sm:text-xs font-bold bg-slate-900 text-white px-1.5 sm:px-2 py-0.5">Lv.{enemy.level}</span>
                      </div>
                      <div className="flex gap-1 mb-0.5 sm:mb-1">
                        {enemy.types.map(t => (
                          <TypeBadge key={t.type.name} type={t.type.name} size="xs" />
                        ))}
                      </div>
                      <div className="h-1.5 sm:h-2 bg-slate-200 rounded-none relative overflow-hidden border border-slate-300">
                        <motion.div 
                          animate={{ width: `${(enemy.currentHp / enemy.maxHp) * 100}%` }}
                          className={`h-full transition-colors ${enemy.currentHp / enemy.maxHp < 0.2 ? 'bg-red-500' : enemy.currentHp / enemy.maxHp < 0.5 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                        />
                      </div>
                      <div className="text-right text-[8px] sm:text-[10px] font-black italic text-slate-300">
                        ??? / ???
                      </div>
                    </div>
                  </div>
                  <motion.img 
                    animate={isCatching ? { scale: 0, opacity: 0 } : enemyAnim === 'attack' ? { x: -40, scale: 1, opacity: 1 } : enemyAnim === 'hit' ? { x: [0, 10, -10, 10, 0], opacity: [1, 0.5, 1], scale: 1 } : { y: [0, -5, 0], scale: 1, opacity: 1 }}
                    transition={isCatching ? { duration: 0.5 } : enemyAnim === 'idle' ? { y: { repeat: Infinity, duration: 2 }, scale: { duration: 0.3 }, opacity: { duration: 0.3 } } : { duration: 0.3 }}
                    src={enemy.sprites.front_default} 
                    className="w-32 h-32 sm:w-48 sm:h-48 object-contain drop-shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* 玩家 */}
                <div className="absolute bottom-2 sm:bottom-4 left-4 sm:left-12 flex flex-col items-start">
                  <motion.img 
                    animate={playerAnim === 'attack' ? { x: 40 } : playerAnim === 'hit' ? { x: [0, -10, 10, -10, 0], opacity: [1, 0.5, 1] } : { y: [0, 5, 0] }}
                    transition={playerAnim === 'idle' ? { repeat: Infinity, duration: 2 } : { duration: 0.3 }}
                    src={playerTeam[0].sprites.back_default || playerTeam[0].sprites.front_default} 
                    className="w-40 h-40 sm:w-64 sm:h-64 object-contain drop-shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                  <div className="bg-white p-2 sm:p-3 shadow-lg border-l-8 border-blue-500 w-48 sm:w-72 skew-x-[-10deg] mt-[-20px] sm:mt-[-40px] relative z-20">
                    <div className="skew-x-[10deg] flex flex-col gap-0.5 sm:gap-1">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className="font-black text-sm sm:text-xl italic uppercase truncate max-w-[80px] sm:max-w-none">{getLocalized(playerTeam[0])}</span>
                          {playerTeam[0].status && (
                            <span className="bg-slate-900 text-white text-[6px] sm:text-[8px] px-1 py-0.5 font-black uppercase tracking-tighter">
                              {AILMENT_ZH[playerTeam[0].status] || playerTeam[0].status}
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] sm:text-xs font-bold bg-slate-900 text-white px-1.5 sm:px-2 py-0.5">Lv.{playerTeam[0].level}</span>
                      </div>
                      <div className="flex gap-1 mb-0.5 sm:mb-1">
                        {playerTeam[0].types.map(t => (
                          <TypeBadge key={t.type.name} type={t.type.name} size="xs" />
                        ))}
                      </div>
                      <div className="h-1.5 sm:h-2 bg-slate-200 rounded-none relative overflow-hidden border border-slate-300">
                        <motion.div 
                          animate={{ width: `${(playerTeam[0].currentHp / playerTeam[0].maxHp) * 100}%` }}
                          className={`h-full transition-colors ${playerTeam[0].currentHp / playerTeam[0].maxHp < 0.2 ? 'bg-red-500' : playerTeam[0].currentHp / playerTeam[0].maxHp < 0.5 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                        />
                      </div>
                      <div className="text-right text-[8px] sm:text-[10px] font-black italic">
                        {playerTeam[0].currentHp} / {playerTeam[0].maxHp}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 特效层 */}
                <AnimatePresence>
                  {(playerAnim === 'attack' || enemyAnim === 'attack') && activeMoveType && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                      animate={{ opacity: 1, scale: 1.5, rotate: 0 }}
                      exit={{ opacity: 0, scale: 2 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
                    >
                      {(() => {
                        const Icon = TYPE_ICONS[activeMoveType] || Sparkles;
                        return (
                          <div className="relative">
                            <motion.div
                              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                              transition={{ repeat: Infinity, duration: 0.5 }}
                              className="absolute inset-0 blur-xl rounded-full"
                              style={{ backgroundColor: TYPE_COLORS[activeMoveType] }}
                            />
                            <Icon 
                              className="w-20 h-20 sm:w-32 h-32 relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" 
                              style={{ color: TYPE_COLORS[activeMoveType] }} 
                            />
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 捕捉动画 */}
                <AnimatePresence>
                  {isCatching && (
                    <motion.div
                      initial={{ x: -400, y: 200, opacity: 0, scale: 0.5, rotate: -360 }}
                      animate={{ 
                        x: 0, 
                        y: 0, 
                        opacity: 1, 
                        scale: 1, 
                        rotate: 0,
                      }}
                      exit={{ opacity: 0, scale: 1.2 }}
                      className="absolute top-32 sm:top-48 right-12 sm:right-24 z-50 flex flex-col items-center"
                    >
                      {/* 精灵球本体 */}
                      {!(catchSuccess === false && battleLog[battleLog.length-1]?.includes('挣脱')) && (
                        <motion.div 
                          animate={catchSuccess === false ? { 
                            rotate: [0, -15, 15, -15, 15, 0],
                            x: [0, -5, 5, -5, 5, 0]
                          } : {}}
                          transition={{ 
                            repeat: Infinity, 
                            duration: 0.5,
                            repeatDelay: 1
                          }}
                          className="relative w-16 h-16 sm:w-24 sm:h-24 rounded-full border-4 border-slate-900 overflow-hidden bg-white shadow-2xl"
                        >
                          <div className="absolute top-0 left-0 w-full h-1/2 bg-red-500 border-b-4 border-slate-900"></div>
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white border-4 border-slate-900 z-10">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-slate-200"></div>
                          </div>
                          {/* 成功捕获的高光 */}
                          {catchSuccess === true && (
                            <motion.div 
                              animate={{ opacity: [0.2, 0.5, 0.2] }}
                              transition={{ repeat: Infinity, duration: 2 }}
                              className="absolute inset-0 bg-yellow-400/20"
                            />
                          )}
                        </motion.div>
                      )}
                      
                      {/* 成功捕获的星星特效 */}
                      {catchSuccess === true && battleLog[battleLog.length-1]?.includes('成功捕捉') && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {[...Array(8)].map((_, i) => (
                            <motion.div
                              key={i}
                              initial={{ scale: 0, x: 0, y: 0 }}
                              animate={{ 
                                scale: [0, 1, 0], 
                                x: Math.cos(i * Math.PI / 4) * 60, 
                                y: Math.sin(i * Math.PI / 4) * 60,
                                rotate: 360
                              }}
                              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                              className="absolute"
                            >
                              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]" />
                            </motion.div>
                          ))}
                        </div>
                      )}
                      
                      {/* 气泡炸开特效 */}
                      {catchSuccess === false && battleLog[battleLog.length-1]?.includes('挣脱') && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {[...Array(16)].map((_, i) => (
                            <motion.div
                              key={i}
                              initial={{ scale: 0, x: 0, y: 0 }}
                              animate={{ 
                                scale: [0, 1.5, 0], 
                                x: (Math.random() - 0.5) * 200, 
                                y: (Math.random() - 0.5) * 200 
                              }}
                              transition={{ 
                                duration: 0.8, 
                                ease: "easeOut", 
                                delay: i * 0.01 
                              }}
                              className="absolute w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-blue-200/40 border border-white/50 shadow-sm backdrop-blur-[2px]"
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 统一操作与消息区域 */}
              <div className="relative flex-[4] bg-white shadow-2xl border-4 sm:border-8 border-slate-900 overflow-hidden">
                <AnimatePresence mode="wait">
                  {(isMessageProcessing || turn === 'ENEMY') ? (
                    <motion.div 
                      key="battle-log-box"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-slate-900 text-white p-4 sm:p-6 flex items-center relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1 sm:h-2 bg-blue-500"></div>
                      <div className="absolute bottom-0 left-0 w-full h-1 sm:h-2 bg-red-500"></div>
                      <AnimatePresence mode="wait">
                        {battleLog.length > 0 && (
                          <motion.div
                            key={battleLog.length}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="w-full"
                          >
                            <p className="text-lg sm:text-2xl font-black italic tracking-tight leading-tight">
                              {turn === 'ENEMY' && !isMessageProcessing ? '对手正在思考...' : battleLog[battleLog.length - 1]}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <motion.div 
                        animate={{ x: [0, 5, 0] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="absolute bottom-2 sm:bottom-4 right-4 sm:right-8"
                      >
                        <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
                      </motion.div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="interaction-panel"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-white grid grid-cols-1 md:grid-cols-4 gap-0 overflow-y-auto custom-scrollbar"
                    >
                      {/* 消息提示区 (左侧) */}
                      <div className="md:col-span-2 p-4 sm:p-6 border-b-4 md:border-b-0 md:border-r-4 border-slate-900 flex flex-col justify-center bg-slate-50">
                        <div className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">指令阶段</div>
                        <div className="text-xl sm:text-3xl font-black italic tracking-tighter text-slate-900">
                          该怎么办呢？
                        </div>
                        <div className="mt-2 sm:mt-4 flex flex-wrap gap-2">
                          {activeBuffs.atk && <span className="bg-red-500 text-white text-[6px] sm:text-[8px] px-2 py-0.5 font-black skew-x-[-10deg]"><span className="skew-x-[10deg] inline-block">攻击↑</span></span>}
                          {activeBuffs.def && <span className="bg-blue-500 text-white text-[6px] sm:text-[8px] px-2 py-0.5 font-black skew-x-[-10deg]"><span className="skew-x-[10deg] inline-block">防御↑</span></span>}
                        </div>
                      </div>

                      {/* 操作按钮区 (右侧) */}
                      <div className="md:col-span-2 p-2 sm:p-3 bg-white relative">
                        <AnimatePresence mode="wait">
                          {turn === 'PLAYER' && battleMenuTab === 'MAIN' && (
                            <motion.div 
                              key="main-menu"
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              className="grid grid-cols-2 gap-2 sm:gap-3 h-full"
                            >
                              <button 
                                onClick={() => setBattleMenuTab('MOVES')}
                                className="group relative bg-red-500 text-white p-2 sm:p-3 font-black italic text-base sm:text-xl skew-x-[-10deg] hover:bg-red-600 transition-all overflow-hidden"
                              >
                                <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
                                <span className="relative z-10 skew-x-[10deg] flex items-center justify-center gap-2"><Sword className="w-4 h-4 sm:w-5 sm:h-5" /> 战斗</span>
                              </button>
                              <button 
                                onClick={() => setBattleMenuTab('BAG')}
                                className="group relative bg-yellow-500 text-white p-2 sm:p-3 font-black italic text-base sm:text-xl skew-x-[-10deg] hover:bg-yellow-600 transition-all overflow-hidden"
                              >
                                <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
                                <span className="relative z-10 skew-x-[10deg] flex items-center justify-center gap-2"><Package className="w-4 h-4 sm:w-5 sm:h-5" /> 背包</span>
                              </button>
                              <button 
                                onClick={() => setBattleMenuTab('POKEMON')}
                                className="group relative bg-emerald-500 text-white p-2 sm:p-3 font-black italic text-base sm:text-xl skew-x-[-10deg] hover:bg-emerald-600 transition-all overflow-hidden"
                              >
                                <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
                                <span className="relative z-10 skew-x-[10deg] flex items-center justify-center gap-2"><Dna className="w-4 h-4 sm:w-5 sm:h-5" /> 宝可梦</span>
                              </button>
                              <button 
                                onClick={() => setGameState('GAMEOVER')}
                                className="group relative bg-slate-500 text-white p-2 sm:p-3 font-black italic text-base sm:text-xl skew-x-[-10deg] hover:bg-slate-600 transition-all overflow-hidden"
                              >
                                <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
                                <span className="relative z-10 skew-x-[10deg] flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" /> 逃跑</span>
                              </button>
                            </motion.div>
                          )}

                          {turn === 'PLAYER' && battleMenuTab === 'BAG' && (
                            <motion.div 
                              key="items"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="space-y-4"
                            >
                              <div className="flex justify-between items-center">
                                <h3 className="font-black italic flex items-center gap-2"><Package className="w-5 h-5" /> 我的背包</h3>
                                <button onClick={() => setBattleMenuTab('MAIN')} className="text-xs font-bold text-slate-400 hover:text-slate-900 underline">返回</button>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                {inventory.length > 0 ? inventory.map((item, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => useItem(item, idx)}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-none skew-x-[-4deg] transition-all text-left group"
                                  >
                                    <div className="skew-x-[4deg]">
                                      <div className="font-black text-sm group-hover:text-blue-600">{getLocalized(item)}</div>
                                      <div className="text-[10px] text-slate-500 mt-1 line-clamp-1">{getLocalizedDesc(item)}</div>
                                    </div>
                                  </button>
                                )) : (
                                  <div className="col-span-full py-8 text-center text-slate-300 font-bold italic">背包空空如也</div>
                                )}
                              </div>
                            </motion.div>
                          )}

                          {turn === 'PLAYER' && battleMenuTab === 'POKEMON' && (
                            <motion.div 
                              key="pokemon-list"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="space-y-4"
                            >
                              <div className="flex justify-between items-center">
                                <h3 className="font-black italic flex items-center gap-2"><Dna className="w-5 h-5" /> 我的队伍</h3>
                                <button onClick={() => setBattleMenuTab('MAIN')} className="text-xs font-bold text-slate-400 hover:text-slate-900 underline">返回</button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                {playerTeam.map((p, idx) => (
                                  <div
                                    key={idx}
                                    className={`p-2 border skew-x-[-4deg] transition-all flex items-center gap-2 ${idx === 0 ? 'bg-blue-50 border-blue-500' : p.currentHp <= 0 ? 'opacity-50 bg-slate-100' : 'bg-white border-slate-200'}`}
                                  >
                                    <div className="skew-x-[4deg] flex items-center gap-2 w-full">
                                      <img src={p.sprites.front_default} className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
                                      <div className="flex-1 overflow-hidden">
                                        <div className="font-black text-[10px] truncate uppercase">{getLocalized(p)}</div>
                                        <div className="h-1.5 bg-slate-200 mt-1">
                                          <div className="h-full bg-blue-500" style={{ width: `${(p.currentHp / p.maxHp) * 100}%` }}></div>
                                        </div>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        <button
                                          disabled={p.currentHp <= 0 || idx === 0 || isMessageProcessing}
                                          onClick={() => switchPokemon(idx)}
                                          className="px-2 py-1 bg-blue-500 text-white text-[8px] font-black italic hover:bg-blue-600 disabled:opacity-50"
                                        >
                                          {t('switch')}
                                        </button>
                                        <button
                                          onClick={() => {
                                            setInfoPokemonIdx(idx);
                                            setPrevGameState(gameState);
                                            setGameState('POKEMON_INFO');
                                          }}
                                          className="px-2 py-1 bg-slate-900 text-white text-[8px] font-black italic hover:bg-slate-700"
                                        >
                                          {t('info')}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}

                          {turn === 'PLAYER' && battleMenuTab === 'MOVES' && (
                            <motion.div 
                              key="moves"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="h-full flex flex-col"
                            >
                              <div className="flex justify-between items-center mb-2">
                                <h3 className="font-black italic flex items-center gap-2 text-sm"><Zap className="w-4 h-4" /> {t('selectMove')}</h3>
                                <button onClick={() => setBattleMenuTab('MAIN')} className="text-[10px] font-bold text-slate-400 hover:text-slate-900 underline">{t('back')}</button>
                              </div>
                              <div className="grid grid-cols-2 grid-rows-2 gap-2 flex-1 min-h-0">
                                {playerTeam[0].selectedMoves.map((move, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => handleAttack(move)}
                                    className="relative p-2 bg-slate-900 text-white hover:bg-blue-600 transition-all text-left overflow-hidden group flex flex-col justify-center"
                                  >
                                    <div className="absolute top-0 right-0 w-12 h-full opacity-10 skew-x-[-20deg] bg-white translate-x-6 group-hover:translate-x-3 transition-transform"></div>
                                    <div className="relative z-10 w-full">
                                      <div className="font-black text-sm italic tracking-tighter uppercase truncate">{getLocalized(move)}</div>
                                      <div className="flex justify-between items-center mt-0.5">
                                        <TypeBadge type={move.type} size="xs" />
                                        <span className="text-[8px] font-black opacity-60">{t('power')}: {move.power || '--'}</span>
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {gameState === 'FACTORY_SELECT' && (
            <motion.div 
              key="factory-select"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col p-4 overflow-hidden"
            >
              <div className="text-center mb-8">
                <div className="inline-block bg-slate-900 px-12 py-3 skew-x-[-12deg] shadow-xl mb-4">
                  <h2 className="text-3xl font-black italic tracking-tighter skew-x-[12deg] text-white uppercase">{t('factorySelect')}</h2>
                </div>
                <p className="text-slate-500 font-bold italic text-sm">{t('factorySelectDesc')}</p>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
                  {factoryRentals.map((p, i) => {
                    const isSelected = selectedRentalIndices.includes(i);
                    return (
                      <div
                        key={i}
                        onClick={() => toggleRental(i)}
                        className={`group relative bg-white p-5 shadow-lg transition-all border-b-4 flex flex-col items-center cursor-pointer ${
                          isSelected ? 'border-blue-500 -translate-y-1 scale-[1.02]' : 'border-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className={`absolute top-0 left-0 px-3 py-1 text-[9px] font-black italic text-white skew-x-[-10deg] z-20 ${isSelected ? 'bg-blue-500' : 'bg-slate-400'}`}>
                          <span className="skew-x-[10deg] inline-block uppercase">#{i + 1}</span>
                        </div>
                        
                        <div className="relative mb-2 group-hover:scale-110 transition-transform">
                          <img 
                            src={p.sprites.front_default} 
                            alt={p.name}
                            className="w-24 h-24 object-contain mx-auto relative z-10 drop-shadow-md"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <h4 className="text-lg font-black italic mb-1 uppercase leading-tight text-center">{getLocalized(p)}</h4>
                        <div className="flex justify-center gap-1 mt-1 mb-4">
                          {p.types.map((t: any) => (
                            <TypeBadge key={t.type.name} type={t.type.name} size="xs" />
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full text-[10px] font-bold italic text-slate-500">
                          <div className="flex justify-between"><span>{t('hp')}</span><span>{p.maxHp}</span></div>
                          <div className="flex justify-between"><span>{t('attack')}</span><span>{p.calculatedStats.attack}</span></div>
                          <div className="flex justify-between"><span>{t('defense')}</span><span>{p.calculatedStats.defense}</span></div>
                          <div className="flex justify-between"><span>{t('spAtk')}</span><span>{p.calculatedStats.spAtk}</span></div>
                          <div className="flex justify-between"><span>{t('spDef')}</span><span>{p.calculatedStats.spDef}</span></div>
                          <div className="flex justify-between"><span>{t('speed')}</span><span>{p.calculatedStats.speed}</span></div>
                        </div>

                        <div className="mt-4 w-full space-y-1">
                          {p.selectedMoves.map((m, mi) => (
                            <div key={mi} className="flex justify-between items-center text-[8px] bg-slate-50 px-2 py-1">
                              <span className="font-black italic uppercase truncate max-w-[80px]">{getLocalized(m)}</span>
                              <TypeBadge type={m.type} size="xs" className="scale-75 origin-right" />
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2 w-full mt-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInfoPokemonIdx(i);
                              setPrevGameState('FACTORY_SELECT');
                              setGameState('POKEMON_INFO');
                            }}
                            className="flex-1 py-1.5 bg-slate-100 text-slate-600 font-black italic hover:bg-slate-200 transition-all text-[10px] uppercase"
                          >
                            {t('info')}
                          </button>
                          <div className={`flex-[2] py-1.5 font-black italic text-[10px] uppercase text-center ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'}`}>
                            {isSelected ? t('selected') : t('select')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 bg-white border-t-4 border-slate-900 flex justify-center">
                <button
                  disabled={selectedRentalIndices.length !== 3}
                  onClick={confirmRentals}
                  className={`px-12 py-4 font-black italic text-xl skew-x-[-12deg] transition-all shadow-xl ${
                    selectedRentalIndices.length === 3 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span className="skew-x-[12deg] inline-block">
                    {t('confirmSelection', { count: selectedRentalIndices.length })}
                  </span>
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'FACTORY_SWAP' && (
            <motion.div 
              key="factory-swap"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col p-4 overflow-hidden"
            >
              <div className="text-center mb-8">
                <div className="inline-block bg-slate-900 px-12 py-3 skew-x-[-12deg] shadow-xl mb-4">
                  <h2 className="text-3xl font-black italic tracking-tighter skew-x-[12deg] text-white uppercase">{t('factorySwap')}</h2>
                </div>
                <p className="text-slate-500 font-bold italic text-sm">{t('factorySwapDesc')}</p>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-hidden px-4">
                {/* 玩家队伍 */}
                <div className="flex flex-col overflow-hidden">
                  <h3 className="text-xl font-black italic mb-4 flex items-center gap-2">
                    <Dna className="w-6 h-6 text-blue-500" /> {t('currentTeam')}
                  </h3>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {playerTeam.map((p, i) => (
                      <div key={i} className="bg-white p-4 shadow-md border-l-4 border-blue-500 flex items-center gap-4">
                        <img src={p.sprites.front_default} className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                        <div className="flex-1">
                          <div className="font-black italic uppercase text-lg">{getLocalized(p)}</div>
                          <div className="flex gap-1 mt-1">
                            {p.types.map(t => <TypeBadge key={t.type.name} type={t.type.name} size="xs" />)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 对手队伍 */}
                <div className="flex flex-col overflow-hidden">
                  <h3 className="text-xl font-black italic mb-4 flex items-center gap-2">
                    <Swords className="w-6 h-6 text-red-500" /> {t('opponentTeam')}
                  </h3>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {enemyTeam.map((p, i) => (
                      <div key={i} className="bg-white p-4 shadow-md border-l-4 border-red-500 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <img src={p.sprites.front_default} className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                          <div>
                            <div className="font-black italic uppercase text-lg">{getLocalized(p)}</div>
                            <div className="flex gap-1 mt-1">
                              {p.types.map(t => <TypeBadge key={t.type.name} type={t.type.name} size="xs" />)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          {playerTeam.map((pp, pi) => (
                            <button
                              key={pi}
                              onClick={() => performSwap(pi, i)}
                              className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black italic skew-x-[-10deg] hover:bg-blue-600 transition-all"
                            >
                              <span className="skew-x-[10deg] inline-block">{t('swapWith')} {getLocalized(pp)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white border-t-4 border-slate-900 flex justify-center gap-4">
                <button
                  onClick={nextFactoryStage}
                  className="px-12 py-4 bg-slate-200 text-slate-600 font-black italic text-xl skew-x-[-12deg] hover:bg-slate-300 transition-all shadow-xl"
                >
                  <span className="skew-x-[12deg] inline-block">{t('skipSwap')}</span>
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'REWARD' && (
            <motion.div 
              key="reward"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col p-4 overflow-hidden relative"
            >
              <div className="flex justify-between items-center mb-6 px-4 flex-none">
                <div className="flex items-center gap-4">
                  <div className="bg-yellow-400 px-6 py-2 skew-x-[-12deg] shadow-lg">
                    <h2 className="text-2xl font-black italic tracking-tighter skew-x-[12deg] text-white uppercase">{t('victory')}</h2>
                  </div>
                  <div className="bg-slate-900 px-4 py-2 skew-x-[-10deg] shadow-md flex items-center gap-2">
                    <Coins className="w-4 h-4 text-yellow-400 skew-x-[10deg]" />
                    <span className="text-white font-black italic text-sm skew-x-[10deg]">{coins}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!rewardChoiceMade && (
                    <button 
                      onClick={rerollRewards}
                      disabled={coins < (50 + rerollCount * 50) || loading}
                      className={`px-3 md:px-4 py-2 font-black italic text-[10px] md:text-xs transition-all skew-x-[-10deg] flex items-center gap-2 ${
                        coins < (50 + rerollCount * 50) 
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                          : 'bg-yellow-400 text-slate-900 hover:bg-yellow-500 shadow-md'
                      }`}
                    >
                      <span className="skew-x-[10deg] inline-block flex items-center gap-1 md:gap-2">
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> 
                        {t('reroll')} 
                        <span className="bg-slate-900/10 px-1.5 py-0.5 rounded text-[8px] md:text-[10px] flex items-center gap-1">
                          <Coins className="w-2 h-2" />{50 + rerollCount * 50}
                        </span>
                      </span>
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setInfoPokemonIdx(0);
                      setPrevGameState(gameState);
                      setGameState('POKEMON_INFO');
                    }}
                    className="px-4 py-2 bg-slate-100 text-slate-500 font-black italic text-xs hover:bg-slate-200 transition-all skew-x-[-10deg]"
                  >
                    <span className="skew-x-[10deg] inline-block flex items-center gap-2"><Dna className="w-3 h-3" /> {t('viewTeam')}</span>
                  </button>
                  {rewardChoiceMade && !pendingRewardAction && (
                    <button 
                      onClick={nextStage}
                      className="px-8 py-2 bg-blue-600 text-white font-black italic text-sm hover:bg-blue-700 transition-all skew-x-[-10deg] shadow-lg animate-pulse"
                    >
                      <span className="skew-x-[10deg] inline-block flex items-center gap-2">{t('nextStep')} <ChevronRight className="w-4 h-4" /></span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
                  {rewards.map((reward, i) => {
                    const isShop = reward.type === 'SHOP_ITEM';
                    const isClaimed = rewardChoiceMade && !isShop;
                    const canAfford = !isShop || coins >= reward.data.price;
                    
                    return (
                      <button
                        key={i}
                        disabled={isClaimed || !canAfford}
                        onClick={() => selectReward(reward)}
                        className={`group relative bg-white p-5 shadow-lg transition-all border-b-4 flex flex-col items-center justify-between min-h-[240px] ${
                          isClaimed ? 'opacity-40 grayscale cursor-not-allowed border-slate-200' : 
                          !canAfford ? 'opacity-60 grayscale cursor-not-allowed border-orange-200' : 
                          isShop ? 'hover:border-orange-500 hover:-translate-y-1 border-orange-100' : 'hover:border-blue-500 hover:-translate-y-1 border-blue-100'
                        }`}
                      >
                        {/* Type Label */}
                        <div className={`absolute top-0 left-0 px-3 py-1 text-[9px] font-black italic text-white skew-x-[-10deg] z-20 ${isShop ? 'bg-orange-500' : 'bg-blue-500'}`}>
                          <span className="skew-x-[10deg] inline-block uppercase">{isShop ? t('mysteryShop') : t('randomRewards')}</span>
                        </div>

                        <div className="w-full flex flex-col items-center pt-4">
                          {reward.type === 'ITEM' ? (
                            <>
                              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Package className="w-8 h-8 text-blue-500" />
                              </div>
                              <h4 className="text-base font-black italic mb-1 leading-tight text-center">{getLocalized(reward.data)}</h4>
                              <p className="text-[10px] text-slate-400 font-bold line-clamp-2 text-center px-2">{getLocalizedDesc(reward.data)}</p>
                            </>
                          ) : reward.type === 'MOVE' ? (
                            <>
                              <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Zap className="w-8 h-8 text-yellow-500" />
                              </div>
                              <h4 className="text-base font-black italic mb-1 leading-tight text-center">{t('learnMove')}</h4>
                              <p className="text-[10px] text-slate-400 font-bold line-clamp-2 text-center px-2">{t('learnMoveDesc')}</p>
                            </>
                          ) : reward.type === 'EVOLUTION' ? (
                            <>
                              <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Dna className="w-8 h-8 text-purple-500" />
                              </div>
                              <h4 className="text-base font-black italic mb-1 leading-tight text-center">{t('evolutionReward')}</h4>
                              <p className="text-[10px] text-slate-400 font-bold line-clamp-2 text-center px-2">{t('evolutionRewardDesc')}</p>
                            </>
                          ) : reward.type === 'POKEMON' ? (
                            <>
                              <div className="relative mb-2 group-hover:scale-110 transition-transform">
                                <img 
                                  src={reward.data.sprites.front_default} 
                                  alt={reward.data.name}
                                  className="w-20 h-20 object-contain mx-auto relative z-10 drop-shadow-md"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <h4 className="text-base font-black italic mb-1 uppercase leading-tight text-center">{getLocalized(reward.data)}</h4>
                              <div className="flex justify-center gap-1 mt-1">
                                {reward.data.types.map((t: any) => (
                                  <TypeBadge key={t.type.name} type={t.type.name} size="xs" />
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Package className="w-8 h-8 text-orange-500" />
                              </div>
                              <h4 className="text-base font-black italic mb-1 leading-tight text-center">{getLocalized(reward.data.item)}</h4>
                              <p className="text-[10px] text-slate-400 font-bold line-clamp-2 text-center px-2">{getLocalizedDesc(reward.data.item)}</p>
                              <div className="mt-3 flex items-center gap-2 bg-orange-100 px-3 py-1 rounded-full">
                                <Coins className="w-3 h-3 text-orange-600" />
                                <span className="text-xs font-black text-orange-700">{reward.data.price}</span>
                              </div>
                            </>
                          )}
                        </div>

                        <div className={`mt-6 w-full py-2 px-4 text-white font-black italic skew-x-[-10deg] transition-all text-xs shadow-md ${
                          isClaimed ? 'bg-slate-300' : 
                          !canAfford ? 'bg-slate-400' :
                          isShop ? 'bg-orange-600 group-hover:bg-orange-700' : 'bg-slate-900 group-hover:bg-blue-600'
                        }`}>
                          <span className="skew-x-[10deg] inline-block uppercase">
                            {isClaimed ? 'CLAIMED' : isShop ? (canAfford ? t('buyItem') : t('insufficientCoins')) : t('selectThis')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sub-Action Overlays (Learn Move / Evolution) */}
              <AnimatePresence>
                {pendingRewardAction === 'MOVE' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex flex-col p-8 overflow-y-auto custom-scrollbar"
                  >
                    <div className="text-center mb-8 flex-none">
                      <div className="inline-block bg-blue-600 px-12 py-3 skew-x-[-12deg] shadow-xl mb-4">
                        <h2 className="text-3xl font-black italic tracking-tighter skew-x-[12deg] text-white">{t('learnMove')}</h2>
                      </div>
                      <p className="text-slate-300 font-bold italic text-sm">{t('selectToLearn')}</p>
                    </div>

                    {learningPokemonIdx === null ? (
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pb-4 overflow-y-auto custom-scrollbar pr-2 flex-1">
                          {playerTeam.map((p, idx) => (
                            <div
                              key={idx}
                              className="bg-white p-4 md:p-6 shadow-xl hover:shadow-2xl transition-all border-b-4 border-slate-100 hover:border-blue-500 group flex items-center md:flex-col gap-4 md:gap-0"
                            >
                              <img src={p.sprites.front_default} className="w-16 h-16 md:w-24 md:h-24 group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                              <div className="flex-1 md:flex-none text-left md:text-center">
                                <div className="font-black italic text-base md:text-xl uppercase truncate">{getLocalized(p)}</div>
                                <div className="text-[8px] md:text-[10px] font-bold text-slate-400 mt-1 mb-2 md:mb-4">
                                  {t('movesCount').replace('{count}', p.selectedMoves.length.toString())}
                                </div>
                                <button
                                  onClick={() => startLearningMove(idx)}
                                  className="w-full py-2 bg-blue-500 text-white font-black italic text-[10px] md:text-sm hover:bg-blue-600 transition-colors skew-x-[-10deg]"
                                >
                                  <span className="skew-x-[10deg] inline-block">{t('learnMoveBtn')}</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-auto pt-4 flex-none">
                          <button 
                            onClick={() => setPendingRewardAction(null)}
                            className="w-full py-3 bg-slate-800 text-white font-black italic skew-x-[-12deg] hover:bg-slate-700 transition-colors"
                          >
                            <span className="skew-x-[12deg] inline-block">{t('back')}</span>
                          </button>
                        </div>
                      </div>
                    ) : loading ? (
                      <div className="flex-1 flex flex-col items-center justify-center">
                        <RefreshCw className="animate-spin w-12 h-12 text-blue-500 mb-4" />
                        <p className="font-black italic text-slate-400">{t('retrievingMoves')}</p>
                      </div>
                    ) : selectedNewMove ? (
                      <div className="max-w-2xl mx-auto w-full">
                        <div className="bg-white p-8 shadow-2xl skew-x-[-2deg] border-l-8 border-red-500">
                          <div className="skew-x-[2deg]">
                            <h3 className="text-3xl font-black italic mb-2 tracking-tighter">{t('replaceWhichMove')}</h3>
                            <p className="text-slate-500 mb-8 font-bold italic">
                              {t('selectOldToReplace').replace('{move}', getLocalized(selectedNewMove))}
                            </p>
                            
                            <div className="grid grid-cols-1 gap-3">
                              {playerTeam[learningPokemonIdx].selectedMoves.map((m, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => replaceMove(idx)}
                                  onMouseEnter={() => setHoveredMove(m)}
                                  onMouseLeave={() => setHoveredMove(null)}
                                  className="p-4 bg-slate-50 hover:bg-red-50 border-2 border-slate-100 hover:border-red-500 transition-all flex justify-between items-center group"
                                >
                                  <div className="flex items-center gap-3">
                                    <TypeBadge type={m.type} size="xs" />
                                    <span className="font-black italic uppercase group-hover:text-red-600">{getLocalized(m)}</span>
                                  </div>
                                  <div className="text-xs font-bold text-slate-400 uppercase">{m.damage_class === 'special' ? t('special') : t('physical')}</div>
                                </button>
                              ))}
                            </div>

                            <button 
                              onClick={() => setSelectedNewMove(null)}
                              className="mt-6 w-full py-3 bg-slate-100 text-slate-500 font-black italic hover:bg-slate-200 transition-all"
                            >
                              {t('back')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pr-2 pb-8">
                          {potentialMoves.map((move, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleLearnMove(move)}
                              onMouseEnter={() => setHoveredMove(move)}
                              onMouseLeave={() => setHoveredMove(null)}
                              className="bg-white p-5 shadow-lg hover:shadow-2xl transition-all border-b-4 border-slate-100 hover:border-blue-500 flex flex-col items-center text-center group"
                            >
                              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Zap className="w-6 h-6 text-blue-500" />
                              </div>
                              <div className="font-black italic text-lg uppercase mb-1">{getLocalized(move)}</div>
                              <TypeBadge type={move.type} size="xs" />
                              <div className="mt-3 w-full py-1.5 bg-slate-900 text-white font-black italic text-[10px] skew-x-[-10deg]">
                                <span className="skew-x-[10deg] inline-block uppercase">{t('learnThisMove')}</span>
                              </div>
                            </button>
                          ))}
                          {potentialMoves.length === 0 && (
                            <div className="col-span-full text-center py-12">
                              <p className="text-slate-400 font-bold italic">{t('noMoreMoves')}</p>
                              <button 
                                onClick={() => setLearningPokemonIdx(null)}
                                className="mt-4 px-6 py-2 bg-slate-800 text-white font-black italic skew-x-[-10deg]"
                              >
                                <span className="skew-x-[10deg] inline-block">{t('reselectPokemon')}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {pendingRewardAction === 'EVOLUTION' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex flex-col p-8 overflow-y-auto custom-scrollbar"
                  >
                    <div className="text-center mb-8 flex-none">
                      <div className="inline-block bg-purple-600 px-12 py-3 skew-x-[-12deg] shadow-xl mb-4">
                        <h2 className="text-3xl font-black italic tracking-tighter skew-x-[12deg] text-white">{t('evolution')}</h2>
                      </div>
                      <p className="text-slate-300 font-bold italic text-sm">
                        {selectedPokemonForEvolution ? t('chooseEvolution') : t('selectToEvolve')}
                      </p>
                    </div>

                    {!selectedPokemonForEvolution ? (
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pb-8 overflow-y-auto custom-scrollbar pr-2">
                          {playerTeam.map((p, idx) => (
                            <div
                              key={idx}
                              className="bg-white p-6 shadow-xl hover:shadow-2xl transition-all border-b-4 border-slate-100 hover:border-purple-500 group flex flex-col items-center"
                            >
                              <img src={p.sprites.front_default} className="w-24 h-24 mx-auto mb-4 group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                              <div className="font-black italic text-xl uppercase">{getLocalized(p)}</div>
                              <button
                                onClick={() => startEvolution(p, idx)}
                                className="w-full mt-4 py-2 bg-purple-500 text-white font-black italic text-sm hover:bg-purple-600 transition-colors skew-x-[-10deg]"
                              >
                                <span className="skew-x-[10deg] inline-block">{t('evolve')}</span>
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-auto pt-4 flex-none">
                          <button 
                            onClick={() => setPendingRewardAction(null)}
                            className="w-full py-3 bg-slate-800 text-white font-black italic skew-x-[-12deg] hover:bg-slate-700 transition-colors"
                          >
                            <span className="skew-x-[12deg] inline-block">{t('back')}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col h-full">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pr-2 custom-scrollbar flex-1 mb-4">
                          {evolutionChoices.map((choice) => (
                            <motion.button
                              key={choice.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => performEvolution(choice.id)}
                              className="bg-white p-4 md:p-8 rounded-2xl shadow-xl border-2 md:border-4 border-purple-100 hover:border-purple-500 transition-all flex items-center md:flex-col gap-4 md:gap-0 group relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 w-12 h-12 md:w-16 md:h-16 bg-purple-500 skew-x-[45deg] translate-x-6 md:translate-x-8 -translate-y-6 md:-translate-y-8 group-hover:translate-x-4 md:group-hover:translate-x-6 group-hover:-translate-y-4 md:group-hover:-translate-y-6 transition-transform" />
                              <img 
                                src={choice.sprites.front_default} 
                                className="w-16 h-16 md:w-32 md:h-32 group-hover:scale-110 transition-transform z-10" 
                                referrerPolicy="no-referrer" 
                              />
                              <div className="flex-1 md:flex-none text-left md:text-center z-10">
                                <div className="font-black italic text-lg md:text-2xl uppercase text-slate-900">{getLocalized(choice)}</div>
                                <div className="mt-1 md:mt-4 flex gap-1 md:gap-2">
                                  {choice.types.map(t => (
                                    <TypeBadge key={t.type.name} type={t.type.name} size="xs" />
                                  ))}
                                </div>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                        <div className="flex-none">
                          <button 
                            onClick={() => {
                              setSelectedPokemonForEvolution(null);
                              setEvolutionChoices([]);
                            }}
                            className="w-full py-3 bg-slate-800 text-white font-black italic skew-x-[-12deg] hover:bg-slate-700 transition-colors"
                          >
                            <span className="skew-x-[12deg] inline-block">{t('back')}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 替换界面 */}
              <AnimatePresence>
                {showReplaceUI && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[110] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6"
                  >
                    <div className="bg-white max-w-2xl w-full p-8 skew-x-[-2deg] shadow-2xl relative">
                      <div className="skew-x-[2deg]">
                        <h2 className="text-3xl font-black italic mb-2 tracking-tighter">{t('teamFull')}</h2>
                        <p className="text-slate-500 mb-8 font-bold italic">{t('replacePartner')}：<span className="text-blue-600 uppercase">{getLocalized(showReplaceUI)}</span></p>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {playerTeam.map((p, idx) => (
                            <button
                              key={idx}
                              onClick={() => replacePokemon(idx)}
                              className="p-4 bg-slate-50 hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-500 transition-all text-left flex items-center gap-4 group"
                            >
                              <img src={p.sprites.front_default} className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                              <div>
                                <div className="font-black text-lg uppercase group-hover:text-blue-600">{getLocalized(p)}</div>
                                <div className="text-xs font-bold text-slate-400">Lv.{p.level}</div>
                              </div>
                            </button>
                          ))}
                        </div>

                        <button 
                          onClick={() => setShowReplaceUI(null)}
                          className="mt-8 w-full py-4 bg-slate-200 text-slate-600 font-black italic hover:bg-slate-300 transition-all"
                        >
                          {t('cancelReplace')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {gameState === 'POKEMON_INFO' && infoPokemonIdx !== null && (
            <motion.div
              key="pokemon-info"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="flex-1 flex flex-col max-w-5xl mx-auto w-full overflow-hidden"
            >
              {(() => {
                const displayPokemon = prevGameState === 'FACTORY_SELECT' 
                  ? factoryRentals[infoPokemonIdx] 
                  : playerTeam[infoPokemonIdx];
                
                return (
                  <div className="bg-white shadow-2xl overflow-hidden border-y-4 md:border-y-8 border-slate-900 flex-1 flex flex-col">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2">
                        {/* 左侧：基本信息与大图 */}
                        <div className="p-4 md:p-8 bg-slate-50 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-2 md:p-4 opacity-20 md:opacity-100">
                            <div className="text-4xl md:text-6xl font-black italic text-slate-200 tracking-tighter">
                              #{String(displayPokemon.id).padStart(3, '0')}
                            </div>
                          </div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-8">
                              <div className="bg-slate-900 text-white px-3 py-1 skew-x-[-12deg] font-black italic text-sm md:text-xl">
                                <span className="skew-x-[12deg]">LV.{displayPokemon.level}</span>
                              </div>
                              <h2 className="text-2xl md:text-4xl font-black italic tracking-tighter uppercase truncate">{getLocalized(displayPokemon)}</h2>
                            </div>
                            <div className="flex gap-2 md:gap-3 mb-4 md:mb-8">
                              {displayPokemon.types.map(t => (
                                <TypeBadge key={t.type.name} type={t.type.name} size={window.innerWidth < 768 ? "sm" : "lg"} />
                              ))}
                            </div>
                            <div className="flex justify-center py-4 md:py-12">
                              <motion.img 
                                animate={{ y: [0, -10, 0] }}
                                transition={{ repeat: Infinity, duration: 3 }}
                                src={displayPokemon.sprites.front_default} 
                                className="w-40 h-40 md:w-64 md:h-64 object-contain drop-shadow-2xl" 
                                referrerPolicy="no-referrer" 
                              />
                            </div>
                            <div className="bg-white p-3 md:p-4 border-l-4 border-slate-900 shadow-sm">
                              <div className="text-[10px] font-black text-slate-400 uppercase mb-1">{currentLanguage.startsWith('zh') ? '特性' : 'Ability'}</div>
                              <div className="font-black italic text-base md:text-lg">
                                {getLocalized(displayPokemon.abilities[0]?.ability) || (currentLanguage.startsWith('zh') ? '无' : 'None')}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 右侧：能力值与技能 */}
                        <div className="p-4 md:p-8 bg-white">
                          <div className="mb-6 md:mb-8">
                            <div className="flex justify-between items-end mb-4 md:mb-6 border-b border-slate-100 pb-2">
                              <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-slate-400">{currentLanguage.startsWith('zh') ? '能力值' : 'Stats'}</h3>
                              <div className="text-[8px] md:text-[10px] font-bold text-blue-500 italic">
                                {getLocalizedNature(displayPokemon.nature)} {currentLanguage.startsWith('zh') ? '性格' : 'Nature'} 
                                ({displayPokemon.nature.plus ? `+${getStatName(displayPokemon.nature.plus)}` : ''}
                                {displayPokemon.nature.minus ? `, -${getStatName(displayPokemon.nature.minus)}` : ''})
                              </div>
                            </div>
                            <div className="space-y-2 md:space-y-3">
                              {[
                                { key: 'hp', color: 'bg-red-500' },
                                { key: 'attack', color: 'bg-orange-500' },
                                { key: 'defense', color: 'bg-yellow-500' },
                                { key: 'spAtk', color: 'bg-blue-500' },
                                { key: 'spDef', color: 'bg-green-500' },
                                { key: 'speed', color: 'bg-pink-500' }
                              ].map((s, i) => {
                                const val = (displayPokemon.calculatedStats as any)[s.key];
                                const base = (displayPokemon.baseStats as any)[s.key];
                                const iv = (displayPokemon.ivs as any)[s.key];
                                const max = 400; 
                                const statName = getStatName(s.key);
                                
                                return (
                                  <div key={i} className="flex flex-col gap-0.5 md:gap-1">
                                    <div className="flex justify-between items-center text-[8px] md:text-[10px] font-bold italic">
                                      <div className="text-slate-500">{statName}</div>
                                      <div className="text-slate-300">{currentLanguage.startsWith('zh') ? '种族' : 'Base'}: {base} / {currentLanguage.startsWith('zh') ? '个体' : 'IV'}: {iv}</div>
                                    </div>
                                    <div className="flex items-center gap-3 md:gap-4">
                                      <div className="flex-1 h-1.5 md:h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: `${(val / max) * 100}%` }}
                                          className={`h-full ${s.color}`}
                                        />
                                      </div>
                                      <div className="w-6 md:w-8 text-right font-black italic text-xs md:text-sm">{val}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="relative">
                            <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-slate-400 mb-4 md:mb-6 border-b border-slate-100 pb-2">{currentLanguage.startsWith('zh') ? '当前技能' : 'Current Moves'}</h3>
                            <div className="grid grid-cols-1 gap-2 md:gap-3">
                              {displayPokemon.selectedMoves.map((m, i) => (
                                <div 
                                  key={i} 
                                  onMouseEnter={() => setHoveredMove(m)}
                                  onMouseLeave={() => setHoveredMove(null)}
                                  className="flex items-center justify-between p-2 md:p-3 bg-slate-50 border-l-4 border-slate-900 group hover:bg-slate-100 transition-colors cursor-help"
                                >
                                  <div className="flex-1 min-w-0 pr-2">
                                    <div className="font-black italic uppercase text-xs md:text-sm truncate">{getLocalized(m)}</div>
                                    <div className="text-[8px] md:text-[10px] text-slate-400 font-bold italic truncate">
                                      {currentLanguage.startsWith('zh') ? '威力' : 'Power'}: {m.power || '--'} / 
                                      {currentLanguage.startsWith('zh') ? '命中' : 'Accuracy'}: {m.accuracy || '--'} / 
                                      PP: {m.pp || '--'}
                                    </div>
                                  </div>
                                  <TypeBadge type={m.type} size="xs" />
                                </div>
                              ))}
                            </div>

                            {/* 技能详情浮层 */}
                            <AnimatePresence>
                              {hoveredMove && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  className="absolute bottom-full left-0 right-0 mb-2 md:mb-4 bg-slate-900 text-white p-3 md:p-4 shadow-2xl z-50 border-t-4 border-blue-500"
                                >
                                  <div className="flex justify-between items-center mb-1 md:mb-2">
                                    <div className="font-black italic text-sm md:text-lg">{getLocalized(hoveredMove)}</div>
                                    <div className="text-[8px] md:text-[10px] px-2 py-0.5 bg-white text-slate-900 font-bold uppercase">{hoveredMove.damage_class === 'special' ? '特攻' : '物理'}</div>
                                  </div>
                                  <p className="text-[10px] md:text-xs text-slate-300 leading-relaxed italic">{getLocalizedDesc(hoveredMove)}</p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-900 p-3 md:p-4 flex justify-end flex-none">
                      <button 
                        onClick={() => setGameState(prevGameState)}
                        className="px-6 md:px-8 py-2 bg-white text-slate-900 font-black italic skew-x-[-12deg] hover:bg-blue-500 hover:text-white transition-all text-sm md:text-base"
                      >
                        <span className="skew-x-[12deg]">{t('back')}</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}

          {gameState === 'GAMEOVER' && (
            <motion.div 
              key="gameover"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center p-4 text-center"
            >
              <div className="bg-red-500 p-6 md:p-8 skew-x-[-12deg] shadow-2xl mb-6 md:mb-8">
                <Skull className="w-12 h-12 md:w-20 md:h-20 text-white skew-x-[12deg]" />
              </div>
              <h2 className="text-4xl md:text-7xl font-black mb-4 tracking-tighter italic text-slate-900 uppercase">{t('gameOver')}</h2>
              <div className="bg-slate-900 text-white px-6 py-2 skew-x-[-10deg] mb-8">
                <p className="font-black italic text-lg md:text-2xl skew-x-[10deg]">{t('reachedFloor', { stage })}</p>
              </div>
              
              <button 
                onClick={() => setGameState('START')}
                className="px-10 md:px-12 py-4 md:py-5 bg-slate-900 text-white font-black text-xl md:text-2xl skew-x-[-12deg] hover:bg-blue-600 transition-all shadow-xl"
              >
                <span className="flex items-center gap-3 skew-x-[12deg]">
                  <RefreshCw className="w-5 h-5 md:w-6 md:h-6" /> {t('restart')}
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
