export const catalog = [
  ['소금빵', ['근본', '바삭', '촉촉', '버터 풍미', '짭짤', '쫄깃']],
  ['식빵', ['근본', '쫄깃', '부드러움', '촉촉']],
  ['크루아상', ['근본', '바삭', '버터 풍미']],
  ['베이글', ['근본', '쫄깃', '탄력', '밀도']],
  ['바게트', ['근본', '바삭', '촉촉', '담백']],
  ['치아바타', ['근본', '쫄깃', '기공', '올리브 향']],
  ['휘낭시에', ['근본', '촉촉', '바삭', '버터 풍미']],
  ['에그타르트', ['근본', '촉촉', '바삭', '커스터드 풍미']],
].map(([name, tags], index) => ({ id: index + 1, name, imageUrl: null, tags: tags.map((name, i) => ({ id: (index + 1) * 100 + i + 1, name, isTypeTag: i === 0 })) }));
export const stores = ['트레이 베이커리', '오븐의 아침', '작은 빵 연구소'].map((name, i) => ({ id: i + 1, name, district: ['유성구 · 샘플', '서구 · 샘플', '중구 · 샘플'][i], imageUrl: '/assets/daebbang/storefront.svg', mapUrl: null, saved: false, isOpen: true, representativeBread: ['소금빵', '크루아상', '바게트'][i] }));
export function resultFor(tray) {
  if (!Array.isArray(tray) || !tray.length || tray.length > 8) throw new Error('Invalid tray');
  for (const item of tray) {
    const bread = catalog.find(b => b.id === item.breadId);
    if (!bread || !Array.isArray(item.tagIds) || !item.tagIds.length || item.tagIds.length > 2 || item.tagIds.some(id => !bread.tags.some(t => t.id === id))) throw new Error('Invalid tags');
  }
  return { recommendationId: 1, totalBreads: tray.length, results: stores.map((s, i) => ({ recommendationResultId: i + 1, rank: i + 1, bakeryId: s.id, bakeryName: s.name, district: s.district, imageUrl: s.imageUrl, mapUrl: null, saved: false, score: i === 2 ? 0 : 0.75 - i * 0.1, pickType: i === 2 ? 'random' : 'score', coveredBreadNames: i === 2 ? [] : tray.map(b => catalog.find(c => c.id === b.breadId).name), reasons: i === 2 ? [] : tray.slice(0, 2).map(b => ({ breadName: catalog.find(c => c.id === b.breadId).name, tagName: catalog.find(c => c.id === b.breadId).tags.find(t => t.id === b.tagIds[0]).name })) })) };
}
export function profileFor(id) {
  const store = stores.find(s => s.id === id) ?? stores[0];
  return { ...store, topTags: ['바삭', '버터 풍미', '촉촉'], breads: catalog.slice(0, 3).map((b, i) => ({ breadId: b.id, name: b.name, representative: i === 0, reviewCount: 12 - i * 3, tags: b.tags.slice(1, 3).map((t, j) => ({ tagId: t.id, name: t.name, count: 8 - j * 2 })) })), otherBreads: [] };
}
