export class ApiClientError extends Error {
  constructor(message, { kind, code, status = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ApiClientError';
    this.kind = kind ?? 'unknown';
    this.code = code ?? 'UNKNOWN_ERROR';
    this.status = status;
  }
}

function staleSessionError() {
  return new ApiClientError('The authenticated session changed while the request was in progress.', {
    kind: 'auth',
    code: 'SESSION_CHANGED',
  });
}

function requestAbortedError(cause) {
  return new ApiClientError('The request was cancelled.', {
    kind: 'aborted',
    code: 'REQUEST_ABORTED',
    cause,
  });
}

function joinUrl(baseUrl, path) {
  return `${String(baseUrl).replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
}

async function parseEnvelope(response) {
  let envelope;
  try {
    const text = await response.text();
    envelope = JSON.parse(text);
  } catch (cause) {
    throw new ApiClientError('The server returned a response that was not valid JSON.', {
      kind: 'protocol',
      code: 'INVALID_JSON_RESPONSE',
      status: response.status,
      cause,
    });
  }

  if (!envelope || typeof envelope !== 'object' || typeof envelope.success !== 'boolean') {
    throw new ApiClientError('The server returned an invalid API envelope.', {
      kind: 'protocol',
      code: 'INVALID_API_ENVELOPE',
      status: response.status,
    });
  }

  if (!envelope.success) {
    throw new ApiClientError(
      typeof envelope.error?.message === 'string' ? envelope.error.message : 'The API request failed.',
      {
        kind: 'api',
        code: typeof envelope.error?.code === 'string' ? envelope.error.code : 'API_ERROR',
        status: response.status,
      },
    );
  }

  if (!response.ok) {
    throw new ApiClientError(`The server returned HTTP ${response.status}.`, {
      kind: 'http',
      code: `HTTP_${response.status}`,
      status: response.status,
    });
  }

  return Object.hasOwn(envelope, 'data') ? envelope.data : null;
}

function transportError(error) {
  if (error instanceof ApiClientError) return error;
  if (error?.name === 'AbortError') return requestAbortedError(error);
  return new ApiClientError('The server could not be reached.', {
    kind: 'network',
    code: 'NETWORK_ERROR',
    cause: error,
  });
}

export function createApiClient({ session, fetchImpl = globalThis.fetch, baseUrl = '/api' }) {
  if (!session?.getSnapshot || !session?.setSession || !session?.clear) {
    throw new TypeError('createApiClient requires a session store.');
  }
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('createApiClient requires a fetch implementation.');
  }

  let refreshFlight = null;
  let lastRefresh = null;

  const send = async (path, options, snapshot) => {
    const headers = new Headers(options.headers);
    if (options.auth && snapshot?.accessToken) {
      headers.set('authorization', `Bearer ${snapshot.accessToken}`);
    }
    if (options.body !== undefined) headers.set('content-type', 'application/json');

    try {
      return await fetchImpl(joinUrl(baseUrl, path), {
        method: options.method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });
    } catch (error) {
      throw transportError(error);
    }
  };

  const performRefresh = (snapshot) => {
    if (refreshFlight?.generation === snapshot.generation) return refreshFlight.promise;

    const flight = { generation: snapshot.generation, promise: null };
    flight.promise = (async () => {
      try {
        const response = await send('/auth/token/refresh', {
          method: 'POST',
          body: { refreshToken: snapshot.refreshToken },
          auth: false,
        });
        if (session.getSnapshot().generation !== snapshot.generation) {
          throw staleSessionError();
        }
        const data = await parseEnvelope(response);
        if (session.getSnapshot().generation !== snapshot.generation) {
          throw staleSessionError();
        }
        const next = typeof session.rotateTokens === 'function'
          ? session.rotateTokens(data, snapshot.generation)
          : session.setSession(data);
        lastRefresh = { from: snapshot.generation, to: next.generation };
        return next;
      } catch (error) {
        if (session.getSnapshot().generation !== snapshot.generation) {
          throw staleSessionError();
        }
        const normalized = transportError(error);
        if (normalized.code !== 'SESSION_CHANGED'
          && session.getSnapshot().generation === snapshot.generation) {
          session.clear();
        }
        throw normalized;
      } finally {
        if (refreshFlight === flight) refreshFlight = null;
      }
    })();
    refreshFlight = flight;
    return flight.promise;
  };

  const parseOwnedResponse = async (response, owner, { clearOnUnauthorized = false } = {}) => {
    try {
      const data = await parseEnvelope(response);
      if (session.getSnapshot().accountGeneration !== owner.accountGeneration) {
        throw staleSessionError();
      }
      return data;
    } catch (error) {
      const current = session.getSnapshot();
      if (current.accountGeneration !== owner.accountGeneration) throw staleSessionError();
      if (clearOnUnauthorized && response.status === 401
        && current.generation === owner.generation) {
        session.clear();
      }
      throw error;
    }
  };

  return {
    async request(path, {
      method = 'GET',
      body,
      headers,
      signal,
      auth = true,
      refresh = true,
      sessionGuard = false,
    } = {}) {
      const normalizedMethod = String(method).toUpperCase();
      const start = auth || sessionGuard ? session.getSnapshot() : null;
      const options = { method: normalizedMethod, body, headers, signal, auth };
      const response = await send(path, options, start);

      if (!auth) {
        return sessionGuard ? parseOwnedResponse(response, start) : parseEnvelope(response);
      }

      const current = session.getSnapshot();
      if (response.status === 401 && refresh && start?.refreshToken) {
        let refreshed;
        if (current.generation === start.generation) {
          refreshed = await performRefresh(start);
        } else if (lastRefresh?.from === start.generation && lastRefresh.to === current.generation) {
          refreshed = current;
        } else {
          throw staleSessionError();
        }
        if (signal?.aborted) throw requestAbortedError(signal.reason);
        const replay = await send(path, options, refreshed);
        if (session.getSnapshot().accountGeneration !== refreshed.accountGeneration) {
          throw staleSessionError();
        }
        return parseOwnedResponse(replay, refreshed, { clearOnUnauthorized: true });
      }

      if (current.accountGeneration !== start.accountGeneration) throw staleSessionError();
      return parseOwnedResponse(response, start);
    },
  };
}
