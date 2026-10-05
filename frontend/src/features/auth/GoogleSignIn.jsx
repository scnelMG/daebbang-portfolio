import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { resolveGoogleClientId } from '@/config/public-config.mjs';

let sdkPromise;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => fail(), 15000);
    const fail = () => { window.clearTimeout(timer); script.remove(); sdkPromise = null; reject(new Error('Google 로그인 도구를 불러오지 못했어요.')); };
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onerror = fail;
    script.onload = () => { window.clearTimeout(timer); if (window.google?.accounts?.id) resolve(window.google.accounts.id); else fail(); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export function GoogleSignIn({ onCredential, disabled }) {
  const clientId = resolveGoogleClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const target = useRef(null);
  const callback = useRef(onCredential);
  callback.current = onCredential;
  const blocked = useRef(disabled);
  blocked.current = disabled;
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!clientId) return;
    let live = true;
    let observer;
    let renderedWidth = 0;
    setError('');
    loadGoogle().then((google) => {
      if (!live || !target.current) return;
      const container = target.current;
      google.initialize({ client_id: clientId, callback: ({ credential }) => {
        if (live && !blocked.current && credential) callback.current(credential);
      } });
      const render = () => {
        if (!live) return;
        const width = Math.min(400, Math.floor(container.getBoundingClientRect().width));
        if (width < 1 || width === renderedWidth) return;
        renderedWidth = width;
        container.replaceChildren();
        google.renderButton(container, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', locale: 'ko', width: String(width) });
      };
      observer = new ResizeObserver(render);
      observer.observe(container);
      render();
    }).catch((reason) => { if (live) setError(reason.message); });
    return () => {
      live = false;
      observer?.disconnect();
      target.current?.replaceChildren();
    };
  }, [clientId, attempt]);
  if (!clientId) return null;
  return <div className="google-signin">
    <div ref={target} inert={disabled} aria-label="Google 로그인" />
    {error ? <><p role="alert">{error}</p><Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>Google 로그인 다시 불러오기</Button></> : null}
  </div>;
}
