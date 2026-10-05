import assert from 'node:assert/strict';
import test from 'node:test';
import * as model from '../src/features/tray/tray-model.mjs';

const catalog = [
  { id: 'salt', allowedTags: ['original', 'crispy', 'butter'] },
  { id: 'bagel', allowedTags: ['original', 'chewy', 'dense'] },
];

test('selecting a bread creates a draft without adding it to the tray', () => {
  const selected = model.selectBreadDraft(model.createTrayState([], 'seed-1'), 'salt', catalog);
  assert.deepEqual(selected, { entries: [], draft: { breadId: 'salt', tags: [] }, seed: 'seed-1' });
});

test('a fresh tray state gives saved entries slots in order and keeps existing ones', () => {
  const state = model.createTrayState([
    { breadId: 'salt', tags: ['butter'] },
    { breadId: 'bagel', tags: ['chewy'], slot: 0 },
  ], 'seed-1');
  assert.deepEqual(state.entries.map(({ breadId, slot }) => ({ breadId, slot })), [
    { breadId: 'salt', slot: 1 },
    { breadId: 'bagel', slot: 0 },
  ]);
  assert.equal(typeof model.createTrayState().seed, 'string');
});

test('selecting the same active bread preserves its unsaved tags', () => {
  const initial = { entries: [], draft: { breadId: 'salt', tags: ['butter'] } };
  assert.equal(model.selectBreadDraft(initial, 'salt', catalog), initial);
});

test('commit rejects tags for another bread and more than two tags', () => {
  for (const tags of [['dense'], ['original', 'crispy', 'butter']]) {
    const invalid = { entries: [], draft: { breadId: 'salt', tags } };
    assert.equal(model.commitBreadDraft(invalid, catalog), invalid);
  }
});

test('switching breads discards an uncommitted draft and preserves the tray', () => {
  const initial = {
    entries: [{ breadId: 'bagel', tags: ['chewy'] }],
    draft: { breadId: 'salt', tags: ['butter'] },
  };
  assert.deepEqual(model.selectBreadDraft(initial, 'bagel', catalog), {
    entries: [{ breadId: 'bagel', tags: ['chewy'] }],
    draft: { breadId: 'bagel', tags: ['chewy'] },
  });
});

test('a draft accepts at most two tags and still allows deselection', () => {
  const initial = { entries: [], draft: { breadId: 'salt', tags: ['original', 'crispy'] } };
  assert.deepEqual(model.toggleDraftTag(initial, 'butter', catalog), initial);
  assert.deepEqual(model.toggleDraftTag(initial, 'original', catalog).draft.tags, ['crispy']);
});

test('tags not assigned to the active bread are ignored', () => {
  const initial = { entries: [], draft: { breadId: 'salt', tags: [] } };
  assert.deepEqual(model.toggleDraftTag(initial, 'dense', catalog), initial);
});

test('bread is added only when a tagged draft is committed', () => {
  const emptyDraft = { entries: [], draft: { breadId: 'salt', tags: [] } };
  assert.deepEqual(model.commitBreadDraft(emptyDraft, catalog), emptyDraft);

  const ready = { entries: [], draft: { breadId: 'salt', tags: ['butter'] }, seed: 'old' };
  assert.deepEqual(model.commitBreadDraft(ready, catalog, { seed: 'new' }), {
    entries: [{ breadId: 'salt', tags: ['butter'], slot: 0 }],
    draft: null,
    seed: 'new',
  });
});

test('the first bread on an empty tray draws a new seed; later breads keep it and take the lowest free slot', () => {
  const first = model.commitBreadDraft({ entries: [], draft: { breadId: 'salt', tags: ['butter'] }, seed: 'old' }, catalog);
  assert.notEqual(first.seed, 'old');
  const second = model.commitBreadDraft({ ...first, entries: [{ breadId: 'salt', tags: ['butter'], slot: 3 }], draft: { breadId: 'bagel', tags: ['chewy'] } }, catalog);
  assert.equal(second.seed, first.seed);
  assert.deepEqual(second.entries.map(({ breadId, slot }) => ({ breadId, slot })), [{ breadId: 'salt', slot: 3 }, { breadId: 'bagel', slot: 0 }]);
});

test('committing an existing bread updates it without creating a duplicate', () => {
  const state = {
    entries: [{ breadId: 'salt', tags: ['original'] }],
    draft: { breadId: 'salt', tags: ['crispy', 'butter'] },
  };
  assert.deepEqual(model.commitBreadDraft(state, catalog).entries, [
    { breadId: 'salt', tags: ['crispy', 'butter'] },
  ]);
  const placed = { entries: [{ breadId: 'salt', tags: ['original'], slot: 5 }], draft: { breadId: 'salt', tags: ['crispy'] }, seed: 's' };
  assert.deepEqual(model.commitBreadDraft(placed, catalog), { entries: [{ breadId: 'salt', tags: ['crispy'], slot: 5 }], draft: null, seed: 's' });
});

test('removing a bread clears both its tray entry and active draft', () => {
  const state = {
    entries: [
      { breadId: 'salt', tags: ['butter'] },
      { breadId: 'bagel', tags: ['chewy'] },
    ],
    draft: { breadId: 'salt', tags: ['butter'] },
  };
  assert.deepEqual(model.removeTrayBread(state, 'salt'), {
    entries: [{ breadId: 'bagel', tags: ['chewy'] }],
    draft: null,
  });
});

test('removing leaves the slot empty and undo puts the bread back in it at its old position', () => {
  const state = {
    entries: [{ breadId: 'salt', tags: ['butter'], slot: 0 }, { breadId: 'bagel', tags: ['chewy'], slot: 1 }],
    draft: null,
    seed: 's',
  };
  const removed = model.removeTrayBread(state, 'salt');
  assert.deepEqual(removed.entries, [{ breadId: 'bagel', tags: ['chewy'], slot: 1 }]);
  assert.deepEqual(model.restoreTrayBread(removed, state.entries[0], 0), state);
  // the slot was taken meanwhile → lowest free slot instead
  const taken = { ...removed, entries: [...removed.entries, { breadId: 'loaf', tags: ['x'], slot: 0 }] };
  assert.equal(model.restoreTrayBread(taken, state.entries[0], 0).entries[0].slot, 2);
  // never duplicates a bread that is already back
  assert.equal(model.restoreTrayBread(state, state.entries[0], 0), state);
});

test('clearing the draft keeps the tray', () => {
  const state = { entries: [{ breadId: 'bagel', tags: ['chewy'], slot: 0 }], draft: { breadId: 'salt', tags: [] }, seed: 's' };
  assert.deepEqual(model.clearBreadDraft(state), { ...state, draft: null });
  const cleared = { ...state, draft: null };
  assert.equal(model.clearBreadDraft(cleared), cleared);
});

test('recommendation request is a detached snapshot of committed breads only', () => {
  const state = {
    entries: [{ breadId: 'bagel', tags: ['chewy'] }],
    draft: { breadId: 'salt', tags: ['butter'] },
  };
  const request = model.createTrayRequest(state);
  assert.deepEqual(request, { breads: [{ breadId: 'bagel', tags: ['chewy'] }] });
  state.entries[0].tags.push('dense');
  assert.deepEqual(request.breads[0].tags, ['chewy']);
});
