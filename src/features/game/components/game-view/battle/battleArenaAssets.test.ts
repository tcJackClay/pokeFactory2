import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { POKEROGUE_FACTORY_ARENA } from './battleArenaAssets';

function readPngSize(publicPath: string) {
  const file = readFileSync(join(process.cwd(), 'public', publicPath.replace(/^\//, '')));
  assert.equal(file.subarray(1, 4).toString('ascii'), 'PNG');
  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
  };
}

test('PokeRogue factory arena assets retain their native logical dimensions', () => {
  for (const asset of Object.values(POKEROGUE_FACTORY_ARENA)) {
    assert.deepEqual(readPngSize(asset.src), {
      width: asset.width,
      height: asset.height,
    });
  }
});
