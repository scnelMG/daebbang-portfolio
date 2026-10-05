import { displayTagLabel } from '../tag-labels.mjs';

export class AdapterValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdapterValidationError';
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new AdapterValidationError(code, message);
};

function catalogIndex(catalog) {
  return new Map(catalog.map((bread) => [bread.id, {
    bread,
    tagIds: new Set((bread.tags ?? []).map((tag) => tag.id)),
  }]));
}

function validateBreadSelections(breads, catalog, {
  requireTag,
  duplicateCode,
  maximumBreads = Infinity,
}) {
  if (!Array.isArray(breads)) fail('INVALID_BREAD_SELECTION', 'Bread selections must be an array.');
  if (breads.length > maximumBreads) fail('TRAY_LIMIT_EXCEEDED', 'Too many breads were selected.');

  const known = catalogIndex(catalog);
  const seen = new Set();
  return breads.map((selection) => {
    if (!Number.isInteger(selection?.breadId) || !known.has(selection.breadId)) {
      fail('UNKNOWN_BREAD', 'The selected bread is not in the current catalog.');
    }
    if (seen.has(selection.breadId)) fail(duplicateCode, 'A bread can be selected only once.');
    seen.add(selection.breadId);

    if (!Array.isArray(selection.tagIds)) {
      fail(requireTag ? 'TAG_REQUIRED_FOR_BREAD' : 'INVALID_TAG_FOR_BREAD', 'Tag IDs must be an array.');
    }
    if (requireTag && selection.tagIds.length === 0) {
      fail('TAG_REQUIRED_FOR_BREAD', 'Each tray bread requires at least one tag.');
    }
    if (selection.tagIds.length > 2 || new Set(selection.tagIds).size !== selection.tagIds.length) {
      fail('TAG_LIMIT_EXCEEDED', 'Each bread accepts at most two distinct tags.');
    }
    const allowed = known.get(selection.breadId).tagIds;
    if (selection.tagIds.some((tagId) => !Number.isInteger(tagId) || !allowed.has(tagId))) {
      fail('INVALID_TAG_FOR_BREAD', 'A selected tag does not belong to this bread.');
    }
    return { breadId: selection.breadId, tagIds: [...selection.tagIds] };
  });
}

export function mapBreadCatalog(catalog, visualCatalog) {
  if (!Array.isArray(catalog) || !Array.isArray(visualCatalog)) {
    fail('INVALID_CATALOG', 'Both server and visual catalogs must be arrays.');
  }
  const visualsByName = new Map(visualCatalog.map((visual) => [visual.label, visual]));

  return catalog.map((bread) => {
    const visual = visualsByName.get(bread.name);
    const tags = (bread.tags ?? []).map((tag) => ({
      id: tag.id,
      tagId: tag.id,
      name: tag.name,
      label: displayTagLabel(tag.name),
      isTypeTag: tag.isTypeTag,
    }));
    return {
      id: bread.id,
      breadId: bread.id,
      name: bread.name,
      label: bread.name,
      imageUrl: typeof bread.imageUrl === 'string' && bread.imageUrl ? bread.imageUrl : null,
      visualKey: visual?.id ?? null,
      layer: visual?.layer ?? null,
      tags,
      allowedTags: tags.map(({ id }) => id),
    };
  });
}

export function validateTray(tray, catalog) {
  if (!Array.isArray(tray) || tray.length === 0) fail('EMPTY_TRAY', 'Add at least one bread to the tray.');
  return validateBreadSelections(tray, catalog, {
    requireTag: true,
    duplicateCode: 'DUPLICATE_BREAD_IN_TRAY',
    maximumBreads: 8,
  });
}

function localToday() {
  const date = new Date();
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, '0'))
    .join('-');
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function createReviewDto(input, catalog, { today = localToday() } = {}) {
  const targets = [input?.bakeryId, input?.recommendationResultId].filter((id) => id != null);
  if (!targets.length || targets.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    fail('REVIEW_TARGET_REQUIRED', 'A bakery or recommendation result is required.');
  }
  if (!validIsoDate(input.visitDate)) fail('INVALID_VISIT_DATE', 'Visit date must be an ISO calendar date.');
  if (input.visitDate > today) fail('FUTURE_VISIT_DATE', 'Visit date cannot be in the future.');
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    fail('INVALID_RATING', 'Rating must be an integer from 1 to 5.');
  }

  const breads = validateBreadSelections(input.breads ?? [], catalog, {
    requireTag: false,
    duplicateCode: 'DUPLICATE_BREAD_IN_REVIEW',
  });
  const customBreadNames = (input.customBreadNames ?? [])
    .filter((name) => typeof name === 'string' && name.trim())
    .map((name) => name.trim());
  if (customBreadNames.length > 5) {
    fail('CUSTOM_BREAD_LIMIT_EXCEEDED', 'At most five custom bread names are allowed.');
  }
  if (breads.length === 0 && customBreadNames.length === 0) {
    fail('EMPTY_REVIEW', 'Choose a catalog bread or enter a custom bread name.');
  }

  return {
    bakeryId: input.bakeryId ?? null,
    recommendationResultId: input.recommendationResultId ?? null,
    visitDate: input.visitDate,
    rating: input.rating,
    breads,
    customBreadNames,
  };
}

export function safeMapUrl(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isKakaoPlace = hostname === 'place.map.kakao.com';
    const isNaver = hostname === 'map.naver.com' || hostname === 'naver.me';
    if ((!isKakaoPlace && !isNaver) || url.username || url.password || url.port) return null;
    // Kakao's supplied HTTP place links redirect to the same HTTPS location.
    if (isKakaoPlace && url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Home "오늘의 빵집" cards (GET /bakeries/home) → carousel campaigns.
 * Cards without a representative bread cannot produce the headline, so they are dropped rather than guessed.
 */
export function mapHomeCampaigns(cards) {
  if (!Array.isArray(cards)) fail('INVALID_HOME_CARDS', 'Home cards must be an array.');
  return cards.flatMap((card) => {
    if (!Number.isInteger(card?.id) || card.id <= 0) return [];
    const store = typeof card.name === 'string' ? card.name.trim() : '';
    const bread = typeof card.representativeBread === 'string' ? card.representativeBread.trim() : '';
    if (!store || !bread) return [];
    const district = typeof card.district === 'string' ? card.district.trim() : '';
    return [{
      id: `bakery-${card.id}`,
      bakeryId: card.id,
      bread,
      store,
      area: district ? `대전 ${district}` : '대전',
      image: typeof card.imageUrl === 'string' && card.imageUrl ? card.imageUrl : null,
      alt: `${store} 매장 대표 사진`,
      mapUrl: safeMapUrl(card.mapUrl),
    }];
  });
}

/**
 * Bakery profile for the result card: which of the eight breads have data here and
 * which features people tagged most. Only aggregates arrive (no individual reviews).
 * Bread entries without a positive id or a name, and tags without a count, are dropped.
 */
export function mapBakeryProfile(profile) {
  if (!Number.isInteger(profile?.id) || profile.id <= 0) fail('INVALID_BAKERY_PROFILE', 'Bakery profile needs a positive id.');
  if (!Array.isArray(profile.breads) || !Array.isArray(profile.otherBreads) || !Array.isArray(profile.topTags)) {
    fail('INVALID_BAKERY_PROFILE', 'Bakery profile lists must be arrays.');
  }
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const count = (value) => (Number.isInteger(value) && value > 0 ? value : 0);
  return {
    id: profile.id,
    name: text(profile.name),
    district: text(profile.district),
    imageUrl: text(profile.imageUrl) || null,
    mapUrl: safeMapUrl(profile.mapUrl),
    isOpen: profile.isOpen !== false,
    topTags: profile.topTags.map((tag) => displayTagLabel(text(tag))).filter(Boolean),
    breads: profile.breads.flatMap((bread) => {
      const name = text(bread?.name);
      if (!Number.isInteger(bread?.breadId) || bread.breadId <= 0 || !name) return [];
      return [{
        breadId: bread.breadId,
        name,
        representative: bread.representative === true,
        reviewCount: count(bread.reviewCount),
        tags: (Array.isArray(bread.tags) ? bread.tags : []).flatMap((tag) => {
          const label = displayTagLabel(text(tag?.name));
          return label && count(tag?.count) ? [{ tagId: tag.tagId ?? null, name: label, count: tag.count }] : [];
        }),
      }];
    }),
    otherBreads: profile.otherBreads.flatMap((item) => {
      const name = text(item?.name);
      return name && count(item?.count) ? [{ name, count: item.count }] : [];
    }),
  };
}

export function mapLinkLabel(value) {
  const url = safeMapUrl(value);
  if (!url) return null;
  return new URL(url).hostname === 'place.map.kakao.com' ? '카카오맵' : '네이버 지도';
}

function recommendationResult(result) {
  return {
    recommendationResultId: result.recommendationResultId,
    rank: result.rank,
    bakeryId: result.bakeryId,
    bakeryName: result.bakeryName,
    district: result.district,
    imageUrl: typeof result.imageUrl === 'string' && result.imageUrl ? result.imageUrl : null,
    mapUrl: safeMapUrl(result.mapUrl),
    saved: result.saved,
    score: result.score,
    coveredBreadNames: [...result.coveredBreadNames],
    reasons: result.reasons.map(({ breadName, tagName }) => ({ breadName, tagName })),
    pickType: result.pickType === 'random' ? 'random' : 'score',
  };
}

export function mapRecommendation(response) {
  if (!Array.isArray(response?.results)) {
    fail('INVALID_RECOMMENDATION', 'Recommendation results must be an array.');
  }
  if (response.results.length > 3) {
    fail('TOO_MANY_RECOMMENDATIONS', 'The API returned more than three recommendation results.');
  }
  return {
    recommendationId: response.recommendationId,
    totalBreads: response.totalBreads,
    results: response.results.map(recommendationResult),
  };
}

export function mapRecommendationHistory(history) {
  if (!Array.isArray(history)) fail('INVALID_HISTORY', 'Recommendation history must be an array.');
  return history.map((item) => ({
    recommendationId: item.recommendationId,
    createdAt: item.createdAt,
    tray: item.tray.map(({ bread, tags }) => ({ bread, tags: [...tags] })),
    results: item.results.map(({ recommendationResultId, rank, bakeryId, bakeryName, district, imageUrl, mapUrl }) => ({
      recommendationResultId,
      rank,
      bakeryId,
      bakeryName,
      district: district ?? null,
      imageUrl: typeof imageUrl === 'string' ? imageUrl.trim() || null : null,
      mapUrl: safeMapUrl(mapUrl),
    })),
  }));
}
