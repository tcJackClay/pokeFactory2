// Evidence packaging only. Does not launch a browser, modify originals or stage Git files.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const task = dirname(fileURLToPath(import.meta.url));
const repo = resolve(task, '../../..');
const manifestPath = resolve(task, 'commit-manifest.json');
const slash = s => s.replaceAll('\\', '/');
const hash = b => createHash('sha256').update(b).digest('hex');
async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(p)); else files.push(p);
  }
  return files.sort();
}
const originalFiles = (await walk(task)).filter(p => p !== manifestPath && !p.endsWith('result.json.gz'));
const originalHashes = new Map(await Promise.all(originalFiles.map(async p => [p, hash(await readFile(p))])));
const compressedResults = [];
for (const run of ['evidence', 'evidence/attempt-2']) {
  const source = resolve(task, run, 'result.json');
  const data = await readFile(source), compressed = gzipSync(data, { level: 9 });
  if (!gunzipSync(compressed).equals(data)) throw new Error(`Compression round trip failed: ${source}`);
  const destination = source + '.gz';
  await writeFile(destination, compressed);
  compressedResults.push({ source: slash(relative(repo, source)), sourceBytes: data.length, sourceSha256: hash(data), committedCopy: slash(relative(repo, destination)), compressedBytes: compressed.length, sha256: hash(compressed), decompressionVerifiedByteIdentical: true });
}
const firstKeyIds = ['000', '001', '002', '003', '019', '020'];
const secondKeyIds = ['000', '001', '002', '003', '023', '024', '037', '038', '039', '093', '094', '101', '102', '103', '104', '139', '141'];
const requiredMetadata = new Set(['evidence/environment.json', 'evidence/selection.json', 'evidence/attempt-2/selection.json', 'evidence/attempt-2/rapid-spin-go-raw.json', 'evidence/attempt-2/rapid-spin-target-observation.json']);
const rootFiles = new Set(['runtime.md', 'log.md', 'run-natural.mjs', 'run-natural-attempt1-original.mjs', 'prepare-commit-manifest.mjs']);
const files = [], localOnly = [];
for (const path of (await walk(task)).filter(p => p !== manifestPath)) {
  const rel = slash(relative(task, path)), data = await readFile(path);
  const e = { path: slash(relative(repo, path)), bytes: data.length, sha256: hash(data) };
  const second = rel.startsWith('evidence/attempt-2/');
  const basename = rel.split('/').at(-1), id = basename.match(/^(\d{3})-/)?.[1];
  let reason;
  if (rootFiles.has(rel)) reason = 'player report or reproducible harness';
  else if (rel.endsWith('.txt')) reason = 'all original observed page text';
  else if (rel.endsWith('/result.json.gz')) reason = 'complete input/state-summary/log/console/network trace, losslessly compressed';
  else if (requiredMetadata.has(rel)) reason = 'environment, natural selection instruction or original move evidence';
  else if (id && (second ? secondKeyIds : firstKeyIds).includes(id) && (rel.endsWith('.png') || rel.endsWith('.json.gz'))) reason = 'key natural-flow checkpoint or harness-failure/RapidSpin evidence';
  if (reason) files.push({ ...e, reason }); else localOnly.push({ ...e, reason: 'original retained locally; intentionally excluded from commit subset' });
}
for (const [p, before] of originalHashes) if (hash(await readFile(p)) !== before) throw new Error(`Original changed during packaging: ${p}`);
const sum = xs => xs.reduce((n, e) => n + e.bytes, 0);
const bySuffix = xs => Object.fromEntries(['.png', '.json.gz', '.json', '.txt', '.md', '.mjs'].map(ext => [ext, { files: xs.filter(x => x.path.endsWith(ext)).length, bytes: sum(xs.filter(x => x.path.endsWith(ext))) }]));
const manifest = {
  schemaVersion: 1,
  purpose: 'Explicit proposed Git commit subset. No files have been staged or committed by this script.',
  provenance: { codeBaseline: 'c4a7db1fa1c22a27291a12e6d7898e6c32eb80f2', startHead: '6bd0352546f6cfbfeb37278613817ac310841fa2', endHead: '82a98efecd263f1f788d7425456b086e64cc7a4c', evidenceKind: 'Natural new-save UI run; one authorized retry after harness error; touch emulation 390x844; no game-state/RNG injection or DEV Win', unverified: ['natural third/sixth-win shops', 'complete seven-battle set', 'physical phone', 'production environment'], productDefect: 'Natural Rapid Spin increases defender speed; see runtime and 103/104/139 evidence' },
  archivePolicy: 'All original artifacts remain untouched on disk. Commit only files[] plus this manifest. localOnly[] is an inventory, not files to stage. Complete result.json input/log/state-summary traces are committed losslessly as result.json.gz; continuous full-save snapshots/screenshots outside selected IDs and browser storage exports remain local only.',
  self: { path: slash(relative(repo, manifestPath)), commit: true, note: 'Self is excluded from files[] hashes and byte totals to avoid circular hashing; exact manifest SHA256, size and inclusive total are printed by this script and reported at handoff.' },
  keyIds: { firstAttempt: firstKeyIds, secondAttempt: secondKeyIds },
  compressedResults,
  summary: { filesExcludingManifest: files.length, bytesExcludingManifest: sum(files), bySuffix: bySuffix(files), localOnlyFiles: localOnly.length, localOnlyBytes: sum(localOnly), localOnlyBySuffix: bySuffix(localOnly) },
  files, localOnly
};
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const m = await readFile(manifestPath);
console.log(JSON.stringify({ manifest: manifest.self.path, manifestBytes: m.length, manifestSha256: hash(m), commitFilesIncludingManifest: files.length + 1, commitBytesIncludingManifest: sum(files) + m.length, localOnlyFiles: localOnly.length, localOnlyBytes: sum(localOnly), compression: compressedResults, includedBySuffix: manifest.summary.bySuffix, originalsUnchanged: true }, null, 2));
