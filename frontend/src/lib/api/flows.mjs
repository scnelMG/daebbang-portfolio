import { validateTray } from './adapters.mjs';

const changed = () => Object.assign(new Error('로그인 상태가 바뀌었어요. 다시 시도해주세요.'), { code: 'SESSION_CHANGED' });

export function recommendationTray(state, catalog) {
  return validateTray(state.entries.map(({ breadId, tags }) => ({ breadId, tagIds: tags })), catalog);
}

export function createResultMemory(session) {
  let owner = session.getSnapshot().accountGeneration;
  const results = new Map();
  // Synchronous invalidation also protects reads before React runs any effects.
  session.subscribe(() => {
    const next = session.getSnapshot().accountGeneration;
    if (next !== owner) { results.clear(); owner = next; }
  });
  return {
    get: (id) => results.get(id) ?? null,
    put(result, expectedOwner) {
      if (expectedOwner !== owner) return false;
      results.set(result.recommendationId, result);
      return true;
    },
    updateSaved(bakeryId, saved) {
      for (const [id, result] of results) results.set(id, {
        ...result, results: result.results.map((store) => store.bakeryId === bakeryId ? { ...store, saved } : store),
      });
    },
  };
}

export async function signIn(login, session, dto, options) {
  const owner = session.getSnapshot().accountGeneration;
  const tokens = await login(dto, options);
  if (session.getSnapshot().accountGeneration !== owner) throw changed();
  session.setSession(tokens);
}

export async function signOut(api, session) {
  const owner = session.getSnapshot().accountGeneration;
  // Dispatch while the token is available, then clear locally without waiting.
  let response;
  try { response = api.logout(); }
  finally { if (session.getSnapshot().accountGeneration === owner) session.clear(); }
  return response;
}

export function queryView(state, key, enabled) {
  if (!enabled) return { status: 'idle', data: null, error: null };
  return state.key === key ? state : { status: 'loading', data: null, error: null };
}

export async function toggleBookmarkSafely(api, bakeryId) {
  try {
    const result = await api.toggleBookmark(bakeryId);
    if (typeof result?.saved !== 'boolean') throw new Error('저장 상태를 확인하지 못했어요.');
    return { saved: result.saved, error: null, needsReconcile: false };
  } catch (error) {
    // A toggle may have committed even when its response was lost. Re-read first.
    return { error, needsReconcile: true };
  }
}
