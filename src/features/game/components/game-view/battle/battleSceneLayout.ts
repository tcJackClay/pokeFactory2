export type BattleStageMode = 'fixed';

export type BattleFieldPosition = 'center' | 'left' | 'right';
export type BattleSlotAnchor = 'center-bottom' | 'right-center';

export type BattleLayoutBox = {
  width: number;
  height: number;
  minHeight?: number;
};

export type BattlePositionedSlot = BattleLayoutBox & {
  x: number;
  y: number;
  anchor: BattleSlotAnchor;
  fieldPosition: BattleFieldPosition;
  mini: boolean;
};

type BattleCatchLayout = {
  left: number;
  top: number;
  size: number;
};

type BattleSideSlots = {
  playerSpriteSlots: BattlePositionedSlot[];
  enemySpriteSlots: BattlePositionedSlot[];
  playerHudSlots: BattlePositionedSlot[];
  enemyHudSlots: BattlePositionedSlot[];
};

export interface BattleSceneLayout extends BattleSideSlots {
  canvas: {
    width: number;
    height: number;
  };
  doubleBattle: BattleSideSlots;
  enemyHud: BattleLayoutBox;
  enemySprite: BattleLayoutBox;
  playerHud: BattleLayoutBox;
  playerSprite: BattleLayoutBox;
  catchEffect: BattleCatchLayout;
}

export const BATTLE_LOGICAL_SIZE = {
  width: 320,
  height: 180,
} as const;

/**
 * PokeRogue beta df2e5635 uses a 320×180 logical field.
 * Sprite origins are centered on the bottom edge. HUD origins are centered on
 * their right edge and live in fieldUI, whose origin is the bottom of the field.
 */
export const POKEROGUE_BATTLE_COORDINATES = {
  sprite: {
    player: { center: { x: 106, y: 148 } },
    enemy: { center: { x: 236, y: 84 } },
  },
  fieldOffset: {
    center: { x: 0, y: 0 },
    left: { x: -32, y: -8 },
    right: { x: 32, y: 0 },
  },
  hud: {
    player: {
      center: { x: 310, y: 108 },
      left: { x: 310, y: 96 },
      right: { x: 320, y: 123 },
    },
    enemy: {
      center: { x: 140, y: 39 },
      left: { x: 140, y: 39 },
      right: { x: 130, y: 66 },
    },
  },
} as const;

const enemyHud: BattleLayoutBox = {
  width: 140,
  height: 40,
  minHeight: 40,
};

const enemyMiniHud: BattleLayoutBox = {
  width: 140,
  height: 30,
  minHeight: 30,
};

const enemySprite: BattleLayoutBox = {
  width: 72,
  height: 72,
};

const playerHud: BattleLayoutBox = {
  width: 160,
  height: 52,
  minHeight: 52,
};

const playerMiniHud: BattleLayoutBox = {
  width: 140,
  height: 32,
  minHeight: 32,
};

const playerSprite: BattleLayoutBox = {
  width: 96,
  height: 96,
};

function makeSlot(
  box: BattleLayoutBox,
  point: { x: number; y: number },
  anchor: BattleSlotAnchor,
  fieldPosition: BattleFieldPosition,
  mini: boolean,
): BattlePositionedSlot {
  return {
    ...box,
    ...point,
    anchor,
    fieldPosition,
    mini,
  };
}

function makeSpriteSlot(
  side: 'player' | 'enemy',
  fieldPosition: BattleFieldPosition,
): BattlePositionedSlot {
  const base = POKEROGUE_BATTLE_COORDINATES.sprite[side].center;
  const offset = POKEROGUE_BATTLE_COORDINATES.fieldOffset[fieldPosition];

  return makeSlot(
    side === 'player' ? playerSprite : enemySprite,
    { x: base.x + offset.x, y: base.y + offset.y },
    'center-bottom',
    fieldPosition,
    fieldPosition !== 'center',
  );
}

function makeHudSlot(
  side: 'player' | 'enemy',
  fieldPosition: BattleFieldPosition,
): BattlePositionedSlot {
  const point = POKEROGUE_BATTLE_COORDINATES.hud[side][fieldPosition];
  const box = side === 'player'
    ? fieldPosition === 'center' ? playerHud : playerMiniHud
    : fieldPosition === 'center' ? enemyHud : enemyMiniHud;

  return makeSlot(
    box,
    point,
    'right-center',
    fieldPosition,
    fieldPosition !== 'center',
  );
}

export function getBattleSceneLayout(
  _stageWidth: number = BATTLE_LOGICAL_SIZE.width,
  _stageHeight: number = BATTLE_LOGICAL_SIZE.height,
): BattleSceneLayout {
  const playerSpriteCenter = makeSpriteSlot('player', 'center');
  const enemySpriteCenter = makeSpriteSlot('enemy', 'center');
  const playerHudCenter = makeHudSlot('player', 'center');
  const enemyHudCenter = makeHudSlot('enemy', 'center');
  const enemySpriteTop = enemySpriteCenter.y - enemySpriteCenter.height;
  const enemySpriteLeft = enemySpriteCenter.x - enemySpriteCenter.width / 2;

  return {
    canvas: { ...BATTLE_LOGICAL_SIZE },
    playerSpriteSlots: [playerSpriteCenter],
    enemySpriteSlots: [enemySpriteCenter],
    playerHudSlots: [playerHudCenter],
    enemyHudSlots: [enemyHudCenter],
    doubleBattle: {
      playerSpriteSlots: [makeSpriteSlot('player', 'left'), makeSpriteSlot('player', 'right')],
      enemySpriteSlots: [makeSpriteSlot('enemy', 'left'), makeSpriteSlot('enemy', 'right')],
      playerHudSlots: [makeHudSlot('player', 'left'), makeHudSlot('player', 'right')],
      enemyHudSlots: [makeHudSlot('enemy', 'left'), makeHudSlot('enemy', 'right')],
    },
    enemyHud: { ...enemyHud },
    enemySprite: { ...enemySprite },
    playerHud: { ...playerHud },
    playerSprite: { ...playerSprite },
    catchEffect: {
      left: Math.round(enemySpriteLeft + enemySpriteCenter.width * 0.56),
      top: Math.round(enemySpriteTop + enemySpriteCenter.height * 0.08),
      size: 32,
    },
  };
}

export function getBattleStageMode(): BattleStageMode {
  return 'fixed';
}
