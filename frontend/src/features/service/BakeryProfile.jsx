import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ApiState } from '@/components/ApiState';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../../lib/api/useApiQuery';
import { mapBakeryProfile } from '../../lib/api/adapters.mjs';
import { breadCatalog } from '../tray/tray-data';
import { BreadPhoto } from '../tray/TrayArt';

const TAGS_PER_BREAD = 3;

// Profile aggregates come from the batch-computed score table, so they don't change while
// someone flips between their three bags — keep each one after the first load instead of
// refetching (and flashing the loading line) every time a bag is revisited.
const profileCache = new Map();

export function useBakeryProfile(bakeryId, enabled = true) {
  const { api } = useAuth();
  const cached = bakeryId ? profileCache.get(bakeryId) : undefined;
  const query = useApiQuery(`bakery-profile:${bakeryId}`, async (options) => mapBakeryProfile(await api.bakeryProfile(bakeryId, options)), { enabled: Boolean(bakeryId) && enabled && !cached, private: false });
  useEffect(() => {
    if (query.status === 'success' && query.data) profileCache.set(bakeryId, query.data);
  }, [bakeryId, query.status, query.data]);
  return cached ? { status: 'success', data: cached, error: null, reload: query.reload } : query;
}

// The lower half of the result card: how this bakery is rated per bread, from
// aggregated review tags only (no individual reviews), plus breads outside the
// eight that reviewers typed in themselves.
export function BakeryProfileSections({ profile }) {
  if (profile.status === 'loading' || profile.status === 'idle') {
    return <section className="profile-section" aria-busy="true"><h3>이 빵집의 빵</h3><p className="profile-muted">리뷰 집계를 불러오는 중…</p></section>;
  }
  if (profile.status === 'error') {
    return <section className="profile-section"><h3>이 빵집의 빵</h3><ApiState status="error" error={profile.error} onRetry={profile.reload} /></section>;
  }
  const { breads, otherBreads } = profile.data;
  const visualOf = (name) => breadCatalog.find((visual) => visual.label === name)?.id ?? null;
  return <>
    <section className="profile-section" aria-labelledby="profile-breads-title">
      <h3 id="profile-breads-title">이 빵집의 빵 <small>리뷰에서 가장 많이 찍힌 특징</small></h3>
      {breads.length ? <ul className="profile-breads">
        {breads.map((bread) => <li key={bread.breadId} className={bread.representative ? 'is-representative' : ''}>
          <div className="profile-bread-photo"><BreadPhoto visualKey={visualOf(bread.name)} /></div>
          <div className="profile-bread-body">
            <div className="profile-bread-head"><strong>{bread.name}</strong>{bread.representative ? <Badge active>대표</Badge> : null}<span>후기 {bread.reviewCount}건</span></div>
            <p className="profile-bread-tags">{bread.tags.length ? bread.tags.slice(0, TAGS_PER_BREAD).map((tag) => <span key={tag.name}>#{tag.name}</span>) : <span className="profile-muted">아직 찍힌 특징이 없어요</span>}</p>
          </div>
        </li>)}
      </ul> : <p className="profile-muted">아직 이 빵집의 8종 빵 리뷰가 없어요. 첫 리뷰를 남겨주세요.</p>}
    </section>
    {otherBreads.length ? <section className="profile-section" aria-labelledby="profile-others-title">
      <h3 id="profile-others-title">다른 빵도 있어요 <small>리뷰에 적힌 목록 외 빵</small></h3>
      <ul className="profile-others">{otherBreads.map((item) => <li key={item.name}>{item.name}<small>{item.count}</small></li>)}</ul>
    </section> : null}
  </>;
}
