const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, 'public', 'data', 'factorySpeciesIndex.json');
const MAX_SPECIES_ID = 1025;
const CONCURRENCY = 4;
const RETRY_DELAYS_MS = [0, 250, 1000, 2500];
const DIRECT_SPECIAL_FORMS_PATH = path.join(
  ROOT,
  'src',
  'features',
  'game',
  'config',
  'specialForms.ts',
);

function parseJson(response) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${response.url}`);
  }
  return response.json();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOfficialPokeApi(pathname) {
  const url = `https://pokeapi.co/api/v2/${pathname}`;
  let lastError = new Error(`Failed to fetch ${url}`);

  for (const retryDelay of RETRY_DELAYS_MS) {
    if (retryDelay > 0) {
      await delay(retryDelay);
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
      });
      return await parseJson(response);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function parseNumericIdFromUrl(url) {
  const match = /\/(\d+)\/?$/.exec(String(url || ''));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readDirectSpecialForms() {
  const fileText = fs.readFileSync(DIRECT_SPECIAL_FORMS_PATH, 'utf8');
  const regex = /pokeApiName:\s*'([^']+)'.*?gen:\s*(\d+).*?requirement:\s*'(DIRECT|HOLD_ITEM)'/g;
  const forms = [];

  for (const match of fileText.matchAll(regex)) {
    forms.push({
      identifier: match[1],
      gen: Number(match[2]),
    });
  }

  return forms;
}

async function runInBatches(items, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function next() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => next()),
  );

  return results;
}

async function buildBaseSpeciesEntries() {
  const speciesIds = Array.from({ length: MAX_SPECIES_ID }, (_, idx) => idx + 1);
  console.log(`Fetching ${speciesIds.length} species records...`);

  const speciesPayloads = await runInBatches(speciesIds, async (speciesId, index) => {
    if (index % 100 === 0) {
      console.log(`  species ${index + 1}/${speciesIds.length}`);
    }
    const species = await fetchOfficialPokeApi(`pokemon-species/${speciesId}`);
    return {
      speciesId,
      evolvesFromSpeciesId: parseNumericIdFromUrl(species.evolves_from_species?.url),
    };
  });

  const evolvesToMap = new Map();
  for (const payload of speciesPayloads) {
    if (payload.evolvesFromSpeciesId === null) continue;
    evolvesToMap.set(
      payload.evolvesFromSpeciesId,
      (evolvesToMap.get(payload.evolvesFromSpeciesId) ?? 0) + 1,
    );
  }

  console.log(`Fetching ${speciesIds.length} pokemon records...`);
  const pokemonPayloads = await runInBatches(speciesIds, async (speciesId, index) => {
    if (index % 100 === 0) {
      console.log(`  pokemon ${index + 1}/${speciesIds.length}`);
    }
    const pokemon = await fetchOfficialPokeApi(`pokemon/${speciesId}`);
    return {
      speciesId,
      pokemonId: pokemon.id,
      bst: Array.isArray(pokemon.stats)
        ? pokemon.stats.reduce((sum, statEntry) => sum + Number(statEntry?.base_stat ?? 0), 0)
        : 0,
    };
  });

  return speciesPayloads.map((speciesPayload, index) => {
    const pokemonPayload = pokemonPayloads[index];
    const hasPreEvolution = speciesPayload.evolvesFromSpeciesId !== null;
    const hasEvolution = (evolvesToMap.get(speciesPayload.speciesId) ?? 0) > 0;

    return {
      identifier: String(speciesPayload.speciesId),
      speciesId: speciesPayload.speciesId,
      pokemonId: pokemonPayload.pokemonId,
      gen: speciesPayload.speciesId <= 151 ? 1
        : speciesPayload.speciesId <= 251 ? 2
        : speciesPayload.speciesId <= 386 ? 3
        : speciesPayload.speciesId <= 493 ? 4
        : speciesPayload.speciesId <= 649 ? 5
        : speciesPayload.speciesId <= 721 ? 6
        : speciesPayload.speciesId <= 809 ? 7
        : speciesPayload.speciesId <= 898 ? 8
        : 9,
      bst: pokemonPayload.bst,
      evolutionStage: !hasPreEvolution ? 'BASE' : hasEvolution ? 'MID' : 'FINAL',
    };
  });
}

async function buildSpecialFormEntries() {
  const forms = readDirectSpecialForms();
  console.log(`Fetching ${forms.length} direct/hold-item special forms...`);
  const skipped = [];

  const entries = await runInBatches(forms, async (form, index) => {
    if (index % 20 === 0) {
      console.log(`  forms ${index + 1}/${forms.length}`);
    }
    try {
      const pokemon = await fetchOfficialPokeApi(`pokemon/${form.identifier}`);
      const speciesId = parseNumericIdFromUrl(pokemon.species?.url);
      if (!speciesId) {
        skipped.push(`${form.identifier} (missing species id)`);
        return null;
      }

      return {
        identifier: form.identifier,
        speciesId,
        pokemonId: pokemon.id,
        gen: form.gen,
        bst: Array.isArray(pokemon.stats)
          ? pokemon.stats.reduce((sum, statEntry) => sum + Number(statEntry?.base_stat ?? 0), 0)
          : 0,
        evolutionStage: 'FINAL',
      };
    } catch (error) {
      skipped.push(form.identifier);
      return null;
    }
  });

  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length} special forms that will use runtime fallback.`);
  }

  return entries.filter(Boolean);
}

async function main() {
  const baseEntries = await buildBaseSpeciesEntries();
  const specialEntries = await buildSpecialFormEntries();
  const finalEntries = [...baseEntries, ...specialEntries];

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalEntries), 'utf8');

  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`Entries: ${finalEntries.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
