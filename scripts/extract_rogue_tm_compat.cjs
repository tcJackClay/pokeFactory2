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
const FORM_EXCEPTIONS = Object.freeze({
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

function parseNationalDex(text) {
  const block = text.match(/enum\s*\{\s*NATIONAL_DEX_NONE\s*,([\s\S]*?)\};/);
  assert(block, 'National Dex enum missing');
  const symbols = [...block[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').matchAll(/\bNATIONAL_DEX_([A-Z0-9_]+)\s*,/g)].map((match) => match[1]);
  assert(symbols.length === 1025, `Expected 1025 National Dex entries, found ${symbols.length}`);
  return symbols;
}

function parseSpeciesDefines(text) {
  const definitions = new Map();
  const conflicts = [];
  for (const match of text.matchAll(/^#define\s+(SPECIES_[A-Z0-9_]+)\s+([^\s/]+)/gm)) {
    if (definitions.has(match[1]) && definitions.get(match[1]) !== match[2]) conflicts.push({ symbol: match[1], values: [definitions.get(match[1]), match[2]] });
    definitions.set(match[1], match[2]);
  }
  return { definitions, conflicts };
}

function resolveSpeciesAlias(symbol, definitions) {
  const visited = new Set();
  let current = symbol;
  while (true) {
    if (visited.has(current)) throw new Error(`Species alias cycle at ${symbol}`);
    visited.add(current);
    const target = definitions.get(current);
    if (!target) return null;
    if (!target.startsWith('SPECIES_')) return current;
    current = target;
  }
}

function mapFactorySpecies(matrix, index, sourceRoot, evidence = {}) {
  const nationalDex = evidence.nationalDex ?? parseNationalDex(fs.readFileSync(path.join(sourceRoot, 'include/constants/pokedex.h'), 'utf8'));
  const { definitions, conflicts: definitionConflicts } = evidence.speciesDefines ?? parseSpeciesDefines(fs.readFileSync(path.join(sourceRoot, 'include/constants/species.h'), 'utf8'));
  const aliasesByResolvedSymbol = new Map();
  for (const sourceAlias of Object.keys(matrix.species)) {
    const resolved = resolveSpeciesAlias(sourceAlias, definitions);
    if (!resolved) continue;
    if (!aliasesByResolvedSymbol.has(resolved)) aliasesByResolvedSymbol.set(resolved, []);
    aliasesByResolvedSymbol.get(resolved).push(sourceAlias);
  }
  const mappings = [];
  const unknown = [];
  const conflicts = [...definitionConflicts];
  for (const row of index) {
    const isBase = /^\d+$/.test(row.identifier);
    let requestedSymbol;
    let method;
    if (isBase) {
      const dexName = nationalDex[row.speciesId - 1];
      requestedSymbol = dexName ? `SPECIES_${dexName}` : null;
      method = 'national-dex';
      if (Number(row.identifier) !== row.speciesId || row.pokemonId !== row.speciesId) {
        conflicts.push({ identifier: row.identifier, reason: 'Base identifier/speciesId/pokemonId disagree' });
        continue;
      }
    } else {
      requestedSymbol = FORM_EXCEPTIONS[row.identifier] ?? `SPECIES_${row.identifier.toUpperCase().replace(/-/g, '_')}`;
      method = FORM_EXCEPTIONS[row.identifier] ? 'explicit-form-exception' : 'direct-form-symbol';
      if (row.pokemonId === row.speciesId || !nationalDex[row.speciesId - 1]) {
        conflicts.push({ identifier: row.identifier, reason: 'Form pokemonId or base speciesId invalid' });
        continue;
      }
      if (!requestedSymbol.startsWith(`SPECIES_${nationalDex[row.speciesId - 1]}`)) {
        conflicts.push({ identifier: row.identifier, reason: 'Form symbol disagrees with National Dex base speciesId', requestedSymbol });
        continue;
      }
    }
    const resolvedSymbol = requestedSymbol && resolveSpeciesAlias(requestedSymbol, definitions);
    const possibleAliases = resolvedSymbol ? aliasesByResolvedSymbol.get(resolvedSymbol) ?? [] : [];
    const sourceAlias = matrix.species[requestedSymbol]
      ? requestedSymbol
      : possibleAliases.length === 1 ? possibleAliases[0] : null;
    if (!requestedSymbol || !resolvedSymbol || possibleAliases.length === 0) {
      unknown.push({ identifier: row.identifier, speciesId: row.speciesId, pokemonId: row.pokemonId, requestedSymbol, resolvedSymbol });
      continue;
    }
    if (!sourceAlias || (possibleAliases.length > 1 && !matrix.species[requestedSymbol])) {
      conflicts.push({ identifier: row.identifier, reason: 'Multiple profile aliases resolve to one species definition', possibleAliases });
      continue;
    }
    mappings.push({ identifier: row.identifier, speciesId: row.speciesId, pokemonId: row.pokemonId, generation: row.gen, kind: isBase ? 'base' : 'form', method, requestedSymbol, resolvedSymbol, sourceAlias, profile: matrix.species[sourceAlias].profile, tmCount: matrix.species[sourceAlias].tms.length, idMappingEvidence: 'national-dex/species.h/profile', battleEffectVerified: false });
  }
  const unusedExceptions = Object.keys(FORM_EXCEPTIONS).filter((identifier) => !index.some((row) => row.identifier === identifier));
  for (const identifier of unusedExceptions) conflicts.push({ identifier, reason: 'Form exception has no factory index row' });
  return { mappings, unknown, conflicts, exceptionCount: Object.keys(FORM_EXCEPTIONS).length };
}

function buildMappingGaps(matrix, projectRoot, sourceRoot) {
  const index = JSON.parse(fs.readFileSync(path.join(projectRoot, 'storage/data/factorySpeciesIndex.json'), 'utf8'));
  const factorySpecies = mapFactorySpecies(matrix, index, sourceRoot);
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
  return {
    warning: 'Factory identity mappings have static dex/species.h/profile evidence, but TM move IDs and battle behavior are not verified. Do not use this report to issue rewards.',
    counts: {
      speciesAliases: Object.keys(matrix.species).length,
      factoryIndexRows: index.length,
      factoryBaseMapped: factorySpecies.mappings.filter((row) => row.kind === 'base').length,
      factoryFormMapped: factorySpecies.mappings.filter((row) => row.kind === 'form').length,
      explicitFormExceptions: factorySpecies.exceptionCount,
      unknownFactorySpecies: factorySpecies.unknown.length,
      conflictingFactorySpecies: factorySpecies.conflicts.length,
      tmMoves: moves.length,
      moveNameCandidatesInFactorySets: moves.filter((row) => row.seenInFactorySets).length,
      tmMovesWithBattleOverride: moves.filter((row) => row.hasBattleOverride).length,
      staticSpeciesIdentityMapped: factorySpecies.mappings.length,
      verifiedMoveIds: 0,
      verifiedBattleEffects: 0,
    },
    factorySpecies,
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
  const gaps = buildMappingGaps(matrix, path.resolve(__dirname, '..'), sourceRoot);
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const [name, payload] of Object.entries({ 'compatibility-matrix.json': matrix, 'source-anomalies.json': anomalies, 'project-mapping-gaps.json': gaps })) {
    fs.writeFileSync(path.join(outputRoot, name), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify({ source: SOURCE_SHA, ...matrix.counts, zeroTmProfiles: anomalies.zeroTmProfiles.length, mappingGaps: gaps.counts, outputRoot }, null, 2)}\n`);
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { parseTmTable, parseProfile, parseNationalDex, parseSpeciesDefines, resolveSpeciesAlias, mapFactorySpecies, extract, buildMappingGaps };
