import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AdapterValidationError,
  createReviewDto,
  mapBreadCatalog,
  mapBakeryProfile,
  mapHomeCampaigns,
  mapLinkLabel,
  mapRecommendation,
  mapRecommendationHistory,
  safeMapUrl,
  validateTray,
} from '../src/lib/api/adapters.mjs';

const serverCatalog = [
  {
    id: 101,
    name: '소금빵',
    imageUrl: null,
    tags: [
      { id: 1001, name: '오리지널', isTypeTag: true },
      { id: 1003, name: '겉바삭', isTypeTag: false },
      { id: 1005, name: '버터 풍미', isTypeTag: false },
    ],
  },
  {
    id: 108,
    name: '에그타르트',
    imageUrl: 'https://cdn.example/egg.jpg',
    tags: [{ id: 1081, name: '커스터드 풍미', isTypeTag: false }],
  },
  {
    id: 999,
    name: '새로운 빵',
    imageUrl: null,
    tags: [],
  },
];

test('catalog mapping keeps server IDs and joins visual assets by exact bread name only', () => {
  const visuals = [
    { id: 'salt', label: '소금빵', layer: 'salt-layer.png', tags: [{ id: 'stale-tag' }] },
    { id: 'egg', label: '에그타르트', layer: 'egg-layer.png' },
  ];

  const mapped = mapBreadCatalog(serverCatalog, visuals);

  assert.deepEqual(mapped, [
    {
      id: 101,
      breadId: 101,
      name: '소금빵',
      label: '소금빵',
      imageUrl: null,
      visualKey: 'salt',
      layer: 'salt-layer.png',
      tags: [
        { id: 1001, tagId: 1001, name: '오리지널', label: '오리지널', isTypeTag: true },
        { id: 1003, tagId: 1003, name: '겉바삭', label: '겉바삭', isTypeTag: false },
        { id: 1005, tagId: 1005, name: '버터 풍미', label: '버터 풍미', isTypeTag: false },
      ],
      allowedTags: [1001, 1003, 1005],
    },
    {
      id: 108,
      breadId: 108,
      name: '에그타르트',
      label: '에그타르트',
      imageUrl: 'https://cdn.example/egg.jpg',
      visualKey: 'egg',
      layer: 'egg-layer.png',
      tags: [
        { id: 1081, tagId: 1081, name: '커스터드 풍미', label: '커스터드 풍미', isTypeTag: false },
      ],
      allowedTags: [1081],
    },
    {
      id: 999,
      breadId: 999,
      name: '새로운 빵',
      label: '새로운 빵',
      imageUrl: null,
      visualKey: null,
      layer: null,
      tags: [],
      allowedTags: [],
    },
  ]);
});

test('tray validation accepts only current numeric catalog IDs and tags belonging to each bread', () => {
  assert.deepEqual(validateTray([
    { breadId: 101, tagIds: [1001, 1005] },
    { breadId: 108, tagIds: [1081] },
  ], serverCatalog), [
    { breadId: 101, tagIds: [1001, 1005] },
    { breadId: 108, tagIds: [1081] },
  ]);

  const invalidCases = [
    { code: 'EMPTY_TRAY', tray: [] },
    { code: 'UNKNOWN_BREAD', tray: [{ breadId: 1, tagIds: [1001] }] },
    { code: 'INVALID_TAG_FOR_BREAD', tray: [{ breadId: 101, tagIds: [1081] }] },
    { code: 'TAG_REQUIRED_FOR_BREAD', tray: [{ breadId: 101, tagIds: [] }] },
    { code: 'TAG_LIMIT_EXCEEDED', tray: [{ breadId: 101, tagIds: [1001, 1003, 1005] }] },
    {
      code: 'DUPLICATE_BREAD_IN_TRAY',
      tray: [{ breadId: 101, tagIds: [1001] }, { breadId: 101, tagIds: [1003] }],
    },
  ];

  for (const { code, tray } of invalidCases) {
    assert.throws(
      () => validateTray(tray, serverCatalog),
      (error) => error instanceof AdapterValidationError && error.code === code,
    );
  }
});

test('review DTO permits zero to two valid tags and excludes UI-only fields', () => {
  const dto = createReviewDto({
    bakeryId: 42,
    recommendationResultId: null,
    visitDate: '2026-09-10',
    rating: 5,
    breads: [
      { breadId: 101, tagIds: [], draftLabel: '소금빵' },
      { breadId: 108, tagIds: [1081] },
    ],
    customBreadNames: ['  단팥빵  ', ''],
    freeText: 'not in backend DTO',
  }, serverCatalog, { today: '2026-09-11' });

  assert.deepEqual(dto, {
    bakeryId: 42,
    recommendationResultId: null,
    visitDate: '2026-09-10',
    rating: 5,
    breads: [
      { breadId: 101, tagIds: [] },
      { breadId: 108, tagIds: [1081] },
    ],
    customBreadNames: ['단팥빵'],
  });
});

test('review DTO rejects three tags, six custom names, and future visits', () => {
  assert.throws(() => createReviewDto({
    bakeryId: 42,
    recommendationResultId: null,
    visitDate: '2026-09-11',
    rating: 5,
    breads: [{ breadId: 101, tagIds: [1001, 1003, 1005] }],
    customBreadNames: [],
  }, serverCatalog, { today: '2026-09-11' }), { code: 'TAG_LIMIT_EXCEEDED' });

  assert.throws(() => createReviewDto({
    bakeryId: 42,
    recommendationResultId: null,
    visitDate: '2026-09-11',
    rating: 5,
    breads: [],
    customBreadNames: ['1', '2', '3', '4', '5', '6'],
  }, serverCatalog, { today: '2026-09-11' }), { code: 'CUSTOM_BREAD_LIMIT_EXCEEDED' });

  assert.throws(() => createReviewDto({
    bakeryId: 42,
    recommendationResultId: null,
    visitDate: '2026-09-12',
    rating: 5,
    breads: [{ breadId: 101, tagIds: [] }],
    customBreadNames: [],
  }, serverCatalog, { today: '2026-09-11' }), { code: 'FUTURE_VISIT_DATE' });
});

test('safe map links allow supplied HTTPS Naver URLs and reject other schemes or hosts', () => {
  assert.equal(safeMapUrl('https://map.naver.com/p/entry/place/123'), 'https://map.naver.com/p/entry/place/123');
  assert.equal(safeMapUrl('https://naver.me/abc123'), 'https://naver.me/abc123');
  assert.equal(safeMapUrl('javascript:alert(1)'), null);
  assert.equal(safeMapUrl('https://example.com/maps/123'), null);
  assert.equal(safeMapUrl(''), null);
});

test('backend Kakao place links use HTTPS without changing the place identifier', () => {
  assert.equal(safeMapUrl('http://place.map.kakao.com/1307174813'), 'https://place.map.kakao.com/1307174813');
  assert.equal(safeMapUrl('https://place.map.kakao.com/1307174813'), 'https://place.map.kakao.com/1307174813');
});

test('map links reject lookalike hosts, credentials, ports and unsupported schemes', () => {
  for (const url of [
    'https://place.map.kakao.com.example.com/123',
    'https://place.map.kakao.com@evil.example/123',
    'https://user:password@map.naver.com/p/123',
    'https://map.naver.com:444/p/123',
    'https://place.map.kakao.com:444/123',
    'http://map.naver.com/p/123',
    'javascript:alert(1)',
    'data:text/html,not-a-map',
    'file:///maps/123',
    '/maps/123',
  ]) assert.equal(safeMapUrl(url), null, url);
});

test('map labels identify the actual allowed provider rather than calling every map Naver', () => {
  for (const [url, label] of [
    ['http://place.map.kakao.com/1307174813', '카카오맵'],
    ['https://place.map.kakao.com/1307174813', '카카오맵'],
    ['https://map.naver.com/p/123', '네이버 지도'],
    ['https://naver.me/abc123', '네이버 지도'],
    ['https://example.com/maps', null],
    [null, null],
  ]) assert.equal(mapLinkLabel(url), label);
});

test('recommendation mapping retains the API relative photo path and Kakao place link', () => {
  const mapped = mapRecommendation({
    recommendationId: 7,
    totalBreads: 1,
    results: [{
      recommendationResultId: 13, rank: 1, bakeryId: 32, bakeryName: '두건호텔리어',
      district: '중구', imageUrl: '/images/bakeries/32.webp',
      mapUrl: 'http://place.map.kakao.com/1307174813', saved: false, score: 0.5372,
      coveredBreadNames: ['소금빵'], reasons: [{ breadName: '소금빵', tagName: '짠맛' }],
    }],
  });
  assert.equal(mapped.results[0].imageUrl, '/images/bakeries/32.webp');
  assert.equal(mapped.results[0].mapUrl, 'https://place.map.kakao.com/1307174813');
});

test('recommendation mapping preserves honest zero, one, and two-result states', () => {
  for (const count of [0, 1, 2]) {
    const response = {
      recommendationId: 700,
      totalBreads: 2,
      results: Array.from({ length: count }, (_, index) => ({
        recommendationResultId: 800 + index,
        rank: index + 1,
        bakeryId: 40 + index,
        bakeryName: `빵집 ${index + 1}`,
        district: '대전 중구',
        imageUrl: index === 0 ? null : `https://cdn.example/${index}.jpg`,
        mapUrl: index === 0 ? 'https://example.com/not-naver' : 'https://map.naver.com/p/2',
        saved: false,
        score: 0.8123 - index,
        coveredBreadNames: ['소금빵'],
        reasons: [{ breadName: '소금빵', tagName: '겉바삭' }],
        invented: 'drop me',
      })),
    };

    const mapped = mapRecommendation(response);
    assert.equal(mapped.results.length, count);
    if (count > 0) {
      assert.equal(mapped.results[0].score, 0.8123);
      assert.equal(mapped.results[0].imageUrl, null);
      assert.equal(mapped.results[0].mapUrl, null);
      assert.equal('invented' in mapped.results[0], false);
    }
  }

  assert.throws(() => mapRecommendation({
    recommendationId: 700,
    totalBreads: 1,
    results: [{}, {}, {}, {}],
  }), { code: 'TOO_MANY_RECOMMENDATIONS' });
});

test('history mapping keeps current bakery photos, district and safe map links without inventing result scores', () => {
  const mapped = mapRecommendationHistory([{
    recommendationId: 700,
    createdAt: '2026-09-10T12:30:00',
    tray: [{ bread: '소금빵', tags: ['겉바삭'] }],
    results: [{
      recommendationResultId: 801,
      rank: 1,
      bakeryId: 42,
      bakeryName: '실제 빵집',
      district: '중구',
      score: 0.99,
      saved: true,
      imageUrl: '/images/bakeries/42.webp',
      mapUrl: 'http://place.map.kakao.com/123',
    }],
  }]);

  assert.deepEqual(mapped, [{
    recommendationId: 700,
    createdAt: '2026-09-10T12:30:00',
    tray: [{ bread: '소금빵', tags: ['겉바삭'] }],
    results: [{ recommendationResultId: 801, rank: 1, bakeryId: 42, bakeryName: '실제 빵집',
      district: '중구', imageUrl: '/images/bakeries/42.webp', mapUrl: 'https://place.map.kakao.com/123' }],
  }]);
});

test('history supports older or missing bakery fields and rejects unsafe map links', () => {
  for (const patch of [{}, { imageUrl: null, district: null, mapUrl: null },
    { imageUrl: '   ', mapUrl: 'javascript:alert(1)' }]) {
    const [record] = mapRecommendationHistory([{
      recommendationId: 700, createdAt: '2026-09-10T12:30:00', tray: [],
      results: [{ recommendationResultId: 801, rank: 1, bakeryId: 42, bakeryName: '', ...patch }],
    }]);
    assert.deepEqual(record.results, [{ recommendationResultId: 801, rank: 1, bakeryId: 42,
      bakeryName: '', district: null, imageUrl: null, mapUrl: null }]);
  }
});

test('bakery profile keeps aggregated bread tags, relabels legacy tag names and drops empty items', () => {
  const profile = {
    id: 3, name: ' 하레하레 ', district: '서구', imageUrl: '/images/bakeries/3.webp', mapUrl: 'https://place.map.kakao.com/3', isOpen: true,
    topTags: ['겉바속촉', '근본', ''],
    breads: [
      { breadId: 1, name: '소금빵', representative: true, reviewCount: 12, tags: [{ tagId: 3, name: '겉바속촉', count: 9 }, { tagId: 9, name: '근본', count: 4 }, { tagId: 4, name: '촉촉', count: 0 }] },
      { breadId: 0, name: '없는 빵', reviewCount: 1, tags: [] },
      { breadId: 7, name: '휘낭시에', reviewCount: 2 },
    ],
    otherBreads: [{ name: '마늘바게트', count: 3 }, { name: '', count: 2 }, { name: '앙버터', count: 0 }],
  };
  assert.deepEqual(mapBakeryProfile(profile), {
    id: 3, name: '하레하레', district: '서구', imageUrl: '/images/bakeries/3.webp', mapUrl: 'https://place.map.kakao.com/3', isOpen: true,
    topTags: ['겉바속촉', '오리지널'],
    breads: [
      { breadId: 1, name: '소금빵', representative: true, reviewCount: 12, tags: [{ tagId: 3, name: '겉바속촉', count: 9 }, { tagId: 9, name: '오리지널', count: 4 }] },
      { breadId: 7, name: '휘낭시에', representative: false, reviewCount: 2, tags: [] },
    ],
    otherBreads: [{ name: '마늘바게트', count: 3 }],
  });
  assert.throws(() => mapBakeryProfile({ id: 3, breads: 'x', otherBreads: [], topTags: [] }), /INVALID_BAKERY_PROFILE|arrays/);
  assert.throws(() => mapBakeryProfile(null), /INVALID_BAKERY_PROFILE|positive id/);
});

test('home cards become carousel campaigns only when the server names a representative bread', () => {
  const cards = [
    { id: 1, name: '성심당', district: '중구', imageUrl: '/images/bakeries/1.webp', mapUrl: 'https://place.map.kakao.com/123', saved: false, representativeBread: '바게트' },
    { id: 4, name: '하레하레', district: null, imageUrl: null, mapUrl: 'http://place.map.kakao.com/456', saved: false, representativeBread: ' 소금빵 ' },
    { id: 9, name: '점수 없는 집', district: '서구', imageUrl: '/images/bakeries/9.webp', mapUrl: 'https://map.naver.com/p/1', saved: false, representativeBread: null },
    { id: 0, name: '잘못된 id', district: '서구', imageUrl: null, mapUrl: null, saved: false, representativeBread: '식빵' },
  ];
  assert.deepEqual(mapHomeCampaigns(cards), [
    { id: 'bakery-1', bakeryId: 1, bread: '바게트', store: '성심당', area: '대전 중구', image: '/images/bakeries/1.webp', alt: '성심당 매장 대표 사진', mapUrl: 'https://place.map.kakao.com/123' },
    { id: 'bakery-4', bakeryId: 4, bread: '소금빵', store: '하레하레', area: '대전', image: null, alt: '하레하레 매장 대표 사진', mapUrl: 'https://place.map.kakao.com/456' },
  ]);
  assert.deepEqual(mapHomeCampaigns([]), []);
  assert.throws(() => mapHomeCampaigns({ cards: [] }), (error) => error instanceof AdapterValidationError && error.code === 'INVALID_HOME_CARDS');
});
