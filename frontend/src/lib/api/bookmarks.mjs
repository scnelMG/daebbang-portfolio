import { toggleBookmarkSafely } from './flows.mjs';

// Toggle state must outlive an individual card: a lost response stays uncertain
// when the user switches bags or pages. Only an explicit GET can reconcile it.
export function createBookmarkStore(session, api, resultMemory) {
  let snapshot = {};
  let owner = session.getSnapshot().accountGeneration;
  const listeners = new Set();
  const publish = (next) => { snapshot = next; for (const listener of listeners) listener(); };
  session.subscribe(() => {
    const next = session.getSnapshot().accountGeneration;
    if (next !== owner) { owner = next; publish({}); }
  });
  const run = async (bakeryId, reconcile) => {
    const current = snapshot[bakeryId] ?? {};
    if (!session.getSnapshot().accessToken || current.pending || (!reconcile && current.needsReconcile)) return null;
    const expectedOwner = owner;
    publish({ ...snapshot, [bakeryId]: { ...current, pending: true, error: null } });
    let result;
    if (reconcile) {
      try {
        const detail = await api.bakeryDetail(bakeryId);
        if (typeof detail?.saved !== 'boolean') throw new Error('저장 상태를 확인하지 못했어요.');
        result = { saved: detail.saved, error: null, needsReconcile: false };
      } catch (error) { result = { error, needsReconcile: true }; }
    } else result = await toggleBookmarkSafely(api, bakeryId);
    if (expectedOwner !== owner) return null;
    if (typeof result.saved === 'boolean') resultMemory.updateSaved(bakeryId, result.saved);
    publish({ ...snapshot, [bakeryId]: { ...current, ...result, pending: false } });
    return result;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    toggle: (bakeryId) => run(bakeryId, false),
    reconcile: (bakeryId) => run(bakeryId, true),
  };
}
