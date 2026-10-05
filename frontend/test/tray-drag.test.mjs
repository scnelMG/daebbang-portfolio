import assert from 'node:assert/strict';
import test from 'node:test';
import * as drag from '../src/features/tray/tray-drag.mjs';
import { selectBreadDraft } from '../src/features/tray/tray-model.mjs';

const catalog = [{ id: 'salt' }, { id: 'bagel' }];

test('a foreign drag cannot trigger the browser default navigation on the tray', () => {
  const event = new Event('dragover', { cancelable: true });
  event.dataTransfer = { dropEffect: 'copy' };
  drag.prepareTrayDrop(event, false);
  assert.equal(event.defaultPrevented, true);
  assert.equal(event.dataTransfer.dropEffect, 'none');
});

test('dropping a catalog bread starts a draft, leaving committed breads unchanged', () => {
  const before = {
    entries: [{ breadId: 'bagel', tags: ['chewy'] }],
    draft: { breadId: 'bagel', tags: ['dense'] },
  };
  const bread = drag.resolveBreadDrop('salt', 'salt', catalog);
  assert.ok(bread, 'A local catalog bread must be accepted');
  const after = selectBreadDraft(before, bread.id, catalog);
  assert.deepEqual(after, {
    entries: [{ breadId: 'bagel', tags: ['chewy'] }],
    draft: { breadId: 'salt', tags: [] },
  });
});

test('external, mismatched and unknown drag payloads cannot select a bread', () => {
  for (const [payload, source] of [
    ['salt', null], ['salt', 'bagel'], ['unknown', 'unknown'],
    ['', 'salt'], [null, 'salt'], ['{"breadId":"salt"}', 'salt'],
  ]) {
    assert.equal(drag.resolveBreadDrop(payload, source, catalog), null);
  }
});
