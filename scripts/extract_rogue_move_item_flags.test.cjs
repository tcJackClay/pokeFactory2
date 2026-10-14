const test = require('node:test');
const assert = require('node:assert/strict');
const { definitions, evaluate, preprocess, parseMoves, mapSlugs } = require('./extract_rogue_move_item_flags.cjs');

const macros = definitions(`
#define GEN_3 2
#define GEN_4 3
#define GEN_5 4
#define GEN_6 5
#define GEN_9 8
#define GEN_LATEST GEN_9
#define B_UPDATED_MOVE_FLAGS GEN_LATEST
#define B_UPDATED_MOVE_DATA GEN_LATEST
#define B_HEAL_BLOCKING GEN_LATEST
`);
const table = (rows) => `const struct BattleMove gBattleMoves_Mainline[MOVES_COUNT_DYNAMAX] = {${rows}};`;

test('C comparisons, nested aliases, parentheses and numeric move ID offsets resolve explicitly', () => {
  assert.equal(evaluate('(B_UPDATED_MOVE_FLAGS == GEN_4) || (B_UPDATED_MOVE_FLAGS < GEN_3)', macros), 0);
  assert.equal(evaluate('B_HEAL_BLOCKING >= GEN_6', macros), 1);
  assert.equal(evaluate('(GEN_LATEST + 2) - 1', macros), 9);
  assert.equal(evaluate('!FALSE && TRUE', macros), 1);
});

test('unknown expressions, conflicted macros and recursive aliases fail closed', () => {
  for (const expression of ['1 || MISSING', 'TRUE ? TRUE : FALSE', 'Math.random()', 'TRUE | FALSE', 'GEN_9 trailing', '(GEN_9', '']) {
    assert.throws(() => evaluate(expression, macros));
  }
  assert.throws(() => evaluate('A', definitions('#define A B\n#define B A')), /cycle/);
  assert.throws(() => evaluate('A', definitions('#define A 1\n#define A 2')), /Conflicting/);
});

test('nested preprocessor branches preserve active values and parse inactive unknown conditions', () => {
  const text = `#if B_UPDATED_MOVE_DATA >= GEN_9
new
#if FALSE
hidden
#else
inner
#endif
#elif B_UPDATED_MOVE_DATA >= GEN_6
old
#else
older
#endif`;
  assert.equal(preprocess(text, macros), 'new\ninner');
  assert.throws(() => preprocess('#if FALSE\n#if MISSING\n#endif\n#endif', macros), /Unknown macro/);
  for (const text of ['#if TRUE', '#else', '#endif', '#ifdef SOMETHING\n#endif', '#if TRUE\n#else\n#else\n#endif']) {
    assert.throws(() => preprocess(text, macros));
  }
});

test('flags follow source expressions and C zero initialization, not physical damage class', () => {
  const rows = parseMoves(table(`
    [MOVE_TACKLE] = { .split = SPLIT_PHYSICAL, .makesContact = TRUE, .ignoresKingsRock = B_UPDATED_MOVE_FLAGS == GEN_4 },
    [MOVE_EARTHQUAKE] = { .split = SPLIT_PHYSICAL },
    [MOVE_ABSORB] = { .healBlockBanned = B_HEAL_BLOCKING >= GEN_6, .sheerForceBoost = FALSE, },
  `), macros);
  assert.deepEqual(rows[0].flags, { makesContact: true, ignoresKingsRock: false, sheerForceBoost: false, healBlockBanned: false });
  assert.equal(rows[1].flags.makesContact, false);
  assert.equal(rows[2].flags.healBlockBanned, true);
  const gen4 = new Map(macros); gen4.set('B_UPDATED_MOVE_FLAGS', 'GEN_4');
  assert.equal(parseMoves(table('[MOVE_TACKLE] = { .ignoresKingsRock = B_UPDATED_MOVE_FLAGS == GEN_4 },'), gen4)[0].flags.ignoresKingsRock, true);
});

test('conditional selected flag and comment contents cannot silently overwrite another branch', () => {
  const source = table(`[MOVE_TACKLE] = {
    // .makesContact = UNKNOWN,
    /* .makesContact = FALSE, */
    #if B_UPDATED_MOVE_DATA >= GEN_9
    .makesContact = TRUE,
    #else
    .makesContact = FALSE,
    #endif
  },`);
  assert.equal(parseMoves(source, macros)[0].flags.makesContact, true);
});

test('duplicate rows/fields, malformed records and nonboolean flags fail closed', () => {
  for (const body of [
    '[MOVE_TACKLE] = {}, [MOVE_TACKLE] = {},',
    '[MOVE_TACKLE] = { .makesContact = TRUE, .makesContact = FALSE },',
    '[MOVE_TACKLE] = { .makesContact = MISSING },',
    '[MOVE_TACKLE] = { .makesContact = 2 },',
    '[MOVE_TACKLE] = { .split = SPLIT_PHYSICAL .makesContact = TRUE },',
    '[MOVE_TACKLE] = { .split = SPLIT_PHYSICAL }, unexpected',
  ]) assert.throws(() => parseMoves(table(body), macros));
  assert.throws(() => parseMoves('const struct BattleMove Other[] = {};', macros));
});

test('canonical PokeAPI exceptions and paired Z identities are exact; unknown names are rejected', () => {
  assert.deepEqual(mapSlugs('MOVE_VISE_GRIP').slugs, ['vice-grip']);
  assert.deepEqual(mapSlugs('MOVE_10000000_VOLT_THUNDERBOLT').slugs, ['10-000-000-volt-thunderbolt']);
  assert.deepEqual(mapSlugs('MOVE_BREAKNECK_BLITZ').slugs, ['breakneck-blitz--physical', 'breakneck-blitz--special']);
  assert.deepEqual(mapSlugs('MOVE_ANCIENT_POWER').slugs, ['ancient-power']);
  assert.throws(() => mapSlugs('MOVE_UNKNOWN_GUESSED_MOVE'), /Unmapped/);
  for (const symbol of ['MOVE_NONE', 'MOVE_SWIRLING_BLADE', 'MOVE_G_MAX_WILDFIRE']) {
    assert.deepEqual(mapSlugs(symbol).slugs, []); assert.ok(mapSlugs(symbol).excluded);
  }
});
