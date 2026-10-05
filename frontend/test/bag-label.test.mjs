import assert from 'node:assert/strict';
import test from 'node:test';
import { bagLabelFeatures, bagLabelFor, BAG_LABEL_SLOTS } from '../src/features/service/bag-label.mjs';

test('label features come from review tags first, then covered breads, three at most, no duplicates', () => {
  const item = {
    reasons: [{ breadName: '소금빵', tagName: '겉바속촉' }, { breadName: '휘낭시에', tagName: '근본' }, { breadName: '식빵', tagName: '겉바속촉' }],
    coveredBreadNames: ['소금빵', '휘낭시에', '식빵'],
    pickType: 'score',
  };
  assert.deepEqual(bagLabelFeatures(item), ['겉바속촉', '오리지널', '소금빵']);
  assert.equal(BAG_LABEL_SLOTS, 3);
});

test('a bakery with fewer than three reasons is topped up with the breads it covers', () => {
  assert.deepEqual(bagLabelFeatures({ reasons: [{ tagName: '촉촉' }], coveredBreadNames: ['소금빵'], pickType: 'score' }), ['촉촉', '소금빵']);
});

test('a random discovery slot without evidence says so; blanks and missing fields are tolerated', () => {
  assert.deepEqual(bagLabelFeatures({ reasons: [], coveredBreadNames: [], pickType: 'random' }), ['오늘의 발견']);
  assert.deepEqual(bagLabelFeatures({ reasons: [{ tagName: ' ' }], coveredBreadNames: [''], pickType: 'score' }), []);
  assert.deepEqual(bagLabelFeatures(null), []);
});

test('the printed label carries name, district and features', () => {
  assert.deepEqual(bagLabelFor({ bakeryName: ' 비오는날의빵 ', district: '동구', reasons: [], coveredBreadNames: ['치아바타', '소금빵', '식빵', '바게트'], pickType: 'score' }), {
    name: '비오는날의빵', district: '동구', features: ['치아바타', '소금빵', '식빵'],
  });
});
