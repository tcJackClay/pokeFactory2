const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { parseTmTable, parseProfile, extract, parseNationalDex, mapFactorySpecies, assertResearchOutputPath, readPinnedMappingFile } = require('./extract_rogue_tm_compat.cjs');

test('research output is restricted to the ignored output tree', () => {
  const root = path.resolve(__dirname, '..');
  assert.equal(assertResearchOutputPath(path.join(root, 'output', 'tm-audit')), path.join(root, 'output', 'tm-audit'));
  assert.throws(() => assertResearchOutputPath(path.join(root, 'docs', 'tm-audit')), /ignored project output/);
  assert.throws(() => assertResearchOutputPath(path.join(root, 'output-elsewhere')), /ignored project output/);
});

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

test('pinned Rogue dex and all ten form exceptions map every factory identity', {
  skip: !process.env.ROGUE_TM_SOURCE && 'Set ROGUE_TM_SOURCE to the pinned checkout for integration validation',
}, () => {
  const sourceRoot = path.resolve(process.env.ROGUE_TM_SOURCE);
  assert.throws(() => readPinnedMappingFile(sourceRoot, 'include/constants/pokedex.h', 'incorrect digest'), /Pinned Rogue mapping source differs/);
  const projectRoot = path.resolve(__dirname, '..');
  const { matrix } = extract(sourceRoot);
  const index = JSON.parse(fs.readFileSync(path.join(projectRoot, 'storage/data/factorySpeciesIndex.json'), 'utf8'));
  const dex = parseNationalDex(fs.readFileSync(path.join(sourceRoot, 'include/constants/pokedex.h'), 'utf8'));
  assert.equal(dex[0], 'BULBASAUR');
  assert.equal(dex[1024], 'PECHARUNT');
  const result = mapFactorySpecies(matrix, index, sourceRoot);
  assert.equal(result.mappings.filter((row) => row.kind === 'base').length, 1025);
  assert.equal(result.mappings.filter((row) => row.kind === 'form').length, 51);
  assert.equal(result.mappings.filter((row) => row.method === 'explicit-form-exception').length, 10);
  assert.deepEqual(result.unknown, []);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.mappings.find((row) => row.speciesId === 1 && row.kind === 'base').sourceAlias, 'SPECIES_BULBASAUR');
  assert.equal(result.mappings.find((row) => row.speciesId === 1025 && row.kind === 'base').sourceAlias, 'SPECIES_PECHARUNT');
  const exceptions = Object.fromEntries(result.mappings.filter((row) => row.method === 'explicit-form-exception').map((row) => [row.identifier, row.sourceAlias]));
  assert.deepEqual(exceptions, {
    'wormadam-sandy': 'SPECIES_WORMADAM_SANDY_CLOAK',
    'wormadam-trash': 'SPECIES_WORMADAM_TRASH_CLOAK',
    'zacian-crowned': 'SPECIES_ZACIAN_CROWNED_SWORD',
    'zamazenta-crowned': 'SPECIES_ZAMAZENTA_CROWNED_SHIELD',
    'urshifu-rapid-strike': 'SPECIES_URSHIFU_RAPID_STRIKE_STYLE',
    'tauros-paldea-combat-breed': 'SPECIES_TAUROS_PALDEAN_COMBAT_BREED',
    'tauros-paldea-blaze-breed': 'SPECIES_TAUROS_PALDEAN_BLAZE_BREED',
    'tauros-paldea-aqua-breed': 'SPECIES_TAUROS_PALDEAN_AQUA_BREED',
    'wooper-paldea': 'SPECIES_WOOPER_PALDEAN',
    'maushold-family-of-three': 'SPECIES_MAUSHOLD',
  });
});
