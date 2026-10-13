const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const extractor = require('./extract_rogue_tm_compat.cjs');
const { validateMoveManifest, buildRuntimeRows, buildArtifacts, writeOrCheckArtifacts, sha256, projectTextSha256, GENERATED_PATH, PROVENANCE_PATH } = require('./generate_fixed_tm_runtime.cjs');

const projectRoot = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'backend/config/rogue-tm-moves.json'), 'utf8'));
const matrixForManifest = {
  source: { repository: manifest.source.repository, commit: manifest.source.commit, digestSha256: manifest.source.inputDigestSha256 },
  tms: manifest.tms.map(({ tm, key }) => ({ tm, move: `MOVE_${key.slice(5).toUpperCase().replaceAll('-', '_')}` })),
};

test('project text hashes survive Git CRLF checkout but still detect content changes', () => {
  assert.equal(projectTextSha256(Buffer.from('a\r\nb\r\n')), projectTextSha256(Buffer.from('a\nb\n')));
  assert.notEqual(projectTextSha256(Buffer.from('a\nb\n')), projectTextSha256(Buffer.from('a\nc\n')));
});

test('fixed manifest maps all 50 Move.name identities and rejects source or ordered identity drift', () => {
  const tms = validateMoveManifest(matrixForManifest, manifest);
  assert.equal(tms.length, 50);
  assert.equal(tms[16].moveName, 'freeze-dry');
  assert.equal(tms[32].moveName, 'quiver-dance');
  for (const field of ['repository', 'commit', 'inputDigestSha256', 'mappingDigestSha256']) {
    const changed = structuredClone(manifest);
    changed.source[field] = 'wrong';
    assert.throws(() => validateMoveManifest(matrixForManifest, changed), /provenance/);
  }
  const duplicate = structuredClone(manifest);
  duplicate.tms[1] = duplicate.tms[0];
  assert.throws(() => validateMoveManifest(matrixForManifest, duplicate), /identity mismatch/);
  const missing = structuredClone(manifest);
  missing.tms.pop();
  assert.throws(() => validateMoveManifest(matrixForManifest, missing), /50 entries/);
});

test('--check reads only and never repairs missing or changed output', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pokefactory-fixed-tm-'));
  t.after(() => {
    for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name));
    fs.rmdirSync(directory);
  });
  const artifacts = new Map([['data.txt', 'expected\n']]);
  assert.throws(() => writeOrCheckArtifacts(artifacts, directory, true), /differs/);
  assert.deepEqual(fs.readdirSync(directory), []);
  writeOrCheckArtifacts(artifacts, directory, false);
  const fullPath = path.join(directory, 'data.txt');
  const before = fs.statSync(fullPath);
  writeOrCheckArtifacts(artifacts, directory, true);
  assert.equal(fs.statSync(fullPath).mtimeMs, before.mtimeMs);
  fs.writeFileSync(fullPath, 'drift');
  assert.throws(() => writeOrCheckArtifacts(artifacts, directory, true), /differs/);
  assert.equal(fs.readFileSync(fullPath, 'utf8'), 'drift');
});

test('pinned source regenerates byte-identical runtime artifacts and all 1076 mappings', {
  skip: !process.env.ROGUE_TM_SOURCE && 'Set ROGUE_TM_SOURCE to run pinned-source integration',
}, () => {
  const sourceRoot = path.resolve(process.env.ROGUE_TM_SOURCE);
  const first = buildArtifacts(sourceRoot);
  const second = buildArtifacts(sourceRoot);
  assert.deepEqual([...first], [...second]);
  writeOrCheckArtifacts(first, projectRoot, true);
  const provenance = JSON.parse(first.get(PROVENANCE_PATH));
  assert.equal(provenance.counts.tms, 50);
  assert.equal(provenance.counts.profiles, 1156);
  assert.equal(provenance.counts.aliases, 1519);
  assert.equal(provenance.counts.pairs, 14645);
  assert.equal(provenance.counts.mappedBase, 1025);
  assert.equal(provenance.counts.mappedForms, 51);
  assert.equal(provenance.counts.explicitFormExceptions, 10);
  assert.equal(provenance.counts.admittedTms, 0);
  assert.equal(provenance.outputHashes[GENERATED_PATH], sha256(first.get(GENERATED_PATH)));
  assert.equal(provenance.source.profileMode, 'ordinary');
  const { matrix } = extractor.extract(sourceRoot);
  const index = JSON.parse(fs.readFileSync(path.join(projectRoot, 'storage/data/factorySpeciesIndex.json'), 'utf8'));
  const mapping = extractor.mapFactorySpecies(matrix, index, sourceRoot);
  const rows = buildRuntimeRows(matrix, mapping, index);
  for (const row of rows) {
    assert.deepEqual(row.tmNumbers.map((number) => `TM${String(number).padStart(2, '0')}`), matrix.species[row.sourceAlias].tms);
  }
  assert.equal(rows.find((row) => row.identifier === 'rotom-heat').tmNumbers.includes(4), true);
  assert.equal(rows.find((row) => row.identifier === '479').tmNumbers.includes(4), false);
  const badMapping = structuredClone(mapping);
  badMapping.unknown.push({ identifier: 'unknown-form' });
  assert.throws(() => buildRuntimeRows(matrix, badMapping, index), /Unresolved/);
  const duplicateIndex = structuredClone(index);
  duplicateIndex[1].pokemonId = duplicateIndex[0].pokemonId;
  assert.throws(() => buildRuntimeRows(matrix, mapping, duplicateIndex), /Duplicate/);
  const wrongMapping = structuredClone(mapping);
  wrongMapping.mappings[0].speciesId = 9999;
  assert.throws(() => buildRuntimeRows(matrix, wrongMapping, index), /differs/);
});
