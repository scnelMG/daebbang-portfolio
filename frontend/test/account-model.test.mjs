import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterHistory,
  historyPeriods,
} from '../src/features/account/account-model.mjs';

test('history periods expose the supported filters in display order', () => {
  assert.deepEqual(historyPeriods, [
    { value: 'all', label: '전체 기간' },
    { value: 'month', label: '이번 달' },
    { value: 'three-months', label: '최근 3개월' },
  ]);
});

test('all history excludes future days and sorts newest first with stable ties', () => {
  const records = [
    { id: 'older', date: '2026-08-31' },
    { id: 'tie-first', date: '2026-09-10' },
    { id: 'future', date: '2026-09-11' },
    { id: 'tie-second', date: '2026-09-10' },
    { id: 'oldest', date: '2025-12-31' },
  ];

  assert.deepEqual(
    filterHistory(records, 'all', '2026-09-10').map(({ id }) => id),
    ['tie-first', 'tie-second', 'older', 'oldest'],
  );
  assert.deepEqual(records.map(({ id }) => id), ['older', 'tie-first', 'future', 'tie-second', 'oldest']);
});

test('month history starts on the first calendar day across a December year boundary', () => {
  const records = [
    { id: 'previous-month', date: '2025-11-30' },
    { id: 'month-start', date: '2025-12-01' },
    { id: 'today', date: '2025-12-15' },
    { id: 'future', date: '2025-12-16' },
  ];

  assert.deepEqual(
    filterHistory(records, 'month', '2025-12-15').map(({ id }) => id),
    ['today', 'month-start'],
  );
});

test('three-month history starts on day one two months earlier across December and February boundaries', () => {
  const decemberRecords = [
    { id: 'before-october', date: '2025-09-30' },
    { id: 'october-start', date: '2025-10-01' },
    { id: 'december-today', date: '2025-12-15' },
  ];
  const februaryRecords = [
    { id: 'before-december', date: '2025-11-30' },
    { id: 'december-start', date: '2025-12-01' },
    { id: 'february-today', date: '2026-02-28' },
    { id: 'march-future', date: '2026-03-01' },
  ];

  assert.deepEqual(
    filterHistory(decemberRecords, 'three-months', '2025-12-15').map(({ id }) => id),
    ['december-today', 'october-start'],
  );
  assert.deepEqual(
    filterHistory(februaryRecords, 'three-months', '2026-02-28').map(({ id }) => id),
    ['february-today', 'december-start'],
  );
});
