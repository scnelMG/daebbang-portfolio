import assert from 'node:assert/strict';
import test from 'node:test';
import { catalog, resultFor, profileFor } from '../demo/fixtures.mjs';
import { mapRecommendation, mapBakeryProfile } from '../src/lib/api/adapters.mjs';
test('synthetic preview satisfies the real UI adapters and rejects unknown tags', () => {
  const result = mapRecommendation(resultFor([{ breadId: catalog[0].id, tagIds: [catalog[0].tags[1].id] }]));
  assert.equal(result.results.length, 3);
  assert.deepEqual(result.results.map(r => r.pickType), ['score', 'score', 'random']);
  assert.equal(mapBakeryProfile(profileFor(1)).breads.length, 3);
  assert.throws(() => resultFor([{ breadId: 1, tagIds: [99999] }]));
});
