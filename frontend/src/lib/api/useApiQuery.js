import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../features/auth/AuthProvider';
import { queryView } from './flows.mjs';

// Callers include every resource/filter ID in key. Loader identity is not a key.
export function useApiQuery(key, load, { enabled = true, private: isPrivate = true } = {}) {
  const { auth, session } = useAuth();
  const [revision, setRevision] = useState(0);
  const fullKey = JSON.stringify([isPrivate ? auth.accountGeneration : 'public', key, revision]);
  const active = enabled && (!isPrivate || Boolean(auth.accessToken));
  const loader = useRef(load);
  loader.current = load;
  const [state, setState] = useState({ key: null, status: 'idle', data: null, error: null });
  useEffect(() => {
    if (!active) return undefined;
    const controller = new AbortController();
    const execute = loader.current;
    const owner = session.getSnapshot().accountGeneration;
    let live = true;
    const current = () => live && (!isPrivate || session.getSnapshot().accountGeneration === owner);
    setState({ key: fullKey, status: 'loading', data: null, error: null });
    Promise.resolve().then(() => execute({ signal: controller.signal })).then(
      (data) => { if (current()) setState({ key: fullKey, status: 'success', data, error: null }); },
      (error) => { if (current()) setState({ key: fullKey, status: 'error', data: null, error }); },
    );
    return () => { live = false; controller.abort(); };
  }, [fullKey, active, isPrivate, session]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { ...queryView(state, fullKey, active), reload };
}
