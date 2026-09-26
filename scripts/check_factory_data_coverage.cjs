#!/usr/bin/env node
// Offline audit only: this script reads frozen VERSION objects and bundled sprites.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TYPES = ['pokemon', 'pokemon-species', 'move', 'ability', 'pokemon-form', 'evolution-chain'];
const VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function inside(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) return null;
  const resolved = path.resolve(root, relative);
  return resolved.startsWith(path.resolve(root) + path.sep) ? resolved : null;
}

function resourceKey(url) {
  if (typeof url !== 'string') return null;
  const match = /^(?:https?:\/\/pokeapi\.co\/api\/v2\/|\/api\/pokeapi\/)(pokemon|pokemon-species|move|ability|pokemon-form|evolution-chain)\/([^/?#]+)\/?$/.exec(url);
  return match ? `${match[1]}/${match[2]}` : null;
}

function addUrl(set, value, prefix) {
  const key = resourceKey(value?.url);
  if (key?.startsWith(`${prefix}/`)) set.add(key);
}

function hasDependencyShape(key, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (key.startsWith('pokemon/')) {
    return resourceKey(value.species?.url)?.startsWith('pokemon-species/')
      && [['moves', 'move'], ['abilities', 'ability'], ['forms', null]].every(([field, link]) =>
        Array.isArray(value[field]) && value[field].every((entry) =>
          resourceKey(link ? entry?.[link]?.url : entry?.url)?.startsWith(`${link ?? 'pokemon-form'}/`)));
  }
  if (key.startsWith('pokemon-species/')) {
    return Object.hasOwn(value, 'evolution_chain')
      && (value.evolution_chain === null
        || resourceKey(value.evolution_chain?.url)?.startsWith('evolution-chain/'));
  }
  return true;
}

function referenceSets(root) {
  const directory = path.join(root, 'src/features/game/config/factoryReferenceSets/chunks');
  const result = [];
  for (const name of fs.readdirSync(directory).filter((name) => /^chunk_\d+_\d+\.ts$/.test(name)).sort()) {
    const source = fs.readFileSync(path.join(directory, name), 'utf8');
    for (const match of source.matchAll(/\{ key: '[^']+', frontierMonId: (\d+), speciesId: (\d+), gen: (\d+), tier: \d+, moveNames: \[([^\]]*)\]/g)) {
      result.push({ id: Number(match[1]), speciesId: Number(match[2]), gen: Number(match[3]), moves: [...match[4].matchAll(/'([^']+)'/g)].map((item) => item[1]) });
    }
  }
  return result;
}

function inspectVersion(root) {
  const state = path.join(root, 'var');
  const pointerFile = fs.existsSync(path.join(state, 'current.json'))
    ? path.join(state, 'current.json')
    : path.join(state, 'pokeapi/current.json');
  if (!fs.existsSync(pointerFile)) return { status: 'inactive', version: null, entries: {}, versionRoot: null, problems: [] };
  const problems = [];
  let pointer;
  try { pointer = readJson(pointerFile); } catch (error) {
    return { status: 'invalid', version: null, entries: {}, versionRoot: null, problems: [`pointer: ${error.message}`] };
  }
  if (!VERSION_RE.test(pointer?.version ?? '')) {
    return { status: 'invalid', version: null, entries: {}, versionRoot: null, problems: ['invalid pointer version'] };
  }
  const versionRoot = path.join(state, 'pokeapi/versions', pointer.version);
  let manifest;
  try { manifest = readJson(path.join(versionRoot, 'manifest.json')); } catch (error) {
    return { status: 'invalid', version: pointer.version, entries: {}, versionRoot, problems: [`manifest: ${error.message}`] };
  }
  if (manifest?.version !== pointer.version || !manifest.entries || typeof manifest.entries !== 'object' || Array.isArray(manifest.entries)) {
    problems.push('manifest version/entries mismatch');
  }
  return { status: problems.length ? 'invalid' : 'active', version: pointer.version, entries: manifest.entries ?? {}, versionRoot, problems };
}

function audit(root) {
  const index = readJson(path.join(root, 'storage/data/factorySpeciesIndex.json'));
  const spriteReport = readJson(path.join(root, 'storage/assets/pokemon-sprites/report.json'));
  const baseManifest = readJson(path.join(root, 'backend/config/sync-manifest.json'));
  const version = inspectVersion(root);
  const sprites = new Map(spriteReport.entries.map((entry) => [entry.id, entry]));
  const sets = referenceSets(root);
  const generations = [];
  const problems = [...version.problems];
  const frozenCache = new Map();

  function frozen(key) {
    if (frozenCache.has(key)) return frozenCache.get(key);
    const entry = version.entries[key];
    if (!entry || version.status !== 'active') return null;
    const file = inside(version.versionRoot, entry.file);
    if (!file || !fs.existsSync(file)) {
      problems.push(`missing VERSION object: ${key}`);
      frozenCache.set(key, null);
      return null;
    }
    const bytes = fs.readFileSync(file);
    if (entry.key !== key || bytes.length !== entry.size || crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
      problems.push(`invalid VERSION object: ${key}`);
      frozenCache.set(key, null);
      return null;
    }
    let value;
    try { value = JSON.parse(bytes.toString('utf8')); } catch {
      problems.push(`invalid VERSION JSON: ${key}`);
      frozenCache.set(key, null);
      return null;
    }
    if (!hasDependencyShape(key, value)) {
      problems.push(`invalid VERSION dependency shape: ${key}`);
      frozenCache.set(key, null);
      return null;
    }
    frozenCache.set(key, value);
    return value;
  }

  for (let gen = 1; gen <= 9; gen += 1) {
    // Unown (species 201) is explicitly banned in factorySpeciesRules.ts.
    const candidates = index.filter((entry) => entry.gen === gen && entry.speciesId !== 201);
    const keys = Object.fromEntries(TYPES.map((type) => [type, new Set()]));
    const unresolved = [];
    for (const candidate of candidates) {
      const pokemonKey = `pokemon/${candidate.identifier}`;
      keys.pokemon.add(pokemonKey);
      keys['pokemon-species'].add(`pokemon-species/${candidate.speciesId}`);
      const pokemon = frozen(pokemonKey);
      if (!pokemon) {
        unresolved.push(pokemonKey);
      } else {
        addUrl(keys['pokemon-species'], pokemon.species, 'pokemon-species');
        for (const move of pokemon.moves ?? []) addUrl(keys.move, move.move, 'move');
        for (const ability of pokemon.abilities ?? []) addUrl(keys.ability, ability.ability, 'ability');
        for (const form of pokemon.forms ?? []) addUrl(keys['pokemon-form'], form, 'pokemon-form');
      }
      const species = frozen(`pokemon-species/${candidate.speciesId}`);
      if (species) addUrl(keys['evolution-chain'], species.evolution_chain, 'evolution-chain');
    }
    const reference = sets.filter((set) => set.gen === gen && set.speciesId !== 201);
    for (const set of reference) {
      keys.pokemon.add(`pokemon/${set.speciesId}`);
      keys['pokemon-species'].add(`pokemon-species/${set.speciesId}`);
      for (const move of set.moves) keys.move.add(`move/${move}`);
    }
    const json = {};
    for (const type of TYPES) {
      const expected = [...keys[type]].sort();
      const missing = expected.filter((key) => !frozen(key));
      json[type] = { expected: expected.length, present: expected.length - missing.length, missing };
    }
    const images = {};
    for (const [variant, label] of [['front_default', 'front'], ['back_default', 'back'], ['official_artwork', 'official']]) {
      const missing = [];
      const paths = [];
      for (const candidate of candidates) {
        const relative = sprites.get(candidate.pokemonId)?.local?.[variant] ?? null;
        const file = relative && inside(path.join(root, 'storage/assets'), relative);
        paths.push({ pokemonId: candidate.pokemonId, path: relative });
        if (!file || !fs.existsSync(file)) missing.push({ pokemonId: candidate.pokemonId, path: relative });
      }
      images[label] = { expected: candidates.length, present: candidates.length - missing.length, missing, paths };
    }
    generations.push({ gen, candidates: candidates.length, referenceSets: reference.length, json, unresolvedPokemon: unresolved, images });
  }
  const seedKeys = baseManifest.pokeapi.map((key) => ({ key, present: Boolean(frozen(key)) }));
  return {
    scope: 'offline fixed VERSION and bundled sprite paths only; var/pokeapi/runtime is excluded',
    version: { status: version.status, id: version.version, manifestEntries: Object.keys(version.entries).length },
    indexEntries: index.length,
    spriteReportEntries: spriteReport.entries.length,
    baseSeeds: seedKeys,
    generations,
    problems,
    limitations: [
      'Move, ability, form, and evolution-chain closure from a candidate is knowable only when its pokemon/species VERSION JSON is valid.',
      'Reference set moves are included from the local fixed set chunks; their pokemon/species keys are included separately.',
      'Images are counted by candidate pokemonId and exact report.json local path; front fallback for missing back/official is not counted as original coverage.',
      'This audit does not prove browser request paths, visual rendering, runtime timing, or release rights.',
    ],
  };
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] ?? path.join(__dirname, '..'));
  try { process.stdout.write(`${JSON.stringify(audit(root), null, 2)}\n`); }
  catch (error) { console.error(error); process.exitCode = 1; }
}

module.exports = { audit, inspectVersion, resourceKey };
