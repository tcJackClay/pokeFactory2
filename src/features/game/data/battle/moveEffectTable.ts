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
    thawsUser: true,
    secondaryEffects: [
      { kind: 'stat-stage', chance: 100, group: 'overheat-drop', appliesTo: 'user', isPrimary: true, requiresHit: true, blockedBySubstitute: false, stat: 'spAtk', change: -2 },
    ],
  },
  'leaf-storm': {
    secondaryEffects: [
      { kind: 'stat-stage', chance: 100, group: 'leaf-storm-drop', appliesTo: 'user', isPrimary: true, requiresHit: true, blockedBySubstitute: false, stat: 'spAtk', change: -2 },
    ],
  },
  'draco-meteor': {
    secondaryEffects: [
      { kind: 'stat-stage', chance: 100, group: 'draco-meteor-drop', appliesTo: 'user', isPrimary: true, requiresHit: true, blockedBySubstitute: false, stat: 'spAtk', change: -2 },
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
    weather: 'snow',
  },
  tailwind: {
    effectId: 'TAILWIND',
    target: 'user',
  },
  'stealth-rock': {
    effectId: 'STEALTH_ROCK',
    target: 'opponents-field',
  },
  'toxic-spikes': {
    effectId: 'TOXIC_SPIKES',
    target: 'opponents-field',
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
  'dragon-rage': {
    effectId: 'DRAGON_RAGE',
  },
  'sonic-boom': {
    effectId: 'SONIC_BOOM',
  },
  'seismic-toss': {
    effectId: 'LEVEL_DAMAGE',
  },
  'night-shade': {
    effectId: 'LEVEL_DAMAGE',
  },
  'super-fang': {
    effectId: 'HALF_HP',
  },
  endeavor: {
    effectId: 'ENDEAVOR',
  },
  psywave: {
    effectId: 'RANDOM_LEVEL_DAMAGE',
  },
  'low-kick': {
    effectId: 'WEIGHT_POWER',
  },
  return: {
    effectId: 'FRIENDSHIP_POWER',
  },
  frustration: {
    effectId: 'INVERSE_FRIENDSHIP_POWER',
  },
  magnitude: {
    effectId: 'MAGNITUDE',
  },
  present: {
    effectId: 'PRESENT',
  },
  counter: {
    effectId: 'COUNTER_PHYSICAL',
    priority: -5,
  },
  'mirror-coat': {
    effectId: 'COUNTER_SPECIAL',
    priority: -5,
  },
  stockpile: {
    effectId: 'STOCKPILE',
    target: 'user',
  },
  'spit-up': {
    effectId: 'SPIT_UP',
  },
  swallow: {
    effectId: 'SWALLOW',
    target: 'user',
    healingPercent: 0,
  },
  revenge: {
    effectId: 'REVENGE',
    priority: -4,
  },
  'smelling-salts': {
    effectId: 'SMELLING_SALTS',
  },
  'knock-off': {
    effectId: 'KNOCK_OFF',
  },
  'secret-power': {
    effectId: 'SECRET_POWER',
  },
  safeguard: {
    effectId: 'SAFEGUARD',
    target: 'user',
  },
  reflect: {
    effectId: 'REFLECT',
    target: 'user',
  },
  'light-screen': {
    effectId: 'LIGHT_SCREEN',
    target: 'user',
  },
  'brick-break': {
    effectId: 'BREAK_SCREENS',
  },
  'pain-split': {
    effectId: 'HP_SPLIT',
  },
  'belly-drum': {
    effectId: 'BELLY_DRUM',
    target: 'user',
  },
  'focus-energy': {
    effectId: 'FOCUS_ENERGY',
    target: 'user',
  },
  foresight: {
    effectId: 'FORESIGHT',
  },
  haze: {
    effectId: 'HAZE',
    target: 'entire-field',
  },
  'psych-up': {
    effectId: 'PSYCH_UP',
  },
  'leech-seed': {
    effectId: 'LEECH_SEED',
  },
  bind: {
    effectId: 'DAMAGING_TRAP',
  },
  wrap: {
    effectId: 'DAMAGING_TRAP',
  },
  'fire-spin': {
    effectId: 'DAMAGING_TRAP',
  },
  whirlpool: {
    effectId: 'DAMAGING_TRAP',
  },
  'sand-tomb': {
    effectId: 'DAMAGING_TRAP',
  },
  'perish-song': {
    effectId: 'PERISH_SONG',
    soundMove: true,
  },
  ingrain: {
    effectId: 'INGRAIN',
    target: 'user',
  },
  aromatherapy: {
    effectId: 'PARTY_STATUS_CURE',
    target: 'user',
  },
  'heal-bell': {
    effectId: 'PARTY_STATUS_CURE',
    target: 'user',
    soundMove: true,
  },
  refresh: {
    effectId: 'REFRESH',
    target: 'user',
  },
  'hidden-power': {
    effectId: 'HIDDEN_POWER',
  },
  'tri-attack': {
    effectId: 'TRI_ATTACK',
    secondaryEffects: [{
      kind: 'status',
      chance: 20,
      appliesTo: 'target',
      isPrimary: false,
      requiresHit: true,
      blockedBySubstitute: true,
      statusId: 'tri_attack',
    }],
  },
  toxic: {
    secondaryEffects: [{
      kind: 'status',
      chance: 100,
      appliesTo: 'target',
      isPrimary: true,
      requiresHit: false,
      blockedBySubstitute: true,
      statusId: 'bad_poison',
    }],
  },
  'poison-fang': {
    secondaryEffects: [{
      kind: 'status',
      chance: 50,
      appliesTo: 'target',
      isPrimary: false,
      requiresHit: true,
      blockedBySubstitute: true,
      statusId: 'bad_poison',
    }],
  },
  guillotine: {
    effectId: 'ONE_HIT_KO',
  },
  'horn-drill': {
    effectId: 'ONE_HIT_KO',
  },
  fissure: {
    effectId: 'ONE_HIT_KO',
  },
  'sheer-cold': {
    effectId: 'SHEER_COLD',
  },
  'fury-cutter': {
    effectId: 'CONSECUTIVE_POWER',
  },
  rollout: {
    effectId: 'CONSECUTIVE_POWER',
  },
  'ice-ball': {
    effectId: 'CONSECUTIVE_POWER',
  },
  flail: {
    effectId: 'LOW_HP_POWER',
  },
  reversal: {
    effectId: 'LOW_HP_POWER',
  },
  eruption: {
    effectId: 'HIGH_HP_POWER',
  },
  'water-spout': {
    effectId: 'HIGH_HP_POWER',
  },
  facade: {
    effectId: 'FACADE',
  },
  'freeze-dry': {
    effectId: 'FREEZE_DRY',
  },
  'flame-wheel': { thawsUser: true },
  'sacred-fire': { thawsUser: true },
  'heat-wave': { thawsUser: true },
  'flare-blitz': { thawsUser: true },
  'fusion-flare': { thawsUser: true },
  'burn-up': { thawsUser: true },
  'pyro-ball': { thawsUser: true },
  scald: { thawsUser: true, thawsTarget: true },
  'steam-eruption': { thawsUser: true, thawsTarget: true },
  'scorching-sands': { thawsUser: true, thawsTarget: true },
  'matcha-gotcha': { thawsUser: true, thawsTarget: true },
  'flying-press': {
    effectId: 'FLYING_PRESS',
  },
  'thousand-arrows': {
    effectId: 'THOUSAND_ARROWS',
  },
  explosion: {
    effectId: 'SELF_DESTRUCT',
  },
  'self-destruct': {
    effectId: 'SELF_DESTRUCT',
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
