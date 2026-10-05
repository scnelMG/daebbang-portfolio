import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../src/features/account/account-model.mjs';
import { createReviewDto } from '../src/lib/api/adapters.mjs';
import { errorMessage } from '../src/lib/api/error-message.mjs';

const catalog = [{ id: 42, tags: [{ id: 81 }, { id: 82 }, { id: 83 }] }];
const draft = { bakeryId: 71, recommendationResultId: 91, visitDate: '2026-09-10', rating: 4, breads: [{ breadId: 42, tagIds: [] }], customBreadNames: ['  통밀빵  '] };

test('review request retains numeric target and permits zero tags, rejects invalid selections', () => {
  assert.deepEqual(createReviewDto(draft, catalog), { ...draft, customBreadNames: ['통밀빵'] });
  for (const [patch, code] of [
    [{ breads: [{ breadId: 42, tagIds: [81, 82, 83] }] }, 'TAG_LIMIT_EXCEEDED'],
    [{ customBreadNames: ['a', 'b', 'c', 'd', 'e', 'f'] }, 'CUSTOM_BREAD_LIMIT_EXCEEDED'],
    [{ breads: [{ breadId: 42, tagIds: [900] }] }, 'INVALID_TAG_FOR_BREAD'],
    [{ visitDate: '2026-09-12' }, 'FUTURE_VISIT_DATE'],
  ]) assert.throws(() => createReviewDto({ ...draft, ...patch }, catalog, { today: '2026-09-11' }), { code });
});

test('private review receipts retain the server bakery photo, names, visit dates and selected tags', () => {
  assert.equal(typeof model.mapReviews, 'function');
  const source = [{ reviewId: 11, bakeryId: 71, bakeryName: '서버 빵집', bakeryImageUrl: '/images/bakeries/71.webp', visitDate: '2026-09-10', rating: 4, breads: [{ breadId: 42, breadName: '서버 빵', tagNames: ['촉촉'] }], customBreadNames: ['통밀빵'], createdAt: '2026-09-11T12:00:00' }];
  const [receipt] = model.mapReviews(source);
  assert.equal(receipt.id, 11);
  assert.equal(receipt.date, '2026-09-10');
  assert.equal(receipt.bakeryName, '서버 빵집');
  assert.deepEqual(receipt.breads, [{ breadId: 42, breadName: '서버 빵', tagNames: ['촉촉'] }]);
  assert.deepEqual(receipt.customBreadNames, ['통밀빵']);
  assert.equal(receipt.bakeryImageUrl, '/images/bakeries/71.webp');
});

test('private reviews tolerate absent photos and a missing bakery without losing the receipt', () => {
  for (const bakeryImageUrl of [null, undefined, '', '   ']) {
    const [receipt] = model.mapReviews([{ reviewId: 11, bakeryId: 71, bakeryName: null, bakeryImageUrl,
      visitDate: '2026-09-10', rating: 4, breads: [], customBreadNames: ['통밀빵'], createdAt: '2026-09-11T12:00:00' }]);
    assert.equal(receipt.bakeryImageUrl, null);
    assert.equal(receipt.bakeryName, null);
    assert.equal(receipt.id, 11);
    assert.deepEqual(receipt.customBreadNames, ['통밀빵']);
  }
});

const history = [{ recommendationId: 17, createdAt: '2026-09-11T10:31:20', tray: [{ bread: '서버 빵', tags: ['촉촉'] }], results: [{ recommendationResultId: 91, rank: 1, bakeryId: 71, bakeryName: '서버 빵집', district: '중구', imageUrl: '/images/bakeries/71.webp', mapUrl: 'https://place.map.kakao.com/123' }] }];
test('history keeps timestamp, names and server result target without reconstructed scores', () => {
  assert.equal(typeof model.mapHistoryRecords, 'function');
  const [record] = model.mapHistoryRecords(history);
  assert.equal(record.date, '2026-09-11');
  assert.equal(record.createdAt, '2026-09-11T10:31:20');
  assert.deepEqual(record.tray, [{ bread: '서버 빵', tags: ['촉촉'] }]);
  assert.deepEqual(record.results, history[0].results);
  assert.equal(record.results[0].score, undefined);
});

test('recommendation review resolves only matching owned result and bakery IDs', () => {
  assert.equal(typeof model.resolveReviewTarget, 'function');
  assert.deepEqual(model.resolveReviewTarget({ bakeryId: 71, recommendationResultId: 91, recommendationId: 17 }, history), { bakeryId: 71, recommendationResultId: 91 });
  assert.equal(model.resolveReviewTarget({ bakeryId: 72, recommendationResultId: 91 }, history), null);
  assert.equal(model.resolveReviewTarget({ bakeryId: 71, recommendationResultId: 99 }, history), null);
  assert.equal(model.resolveReviewTarget({}, history), null);
  assert.deepEqual(model.resolveReviewTarget({ bakeryId: 71 }, []), { bakeryId: 71, recommendationResultId: null });
});

test('ranking summary preserves server numbers and distinguishes missing myRank from zero', () => {
  assert.equal(typeof model.rankingSummary, 'function');
  assert.deepEqual(model.rankingSummary({ myRank: null }), { rank: null, reviewCount: null, visitedBakeryCount: null });
  assert.deepEqual(model.rankingSummary({ myRank: { rank: 103, reviewCount: 8, visitedBakeryCount: 3 } }), { rank: 103, reviewCount: 8, visitedBakeryCount: 3 });
});

test('review submission awaits server ID, serializes pending request, preserves failed draft and rejects stale success', async () => {
  assert.equal(typeof model.createReviewSubmission, 'function');
  let owner = 1;
  let finish;
  let calls = 0;
  const submission = model.createReviewSubmission({ createReview: (dto) => { calls++; assert.deepEqual(dto.breads, [{ breadId: 42, tagIds: [] }]); return new Promise((resolve) => { finish = resolve; }); }, account: () => owner });
  const pending = submission.submit(draft, catalog);
  assert.equal(await submission.submit(draft, catalog), null);
  assert.equal(calls, 1);
  finish({ reviewId: 600 });
  assert.equal(await pending, 600);
  const stale = submission.submit(draft, catalog);
  owner = 2;
  finish({ reviewId: 601 });
  assert.equal(await stale, null);
  const invalid = submission.submit(draft, catalog);
  finish({});
  await assert.rejects(invalid, { code: 'INVALID_REVIEW_RESPONSE' });
  assert.equal(draft.customBreadNames[0], '  통밀빵  ');
});

test('invalid review target IDs fail locally even when another target is present', () => {
  for (const patch of [{ bakeryId: 0, recommendationResultId: null }, { bakeryId: -1 }, { recommendationResultId: -2 }]) {
    assert.throws(() => createReviewDto({ ...draft, ...patch }, catalog), { code: 'REVIEW_TARGET_REQUIRED' });
  }
});

test('failed review POST preserves the draft and allows an explicit retry without automatic replay', async () => {
  let calls = 0;
  const failure = new Error('서버 검증 실패');
  const submission = model.createReviewSubmission({ account: () => 1, createReview: async () => { calls++; if (calls === 1) throw failure; return { reviewId: 602 }; } });
  await assert.rejects(submission.submit(draft, catalog), failure);
  assert.equal(calls, 1);
  assert.equal(draft.rating, 4);
  assert.equal(await submission.submit(draft, catalog), 602);
});

test('server review errors retain server messages even for a locally translated validation code', () => {
  assert.equal(errorMessage({ kind: 'api', code: 'INVALID_TAG_FOR_BREAD', message: '선택한 태그는 현재 비활성 상태입니다.' }), '선택한 태그는 현재 비활성 상태입니다.');
});
