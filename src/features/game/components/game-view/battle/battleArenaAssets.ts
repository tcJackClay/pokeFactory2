export const POKEROGUE_FACTORY_ARENA = {
  background: {
    src: '/assets/pokerogue/arenas/factory_bg.png',
    width: 320,
    height: 180,
  },
  playerBase: {
    src: '/assets/pokerogue/arenas/factory_a.png',
    width: 320,
    height: 132,
  },
  enemyBase: {
    src: '/assets/pokerogue/arenas/factory_b.png',
    width: 320,
    height: 132,
  },
} as const;

export const POKEROGUE_FACTORY_ARENA_PLACEMENT = {
  messagePanel: {
    top: 132,
    height: 48,
  },
  playerBase: {
    visualCenterX: 104,
    translateX: 2,
    translateY: 0,
  },
  enemyBase: {
    visualCenterX: 216,
    translateX: 20,
    translateY: 0,
  },
} as const;
