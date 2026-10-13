import test from 'node:test';
import assert from 'node:assert/strict';
import type { GamePokemon, Move, MoveBattleData, StatStages } from '../../../types';
import { applyMoveSecondaryEffects } from '../lib/battleResolution';
import { setVolatileStatus } from '../utils/battleStatus';
import { resolveControllerProtectionCollision, resolveControllerWhiteHerb } from './useBattleController';

const ZERO_STAGES: StatStages = {
  attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0, evasion: 0,
};

function combatant(side: 'player' | 'enemy', stages: Partial<StatStages> = {}): GamePokemon {
  return {
    id: side === 'player' ? 1 : 2,
    name: side,
    zhName: side,
    currentHp: 100,
    maxHp: 100,
    statStages: { ...ZERO_STAGES, ...stages },
    volatileStatuses: {},
    factoryHeldItemId: 'white_herb',
    factoryEquippedHeldItemId: 'white_herb',
    factoryOriginalHeldItemId: 'white_herb',
  } as GamePokemon;
}

function activate(pokemon: GamePokemon) {
  return resolveControllerWhiteHerb(pokemon, 'zh-hans', (target) => target.zhName || target.name, () => '白色香草');
}

test('controller resolves opponent and self stat drops for either side exactly once', () => {
  for (const side of ['player', 'enemy'] as const) {
    for (const cause of ['opponent', 'self'] as const) {
      const actorSide = cause === 'self' ? side : side === 'player' ? 'enemy' : 'player';
      const move = {
        name: 'deterministic-stat-drop', power: 80, accuracy: 100, type: 'normal', damage_class: 'special',
        battleData: {
          effectId: 'NONE', priority: 0, target: 'selected-pokemon', flags: [], critStage: 0,
          drainPercent: 0, recoilPercent: 0, healingPercent: 0, strikeMode: 'single', minHits: 1, maxHits: 1,
          secondaryEffects: [{ kind: 'stat-stage', chance: 100, appliesTo: cause === 'self' ? 'user' : 'target',
            isPrimary: true, stat: 'attack', change: -2 }],
          substituteInteraction: 'blocked', makesContact: false, soundMove: false, powderMove: false,
          ballisticMove: false, punchMove: false, bypassProtect: false, ignoreAccuracyCheck: false,
        } as MoveBattleData,
      } as Move;
      const teams = {
        playerTeam: [combatant('player', { speed: 2 })],
        enemyTeam: [combatant('enemy', { speed: 2 })],
      };
      const action = applyMoveSecondaryEffects({
        move, actingSide: actorSide, teams, getLocalized: (pokemon) => pokemon.name,
        currentLanguage: 'zh-hans', random: () => 0,
      });
      const lowered = side === 'player' ? action.playerTeam[0] : action.enemyTeam[0];
      assert.equal(lowered.statStages.attack, -2, `${side}/${cause} real secondary effect lowered Attack`);
      const first = activate(lowered);
      assert.equal(first.pokemon.factoryHeldItemId, undefined, `${side}/${cause} consumes only the current battle item`);
      assert.equal(first.pokemon.factoryEquippedHeldItemId, 'white_herb');
      assert.equal(first.pokemon.factoryOriginalHeldItemId, 'white_herb');
      assert.equal(first.pokemon.statStages.attack, 0);
      assert.equal(first.pokemon.statStages.speed, 2);
      assert.match(first.message ?? '', /白色香草/);
      const second = activate(first.pokemon);
      assert.equal(second.message, null, `${side}/${cause} logs once`);
      assert.equal(second.pokemon, first.pokemon);
    }
  }
});

test('controller resolves King Shield contact drop before the protected action returns', () => {
  const contactMove = { name: 'tackle', battleData: { makesContact: true } } as Move;
  for (const side of ['player', 'enemy'] as const) {
    const attacker = combatant(side);
    const defender = setVolatileStatus(combatant(side === 'player' ? 'enemy' : 'player'), 'protect', {
      sourceMoveName: 'kings-shield',
    });
    const resolved = resolveControllerProtectionCollision(
      attacker, defender, contactMove, 'zh-hans', (pokemon) => pokemon.name, () => '白色香草',
    );
    assert.equal(resolved.attacker.statStages.attack, 0);
    assert.equal(resolved.attacker.factoryHeldItemId, undefined);
    assert.equal(resolved.collisionMessages.length, 1);
    assert.match(resolved.whiteHerbMessage ?? '', /白色香草/);
    assert.equal(activate(resolved.attacker).message, null);
  }
});
