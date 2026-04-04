export type EventRegionCategory = 'normal' | 'ev_train' | 'rare_hunt';

export type DispatchStatus = 'IDLE' | 'RUNNING' | 'READY';

export interface EventSpecialSiteConfig {
  id: string;
  name: string;
  speciesPool: number[];
  weight?: number;
  minLevel?: number;
}

export interface EventRegionConfig {
  id: string;
  name: string;
  category: EventRegionCategory;
  dexRange: [number, number];
  requiredTypes: string[];
  specialSites: EventSpecialSiteConfig[];
  dispatchHours: number;
  baseEvGain: number;
}

export interface RegionDispatchState {
  status: DispatchStatus;
  startedAt: number | null;
  readyAt: number | null;
  lastResolvedAt: number | null;
  lastResult: string;
}

export const EVENT_REGIONS: EventRegionConfig[] = [
  {
    id: 'kanto',
    name: '关都',
    category: 'normal',
    dexRange: [1, 151],
    requiredTypes: ['normal', 'water', 'grass'],
    specialSites: [
      { id: 'cerulean-cave', name: '华蓝洞窟', speciesPool: [150], weight: 3, minLevel: 68 },
      { id: 'seafoam-islands', name: '双子岛', speciesPool: [144], weight: 2, minLevel: 66 },
    ],
    dispatchHours: 4,
    baseEvGain: 4,
  },
  {
    id: 'johto',
    name: '城都',
    category: 'ev_train',
    dexRange: [152, 251],
    requiredTypes: ['fighting', 'psychic'],
    specialSites: [
      { id: 'bell-tower', name: '铃铛塔', speciesPool: [250], weight: 3, minLevel: 70 },
      { id: 'whirl-islands', name: '漩涡列岛', speciesPool: [249], weight: 3, minLevel: 70 },
    ],
    dispatchHours: 6,
    baseEvGain: 12,
  },
  {
    id: 'hoenn',
    name: '丰缘',
    category: 'normal',
    dexRange: [252, 386],
    requiredTypes: ['water', 'ground', 'flying'],
    specialSites: [
      { id: 'sky-pillar', name: '天空之柱', speciesPool: [384], weight: 3, minLevel: 70 },
      { id: 'cave-of-origin', name: '觉醒神殿', speciesPool: [382, 383], weight: 2, minLevel: 68 },
    ],
    dispatchHours: 7,
    baseEvGain: 5,
  },
  {
    id: 'sinnoh',
    name: '神奥',
    category: 'normal',
    dexRange: [387, 493],
    requiredTypes: ['steel', 'ice', 'ground'],
    specialSites: [
      { id: 'spear-pillar', name: '枪之柱', speciesPool: [483, 484], weight: 3, minLevel: 70 },
      { id: 'lake-caverns', name: '三大湖洞窟', speciesPool: [480, 481, 482], weight: 2, minLevel: 65 },
    ],
    dispatchHours: 8,
    baseEvGain: 6,
  },
  {
    id: 'unova',
    name: '合众',
    category: 'normal',
    dexRange: [494, 649],
    requiredTypes: ['dragon', 'dark', 'electric'],
    specialSites: [
      { id: 'dragonspiral-tower', name: '龙螺旋之塔', speciesPool: [643, 644], weight: 3, minLevel: 70 },
      { id: 'giant-chasm', name: '巨大洞穴', speciesPool: [646], weight: 2, minLevel: 70 },
    ],
    dispatchHours: 9,
    baseEvGain: 6,
  },
  {
    id: 'kalos',
    name: '卡洛斯',
    category: 'normal',
    dexRange: [650, 721],
    requiredTypes: ['fairy', 'fire', 'psychic'],
    specialSites: [
      { id: 'terminus-cave', name: '终结洞窟', speciesPool: [716], weight: 3, minLevel: 70 },
      { id: 'team-flare-hq', name: '闪焰队本部', speciesPool: [717], weight: 2, minLevel: 70 },
    ],
    dispatchHours: 10,
    baseEvGain: 7,
  },
  {
    id: 'alola',
    name: '阿罗拉',
    category: 'normal',
    dexRange: [722, 809],
    requiredTypes: ['fairy', 'ghost', 'grass'],
    specialSites: [
      { id: 'altar-of-the-sun', name: '日轮祭坛', speciesPool: [791], weight: 3, minLevel: 70 },
      { id: 'altar-of-the-moon', name: '月轮祭坛', speciesPool: [792], weight: 3, minLevel: 70 },
    ],
    dispatchHours: 10,
    baseEvGain: 7,
  },
  {
    id: 'galar',
    name: '伽勒尔',
    category: 'rare_hunt',
    dexRange: [810, 898],
    requiredTypes: ['dragon', 'steel', 'ice'],
    specialSites: [
      { id: 'energy-plant', name: '能量工厂', speciesPool: [890], weight: 3, minLevel: 70 },
      { id: 'crown-shrine', name: '王冠神殿', speciesPool: [898], weight: 2, minLevel: 70 },
    ],
    dispatchHours: 12,
    baseEvGain: 8,
  },
  {
    id: 'paldea',
    name: '帕底亚',
    category: 'normal',
    dexRange: [899, 1025],
    requiredTypes: ['fighting', 'dark', 'grass'],
    specialSites: [
      { id: 'area-zero-depths', name: '零区深处', speciesPool: [1007, 1008], weight: 3, minLevel: 72 },
      { id: 'crystal-cavern', name: '结晶洞窟', speciesPool: [1001, 1002, 1003], weight: 2, minLevel: 70 },
    ],
    dispatchHours: 12,
    baseEvGain: 8,
  },
];

export const IV_TRAIN_BATTLE_THRESHOLD = 5;

export const RARE_SPECIES_POOL: number[] = [
  144, 145, 146, 150, 151,
  243, 244, 245, 249, 250,
  380, 381, 382, 383, 384,
  480, 481, 482, 483, 484,
  643, 644, 646, 716, 717,
  785, 786, 787, 788, 791, 792,
];

export function createDefaultDispatchState(): RegionDispatchState {
  return {
    status: 'IDLE',
    startedAt: null,
    readyAt: null,
    lastResolvedAt: null,
    lastResult: '',
  };
}
