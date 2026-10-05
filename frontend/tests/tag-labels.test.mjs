import test from 'node:test';
import assert from 'node:assert/strict';
import { mapBreadCatalog, validateTray } from '../src/lib/api/adapters.mjs';

test('renamed type tags preserve backend names and numeric request IDs', () => {
  const catalog = mapBreadCatalog([{ id: 1, name: '소금빵', tags: [
    { id: 31, name: '근본', isTypeTag: true },
    { id: 32, name: '사파', isTypeTag: true },
    { id: 33, name: '촉촉', isTypeTag: false },
  ] }], [{ id: 'salt', label: '소금빵' }]);
  assert.deepEqual(catalog[0].tags.map((tag) => tag.label), ['오리지널', '이색적인', '촉촉']);
  assert.deepEqual(catalog[0].tags.map((tag) => tag.name), ['근본', '사파', '촉촉']);
  assert.deepEqual(validateTray([{ breadId: 1, tagIds: [31, 33] }], catalog), [{ breadId: 1, tagIds: [31, 33] }]);
});
