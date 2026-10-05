import { assignTraySlots, createTraySeed, freeTraySlot, TRAY_SLOT_COUNT } from './tray-layout.mjs';

const getBread = (catalog, id) => catalog.find((bread) => bread.id === id);

// Tray state: `entries` are the breads on the tray (each with the slot it sits in),
// `draft` is the bread whose tags are being picked, `seed` fixes the tray's look
// (fill order, lean, mirroring) until the tray is emptied again.
export function createTrayState(entries = [], seed = createTraySeed()) {
  return {
    entries: assignTraySlots(entries.map((entry) => ({ ...entry, tags: [...entry.tags] }))),
    draft: null,
    seed,
  };
}

export function selectBreadDraft(state, breadId, catalog) {
  if (!getBread(catalog, breadId)) return state;
  if (state.draft?.breadId === breadId) return state;
  const saved = state.entries.find((entry) => entry.breadId === breadId);

  return {
    ...state,
    draft: {
      breadId,
      tags: saved ? [...saved.tags] : [],
    },
  };
}

export function clearBreadDraft(state) {
  return state.draft ? { ...state, draft: null } : state;
}

export function toggleDraftTag(state, tagId, catalog) {
  if (!state.draft) return state;
  const bread = getBread(catalog, state.draft.breadId);
  if (!bread?.allowedTags.includes(tagId)) return state;

  const selected = state.draft.tags.includes(tagId);
  if (!selected && state.draft.tags.length >= 2) return state;

  return {
    ...state,
    draft: {
      ...state.draft,
      tags: selected
        ? state.draft.tags.filter((tag) => tag !== tagId)
        : [...state.draft.tags, tagId],
    },
  };
}

export function canCommitBreadDraft(state) {
  return Boolean(state.draft && state.draft.tags.length > 0);
}

// A new bread takes the lowest free slot. The first bread on an empty tray also
// draws a fresh seed (pass `seed` to make that deterministic, e.g. in tests).
export function commitBreadDraft(state, catalog, { seed } = {}) {
  const bread = state.draft && getBread(catalog, state.draft.breadId);
  if (!canCommitBreadDraft(state) || !bread || state.draft.tags.length > 2
    || state.draft.tags.some((tagId) => !bread.allowedTags.includes(tagId))) return state;

  const existing = state.entries.find((entry) => entry.breadId === state.draft.breadId);
  if (existing) {
    const nextEntry = { ...existing, tags: [...state.draft.tags] };
    return {
      ...state,
      entries: state.entries.map((entry) => (entry === existing ? nextEntry : entry)),
      draft: null,
    };
  }

  const slot = freeTraySlot(state.entries);
  if (slot < 0) return state;
  return {
    ...state,
    entries: [...state.entries, { breadId: state.draft.breadId, tags: [...state.draft.tags], slot }],
    draft: null,
    seed: state.entries.length ? state.seed : (seed ?? createTraySeed()),
  };
}

// Removing leaves the slot empty (the next bread fills it), like lifting a bread off a real tray.
export function removeTrayBread(state, breadId) {
  return {
    ...state,
    entries: state.entries.filter((entry) => entry.breadId !== breadId),
    draft: state.draft?.breadId === breadId ? null : state.draft,
  };
}

// Undo for removeTrayBread: put the bread back where it was (same slot when still
// free, otherwise the lowest free one) at its old position in the order.
export function restoreTrayBread(state, entry, index = state.entries.length) {
  if (!entry || state.entries.some((current) => current.breadId === entry.breadId)) return state;
  const slotFree = Number.isInteger(entry.slot) && entry.slot >= 0 && entry.slot < TRAY_SLOT_COUNT
    && !state.entries.some((current) => current.slot === entry.slot);
  const slot = slotFree ? entry.slot : freeTraySlot(state.entries);
  if (slot < 0) return state;
  const entries = [...state.entries];
  entries.splice(Math.max(0, Math.min(index, entries.length)), 0, { ...entry, tags: [...entry.tags], slot });
  return { ...state, entries };
}

export function createTrayRequest(state) {
  if (!state.entries.length) return null;
  return {
    breads: state.entries.map((entry) => ({
      breadId: entry.breadId,
      tags: [...entry.tags],
    })),
  };
}
