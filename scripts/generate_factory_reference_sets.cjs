const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const FRONTIER_CONSTANTS_PATH = path.join(
  ROOT,
  'reference',
  'pokeemerald-expansion',
  'include',
  'constants',
  'battle_frontier_mons.h',
);
const SPECIES_CONSTANTS_PATH = path.join(
  ROOT,
  'reference',
  'pokeemerald-expansion',
  'include',
  'constants',
  'species.h',
);
const FRONTIER_MONS_DATA_PATH = path.join(
  ROOT,
  'reference',
  'pokeemerald-expansion',
  'src',
  'data',
  'battle_frontier',
  'battle_frontier_mons.h',
);

const CONFIG_DIR = path.join(ROOT, 'src', 'features', 'game', 'config');
const CHUNK_DIR = path.join(CONFIG_DIR, 'factoryReferenceSets', 'chunks');
const OUTPUT_INDEX_PATH = path.join(CONFIG_DIR, 'factoryReferenceSets.ts');

const MIN_FRONTIER_MON_ID = 110;
const MAX_FRONTIER_MON_ID = 881;
const CHUNK_SIZE = 100;

function toKebabFromConstant(constantName, prefix) {
  const raw = constantName.startsWith(prefix) ? constantName.slice(prefix.length) : constantName;
  return raw.toLowerCase().replace(/_/g, '-');
}

function toGen(speciesId) {
  if (speciesId <= 151) return 1;
  if (speciesId <= 251) return 2;
  return 3;
}

function toTier(frontierMonId) {
  if (frontierMonId <= 199) return 0;
  if (frontierMonId <= 266) return 1;
  if (frontierMonId <= 371) return 2;
  if (frontierMonId <= 467) return 3;
  if (frontierMonId <= 563) return 4;
  if (frontierMonId <= 659) return 5;
  if (frontierMonId <= 755) return 6;
  return 7;
}

function parseConstantsMap(fileText, prefix) {
  const map = new Map();
  const regex = new RegExp(`#define\\s+(${prefix}[A-Z0-9_]+)\\s+(\\d+)`, 'g');
  for (const match of fileText.matchAll(regex)) {
    map.set(match[1], Number(match[2]));
  }
  return map;
}

function sanitizeMoveNames(moveConsts) {
  return moveConsts
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && token !== 'MOVE_NONE')
    .map((token) => toKebabFromConstant(token, 'MOVE_'));
}

function parseFrontierMonsData(fileText) {
  const entries = [];
  const entryRegex =
    /\[(FRONTIER_MON_[A-Z0-9_]+)\]\s*=\s*\{[\s\S]*?\.species\s*=\s*(SPECIES_[A-Z0-9_]+),[\s\S]*?\.moves\s*=\s*\{([^}]*)\},[\s\S]*?\.heldItem\s*=\s*(ITEM_[A-Z0-9_]+),[\s\S]*?\},?/g;

  for (const match of fileText.matchAll(entryRegex)) {
    const frontierConst = match[1];
    const speciesConst = match[2];
    const moveConsts = match[3].split(',').map((token) => token.trim()).filter(Boolean);
    const heldItemConst = match[4];

    entries.push({
      frontierConst,
      speciesConst,
      moveNames: sanitizeMoveNames(moveConsts),
      heldItemId: heldItemConst === 'ITEM_NONE' ? 'none' : toKebabFromConstant(heldItemConst, 'ITEM_'),
    });
  }

  return entries;
}

function buildFinalEntries() {
  const frontierConstantsText = fs.readFileSync(FRONTIER_CONSTANTS_PATH, 'utf8');
  const speciesConstantsText = fs.readFileSync(SPECIES_CONSTANTS_PATH, 'utf8');
  const frontierMonsDataText = fs.readFileSync(FRONTIER_MONS_DATA_PATH, 'utf8');

  const frontierMonIdByConst = parseConstantsMap(frontierConstantsText, 'FRONTIER_MON_');
  const speciesIdByConst = parseConstantsMap(speciesConstantsText, 'SPECIES_');
  const parsedEntries = parseFrontierMonsData(frontierMonsDataText);

  const finalEntries = [];
  for (const parsed of parsedEntries) {
    const frontierMonId = frontierMonIdByConst.get(parsed.frontierConst);
    const speciesId = speciesIdByConst.get(parsed.speciesConst);
    if (typeof frontierMonId !== 'number' || typeof speciesId !== 'number') continue;
    if (frontierMonId < MIN_FRONTIER_MON_ID || frontierMonId > MAX_FRONTIER_MON_ID) continue;

    const speciesSlug = toKebabFromConstant(parsed.speciesConst, 'SPECIES_');
    finalEntries.push({
      key: `${speciesSlug}-${frontierMonId}`,
      frontierMonId,
      speciesId,
      gen: toGen(speciesId),
      tier: toTier(frontierMonId),
      moveNames: parsed.moveNames,
      heldItemId: parsed.heldItemId,
    });
  }

  finalEntries.sort((a, b) => a.frontierMonId - b.frontierMonId);
  return finalEntries;
}

function getChunkRanges() {
  const ranges = [];
  for (let start = MIN_FRONTIER_MON_ID; start <= MAX_FRONTIER_MON_ID; start += CHUNK_SIZE) {
    const end = Math.min(MAX_FRONTIER_MON_ID, start + CHUNK_SIZE - 1);
    ranges.push({ start, end });
  }
  return ranges;
}

function writeChunkFiles(finalEntries, chunkRanges) {
  fs.mkdirSync(CHUNK_DIR, { recursive: true });

  for (const file of fs.readdirSync(CHUNK_DIR)) {
    if (file.endsWith('.ts')) {
      fs.unlinkSync(path.join(CHUNK_DIR, file));
    }
  }

  for (const range of chunkRanges) {
    const chunkEntries = finalEntries.filter(
      (entry) => entry.frontierMonId >= range.start && entry.frontierMonId <= range.end,
    );
    const chunkFileName = `chunk_${range.start}_${range.end}.ts`;
    const chunkPath = path.join(CHUNK_DIR, chunkFileName);
    const lines = [];

    lines.push("import type { FactoryReferenceSet } from '../../factoryReferenceSets';");
    lines.push('');
    lines.push(`export const FACTORY_REFERENCE_SETS_CHUNK_${range.start}_${range.end}: FactoryReferenceSet[] = [`);
    for (const entry of chunkEntries) {
      const moveNamesSerialized = entry.moveNames.map((moveName) => `'${moveName}'`).join(', ');
      lines.push(
        `  { key: '${entry.key}', frontierMonId: ${entry.frontierMonId}, speciesId: ${entry.speciesId}, gen: ${entry.gen}, tier: ${entry.tier}, moveNames: [${moveNamesSerialized}], heldItemId: '${entry.heldItemId}' },`,
      );
    }
    lines.push('];');
    lines.push('');
    fs.writeFileSync(chunkPath, lines.join('\n'), 'utf8');
  }
}

function writeIndexFile(chunkRanges, totalSets) {
  const lines = [];
  lines.push('export interface FactoryReferenceSet {');
  lines.push('  key: string;');
  lines.push('  frontierMonId: number;');
  lines.push('  speciesId: number;');
  lines.push('  gen: number;');
  lines.push('  tier: number;');
  lines.push('  moveNames: string[];');
  lines.push('  heldItemId: string;');
  lines.push('}');
  lines.push('');
  lines.push('// Auto-generated from reference/pokeemerald-expansion battle_frontier_mons.h');
  lines.push(`// Scope: frontierMonId ${MIN_FRONTIER_MON_ID}..${MAX_FRONTIER_MON_ID}.`);
  lines.push(`// Total sets: ${totalSets} (chunked dynamic imports).`);
  lines.push('export const FACTORY_REFERENCE_SET_MIN_ID = ' + MIN_FRONTIER_MON_ID + ';');
  lines.push('export const FACTORY_REFERENCE_SET_MAX_ID = ' + MAX_FRONTIER_MON_ID + ';');
  lines.push('');
  lines.push('export interface FactoryReferenceChunkMeta {');
  lines.push('  start: number;');
  lines.push('  end: number;');
  lines.push('  key: string;');
  lines.push('}');
  lines.push('');
  lines.push('export const FACTORY_REFERENCE_CHUNKS: FactoryReferenceChunkMeta[] = [');
  for (const range of chunkRanges) {
    lines.push(`  { start: ${range.start}, end: ${range.end}, key: '${range.start}_${range.end}' },`);
  }
  lines.push('];');
  lines.push('');
  lines.push('const chunkLoaders: Record<string, () => Promise<FactoryReferenceSet[]>> = {');
  for (const range of chunkRanges) {
    lines.push(
      `  '${range.start}_${range.end}': () => import('./factoryReferenceSets/chunks/chunk_${range.start}_${range.end}').then((m) => m.FACTORY_REFERENCE_SETS_CHUNK_${range.start}_${range.end}),`,
    );
  }
  lines.push('};');
  lines.push('');
  lines.push('const chunkCache = new Map<string, Promise<FactoryReferenceSet[]>>();');
  lines.push('');
  lines.push('function loadChunkByKey(key: string): Promise<FactoryReferenceSet[]> {');
  lines.push('  const cached = chunkCache.get(key);');
  lines.push('  if (cached) return cached;');
  lines.push('  const loader = chunkLoaders[key];');
  lines.push("  if (!loader) return Promise.resolve([]);");
  lines.push('  const pending = loader();');
  lines.push('  chunkCache.set(key, pending);');
  lines.push('  return pending;');
  lines.push('}');
  lines.push('');
  lines.push('export async function preloadReferenceChunksByRange(min: number, max: number): Promise<void> {');
  lines.push('  const tasks = FACTORY_REFERENCE_CHUNKS');
  lines.push('    .filter((chunk) => chunk.start <= max && chunk.end >= min)');
  lines.push('    .map((chunk) => loadChunkByKey(chunk.key));');
  lines.push('  await Promise.all(tasks);');
  lines.push('}');
  lines.push('');
  lines.push('export async function getReferenceSetsByRange(min: number, max: number): Promise<FactoryReferenceSet[]> {');
  lines.push('  const chunks = FACTORY_REFERENCE_CHUNKS.filter((chunk) => chunk.start <= max && chunk.end >= min);');
  lines.push('  if (chunks.length === 0) return [];');
  lines.push('  const loaded = await Promise.all(chunks.map((chunk) => loadChunkByKey(chunk.key)));');
  lines.push('  return loaded.flat().filter((entry) => entry.frontierMonId >= min && entry.frontierMonId <= max);');
  lines.push('}');
  lines.push('');
  lines.push('export function hasReferenceFrontierMonId(frontierMonId: number): boolean {');
  lines.push('  return frontierMonId >= FACTORY_REFERENCE_SET_MIN_ID && frontierMonId <= FACTORY_REFERENCE_SET_MAX_ID;');
  lines.push('}');
  lines.push('');

  fs.writeFileSync(OUTPUT_INDEX_PATH, lines.join('\n'), 'utf8');
}

function main() {
  const finalEntries = buildFinalEntries();
  const chunkRanges = getChunkRanges();
  writeChunkFiles(finalEntries, chunkRanges);
  writeIndexFile(chunkRanges, finalEntries.length);
  console.log(`Wrote ${OUTPUT_INDEX_PATH}`);
  console.log(`Generated ${finalEntries.length} sets in ${chunkRanges.length} chunks.`);
}

main();
