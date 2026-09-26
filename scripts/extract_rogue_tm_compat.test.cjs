const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTmTable, parseProfile, extract } = require('./extract_rogue_tm_compat.cjs');

function table(moves = Array.from({ length: 50 }, (_, index) => `MOVE_TEST_${index + 1}`)) {
  const assignments = moves.map((move, index) => `  [ITEM_TM${String(index + 1).padStart(2, '0')} - ITEM_TM01] = ${move},`).join('\n');
  return `static const u16 sTMHMMoves[NUM_TECHNICAL_MACHINES] =\n{\n#ifdef ROGUE_EXPANSION\n${assignments}\n//[ITEM_TM51 - ITEM_TM01] = MOVE_NONE,\n#else\n[ITEM_TM01 - ITEM_TM01] = MOVE_WRONG_BRANCH,\n#endif\n};`;
}

test('extracts exactly the expansion TM01–50 branch', () => {
  const tms = parseTmTable(table());
  assert.equal(tms.length, 50);
  assert.deepEqual(tms[0], { tm: 'TM01', move: 'MOVE_TEST_1' });
  assert.deepEqual(tms[49], { tm: 'TM50', move: 'MOVE_TEST_50' });
  assert.ok(!tms.some(({ move }) => move === 'MOVE_WRONG_BRANCH'));
});

test('rejects duplicate or missing TM numbers and moves', () => {
  assert.throws(() => parseTmTable(table().replace('ITEM_TM02', 'ITEM_TM03')), /not continuous/);
  assert.throws(() => parseTmTable(table().replace('MOVE_TEST_2', 'MOVE_TEST_1')), /duplicate/);
  assert.throws(() => parseTmTable(table().replace('MOVE_TEST_2', 'MOVE_NONE')), /Empty/);
});

test('ordinary profile compatibility is TutorMoves union LevelUpMoves.Move', () => {
  const parsed = parseProfile({
    Species: ['SPECIES_TEST', 'SPECIES_TEST_FORM'],
    TutorMoves: ['MOVE_A', 'MOVE_B'],
    LevelUpMoves: [{ Move: 'MOVE_B', Level: 1 }, { Move: 'MOVE_C', Level: 9 }],
    CompetitiveMovesets: [{ Move: 'MOVE_D' }],
  }, 'test/expansion_profile.json');
  assert.deepEqual(parsed.species, ['SPECIES_TEST', 'SPECIES_TEST_FORM']);
  assert.deepEqual([...parsed.moves].sort(), ['MOVE_A', 'MOVE_B', 'MOVE_C']);
});

test('rejects malformed ordinary profiles', () => {
  assert.throws(() => parseProfile({ Species: [], TutorMoves: [], LevelUpMoves: [] }, 'empty'), /Species/);
  assert.throws(() => parseProfile({ Species: ['SPECIES_A'], TutorMoves: [], LevelUpMoves: [{ Level: 1 }] }, 'bad'), /LevelUpMoves/);
});

test('refuses a source checkout that is not the pinned commit', () => {
  assert.throws(() => extract(process.cwd()), /Wrong Rogue source commit/);
});
