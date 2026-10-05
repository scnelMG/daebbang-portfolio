import assert from 'node:assert/strict';
import test from 'node:test';
import * as layout from '../src/features/tray/tray-layout.mjs';

test('the lowest free slot is taken, and a full tray reports -1', () => {
  assert.equal(layout.freeTraySlot([]), 0);
  assert.equal(layout.freeTraySlot([{ slot: 0 }, { slot: 2 }]), 1);
  assert.equal(layout.freeTraySlot(Array.from({ length: 8 }, (_, slot) => ({ slot }))), -1);
});

test('entries without a slot are back-filled in order without moving placed ones', () => {
  const entries = [{ breadId: 1 }, { breadId: 2, slot: 0 }, { breadId: 3, slot: 0 }, { breadId: 4, slot: 99 }];
  assert.deepEqual(layout.assignTraySlots(entries).map(({ slot }) => slot), [1, 0, 2, 3]);
});

test('placement is deterministic for a seed and changes with it', () => {
  const items = [{ key: 'salt', slot: 0 }, { key: 'baguette', slot: 1 }, { key: 'croissant', slot: 2 }];
  const a = layout.placeTray(items, 'seed-a');
  assert.deepEqual(layout.placeTray(items, 'seed-a'), a);
  assert.notDeepEqual(layout.placeTray(items, 'seed-b'), a);
  for (const placed of a) {
    for (const field of ['x', 'y', 'width', 'height', 'angle']) assert.equal(typeof placed[field], 'number');
    assert.equal(typeof placed.flip, 'boolean');
  }
});

test('breads are returned back to front and stay inside the tray rim', () => {
  const items = Array.from({ length: 8 }, (_, slot) => ({ key: Object.keys(layout.breadVisuals)[slot], slot }));
  for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    const placed = layout.placeTray(items, seed);
    assert.equal(placed.length, 8);
    for (let i = 1; i < placed.length; i += 1) assert.ok(placed[i].z >= placed[i - 1].z);
    for (const { x, width } of placed) {
      // the cutout's opaque part spans roughly 20–90% of its frame
      assert.ok(x + width * 0.2 >= 40, `${seed}: left rim`);
      assert.ok(x + width * 0.9 <= 1520, `${seed}: right rim`);
    }
  }
});

test('unknown keys and invalid slots are skipped', () => {
  assert.deepEqual(layout.placeTray([{ key: 'cake', slot: 0 }, { key: 'salt', slot: 8 }, { key: 'salt' }], 's'), []);
});

test('the seed picks one of the fill orders', () => {
  const orders = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((seed) => layout.slotOrderFor(seed).join()));
  assert.ok(orders.size > 1);
  for (const order of orders) assert.ok(layout.slotOrders.some((known) => known.join() === order));
});
