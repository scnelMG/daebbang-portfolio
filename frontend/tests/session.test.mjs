import assert from 'node:assert/strict';
import test from 'node:test';

import { createSessionStore } from '../src/lib/api/session.mjs';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
    value(key) {
      return values.get(key);
    },
  };
}

test('malformed persisted tokens are ignored without destabilizing the initial snapshot', () => {
  const storage = memoryStorage({ 'bangtray.auth': '{not-json' });

  const session = createSessionStore({ storage });
  const first = session.getSnapshot();

  assert.deepEqual(first, {
    accessToken: null,
    refreshToken: null,
    userId: null,
    nickname: null,
    generation: 0,
    accountGeneration: 0,
  });
  assert.strictEqual(session.getSnapshot(), first);
});

test('storage failures do not crash initialization or later session changes', () => {
  const storage = {
    getItem() {
      throw new Error('storage blocked');
    },
    setItem() {
      throw new Error('quota exceeded');
    },
    removeItem() {
      throw new Error('storage blocked');
    },
  };
  const session = createSessionStore({ storage });

  session.setSession({
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    userId: 7,
    nickname: '소금빵',
    ignoredBusinessData: [{ bakeryId: 99 }],
  });

  assert.equal(session.getSnapshot().accessToken, 'access-1');
  assert.equal(session.getSnapshot().generation, 1);
  assert.equal(session.getSnapshot().accountGeneration, 1);
  assert.doesNotThrow(() => session.clear());
  assert.equal(session.getSnapshot().generation, 2);
  assert.equal(session.getSnapshot().accountGeneration, 2);
});

test('session changes publish one stable snapshot and persist only authentication fields', () => {
  const storage = memoryStorage();
  const session = createSessionStore({ storage });
  const seen = [];
  const unsubscribe = session.subscribe(() => seen.push(session.getSnapshot()));

  session.setSession({
    accessToken: 'access-2',
    refreshToken: 'refresh-2',
    userId: 11,
    nickname: '크루아상',
    reviews: [{ reviewId: 3 }],
  });
  const authenticated = session.getSnapshot();
  session.clear();
  unsubscribe();
  session.setSession({
    accessToken: 'access-3',
    refreshToken: 'refresh-3',
    userId: 12,
    nickname: '베이글',
  });

  assert.strictEqual(seen[0], authenticated);
  assert.equal(seen.length, 2);
  assert.deepEqual(JSON.parse(storage.value('bangtray.auth')), {
    accessToken: 'access-3',
    refreshToken: 'refresh-3',
    userId: 12,
    nickname: '베이글',
  });
});

test('persisted values without both non-empty tokens are treated as signed out', () => {
  const storage = memoryStorage({
    'bangtray.auth': JSON.stringify({ accessToken: 'access', refreshToken: '' }),
  });

  assert.equal(createSessionStore({ storage }).getSnapshot().accessToken, null);
});

test('token rotation advances request generation without changing authenticated account identity', () => {
  const session = createSessionStore({ storage: null });
  const signedIn = session.setSession({
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    userId: 7,
    nickname: '소금빵',
  });

  const rotated = session.rotateTokens({
    accessToken: 'access-2',
    refreshToken: 'refresh-2',
    userId: 7,
    nickname: '소금빵',
  }, signedIn.generation);

  assert.equal(rotated.generation, signedIn.generation + 1);
  assert.equal(rotated.accountGeneration, signedIn.accountGeneration);
  assert.equal(rotated.accessToken, 'access-2');
  assert.throws(
    () => session.rotateTokens({ accessToken: 'stale', refreshToken: 'stale' }, signedIn.generation),
    { code: 'SESSION_CHANGED' },
  );
});
