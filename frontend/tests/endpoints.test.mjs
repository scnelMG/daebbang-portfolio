import assert from 'node:assert/strict';
import test from 'node:test';

import { createEndpoints } from '../src/lib/api/endpoints.mjs';

function recordingClient() {
  const calls = [];
  return {
    calls,
    async request(path, options = {}) {
      calls.push({ path, options });
      return { call: calls.length };
    },
  };
}

test('auth endpoints serialize only the exact backend DTO fields and never refresh auth failures', async () => {
  const client = recordingClient();
  const api = createEndpoints(client);

  await api.signup({
    nickname: '소금빵',
    email: 'bread@example.com',
    password: 'password1',
    passwordConfirm: 'password1',
    termsAgreed: true,
    privacyAgreed: true,
    avatar: 'must-not-leak',
  });
  await api.login({ email: 'bread@example.com', password: 'password1', remember: true });
  await api.google({ idToken: 'google-id-token', accessToken: 'wrong-token-kind' });
  await api.refresh({ refreshToken: 'refresh-token', accessToken: 'do-not-send' });
  await api.logout();

  assert.deepEqual(client.calls, [
    {
      path: '/auth/signup',
      options: {
        method: 'POST',
        body: {
          nickname: '소금빵',
          email: 'bread@example.com',
          password: 'password1',
          passwordConfirm: 'password1',
          termsAgreed: true,
          privacyAgreed: true,
        },
        auth: false,
        refresh: false,
        signal: undefined,
      },
    },
    {
      path: '/auth/login',
      options: {
        method: 'POST',
        body: { email: 'bread@example.com', password: 'password1' },
        auth: false,
        refresh: false,
        sessionGuard: true,
        signal: undefined,
      },
    },
    {
      path: '/auth/google',
      options: {
        method: 'POST',
        body: { idToken: 'google-id-token' },
        auth: false,
        refresh: false,
        sessionGuard: true,
        signal: undefined,
      },
    },
    {
      path: '/auth/token/refresh',
      options: {
        method: 'POST',
        body: { refreshToken: 'refresh-token' },
        auth: false,
        refresh: false,
        signal: undefined,
      },
    },
    {
      path: '/auth/logout',
      options: { method: 'POST', refresh: false, signal: undefined },
    },
  ]);
});

test('recommendation and review endpoints serialize numeric backend request DTOs exactly', async () => {
  const client = recordingClient();
  const api = createEndpoints(client);

  await api.recommend([
    { breadId: 101, tagIds: [1001, 1003], visualKey: 'salt' },
    { breadId: 108, tagIds: [1081], label: '에그타르트' },
  ]);
  await api.createReview({
    bakeryId: 42,
    recommendationResultId: null,
    visitDate: '2026-09-10',
    rating: 5,
    breads: [{ breadId: 101, tagIds: [], label: '소금빵' }],
    customBreadNames: ['단팥빵'],
    content: 'server has no free-text review',
  });

  assert.deepEqual(client.calls, [
    {
      path: '/recommendations',
      options: {
        method: 'POST',
        body: {
          tray: [
            { breadId: 101, tagIds: [1001, 1003] },
            { breadId: 108, tagIds: [1081] },
          ],
        },
        signal: undefined,
      },
    },
    {
      path: '/reviews',
      options: {
        method: 'POST',
        body: {
          bakeryId: 42,
          recommendationResultId: null,
          visitDate: '2026-09-10',
          rating: 5,
          breads: [{ breadId: 101, tagIds: [] }],
          customBreadNames: ['단팥빵'],
        },
        signal: undefined,
      },
    },
  ]);
});

test('read and bookmark endpoints use the backend controller paths and safe query encoding', async () => {
  const client = recordingClient();
  const api = createEndpoints(client);
  const controller = new AbortController();

  await api.catalog({ signal: controller.signal });
  await api.homeBakeries({ size: 3 });
  await api.me();
  await api.history();
  await api.bakeryDetail(42);
  await api.bakeryProfile(42);
  await api.bookmarks();
  await api.toggleBookmark(42);
  await api.myReviews();
  await api.ranking({ period: 'monthly', yearMonth: '2026-08' });

  assert.deepEqual(client.calls.map(({ path, options }) => ({
    path,
    method: options.method ?? 'GET',
    auth: options.auth ?? true,
    signal: options.signal,
  })), [
    { path: '/breads', method: 'GET', auth: false, signal: controller.signal },
    { path: '/bakeries/home?size=3', method: 'GET', auth: false, signal: undefined },
    { path: '/users/me', method: 'GET', auth: true, signal: undefined },
    { path: '/users/me/recommendations', method: 'GET', auth: true, signal: undefined },
    { path: '/bakeries/42', method: 'GET', auth: true, signal: undefined },
    { path: '/bakeries/42/profile', method: 'GET', auth: false, signal: undefined },
    { path: '/users/me/bookmarks', method: 'GET', auth: true, signal: undefined },
    { path: '/bakeries/42/bookmark', method: 'POST', auth: true, signal: undefined },
    { path: '/users/me/reviews', method: 'GET', auth: true, signal: undefined },
    { path: '/rankings?period=monthly&yearMonth=2026-08', method: 'GET', auth: true, signal: undefined },
  ]);
});
