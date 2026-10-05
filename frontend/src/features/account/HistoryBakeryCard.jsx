import { Button } from '@/components/ui/button';
import { BakeryPhoto } from '@/components/BakeryPhoto';
import { mapLinkLabel } from '../../lib/api/adapters.mjs';

// History contains current bakery details, not the original score or saved state.
export function HistoryBakeryCard({ store, recommendationId, go, headingAs: Heading = 'h3' }) {
  const name = store.bakeryName || '빵집 정보 없음';
  const mapLabel = mapLinkLabel(store.mapUrl);
  return <article className="history-store">
    <BakeryPhoto src={store.imageUrl} alt={`${name} 매장 사진`} />
    <div className="history-store-info">
      <span>추천 {store.rank}</span>
      <Heading>{name}</Heading>
      {store.district ? <p>{store.district}</p> : null}
    </div>
    <div className="history-store-actions">
      {mapLabel ? <Button asChild variant="outline" size="sm">
        <a href={store.mapUrl} target="_blank" rel="noopener noreferrer" aria-label={`${name} ${mapLabel} · 새 탭`}>{mapLabel}</a>
      </Button> : <Button variant="outline" size="sm" disabled>지도 링크가 없어요</Button>}
      <Button variant="outline" size="sm" aria-label={`${name} 리뷰 쓰기`}
        onClick={() => go('review', { bakeryId: store.bakeryId, recommendationResultId: store.recommendationResultId, recommendationId })}>리뷰 쓰기</Button>
    </div>
  </article>;
}
