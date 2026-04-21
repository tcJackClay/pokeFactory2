import type { MoveBattleData, MoveEffectId, MoveBattleTarget } from '../../../../types';

type MoveBattleDataOverride = Partial<MoveBattleData> & {
  effectId?: MoveEffectId;
  target?: MoveBattleTarget;
};

export const MOVE_BATTLE_DATA_OVERRIDES: Partial<Record<string, MoveBattleDataOverride>> = {
  rest: {
    effectId: 'REST',
    target: 'user',
  },
  'sleep-talk': {
    effectId: 'SLEEP_TALK',
    target: 'user',
  },
  snore: {
    effectId: 'SNORE',
  },
  uproar: {
    effectId: 'UPROAR',
    soundMove: true,
  },
  'ancient-power': {
    secondaryEffects: [
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'attack', change: 1 },
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'defense', change: 1 },
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'spAtk', change: 1 },
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'spDef', change: 1 },
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'speed', change: 1 },
    ],
  },
  'silver-wind': {
    secondaryEffects: [
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'attack', change: 1 },
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'defense', change: 1 },
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'spAtk', change: 1 },
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'spDef', change: 1 },
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'speed', change: 1 },
    ],
  },
  'ominous-wind': {
    secondaryEffects: [
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'attack', change: 1 },
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'defense', change: 1 },
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'spAtk', change: 1 },
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'spDef', change: 1 },
      { kind: 'stat-stage', chance: 10, group: 'all-stats-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'speed', change: 1 },
    ],
  },
  'metal-claw': {
    secondaryEffects: [
      { kind: 'stat-stage', chance: 10, group: 'metal-claw-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'attack', change: 1 },
    ],
  },
  'meteor-mash': {
    secondaryEffects: [
      { kind: 'stat-stage', chance: 20, group: 'meteor-mash-boost', appliesTo: 'user', isPrimary: false, requiresHit: true, blockedBySubstitute: false, stat: 'attack', change: 1 },
    ],
  },
  overheat: {
    secondaryEffects: [
      { kind: 'stat-stage', chance: 100, group: 'overheat-drop', appliesTo: 'user', isPrimary: true, requiresHit: true, blockedBySubstitute: false, stat: 'spAtk', change: -2 },
    ],
  },
  superpower: {
    secondaryEffects: [
      { kind: 'stat-stage', chance: 100, group: 'superpower-drop', appliesTo: 'user', isPrimary: true, requiresHit: true, blockedBySubstitute: false, stat: 'attack', change: -1 },
      { kind: 'stat-stage', chance: 100, group: 'superpower-drop', appliesTo: 'user', isPrimary: true, requiresHit: true, blockedBySubstitute: false, stat: 'defense', change: -1 },
    ],
  },
  'triple-kick': {
    effectId: 'TRIPLE_KICK',
    strikeMode: 'progressive-multi-hit',
    minHits: 3,
    maxHits: 3,
    guaranteedHits: 3,
  },
  'population-bomb': {
    effectId: 'POPULATION_BOMB',
    strikeMode: 'multi-hit-per-accuracy',
    minHits: 10,
    maxHits: 10,
    guaranteedHits: 10,
  },
  substitute: {
    effectId: 'SUBSTITUTE',
    target: 'user',
  },
  'sunny-day': {
    weather: 'sunny',
  },
  'rain-dance': {
    weather: 'rainy',
  },
  sandstorm: {
    weather: 'sandstorm',
  },
  hail: {
    weather: 'hail',
  },
  snowscape: {
    weather: 'hail',
  },
  yawn: {
    effectId: 'YAWN',
  },
  nightmare: {
    effectId: 'NIGHTMARE',
  },
  taunt: {
    effectId: 'TAUNT',
  },
  torment: {
    effectId: 'TORMENT',
  },
  disable: {
    effectId: 'DISABLE',
  },
  encore: {
    effectId: 'ENCORE',
  },
  attract: {
    effectId: 'ATTRACT',
  },
  curse: {
    effectId: 'CURSE',
  },
  protect: {
    effectId: 'PROTECT',
    priority: 4,
    bypassProtect: true,
  },
  detect: {
    effectId: 'DETECT',
    priority: 4,
    bypassProtect: true,
  },
  'kings-shield': {
    effectId: 'KINGS_SHIELD',
    priority: 4,
    bypassProtect: true,
  },
  'spiky-shield': {
    effectId: 'SPIKY_SHIELD',
    priority: 4,
    bypassProtect: true,
  },
  'electric-terrain': {
    fieldState: 'electric_terrain',
  },
  'grassy-terrain': {
    fieldState: 'grassy_terrain',
  },
  'misty-terrain': {
    fieldState: 'misty_terrain',
  },
  'psychic-terrain': {
    fieldState: 'psychic_terrain',
  },
  'trick-room': {
    fieldState: 'trick_room',
  },
  'magic-room': {
    fieldState: 'magic_room',
  },
  'wonder-room': {
    fieldState: 'wonder_room',
  },
  gravity: {
    fieldState: 'gravity',
  },
  'fairy-lock': {
    fieldState: 'fairy_lock',
  },
};
