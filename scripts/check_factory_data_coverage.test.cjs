const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { audit, resourceKey } = require('./check_factory_data_coverage.cjs');

function write(root, relative, body) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-coverage-'));
  write(root, 'storage/data/factorySpeciesIndex.json', [
    { identifier: '25', speciesId: 25, pokemonId: 25, gen: 1 },
    { identifier: '201', speciesId: 201, pokemonId: 201, gen: 2 },
  ]);
  write(root, 'storage/assets/pokemon-sprites/report.json', { entries: [
    { id: 25, local: { front_default: 'pokemon-sprites/front/25.png' } },
  ] });
  write(root, 'storage/assets/pokemon-sprites/front/25.png', 'png');
  write(root, 'backend/config/sync-manifest.json', { pokeapi: ['type/electric'] });
  write(root, 'src/features/game/config/factoryReferenceSets/chunks/chunk_1_2.ts',
    "{ key: 'pikachu-1', frontierMonId: 1, speciesId: 25, gen: 1, tier: 0, moveNames: ['thunderbolt'] }");
  return root;
}

test('inactive VERSION never counts runtime objects and excludes banned species', () => {
  const root = fixture();
  try {
    write(root, 'var/pokeapi/runtime/v2/pokemon/25.json', { name: 'pikachu' });
    const result = audit(root);
    assert.equal(result.version.status, 'inactive');
    assert.equal(result.generations[0].json.pokemon.present, 0);
    assert.deepEqual(result.generations[0].json.move.missing, ['move/thunderbolt']);
    assert.equal(result.generations[1].candidates, 0);
    assert.equal(result.generations[0].images.front.present, 1);
    assert.equal(result.generations[0].images.back.present, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('active VERSION discovers candidate dependencies and rejects damaged objects', () => {
  const root = fixture();
  try {
    const version = 'test-v1';
    const entries = {};
    function object(key, body) {
      const data = Buffer.from(JSON.stringify(body));
      const sha256 = crypto.createHash('sha256').update(data).digest('hex');
      const file = `objects/${sha256}.body`;
      write(root, `var/pokeapi/versions/${version}/${file}`, data);
      entries[key] = { key, file, sha256, size: data.length };
    }
    object('pokemon/25', {
      species: { url: '/api/pokeapi/pokemon-species/25/' },
      moves: [{ move: { url: '/api/pokeapi/move/thunderbolt/' } }],
      abilities: [{ ability: { url: '/api/pokeapi/ability/static/' } }],
      forms: [{ url: '/api/pokeapi/pokemon-form/pikachu/' }],
    });
    object('pokemon-species/25', { evolution_chain: { url: '/api/pokeapi/evolution-chain/10/' } });
    object('move/thunderbolt', { name: 'thunderbolt' });
    object('ability/static', { name: 'static' });
    entries['move/thunderbolt'].sha256 = 'bad-hash';
    write(root, 'var/current.json', { version });
    write(root, `var/pokeapi/versions/${version}/manifest.json`, { version, entries });
    const result = audit(root);
    const json = result.generations[0].json;
    assert.equal(json.pokemon.present, 1);
    assert.equal(json['pokemon-species'].present, 1);
    assert.deepEqual(json.move.missing, ['move/thunderbolt']);
    assert.equal(json.ability.present, 1);
    assert.deepEqual(json['pokemon-form'].missing, ['pokemon-form/pikachu']);
    assert.deepEqual(json['evolution-chain'].missing, ['evolution-chain/10']);
    assert.ok(result.problems.includes('invalid VERSION object: move/thunderbolt'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a frozen pokemon must expose dependency links, including its actual species URL', () => {
  const root = fixture();
  try {
    const version = 'test-v2';
    const entries = {};
    function object(key, body) {
      const data = Buffer.from(JSON.stringify(body));
      const sha256 = crypto.createHash('sha256').update(data).digest('hex');
      const file = `objects/${sha256}.body`;
      write(root, `var/pokeapi/versions/${version}/${file}`, data);
      entries[key] = { key, file, sha256, size: data.length };
    }
    object('pokemon/25', { species: { url: '/api/pokeapi/pokemon-species/133/' }, moves: [], abilities: [], forms: [] });
    object('pokemon-species/25', { evolution_chain: null });
    write(root, 'var/current.json', { version });
    write(root, `var/pokeapi/versions/${version}/manifest.json`, { version, entries });
    const mismatched = audit(root);
    assert.deepEqual(mismatched.generations[0].json['pokemon-species'].missing, ['pokemon-species/133']);

    object('pokemon/25', { species: { url: '/api/pokeapi/pokemon-species/25/' }, abilities: [], forms: [] });
    write(root, `var/pokeapi/versions/${version}/manifest.json`, { version, entries });
    const damaged = audit(root);
    assert.deepEqual(damaged.generations[0].json.pokemon.missing, ['pokemon/25']);
    assert.ok(damaged.problems.includes('invalid VERSION dependency shape: pokemon/25'));

    write(root, `var/pokeapi/versions/${version}/manifest.json`, { version, entries: [] });
    assert.equal(audit(root).version.status, 'invalid');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('only exact supported PokeAPI resource URLs become keys', () => {
  assert.equal(resourceKey('https://pokeapi.co/api/v2/move/surf/'), 'move/surf');
  assert.equal(resourceKey('/api/pokeapi/move/surf/'), 'move/surf');
  assert.equal(resourceKey('https://other.example/api/v2/move/surf/'), null);
  assert.equal(resourceKey('https://pokeapi.co/api/v2/item/potion/'), null);
});
