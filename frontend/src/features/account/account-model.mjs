import { createReviewDto, mapRecommendationHistory, AdapterValidationError } from '../../lib/api/adapters.mjs';

export const historyPeriods = [
  { value: 'all', label: '전체 기간' },
  { value: 'month', label: '이번 달' },
  { value: 'three-months', label: '최근 3개월' },
];

export function mapReviews(items) {
  return items.map(({ reviewId, bakeryId, bakeryName, bakeryImageUrl, visitDate, rating, breads, customBreadNames, createdAt }) => ({
    id: reviewId, bakeryId, bakeryName, date: visitDate, rating, createdAt,
    bakeryImageUrl: typeof bakeryImageUrl === 'string' ? bakeryImageUrl.trim() || null : null,
    breads: breads.map(({ breadId, breadName, tagNames }) => ({ breadId, breadName, tagNames: [...tagNames] })),
    customBreadNames: [...customBreadNames],
  }));
}

export function mapHistoryRecords(items) {
  return mapRecommendationHistory(items).map((record) => ({ ...record, id: record.recommendationId, date: record.createdAt.slice(0, 10) }));
}

export function resolveReviewTarget(route, history = []) {
  const valid = (id) => Number.isSafeInteger(id) && id > 0;
  if (route.recommendationResultId != null) {
    if (!valid(route.recommendationResultId)) return null;
    const record = history.find((item) => (!route.recommendationId || item.recommendationId === route.recommendationId)
      && item.results.some((result) => result.recommendationResultId === route.recommendationResultId));
    const result = record?.results.find((item) => item.recommendationResultId === route.recommendationResultId);
    if (!result || (route.bakeryId != null && route.bakeryId !== result.bakeryId)) return null;
    return { bakeryId: result.bakeryId, recommendationResultId: result.recommendationResultId };
  }
  return valid(route.bakeryId) ? { bakeryId: route.bakeryId, recommendationResultId: null } : null;
}

export function rankingSummary({ myRank }) {
  return { rank: myRank?.rank ?? null, reviewCount: myRank?.reviewCount ?? null, visitedBakeryCount: myRank?.visitedBakeryCount ?? null };
}

export function createReviewSubmission({ createReview, account }) {
  let pending = false;
  return { async submit(draft, catalog) {
    if (pending) return null;
    const dto = createReviewDto(draft, catalog);
    const owner = account();
    pending = true;
    try {
      const response = await createReview(dto);
      if (account() !== owner) return null;
      if (!Number.isSafeInteger(response?.reviewId) || response.reviewId <= 0) {
        throw new AdapterValidationError('INVALID_REVIEW_RESPONSE', '저장 결과를 확인하지 못했어요. 내가 쓴 리뷰에서 확인해주세요.');
      }
      return response.reviewId;
    } finally { pending = false; }
  } };
}

function firstDayMonthsBefore(today, monthsBefore) {
  const [year, month] = today.split('-').map(Number);
  const monthIndex = year * 12 + month - 1 - monthsBefore;
  const startYear = Math.floor(monthIndex / 12);
  const startMonth = monthIndex - startYear * 12 + 1;
  return `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
}

export function filterHistory(records, period, today) {
  const start = period === 'month'
    ? firstDayMonthsBefore(today, 0)
    : period === 'three-months'
      ? firstDayMonthsBefore(today, 2)
      : null;

  return records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record.date <= today && (!start || record.date >= start))
    .sort((left, right) => right.record.date.localeCompare(left.record.date) || left.index - right.index)
    .map(({ record }) => record);
}
