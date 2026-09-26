#!/usr/bin/env node
// Research-only extraction. Generated compatibility data belongs in ignored output/.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const SOURCE_SHA = 'a6adfcf18d7eaf99c2803e4b0bc04eca7af2f014';
const SYMBOL = /^(?:MOVE|SPECIES)_[A-Z0-9_]+$/;
const EXPECTED = {
  tm: 50, profiles: 1156, aliases: 1519, pairs: 14645,
  sourceDigestSha256: '353a1226dae0a7601cef5a3613572d35d0cf9a780299426a9cadc6a36e21bb9e',
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseTmTable(source) {
  const table = source.match(/static const u16 sTMHMMoves\[NUM_TECHNICAL_MACHINES\]\s*=\s*\{([\s\S]*?)\n\};/);
  assert(table, 'sTMHMMoves table missing');
  const expansion = table[1].match(/#ifdef\s+ROGUE_EXPANSION\b([\s\S]*?)#else\b/);
  assert(expansion, 'ROGUE_EXPANSION TM branch missing');
  const clean = expansion[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const entries = [...clean.matchAll(/\[ITEM_TM(\d{2})\s*-\s*ITEM_TM01\]\s*=\s*(MOVE_[A-Z0-9_]+)\s*,/g)];
  const assignments = clean.split('\n').filter((line) => line.includes('[ITEM_TM'));
  assert(entries.length === assignments.length, 'Unrecognized TM assignment in expansion branch');
  const moves = new Set();
  for (const [index, match] of entries.entries()) {
    assert(Number(match[1]) === index + 1, `TM numbering is not continuous at ${match[1]}`);
    assert(match[2] !== 'MOVE_NONE' && !moves.has(match[2]), `Empty or duplicate TM move ${match[2]}`);
    moves.add(match[2]);
  }
  assert(entries.length === EXPECTED.tm, `Expected ${EXPECTED.tm} TMs, found ${entries.length}`);
  return entries.map((match) => ({ tm: `TM${match[1]}`, move: match[2] }));
}

function parseProfile(profile, relativePath) {
  const species = profile?.Species;
  const tutors = profile?.TutorMoves;
  const levels = profile?.LevelUpMoves;
  assert(Array.isArray(species) && species.length > 0, `${relativePath}: invalid Species`);
  assert(Array.isArray(tutors) && Array.isArray(levels), `${relativePath}: missing move arrays`);
  assert(species.every((value) => SYMBOL.test(value) && value.startsWith('SPECIES_')), `${relativePath}: invalid species symbol`);
  assert(tutors.every((value) => SYMBOL.test(value) && value.startsWith('MOVE_')), `${relativePath}: invalid TutorMoves`);
  assert(levels.every((value) => SYMBOL.test(value?.Move) && value.Move.startsWith('MOVE_')), `${relativePath}: invalid LevelUpMoves`);
  return { species, moves: new Set([...tutors, ...levels.map(({ Move }) => Move)]) };
}

function findProfiles(root) {
  const found = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name === 'expansion_profile.json') found.push(file);
    }
  }
  visit(root);
  return found;
}

function extract(sourceRoot) {
  const actualSha = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert(actualSha === SOURCE_SHA, `Wrong Rogue source commit: ${actualSha}`);
  const tmPath = path.join(sourceRoot, 'src/data/party_menu.h');
  const profileRoot = path.join(sourceRoot, 'src/data/rogue/pokemon/expansion');
  const tmText = fs.readFileSync(tmPath, 'utf8');
  const tms = parseTmTable(tmText);
  const files = findProfiles(profileRoot);
  assert(files.length === EXPECTED.profiles, `Expected ${EXPECTED.profiles} ordinary profiles, found ${files.length}`);
  const sourceDigest = crypto.createHash('sha256');
  sourceDigest.update('src/data/party_menu.h\0').update(tmText).update('\0');
  const bySpecies = new Map();
  const zeroTmProfiles = [];
  const duplicateAliases = [];
  const tmByMove = new Map(tms.map(({ tm, move }) => [move, tm]));
  for (const file of files) {
    const relative = path.relative(sourceRoot, file).replace(/\\/g, '/');
    const contents = fs.readFileSync(file, 'utf8');
    sourceDigest.update(relative).update('\0').update(contents).update('\0');
    const { species, moves } = parseProfile(JSON.parse(contents), relative);
    const matchingTms = [...moves].filter((move) => tmByMove.has(move)).map((move) => tmByMove.get(move)).sort();
    if (matchingTms.length === 0) zeroTmProfiles.push(relative);
    for (const alias of species) {
      if (bySpecies.has(alias)) duplicateAliases.push({ alias, first: bySpecies.get(alias).profile, second: relative });
      else bySpecies.set(alias, { profile: relative, tms: matchingTms });
    }
  }
  assert(duplicateAliases.length === 0, `Duplicate Species aliases: ${duplicateAliases.length}`);
  const species = Object.fromEntries([...bySpecies].sort(([a], [b]) => a.localeCompare(b, 'en')));
  const pairCount = Object.values(species).reduce((count, row) => count + row.tms.length, 0);
  assert(bySpecies.size === EXPECTED.aliases, `Expected ${EXPECTED.aliases} aliases, found ${bySpecies.size}`);
  assert(pairCount === EXPECTED.pairs, `Expected ${EXPECTED.pairs} pairs, found ${pairCount}`);
  const digestSha256 = sourceDigest.digest('hex');
  assert(digestSha256 === EXPECTED.sourceDigestSha256, `Pinned Rogue source content differs: ${digestSha256}`);
  const matrix = {
    source: { repository: 'Pokabbie/pokeemerald-rogue', commit: SOURCE_SHA, branch: 'expansion', profileMode: 'ordinary', generatorVersion: 1, digestSha256 },
    counts: { tms: tms.length, profiles: files.length, aliases: bySpecies.size, pairs: pairCount },
    tms,
    species,
  };
  return { matrix, anomalies: { duplicateAliases, zeroTmProfiles } };
}

function buildMappingGaps(matrix, projectRoot) {
  const index = JSON.parse(fs.readFileSync(path.join(projectRoot, 'storage/data/factorySpeciesIndex.json'), 'utf8'));
  const identifiers = new Set(index.map(({ identifier }) => identifier));
  const referenceNames = new Set();
  const chunkDir = path.join(projectRoot, 'src/features/game/config/factoryReferenceSets/chunks');
  for (const filename of fs.readdirSync(chunkDir).filter((name) => /^chunk_\d+_\d+\.ts$/.test(name))) {
    const text = fs.readFileSync(path.join(chunkDir, filename), 'utf8');
    for (const match of text.matchAll(/moveNames:\s*\[([^\]]*)\]/g)) {
      for (const name of match[1].matchAll(/'([^']+)'/g)) referenceNames.add(name[1]);
    }
  }
  const overrideText = fs.readFileSync(path.join(projectRoot, 'src/features/game/data/battle/moveEffectTable.ts'), 'utf8');
  const overrides = new Set([...overrideText.matchAll(/^\s*(?:'([^']+)'|([a-z][a-z0-9]*)):\s*\{/gm)].map((match) => match[1] ?? match[2]));
  const moves = matrix.tms.map(({ tm, move }) => {
    const candidateId = move.slice(5).toLowerCase().replace(/_/g, '-');
    return { tm, sourceMove: move, candidateId, seenInFactorySets: referenceNames.has(candidateId), hasBattleOverride: overrides.has(candidateId), idMappingVerified: false, battleEffectVerified: false };
  });
  const species = Object.keys(matrix.species).map((alias) => {
    const candidateIdentifier = alias.slice(8).toLowerCase().replace(/_/g, '-');
    return { sourceAlias: alias, candidateIdentifier, foundInFactoryIndex: identifiers.has(candidateIdentifier), idMappingVerified: false };
  });
  return {
    warning: 'Name-based candidates are only audit hints. No Rogue symbol to project numeric/form ID mapping or battle effect equivalence is verified; do not use to issue rewards.',
    counts: {
      speciesAliases: species.length,
      speciesNameCandidatesInFactoryIndex: species.filter((row) => row.foundInFactoryIndex).length,
      tmMoves: moves.length,
      moveNameCandidatesInFactorySets: moves.filter((row) => row.seenInFactorySets).length,
      tmMovesWithBattleOverride: moves.filter((row) => row.hasBattleOverride).length,
      verifiedSpeciesIds: 0,
      verifiedMoveIds: 0,
      verifiedBattleEffects: 0,
    },
    species,
    moves,
  };
}

function main(argv) {
  const sourceArg = argv.indexOf('--source');
  const outputArg = argv.indexOf('--output');
  assert(sourceArg >= 0 && argv[sourceArg + 1], 'Pass --source <pinned Rogue checkout>.');
  const sourceRoot = path.resolve(argv[sourceArg + 1]);
  const outputRoot = path.resolve(outputArg >= 0 ? argv[outputArg + 1] : path.join(__dirname, '../output/rogue-tm-extract'));
  assert(fs.existsSync(sourceRoot), `Source checkout missing: ${sourceRoot}. Pass --source <path>.`);
  const { matrix, anomalies } = extract(sourceRoot);
  const gaps = buildMappingGaps(matrix, path.resolve(__dirname, '..'));
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const [name, payload] of Object.entries({ 'compatibility-matrix.json': matrix, 'source-anomalies.json': anomalies, 'project-mapping-gaps.json': gaps })) {
    fs.writeFileSync(path.join(outputRoot, name), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify({ source: SOURCE_SHA, ...matrix.counts, zeroTmProfiles: anomalies.zeroTmProfiles.length, mappingGaps: gaps.counts, outputRoot }, null, 2)}\n`);
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { parseTmTable, parseProfile, extract, buildMappingGaps };
