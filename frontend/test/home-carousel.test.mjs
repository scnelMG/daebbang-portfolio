import assert from 'node:assert/strict';
import test from 'node:test';
import * as model from '../src/design-model.mjs';

test('manual campaign navigation wraps both ends without losing a card', () => {
  assert.equal(typeof model.wrapCampaignIndex, 'function');
  assert.equal(model.wrapCampaignIndex(1, 3), 1);
  assert.equal(model.wrapCampaignIndex(3, 3), 0);
  assert.equal(model.wrapCampaignIndex(-1, 3), 2);
  assert.equal(model.wrapCampaignIndex(6, 3), 0);
});

test('stack keeps the selected store in front and its neighbors on opposite sides', () => {
  assert.equal(typeof model.campaignPosition, 'function');
  assert.deepEqual([0, 1, 2].map((index) => model.campaignPosition(index, 0, 3)), ['center', 'right', 'left']);
  assert.deepEqual([0, 1, 2].map((index) => model.campaignPosition(index, 1, 3)), ['left', 'center', 'right']);
  assert.deepEqual([0, 1, 2].map((index) => model.campaignPosition(index, 2, 3)), ['right', 'left', 'center']);
});

test('active campaign card drives the headline "<bread>에 진심인 당신에게"', () => {
  assert.equal(model.campaignHeadline({ bread: '소금빵' }).text, '소금빵에 진심인 당신에게');
  assert.equal(model.campaignHeadline({ bread: '바게트' }).text, '바게트에 진심인 당신에게');
  assert.deepEqual(model.campaignHeadline({ bread: ' 크루아상 ' }), { bread: '크루아상', subject: '크루아상', suffix: '에 진심인 당신에게', text: '크루아상에 진심인 당신에게' });
  // a card without a bread keeps the original copy instead of rendering an empty subject
  assert.equal(model.campaignHeadline({}).text, '소금빵에 진심인 당신에게');
  assert.equal(model.campaignHeadline({ bread: '  ' }).text, '소금빵에 진심인 당신에게');
});

test('card distance tells the stack how far back a card sits (five cards → two on each side)', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((index) => model.campaignDistance(index, 0, 5)), [0, 1, 2, 2, 1]);
  assert.deepEqual([0, 1, 2, 3, 4].map((index) => model.campaignPosition(index, 0, 5)), ['center', 'right', 'right', 'left', 'left']);
  assert.deepEqual([0, 1, 2].map((index) => model.campaignDistance(index, 1, 3)), [1, 0, 1]);
});
