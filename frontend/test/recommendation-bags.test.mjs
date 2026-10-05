import test from 'node:test';
import assert from 'node:assert/strict';
import { createBagState, transitionBags } from '../src/features/service/bag-state.mjs';

test('each recommendation opens once and remains open when revisited without wrapping', () => {
  let state = createBagState(2);
  state = transitionBags(state, { type: 'open' });
  assert.deepEqual(state, { activeIndex: 0, stages: ['shaking', 'closed'], freshIndex: null });
  assert.equal(transitionBags(state, { type: 'open' }), state);
  assert.equal(transitionBags(state, { type: 'select', index: 1 }), state);
  state = transitionBags(state, { type: 'advance', index: 0 });
  assert.deepEqual(state.stages, ['revealing', 'closed']);
  state = transitionBags(state, { type: 'advance', index: 0 });
  state = transitionBags(state, { type: 'select', index: 1 });
  assert.deepEqual(state, { activeIndex: 1, stages: ['open', 'closed'], freshIndex: null });
  state = transitionBags(state, { type: 'open', immediate: true });
  assert.deepEqual(state.stages, ['open', 'open']);
  assert.equal(transitionBags(state, { type: 'select', index: 2 }), state);
  state = transitionBags(state, { type: 'select', index: 0 });
  assert.equal(state.stages[0], 'open');
  assert.equal(transitionBags(state, { type: 'open' }), state);
  assert.equal(transitionBags(state, { type: 'select', index: -1 }), state);
});

test('moving between bags is instant, even away from an open bag', () => {
  let state = createBagState(3);
  state = transitionBags(state, { type: 'open', immediate: true });
  state = transitionBags(state, { type: 'select', index: 2 });
  assert.deepEqual(state, { activeIndex: 2, stages: ['open', 'closed', 'closed'], freshIndex: null });
  // a bag that is still opening can't be left mid-animation
  state = transitionBags(state, { type: 'open' });
  assert.equal(transitionBags(state, { type: 'select', index: 0 }), state);
});

test('empty, single-result and stale animation events cannot select or reveal another bag', () => {
  const empty = createBagState(0);
  assert.equal(transitionBags(empty, { type: 'open' }), empty);
  let one = createBagState(1);
  assert.equal(transitionBags(one, { type: 'advance', index: 0 }), one);
  assert.equal(transitionBags(one, { type: 'select', index: 1 }), one);
  one = transitionBags(one, { type: 'open' });
  assert.equal(transitionBags(one, { type: 'advance', index: 1 }), one);
  one = transitionBags(one, { type: 'finish' });
  assert.deepEqual(one.stages, ['open']);
});

test('only the first reveal of a bag animates; skipping or coming back shows it at rest', () => {
  let state = createBagState(2);
  state = transitionBags(state, { type: 'open' });
  state = transitionBags(state, { type: 'advance', index: 0 });
  state = transitionBags(state, { type: 'advance', index: 0 });
  assert.deepEqual(state, { activeIndex: 0, stages: ['open', 'closed'], freshIndex: 0 });
  // moving on and coming back does not replay it
  state = transitionBags(state, { type: 'select', index: 1 });
  assert.equal(state.freshIndex, null);
  state = transitionBags(state, { type: 'select', index: 0 });
  assert.deepEqual(state, { activeIndex: 0, stages: ['open', 'closed'], freshIndex: null });
  // 'finish' (skip animation) opens at rest
  let skipped = transitionBags(createBagState(1), { type: 'open' });
  skipped = transitionBags(skipped, { type: 'finish' });
  assert.equal(skipped.freshIndex, null);
});
