import { createContext, useContext, useMemo, useState, useSyncExternalStore } from 'react';
import { createSessionStore } from '../../lib/api/session.mjs';
import { createApiClient } from '../../lib/api/client.mjs';
import { createEndpoints } from '../../lib/api/endpoints.mjs';
import { createResultMemory, signIn, signOut } from '../../lib/api/flows.mjs';
import { createBookmarkStore } from '../../lib/api/bookmarks.mjs';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [services] = useState(() => {
    const session = createSessionStore();
    const api = createEndpoints(createApiClient({ session }));
    const resultMemory = createResultMemory(session);
    return {
      session, api, resultMemory, bookmarks: createBookmarkStore(session, api, resultMemory),
      login: (dto, options) => signIn(api.login, session, dto, options),
      google: (dto, options) => signIn(api.google, session, dto, options),
      logout: () => signOut(api, session),
    };
  });
  const auth = useSyncExternalStore(services.session.subscribe, services.session.getSnapshot);
  const value = useMemo(() => ({ ...services, auth, isAuthenticated: Boolean(auth.accessToken) }), [services, auth]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required.');
  return value;
}
