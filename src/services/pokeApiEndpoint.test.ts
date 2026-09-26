import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPokeApiUrl,
  getPokemonHomeSpriteUrl,
  getPokemonOfficialArtworkUrl,
  getPokemonSpriteUrl,
  proxyExternalResourceUrl,
  proxyExternalResourceUrls,
} from './pokeApiEndpoint';

test('PokeAPI 与精灵资源默认使用同源服务器路由', () => {
  assert.equal(buildPokeApiUrl('pokemon/25'), '/api/pokeapi/pokemon/25/');
  assert.equal(getPokemonSpriteUrl(25), '/api/pokeapi-sprites/pokemon/25.png');
  assert.equal(getPokemonHomeSpriteUrl(25), '/api/pokeapi-sprites/pokemon/other/home/25.png');
  assert.equal(getPokemonOfficialArtworkUrl(25), '/api/pokeapi-sprites/pokemon/other/official-artwork/25.png');
});

test('外部 PokeAPI 与 GitHub Raw 地址被收敛到服务器代理', () => {
  assert.equal(
    proxyExternalResourceUrl('https://pokeapi.co/api/v2/pokemon-species/25/'),
    '/api/pokeapi/pokemon-species/25/',
  );
  assert.equal(
    proxyExternalResourceUrl('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png'),
    '/api/pokeapi-sprites/pokemon/25.png',
  );
  assert.equal(
    proxyExternalResourceUrl('https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv/moves.csv'),
    '/api/pokedex-csv/moves.csv',
  );
  assert.equal(
    proxyExternalResourceUrl('https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/25.ogg'),
    '/api/pokeapi-cries/pokemon/latest/25.ogg',
  );
});

test('PokeAPI 响应中的嵌套外部资源地址会被递归改写', () => {
  const rewritten = proxyExternalResourceUrls({
    species: { url: 'https://pokeapi.co/api/v2/pokemon-species/25/' },
    sprites: [
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png',
    ],
  });

  assert.deepEqual(rewritten, {
    species: { url: '/api/pokeapi/pokemon-species/25/' },
    sprites: ['/api/pokeapi-sprites/pokemon/25.png'],
  });
});
