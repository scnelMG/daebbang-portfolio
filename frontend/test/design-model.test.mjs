import assert from "node:assert/strict";
import test from "node:test";

import * as designModel from "../src/design-model.mjs";
import { screens } from "../src/design-model.mjs";

test("taste tag selection stops at two choices and still allows deselection", () => {
  assert.equal(typeof designModel.toggleTasteTag, "function");
  assert.deepEqual(designModel.toggleTasteTag([0], 2), [0, 2]);
  assert.deepEqual(designModel.toggleTasteTag([0, 2], 3), [0, 2]);
  assert.deepEqual(designModel.toggleTasteTag([0, 2], 0), [2]);
});

test("switching breads discards the uncommitted draft without changing the tray", () => {
  const initial = designModel.createSelectionState();
  const withSaltBreadDraft = designModel.toggleDraftTag(
    designModel.selectBreadDraft(initial, 0),
    2,
  );

  const switched = designModel.selectBreadDraft(withSaltBreadDraft, 1);

  assert.deepEqual(switched.entries, []);
  assert.deepEqual(switched.draft, { breadIndex: 1, tags: [] });
});

test("a bread reaches the tray only after its tagged draft is committed", () => {
  const initial = designModel.createSelectionState();
  const readyDraft = designModel.toggleDraftTag(
    designModel.selectBreadDraft(initial, 2),
    1,
  );

  const committed = designModel.commitBreadDraft(readyDraft);

  assert.deepEqual(committed.entries, [{ breadIndex: 2, tags: [1] }]);
  assert.equal(committed.draft, null);
});

test("committing without a bread tag keeps the tray unchanged", () => {
  const selected = designModel.selectBreadDraft(designModel.createSelectionState(), 3);

  assert.deepEqual(designModel.commitBreadDraft(selected), selected);
});

test("opening a committed bread restores its tags and commits edits without duplicates", () => {
  const existing = {
    entries: [{ breadIndex: 4, tags: [0] }],
    draft: null,
  };
  const editing = designModel.toggleDraftTag(
    designModel.selectBreadDraft(existing, 4),
    5,
  );

  const updated = designModel.commitBreadDraft(editing);

  assert.deepEqual(updated.entries, [{ breadIndex: 4, tags: [0, 5] }]);
});

test("removing a bread clears it from both the tray and the active draft", () => {
  const editing = {
    entries: [
      { breadIndex: 0, tags: [1] },
      { breadIndex: 6, tags: [3] },
    ],
    draft: { breadIndex: 0, tags: [1] },
  };

  assert.deepEqual(designModel.removeBreadEntry(editing, 0), {
    entries: [{ breadIndex: 6, tags: [3] }],
    draft: null,
  });
});

test("recommendation becomes available only after a bread is committed", () => {
  assert.equal(typeof designModel.canRequestRecommendation, "function");
  assert.equal(designModel.canRequestRecommendation([]), false);
  assert.equal(designModel.canRequestRecommendation([{ breadIndex: 0, tags: [0] }]), true);
});

test("site flow contains every approved desktop screen in order", () => {
  assert.deepEqual(
    screens.map(({ id }) => id),
    ["home", "login", "signup", "selection", "result", "review", "ranking"],
  );
});

test("old tray entry URLs go directly to bread selection, without losing other routes", () => {
  for (const page of ['pre-selection', 'tags', 'tray', 'selection']) {
    assert.equal(designModel.normalizeScreen?.(page), 'selection');
  }
  assert.equal(designModel.normalizeScreen?.('result'), 'result');
  assert.equal(designModel.normalizeScreen?.('saved'), 'home');
  assert.equal(designModel.normalizeScreen?.('unknown'), 'home');
});

test('account destinations stay valid on direct navigation and browser history', () => {
  for (const page of ['mypage', 'my-info', 'my-reviews', 'recommendation-history', 'faq']) {
    assert.equal(designModel.normalizeScreen(page), page);
  }
});

test("ranking keeps monthly counts without personal review content", () => {
  const ranking = screens.find(({ id }) => id === "ranking");
  assert.deepEqual(ranking.metrics, ["이번 달 방문한 빵집", "이번 달 작성한 리뷰"]);
  assert.equal(ranking.reviewContent, false);
});
