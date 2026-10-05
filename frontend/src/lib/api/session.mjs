const STORAGE_KEY = 'bangtray.auth';

function sessionChangedError() {
  const error = new Error('The authenticated session changed while work was in progress.');
  error.name = 'SessionChangedError';
  error.code = 'SESSION_CHANGED';
  return error;
}

function emptySnapshot(generation = 0, accountGeneration = 0) {
  return Object.freeze({
    accessToken: null,
    refreshToken: null,
    userId: null,
    nickname: null,
    generation,
    accountGeneration,
  });
}

function normalizeSession(value, generation, accountGeneration, fallback = {}) {
  if (!value || typeof value.accessToken !== 'string' || !value.accessToken.trim()
    || typeof value.refreshToken !== 'string' || !value.refreshToken.trim()) {
    return null;
  }

  return Object.freeze({
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    userId: Number.isInteger(value.userId) ? value.userId : (fallback.userId ?? null),
    nickname: typeof value.nickname === 'string' ? value.nickname : (fallback.nickname ?? null),
    generation,
    accountGeneration,
  });
}

function resolveDefaultStorage() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function createSessionStore({ storage = resolveDefaultStorage() } = {}) {
  let snapshot = emptySnapshot();
  const listeners = new Set();

  if (storage) {
    try {
      const persisted = storage.getItem(STORAGE_KEY);
      if (persisted !== null) {
        snapshot = normalizeSession(JSON.parse(persisted), 0, 0) ?? snapshot;
        if (!snapshot.accessToken) storage.removeItem(STORAGE_KEY);
      }
    } catch {
      snapshot = emptySnapshot();
    }
  }

  const publish = (next) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  const persist = (next) => {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({
        accessToken: next.accessToken,
        refreshToken: next.refreshToken,
        userId: next.userId,
        nickname: next.nickname,
      }));
    } catch {
      // The in-memory session remains usable when browser storage is unavailable.
    }
  };

  return {
    getSnapshot() {
      return snapshot;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    setSession(value) {
      const next = normalizeSession(
        value,
        snapshot.generation + 1,
        snapshot.accountGeneration + 1,
      );
      if (!next) throw new TypeError('A session requires non-empty access and refresh tokens.');

      persist(next);
      publish(next);
      return next;
    },

    rotateTokens(value, expectedGeneration) {
      if (snapshot.generation !== expectedGeneration || !snapshot.accessToken) {
        throw sessionChangedError();
      }
      if (Number.isInteger(value?.userId) && Number.isInteger(snapshot.userId)
        && value.userId !== snapshot.userId) {
        throw sessionChangedError();
      }
      const next = normalizeSession(
        value,
        snapshot.generation + 1,
        snapshot.accountGeneration,
        snapshot,
      );
      if (!next) throw new TypeError('A token rotation requires non-empty access and refresh tokens.');

      persist(next);
      publish(next);
      return next;
    },

    clear() {
      if (storage) {
        try {
          storage.removeItem(STORAGE_KEY);
        } catch {
          // Clearing the in-memory session is still authoritative for this tab.
        }
      }
      publish(emptySnapshot(snapshot.generation + 1, snapshot.accountGeneration + 1));
      return snapshot;
    },
  };
}
