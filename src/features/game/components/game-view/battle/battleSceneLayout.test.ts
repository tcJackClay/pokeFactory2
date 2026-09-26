import assert from 'node:assert/strict';
import test from 'node:test';
import { POKEROGUE_FACTORY_ARENA_PLACEMENT } from './battleArenaAssets';
import {
  BATTLE_LOGICAL_SIZE,
  POKEROGUE_BATTLE_COORDINATES,
  getBattleSceneLayout,
  type BattlePositionedSlot,
} from './battleSceneLayout';

const VIEWPORTS = [
  [320, 568],
  [390, 844],
  [844, 390],
  [1366, 768],
] as const;

function assertSlotInsideCanvas(slot: BattlePositionedSlot) {
  const left = slot.anchor === 'center-bottom' ? slot.x - slot.width / 2 : slot.x - slot.width;
  const top = slot.anchor === 'center-bottom' ? slot.y - slot.height : slot.y - slot.height / 2;

  const allowedLeftBleed = slot.anchor === 'right-center' && slot.fieldPosition === 'right' ? -10 : 0;
  assert.ok(left >= allowedLeftBleed, `${slot.fieldPosition} slot starts before the PokeRogue edge bleed`);
  assert.ok(top >= 0, `${slot.fieldPosition} slot starts above the canvas`);
  assert.ok(left + slot.width <= BATTLE_LOGICAL_SIZE.width, `${slot.fieldPosition} slot exceeds canvas width`);
  assert.ok(top + slot.height <= BATTLE_LOGICAL_SIZE.height, `${slot.fieldPosition} slot exceeds canvas height`);
}

test('battle scene keeps one 320x180 logical coordinate system at every viewport', () => {
  const baseline = getBattleSceneLayout(...VIEWPORTS[0]);
  assert.deepEqual(baseline.canvas, BATTLE_LOGICAL_SIZE);

  for (const viewport of VIEWPORTS.slice(1)) {
    assert.deepEqual(getBattleSceneLayout(...viewport), baseline);
  }
});

test('single battle exposes only one center slot per side and never renders reserved double placeholders', () => {
  const layout = getBattleSceneLayout();

  assert.deepEqual(layout.playerSpriteSlots.map(({ fieldPosition }) => fieldPosition), ['center']);
  assert.deepEqual(layout.enemySpriteSlots.map(({ fieldPosition }) => fieldPosition), ['center']);
  assert.deepEqual(layout.playerHudSlots.map(({ fieldPosition }) => fieldPosition), ['center']);
  assert.deepEqual(layout.enemyHudSlots.map(({ fieldPosition }) => fieldPosition), ['center']);
});

test('single battle keeps the PokeRogue anchors above the in-canvas message panel', () => {
  const layout = getBattleSceneLayout();
  const [playerSprite] = layout.playerSpriteSlots;
  const [enemySprite] = layout.enemySpriteSlots;
  const [playerHud] = layout.playerHudSlots;
  const [enemyHud] = layout.enemyHudSlots;

  assert.deepEqual(
    { x: playerSprite.x, y: playerSprite.y },
    POKEROGUE_BATTLE_COORDINATES.sprite.player.center,
  );
  assert.deepEqual(
    { x: enemySprite.x, y: enemySprite.y },
    POKEROGUE_BATTLE_COORDINATES.sprite.enemy.center,
  );
  assert.deepEqual(
    { x: playerHud.x, y: playerHud.y },
    POKEROGUE_BATTLE_COORDINATES.hud.player.center,
  );
  assert.deepEqual(
    { x: enemyHud.x, y: enemyHud.y },
    POKEROGUE_BATTLE_COORDINATES.hud.enemy.center,
  );
});

test('double battle reserves PokeRogue left and right sprite and mini-HUD anchors', () => {
  const { doubleBattle } = getBattleSceneLayout();

  assert.deepEqual(
    doubleBattle.playerSpriteSlots.map(({ x, y, fieldPosition }) => ({ x, y, fieldPosition })),
    [
      { x: 74, y: 140, fieldPosition: 'left' },
      { x: 138, y: 148, fieldPosition: 'right' },
    ],
  );
  assert.deepEqual(
    doubleBattle.enemySpriteSlots.map(({ x, y, fieldPosition }) => ({ x, y, fieldPosition })),
    [
      { x: 204, y: 76, fieldPosition: 'left' },
      { x: 268, y: 84, fieldPosition: 'right' },
    ],
  );
  assert.deepEqual(
    doubleBattle.playerHudSlots.map(({ x, y, fieldPosition, mini }) => ({ x, y, fieldPosition, mini })),
    [
      { x: 310, y: 96, fieldPosition: 'left', mini: true },
      { x: 320, y: 123, fieldPosition: 'right', mini: true },
    ],
  );
  assert.deepEqual(
    doubleBattle.enemyHudSlots.map(({ x, y, fieldPosition, mini }) => ({ x, y, fieldPosition, mini })),
    [
      { x: 140, y: 39, fieldPosition: 'left', mini: true },
      { x: 130, y: 66, fieldPosition: 'right', mini: true },
    ],
  );
});

test('single-battle arena bases align their visual centers with the sprite anchors', () => {
  const layout = getBattleSceneLayout();

  assert.equal(
    POKEROGUE_FACTORY_ARENA_PLACEMENT.playerBase.visualCenterX
      + POKEROGUE_FACTORY_ARENA_PLACEMENT.playerBase.translateX,
    layout.playerSpriteSlots[0].x,
  );
  assert.equal(
    POKEROGUE_FACTORY_ARENA_PLACEMENT.enemyBase.visualCenterX
      + POKEROGUE_FACTORY_ARENA_PLACEMENT.enemyBase.translateX,
    layout.enemySpriteSlots[0].x,
  );
  assert.equal(
    POKEROGUE_FACTORY_ARENA_PLACEMENT.messagePanel.top
      + POKEROGUE_FACTORY_ARENA_PLACEMENT.messagePanel.height,
    BATTLE_LOGICAL_SIZE.height,
  );
});

test('all single and reserved double slots remain inside the logical canvas or PokeRogue edge bleed', () => {
  const layout = getBattleSceneLayout();
  const allSlots = [
    ...layout.playerSpriteSlots,
    ...layout.enemySpriteSlots,
    ...layout.playerHudSlots,
    ...layout.enemyHudSlots,
    ...layout.doubleBattle.playerSpriteSlots,
    ...layout.doubleBattle.enemySpriteSlots,
    ...layout.doubleBattle.playerHudSlots,
    ...layout.doubleBattle.enemyHudSlots,
  ];

  allSlots.forEach(assertSlotInsideCanvas);
  assert.ok(layout.catchEffect.left >= 0 && layout.catchEffect.left + layout.catchEffect.size <= layout.canvas.width);
  assert.ok(layout.catchEffect.top >= 0 && layout.catchEffect.top + layout.catchEffect.size <= layout.canvas.height);
});
