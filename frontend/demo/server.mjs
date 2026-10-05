import { createServer } from 'vite';
import { catalog, stores, resultFor, profileFor } from './fixtures.mjs';

// Local UI preview only. No database, real authentication, external API, or persistence.
const token = 'local-preview-only';
let history = [];
const envelope = (data) => ({ success: true, data });
const server = await createServer({
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  plugins: [{ name: 'local-portfolio-preview', configureServer(vite) {
    vite.middlewares.use('/api', async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      const send = (data) => res.end(JSON.stringify(envelope(data)));
      const fail = (status, message) => { res.statusCode = status; res.end(JSON.stringify({ success: false, error: { code: 'PREVIEW_ONLY', message } })); };
      const path = new URL(req.url, 'http://localhost').pathname;
      try {
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 16384) return fail(413, 'Request too large'); }
        const input = body ? JSON.parse(body) : {};
        if (req.method === 'GET' && path === '/breads') return send(catalog);
        if (req.method === 'GET' && path === '/bakeries/home') return send(stores);
        if (req.method === 'GET' && /^\/bakeries\/\d+\/profile$/.test(path)) return send(profileFor(Number(path.split('/')[2])));
        if (req.method === 'GET' && /^\/bakeries\/\d+$/.test(path)) return send(stores.find(s => s.id === Number(path.split('/')[2])) ?? stores[0]);
        if (req.method === 'POST' && path === '/auth/login') {
          if (input.email !== 'demo@example.test' || input.password !== 'portfolio-demo') return fail(401, '로컬 미리보기 계정: demo@example.test / portfolio-demo');
          return send({ accessToken: token, refreshToken: token, userId: 1, nickname: '빵을 담는 사람' });
        }
        if (req.headers.authorization !== `Bearer ${token}`) return fail(401, '샘플 계정으로 로그인해주세요.');
        if (req.method === 'POST' && path === '/auth/logout') return send(null);
        if (req.method === 'GET' && path === '/users/me') return send({ id: 1, userId: 1, nickname: '빵을 담는 사람', provider: 'local' });
        if (req.method === 'GET' && path === '/users/me/recommendations') return send(history);
        if (req.method === 'GET' && path === '/users/me/reviews') return send([]);
        if (req.method === 'GET' && path === '/users/me/bookmarks') return send([]);
        if (req.method === 'POST' && path === '/recommendations') {
          const result = resultFor(input.tray);
          history = [{ ...result, createdAt: '2026-10-05T12:00:00', tray: input.tray.map(b => ({ bread: catalog.find(c => c.id === b.breadId).name, tags: b.tagIds.map(id => catalog.flatMap(c => c.tags).find(t => t.id === id).name) })) }];
          return send(result);
        }
        return fail(404, '이 동작은 화면 미리보기에서 제공하지 않습니다.');
      } catch { return fail(400, '미리보기 입력을 확인해주세요.'); }
    });
  }, transformIndexHtml(html) {
    return html.replace('<body>', '<body><aside style="padding:7px 16px;text-align:center;background:#4f2919;color:#fff7ec;font:12px/1.5 sans-serif">포트폴리오 미리보기 · 가상 매장·샘플 데이터 · 실제 추천 결과가 아닙니다</aside>');
  } }],
});
await server.listen();
console.log('Local preview: http://127.0.0.1:5173 — demo@example.test / portfolio-demo');
