// d6e74a0 replay (only added new callback boundary spies); original failure artifact retained.
// Static audit reproduction: production callback execution, no browser or game service.
// The sendOut callbacks are spies; end-turn probe models only the existing all-wiped guard.
import test from 'node:test';
import ts from 'typescript';
import * as battleData from '../../../../src/features/game/data/battle';
import * as battleStatus from '../../../../src/features/game/utils/battleStatus';
import * as battleLog from '../../../../src/features/game/battle/battleLogText';
import * as protection from '../../../../src/features/game/battle/engine/resolveProtection';
import * as healBlock from '../../../../src/features/game/battle/engine/resolveHealBlock';
import * as strikes from '../../../../src/features/game/battle/engine/resolveMoveStrikes';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { GamePokemon, Move } from '../../../../src/types';
import { buildMoveBattleDataFromPokeApiMove } from '../../../../src/features/game/data/battle';
import { applyMoveSecondaryEffects, applyWeatherChipDamage } from '../../../../src/features/game/lib/battleResolution';
import { setVolatileStatus, setNonVolatileStatus, hasVolatileStatus } from '../../../../src/features/game/utils/battleStatus';
import { prepareFactoryPartyForBattle } from '../../../../src/features/game/utils/restoreFactoryParty';
import { calculateDamage } from '../../../../src/features/game/battle/engine/resolveDamage';
import { resolveActionSelection } from '../../../../src/features/game/battle/engine/resolveActionSelection';
import { resolveFlinch } from '../../../../src/features/game/battle/engine/resolveFlinch';
import { isMoveHealBlocked } from '../../../../src/features/game/battle/engine/resolveHealBlock';
import { resolveHeldItemHit } from '../../../../src/features/game/battle/engine/resolveHeldItemHit';
import { resolveMentalHerb } from '../../../../src/features/game/battle/engine/resolveMentalHerb';
import { resolveSitrusBerry } from '../../../../src/features/game/battle/engine/resolveHealingItem';
import { resolveLegalMoves, STRUGGLE_MOVE, struggleRecoil } from '../../../../src/features/game/battle/engine/resolveLegalMoves';
import { prepareMoveUse } from '../../../../src/features/game/battle/engine/prepareMoveUse';
import { resolveBeforeMoveChecks } from '../../../../src/features/game/battle/engine/resolveBeforeMoveChecks';
import { resolveEndTurn } from '../../../../src/features/game/battle/engine/resolveEndTurn';
import { clearSwitchingBattleState } from '../../../../src/features/game/battle/engine/resolveSwitchState';
import { resolveTypeImmunityReaction } from '../../../../src/features/game/battle/engine/resolveTypeImmunityReaction';
import { resolveMoveStrikePlan } from '../../../../src/features/game/battle/engine/resolveMoveStrikes';
import { resolveEntryHazards, createEmptyBattleHazards } from '../../../../src/features/game/battle/engine/resolveEntryHazards';
import { resolveControllerProtectionCollision } from '../../../../src/features/game/hooks/useBattleController';
import { executeRoundTransaction, startRound } from '../../../../src/features/game/battle/engine/roundTransaction';
import type { BattleSnapshot } from '../../../../src/features/game/battle/engine/types';

const stats = { hp: 200, attack: 100, defense: 100, spAtk: 100, spDef: 100, speed: 100 };
function move(name = 'tackle', data: Record<string, any> = {}): Move {
  const raw = { name, power: 40, accuracy: 100, pp: 10, priority: 0, type: { name: 'normal' },
    damage_class: { name: 'physical' }, target: { name: 'selected-pokemon' }, ...data };
  return { name, power: raw.power, accuracy: raw.accuracy, pp: raw.pp, type: raw.type.name,
    damage_class: raw.damage_class.name, battleData: buildMoveBattleDataFromPokeApiMove(raw) };
}
function pokemon(id = 1, overrides: Partial<GamePokemon> = {}): GamePokemon {
  return { id, name: `mon-${id}`, sprites: { front_default: '', back_default: '' }, stats: [],
    types: [{ type: { name: 'normal' } }], abilities: [{ ability: { name: 'run-away', url: '' } }], moves: [],
    currentHp: 200, maxHp: 200, selectedMoves: [move()], level: 50,
    nature: { name: 'hardy', zhName: '勤奋', plus: 'attack', minus: 'attack' },
    ivs: stats, evs: stats, baseStats: stats, calculatedStats: stats,
    statStages: { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0, evasion: 0 },
    volatileStatuses: {}, ...overrides };
}
const ability = (name: string) => [{ ability: { name, url: '' } }];
const blocked = (mon: GamePokemon, turns = 5) => setVolatileStatus(mon, 'heal_block', { turnsRemaining: turns });
function snapshot(player: GamePokemon, enemy = pokemon(2)): BattleSnapshot {
  return { playerTeam: [player], enemyTeam: [enemy], weather: 'none', weatherTurns: 0,
    fieldState: [], fieldTurns: {}, tailwindTurns: { player: 0, enemy: 0 }, hazards: createEmptyBattleHazards() };
}
const end = (state: BattleSnapshot) => resolveEndTurn({ snapshot: state, getLocalized: (p) => p.name,
  currentLanguage: 'zh-hans', formatDynamaxEndMessage: () => '', getMoveCurrentPp: (m) => m.currentPp ?? m.pp ?? 0,
  tryActivateSitrusBerry: (p) => {
    if (!p) return { pokemon: p, message: null };
    const result = resolveSitrusBerry(p); return { pokemon: result.pokemon, message: result.activated ? 'berry' : null };
  }, tryActivatePinchStatBerry: (p) => ({ pokemon: p, message: null }), random: () => 0.99 });
const damage = (m: Move, a = pokemon(), d = pokemon(2), random = () => 0.5) => calculateDamage({
  move: m, attacker: a, defender: d, weather: 'none', fieldState: [], atkBuff: false, defBuff: false, random });
function before(state: BattleSnapshot, m: Move, side: 'player' | 'enemy' = 'player') {
  const combatant = side === 'player' ? state.playerTeam[0] : state.enemyTeam[0];
  return resolveBeforeMoveChecks({ snapshot: state, side, combatant, move: m, displayName: combatant.name,
    hasAbilityEffect: () => false, isMoveUsableWhileAsleep: () => false,
    getEncoredMove: (p) => p?.selectedMoves.find((entry) => entry.name === p.volatileStatuses?.encore?.linkedMoveName) ?? null,
    getMoveCurrentPp: (m) => m.currentPp ?? m.pp ?? 0,
    tryConsumeStatusCureBerry: (p) => ({ pokemon: p, message: null }),
    tryConsumeMentalHerb: (p) => { if (!p) return { pokemon: p, message: null };
      const result = resolveMentalHerb(p); return { pokemon: result.pokemon, message: result.cleared.length ? 'herb' : null }; },
    calculateConfusionSelfHitDamage: () => 0, random: () => 0.99 });
}

function actualControllerCallback(name: string, scope: Record<string, any>, plain = false) {
  const source = readFileSync(new URL('../../../../src/features/game/hooks/useBattleController.ts', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('controller.ts', source, ts.ScriptTarget.Latest, true);
  let expression = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name && node.initializer) {
      expression = !plain && ts.isCallExpression(node.initializer) ? node.initializer.arguments[0].getText(tree) : node.initializer.getText(tree);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.ok(expression, name);
  const js = ts.transpileModule(`const actual = ${expression}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(scope), `${js}; return actual`)(...Object.values(scope));
}

async function calledMoveAction(called: Move, actingSide: 'player' | 'enemy', playerReserve: boolean, enemyReserve: boolean, focusAtOneHp = false, entryMode = 'normal') {
  const talk = STRUGGLE_MOVE; const calls: string[] = []; const epoch = {current:{epoch:1}};
  let actor = pokemon(1, { currentHp: focusAtOneHp ? 200 : 1, selectedMoves: [{...called,currentPp:0}] });
  
  const target = pokemon(2, {currentHp:1, factoryHeldItemId: focusAtOneHp ? 'focus_band' : undefined}); const state = actingSide === 'player' ? snapshot(actor, target) : snapshot(target, actor); if (playerReserve) state.playerTeam.push(pokemon(3)); if (enemyReserve) state.enemyTeam.push(pokemon(4)); const messages: string[] = [];
  const inertItem = (p: GamePokemon) => ({ pokemon: p, message: null });
  const scope: Record<string, any> = {
    ...battleData, ...battleStatus, ...battleLog, ...protection, ...healBlock, ...strikes,
    prepareMoveUse, resolveHeldItemHit, struggleRecoil,
    pendingPlayerSwitchRef: {current:false}, battleInstanceRef: epoch, battleMountedRef: {current:true}, liveBattleStateRef: {current:{gameState:'BATTLE'}}, winBattle: async () => {calls.push('WIN');}, loseBattle: async () => {calls.push('LOSS');}, sendOutNextPlayer: async () => { calls.push('sendOutNextPlayer'); return playerReserve; }, sendOutNextEnemy: async () => { calls.push('sendOutNextEnemy'); if(entryMode === 'stale') epoch.current.epoch++; if(entryMode === 'ended') {state.enemyTeam=state.enemyTeam.map(p=>({...p,currentHp:0})); calls.push('WIN-scheduled'); return false;} return enemyReserve; }, activeBuffs: {}, enemyBuffs: {}, currentLanguage: 'zh-hans',
    getHeldItemLabel: (id: string) => id, getLocalized: (p: any) => p.name, t: (key: string) => key,
    setPlayerAnim: () => {}, setEnemyAnim: () => {}, setActiveMoveType: () => {}, setActiveBuffs: () => {},
    setPlayerTeam: (team: GamePokemon[]) => { state.playerTeam = team; },
    syncEnemyLead: (lead: GamePokemon, team: GamePokemon[]) => { const next = [...team]; next[0] = lead; state.enemyTeam = next; return next; },
    hasHeldItemEffect: (p: GamePokemon, effect: string) => battleData.hasItemBattleEffect(p.factoryHeldItemId, effect),
    hasPrimaryAbilityEffect: (p: GamePokemon, effect: string) => battleData.hasAbilityBattleEffect(p.abilities?.[0]?.ability?.name, effect),
    isSleepPreventingFieldActive: () => false,
    Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
    addMessagesSequentially: async (lines: string[]) => { messages.push(...lines); },
    announceHpChange: async () => {},
    tryActivateWhiteHerb: inertItem, tryConsumeMentalHerb: inertItem, tryConsumeStatusCureBerry: inertItem,
    tryActivateSitrusBerry: inertItem, tryActivatePinchStatBerry: inertItem,
    liveFieldRef: { current: state },
    calculateDamage: (m: Move, a: GamePokemon, d: GamePokemon) => damage(m, a, d),
    applyMoveSecondaryEffects: async (o: any) => applyMoveSecondaryEffects({ ...o, teams: { playerTeam: o.playerTeam, enemyTeam: o.enemyTeam }, getLocalized: (p) => p.name, random: () => 0.99 }),
  };
  scope.SLEEP_TALK_BANNED_MOVE_NAMES = actualControllerCallback('SLEEP_TALK_BANNED_MOVE_NAMES', {}, true);
  scope.isSleepTalkBannedMove = actualControllerCallback('isSleepTalkBannedMove', scope);
  scope.chooseSleepTalkMove = actualControllerCallback('chooseSleepTalkMove', scope);
  scope.isProtectLikeMove = actualControllerCallback('isProtectLikeMove', scope);
  const execute = actualControllerCallback('executeTurn', scope);
  await execute({ actingSide, move: talk, actor, actorTeam: actingSide === 'player' ? state.playerTeam : state.enemyTeam, defender: target, defenderTeam: actingSide === 'player' ? state.enemyTeam : state.playerTeam });
  const round = await executeRoundTransaction(startRound(1,1,actingSide), { isCurrent: () => epoch.current.epoch === 1, runAction: async () => ({status: 'ACTED', battleEnded: state.playerTeam.every(p => p.currentHp <= 0) || state.enemyTeam.every(p => p.currentHp <= 0)}), runEndTurn: async () => { calls.push('end-turn'); return {}; } }); return {actingSide, playerReserve, enemyReserve, focusAtOneHp, entryMode, hp: [state.playerTeam[0].currentHp, state.enemyTeam[0].currentHp], calls, endTurnCommitted:round.endTurnCommitted, messages};
}

for (const side of ['player','enemy'] as const) for (const p of [false,true]) for (const e of [false,true]) console.log(JSON.stringify(await calledMoveAction(move(),side,p,e)));
const originalRandom = Math.random; try { Math.random = () => 0.05; console.log(JSON.stringify(await calledMoveAction(move(),'player',false,false,true))); } finally { Math.random = originalRandom; }
for (const side of ['player','enemy'] as const) for(const mode of ['ended','stale']) console.log(JSON.stringify(await calledMoveAction(move(),side,true,true,false,mode)));
