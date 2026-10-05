import { displayTagLabel } from '../../lib/tag-labels.mjs';

// The printed label on an opened bag has three feature slots. Fill them from the
// recommendation evidence: review tags first (why this bakery matched), then the
// tray breads it covers; a random "discovery" slot with no evidence says so.
export const BAG_LABEL_SLOTS = 3;

export function bagLabelFeatures(item, limit = BAG_LABEL_SLOTS) {
  const features = [];
  const push = (value) => {
    const text = String(value ?? '').trim();
    if (text && !features.includes(text) && features.length < limit) features.push(text);
  };
  (item?.reasons ?? []).forEach((reason) => push(displayTagLabel(reason?.tagName)));
  (item?.coveredBreadNames ?? []).forEach(push);
  if (!features.length && item?.pickType === 'random') push('오늘의 발견');
  return features;
}

export function bagLabelFor(item) {
  return {
    name: String(item?.bakeryName ?? '').trim(),
    district: String(item?.district ?? '').trim(),
    features: bagLabelFeatures(item),
  };
}
