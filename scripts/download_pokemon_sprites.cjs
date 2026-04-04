#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const BASE_API = 'https://pokeapi.co/api/v2';
const OUTPUT_ROOT = path.resolve(process.cwd(), 'public', 'pokemon-sprites');
const CONCURRENCY = 12;
const RETRIES = 3;
const REQUEST_TIMEOUT_MS = 30000;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeName(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function extFromUrl(urlString) {
  try {
    const pathname = new URL(urlString).pathname;
    const ext = path.extname(pathname);
    return ext || '.png';
  } catch {
    return '.png';
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
      return res.json();
    } catch (err) {
      if (attempt === RETRIES) throw err;
      await sleep(400 * attempt);
    }
  }
}

async function downloadFile(url, outPath) {
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      ensureDir(path.dirname(outPath));
      fs.writeFileSync(outPath, Buffer.from(arrayBuffer));
      return;
    } catch (err) {
      if (attempt === RETRIES) throw err;
      await sleep(250 * attempt);
    }
  }
}

async function getAllPokemonRefs() {
  const page = await fetchJson(`${BASE_API}/pokemon?limit=20000`);
  return page.results || [];
}

function getSpriteTargets(data) {
  return [
    { key: 'front_default', url: data?.sprites?.front_default },
    { key: 'back_default', url: data?.sprites?.back_default },
    { key: 'official_artwork', url: data?.sprites?.other?.['official-artwork']?.front_default },
  ];
}

async function workerQueue(items, worker, concurrency) {
  let idx = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const current = idx;
      idx += 1;
      if (current >= items.length) return;
      await worker(items[current], current);
    }
  });
  await Promise.all(runners);
}

async function main() {
  ensureDir(OUTPUT_ROOT);
  ensureDir(path.join(OUTPUT_ROOT, 'front_default'));
  ensureDir(path.join(OUTPUT_ROOT, 'back_default'));
  ensureDir(path.join(OUTPUT_ROOT, 'official_artwork'));

  console.log('Fetching pokemon index from PokeAPI...');
  const refs = await getAllPokemonRefs();
  console.log(`Found ${refs.length} entries.`);

  const report = {
    generatedAt: new Date().toISOString(),
    totalEntries: refs.length,
    successEntries: 0,
    failedEntries: [],
    missingSprites: {
      front_default: [],
      back_default: [],
      official_artwork: [],
    },
    entries: [],
  };

  await workerQueue(
    refs,
    async (ref, i) => {
      const marker = `${i + 1}/${refs.length}`;
      try {
        const data = await fetchJson(ref.url);
        const id = data.id;
        const name = safeName(data.name);
        const sprites = getSpriteTargets(data);

        const entry = {
          id,
          name: data.name,
          sourceUrl: ref.url,
          local: {},
        };

        for (const sprite of sprites) {
          if (!sprite.url) {
            report.missingSprites[sprite.key].push({ id, name: data.name });
            entry.local[sprite.key] = null;
            continue;
          }

          const ext = extFromUrl(sprite.url);
          const filename = `${String(id).padStart(4, '0')}-${name}${ext}`;
          const outPath = path.join(OUTPUT_ROOT, sprite.key, filename);
          await downloadFile(sprite.url, outPath);
          entry.local[sprite.key] = path.relative(path.resolve(process.cwd(), 'public'), outPath).replaceAll('\\', '/');
        }

        report.entries.push(entry);
        report.successEntries += 1;
        if ((i + 1) % 50 === 0 || i === refs.length - 1) {
          console.log(`Progress ${marker}`);
        }
      } catch (err) {
        report.failedEntries.push({
          name: ref.name,
          url: ref.url,
          error: String(err?.message || err),
        });
        console.log(`Failed ${marker}: ${ref.name}`);
      }
    },
    CONCURRENCY,
  );

  const reportPath = path.join(OUTPUT_ROOT, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('Done.');
  console.log(`Success entries: ${report.successEntries}/${report.totalEntries}`);
  console.log(`Failed entries: ${report.failedEntries.length}`);
  console.log(`Missing front_default: ${report.missingSprites.front_default.length}`);
  console.log(`Missing back_default: ${report.missingSprites.back_default.length}`);
  console.log(`Missing official_artwork: ${report.missingSprites.official_artwork.length}`);
  console.log(`Report: ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
