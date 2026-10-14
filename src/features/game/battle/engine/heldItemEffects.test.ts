import test from 'node:test';
import ts from 'typescript';
import * as battleData from '../../data/battle';
import * as battleStatus from '../../utils/battleStatus';
import * as battleLog from '../battleLogText';
import * as protection from './resolveProtection';
import * as healBlock from './resolveHealBlock';
import * as strikes from './resolveMoveStrikes';
import * as resolution from '../../lib/battleResolution';
import * as roundSteps from './roundTransaction';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { GamePokemon, Move } from '../../../../types';
import { buildMoveBattleDataFromPokeApiMove } from '../../data/battle';
import { applyMoveSecondaryEffects, applyWeatherChipDamage } from '../../lib/battleResolution';
import { setVolatileStatus, setNonVolatileStatus, hasVolatileStatus } from '../../utils/battleStatus';
import { prepareFactoryPartyForBattle, restoreFactoryParty } from '../../utils/restoreFactoryParty';
import { calculateDamage } from './resolveDamage';
import { resolveActionSelection } from './resolveActionSelection';
import { resolveFlinch } from './resolveFlinch';
import { isMoveHealBlocked } from './resolveHealBlock';
import { resolveHeldItemHit } from './resolveHeldItemHit';
import { resolveMentalHerb } from './resolveMentalHerb';
import { resolveSitrusBerry } from './resolveHealingItem';
import { resolveLegalMoves, STRUGGLE_MOVE, struggleRecoil } from './resolveLegalMoves';
import { prepareMoveUse } from './prepareMoveUse';
import { resolveBeforeMoveChecks } from './resolveBeforeMoveChecks';
import { resolveEndTurn } from './resolveEndTurn';
import { clearSwitchingBattleState } from './resolveSwitchState';
import { resolveTypeImmunityReaction } from './resolveTypeImmunityReaction';
import { resolveMoveStrikePlan } from './resolveMoveStrikes';
import { resolveEntryHazards, createEmptyBattleHazards } from './resolveEntryHazards';
import { resolveControllerProtectionCollision } from '../../hooks/useBattleController';
import { executeRoundTransaction, startRound } from './roundTransaction';
import type { BattleSnapshot } from './types';

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

test('Quick Claw stays within priority; both/no proc preserve speed and Trick Room', () => {
  const slow = pokemon(1, { calculatedStats: { ...stats, speed: 30 } });
  const fast = pokemon(2);
  const select = (playerMove: Move, enemyMove: Move, pc = true, ec = false, room = false) => resolveActionSelection({
    playerPokemon: slow, enemyPokemon: fast, playerMove, enemyMove, playerQuickClawActivated: pc,
    enemyQuickClawActivated: ec, fieldState: room ? ['trick_room'] : [], random: () => 0.9 }).enemyActsFirst;
  assert.equal(select(move(), move('aqua-jet', { priority: 1 })), true);
  assert.equal(select(move('aqua-jet', { priority: 1 }), move(), false, true), false);
  assert.equal(select(move(), move()), false);
  assert.equal(select(move(), move(), true, true), true);
  assert.equal(select(move(), move(), false, false, true), false);
});

test('Scope Lens changes the actual crit boundary; Choice Band boosts only physical damage', () => {
  const target = pokemon(2); const actor = pokemon();
  const lens = { ...actor, factoryHeldItemId: 'scope_lens' };
  assert.equal(damage(move(), actor, target, () => 0.1).isCrit, false);
  assert.equal(damage(move(), lens, target, () => 0.1).isCrit, true);
  const band = { ...actor, factoryHeldItemId: 'choice_band' };
  assert.ok(damage(move(), band).damage > damage(move(), actor).damage);
  const special = move('surf', { type: { name: 'water' }, damage_class: { name: 'special' } });
  assert.equal(damage(special, band).damage, damage(special, actor).damage);
  assert.equal(damage(move('growl', { damage_class: { name: 'status' }, power: null }), lens).damage, 0);
  assert.equal(lens.factoryHeldItemId, 'scope_lens');
});

test('King’s Rock uses two independent rolls and preserves post-roll immunity ordering', () => {
  const attack = move('dark-pulse'); const actor = pokemon(); const target = pokemon(2);
  const run = (rolls: number[], changes: Partial<Parameters<typeof resolveFlinch>[0]> = {}) => {
    let count = 0;
    const result = resolveFlinch({ move: attack, actor, target, nativeChance: 20, itemChance: 10,
      targetHasActed: false, allowTargetEffects: true, ...changes, random: () => rolls[count++] });
    return { ...result, count };
  };
  assert.deepEqual(run([0.8, 0.05]), { flinched: true, kingsRockFlinched: true, count: 2 });
  assert.deepEqual(run([0.05, 0.8]), { flinched: true, kingsRockFlinched: false, count: 2 });
  assert.equal(run([0.05, 0.05]).count, 2);
  assert.equal(run([0.8, 0.8]).flinched, false);
  for (const immunity of ['inner-focus', 'shield-dust']) {
    assert.deepEqual(run([0, 0], { target: { ...target, abilities: ability(immunity) } }), { flinched: false, kingsRockFlinched: false, count: 2 });
  }
  assert.deepEqual(run([0], { nativeChance: 0, actor: { ...actor, abilities: ability('stench') } }), { flinched: false, kingsRockFlinched: false, count: 1 });
  assert.equal(run([0, 0], { actor: { ...actor, abilities: ability('sheer-force') } }).flinched, false);
  assert.equal(run([0.35, 0.15], { actor: { ...actor, abilities: ability('serene-grace') } }).flinched, true);
  assert.equal(run([0, 0], { targetHasActed: true }).flinched, false);
  assert.equal(run([], { nativeChance: 0, itemChance: 0 }).count, 0);
  assert.equal(run([0], { move: { ...attack, battleData: { ...attack.battleData!, ignoresKingsRock: true } } }).count, 1);
});

test('Focus Band remains equipped across two lethal hits; nonlethal hits do not roll', () => {
  let mon = pokemon(2, { currentHp: 10, factoryHeldItemId: 'focus_band', factoryEquippedHeldItemId: 'focus_band' });
  for (let i = 0; i < 2; i++) {
    const hit = resolveHeldItemHit(mon, 100, () => 0.09);
    assert.equal(hit.focusBandTriggered, true); mon = { ...mon, currentHp: hit.hp };
    assert.equal(mon.currentHp, 1); assert.equal(mon.factoryHeldItemId, 'focus_band');
  }
  assert.equal(resolveHeldItemHit(mon, 1, () => 0.1).hp, 0);
  assert.equal(resolveHeldItemHit(pokemon(), 1, () => { throw Error('ineligible roll'); }).hp, 199);
  assert.equal(resolveHeldItemHit({ ...mon, factoryHeldItemId: undefined }, 5, () => 0).hp, 0);
  const poisoned = setNonVolatileStatus(mon, 'poison');
  assert.equal(end(snapshot(poisoned)).playerLead.currentHp, 0);
});

test('Choice-lock legal set and Struggle PP handling are shared for both sides', () => {
  const first = { ...move(), currentPp: 1 }; const other = move('surf');
  let mon = pokemon(1, { selectedMoves: [first, other], factoryHeldItemId: 'choice_band' });
  mon = prepareMoveUse(mon, first);
  assert.equal(mon.factoryChoiceLockedMoveName, first.name);
  assert.equal(resolveLegalMoves(mon).struggle, true);
  assert.equal(prepareMoveUse(mon, STRUGGLE_MOVE), mon);
  assert.equal(resolveLegalMoves({ ...mon, factoryHeldItemId: undefined }).struggle, false);
  assert.equal(clearSwitchingBattleState(mon).factoryChoiceLockedMoveName, null);
  assert.equal(resolveLegalMoves(pokemon(2, { selectedMoves: [{ ...other, currentPp: 0 }] })).struggle, true);
  assert.equal(resolveLegalMoves(pokemon(2)).struggle, false);
  const disabled = setVolatileStatus(pokemon(), 'disable', { linkedMoveName: 'tackle' });
  assert.equal(resolveLegalMoves(disabled).struggle, true);
  assert.equal(resolveLegalMoves({ ...disabled, factoryHeldItemId: 'mental_herb' }).struggle, false);
});

test('Struggle has no STAB or typing, still respects protection and fixed-source recoil exemptions', () => {
  const actor = pokemon(); const otherType = { ...actor, types: [{ type: { name: 'water' } }] };
  const baseline = damage(STRUGGLE_MOVE, actor).damage;
  for (const type of ['ghost', 'rock', 'steel']) {
    assert.equal(damage(STRUGGLE_MOVE, actor, pokemon(2, { types: [{ type: { name: type } }] })).damage, baseline);
  }
  assert.equal(damage(STRUGGLE_MOVE, otherType).damage, baseline);
  assert.equal(damage(STRUGGLE_MOVE, { ...actor, specialBoostActive: true, specialBoostMode: 'ZMOVE' }).damage, baseline);
  assert.equal(damage(STRUGGLE_MOVE, actor, setVolatileStatus(pokemon(2), 'protect')).damage, 0);
  assert.equal(struggleRecoil({ ...actor, maxHp: 203 }), 50);
  assert.equal(struggleRecoil({ ...actor, maxHp: 3 }), 1);
  assert.equal(struggleRecoil({ ...actor, abilities: ability('magic-guard') }), 0);
  assert.equal(struggleRecoil({ ...actor, abilities: ability('rock-head') }), 50);
});

test('Loaded Dice/Skill Link plan and real per-hit results stop at fainting with one PP use', () => {
  const attack = move('bullet-seed', { meta: { min_hits: 2, max_hits: 5 } });
  const mon = pokemon(1, { factoryHeldItemId: 'loaded_dice', selectedMoves: [attack] });
  assert.equal(resolveMoveStrikePlan({ move: attack, attacker: mon, random: () => 0 }).plannedHits, 4);
  assert.equal(resolveMoveStrikePlan({ move: attack, attacker: mon, random: () => 0.5 }).plannedHits, 5);
  assert.equal(resolveMoveStrikePlan({ move: attack, attacker: { ...mon, abilities: ability('skill-link') }, random: () => { throw Error('no dice roll'); } }).plannedHits, 5);
  const used = prepareMoveUse(mon, attack); let target = pokemon(2, { currentHp: 1 }); let hits = 0;
  for (let i = 0; i < resolveMoveStrikePlan({ move: attack, attacker: used, random: () => 0 }).plannedHits; i++) {
    target = { ...target, currentHp: resolveHeldItemHit(target, damage(attack, used, target).damage).hp }; hits++;
    if (target.currentHp <= 0) break;
  }
  assert.equal(hits, 1); assert.equal(used.selectedMoves[0].currentPp, 9);
  assert.equal(resolveMoveStrikePlan({ move: move(), attacker: mon }).plannedHits, 1);
});

test('All six Mental Herb restrictions clear together once, with baselines and unrelated status retained', () => {
  let mon = pokemon(1, { factoryHeldItemId: 'mental_herb', factoryEquippedHeldItemId: 'mental_herb' });
  const ids = ['attract', 'infatuation', 'taunt', 'encore', 'torment', 'disable', 'heal_block'];
  for (const id of ids) {
    const one = setVolatileStatus(mon, id, { linkedMoveName: 'tackle', turnsRemaining: 4 });
    assert.ok(resolveMentalHerb(one).cleared.includes(id));
    mon = setVolatileStatus(mon, id, { linkedMoveName: 'tackle', turnsRemaining: 4 });
  }
  mon = setNonVolatileStatus(setVolatileStatus(mon, 'confusion', { turnsRemaining: 3 }), 'poison');
  const result = resolveMentalHerb(mon);
  assert.equal(result.cleared.length, 7); assert.equal(result.pokemon.factoryHeldItemId, undefined);
  assert.equal(result.pokemon.factoryEquippedHeldItemId, 'mental_herb');
  assert.equal(result.pokemon.nonVolatileStatus?.id, 'poison'); assert.ok(result.pokemon.volatileStatuses?.confusion);
  assert.equal(resolveMentalHerb(result.pokemon).cleared.length, 0);
  assert.equal(prepareFactoryPartyForBattle([result.pokemon])[0].factoryHeldItemId, 'mental_herb');
});

test('Natural no-flags move body reaches contact/King Shield/White Herb through the production builder', () => {
  const cache = JSON.parse(readFileSync(new URL('./fixtures/rogue-tm-direct-cache.json', import.meta.url), 'utf8'));
  const raw = cache.moves['aqua-jet'].data;
  assert.equal(raw.flags, undefined);
  const attack = move(raw.name, raw); assert.equal(attack.battleData?.makesContact, true);
  const actor = pokemon(1, { factoryHeldItemId: 'white_herb', factoryEquippedHeldItemId: 'white_herb' });
  const shield = setVolatileStatus(pokemon(2), 'protect', { sourceMoveName: 'kings-shield' });
  const result = resolveControllerProtectionCollision(actor, shield, attack, 'zh-hans', (p) => p.name, () => '白色香草');
  assert.equal(result.attacker.statStages.attack, 0); assert.equal(result.attacker.factoryHeldItemId, undefined);
  assert.ok(result.whiteHerbMessage); assert.equal(result.attacker.factoryEquippedHeldItemId, 'white_herb');
  const noncontact = resolveControllerProtectionCollision(actor, shield, move('surf'), 'zh-hans', (p) => p.name, () => '白色香草');
  assert.equal(noncontact.attacker.factoryHeldItemId, 'white_herb');
});

test('Boots preserve poison absorption ordering on either side without preventing ordinary damage', () => {
  for (const side of ['player', 'enemy'] as const) {
    const hazards = createEmptyBattleHazards(); hazards[side] = { stealthRock: true, toxicSpikesLayers: 2 };
    const boots = pokemon(1, { factoryHeldItemId: 'heavy_duty_boots' });
    const safe = resolveEntryHazards(boots, side, hazards);
    assert.equal(safe.pokemon.currentHp, 200); assert.equal(safe.pokemon.nonVolatileStatus, undefined);
    assert.equal(safe.hazards[side].toxicSpikesLayers, 2);
    const poison = resolveEntryHazards({ ...boots, types: [{ type: { name: 'poison' } }] }, side, hazards);
    assert.equal(poison.hazards[side].toxicSpikesLayers, 0);
    const flying = resolveEntryHazards({ ...boots, types: [{ type: { name: 'poison' } }, { type: { name: 'flying' } }] }, side, hazards);
    assert.equal(flying.hazards[side].toxicSpikesLayers, 2);
    assert.ok(damage(move(), pokemon(2), boots).damage > 0);
  }
});

const statusMove = (name: string, raw: Record<string, any> = {}) => move(name, {
  power: null, damage_class: { name: 'status' }, type: { name: 'psychic' }, ...raw,
});
function effects(attack: Move, state: BattleSnapshot, side: 'player' | 'enemy' = 'player') {
  const actor = side === 'player' ? state.playerTeam[0] : state.enemyTeam[0];
  const target = side === 'player' ? state.enemyTeam[0] : state.playerTeam[0];
  const hit = damage(attack, actor, target);
  if (hit.isMiss) return state;
  const next = applyMoveSecondaryEffects({ move: attack, actingSide: side, teams: state,
    fieldState: state.fieldState, getLocalized: (p) => p.name,
    allowUserEffects: hit.applyUserSecondaryEffects, allowTargetEffects: hit.applyTargetSecondaryEffects, random: () => 0.99 });
  return { ...state, playerTeam: next.playerTeam, enemyTeam: next.enemyTeam };
}

test('Heal Block builder and actual hit pipeline respect accuracy, Protect, substitute and Aroma Veil', () => {
  const attack = statusMove('heal-block');
  assert.equal(attack.battleData?.target, 'all-opponents');
  for (const side of ['player', 'enemy'] as const) {
    const actor = pokemon(1, { selectedMoves: [attack] });
    const target = pokemon(2, { types: [{ type: { name: 'dark' } }] });
    const state = side === 'player' ? snapshot(actor, target) : snapshot(target, actor);
    const getTarget = (s: BattleSnapshot) => side === 'player' ? s.enemyTeam[0] : s.playerTeam[0];
    const result = effects(attack, state, side);
    assert.equal(getTarget(result).volatileStatuses?.heal_block?.turnsRemaining, 5);
    const old = getTarget(result); const second = { ...result };
    if (side === 'player') second.enemyTeam = [blocked(old, 2)]; else second.playerTeam = [blocked(old, 2)];
    assert.equal(getTarget(effects(attack, second, side)).volatileStatuses?.heal_block?.turnsRemaining, 2);
  }
  const substitute = setVolatileStatus(pokemon(2), 'substitute', { counter: 40 });
  const through = effects(attack, snapshot(pokemon(), substitute));
  assert.ok(through.enemyTeam[0].volatileStatuses?.heal_block);
  assert.equal(through.enemyTeam[0].volatileStatuses?.substitute?.counter, 40);
  const protectedTarget = setVolatileStatus(pokemon(2), 'protect');
  assert.equal(effects(attack, snapshot(pokemon(), protectedTarget)).enemyTeam[0].volatileStatuses?.heal_block, undefined);
  const miss = statusMove('heal-block', { accuracy: 1 });
  assert.equal(effects(miss, snapshot(pokemon(), pokemon(2))).enemyTeam[0].volatileStatuses?.heal_block, undefined);
  assert.equal(effects(attack, snapshot(pokemon(), pokemon(2, { abilities: ability('aroma-veil') }))).enemyTeam[0].volatileStatuses?.heal_block, undefined);
  const herbTarget = pokemon(2, { factoryHeldItemId: 'mental_herb', factoryEquippedHeldItemId: 'mental_herb' });
  const inflicted = effects(attack, snapshot(pokemon(), herbTarget)).enemyTeam[0];
  const cured = resolveMentalHerb(inflicted);
  assert.deepEqual(cured.cleared, ['heal_block']); assert.equal(cured.pokemon.factoryHeldItemId, undefined);
  assert.equal(cured.pokemon.factoryEquippedHeldItemId, 'mental_herb');
});

test('Faster Heal Block stops a previously selected drain/Rest before damage, healing, status cure and PP on both sides', async () => {
  for (const slowSide of ['player', 'enemy'] as const) for (const name of ['absorb', 'rest']) {
    const attack = statusMove('heal-block');
    const selected = name === 'rest' ? statusMove(name) : move(name, { power: 20, type: { name: 'grass' }, meta: { drain: 50 } });
    const slow = setNonVolatileStatus(pokemon(2, { currentHp: 80, selectedMoves: [selected] }), 'poison');
    let state = slowSide === 'player' ? snapshot(slow, pokemon(1, { selectedMoves: [attack] })) : snapshot(pokemon(1, { selectedMoves: [attack] }), slow);
    const fastSide = slowSide === 'player' ? 'enemy' : 'player';
    let blockedAction = false;
    const result = await executeRoundTransaction(startRound(1, 1, fastSide), {
      isCurrent: () => true,
      runAction: async (side) => {
        if (side === fastSide) { state = effects(attack, state, side); return { status: 'ACTED' }; }
        const check = before(state, selected, side); state = check.snapshot; blockedAction = !check.canAct;
        assert.equal(check.canAct, false); assert.ok(check.events.length);
        assert.equal(check.combatant.currentHp, 80); assert.equal(check.combatant.nonVolatileStatus?.id, 'poison');
        assert.equal(check.combatant.selectedMoves[0].currentPp, undefined);
        assert.equal(resolveLegalMoves(check.combatant).struggle, true);
        return { status: 'SKIPPED' };
      },
      runEndTurn: async () => { state = end(state).snapshot; return {}; },
    });
    assert.equal(result.phase, 'DONE'); assert.equal(result[slowSide], 'SKIPPED'); assert.ok(blockedAction);
    assert.equal((slowSide === 'player' ? state.enemyTeam[0] : state.playerTeam[0]).currentHp, 200);
  }
});

test('Heal Block forbids fifth-round recovery and HP-berry consumption, then expires; switch/new battle clear it', () => {
  for (const item of ['leftovers', 'sitrus_berry']) {
    let mon = setVolatileStatus(blocked(pokemon(1, { currentHp: 60, factoryHeldItemId: item }), 1), 'ingrain');
    mon = setVolatileStatus(mon, 'flinch');
    let state = snapshot(mon, blocked(pokemon(2, { currentHp: 60, factoryHeldItemId: item }), 1));
    state.fieldState = ['grassy_terrain']; state.fieldTurns = { grassy_terrain: 5 };
    const fifth = end(state);
    assert.equal(fifth.playerLead.currentHp, 60); assert.equal(fifth.enemyLead.currentHp, 60);
    assert.equal(fifth.playerLead.factoryHeldItemId, item); assert.equal(fifth.playerLead.volatileStatuses?.heal_block, undefined);
    assert.equal(fifth.playerLead.volatileStatuses?.flinch, undefined);
    const sixth = end(fifth.snapshot);
    assert.ok(sixth.playerLead.currentHp > 60); assert.ok(sixth.enemyLead.currentHp > 60);
    if (item === 'sitrus_berry') assert.equal(sixth.playerLead.factoryHeldItemId, undefined);
  }
  let mon = blocked(pokemon());
  for (let turn = 4; turn >= 1; turn--) {
    mon = end(snapshot(mon)).playerLead;
    const restored = JSON.parse(JSON.stringify(mon)) as GamePokemon;
    assert.equal(restored.volatileStatuses?.heal_block?.turnsRemaining, turn);
  }
  assert.equal(end(snapshot(mon)).playerLead.volatileStatuses?.heal_block, undefined);
  assert.equal(clearSwitchingBattleState(blocked(pokemon())).volatileStatuses?.heal_block, undefined);
  assert.equal(prepareFactoryPartyForBattle([blocked(pokemon())])[0].volatileStatuses?.heal_block, undefined);
});

test('Heal Block preserves weather/absorption immunity and Liquid Ooze damage while withholding HP gains', () => {
  for (const [name, weather] of [['rain-dish', 'rainy'], ['dry-skin', 'rainy'], ['ice-body', 'hail']] as const) {
    const mon = pokemon(1, { currentHp: 80, abilities: ability(name) });
    const invoke = (p: GamePokemon) => applyWeatherChipDamage({ pokemon: p, weather, getLocalized: (m) => m.name });
    assert.ok(invoke(mon).pokemon.currentHp > 80);
    assert.equal(invoke(blocked(mon)).pokemon.currentHp, 80);
  }
  const dry = blocked(pokemon(1, { currentHp: 80, abilities: ability('dry-skin') }));
  assert.ok(applyWeatherChipDamage({ pokemon: dry, weather: 'sunny', getLocalized: (p) => p.name }).pokemon.currentHp < 80);
  for (const [name, type] of [['water-absorb', 'water'], ['volt-absorb', 'electric'], ['earth-eater', 'ground'], ['dry-skin', 'water']]) {
    const mon = pokemon(2, { currentHp: 80, abilities: ability(name) }); const attack = move('attack', { type: { name: type } });
    assert.equal(damage(attack, pokemon(), blocked(mon)).damage, 0);
    assert.equal(resolveTypeImmunityReaction(attack, blocked(mon), [], pokemon()).defender.currentHp, 80);
    assert.ok(resolveTypeImmunityReaction(attack, mon, [], pokemon()).defender.currentHp > 80);
  }
  const seeded = setVolatileStatus(pokemon(2), 'seeded');
  assert.equal(end(snapshot(blocked(pokemon(1, { currentHp: 80 })), seeded)).playerLead.currentHp, 80);
  assert.equal(end(snapshot(blocked(pokemon(1, { currentHp: 80 })), { ...seeded, abilities: ability('liquid-ooze') })).playerLead.currentHp, 55);
});

test('Target healing uses the recipient and fixed-source fractions; Heal Block exceptions remain selectable', () => {
  const actor = pokemon(1, { currentHp: 30 }); const target = pokemon(2, { currentHp: 10 });
  const pulse = statusMove('heal-pulse'); const floral = statusMove('floral-healing');
  const healed = effects(pulse, snapshot(actor, target));
  assert.equal(healed.playerTeam[0].currentHp, 30); assert.equal(healed.enemyTeam[0].currentHp, 110);
  assert.equal(effects(pulse, snapshot(blocked(actor), target)).enemyTeam[0].currentHp, 10);
  assert.equal(effects(pulse, snapshot(actor, blocked(target))).enemyTeam[0].currentHp, 10);
  const grassy = snapshot(actor, target); grassy.fieldState = ['grassy_terrain'];
  assert.equal(effects(floral, grassy).enemyTeam[0].currentHp, 143);
  assert.equal(effects(pulse, snapshot({ ...actor, abilities: ability('mega-launcher') }, target)).enemyTeam[0].currentHp, 160);
  for (const name of ['pain-split', 'present']) {
    const attack = name === 'present' ? move(name) : statusMove(name);
    const mon = blocked(pokemon(1, { selectedMoves: [attack] }));
    assert.equal(resolveLegalMoves(mon).struggle, false); assert.equal(before(snapshot(mon), attack).canAct, true);
  }
  const present = move('present');
  assert.ok((damage(present, blocked(actor), blocked(target), () => 0.99).targetHealing ?? 0) > 0);
});


test('Poison Heal under Heal Block gains no HP and keeps ordinary/toxic damage immunity', () => {
  for (const status of ['poison', 'bad_poison'] as const) {
    const mon = setNonVolatileStatus(pokemon(1, { currentHp: 80, abilities: ability('poison-heal') }), status);
    assert.equal(end(snapshot(mon)).playerLead.currentHp, 105);
    assert.equal(end(snapshot(blocked(mon))).playerLead.currentHp, 80);
    const full = end(snapshot({ ...mon, currentHp: 200 })).playerLead;
    assert.equal(full.currentHp, 200);
    assert.ok(end(snapshot(setNonVolatileStatus(pokemon(1, { currentHp: 80 }), status))).playerLead.currentHp < 80);
  }
});



// Parse and execute the production callback as existing collection callback tests do.
// No browser, no copied action algorithm, only presentation setters are inert.
function actualControllerCallback(name: string, scope: Record<string, any>, plain = false) {
  const source = readFileSync(new URL('../../hooks/useBattleController.ts', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('controller.ts', source, ts.ScriptTarget.Latest, true);
  let expression = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name && node.initializer) {
      expression = !plain && ts.isCallExpression(node.initializer) ? node.initializer.arguments[0].getText(tree) : node.initializer.getText(tree);
    }
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name?.text === name) expression = node.getText(tree);
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.ok(expression, name);
  const js = ts.transpileModule(`const actual = ${expression}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(scope), `${js}; return actual`)(...Object.values(scope));
}

async function calledMoveAction(called: Move, healBlocked: boolean, extra?: Move) {
  const talk = statusMove('sleep-talk');
  let actor = setNonVolatileStatus(pokemon(1, { currentHp: 80, selectedMoves: [talk, called, ...(extra ? [extra] : [])] }), 'sleep', { turnsRemaining: 3 });
  if (healBlocked) actor = blocked(actor);
  const state = snapshot(actor, pokemon(2)); const messages: string[] = [];
  const inertItem = (p: GamePokemon) => ({ pokemon: p, message: null });
  const scope: Record<string, any> = {
    ...battleData, ...battleStatus, ...battleLog, ...protection, ...healBlock, ...strikes,
    prepareMoveUse, resolveHeldItemHit, struggleRecoil,
    activeBuffs: {}, enemyBuffs: {}, currentLanguage: 'zh-hans',
    getLocalized: (p: any) => p.name, t: (key: string) => key,
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
  await execute({ actingSide: 'player', move: talk, actor, actorTeam: state.playerTeam, defender: state.enemyTeam[0], defenderTeam: state.enemyTeam });
  return { state, messages };
}

test('Real controller Sleep Talk respects Heal Block candidate selection and spends only its own PP', async () => {
  for (const called of [statusMove('rest'), move('absorb', { meta: { drain: 50 } })]) {
    const denied = await calledMoveAction(called, true);
    assert.equal(denied.state.playerTeam[0].selectedMoves[0].currentPp, 9);
    assert.equal(denied.state.playerTeam[0].selectedMoves[1].currentPp, undefined);
    assert.equal(denied.state.playerTeam[0].currentHp, 80);
    assert.equal(denied.state.playerTeam[0].nonVolatileStatus?.id, 'sleep');
    assert.equal(denied.state.enemyTeam[0].currentHp, 200);
    assert.ok(denied.messages.some((line) => line.includes('梦话失败')));
  }
  const drain = move('absorb', { meta: { drain: 50 } });
  const allowed = await calledMoveAction(drain, false);
  assert.ok(allowed.state.enemyTeam[0].currentHp < 200);
  assert.ok(allowed.state.playerTeam[0].currentHp > 80);
  assert.equal(allowed.state.playerTeam[0].selectedMoves[0].currentPp, 9);
  assert.equal(allowed.state.playerTeam[0].selectedMoves[1].currentPp, undefined);
  const mixed = await calledMoveAction(drain, true, move('tackle'));
  assert.ok(mixed.state.enemyTeam[0].currentHp < 200);
  assert.equal(mixed.state.playerTeam[0].currentHp, 80);
  assert.equal(mixed.state.playerTeam[0].selectedMoves[2].currentPp, undefined);
});


async function faintingRound(options: {
  actingSide: 'player' | 'enemy'; playerReserve: boolean; enemyReserve: boolean;
  actorHp?: number; targetHp?: number; actorAbility?: string; protect?: boolean; substitute?: boolean;
  actorItem?: string; targetItem?: string; enemyHazardWipe?: boolean; invalidateOnEnemyEntry?: boolean;
}) {
  const exhausted = { ...move(), currentPp: 0 };
  const actor = pokemon(1, { currentHp: options.actorHp ?? 1, selectedMoves: [exhausted],
    abilities: ability(options.actorAbility ?? 'run-away'), factoryHeldItemId: options.actorItem });
  let target = pokemon(2, { currentHp: options.targetHp ?? 1, selectedMoves: [exhausted], factoryHeldItemId: options.targetItem });
  if (options.protect) target = setVolatileStatus(target, 'protect');
  if (options.substitute) target = setVolatileStatus(target, 'substitute', { counter: 1 });
  const state = Object.assign(options.actingSide === 'player' ? snapshot(actor, target) : snapshot(target, actor), { gameState: 'BATTLE' });
  if (options.playerReserve) state.playerTeam.push(pokemon(3));
  if (options.enemyReserve) state.enemyTeam.push(pokemon(4, { currentHp: options.enemyHazardWipe ? 1 : 200 }));
  if (options.enemyHazardWipe) state.hazards.enemy.stealthRock = true;
  const calls: string[] = []; const messages: string[] = []; const schedules: Array<() => void> = [];
  const replacements: Promise<unknown>[] = []; const actions: string[] = []; const finals: any[] = []; const actionSnapshots: BattleSnapshot[] = [];
  const inertItem = (p: GamePokemon) => ({ pokemon: p, message: null });
  const scope: Record<string, any> = {
    ...battleData, ...battleStatus, ...battleLog, ...protection, ...healBlock, ...strikes, ...roundSteps, ...resolution,
    prepareMoveUse, resolveHeldItemHit, struggleRecoil, resolveLegalMoves, resolveControllerProtectionCollision,
    clearSwitchingBattleState, resolveEntryHazards, resolveBeforeMoveChecksStep: resolveBeforeMoveChecks,
    activeBuffs: {}, enemyBuffs: {}, currentLanguage: 'zh-hans', playerTeam: state.playerTeam,
    enemyTeam: state.enemyTeam, enemy: state.enemyTeam[0], gameState: 'BATTLE', turn: 'PLAYER', isMessageProcessing: false,
    fieldState: [], tailwindTurns: state.tailwindTurns, weather: 'none', enemyAiTier: 0,
    liveBattleStateRef: { current: state }, liveFieldRef: { current: state }, hazardsRef: { current: state.hazards },
    battleMountedRef: { current: true }, battleInstanceRef: { current: { epoch: 1 } },
    roundTransactionRef: { current: null }, roundActionLockedRef: { current: false }, nextRoundIdRef: { current: 0 },
    replacementWaitRef: { current: null }, pendingPlayerSwitchRef: { current: false }, pendingForcedPlayerTurnRef: { current: null },
    getLocalized: (p: any) => p.name, getHeldItemLabel: (id: string) => id,
    t: (key: string) => `${key}:{name}:{move}`, getAiFlagsForTier: () => 0,
    setPlayerAnim: () => {}, setEnemyAnim: () => {}, setActiveMoveType: () => {}, setActiveBuffs: () => {},
    setTurn: () => {}, setRoundTransactionActive: () => {},
    setPlayerTeam: (team: GamePokemon[]) => { state.playerTeam = team; },
    setEnemyTeam: (team: GamePokemon[]) => { state.enemyTeam = team; },
    setEnemy: () => {}, setHazards: (hazards: BattleSnapshot['hazards']) => { state.hazards = hazards; },
    syncEnemyLead: (lead: GamePokemon, team: GamePokemon[]) => { const next = [...team]; next[0] = lead; state.enemyTeam = next; return next; },
    hasHeldItemEffect: (p: GamePokemon, effect: string) => battleData.hasItemBattleEffect(p.factoryHeldItemId, effect),
    hasPrimaryAbilityEffect: (p: GamePokemon, effect: string) => battleData.hasAbilityBattleEffect(p.abilities?.[0]?.ability?.name, effect),
    getMoveCurrentPp: (m: Move) => m.currentPp ?? m.maxPp ?? m.pp ?? 0,
    getEncoredMove: () => null, isMoveUsableWhileAsleep: () => false,
    calculateConfusionSelfHitDamage: () => { throw Error('unexpected confusion'); },
    announceHpChange: async () => {},
    tryActivateWhiteHerb: inertItem, tryConsumeMentalHerb: inertItem, tryConsumeStatusCureBerry: inertItem,
    tryActivateSitrusBerry: inertItem, tryActivatePinchStatBerry: inertItem,
    addMessagesSequentially: async (lines: string[]) => { messages.push(...lines); },
    calculateDamage: (m: Move, a: GamePokemon, d: GamePokemon) => damage(m, a, d),
    applyMoveSecondaryEffects: async (o: any) => applyMoveSecondaryEffects({ ...o, teams: { playerTeam: o.playerTeam, enemyTeam: o.enemyTeam }, getLocalized: (p) => p.name, random: () => 0.99 }),
    resolveBattleResult: async (result: string) => { calls.push(result); state.gameState = 'ROUND_RESULT'; },
    setTimeout: (fn: () => void) => { schedules.push(fn); return schedules.length; },
    chooseEnemySwitchIndex: () => -1, shouldQuickClawActivate: () => false,
    shouldEnemyActFirst: () => options.actingSide === 'enemy',
    captureRoundStartCheckpoint: () => structuredClone(state),
    finalizeRoundAttempt: (result: any) => { finals.push(result); },
    commitRoundEndTurn: async () => { calls.push('END_TURN'); Object.assign(state, end(state).snapshot); return {}; },
    console: { error: (error: unknown) => { throw error; } }, StaleRoundError: class extends Error {},
  };
  scope.setBattleMenuTab = (tab: string) => {
    if (tab !== 'POKEMON') return;
    if (!state.playerTeam.some((p, index) => index > 0 && p.currentHp > 0)) return;
    calls.push('PLAYER_REPLACEMENT');
    replacements.push(Promise.resolve().then(async () => {
      scope.playerTeam = state.playerTeam;
      const index = state.playerTeam.findIndex((p) => p.currentHp > 0);
      assert.ok(index > 0);
      await actualControllerCallback('switchPokemon', scope)(index);
    }));
  };
  for (const name of ['winBattle', 'loseBattle', 'markAwaitingPlayerReplacement', 'releasePlayerReplacement', 'setMainBattleTurn',
    'getForcedLockedMove', 'isProtectLikeMove', 'isTeamWiped', 'enterBattlefield', 'reportEntryHazards', 'sendOutNextPlayer', 'sendOutNextEnemy',
    'resolvePreTurnStatus', 'chooseEnemyMove']) scope[name] = actualControllerCallback(name, scope);
  const enemySendOut = scope.sendOutNextEnemy;
  scope.sendOutNextEnemy = async (...args: any[]) => {
    calls.push('ENEMY_REPLACEMENT'); const replaced = await enemySendOut(...args);
    if (options.invalidateOnEnemyEntry) scope.battleInstanceRef.current.epoch += 1;
    return replaced;
  };
  const execute = actualControllerCallback('executeTurn', scope);
  scope.executeTurn = async (o: any) => { actions.push(o.actingSide); await execute(o); actionSnapshots.push(structuredClone(state)); };
  scope.runEnemyAutoAction = actualControllerCallback('runEnemyAutoAction', scope);
  const handleAttack = actualControllerCallback('handleAttack', scope);
  // One production selection/round. The test chooses a replacement through the actual UI callback.
  await handleAttack(STRUGGLE_MOVE);
  await Promise.all(replacements);
  for (const scheduled of schedules) scheduled();
  await Promise.resolve();
  return { state, calls, messages, actions, actionSnapshots, finals, round: scope.roundTransactionRef.current, schedules: schedules.length };
}

test('Real Struggle round settles all eight symmetric double-faint reserve combinations once', async () => {
  for (const actingSide of ['player', 'enemy'] as const) for (const playerReserve of [false, true]) for (const enemyReserve of [false, true]) {
    const result = await faintingRound({ actingSide, playerReserve, enemyReserve });
    assert.deepEqual(result.actions, [actingSide], JSON.stringify({ actingSide, playerReserve, enemyReserve }));
    assert.equal(result.finals.length, 1); assert.equal(result.finals[0].failed, false);
    if (playerReserve && enemyReserve) {
      assert.equal(result.state.gameState, 'BATTLE');
      assert.equal(result.state.playerTeam[0].id, 3); assert.equal(result.state.enemyTeam[0].id, 4);
      assert.deepEqual(result.calls, ['ENEMY_REPLACEMENT', 'PLAYER_REPLACEMENT', 'END_TURN']);
      assert.equal(result.round.phase, 'DONE'); assert.equal(result.round.endTurnCommitted, true);
      assert.equal(result.round[actingSide], 'ACTED'); assert.equal(result.round[actingSide === 'player' ? 'enemy' : 'player'], 'SKIPPED');
    } else {
      assert.equal(result.state.gameState, 'ROUND_RESULT');
      assert.deepEqual(result.calls, [playerReserve ? 'WIN' : 'LOSS']);
      assert.equal(result.schedules, 0);
    }
    for (const mon of [...result.state.playerTeam, ...result.state.enemyTeam].filter((p) => p.id <= 2)) assert.equal(mon.selectedMoves[0].currentPp, 0);
  }
});

test('Double-faint enemy entry hazards settle once without opening a stale player replacement', async () => {
  for (const actingSide of ['player', 'enemy'] as const) {
    const result = await faintingRound({ actingSide, playerReserve: true, enemyReserve: true, enemyHazardWipe: true });
    assert.deepEqual(result.calls, ['ENEMY_REPLACEMENT', 'WIN']);
    assert.equal(result.schedules, 1); assert.equal(result.state.gameState, 'ROUND_RESULT');
    assert.deepEqual(result.actions, [actingSide]); assert.equal(result.round.endTurnCommitted, false);
    const stale = await faintingRound({ actingSide, playerReserve: true, enemyReserve: true, invalidateOnEnemyEntry: true });
    assert.deepEqual(stale.calls, ['ENEMY_REPLACEMENT']);
    assert.equal(stale.schedules, 0); assert.deepEqual(stale.actions, [actingSide]);
  }
});

test('Struggle retains single-faint, protection, Magic Guard, substitute and Focus Band recoil boundaries', async () => {
  for (const actingSide of ['player', 'enemy'] as const) {
    const opts = { actingSide, playerReserve: false, enemyReserve: false };
    const actorOnly = await faintingRound({ ...opts, targetHp: 200, actorItem: 'focus_band' });
    assert.deepEqual(actorOnly.calls.filter((call) => call === 'WIN' || call === 'LOSS'), [actingSide === 'player' ? 'LOSS' : 'WIN']);
    const targetOnly = await faintingRound({ ...opts, actorHp: 200 });
    assert.deepEqual(targetOnly.calls.filter((call) => call === 'WIN' || call === 'LOSS'), [actingSide === 'player' ? 'WIN' : 'LOSS']);
    const magic = await faintingRound({ ...opts, actorAbility: 'magic-guard' });
    const magicActor = (actingSide === 'player' ? magic.state.playerTeam : magic.state.enemyTeam).find((p) => p.id === 1)!;
    assert.equal(magicActor.currentHp, 1);
    assert.deepEqual(magic.calls.filter((call) => call === 'WIN' || call === 'LOSS'), [actingSide === 'player' ? 'WIN' : 'LOSS']);
    const substitute = await faintingRound({ ...opts, substitute: true });
    assert.deepEqual(substitute.calls.filter((call) => call === 'WIN' || call === 'LOSS'), [actingSide === 'player' ? 'LOSS' : 'WIN']);
    const protectedResult = await faintingRound({ ...opts, actorHp: 200, targetHp: 200, protect: true });
    const protectedActor = (actingSide === 'player' ? protectedResult.state.playerTeam : protectedResult.state.enemyTeam).find((p) => p.id === 1)!;
    assert.equal(protectedActor.currentHp, 200 - damage(STRUGGLE_MOVE, pokemon(2), pokemon()).damage); // Only the opponent's later successful hit, no recoil from the protected attack.
    assert.deepEqual(protectedResult.calls, ['END_TURN']);
    const originalRandom = Math.random;
    try {
      Math.random = () => 0.05;
      const focus = await faintingRound({ ...opts, actorHp: 200, targetItem: 'focus_band' });
      const first = focus.actionSnapshots[0];
      const firstActor = (actingSide === 'player' ? first.playerTeam : first.enemyTeam).find((p) => p.id === 1)!;
      const firstTarget = (actingSide === 'player' ? first.enemyTeam : first.playerTeam).find((p) => p.id === 2)!;
      assert.equal(firstActor.currentHp, 150); assert.equal(firstTarget.currentHp, 1);
      assert.equal(firstTarget.factoryHeldItemId, 'focus_band');
    } finally { Math.random = originalRandom; }
  }
});


// Execute both real callbacks. Only React setters, storage and the delay scheduler are
// controlled; ROUND_RESULT renders during the message await and invalidates its epoch.
function settlementCallbackHarness(failure?: 'message' | 'storage') {
  const expectedError = new Error(`${failure ?? 'none'} failure`);
  const state = {
    gameState: 'BATTLE', loading: false, settlementError: false, streak: 2,
    roundResult: null as 'WIN' | 'LOSS' | null, creditedTokens: -1,
    logs: [] as string[], errors: [] as unknown[][], settlements: [] as unknown[][],
    playerTeam: [pokemon(1, { currentHp: 0 })],
  };
  const roundTransactionRef = { current: { battleEpoch: 1 } };
  const battleInstanceRef = { current: { epoch: 1 } };
  const liveBattleStateRef = { current: { playerTeam: state.playerTeam, enemyTeam: [pokemon(2)] } };
  const pendingSettlementRef: { current: unknown } = { current: null };
  const scope: Record<string, any> = {
    StaleRoundError: actualControllerCallback('StaleRoundError', {}, true),
    roundTransactionRef, battleInstanceRef, liveBattleStateRef, pendingSettlementRef,
    restoreFactoryParty, factoryRunId: 'settlement-test', stage: 1, streak: 2,
    isFrontierBrain: false, specialBossBattleActive: false, specialModeUnlocked: false,
    suppressFactoryBattleResult: false,
    console: { error: (...args: unknown[]) => state.errors.push(args) },
    setTimeout: (resume: () => void) => queueMicrotask(resume),
    setIsMessageProcessing: () => {},
    setBattleLog: (update: (previous: string[]) => string[]) => {
      if (failure === 'message') throw expectedError;
      state.logs = update(state.logs);
    },
    setLoading: (value: boolean) => { state.loading = value; },
    setSettlementError: (value: boolean) => { state.settlementError = value; },
    setPlayerTeam: (team: GamePokemon[]) => { state.playerTeam = team; },
    setStreak: (value: number) => { state.streak = value; },
    setRoundResult: (value: 'WIN' | 'LOSS') => { state.roundResult = value; },
    setLastTokenGain: (value: number) => { state.creditedTokens = value; },
    setGameState: (value: string) => {
      state.gameState = value;
      queueMicrotask(() => { battleInstanceRef.current.epoch += 1; });
    },
    setSpecialModeUnlocked: () => {}, setSpecialBossBattleActive: () => {},
    getBattleIndexInSet: () => 1, t: (key: string) => key,
    settleFactoryBattle: (...args: unknown[]) => {
      state.settlements.push(args);
      if (failure === 'storage') throw expectedError;
      return { amount: 3 };
    },
  };
  scope.addMessagesSequentially = actualControllerCallback('addMessagesSequentially', scope);
  return { state, battleInstanceRef, liveBattleStateRef, pendingSettlementRef, expectedError,
    resolve: actualControllerCallback('resolveBattleResult', scope) as (result: 'WIN' | 'LOSS') => Promise<void> };
}

test('actual settlement and message callbacks: ROUND_RESULT epoch cancellation is quiet after one committed result', async () => {
  for (const result of ['WIN', 'LOSS'] as const) {
    const harness = settlementCallbackHarness();
    await harness.resolve(result);
    const { state } = harness;
    assert.equal(state.settlements.length, 1);
    assert.deepEqual(state.settlements[0].slice(0, 4), ['settlement-test', 1, result, false]);
    assert.equal(state.gameState, 'ROUND_RESULT');
    assert.equal(state.roundResult, result);
    assert.equal(state.streak, result === 'WIN' ? 3 : 0);
    assert.equal(state.creditedTokens, 3);
    assert.equal(state.playerTeam[0].currentHp, state.playerTeam[0].maxHp);
    assert.equal(harness.liveBattleStateRef.current.playerTeam, state.playerTeam);
    assert.equal(harness.battleInstanceRef.current.epoch, 2);
    assert.equal(state.logs.length, 1);
    assert.deepEqual(state.errors, []);
    assert.equal(harness.pendingSettlementRef.current, null);
    assert.equal(state.settlementError, false);
    assert.equal(state.loading, false);
  }
});

test('actual settlement callback: ordinary message exceptions remain visible and finally releases loading', async () => {
  const harness = settlementCallbackHarness('message');
  await harness.resolve('WIN');
  assert.deepEqual(harness.state.errors, [[harness.expectedError]]);
  assert.equal(harness.state.settlements.length, 1);
  assert.equal(harness.state.gameState, 'ROUND_RESULT');
  assert.equal(harness.pendingSettlementRef.current, null);
  assert.equal(harness.state.loading, false);
});

test('actual settlement callback: failed storage retains pending settlement and error without advancing result', async () => {
  const harness = settlementCallbackHarness('storage');
  const originalTeam = harness.liveBattleStateRef.current.playerTeam;
  await harness.resolve('LOSS');
  assert.deepEqual(harness.state.errors, [['Factory settlement failed', harness.expectedError]]);
  assert.equal(harness.state.settlements.length, 1);
  assert.deepEqual(harness.pendingSettlementRef.current,
    { runId: 'settlement-test', stage: 1, result: 'LOSS', isFrontierBrain: false });
  assert.equal(harness.state.settlementError, true);
  assert.equal(harness.state.gameState, 'BATTLE');
  assert.equal(harness.state.roundResult, null);
  assert.equal(harness.state.creditedTokens, -1);
  assert.equal(harness.liveBattleStateRef.current.playerTeam, originalTeam);
  assert.equal(harness.battleInstanceRef.current.epoch, 1);
  assert.deepEqual(harness.state.logs, []);
  assert.equal(harness.state.loading, false);
});
