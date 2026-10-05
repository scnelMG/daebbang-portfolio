import { Button } from '@/components/ui/button';
import { SiteShell } from './SiteShell';
import { RecommendationBags } from './RecommendationBags';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../../lib/api/useApiQuery';
import { mapRecommendationHistory } from '../../lib/api/adapters.mjs';
import { displayTagLabel } from '../../lib/tag-labels.mjs';
import { ApiState } from '../../components/ApiState';
import { HistoryBakeryCard } from '../account/HistoryBakeryCard';

export function ResultPage({ go, recommendationId }) {
  const { api, resultMemory } = useAuth();
  const initial = resultMemory.get(recommendationId);
  const history = useApiQuery(`result-history:${recommendationId}`, async (options) => mapRecommendationHistory(await api.history(options)), { enabled: Boolean(recommendationId) && !initial });
  const record = history.data?.find((item) => item.recommendationId === recommendationId);
  if (initial) return <RecommendationBags key={initial.recommendationId} go={go} recommendation={initial} />;
  return <SiteShell active="result" go={go}><main id="main-content" className="page-main">
    {!recommendationId ? <ApiState title="추천 결과를 확인할 수 없어요" description="유효한 추천 번호가 필요해요."><Button onClick={() => go('selection')}>빵 담으러 가기</Button></ApiState>
      : history.status !== 'success' ? <ApiState status={history.status} error={history.error} onRetry={history.status === 'error' ? history.reload : undefined} />
      : !record ? <ApiState title="추천 결과를 찾을 수 없어요" description="현재 계정의 추천 이력에 없는 번호예요."><Button onClick={() => go('selection')}>빵 담으러 가기</Button></ApiState>
      : <section className="limited-history"><header className="page-heading"><h1>추천 이력</h1><p>추천 당시 선택한 빵과 취향, 현재 등록된 빵집 사진과 지도 정보를 확인해보세요.</p><time dateTime={record.createdAt}>{record.createdAt.replace('T', ' ').slice(0, 16)}</time></header>
        <div className="recommendation-breads">{record.tray.map((bread, index) => <p key={`${bread.bread}:${index}`}><strong>{bread.bread}</strong> · {bread.tags.map(displayTagLabel).join(' · ')}</p>)}</div>
        {record.results.length ? record.results.map((store) => <HistoryBakeryCard key={store.recommendationResultId} store={store} recommendationId={recommendationId} go={go} headingAs="h2" />) : <ApiState title="추천된 빵집이 없었어요" description="다른 빵과 취향으로 다시 추천받을 수 있어요." />}
        <Button variant="outline" onClick={() => go('selection')}>빵 담으러 가기</Button>
      </section>}
  </main></SiteShell>;
}
