export type BattleStageMode = 'default' | 'portrait-scaled';

export type BattleLayoutBox = {
  width: number;
  height?: number;
  minHeight?: number;
  offsetY?: number;
};

type BattleRowLayout = {
  width: number;
  height: number;
  insetX?: number;
  top?: number;
  bottom?: number;
  centerOffsetY?: number;
};

type BattleCatchLayout = {
  left: number;
  top: number;
  size: number;
};

type BattleLayoutPreset = {
  canvas: {
    width: number;
    height: number;
  };
  hudInsets: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  hud: {
    baseWidth: number;
    minWidth: number;
    maxWidth: number;
    aspectMin: number;
    aspectMax: number;
  };
  playerDock: {
    triggerStripHeight: number;
    triggerGap: number;
  };
  sprite: {
    rowWidth: number;
    minRowHeight: number;
    physicalHudGap: number;
    enemySize: {
      width: number;
      height: number;
    };
    playerSize: {
      width: number;
      height: number;
    };
    enemyOffsetY: number;
    playerOffsetY: number;
  };
  catch: {
    baseSize: number;
    minSize: number;
    maxSize: number;
    anchorXRatio: number;
    anchorYRatio: number;
  };
};

export interface BattleSceneLayout {
  canvas: {
    width: number;
    height: number;
  };
  enemyHudRow: BattleRowLayout;
  spriteRow: BattleRowLayout;
  playerHudRow: BattleRowLayout;
  enemyHudSlots: BattleLayoutBox[];
  enemySpriteSlots: BattleLayoutBox[];
  playerHudSlots: BattleLayoutBox[];
  playerSpriteSlots: BattleLayoutBox[];
  enemyHud: BattleLayoutBox;
  enemySprite: BattleLayoutBox;
  playerHud: BattleLayoutBox;
  playerSprite: BattleLayoutBox;
  catchEffect: BattleCatchLayout;
}

const PORTRAIT_PRESET: BattleLayoutPreset = {
  canvas: {
    width: 400,
    height: 292,
  },
  hudInsets: {
    minX: 12,
    maxX: 16,
    minY: 10,
    maxY: 14,
  },
  hud: {
    baseWidth: 176,
    minWidth: 156,
    maxWidth: 196,
    aspectMin: 1.9,
    aspectMax: 2.08,
  },
  playerDock: {
    triggerStripHeight: 34,
    triggerGap: 4,
  },
  sprite: {
    rowWidth: 350,
    minRowHeight: 118,
    physicalHudGap: 18,
    enemySize: {
      width: 88,
      height: 88,
    },
    playerSize: {
      width: 124,
      height: 124,
    },
    enemyOffsetY: -12,
    playerOffsetY: 12,
  },
  catch: {
    baseSize: 56,
    minSize: 50,
    maxSize: 64,
    anchorXRatio: 0.56,
    anchorYRatio: 0.08,
  },
};

const LANDSCAPE_PRESET: BattleLayoutPreset = {
  canvas: {
    width: 960,
    height: 420,
  },
  hudInsets: {
    minX: 16,
    maxX: 22,
    minY: 12,
    maxY: 18,
  },
  hud: {
    baseWidth: 312,
    minWidth: 280,
    maxWidth: 332,
    aspectMin: 2.55,
    aspectMax: 2.85,
  },
  playerDock: {
    triggerStripHeight: 40,
    triggerGap: 6,
  },
  sprite: {
    rowWidth: 756,
    minRowHeight: 180,
    physicalHudGap: 22,
    enemySize: {
      width: 164,
      height: 164,
    },
    playerSize: {
      width: 220,
      height: 220,
    },
    enemyOffsetY: -18,
    playerOffsetY: 18,
  },
  catch: {
    baseSize: 92,
    minSize: 84,
    maxSize: 104,
    anchorXRatio: 0.58,
    anchorYRatio: 0.08,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function round(value: number) {
  return Math.round(value);
}

function buildSlots(slot: BattleLayoutBox, count: number) {
  return Array.from({ length: count }, () => ({ ...slot }));
}

function getScaleProgress(sceneScale: number) {
  return clamp((sceneScale - 0.72) / 0.28, 0, 1);
}

function getDerivedHudSize(preset: BattleLayoutPreset, sceneScale: number) {
  const scaleProgress = getScaleProgress(sceneScale);
  const width = round(
    clamp(
      preset.hud.baseWidth * lerp(0.9, 1.04, scaleProgress),
      preset.hud.minWidth,
      preset.hud.maxWidth,
    ),
  );
  const aspectRatio = lerp(preset.hud.aspectMin, preset.hud.aspectMax, scaleProgress);
  const height = round(width / aspectRatio);

  return {
    width,
    height,
  };
}

function getDerivedSpriteRow(
  preset: BattleLayoutPreset,
  canvasHeight: number,
  sceneScale: number,
  hudInsetY: number,
  enemyHudHeight: number,
  playerDockHeight: number,
) {
  const safeScale = Math.max(sceneScale, 0.6);
  const logicalHudInsetY = hudInsetY / safeScale;
  const logicalEnemyHudHeight = enemyHudHeight / safeScale;
  const logicalPlayerDockHeight = playerDockHeight / safeScale;
  const logicalHudGap = preset.sprite.physicalHudGap / safeScale;

  let rowTop = logicalHudInsetY + logicalEnemyHudHeight + logicalHudGap;
  let rowBottom = canvasHeight - logicalHudInsetY - logicalPlayerDockHeight - logicalHudGap;
  let rowHeight = rowBottom - rowTop;

  if (rowHeight < preset.sprite.minRowHeight) {
    const shortage = preset.sprite.minRowHeight - rowHeight;
    rowTop = Math.max(logicalHudInsetY + logicalEnemyHudHeight + logicalHudGap * 0.45, rowTop - shortage * 0.35);
    rowBottom = Math.min(
      canvasHeight - logicalHudInsetY - logicalPlayerDockHeight - logicalHudGap * 0.45,
      rowBottom + shortage * 0.65,
    );
    rowHeight = rowBottom - rowTop;
  }

  rowHeight = Math.max(rowHeight, preset.sprite.minRowHeight);
  rowTop = clamp(
    rowTop,
    logicalHudInsetY + logicalEnemyHudHeight,
    Math.max(logicalHudInsetY + logicalEnemyHudHeight, canvasHeight - logicalHudInsetY - logicalPlayerDockHeight - rowHeight),
  );

  return {
    top: round(rowTop),
    height: round(rowHeight),
  };
}

function getDerivedHudInsets(preset: BattleLayoutPreset, sceneScale: number) {
  const scaleProgress = getScaleProgress(sceneScale);

  return {
    x: round(lerp(preset.hudInsets.minX, preset.hudInsets.maxX, scaleProgress)),
    y: round(lerp(preset.hudInsets.minY, preset.hudInsets.maxY, scaleProgress)),
  };
}

export function getBattleSceneLayout(stageWidth: number, stageHeight: number): BattleSceneLayout {
  const isPortraitStage = stageHeight >= stageWidth;
  const preset = isPortraitStage ? PORTRAIT_PRESET : LANDSCAPE_PRESET;
  const safeStageWidth = stageWidth > 0 ? stageWidth : preset.canvas.width;
  const safeStageHeight = stageHeight > 0 ? stageHeight : preset.canvas.height;
  const sceneScale = Math.min(
    safeStageWidth / preset.canvas.width,
    safeStageHeight / preset.canvas.height,
    1,
  );
  const hudInsets = getDerivedHudInsets(preset, sceneScale);
  const hudSize = getDerivedHudSize(preset, sceneScale);
  const playerDockHeight = hudSize.height + preset.playerDock.triggerStripHeight + preset.playerDock.triggerGap;
  const spriteRow = getDerivedSpriteRow(
    preset,
    preset.canvas.height,
    sceneScale,
    hudInsets.y,
    hudSize.height,
    playerDockHeight,
  );
  const spriteRowLeft = (preset.canvas.width - preset.sprite.rowWidth) / 2;
  const enemySpriteSlot: BattleLayoutBox = {
    width: preset.sprite.enemySize.width,
    height: preset.sprite.enemySize.height,
    offsetY: preset.sprite.enemyOffsetY,
  };
  const playerSpriteSlot: BattleLayoutBox = {
    width: preset.sprite.playerSize.width,
    height: preset.sprite.playerSize.height,
    offsetY: preset.sprite.playerOffsetY,
  };
  const enemySpriteBottom = spriteRow.top + spriteRow.height + (enemySpriteSlot.offsetY ?? 0);
  const enemySpriteTop = enemySpriteBottom - preset.sprite.enemySize.height;
  const enemySpriteLeft = spriteRowLeft + preset.sprite.rowWidth - preset.sprite.enemySize.width;
  const catchScale = lerp(0.92, 1.05, getScaleProgress(sceneScale));
  const catchSize = round(
    clamp(
      preset.catch.baseSize * catchScale,
      preset.catch.minSize,
      preset.catch.maxSize,
    ),
  );
  const catchLeft = round(enemySpriteLeft + preset.sprite.enemySize.width * preset.catch.anchorXRatio);
  const catchTop = round(enemySpriteTop + preset.sprite.enemySize.height * preset.catch.anchorYRatio);
  const hudSlot: BattleLayoutBox = {
    width: hudSize.width,
    height: hudSize.height,
    minHeight: hudSize.height,
  };

  return {
    canvas: {
      width: preset.canvas.width,
      height: preset.canvas.height,
    },
    enemyHudRow: {
      width: safeStageWidth,
      height: hudSize.height,
      insetX: hudInsets.x,
      top: hudInsets.y,
    },
    spriteRow: {
      width: preset.sprite.rowWidth,
      height: spriteRow.height,
      top: spriteRow.top,
    },
    playerHudRow: {
      width: safeStageWidth,
      height: playerDockHeight,
      insetX: hudInsets.x,
      bottom: hudInsets.y,
    },
    enemyHudSlots: buildSlots(hudSlot, 1),
    enemySpriteSlots: buildSlots(enemySpriteSlot, 1),
    playerHudSlots: buildSlots(hudSlot, 1),
    playerSpriteSlots: buildSlots(playerSpriteSlot, 1),
    enemyHud: { ...hudSlot },
    enemySprite: { ...enemySpriteSlot },
    playerHud: { ...hudSlot },
    playerSprite: { ...playerSpriteSlot },
    catchEffect: {
      left: catchLeft,
      top: catchTop,
      size: catchSize,
    },
  };
}

export function getBattleStageMode(isPortraitStage: boolean): BattleStageMode {
  return isPortraitStage ? 'portrait-scaled' : 'default';
}
