import { normalizeScreen } from '../design-model.mjs';

const idKeys = ['bakeryId', 'recommendationResultId', 'recommendationId'];
const privatePages = new Set(['result', 'review', 'ranking', 'mypage', 'my-info', 'my-reviews', 'recommendation-history']);
const positiveId = (value) => /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
export const requiresAuth = (page) => privatePages.has(page);

export function recommendationFailureRoute(currentPage, isAuthenticated) {
  return currentPage === 'selection' && !isAuthenticated
    ? { page: 'login', returnTo: '?screen=selection' } : null;
}

export function readRoute(search = '') {
  const query = new URLSearchParams(search);
  return {
    page: normalizeScreen(query.get('screen') || 'home'),
    ...Object.fromEntries(idKeys.map((key) => [key, positiveId(query.get(key))])),
    returnTo: query.get('returnTo'),
    notice: query.get('notice') === 'signup' ? 'signup' : null,
  };
}

export function routeSearch(page, options = {}) {
  const query = new URLSearchParams({ screen: normalizeScreen(page) });
  for (const key of idKeys) if (positiveId(options[key])) query.set(key, options[key]);
  if (options.returnTo) {
    const intent = loginReturn(options.returnTo);
    query.set('returnTo', routeSearch(intent.page, intent));
  }
  if (options.notice === 'signup') query.set('notice', 'signup');
  return `?${query}`;
}

export function loginReturn(value) {
  if (typeof value !== 'string' || !value.startsWith('?') || value.includes('#')) return { page: 'selection' };
  const route = readRoute(value);
  if (['login', 'signup'].includes(route.page)) return { page: 'selection' };
  return { ...route, returnTo: null, notice: null };
}
