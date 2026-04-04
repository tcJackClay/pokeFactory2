#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const SPRITES_ROOT = path.resolve(PROJECT_ROOT, 'public', 'pokemon-sprites');
const REPORT_PATH = path.join(SPRITES_ROOT, 'report.json');
const FILL_REPORT_PATH = path.join(SPRITES_ROOT, 'fill-report.json');
const REF_ROOT = path.resolve(PROJECT_ROOT, 'reference', 'pokeemerald-expansion', 'graphics', 'pokemon');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function safeName(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function padId(id) {
  return String(id).padStart(4, '0');
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function listReferenceDirs() {
  return new Set(
    fs
      .readdirSync(REF_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name),
  );
}

function buildDirCandidates(name, refDirSet) {
  const tokens = String(name).split('-').filter(Boolean);
  const candidates = [];

  for (let len = tokens.length; len >= 1; len -= 1) {
    const raw = tokens.slice(0, len).join('-');
    const under = raw.replace(/-/g, '_');
    candidates.push(raw, under);
  }

  const unique = [...new Set(candidates)];
  return unique.filter((c) => refDirSet.has(c));
}

function buildSubdirHints(name) {
  const hints = [];
  const n = String(name);
  if (n.includes('-mega-') || n.endsWith('-mega')) hints.push('mega');
  if (n.includes('-totem')) hints.push('totem');
  if (n.includes('-gmax')) hints.push('gmax');
  if (n.includes('-alola')) hints.push('alola');
  if (n.includes('-hisui')) hints.push('hisui');
  if (n.includes('-paldea')) hints.push('paldea');
  return [...new Set(hints)];
}

function buildSourceCandidates(name, spriteKey, refDirSet) {
  const dirCandidates = buildDirCandidates(name, refDirSet);
  const subdirHints = buildSubdirHints(name);
  const wantedFiles =
    spriteKey === 'back_default'
      ? ['back.png', 'backf.png']
      : ['front.png', 'anim_front.png'];

  const candidates = [];

  for (const dirName of dirCandidates) {
    const dirPath = path.join(REF_ROOT, dirName);

    for (const hint of subdirHints) {
      for (const fileName of wantedFiles) {
        candidates.push({
          path: path.join(dirPath, hint, fileName),
          strategy: `dir:${dirName}/subdir:${hint}/file:${fileName}`,
        });
      }
    }

    for (const fileName of wantedFiles) {
      candidates.push({
        path: path.join(dirPath, fileName),
        strategy: `dir:${dirName}/file:${fileName}`,
      });
    }
  }

  return candidates;
}

function pickSource(name, spriteKey, refDirSet) {
  const candidates = buildSourceCandidates(name, spriteKey, refDirSet);
  return candidates.find((c) => fileExists(c.path)) || null;
}

function targetPathFor(spriteKey, id, name) {
  return path.join(SPRITES_ROOT, spriteKey, `${padId(id)}-${safeName(name)}.png`);
}

function fillOne(entry, spriteKey, refDirSet) {
  const source = pickSource(entry.name, spriteKey, refDirSet);
  const target = targetPathFor(spriteKey, entry.id, entry.name);
  ensureDir(path.dirname(target));

  const mapping = {
    id: entry.id,
    name: entry.name,
    spriteKey,
    target: path.relative(PROJECT_ROOT, target).replaceAll('\\', '/'),
    status: 'not_found',
  };

  if (fileExists(target)) {
    mapping.status = 'already_exists';
    return mapping;
  }

  if (!source) {
    mapping.status = 'missing_in_reference';
    return mapping;
  }

  fs.copyFileSync(source.path, target);
  mapping.status = 'filled';
  mapping.source = path.relative(PROJECT_ROOT, source.path).replaceAll('\\', '/');
  mapping.strategy = source.strategy;
  return mapping;
}

function summarize(mappings) {
  const summary = {
    total: mappings.length,
    filled: 0,
    alreadyExists: 0,
    missingInReference: 0,
  };

  for (const m of mappings) {
    if (m.status === 'filled') summary.filled += 1;
    else if (m.status === 'already_exists') summary.alreadyExists += 1;
    else if (m.status === 'missing_in_reference') summary.missingInReference += 1;
  }
  return summary;
}

function main() {
  if (!fileExists(REPORT_PATH)) {
    throw new Error(`Missing report file: ${REPORT_PATH}`);
  }
  if (!fileExists(REF_ROOT)) {
    throw new Error(`Missing reference dir: ${REF_ROOT}`);
  }

  const report = readJson(REPORT_PATH);
  const refDirSet = listReferenceDirs();

  const frontItems = report?.missingSprites?.front_default || [];
  const backItems = report?.missingSprites?.back_default || [];
  const officialItems = report?.missingSprites?.official_artwork || [];

  const frontMappings = frontItems.map((e) => fillOne(e, 'front_default', refDirSet));
  const backMappings = backItems.map((e) => fillOne(e, 'back_default', refDirSet));
  const officialMappings = officialItems.map((e) => fillOne(e, 'official_artwork', refDirSet));

  const fillReport = {
    generatedAt: new Date().toISOString(),
    basedOn: path.relative(PROJECT_ROOT, REPORT_PATH).replaceAll('\\', '/'),
    referenceRoot: path.relative(PROJECT_ROOT, REF_ROOT).replaceAll('\\', '/'),
    summary: {
      front_default: summarize(frontMappings),
      back_default: summarize(backMappings),
      official_artwork: summarize(officialMappings),
    },
    mappings: {
      front_default: frontMappings,
      back_default: backMappings,
      official_artwork: officialMappings,
    },
  };

  writeJson(FILL_REPORT_PATH, fillReport);

  console.log('Fill complete.');
  console.log(`Report: ${FILL_REPORT_PATH}`);
  console.log(`front_default -> filled: ${fillReport.summary.front_default.filled}, missing_in_reference: ${fillReport.summary.front_default.missingInReference}`);
  console.log(`back_default -> filled: ${fillReport.summary.back_default.filled}, missing_in_reference: ${fillReport.summary.back_default.missingInReference}`);
  console.log(`official_artwork -> filled: ${fillReport.summary.official_artwork.filled}, missing_in_reference: ${fillReport.summary.official_artwork.missingInReference}`);
}

main();
