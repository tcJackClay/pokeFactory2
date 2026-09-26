import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { getReferenceSetsByRange } from '../../config/factoryReferenceSets';

const POKEROGUE_ALIGNMENT_COMMIT = 'df2e5635668359c244fc277121b86cba912a2f8d';
const EXPECTED_FACTORY_SET_COUNT = 772;
const EXPECTED_UNIQUE_MOVE_COUNT = 277;
const EXPECTED_SORTED_MOVE_NAME_SHA256 = 'fc9690ba73bc72d83c817a80a99cf68396a746f8a2625a431c77748ddbe26301';

test('Pokerogue battle calculation audit stays pinned to the reviewed factory move pool', async () => {
  const factorySets = await getReferenceSetsByRange(110, 881);
  const moveNames = [...new Set(factorySets.flatMap((entry) => entry.moveNames))].sort();
  const movePoolHash = createHash('sha256').update(moveNames.join('\n')).digest('hex');

  assert.equal(factorySets.length, EXPECTED_FACTORY_SET_COUNT);
  assert.equal(moveNames.length, EXPECTED_UNIQUE_MOVE_COUNT);
  assert.equal(
    movePoolHash,
    EXPECTED_SORTED_MOVE_NAME_SHA256,
    `Factory move pool changed after Pokerogue ${POKEROGUE_ALIGNMENT_COMMIT}; rerun the upstream move-attribute audit.`,
  );
});
