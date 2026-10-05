import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiClientError, createApiClient } from '../src/lib/api/client.mjs';
import { createEndpoints } from '../src/lib/api/endpoints.mjs';
import { createSessionStore } from '../src/lib/api/session.mjs';

const json = (body, init = {}) => new Response(JSON.stringify(body), {
  status: init.status ?? 200,
  headers: { 'content-type': 'application/json', ...init.headers },
});

const signedIn = () => {
  const session = createSessionStore({ storage: null });
  session.setSession({
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    userId: 7,
    nickname: '빵순이',
  });
  return session;
};

test('returns data only from a successful API envelope', async () => {
  const client = createApiClient({
    session: createSessionStore({ storage: null }),
    fetchImpl: async () => json({ success: true, data: { value: 0 } }),
  });

  assert.deepEqual(await client.request('/value', { auth: false }), { value: 0 });
});

test('rejects an unsuccessful envelope even when HTTP status is successful', async () => {
  const client = createApiClient({
    session: createSessionStore({ storage: null }),
    fetchImpl: async () => json({
      success: false,
      data: null,
      error: { code: 'EMPTY_TRAY', message: '트레이가 비었습니다.' },
    }),
  });

  await assert.rejects(
    client.request('/recommendations', { method: 'POST', body: { tray: [] } }),
    (error) => error instanceof ApiClientError
      && error.kind === 'api'
      && error.code === 'EMPTY_TRAY'
      && error.status === 200,
  );
});

test('reports non-JSON responses as protocol failures without inventing success', async () => {
  const client = createApiClient({
    session: createSessionStore({ storage: null }),
    fetchImpl: async () => new Response('<html>proxy error</html>', {
      status: 502,
      headers: { 'content-type': 'text/html' },
    }),
  });

  await assert.rejects(
    client.request('/breads', { auth: false }),
    (error) => error instanceof ApiClientError
      && error.kind === 'protocol'
      && error.status === 502,
  );
});

test('wraps transport failures without retrying an ambiguous mutation', async () => {
  let calls = 0;
  const client = createApiClient({
    session: signedIn(),
    fetchImpl: async () => {
      calls += 1;
      throw new TypeError('connection reset');
    },
  });

  await assert.rejects(
    client.request('/reviews', { method: 'POST', body: { rating: 5 } }),
    (error) => error instanceof ApiClientError && error.kind === 'network',
  );
  assert.equal(calls, 1);
});

test('does not retry a mutation after a server 5xx response', async () => {
  let calls = 0;
  const client = createApiClient({
    session: signedIn(),
    fetchImpl: async () => {
      calls += 1;
      return json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: '서버 오류' } },
        { status: 500 },
      );
    },
  });

  await assert.rejects(
    client.request('/recommendations', { method: 'POST', body: { tray: [] } }),
    (error) => error instanceof ApiClientError
      && error.code === 'INTERNAL_ERROR'
      && error.status === 500,
  );
  assert.equal(calls, 1);
});

test('sends the current Bearer token and JSON body', async () => {
  let captured;
  const client = createApiClient({
    session: signedIn(),
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return json({ success: true, data: { saved: true } });
    },
  });

  await client.request('/bakeries/21/bookmark', { method: 'POST', body: { exact: true } });

  assert.equal(captured.url, '/api/bakeries/21/bookmark');
  assert.equal(captured.init.headers.get('authorization'), 'Bearer old-access');
  assert.equal(captured.init.headers.get('content-type'), 'application/json');
  assert.equal(captured.init.body, '{"exact":true}');
});

test('does not refresh a 401 when the caller opts out for an auth endpoint', async () => {
  let calls = 0;
  const client = createApiClient({
    session: signedIn(),
    fetchImpl: async () => {
      calls += 1;
      return json({ success: false, error: { code: 'UNAUTHORIZED', message: '실패' } }, { status: 401 });
    },
  });

  await assert.rejects(
    client.request('/auth/login', {
      method: 'POST',
      body: { email: 'user@example.com', password: 'secret' },
      auth: false,
      refresh: false,
    }),
    (error) => error instanceof ApiClientError && error.code === 'UNAUTHORIZED',
  );
  assert.equal(calls, 1);
});

test('coalesces concurrent 401 responses into one refresh and replays each request once', async () => {
  const session = signedIn();
  const attempts = new Map();
  let refreshCalls = 0;
  let releaseRefresh;
  const refreshGate = new Promise((resolve) => { releaseRefresh = resolve; });
  const client = createApiClient({
    session,
    fetchImpl: async (url, init) => {
      if (url === '/api/auth/token/refresh') {
        refreshCalls += 1;
        await refreshGate;
        return json({
          success: true,
          data: { accessToken: 'new-access', refreshToken: 'new-refresh', userId: 7, nickname: '빵순이' },
        });
      }
      const count = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, count);
      if (count === 1) {
        return json({ success: false, error: { code: 'UNAUTHORIZED', message: '만료' } }, { status: 401 });
      }
      assert.equal(init.headers.get('authorization'), 'Bearer new-access');
      return json({ success: true, data: { url } });
    },
  });

  const first = client.request('/users/me');
  const second = client.request('/users/me/reviews');
  await new Promise((resolve) => setImmediate(resolve));
  releaseRefresh();

  assert.deepEqual(await Promise.all([first, second]), [
    { url: '/api/users/me' },
    { url: '/api/users/me/reviews' },
  ]);
  assert.equal(refreshCalls, 1);
  assert.equal(attempts.get('/api/users/me'), 2);
  assert.equal(attempts.get('/api/users/me/reviews'), 2);
});

test('refresh failure clears the session and does not retry the original request', async () => {
  const session = signedIn();
  let originalCalls = 0;
  const client = createApiClient({
    session,
    fetchImpl: async (url) => {
      if (url === '/api/auth/token/refresh') {
        return json({ success: false, error: { code: 'INVALID_REFRESH_TOKEN', message: '만료' } }, { status: 401 });
      }
      originalCalls += 1;
      return json({ success: false, error: { code: 'UNAUTHORIZED', message: '만료' } }, { status: 401 });
    },
  });

  await assert.rejects(client.request('/users/me'), { code: 'INVALID_REFRESH_TOKEN' });
  assert.equal(session.getSnapshot().accessToken, null);
  assert.equal(originalCalls, 1);
});

test('an account change while refresh is pending discards the stale refresh and replay', async () => {
  const session = signedIn();
  let resolveRefresh;
  const pendingRefresh = new Promise((resolve) => { resolveRefresh = resolve; });
  let originalCalls = 0;
  const client = createApiClient({
    session,
    fetchImpl: async (url) => {
      if (url === '/api/auth/token/refresh') return pendingRefresh;
      originalCalls += 1;
      return json({ success: false, error: { code: 'UNAUTHORIZED', message: '만료' } }, { status: 401 });
    },
  });

  const request = client.request('/users/me');
  await new Promise((resolve) => setImmediate(resolve));
  session.setSession({
    accessToken: 'other-access',
    refreshToken: 'other-refresh',
    userId: 99,
    nickname: '다른 사용자',
  });
  resolveRefresh(json({
    success: true,
    data: { accessToken: 'stale-access', refreshToken: 'stale-refresh', userId: 7, nickname: '빵순이' },
  }));

  await assert.rejects(request, { code: 'SESSION_CHANGED' });
  assert.equal(session.getSnapshot().accessToken, 'other-access');
  assert.equal(originalCalls, 1);
});

test('a response that finishes after an account change is discarded', async () => {
  const session = signedIn();
  let resolveRequest;
  const pending = new Promise((resolve) => { resolveRequest = resolve; });
  const client = createApiClient({ session, fetchImpl: async () => pending });

  const request = client.request('/users/me');
  session.clear();
  resolveRequest(json({ success: true, data: { userId: 7 } }));

  await assert.rejects(request, { code: 'SESSION_CHANGED' });
});

test('passes AbortSignal through and classifies cancellation separately from network failure', async () => {
  const controller = new AbortController();
  const client = createApiClient({
    session: createSessionStore({ storage: null }),
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }),
  });

  const request = client.request('/breads', { auth: false, signal: controller.signal });
  controller.abort();

  await assert.rejects(
    request,
    (error) => error instanceof ApiClientError
      && error.kind === 'aborted'
      && error.code === 'REQUEST_ABORTED',
  );
});

test('a delayed old-token 401 reuses an already completed refresh instead of refreshing twice', async () => {
  const session = signedIn();
  let refreshCalls = 0;
  let releaseDelayed401;
  const delayed401 = new Promise((resolve) => { releaseDelayed401 = resolve; });
  const attempts = new Map();
  const client = createApiClient({
    session,
    fetchImpl: async (url, init) => {
      if (url === '/api/auth/token/refresh') {
        refreshCalls += 1;
        return json({
          success: true,
          data: { accessToken: 'new-access', refreshToken: 'new-refresh', userId: 7, nickname: '빵순이' },
        });
      }
      const count = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, count);
      if (url === '/api/slow' && count === 1) return delayed401;
      if (count === 1) {
        return json({ success: false, error: { code: 'UNAUTHORIZED', message: '만료' } }, { status: 401 });
      }
      assert.equal(init.headers.get('authorization'), 'Bearer new-access');
      return json({ success: true, data: url });
    },
  });

  const slow = client.request('/slow');
  assert.equal(await client.request('/fast'), '/api/fast');
  releaseDelayed401(json(
    { success: false, error: { code: 'UNAUTHORIZED', message: '늦은 만료 응답' } },
    { status: 401 },
  ));

  assert.equal(await slow, '/api/slow');
  assert.equal(refreshCalls, 1);
});

test('logout while an authenticated response body is being parsed discards that response', async () => {
  const session = signedIn();
  let releaseBody;
  const body = new Promise((resolve) => { releaseBody = resolve; });
  const client = createApiClient({
    session,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: () => body,
    }),
  });

  const request = client.request('/users/me');
  await new Promise((resolve) => setImmediate(resolve));
  session.clear();
  releaseBody(JSON.stringify({ success: true, data: { userId: 7, nickname: '옛 사용자' } }));

  await assert.rejects(request, { code: 'SESSION_CHANGED' });
});

test('a replayed 401 clears the refreshed session instead of leaving it authenticated', async () => {
  const session = signedIn();
  let protectedCalls = 0;
  const client = createApiClient({
    session,
    fetchImpl: async (url) => {
      if (url === '/api/auth/token/refresh') {
        return json({
          success: true,
          data: { accessToken: 'new-access', refreshToken: 'new-refresh', userId: 7, nickname: '빵순이' },
        });
      }
      protectedCalls += 1;
      return json({ success: false, error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' } }, { status: 401 });
    },
  });

  await assert.rejects(client.request('/users/me'), { code: 'UNAUTHORIZED' });
  assert.equal(protectedCalls, 2);
  assert.equal(session.getSnapshot().accessToken, null);
});

test('an account change while a refresh error body is being parsed suppresses the stale error', async () => {
  const session = signedIn();
  let releaseRefreshBody;
  const refreshBody = new Promise((resolve) => { releaseRefreshBody = resolve; });
  const client = createApiClient({
    session,
    fetchImpl: async (url) => {
      if (url === '/api/auth/token/refresh') {
        return { ok: false, status: 401, text: () => refreshBody };
      }
      return json({ success: false, error: { code: 'UNAUTHORIZED', message: '만료' } }, { status: 401 });
    },
  });

  const request = client.request('/users/me');
  await new Promise((resolve) => setImmediate(resolve));
  session.setSession({
    accessToken: 'other-access',
    refreshToken: 'other-refresh',
    userId: 99,
    nickname: '다른 사용자',
  });
  releaseRefreshBody(JSON.stringify({
    success: false,
    error: { code: 'INVALID_REFRESH_TOKEN', message: '옛 계정 토큰 만료' },
  }));

  await assert.rejects(request, { code: 'SESSION_CHANGED' });
  assert.equal(session.getSnapshot().accessToken, 'other-access');
});

test('an old-token 200 remains valid when another request refreshes the same account', async () => {
  const session = signedIn();
  let releaseOldTokenResponse;
  const oldTokenResponse = new Promise((resolve) => { releaseOldTokenResponse = resolve; });
  let protectedCalls = 0;
  let refreshCalls = 0;
  const client = createApiClient({
    session,
    fetchImpl: async (url) => {
      if (url === '/api/old-token-success') return oldTokenResponse;
      if (url === '/api/auth/token/refresh') {
        refreshCalls += 1;
        return json({
          success: true,
          data: { accessToken: 'new-access', refreshToken: 'new-refresh', userId: 7, nickname: '빵순이' },
        });
      }
      protectedCalls += 1;
      if (protectedCalls === 1) {
        return json({ success: false, error: { code: 'UNAUTHORIZED', message: '만료' } }, { status: 401 });
      }
      return json({ success: true, data: { refreshed: true } });
    },
  });

  const oldSuccess = client.request('/old-token-success');
  assert.deepEqual(await client.request('/needs-refresh'), { refreshed: true });
  releaseOldTokenResponse(json({ success: true, data: { fromOldToken: true } }));

  assert.deepEqual(await oldSuccess, { fromOldToken: true });
  assert.equal(refreshCalls, 1);
  assert.equal(session.getSnapshot().accountGeneration, 1);
});

test('a delayed login is discarded after session replacement while public catalog remains independent', async () => {
  const session = createSessionStore({ storage: null });
  let releaseLogin;
  let releaseCatalog;
  const loginResponse = new Promise((resolve) => { releaseLogin = resolve; });
  const catalogResponse = new Promise((resolve) => { releaseCatalog = resolve; });
  const client = createApiClient({
    session,
    fetchImpl: async (url) => url === '/api/auth/login' ? loginResponse : catalogResponse,
  });
  const api = createEndpoints(client);

  const login = api.login({ email: 'old@example.com', password: 'password1' });
  const catalog = api.catalog();
  const loginRejected = assert.rejects(login, { code: 'SESSION_CHANGED' });
  session.setSession({
    accessToken: 'other-access',
    refreshToken: 'other-refresh',
    userId: 99,
    nickname: '다른 사용자',
  });
  releaseLogin(json({
    success: true,
    data: { accessToken: 'stale-access', refreshToken: 'stale-refresh', userId: 7, nickname: '옛 사용자' },
  }));
  releaseCatalog(json({ success: true, data: [{ id: 101, name: '소금빵', tags: [] }] }));

  await loginRejected;
  assert.deepEqual(await catalog, [{ id: 101, name: '소금빵', tags: [] }]);
});
