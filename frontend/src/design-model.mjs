export { createTrayRequest } from './features/tray/tray-model.mjs';
export { campaignHeadline } from './features/home/home-model.mjs';

export const screens = [
  { id: "home", title: "1. 홈 화면" },
  { id: "login", title: "2. 로그인 화면" },
  { id: "signup", title: "3. 회원가입 화면" },
  { id: "selection", title: "5. 빵 담기 및 취향 태그 화면" },
  { id: "result", title: "7. 빵집 추천 결과 화면" },
  { id: "review", title: "8. 리뷰 작성 화면" },
  {
    id: "ranking",
    title: "9. 리뷰 랭킹 화면",
    metrics: ["이번 달 방문한 빵집", "이번 달 작성한 리뷰"],
    reviewContent: false,
  },
];

export function normalizeScreen(requested) {
  if (['pre-selection', 'tags', 'tray'].includes(requested)) return 'selection';
  return ['mypage', 'my-info', 'my-reviews', 'recommendation-history', 'faq'].includes(requested) || screens.some(({ id }) => id === requested) ? requested : 'home';
}

export const breads = [
  ["소금빵", "bread-salt-roll-v5.jpg"],
  ["식빵", "bread-loaf-v5.jpg"],
  ["크루아상", "bread-croissant-v5.jpg"],
  ["베이글", "bread-bagel-v5.jpg"],
  ["바게트", "bread-baguette-v5.jpg"],
  ["치아바타", "bread-ciabatta-v5.jpg"],
  ["휘낭시에", "bread-financier-v5.jpg"],
  ["에그타르트", "bread-egg-tart-v5.jpg"],
];

export function toggleTasteTag(current, index) {
  if (current.includes(index)) {
    return current.filter((value) => value !== index);
  }

  return current.length < 2 ? [...current, index] : current;
}

export function createSelectionState() {
  return { entries: [], draft: null };
}

export function selectBreadDraft(state, breadIndex) {
  const saved = state.entries.find((entry) => entry.breadIndex === breadIndex);

  return {
    ...state,
    draft: {
      breadIndex,
      tags: saved ? [...saved.tags] : [],
    },
  };
}

export function toggleDraftTag(state, tagIndex) {
  if (!state.draft) return state;

  return {
    ...state,
    draft: {
      ...state.draft,
      tags: toggleTasteTag(state.draft.tags, tagIndex),
    },
  };
}

export function canCommitBreadDraft(state) {
  return Boolean(state.draft && state.draft.tags.length > 0);
}

export function commitBreadDraft(state) {
  if (!canCommitBreadDraft(state)) return state;

  const nextEntry = {
    breadIndex: state.draft.breadIndex,
    tags: [...state.draft.tags],
  };
  const existingIndex = state.entries.findIndex(
    (entry) => entry.breadIndex === state.draft.breadIndex,
  );
  const entries = existingIndex === -1
    ? [...state.entries, nextEntry]
    : state.entries.map((entry, index) => (index === existingIndex ? nextEntry : entry));

  return { entries, draft: null };
}

export function removeBreadEntry(state, breadIndex) {
  return {
    entries: state.entries.filter((entry) => entry.breadIndex !== breadIndex),
    draft: state.draft?.breadIndex === breadIndex ? null : state.draft,
  };
}

export function canRequestRecommendation(entries) {
  return entries.length > 0;
}

export function wrapCampaignIndex(index, count) {
  return ((index % count) + count) % count;
}

export function campaignPosition(index, selected, count) {
  const offset = wrapCampaignIndex(index - selected, count);
  if (offset === 0) return 'center';
  return offset <= count / 2 ? 'right' : 'left';
}

/** How many steps a card is from the selected one (0 = center, 1 = next to it, 2 = behind that). */
export function campaignDistance(index, selected, count) {
  const offset = wrapCampaignIndex(index - selected, count);
  return Math.min(offset, count - offset);
}
