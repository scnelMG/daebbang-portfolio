import test from 'node:test';
import assert from 'node:assert/strict';
import { readRoute, routeSearch, loginReturn, requiresAuth, recommendationFailureRoute } from '../src/lib/routes.mjs';
import { createResultMemory, signIn, signOut, recommendationTray, queryView, toggleBookmarkSafely } from '../src/lib/api/flows.mjs';
import { createSessionStore } from '../src/lib/api/session.mjs';
import { resolveBreadDrop } from '../src/features/tray/tray-drag.mjs';
import { createBookmarkStore } from '../src/lib/api/bookmarks.mjs';
import { errorMessage } from '../src/lib/api/error-message.mjs';

const tokens = (userId = 1) => ({ accessToken: `a${userId}`, refreshToken: `r${userId}`, userId, nickname: '사용자' });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('login errors preserve the server message instead of replacing it with a generic 401 message', () => {
  assert.equal(errorMessage({ kind: 'api', status: 401, message: '이메일 또는 비밀번호를 확인해주세요.' }), '이메일 또는 비밀번호를 확인해주세요.');
});

test('route round trip keeps numeric recommendation/review intent, drops unsafe or invalid IDs', () => {
  const route = readRoute('?screen=review&bakeryId=41&recommendationResultId=90&recommendationId=7');
  assert.equal(route.bakeryId, 41);
  assert.equal(route.recommendationResultId, 90);
  assert.equal(readRoute(routeSearch(route.page, route)).recommendationId, 7);
  const invalid = readRoute('?screen=result&recommendationId=-4&bakeryId=4.2');
  assert.equal(invalid.recommendationId, null);
  assert.equal(invalid.bakeryId, null);
  assert.equal(readRoute('?screen=https://bad.example').page, 'home');
});

test('login return only accepts known internal query routes and never returns to login/signup', () => {
  assert.equal(loginReturn('//bad.example').page, 'selection');
  assert.equal(loginReturn('https://bad.example/?screen=saved').page, 'selection');
  assert.equal(loginReturn('?screen=login').page, 'selection');
  assert.equal(loginReturn('?screen=review&bakeryId=41').bakeryId, 41);
  assert.equal(requiresAuth('selection'), false);
  for (const page of ['result', 'review', 'ranking', 'mypage', 'my-info', 'my-reviews', 'recommendation-history']) assert.equal(requiresAuth(page), true);
});

test('retired saved links resolve to home without requiring login or reviving the removed page', () => {
  assert.equal(readRoute('?screen=saved').page, 'home');
  assert.equal(routeSearch('saved'), '?screen=home');
  assert.equal(loginReturn('?screen=saved').page, 'home');
  assert.equal(requiresAuth('saved'), false);
  assert.equal(readRoute('?screen=recommendation-history').page, 'recommendation-history');
});

test('expired recommendation session returns selection to login without redirecting a different page or account', () => {
  assert.deepEqual(recommendationFailureRoute('selection', false), { page: 'login', returnTo: '?screen=selection' });
  assert.equal(recommendationFailureRoute('home', false), null);
  assert.equal(recommendationFailureRoute('selection', true), null);
});

test('only committed numeric tray IDs and tags reach recommendation validation', () => {
  const state = { entries: [{ breadId: 108, tags: [802] }], draft: { breadId: 101, tags: [701] } };
  const catalog = [{ id: 108, tags: [{ id: 802 }] }, { id: 101, tags: [{ id: 701 }] }];
  assert.deepEqual(recommendationTray(state, catalog), [{ breadId: 108, tagIds: [802] }]);
  assert.throws(() => recommendationTray(state, []), { code: 'UNKNOWN_BREAD' });
});

test('native string drag payload matches the local numeric source without accepting forged payload', () => {
  const bread = { id: 108 };
  assert.equal(resolveBreadDrop('108', 108, [bread]), bread);
  assert.equal(resolveBreadDrop('101', 108, [bread]), null);
  assert.equal(resolveBreadDrop('0108', 108, [bread]), null);
});

test('result memory survives token refresh but clears synchronously on logout/account replacement', () => {
  const session = createSessionStore({ storage: null });
  session.setSession(tokens());
  const memory = createResultMemory(session);
  const scope = session.getSnapshot().accountGeneration;
  memory.put({ recommendationId: 7, results: [] }, scope);
  session.rotateTokens(tokens(), session.getSnapshot().generation);
  assert.equal(memory.get(7).recommendationId, 7);
  session.setSession(tokens(2));
  assert.equal(memory.get(7), null);
  assert.equal(memory.put({ recommendationId: 8, results: [] }, scope), false);
  assert.equal(memory.get(8), null);
});

test('logout clears session even on network failure and never clears a new account', async () => {
  const session = createSessionStore({ storage: null });
  session.setSession(tokens());
  await assert.rejects(signOut({ logout: async () => { throw new Error('offline'); } }, session));
  assert.equal(session.getSnapshot().accessToken, null);
  session.setSession(tokens());
  const pending = deferred();
  const result = signOut({ logout: () => pending.promise }, session);
  assert.equal(session.getSnapshot().accessToken, null, 'logout must hide private data without waiting for a network response');
  session.setSession(tokens(2));
  pending.resolve(null);
  await result;
  assert.equal(session.getSnapshot().userId, 2);
});

test('late login cannot replace an account that authenticated while the request was pending', async () => {
  const session = createSessionStore({ storage: null });
  const pending = deferred();
  const result = signIn(() => pending.promise, session, { email: 'a@b.c', password: 'password' });
  session.setSession(tokens(2));
  pending.resolve(tokens());
  await assert.rejects(result, { code: 'SESSION_CHANGED' });
  assert.equal(session.getSnapshot().userId, 2);
});

test('query view hides previous private data before effect cleanup and distinguishes disabled/loading', () => {
  const state = { key: 'user1', status: 'success', data: ['private'], error: null };
  assert.equal(queryView(state, 'user2', true).data, null);
  assert.equal(queryView(state, 'user2', true).status, 'loading');
  assert.equal(queryView(state, 'user1', false).data, null);
  assert.equal(queryView(state, 'user1', false).status, 'idle');
});

test('ambiguous bookmark failure requires reconciliation and never repeats the toggle', async () => {
  let calls = 0;
  const outcome = await toggleBookmarkSafely({ toggleBookmark: async () => { calls++; throw Object.assign(new Error('offline'), { kind: 'network' }); } }, 41);
  assert.equal(calls, 1);
  assert.equal(outcome.needsReconcile, true);
  assert.equal(outcome.saved, undefined);
  assert.ok(outcome.error);
  assert.deepEqual(await toggleBookmarkSafely({ toggleBookmark: async () => ({ saved: true }) }, 41), { saved: true, error: null, needsReconcile: false });
});

test('bookmark pending and uncertainty survive consumers remounting until explicit GET reconciliation', async () => {
  const session = createSessionStore({ storage: null });
  session.setSession(tokens());
  const pending = deferred();
  let posts = 0;
  const store = createBookmarkStore(session, {
    toggleBookmark: () => { posts++; return pending.promise; },
    bakeryDetail: async () => ({ id: 41, saved: true }),
  }, createResultMemory(session));
  const first = store.toggle(41);
  assert.equal(store.getSnapshot()[41].pending, true);
  await store.toggle(41);
  assert.equal(posts, 1);
  pending.reject(new Error('lost response'));
  await first;
  assert.equal(store.getSnapshot()[41].needsReconcile, true);
  await store.toggle(41);
  assert.equal(posts, 1);
  await store.reconcile(41);
  assert.equal(store.getSnapshot()[41].needsReconcile, false);
  assert.equal(store.getSnapshot()[41].saved, true);
});

test('bookmark completion from a signed-out account cannot repopulate private state', async () => {
  const session = createSessionStore({ storage: null });
  session.setSession(tokens());
  const pending = deferred();
  const store = createBookmarkStore(session, { toggleBookmark: () => pending.promise }, createResultMemory(session));
  const first = store.toggle(41);
  session.clear();
  assert.deepEqual(store.getSnapshot(), {});
  pending.resolve({ saved: true });
  await first;
  assert.deepEqual(store.getSnapshot(), {});
});
