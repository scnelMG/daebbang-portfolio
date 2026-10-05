import { useCallback, useEffect, useRef, useState } from 'react';
import TrayPage from './features/tray/TrayPage';
import { createTrayState } from './features/tray/tray-model.mjs';
import { breadCatalog as visualCatalog } from './features/tray/tray-data';
import { HomePage } from './features/home/HomePage';
import { AuthPage } from './features/service/AuthPage';
import { ResultPage } from './features/service/ResultPage';
import { FaqPage } from './features/account/FaqPage';
import { ReviewPage } from './features/service/ReviewPage';
import { RankingPage } from './features/service/RankingPage';
import { MyPage } from './features/account/MyPage';
import { MyInfoPage } from './features/account/MyInfoPage';
import { MyReviewsPage } from './features/account/MyReviewsPage';
import { RecommendationHistoryPage } from './features/account/RecommendationHistoryPage';
import { AuthProvider, useAuth } from './features/auth/AuthProvider';
import { readRoute, routeSearch, requiresAuth, recommendationFailureRoute } from './lib/routes.mjs';
import { useApiQuery } from './lib/api/useApiQuery';
import { mapBreadCatalog, mapRecommendation } from './lib/api/adapters.mjs';
import { recommendationTray } from './lib/api/flows.mjs';

const labels = { home: '홈', login: '로그인', signup: '회원가입', selection: '빵 담기', result: '추천 결과', review: '리뷰 쓰기', ranking: '리뷰 랭킹', mypage: '마이페이지', 'my-info': '내 정보', 'my-reviews': '내가 쓴 리뷰', 'recommendation-history': '추천받은 빵집', faq: '자주 묻는 질문' };

function AppContent() {
  const { session, auth, isAuthenticated, api, resultMemory } = useAuth();
  const [route, setRoute] = useState(() => readRoute(window.location.search));
  const [tray, setTray] = useState(createTrayState);
  const [recommendState, setRecommendState] = useState({ pending: false, error: null, owner: auth.accountGeneration });
  const request = useRef(null);
  const catalog = useApiQuery('catalog', async (options) => mapBreadCatalog(await api.catalog(options), visualCatalog), { private: false });
  const navigate = useCallback((page, options = {}, replace = false) => {
    const search = routeSearch(page, options);
    window.history[replace ? 'replaceState' : 'pushState']({}, '', `${window.location.pathname}${search}`);
    setRoute(readRoute(search));
    window.scrollTo(0, 0);
  }, []);
  const go = useCallback((page, options = {}) => {
    if (requiresAuth(page) && !session.getSnapshot().accessToken) {
      navigate('login', { returnTo: routeSearch(page, options) });
    } else navigate(page, options);
  }, [navigate, session]);
  useEffect(() => {
    const onPop = () => { setRoute(readRoute(window.location.search)); window.scrollTo(0, 0); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => { document.title = `대빵 · ${labels[route.page]}`; }, [route.page]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('screen') === 'saved') navigate('home', {}, true);
  }, [route, navigate]);
  useEffect(() => {
    if (requiresAuth(route.page) && !isAuthenticated) navigate('login', { returnTo: routeSearch(route.page, route) }, true);
  }, [route, isAuthenticated, navigate]);

  const requestRecommendation = async () => {
    const owner = session.getSnapshot().accountGeneration;
    if (request.current?.owner === owner || catalog.status !== 'success') return;
    let selection;
    try { selection = recommendationTray(tray, catalog.data); }
    catch (error) { setRecommendState({ pending: false, error, owner }); return; }
    if (!session.getSnapshot().accessToken) { go('login', { returnTo: '?screen=selection' }); return; }
    const token = { owner };
    request.current = token;
    setRecommendState({ pending: true, error: null, owner });
    try {
      const result = mapRecommendation(await api.recommend(selection));
      if (resultMemory.put(result, owner)) go('result', { recommendationId: result.recommendationId });
    } catch (error) {
      const current = session.getSnapshot();
      if (current.accountGeneration === owner) setRecommendState({ pending: false, error, owner });
      const returnRoute = recommendationFailureRoute(readRoute(window.location.search).page, Boolean(current.accessToken));
      if (returnRoute) go(returnRoute.page, returnRoute);
    } finally {
      if (request.current === token) request.current = null;
      setRecommendState((current) => current.owner === owner ? { ...current, pending: false } : current);
    }
  };

  if (requiresAuth(route.page) && !isAuthenticated) return <AuthPage go={go} returnTo={routeSearch(route.page, route)} />;
  const mutation = recommendState.owner === auth.accountGeneration ? recommendState : { pending: false, error: null };
  switch (route.page) {
    case 'login': return <AuthPage key="login" go={go} returnTo={route.returnTo} notice={route.notice} />;
    case 'signup': return <AuthPage key="signup" go={go} signup returnTo={route.returnTo} />;
    case 'selection': return <TrayPage go={go} tray={tray} setTray={setTray} onRecommend={requestRecommendation} catalog={catalog} recommendation={mutation} />;
    case 'result': return <ResultPage key={`${auth.accountGeneration}:${route.recommendationId}`} go={go} recommendationId={route.recommendationId} />;
    case 'review': return <ReviewPage key={`${auth.accountGeneration}:${route.bakeryId}:${route.recommendationResultId}:${route.recommendationId}`} go={go} bakeryId={route.bakeryId} recommendationResultId={route.recommendationResultId} recommendationId={route.recommendationId} catalog={catalog} />;
    case 'ranking': return <RankingPage key={auth.accountGeneration} go={go} />;
    case 'mypage': return <MyPage key={auth.accountGeneration} go={go} />;
    case 'my-info': return <MyInfoPage key={auth.accountGeneration} go={go} />;
    case 'my-reviews': return <MyReviewsPage key={auth.accountGeneration} go={go} />;
    case 'recommendation-history': return <RecommendationHistoryPage key={auth.accountGeneration} go={go} />;
    case 'faq': return <FaqPage go={go} />;
    case 'home': return <HomePage go={go} />;
    default: return <HomePage go={go} />;
  }
}

export default function App() { return <AuthProvider><AppContent /></AuthProvider>; }
