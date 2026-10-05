import { useEffect, useReducer, useRef } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ApiState } from '@/components/ApiState';
import { BakeryPhoto } from '@/components/BakeryPhoto';
import { SiteShell } from './SiteShell';
import { BagArtwork } from './BagArtwork';
import { createBagState, transitionBags } from './bag-state.mjs';
import { bagLabelFor } from './bag-label.mjs';
import { BakeryProfileSections, useBakeryProfile } from './BakeryProfile';
import { mapLinkLabel } from '../../lib/api/adapters.mjs';
import './recommendation-bags.css';

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const STAGE_MS = { shaking: 520, revealing: 900 };

// The small card that lives in the bag's mouth: it rises while the bag opens for the first time.
function BagCard({ item, stage }) {
  return <div className="bag-card" data-state={stage} aria-hidden="true">
    <div className="bag-card-photo"><BakeryPhoto src={item.imageUrl} alt="" /></div>
    <strong className="bag-card-name">{item.bakeryName}</strong>
  </div>;
}

// The card once it is out of the bag: the ticket with everything about the bakery.
function ProfileCard({ item, position, stage, animate, headingRef, profile, go, recommendationId }) {
  const label = bagLabelFor(item);
  return <article className="profile-card" data-state={stage} data-animate={animate || undefined} aria-labelledby="profile-card-title" inert={stage !== 'open'} aria-hidden={stage !== 'open'}>
    <div className="profile-card-photo"><BakeryPhoto src={item.imageUrl} alt={`${item.bakeryName} 매장`} /></div>
    <div className="profile-card-body">
      <div className="profile-topline"><Badge active>{item.pickType === 'random' ? '오늘의 발견' : `추천 ${position + 1}`}</Badge>{label.features.length ? <p className="profile-hashtags">{label.features.map((feature) => <span key={feature}>#{feature}</span>)}</p> : null}</div>
      <h2 id="profile-card-title" className="profile-card-title" ref={headingRef} tabIndex={-1}>{item.bakeryName}</h2>
      <p className="profile-place">{item.district ? `대전 ${item.district}` : '대전'}</p>
      <div className="profile-actions">
        {item.mapUrl ? <Button asChild><a href={item.mapUrl} target="_blank" rel="noreferrer">{mapLinkLabel(item.mapUrl)}<ExternalLink data-icon="inline-end" /></a></Button> : <Button disabled>지도 링크가 없어요</Button>}
        <Button variant="outline" onClick={() => go('review', { bakeryId: item.bakeryId, recommendationResultId: item.recommendationResultId, recommendationId })}>리뷰 쓰러가기</Button>
      </div>
      <p className="ticket-note">빵의 판매·재고는 방문 전 확인해주세요.</p>
      <section className="profile-section" aria-labelledby="profile-covered-title">
        <h3 id="profile-covered-title">이곳에서 찾아볼 빵 <small>담은 빵 중 리뷰로 확인된 것</small></h3>
        {item.coveredBreadNames.length
          ? <div className="profile-covered">{item.coveredBreadNames.map((name) => <Badge key={name}>{name}</Badge>)}</div>
          : <p className="profile-muted">{item.pickType === 'random' ? '담은 빵과 무관하게 골라 본 오늘의 발견이에요.' : '담은 빵의 리뷰 근거가 아직 없어요.'}</p>}
      </section>
      <BakeryProfileSections profile={profile} />
    </div>
  </article>;
}

export function RecommendationBags({ go, recommendation }) {
  const stores = recommendation.results;
  const [state, dispatch] = useReducer(transitionBags, stores.length, createBagState);
  const headingRef = useRef(null);
  const index = state.activeIndex;
  const stage = state.stages[index];
  const busy = stage === 'shaking' || stage === 'revealing';
  const store = stores[index];
  // Prefetch while the bag is opening so the sections are ready when the card is out.
  const profile = useBakeryProfile(store?.bakeryId, Boolean(store) && stage !== 'closed' && stage !== 'shaking');
  const galleryRef = useRef(null);
  const select = (target) => {
    dispatch({ type: 'select', index: target });
    // Coming from further down a long card, start the next bag at its top (an instant jump, no scroll animation).
    const gallery = galleryRef.current;
    if (gallery && gallery.getBoundingClientRect().top < 0) gallery.scrollIntoView({ block: 'start' });
  };

  useEffect(() => {
    if (!busy) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => { if (media.matches) dispatch({ type: 'finish' }); };
    finish();
    media.addEventListener('change', finish);
    const timer = window.setTimeout(() => dispatch({ type: 'advance', index }), STAGE_MS[stage]);
    return () => { window.clearTimeout(timer); media.removeEventListener('change', finish); };
  }, [busy, index, stage]);

  useEffect(() => {
    if (stage === 'open') headingRef.current?.focus({ preventScroll: true });
  }, [stage, index]);

  if (!store) return <SiteShell active="result" go={go}><main id="main-content" className="page-main"><ApiState title="조건에 맞는 빵집을 찾지 못했어요" description="담은 빵이나 취향을 바꾸고 다시 추천받아보세요."><Button onClick={() => go('selection')}>트레이로 돌아가기</Button></ApiState></main></SiteShell>;

  return <SiteShell active="result" go={go} className="result-screen">
    <main id="main-content" className="reveal-main">
      <header className="reveal-heading"><span className="section-kicker">나의 빵집 큐레이션</span><h1>{stage === 'open' ? '오늘의 빵집을 만나보세요' : '취향을 담은 봉투가 도착했어요'}</h1><p>{stage === 'closed' ? '봉투를 한 번 눌러 열어보세요.' : busy ? '당신을 위한 빵집을 꺼내고 있어요.' : `담은 빵에 어울리는 ${stores.length}곳을 골랐어요.`}</p></header>
      <section className="bag-gallery" ref={galleryRef} data-stage={stage} aria-label={`추천 ${index + 1} / ${stores.length}`} aria-busy={busy}>
        <button type="button" className="bag-side-nav" data-dir="prev" aria-label="이전 추천" disabled={busy || index === 0} onClick={() => select(index - 1)}><ArrowLeft aria-hidden="true" /></button>
        <div className="bag-slot" data-position="center" key={store.recommendationResultId ?? store.bakeryId}>
          <div className="bag-stage" data-stage={stage}>
            {stage === 'closed' || stage === 'shaking'
              ? <button className="bag-open-button" disabled={busy} onClick={() => dispatch({ type: 'open', immediate: reduceMotion() })} aria-label={`추천 ${index + 1} 봉투 열기`}>
                <BagArtwork />
                {stage === 'closed' ? <span className="bag-open-prompt">눌러서 열기 <ArrowRight aria-hidden="true" /></span> : null}
              </button>
              : <div className="bag-open-layout" data-stage={stage}>
                <div className="bag-opened">
                  <BagArtwork open label={bagLabelFor(store)}>
                    {stage === 'open' ? null : <BagCard item={store} stage={stage} />}
                  </BagArtwork>
                </div>
                {stage === 'revealing' ? null : <ProfileCard item={store} position={index} stage={stage} animate={state.freshIndex === index} headingRef={headingRef} profile={profile} go={go} recommendationId={recommendation.recommendationId} />}
              </div>}
          </div>
        </div>
        <button type="button" className="bag-side-nav" data-dir="next" aria-label="다음 추천" disabled={busy || index === stores.length - 1} onClick={() => select(index + 1)}><ArrowRight aria-hidden="true" /></button>
      </section>
      <footer className="reveal-footer">
        {stage !== 'open' ? <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'finish' })}>애니메이션 없이 결과 보기</Button> : <Button variant="ghost" size="sm" onClick={() => go('selection')}>다시 빵 담기</Button>}
        <p className="sr-only" role="status">{stage === 'open' ? `추천 ${index + 1}, ${store.bakeryName}. 봉투가 열렸어요.` : ''}</p>
      </footer>
    </main>
  </SiteShell>;
}
